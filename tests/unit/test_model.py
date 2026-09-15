"""tinytown.model: usage accounting, the Codex transport (via a fake binary), classifiers, budgets."""
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tinytown import model  # noqa: E402

UUID = '0f9d2b1a-3c4e-4f5a-8b6c-7d8e9f0a1b2c'


def fake_codex(root, body):
    """A stand-in for the codex binary: a python script with `body` after the argv assertions."""
    cli = root / 'fake-codex'
    cli.write_text('#!/usr/bin/env python3\nimport json,sys,time\nfrom pathlib import Path\n' + body)
    cli.chmod(0o755)
    return str(cli)


class EventsSummaryTests(unittest.TestCase):
    def test_sums_completed_turns_and_flags_failures(self):
        with tempfile.TemporaryDirectory() as tmp:
            events = Path(tmp) / 'events.jsonl'
            events.write_text('\n'.join([
                'not json', json.dumps({'type': 'thread.started', 'thread_id': 't1'}),
                json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 100, 'cached_input_tokens': 40,
                                                                 'output_tokens': 10, 'reasoning_output_tokens': 4}}),
                json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 50, 'output_tokens': 5}}),
                json.dumps({'type': 'turn.completed', 'usage': None}), '"scalar"']))
            summary = model.events_summary(events)
            self.assertEqual(summary['thread_id'], 't1')
            self.assertEqual(summary['completed_turns'], 2)
            self.assertEqual(summary['usage']['input_tokens'], 150)
            self.assertEqual(summary['usage']['cached_input_tokens'], 40)
            self.assertEqual(summary['usage']['total_tokens'], 165)  # cached/reasoning never added twice
            self.assertTrue(summary['usage_complete'])
            with events.open('a') as f:
                f.write('\n' + json.dumps({'type': 'turn.failed', 'error': {'message': 'boom'}}))
            summary = model.events_summary(events)
            self.assertTrue(summary['failed'])
            self.assertFalse(summary['usage_complete'])
            self.assertEqual(summary['usage']['total_tokens'], 165, 'a failure keeps the lower bound')

    def test_empty_file_is_incomplete_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            events = Path(tmp) / 'events.jsonl'
            events.write_text('')
            summary = model.events_summary(events)
            self.assertIsNone(summary['thread_id'])
            self.assertFalse(summary['usage_complete'])
            self.assertEqual(summary['usage'], model.empty_usage())


