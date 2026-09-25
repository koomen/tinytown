"""Building jobs, the derived building index, escalation and agent backends of the change queue.

Real temporary Git repositories; the author pipeline and acceptance are fakes.
"""
import json
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest import mock

from tests.unit.test_changes import ChangeQueueFixture
from tinytown import building_jobs, change_agents, changes
from tinytown.state import fingerprint

SITE = 'town'
BLUEPRINT = {'volumes': [{'id': 'main', 'u': [-3, 3], 'v': [-2, 2], 'height': 5}]}


def building(bid, name=None):
    return {'id': bid, 'addr': f'{bid} Main Street', 'name': name, 'style': {'kind': 'house'},
            'obb': {'cx': 0, 'cz': 0, 'w': 6, 'd': 4, 'angle': 0}}


class FakeRun:
    """Stands in for author.Run: writes a draft and a passing review for each building."""
    calls = []

    def __init__(self, paths, ids=None, *, reauthor=(), log=None, workers=3, author_model='astra'):
        self.paths, self.ids, self.reauthor, self.log = paths, list(ids or ()), tuple(reauthor), log
        self.halted = None
        FakeRun.calls.append(self)

    def halt(self, reason):
        self.halted = reason

    def run(self):
        result = {}
        for bid in self.ids:
            b = self.paths.building(bid)
            b.dir.mkdir(parents=True, exist_ok=True)
            draft = {**BLUEPRINT, 'wall': '#aa0000'}
            b.draft.write_text(json.dumps(draft))
            b.review.write_text(json.dumps({'draft_hash': fingerprint(draft), 'passed': True, 'findings': [],
                                            'report': {'verdict': 'ready', 'summary': 'Charming.', 'issues': []}}))
            self.log(f'{bid}: review ready')
            result[bid] = {'status': 'reviewed', 'steps': ['author 0', 'render initial', 'review 0']}
        return {'buildings': result, 'skipped': {}, 'budget': {'tokens': 1200, 'calls': 2, 'seconds': 1.0}, 'stopped': None}


def fake_accept(paths, ids, *, rebuild=True, force=False, out=print):
    overrides = json.loads(paths.overrides.read_text())
    for bid in ids:
        overrides.setdefault('blueprints', {})[bid] = json.loads(paths.building(bid).draft.read_text())
    paths.overrides.write_text(json.dumps(overrides))
    site = json.loads(paths.scene.read_text())
    site['built'] = site.get('built', 0) + 1
    paths.scene.write_text(json.dumps(site))
    return list(ids)


class BuildingFixture(ChangeQueueFixture):
    def setUp(self):
        super().setUp()
        self.write('.gitignore', 'runs/\n.env\nprivate/\ndata/*/buildings/*/renders/*.png\n')
        self.write(f'data/{SITE}/site.json', json.dumps({'name': SITE, 'buildings': [
            building('101', 'Firehouse'), building('102'), building('103'), building('-7')]}))
        self.write(f'data/{SITE}/overrides.json', json.dumps({'blueprints': {'103': BLUEPRINT},
                   'miniature_review': {'103': {'status': 'ready'}}}))
        self.write(f'data/{SITE}/buildings/102/fronts.json', '{}')
        self.git('add', '.')
        self.git('commit', '-qm', 'site')
        FakeRun.calls = []
        patcher = mock.patch('tinytown.author.Run', FakeRun)
        patcher.start()
        self.addCleanup(patcher.stop)

    def wait(self, change_id, *statuses):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            record = self.queue.get(change_id, detail=True)
            if record['status'] in statuses:
                return record
            time.sleep(.02)
        self.fail(f'Job never became {statuses}: {record}')


