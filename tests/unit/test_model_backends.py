"""Provider routing, prompt segments and the Anthropic backend (with a fake client; no network)."""
import json
from pathlib import Path
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest
from unittest import mock

from tinytown import model

PNG = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000'
                    '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082')


class FakeStream:
    def __init__(self, client):
        self.client = client

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def __iter__(self):
        for kind in ('message_start', 'content_block_delta', 'message_stop'):
            if self.client.delay:
                time.sleep(self.client.delay)
            yield SimpleNamespace(type=kind)

    def get_final_message(self):
        return self.client.message


class FakeClient:
    def __init__(self, message=None, error=None, delay=0):
        self.message, self.error, self.delay = message, error, delay
        self.calls = []
        self.messages = self

    def stream(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return FakeStream(self)


def message(text, stop_reason='end_turn', **usage):
    counts = {'input_tokens': 100, 'output_tokens': 40, 'cache_read_input_tokens': 0, 'cache_creation_input_tokens': 0}
    counts.update(usage)
    return SimpleNamespace(id='msg_1', stop_reason=stop_reason, usage=SimpleNamespace(**counts),
                           content=[SimpleNamespace(type='thinking', thinking=''), SimpleNamespace(type='text', text=text)])


def backend(client):
    return model.AnthropicBackend(client_factory=lambda timeout: client)


SCHEMA = model.object_schema({'ok': {'type': 'boolean'}, 'cues': {'type': 'array', 'items': {'type': 'string'}, 'maxItems': 5}})


class RoutingTests(unittest.TestCase):
    def test_aliases_and_literal_ids_choose_a_provider(self):
        self.assertEqual(model.resolve('astra'), ('codex', 'gpt-6-astra'))
        self.assertEqual(model.resolve('opus'), ('anthropic', 'claude-opus-5-5'))
        self.assertEqual(model.resolve('fable'), ('anthropic', 'claude-fable-5-1'))
        self.assertEqual(model.resolve('haiku'), ('anthropic', 'claude-haiku-4-5-20251001'))
        self.assertEqual(model.resolve('claude-sonnet-5'), ('anthropic', 'claude-sonnet-5'))
        self.assertEqual(model.resolve('gpt-custom'), ('codex', 'gpt-custom'))
        self.assertEqual(model.resolve_model('sonnet'), 'claude-sonnet-5')

    def test_backend_for_routes_by_model_and_keeps_explicit_backends(self):
        self.assertIsInstance(model.backend_for('codex', model='astra'), model.CodexBackend)
        self.assertIsInstance(model.backend_for('codex', model='opus'), model.AnthropicBackend)
        self.assertIsInstance(model.backend_for('/opt/bin/codex', model='claude-sonnet-5'), model.AnthropicBackend)
        custom = model.backend_for('/opt/bin/codex', model='sol')
        self.assertEqual(custom.binary, '/opt/bin/codex')
        stub = object()
        self.assertIs(model.backend_for(stub, model='opus'), stub)

    def test_execute_sends_anthropic_models_to_the_anthropic_backend(self):
        seen = {}

        class Fake:
            def run(self, directory, prompt, schema, images, model_id, effort, timeout, cancel):
                seen['model'] = model_id
                return {'response': {}, 'error': None}

        with mock.patch.dict(model.BACKENDS, {'anthropic': Fake}):
            model.execute('/nonexistent', 'p', {}, [], model='opus')
        self.assertEqual(seen['model'], 'claude-opus-5-5')


class SegmentTests(unittest.TestCase):
    def test_segments_join_for_codex(self):
        segments = [{'text': 'KIT ', 'cache': True}, 'per-building', {'text': ''}]
        self.assertEqual(model.prompt_text(segments), 'KIT per-building')
        self.assertEqual(model.prompt_text('plain'), 'plain')
        self.assertEqual(model.prompt_segments(segments), [{'text': 'KIT ', 'cache': True},
                                                           {'text': 'per-building', 'cache': False}])

    def test_codex_backend_receives_the_joined_prompt(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cli = root / 'codex'
            cli.write_text('#!/usr/bin/env python3\nimport sys, json\nfrom pathlib import Path\n'
                           'data = sys.stdin.read()\n'
                           "Path(sys.argv[sys.argv.index('-o') + 1]).write_text(json.dumps({'echo': data}))\n"
                           "print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 1, 'output_tokens': 1}}))\n")
            cli.chmod(0o755)
            result = model.execute(root / 'call', [{'text': 'A', 'cache': True}, {'text': 'B'}], {}, [],
                                   model='astra', timeout=10, binary=str(cli))
            self.assertIsNone(result['error'])
            self.assertEqual(result['response'], {'echo': 'AB'})
            self.assertEqual((root / 'call' / 'prompt.txt').read_text(), 'AB')


class AnthropicBackendTests(unittest.TestCase):
    def run_call(self, client, prompt='prompt', images=(), timeout=10, cancel=None, model_id='claude-sonnet-5',
                 effort='high'):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        directory = Path(tmp.name) / 'call'
        paths = []
        for name in images:
            path = Path(tmp.name) / name
            path.write_bytes(PNG)
            paths.append(str(path))
        result = backend(client).run(directory, prompt, SCHEMA, paths, model_id, effort, timeout,
                                     cancel or threading.Event())
        return result, directory

    def test_success_returns_the_documented_shape_and_writes_scratch(self):
        client = FakeClient(message('{"ok": true, "cues": ["a"]}', input_tokens=10, cache_read_input_tokens=900,
                                    cache_creation_input_tokens=50, output_tokens=40))
        result, directory = self.run_call(client, prompt=[{'text': 'KIT', 'cache': True}, {'text': 'house'}],
                                          images=['a.png', 'b.jpg'])
        self.assertIsNone(result['error'])
        self.assertEqual(result['response'], {'ok': True, 'cues': ['a']})
        self.assertEqual(result['usage'], {'input_tokens': 960, 'cached_input_tokens': 900,
                                           'cache_write_input_tokens': 50, 'output_tokens': 40,
                                           'reasoning_output_tokens': 0, 'total_tokens': 1000})
        self.assertTrue(result['usage_complete'])
        for key in ('returncode', 'started_at', 'finished_at', 'elapsed_seconds', 'duration', 'directory', 'model',
                    'effort', 'raw', 'thread_id', 'completed_turns', 'failed', 'command'):
            self.assertIn(key, result)
        self.assertEqual(result['returncode'], 0)
        for name in ('instructions.txt', 'prompt.txt', 'schema.json', 'request.json', 'response.json', 'events.jsonl'):
            self.assertTrue((directory / name).is_file(), name)
        self.assertEqual((directory / 'prompt.txt').read_text(), 'KIThouse')

        request = client.calls[0]
        self.assertEqual(request['model'], 'claude-sonnet-5')
        self.assertEqual(request['thinking'], {'type': 'adaptive'})
        self.assertEqual(request['output_config']['effort'], 'high')
        fmt = request['output_config']['format']
        self.assertEqual(fmt['type'], 'json_schema')
        self.assertNotIn('maxItems', json.dumps(fmt['schema']))
        self.assertEqual(request['system'][0]['cache_control'], {'type': 'ephemeral'})
        content = request['messages'][0]['content']
        # cached prefix first (stable across buildings), then images, then the uncached tail
        self.assertEqual([b['type'] for b in content], ['text', 'image', 'image', 'text'])
        self.assertEqual((content[0]['text'], content[3]['text']), ('KIT', 'house'))
        self.assertEqual(content[0]['cache_control'], {'type': 'ephemeral'})
        self.assertEqual(content[1]['source']['media_type'], 'image/png')
        self.assertEqual(content[2]['source']['media_type'], 'image/jpeg')
        self.assertNotIn('cache_control', content[3])
        self.assertEqual(request['max_tokens'], 64000)
        logged = (directory / 'request.json').read_text()
        self.assertNotIn(content[1]['source']['data'], logged)
        self.assertEqual([b['type'] for b in json.loads(logged)['messages'][0]['content']], ['text', 'image', 'image', 'text'])

    def test_haiku_runs_without_thinking_or_effort(self):
        client = FakeClient(message('{"ok": true, "cues": []}'))
        result, _ = self.run_call(client, model_id='claude-haiku-4-5-20251001', effort='medium')
        self.assertIsNone(result['error'])
        self.assertNotIn('thinking', client.calls[0])
        self.assertNotIn('effort', client.calls[0]['output_config'])

    def test_cancel_and_timeout_stop_the_call(self):
        cancel = threading.Event()
        threading.Timer(.3, cancel.set).start()
        result, _ = self.run_call(FakeClient(message('{}'), delay=2), cancel=cancel)
        self.assertEqual(result['error'], model.CANCELLED_ERROR)
        self.assertIsNone(result['response'])
        self.assertFalse(result['usage_complete'])

        start = time.time()
        result, _ = self.run_call(FakeClient(message('{}'), delay=2), timeout=.4)
        self.assertEqual(result['error'], model.TIMEOUT_ERROR)
        self.assertLess(time.time() - start, 3)

    def test_overloaded_and_rate_limits_are_transient_errors_not_exceptions(self):
        class OverloadedError(Exception):
            status_code = 529
            body = {'error': {'type': 'overloaded_error'}}

        result, _ = self.run_call(FakeClient(error=OverloadedError('busy')))
        self.assertEqual(result['error'], model.OVERLOADED_ERROR)
        self.assertEqual(model.anthropic_transient(result)['kind'], 'anthropic-overloaded')
        self.assertIsNone(model.capacity_rejection(result))

        class RateLimitError(Exception):
            status_code = 429

        result, _ = self.run_call(FakeClient(error=RateLimitError('slow down')))
        self.assertEqual(model.anthropic_transient(result)['kind'], 'anthropic-rate-limited')

        class BadRequestError(Exception):
            status_code = 400
            message = 'bad schema'

        result, _ = self.run_call(FakeClient(error=BadRequestError('x')))
        self.assertEqual(result['error'], 'anthropic 400: bad schema')
        self.assertIsNone(model.anthropic_transient(result))

    def test_refusal_truncation_and_bad_json_are_errors_with_measured_usage(self):
        for text, stop, expected in (('{}', 'refusal', 'anthropic refusal'),
                                     ('{"ok": tr', 'max_tokens', 'anthropic response truncated (max_tokens)'),
                                     ('not json', 'end_turn', 'response is not JSON')):
            result, directory = self.run_call(FakeClient(message(text, stop_reason=stop)))
            self.assertTrue(result['error'].startswith(expected), result['error'])
            self.assertIsNone(result['response'])
            self.assertEqual(result['usage']['total_tokens'], 140)
            self.assertFalse((directory / 'response.json').exists())

    def test_missing_package_is_a_reported_error(self):
        def factory(timeout):
            raise RuntimeError("Anthropic models need the anthropic package: pip install -e '.[anthropic]'")

        result = model.AnthropicBackend(client_factory=factory).run(
            Path(tempfile.mkdtemp()) / 'call', 'p', SCHEMA, [], 'claude-opus-5-5', 'medium', 10, threading.Event())
        self.assertIn('anthropic package', result['error'])

    def test_budget_records_anthropic_usage(self):
        result, _ = self.run_call(FakeClient(message('{"ok": true, "cues": []}')))
        budget = model.Budget(max_tokens=1000)
        budget.record(result)
        self.assertEqual(budget.summary()['tokens'], 140)
        self.assertTrue(budget.summary()['usage_complete'])


if __name__ == '__main__':
    unittest.main()