class RecoverPartialUsageTests(unittest.TestCase):
    def record(self, stamp, thread, response_id, tokens):
        return json.dumps({'type': 'token_usage_record', 'timestamp': stamp,
                           'payload': {'thread_id': thread, 'response_id': response_id, 'turn_id': 'turn',
                                       'usage': {'input_tokens': tokens, 'output_tokens': 1}}})

    def test_reads_only_this_thread_inside_the_call_window(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            call = root / 'call'
            call.mkdir()
            sessions = root / 'sessions' / '2026' / '09' / '15'
            sessions.mkdir(parents=True)
            other = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
            (sessions / f'rollout-2026-09-15T10-00-00-{UUID}.jsonl').write_text('\n'.join([
                json.dumps({'type': 'session_meta', 'payload': {}}),
                self.record('2026-09-15T10:00:05Z', UUID, 'r1', 100),
                self.record('2026-09-15T10:00:06Z', UUID, 'r1', 100),          # duplicate response id
                self.record('2026-09-15T10:00:07Z', UUID, 'r2', 50),
                self.record('2026-09-15T09:00:00Z', UUID, 'r-early', 999),      # before the call
                self.record('2026-09-15T11:00:00Z', UUID, 'r-late', 999),       # after the call
                self.record('2026-09-15T10:00:08Z', other, 'r-other', 999),     # another conversation
                'garbage']))
            (sessions / f'rollout-2026-09-15T10-00-00-{other}.jsonl').write_text(
                self.record('2026-09-15T10:00:08Z', other, 'r-other2', 999))
            started = datetime(2026, 9, 15, 10, tzinfo=timezone.utc).timestamp()
            result = {'thread_id': UUID, 'directory': str(call), 'usage_complete': False,
                      'usage': {**model.empty_usage(), 'input_tokens': 20, 'total_tokens': 20},
                      'started_at': started, 'finished_at': started + 60}
            model.recover_partial_usage(result, session_root=root / 'sessions')
            self.assertEqual(result['usage']['input_tokens'], 150)
            self.assertEqual(result['usage']['total_tokens'], 152)
            self.assertFalse(result['usage_complete'])
            self.assertIn('lower bound', result['usage_source'])
            saved = json.loads((call / 'partial-usage.json').read_text())
            self.assertEqual(sorted(r['response_id'] for r in saved['records']), ['r1', 'r2'])
            self.assertFalse(saved['complete'])

    def test_skips_complete_calls_and_unsafe_thread_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            complete = {'thread_id': UUID, 'directory': tmp, 'usage_complete': True, 'usage': {'total_tokens': 5}}
            model.recover_partial_usage(complete, session_root=root)
            self.assertEqual(complete['usage'], {'total_tokens': 5})
            for thread in (None, '../../etc', 'fixture'):
                result = {'thread_id': thread, 'directory': tmp, 'usage_complete': False, 'usage': {'total_tokens': 5}}
                model.recover_partial_usage(result, session_root=root)
                self.assertNotIn('usage_source', result)
            missing = {'thread_id': UUID, 'directory': tmp, 'usage_complete': False, 'usage': {'total_tokens': 5}}
            model.recover_partial_usage(missing, session_root=root / 'absent')
            self.assertEqual(missing['usage'], {'total_tokens': 5}, 'a missing ledger keeps the lower bound')

    def test_default_session_root_honours_codex_home(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict('os.environ', {'CODEX_HOME': tmp}):
            self.assertEqual(model.codex_home(), Path(tmp))
            sessions = Path(tmp) / 'sessions'
            sessions.mkdir()
            (sessions / f'rollout-{UUID}.jsonl').write_text(self.record('2026-09-15T10:00:05Z', UUID, 'r1', 7))
            call = Path(tmp) / 'call'
            call.mkdir()
            result = {'thread_id': UUID, 'directory': str(call), 'usage_complete': False,
                      'usage': model.empty_usage(), 'started_at': 0, 'finished_at': 4e9}
            model.recover_partial_usage(result)
            self.assertEqual(result['usage']['total_tokens'], 8, 'started_at=0 is a real start, not a missing one')


class ExecuteTests(unittest.TestCase):
    def test_fresh_transport_attaches_images_disables_tools_and_returns_the_documented_shape(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cli = fake_codex(root, '''
assert 'resume' not in sys.argv
assert sys.argv[1:3] == ['exec', '--ignore-user-config'] and '--json' in sys.argv
assert sys.argv[sys.argv.index('-m') + 1] == 'gpt-6-astra'
assert sys.argv[sys.argv.index('-s') + 1] == 'read-only'
assert sys.argv[-1] == '-'
assert sys.argv[sys.argv.index('--image') + 1].endswith('image.jpg')
assert 'features.shell_tool=false' in sys.argv and 'features.multi_agent=false' in sys.argv
assert 'web_search="disabled"' in sys.argv and 'approval_policy="never"' in sys.argv
assert 'model_reasoning_effort="high"' in sys.argv and 'tools.view_image=false' in sys.argv
assert any(x.startswith('model_instructions_file=') for x in sys.argv)
schema = json.loads(Path(sys.argv[sys.argv.index('--output-schema') + 1]).read_text())
assert schema['required'] == ['ok']
assert sys.stdin.read() == 'the prompt'
Path(sys.argv[sys.argv.index('-o') + 1]).write_text('{"ok":true}')
print(json.dumps({'type': 'thread.started', 'thread_id': 'fresh'}))
print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 90, 'output_tokens': 10}}))
''')
            result = model.execute(root / 'call', 'the prompt', model.object_schema({'ok': {'type': 'boolean'}}),
                                   [root / 'image.jpg'], model='astra', effort='high', timeout=10, binary=cli)
            self.assertEqual(result['response'], {'ok': True})
            self.assertEqual(result['usage']['total_tokens'], 100)
            self.assertTrue(result['usage_complete'])
            self.assertIsNone(result['error'])
            self.assertEqual(result['returncode'], 0)
            self.assertEqual(result['thread_id'], 'fresh')
            self.assertEqual(result['model'], 'gpt-6-astra')
            call = (root / 'call').resolve()  # macOS: /var -> /private/var
            self.assertEqual(result['raw'], str(call / 'response.json'))
            self.assertTrue(Path(result['raw']).is_file())
            self.assertAlmostEqual(result['duration'], result['elapsed_seconds'])
            self.assertGreaterEqual(result['finished_at'], result['started_at'])
            self.assertEqual(result['directory'], str(call))
            for key in model.TOKEN_FIELDS:
                self.assertIn(key, result['usage'])
            self.assertEqual((root / 'call' / 'instructions.txt').read_text(), model.INSTRUCTIONS)
            self.assertEqual((root / 'call' / 'prompt.txt').read_text(), 'the prompt')

    def test_thread_resumes_and_a_registered_backend_is_selected_by_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cli = fake_codex(root, '''
assert sys.argv[-3:] == ['resume', 'thread-1', '-']
sys.stdin.read()
Path(sys.argv[sys.argv.index('-o') + 1]).write_text('{}')
print(json.dumps({'type': 'thread.started', 'thread_id': 'thread-1'}))
print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 1, 'output_tokens': 1}}))
''')
            result = model.execute(root / 'call', 'p', {}, [], model='sol', timeout=10, binary=cli, thread='thread-1')
            self.assertIsNone(result['error'])

        class Stub:
            def run(self, directory, prompt, schema, images, model_id, effort, timeout, cancel):
                return {'response': {'stub': model_id}, 'usage': model.empty_usage(), 'usage_complete': True,
                        'error': None, 'returncode': 0, 'directory': str(directory)}

        with mock.patch.dict(model.BACKENDS, {'stub': Stub}):
            result = model.execute('/nonexistent', 'p', {}, [], model='luna', binary='stub')
            self.assertEqual(result['response'], {'stub': 'gpt-5.6-luna'})
        result = model.execute('/nonexistent', 'p', {}, [], model='x', binary=Stub())
        self.assertEqual(result['response'], {'stub': 'x'})

    def test_nonzero_exit_missing_usage_and_forbidden_tools_are_errors_not_exceptions(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            crash = fake_codex(root, 'sys.stdin.read()\nprint(json.dumps({"type":"thread.started","thread_id":"c"}))\nsys.exit(3)\n')
            result = model.execute(root / 'crash', 'p', {}, [], model='astra', timeout=10, binary=crash)
            self.assertEqual(result['error'], 'codex exited 3')
            self.assertIsNone(result['response'])
            self.assertFalse(result['usage_complete'])
            self.assertEqual(result['returncode'], 3)

            silent = fake_codex(root, '''
sys.stdin.read()
Path(sys.argv[sys.argv.index('-o') + 1]).write_text('{"ok":1}')
print(json.dumps({'type': 'thread.started', 'thread_id': 's'}))
''')
            result = model.execute(root / 'silent', 'p', {}, [], model='astra', timeout=10, binary=silent)
            self.assertEqual(result['error'], 'missing terminal token usage')
            self.assertEqual(result['response'], {'ok': 1}, 'the response is kept for inspection')
            self.assertFalse(result['usage_complete'])

            tools = fake_codex(root, '''
sys.stdin.read()
Path(sys.argv[sys.argv.index('-o') + 1]).write_text('{}')
print(json.dumps({'type': 'thread.started', 'thread_id': 't'}))
print(json.dumps({'type': 'item.completed', 'item': {'type': 'command_execution', 'command': 'ls'}}))
print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 1, 'output_tokens': 1}}))
''')
            result = model.execute(root / 'tools', 'p', {}, [], model='astra', timeout=10, binary=tools)
            self.assertEqual(result['error'], 'unexpected tool call in bounded-response transport')

            nojson = fake_codex(root, '''
sys.stdin.read()
Path(sys.argv[sys.argv.index('-o') + 1]).write_text('not json')
print(json.dumps({'type': 'thread.started', 'thread_id': 't'}))
print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 1, 'output_tokens': 1}}))
''')
            result = model.execute(root / 'nojson', 'p', {}, [], model='astra', timeout=10, binary=nojson)
            self.assertIn('Expecting value', result['error'])
            self.assertTrue(result['usage_complete'], 'usage was measured even though the response is unusable')

    def test_timeout_kills_the_process_group_and_is_recognized_as_a_timeout_interruption(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            hang = fake_codex(root, '''
print(json.dumps({'type': 'thread.started', 'thread_id': 'timeout-fixture'}), flush=True)
print(json.dumps({'type': 'turn.started'}), flush=True)
time.sleep(30)
''')
            started = time.time()
            result = model.execute(root / 'call', 'p', {}, [], model='astra', timeout=.6, binary=hang)
            self.assertLess(time.time() - started, 10)
            self.assertEqual(result['error'], model.TIMEOUT_ERROR)
            self.assertIn(result['returncode'], (-15, -9))
            self.assertEqual(result['completed_turns'], 0)
            self.assertFalse(result['usage_complete'])
            self.assertEqual(result['usage']['total_tokens'], 0)
            self.assertIsNone(result['response'])
            evidence = model.timeout_interruption(result)
            self.assertEqual(evidence['kind'], 'bounded-response-timeout')
            self.assertEqual(evidence['thread_id'], 'timeout-fixture')
            self.assertIsNone(model.capacity_rejection(result))
            # Partial output or a changed termination record invalidates the evidence.
            (root / 'call' / 'response.json').write_text('{}')
            self.assertIsNone(model.timeout_interruption(result))
            (root / 'call' / 'response.json').unlink()
            self.assertIsNone(model.timeout_interruption({**result, 'returncode': 1}))
            self.assertIsNone(model.timeout_interruption({**result, 'error': 'codex exited -15'}))
            self.assertIsNone(model.timeout_interruption({**result, 'completed_turns': 1}))
            self.assertIsNone(model.timeout_interruption({**result, 'error': None}), 'a success is never a timeout')
            with (root / 'call' / 'events.jsonl').open('a') as f:
                f.write(json.dumps({'type': 'item.completed'}) + '\n')
            self.assertIsNone(model.timeout_interruption(result))

    def test_cancel_stops_the_call_and_is_reported_as_cancelled(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            hang = fake_codex(root, 'print(json.dumps({"type":"thread.started","thread_id":"c"}), flush=True)\ntime.sleep(30)\n')
            cancel = threading.Event()
            threading.Timer(.4, cancel.set).start()
            result = model.execute(root / 'call', 'p', {}, [], model='astra', timeout=30, binary=hang, cancel=cancel)
            self.assertEqual(result['error'], model.CANCELLED_ERROR)
            self.assertFalse(result['usage_complete'])
            self.assertIsNone(model.timeout_interruption(result), 'a cancellation is not a timeout')


class CapacityRejectionTests(unittest.TestCase):
    def rejected_call(self, root):
        folder = root / 'call'
        folder.mkdir()
        events = [{'type': 'thread.started', 'thread_id': 'fixture'}, {'type': 'turn.started'},
                  {'type': 'error', 'message': model.CAPACITY_MESSAGE},
                  {'type': 'turn.failed', 'error': {'message': model.CAPACITY_MESSAGE}}]
        (folder / 'events.jsonl').write_text('\n'.join(json.dumps(e) for e in events))
        return folder

    def test_recognizes_only_an_explicit_admission_rejection(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = self.rejected_call(Path(tmp))
            # The execute() shape and the old ledger shape both classify.
            result = {'error': 'codex exited 1', 'usage': {**model.empty_usage()}, 'directory': str(folder)}
            ledger = {'status': 'failed', 'tokens': 0, 'complete': False, 'directory': str(folder)}
            for call in (result, ledger):
                evidence = model.capacity_rejection(call)
                self.assertEqual(evidence['kind'], 'capacity-admission-rejection')
                self.assertEqual(evidence['thread_id'], 'fixture')
                self.assertEqual(len(evidence['events_sha256']), 64)
            self.assertIsNone(model.timeout_interruption(result))
            self.assertIsNone(model.capacity_rejection({**result, 'usage': {'total_tokens': 3}}), 'measured tokens: not a rejection')
            self.assertIsNone(model.capacity_rejection({**result, 'error': None}), 'a success is not a rejection')
            self.assertIsNone(model.capacity_rejection({**ledger, 'status': 'completed'}))
            (folder / 'response.json').write_text('{}')
            self.assertIsNone(model.capacity_rejection(result), 'partial work is not a rejection')
            (folder / 'response.json').unlink()
            (folder / 'partial-usage.json').write_text('{}')
            self.assertIsNone(model.capacity_rejection(result), 'recovered usage is not a rejection')
            (folder / 'partial-usage.json').unlink()
            self.assertIsNotNone(model.capacity_rejection(result))
            with (folder / 'events.jsonl').open('a') as f:
                f.write('\n' + json.dumps({'type': 'item.completed'}))
            self.assertIsNone(model.capacity_rejection(result), 'extra events: not a bare rejection')

    def test_rejects_other_error_messages_and_missing_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = self.rejected_call(Path(tmp))
            result = {'error': 'codex exited 1', 'usage': model.empty_usage(), 'directory': str(folder)}
            lines = (folder / 'events.jsonl').read_text().splitlines()
            lines[2] = json.dumps({'type': 'error', 'message': 'Rate limit exceeded'})
            (folder / 'events.jsonl').write_text('\n'.join(lines))
            self.assertIsNone(model.capacity_rejection(result))
            self.assertIsNone(model.capacity_rejection({**result, 'directory': tmp + '/absent'}))
            self.assertIsNone(model.capacity_rejection({'error': 'x'}))


class BudgetTests(unittest.TestCase):
    def test_reservations_wait_for_in_flight_calls_without_cancelling_them(self):
        budget = model.Budget(max_tokens=100)
        order = []
        first = budget.reserve(60)
        first.__enter__()
        self.assertEqual(budget.remaining()['tokens'], 40)

        def second():
            with budget.reserve(60):
                order.append('admitted')

        worker = threading.Thread(target=second)
        worker.start()
        time.sleep(.3)
        self.assertEqual(order, [], 'the second call waits for room instead of failing')
        budget.record({'usage': {'input_tokens': 20, 'output_tokens': 10, 'total_tokens': 30}, 'usage_complete': True})
        first.__exit__(None, None, None)
        worker.join(timeout=5)
        self.assertEqual(order, ['admitted'])
        self.assertEqual(budget.spent, 30)
        self.assertEqual(budget.reserved, 0)

    def test_check_and_reserve_raise_when_measured_spend_leaves_no_room(self):
        budget = model.Budget(max_tokens=100)
        budget.record({'input_tokens': 70, 'output_tokens': 0})
        with self.assertRaisesRegex(model.BudgetExhausted, 'insufficient room'):
            with budget.reserve(40):
                pass
        with budget.reserve(30):
            pass
        budget.record({'total_tokens': 30})
        with self.assertRaisesRegex(model.BudgetExhausted, 'measured token budget'):
            budget.check()
        self.assertEqual(budget.remaining()['tokens'], 0)

    def test_wall_time_and_unlimited_budgets(self):
        clock = [0.0]
        budget = model.Budget(max_tokens=None, max_seconds=100, clock=lambda: clock[0])
        budget.check()
        self.assertEqual(budget.remaining(), {'tokens': None, 'seconds': 100})
        self.assertEqual(budget.call_timeout(120), 100)
        clock[0] = 99.95
        self.assertEqual(budget.call_timeout(120), .1)
        clock[0] = 100
        with self.assertRaisesRegex(model.BudgetExhausted, 'wall-time'):
            budget.check()
        with self.assertRaises(model.BudgetExhausted):
            with budget.reserve(1):
                pass
        unlimited = model.Budget()
        unlimited.record({'total_tokens': 10 ** 9})
        unlimited.check()
        self.assertEqual(unlimited.call_timeout(120), 120)

    def test_cancel_aborts_a_waiting_reservation_and_incomplete_usage_is_tallied(self):
        budget = model.Budget(max_tokens=100)
        holder = budget.reserve(80)
        holder.__enter__()
        cancel = threading.Event()
        threading.Timer(.3, cancel.set).start()
        with self.assertRaisesRegex(model.BudgetExhausted, 'cancelled'):
            with budget.reserve(30, cancel=cancel):
                pass
        holder.__exit__(None, None, None)
        budget.record({'usage': {'total_tokens': 5}, 'usage_complete': False})
        budget.record({'usage': {'total_tokens': 5}, 'usage_complete': True})
        summary = budget.summary()
        self.assertEqual((summary['tokens'], summary['calls'], summary['incomplete_calls']), (10, 2, 1))
        self.assertFalse(summary['usage_complete'])


class SchemaAndModelsTests(unittest.TestCase):
    def test_object_schema_is_strict_and_aliases_resolve(self):
        s = model.object_schema({'a': {'type': 'string'}, 'b': {'type': 'number'}})
        self.assertEqual(s, {'type': 'object', 'properties': {'a': {'type': 'string'}, 'b': {'type': 'number'}},
                             'required': ['a', 'b'], 'additionalProperties': False})
        self.assertIs(model.schema, model.object_schema)
        self.assertEqual(model.resolve_model('astra'), 'gpt-6-astra')
        self.assertEqual(model.resolve_model('sol'), 'gpt-5.6-sol')
        self.assertEqual(model.resolve_model('gpt-custom'), 'gpt-custom')
        self.assertEqual(set(model.MODELS), {'astra', 'sol', 'terra', 'luna'})
        self.assertTrue(issubclass(model.BudgetExhausted, Exception))

    def test_current_thread_reads_codex_thread_id_but_is_never_a_default(self):
        with mock.patch.dict('os.environ', {'CODEX_THREAD_ID': 'parent-thread'}):
            self.assertEqual(model.current_thread(), 'parent-thread')
            backend = model.backend_for('codex')
            self.assertIsNone(backend.thread)
            self.assertNotIn('resume', backend.command(Path('/x'), 'gpt-6-astra', 'medium', []))
        with mock.patch.dict('os.environ', {'CODEX_THREAD_ID': ''}):
            self.assertIsNone(model.current_thread())


if __name__ == '__main__':
    unittest.main()