class BuildingIndexTests(BuildingFixture):
    def test_status_groups_are_derived_from_files(self):
        result = building_jobs.query(self.root, SITE)
        groups = {row['id']: row['group'] for row in result['rows']}
        self.assertEqual(groups, {'101': 'needs-refs', '102': 'needs-author', '103': 'accepted', '-7': 'needs-refs'})
        self.assertEqual(result['counts']['needs-refs'], 2)
        self.assertEqual([r['id'] for r in building_jobs.query(self.root, SITE, q='fire')['rows']], ['101'])
        self.assertEqual(building_jobs.query(self.root, SITE, group='accepted')['total'], 1)
        # A building in an active job is in progress, with a link to the job.
        rows = building_jobs.query(self.root, SITE, active={'101': 4})['rows']
        self.assertEqual(next(r for r in rows if r['id'] == '101')['job'], 4)

    def test_forced_publication_and_failed_review_need_attention(self):
        b = Path(self.root, f'data/{SITE}/buildings/102')
        b.joinpath('draft.json').write_text(json.dumps(BLUEPRINT))
        for n in (1, 2):
            b.joinpath(f'repair-{n}.json').write_text('{}')
        b.joinpath('review.json').write_text(json.dumps({'draft_hash': fingerprint(BLUEPRINT), 'passed': False,
                                                         'repairs_exhausted': True, 'report': {'verdict': 'repair'}}))
        overrides = json.loads(Path(self.root, f'data/{SITE}/overrides.json').read_text())
        overrides['miniature_review']['103'] = {'status': 'needs-attention', 'publication': {'forced': True}}
        Path(self.root, f'data/{SITE}/overrides.json').write_text(json.dumps(overrides))
        rows = {r['id']: r for r in building_jobs.query(self.root, SITE)['rows']}
        self.assertEqual((rows['102']['group'], rows['102']['forced'], rows['102']['repairs']), ('needs-attention', True, 2))
        self.assertEqual(rows['103']['group'], 'needs-attention')

    def test_images_are_served_only_from_the_building_directory(self):
        renders = Path(self.root, f'data/{SITE}/buildings/101/renders')
        renders.mkdir(parents=True)
        (renders / 'compare-+u.png').write_bytes(b'png')
        (renders / 'notes.txt').write_text('private')
        info = building_jobs.details(self.root, SITE, '101')
        self.assertEqual(info['images'][0]['kind'], 'compare')
        path, mime = building_jobs.image_file(self.root, SITE, '101', 'renders/compare-+u.png')
        self.assertEqual((path.read_bytes(), mime), (b'png', 'image/png'))
        for name in ('renders/notes.txt', '../102/fronts.json', 'renders/../../103/x.png', '.hidden.png', ''):
            with self.subTest(name=name), self.assertRaises((ValueError, FileNotFoundError)):
                building_jobs.image_file(self.root, SITE, '101', name)
        with self.assertRaises(ValueError):
            building_jobs.image_file(self.root, '../etc', '101', 'renders/compare-+u.png')

    def test_http_buildings_endpoints(self):
        port = self.server()
        status, body = self.request(port, 'GET', f'/api/buildings?site={SITE}&group=needs-refs',
                                    headers={'Host': f'127.0.0.1:{port}'})
        self.assertEqual(status, 200)
        self.assertEqual({r['id'] for r in json.loads(body)['rows']}, {'101', '-7'})
        status, body = self.request(port, 'GET', f'/api/buildings/{SITE}/101/files/..%2F102%2Ffronts.json',
                                    headers={'Host': f'127.0.0.1:{port}'})
        self.assertEqual(status, 400)
        status, _ = self.request(port, 'POST', '/api/buildings/jobs', {'site': SITE, 'ids': ['101']},
                                 headers={'Host': f'127.0.0.1:{port}', 'X-TinyTown': 'changes', 'Content-Type': 'application/json'})
        self.assertEqual(status, 201)

    def test_options_come_from_the_run_signature(self):
        self.assertEqual(building_jobs.validate_options({'workers': 2, 'author_model': 'opus'}),
                         {'workers': 2, 'author_model': 'opus'})
        for bad in ({'accept': True}, {'log': 'x'}, {'nope': 1}, {'workers': [1]}):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                building_jobs.validate_options(bad)


class BuildingJobTests(BuildingFixture):
    def test_job_authors_then_approval_accepts_and_commits_only_its_delta(self):
        self.write('src/other.js', 'uncommitted operator edit\n')
        record = self.queue.create_building_job(SITE, ['101', '102'])
        self.assertEqual((record['kind'], record['preview']['drafts']), ('building', ['101', '102']))
        with self.assertRaisesRegex(ValueError, 'Already in change'):
            self.queue.create_building_job(SITE, ['102'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        self.assertEqual({e['status'] for e in record['buildings'].values()}, {'reviewed'})
        self.assertIn('101: review ready', record['log'])
        self.assertTrue(any('./town bake town' in s['text'] for s in record['final_steps']))
        head = self.git('rev-parse', 'HEAD').strip()
        scratch = Path(self.root, f'data/{SITE}/buildings/101')
        for name in ('author.json', 'human-feedback.json', 'renders/initial-overview.png.json'):
            (scratch / name).parent.mkdir(parents=True, exist_ok=True)
            (scratch / name).write_text('{"directory": "/abs/runs/model-calls"}')
        with mock.patch('tinytown.author.accept', side_effect=fake_accept) as accept:
            partial = self.queue.approve(record['id'], ['101'])
        accept.assert_called_once()
        self.assertEqual(accept.call_args.args[1], ['101'])
        self.assertEqual(partial['status'], 'pending_approval')
        committed = set(self.git('show', '--name-only', '--format=', 'HEAD').split())
        # draft.json joins; untracked scratch (review, model records, feedback, render provenance) never does
        self.assertEqual(committed, {f'data/{SITE}/overrides.json', f'data/{SITE}/site.json',
                                     f'data/{SITE}/buildings/101/draft.json'})
        self.assertEqual(self.git('rev-parse', 'HEAD~1').strip(), head)
        self.assertIn('src/other.js', self.git('status', '--porcelain'))  # unrelated dirt stays out
        with mock.patch('tinytown.author.accept', side_effect=fake_accept):
            done = self.queue.approve(record['id'])
        self.assertEqual(done['status'], 'approved')
        self.assertTrue(done['integration']['commit'])
        self.assertEqual(len(done['integration']['commits']), 2)

    def test_refused_acceptance_records_reasons_and_can_be_forced(self):
        record = self.queue.create_building_job(SITE, ['101'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        refusal = ValueError('accept refused; nothing changed:\n  101: forced publication (repair-limit-reached)')
        with mock.patch('tinytown.author.accept', side_effect=refusal), self.assertRaisesRegex(ValueError, 'Approve anyway'):
            self.queue.approve(record['id'])
        record = self.queue.get(record['id'])
        self.assertIn('forced publication', record['buildings']['101']['refused'])
        self.assertIn('integration-blocker', [s['id'] for s in record['final_steps']])
        with mock.patch('tinytown.author.accept', side_effect=fake_accept) as accept:
            record = self.queue.approve(record['id'], force=True)
        self.assertTrue(accept.call_args.kwargs['force'])
        self.assertEqual(record['status'], 'approved')

    def test_failed_commit_restores_overrides(self):
        record = self.queue.create_building_job(SITE, ['101'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        before = Path(self.root, f'data/{SITE}/overrides.json').read_text()
        with mock.patch('tinytown.author.accept', side_effect=fake_accept), \
                mock.patch('tinytown.change_commit.prepare', side_effect=ValueError('Switch to main')), \
                self.assertRaises(ValueError):
            self.queue.approve(record['id'])
        self.assertEqual(Path(self.root, f'data/{SITE}/overrides.json').read_text(), before)

    def test_tracked_building_records_are_committed(self):
        self.write(f'data/{SITE}/buildings/101/notes.md', 'old\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'notes')
        record = self.queue.create_building_job(SITE, ['101'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        self.write(f'data/{SITE}/buildings/101/notes.md', 'new\n')
        with mock.patch('tinytown.author.accept', side_effect=fake_accept):
            self.queue.approve(record['id'])
        self.assertIn(f'data/{SITE}/buildings/101/notes.md', self.git('show', '--name-only', '--format=', 'HEAD').split())

    def test_a_crash_inside_accept_restores_overrides_and_site(self):
        record = self.queue.create_building_job(SITE, ['101'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        overrides, site = (Path(self.root, f'data/{SITE}/{n}').read_text() for n in ('overrides.json', 'site.json'))

        def crash(paths, ids, **kwargs):
            paths.overrides.write_text('{"blueprints": {"101": {}}}')
            raise RuntimeError('site.build crashed')

        with mock.patch('tinytown.author.accept', side_effect=crash), self.assertRaisesRegex(RuntimeError, 'crashed'):
            self.queue.approve(record['id'])
        self.assertEqual(Path(self.root, f'data/{SITE}/overrides.json').read_text(), overrides)
        self.assertEqual(Path(self.root, f'data/{SITE}/site.json').read_text(), site)
        self.assertEqual(self.queue.get(record['id'])['status'], 'pending_approval')

    def test_approval_refuses_a_draft_changed_after_the_job(self):
        record = self.queue.create_building_job(SITE, ['101'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        self.assertTrue(record['buildings']['101']['draft_hash'])
        Path(self.root, f'data/{SITE}/buildings/101/draft.json').write_text(json.dumps({**BLUEPRINT, 'wall': '#00ff00'}))
        with mock.patch('tinytown.author.accept', side_effect=fake_accept) as accept, \
                self.assertRaisesRegex(ValueError, 'changed after this job finished'):
            self.queue.approve(record['id'])
        accept.assert_not_called()

    def test_buildings_awaiting_approval_cannot_join_another_job(self):
        record = self.queue.create_building_job(SITE, ['101'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        with self.assertRaisesRegex(ValueError, 'awaiting approval'):
            self.queue.create_building_job(SITE, ['101'])
        with self.assertRaisesRegex(ValueError, 'awaiting approval'):
            self.queue.escalate(SITE, '101')
        self.queue.create_building_job(SITE, ['102'])  # other buildings are free
        with mock.patch('tinytown.author.accept', side_effect=fake_accept):
            self.queue.approve(record['id'])
        self.queue.stop()
        self.queue.create_building_job(SITE, ['101'])  # committed: free again

    def test_feedback_is_written_for_the_repair_step_and_queues_another_pass(self):
        record = self.queue.create_building_job(SITE, ['101'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        self.queue.iterate(record['id'], 'The roof should be a shed roof.', buildings=['101'])
        entries = json.loads(Path(self.root, f'data/{SITE}/buildings/101/human-feedback.json').read_text())['entries']
        draft = json.loads(Path(self.root, f'data/{SITE}/buildings/101/draft.json').read_text())
        self.assertEqual(entries[0]['text'], 'The roof should be a shed roof.')
        self.assertEqual((entries[0]['draft_hash'], entries[0]['job']), (fingerprint(draft), record['id']))
        self.wait(record['id'], 'pending_approval', 'failed')
        self.assertEqual(len(FakeRun.calls), 2)
        with self.assertRaisesRegex(ValueError, 'outside this job'):
            self.queue.iterate(record['id'], 'x', buildings=['102'])

    def test_cancel_halts_the_author_run_and_jobs_never_share_a_building(self):
        started = []

        class SlowRun(FakeRun):
            def run(self):
                started.append(self)
                deadline = time.monotonic() + 5
                while not self.halted and time.monotonic() < deadline:
                    time.sleep(.02)
                return {'buildings': {}, 'skipped': {}, 'stopped': self.halted}

        with mock.patch('tinytown.author.Run', SlowRun):
            record = self.queue.create_building_job(SITE, ['101'])
            self.queue.start()
            self.wait(record['id'], 'running')
            deadline = time.monotonic() + 5
            while not started and time.monotonic() < deadline:
                time.sleep(.02)
            other = dict(record, id='x' * 12, status='queued')
            self.assertTrue(building_jobs.busy(other, [self.queue.get(record['id'])]))
            self.queue.cancel(record['id'])
            self.assertIn('cancelled', started[0].halted)
            self.assertEqual(self.queue.get(record['id'])['status'], 'cancelled')

    def test_old_records_are_code_changes(self):
        record = self.queue.create('An ordinary change')
        stored = dict(record)
        for key in ('kind', 'agent'):
            stored.pop(key)
        with self.queue.db() as db:
            db.execute('UPDATE changes SET record=? WHERE id=?', (json.dumps(stored), record['id']))
        self.assertEqual(changes.public_record(self.queue.get(record['id']))['kind'], 'code')
        self.queue.start()
        done = self.wait(record['id'], 'pending_approval')
        self.assertEqual(done['files'], ['src/main.js'])  # ran through Codex, the default agent


class EscalationTests(BuildingFixture):
    def test_escalated_building_gets_images_in_its_snapshot_and_approval_accepts(self):
        b = Path(self.root, f'data/{SITE}/buildings/101')
        (b / 'renders').mkdir(parents=True)
        (b / 'renders' / 'initial-overview.png').write_bytes(b'render')
        b.joinpath('draft.json').write_text(json.dumps(BLUEPRINT))
        self.git('add', '.')
        self.git('commit', '-qm', 'draft')
        self.set_worker(f"assert Path('data/{SITE}/buildings/101/renders/initial-overview.png').read_bytes() == b'render'\n"
                        f"Path('data/{SITE}/buildings/101/draft.json').write_text('{{\"volumes\": [], \"wall\": \"#123456\"}}')")
        record = self.queue.escalate(SITE, '101', 'Make the doors red')
        self.assertEqual(record['escalation'], {'site': SITE, 'id': '101'})
        self.assertIn('town render town 101 --compare', record['request'])
        self.assertIn('Make the doors red', record['request'])
        self.assertEqual(record['preview']['drafts'], ['101'])
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        self.assertEqual(record['files'], [f'data/{SITE}/buildings/101/draft.json'])  # images stay out of the diff
        with mock.patch('tinytown.author.accept', side_effect=fake_accept) as accept:
            record = self.queue.approve(record['id'])
        self.assertEqual(accept.call_args.args[1], ['101'])
        self.assertEqual(record['status'], 'approved')
        self.assertTrue(record['integration']['accept_commit'])
        self.assertIn(f'data/{SITE}/overrides.json', self.git('show', '--name-only', '--format=', 'HEAD'))

    def test_refused_accept_after_escalation_leaves_a_final_step(self):
        record = self.queue.escalate(SITE, '101')
        self.queue.start()
        record = self.wait(record['id'], 'pending_approval')
        with mock.patch('tinytown.author.accept', side_effect=ValueError('accept refused; nothing changed:\n  101: no draft.json')):
            record = self.queue.approve(record['id'])
        self.assertEqual(record['status'], 'approved')
        self.assertTrue(any(s['id'] == 'accept-101' and not s['done'] for s in record['final_steps']))


class PreviewDraftTests(BuildingFixture):
    def test_preview_shows_drafts_instead_of_accepted_blueprints(self):
        from tinytown import preview
        from tinytown.paths import SitePaths
        paths = SitePaths(SITE, self.root)
        paths.building('103').dir.mkdir(parents=True, exist_ok=True)
        paths.building('103').draft.write_text(json.dumps({**BLUEPRINT, 'wall': '#00ff00'}))
        data = {'buildings': [{'id': '103', 'blueprint': BLUEPRINT}, {'id': '101', 'blueprint': None}]}
        preview._apply_drafts(data, paths, {'drafts': ['103', '101']})
        self.assertEqual(data['buildings'][0]['blueprint']['wall'], '#00ff00')
        self.assertIsNone(data['buildings'][1]['blueprint'])  # no draft: unchanged
        spec = preview.validate_spec(self.root, {'site': SITE, 'target': '103', 'drafts': ['103']})
        self.assertEqual(spec['drafts'], ['103'])
        for bad in (['../x'], 'x', [str(n) for n in range(21)]):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                preview.validate_spec(self.root, {'site': SITE, 'target': '103', 'drafts': bad})
        before = preview.fingerprint(self.root, spec)
        time.sleep(.01)
        paths.building('103').draft.write_text(json.dumps(BLUEPRINT))
        self.assertNotEqual(preview.fingerprint(self.root, spec), before)


class AgentTests(unittest.TestCase):
    def test_codex_command_is_unchanged(self):
        command = change_agents.agent('codex').command('codex', 'gpt-6-astra', '/w', '/o.txt', ['/i/a.png'])
        self.assertEqual(command, ['codex', 'exec', '--model', 'gpt-6-astra', '--approve-for-me', '-c',
                                   'model_reasoning_effort="high"', '--json', '--color', 'never',
                                   '--output-last-message', '/o.txt', '--cd', '/w', '--image', '/i/a.png', '-'])

    def test_claude_command_and_prompt_name_images(self):
        claude = change_agents.agent('claude')
        command = claude.command('claude', 'claude-opus-5-5', '/w', '/o.txt', ['/i/a.png', '/i/b.png'])
        self.assertEqual(command[:3], ['claude', '-p', '--output-format'])
        for flags in (['--model', 'claude-opus-5-5'], ['--permission-mode', 'auto'], ['--add-dir', '/i'],
                      ['--permission-prompts', 'none']):
            index = command.index(flags[0])
            self.assertEqual(command[index:index + 2], flags)
        self.assertIn('/i/b.png', claude.prompt_note(['/i/a.png', '/i/b.png']))
        self.assertEqual(claude.prompt_note([]), '')

    def test_stream_parsing(self):
        with tempfile.TemporaryDirectory() as directory:
            log, output = Path(directory, 'log.jsonl'), Path(directory, 'out.txt')
            log.write_text('\n'.join(json.dumps(e) for e in [
                {'type': 'system', 'subtype': 'init'}, {'type': 'assistant', 'message': {}},
                {'type': 'result', 'subtype': 'success', 'is_error': False, 'result': 'Done; tests pass.'}]))
            self.assertEqual(change_agents.agent('claude').finish(log, output), 'Done; tests pass.')
            self.assertEqual(output.read_text(), 'Done; tests pass.')
            log.write_text(json.dumps({'type': 'result', 'subtype': 'error_max_turns', 'is_error': True}))
            with self.assertRaisesRegex(RuntimeError, 'error_max_turns'):
                change_agents.agent('claude').finish(log, output)
            log.write_text('not json\n')
            with self.assertRaisesRegex(RuntimeError, 'without a result'):
                change_agents.agent('claude').finish(log, output)
            log.write_text(json.dumps({'type': 'turn.failed', 'error': 'boom'}))
            with self.assertRaisesRegex(RuntimeError, 'boom'):
                change_agents.agent('codex').finish(log, output)
            log.write_text(json.dumps({'type': 'turn.completed'}))
            output.write_text('codex summary')
            self.assertEqual(change_agents.agent('codex').finish(log, output), 'codex summary')

    def test_validation(self):
        with self.assertRaises(ValueError):
            change_agents.agent('gemini')
        for bad in ('', 'a b', 'x;rm', 5):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                change_agents.validate_model(bad)
        self.assertEqual(change_agents.validate_model('claude-opus-5-5[1m]'), 'claude-opus-5-5[1m]')


class ClaudeQueueTests(ChangeQueueFixture):
    def test_claude_worker_runs_in_the_snapshot_and_reports_its_result(self):
        claude = Path(self.temp.name) / 'fake-claude'
        claude.write_text('#!/usr/bin/env python3\nimport json,sys\nfrom pathlib import Path\n'
                          'prompt = sys.stdin.read()\nassert "-p" in sys.argv and "--model" in sys.argv\n'
                          'assert sys.argv[sys.argv.index("--model")+1] == "claude-sonnet-5"\n'
                          'Path("src/main.js").write_text("claude edit\\n")\n'
                          'print(json.dumps({"type": "result", "subtype": "success", "is_error": False, "result": "Claude summary"}))\n')
        claude.chmod(0o755)
        queue = changes.ChangeQueue(root=self.root, workers=1, binary=str(self.binary), timeout=10, claude_binary=str(claude))
        self.addCleanup(queue.stop)
        record = queue.create('Use Claude', agent='claude', model='claude-sonnet-5')
        self.assertEqual((record['agent'], record['model']), ('claude', 'claude-sonnet-5'))
        queue.start()
        deadline = time.monotonic() + 10
        while queue.get(record['id'])['status'] not in ('pending_approval', 'failed') and time.monotonic() < deadline:
            time.sleep(.02)
        record = queue.get(record['id'], detail=True)
        self.assertEqual(record['status'], 'pending_approval', record.get('error'))
        self.assertEqual((record['files'], record['summary']), (['src/main.js'], 'Claude summary'))

    def test_server_default_agent_and_model(self):
        queue = changes.ChangeQueue(root=self.root, agent='claude')
        record = queue.create('Defaults')
        self.assertEqual((record['agent'], record['model']), ('claude', 'claude-opus-5-5'))
        self.assertEqual(queue.create('Codex anyway', agent='codex')['model'], 'gpt-6-astra')


if __name__ == '__main__':
    unittest.main()
