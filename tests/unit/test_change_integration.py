import contextlib
from io import StringIO
import json
import subprocess
import unittest
from unittest.mock import patch

from tests.unit.test_changes import ChangeQueueFixture
from tinytown import change_commit, change_steps, change_watch, change_worker, changes


class IntegrationTests(ChangeQueueFixture):
    def test_legacy_approval_does_not_acquire_unfinished_steps_on_read_or_restart(self):
        record = self.queue.create('An old approved change')
        record['status'] = 'approved'
        # Also cover records saved while the earlier backfill was active.
        for backfilled in (False, True):
            with self.subTest(backfilled=backfilled):
                old = dict(record)
                if not backfilled:
                    old.pop('final_steps', None)
                    old.pop('integration', None)
                with self.queue.db() as db:
                    db.execute('UPDATE changes SET record=? WHERE id=?', (json.dumps(old), record['id']))
                reopened = changes.ChangeQueue(self.root)
                for result in (reopened.get(record['id']), reopened.list()[0]):
                    self.assertFalse(any(not step['done'] for step in result['final_steps']))
                    self.assertNotIn('commit', result['integration'])
                updated = reopened.steps(record['id'], text='A real remaining check')
                step = next(s for s in updated['final_steps'] if s['source'] == 'operator')
                self.assertFalse(step['done'])
                updated = reopened.steps(record['id'], step_id=step['id'], done=True)
                self.assertTrue(all(s['done'] for s in updated['final_steps']))

    def test_new_approval_still_requires_a_final_step_report(self):
        record = change_steps.prepare({'status': 'approved', 'iteration': 1,
                                      'integration': {'target_branch': 'main', 'commit': 'abc'}})
        self.assertEqual([s['id'] for s in record['final_steps'] if not s['done']], ['plan'])

    def test_legacy_approval_keeps_explicit_worker_followups(self):
        step = {'id': 'worker-bake', 'text': 'Bake affected assets', 'source': 'worker', 'done': False}
        record = change_steps.prepare({'status': 'approved', 'iteration': 1, 'final_steps': [step]})
        self.assertEqual([s for s in record['final_steps'] if not s['done']], [step])

    def test_approval_commits_only_task_and_preserves_staged_work(self):
        self.write('src/other.js', 'user staged work\n')
        self.git('add', 'src/other.js')
        record = self.complete()
        self.write('src/untracked.js', 'keep me\n')
        head = self.git('rev-parse', 'HEAD').strip()
        result = self.queue.approve(record['id'])
        commit = result['integration']['commit']
        self.assertNotEqual(commit, head)
        self.assertEqual(self.git('rev-parse', 'main').strip(), commit)
        self.assertEqual(self.git('show', 'HEAD:src/main.js'), 'worker edit\n')
        self.assertEqual(self.git('show', 'HEAD:src/other.js'), 'unrelated\n')
        self.assertEqual(self.git('show', ':src/other.js'), 'user staged work\n')
        self.assertEqual(self.git('diff', '--cached', '--name-only').strip(), 'src/other.js')
        self.assertEqual(self.git('diff', '--name-only'), '')
        self.assertTrue((self.root / 'src/untracked.js').exists())
        self.assertIn(f"Change #{record['number']}", self.git('log', '-1', '--format=%s'))
        with self.assertRaisesRegex(ValueError, 'completed'):
            self.queue.approve(record['id'])

    def test_same_file_dirty_baseline_and_staged_edits_stay_out_of_commit(self):
        self.write('src/settings.json', '{"user":0,"task":0,"later":0}\n')
        self.git('add', 'src/settings.json')
        self.git('commit', '-qm', 'settings baseline')
        self.write('src/settings.json', '{"user":1,"task":0,"later":0}\n')
        self.git('add', 'src/settings.json')
        self.set_worker("p=Path('src/settings.json'); v=json.loads(p.read_text()); v['task']=1; p.write_text(json.dumps(v))")
        record = self.complete()
        self.write('src/settings.json', '{"user":1,"task":0,"later":1}\n')
        self.queue.approve(record['id'])
        self.assertEqual(json.loads(self.git('show', 'HEAD:src/settings.json')), {'user': 0, 'task': 1, 'later': 0})
        self.assertEqual(json.loads(self.git('show', ':src/settings.json')), {'user': 1, 'task': 1, 'later': 0})
        self.assertEqual(json.loads((self.root / 'src/settings.json').read_text()), {'user': 1, 'task': 1, 'later': 1})

    def test_overlap_with_dirty_baseline_remains_reviewable(self):
        self.write('src/main.js', 'uncommitted user edit\n')
        record = self.complete()
        head = self.git('rev-parse', 'HEAD')
        with self.assertRaisesRegex(ValueError, 'overlaps uncommitted'):
            self.queue.approve(record['id'])
        self.assertEqual(self.queue.get(record['id'])['status'], 'pending_approval')
        self.assertIn('overlaps uncommitted', self.queue.get(record['id'])['integration']['error'])
        self.assertFalse(next(s for s in self.queue.get(record['id'])['final_steps'] if s['id'] == 'integration-blocker')['done'])
        self.assertEqual((self.root / 'src/main.js').read_text(), 'uncommitted user edit\n')
        self.assertEqual(self.git('rev-parse', 'HEAD'), head)
        self.assertFalse((self.root / '.git/index.lock').exists())

    def test_wrong_branch_and_busy_index_never_apply(self):
        record = self.complete()
        self.git('switch', '-qc', 'feature')
        with self.assertRaisesRegex(ValueError, 'local main'):
            self.queue.approve(record['id'])
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')
        self.git('switch', '-q', 'main')
        lock = self.root / '.git/index.lock'
        lock.write_text('owned by another process')
        with self.assertRaisesRegex(ValueError, 'index'):
            self.queue.approve(record['id'])
        self.assertEqual(lock.read_text(), 'owned by another process')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')

    def test_ref_failure_rolls_back_checkout_and_preserves_index(self):
        record = self.complete()
        head, index = self.git('rev-parse', 'HEAD'), (self.root / '.git/index').read_bytes()
        original = change_commit.git
        def fail_ref(root, *args, **kwargs):
            if args[0] == 'update-ref':
                raise subprocess.CalledProcessError(1, args, stderr=b'ref changed')
            return original(root, *args, **kwargs)
        with patch.object(change_commit, 'git', side_effect=fail_ref):
            with self.assertRaises(subprocess.CalledProcessError):
                self.queue.approve(record['id'])
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')
        self.assertEqual((self.root / '.git/index').read_bytes(), index)
        self.assertEqual(self.git('rev-parse', 'HEAD'), head)
        self.assertFalse((self.root / '.git/index.lock').exists())

    def test_reports_and_operator_steps_survive_approval_and_restart(self):
        self.set_worker("import subprocess\n"
                        "Path('src/main.js').write_text('new source\\n')\n"
                        "subprocess.run([sys.executable, os.environ['TOWN_CHANGE_REPORTER'], '--clear-final-steps', "
                        "'--final-step', 'Bake affected sites and commit generated assets', '--outcome', 'complete'], check=True)")
        record = self.complete()
        steps = record['final_steps']
        self.assertTrue(next(s for s in steps if s['id'] == 'plan')['done'])
        worker = next(s for s in steps if s['source'] == 'worker')
        self.assertFalse(worker['done'])
        self.queue.steps(record['id'], text='Inspect the final map')
        approved = self.queue.approve(record['id'])
        self.assertTrue(next(s for s in approved['final_steps'] if s['id'] == 'main')['done'])
        self.queue.steps(record['id'], step_id=worker['id'], done=True)
        reopened = changes.ChangeQueue(self.root)
        saved = reopened.get(record['id'])
        self.assertTrue(next(s for s in saved['final_steps'] if s['id'] == worker['id'])['done'])
        self.assertEqual(saved['integration']['commit'], self.git('rev-parse', 'HEAD').strip())
        self.assertFalse(next(s for s in saved['final_steps'] if s['source'] == 'operator')['done'])

    def test_missing_report_stays_visible_and_iteration_resets_checks(self):
        record = self.complete()
        self.queue.stop()
        self.assertFalse(next(s for s in record['final_steps'] if s['id'] == 'plan')['done'])
        self.queue.steps(record['id'], step_id='plan', done=True)
        record = self.queue.steps(record['id'], text='Review the map')
        step = next(s for s in record['final_steps'] if s['source'] == 'operator')
        self.queue.steps(record['id'], step_id=step['id'], done=True)
        record = self.queue.iterate(record['id'], 'Revise this again')
        self.assertTrue(all(not s['done'] for s in record['final_steps']))

    def test_http_steps_validate_completion_and_cannot_approve(self):
        record = self.complete()
        port = self.server()
        headers = {'X-TinyTown': 'changes'}
        path = f"/api/changes/{record['number']}/steps"
        status, data = self.request(port, 'POST', path, {'text': 'Check production assets'}, headers)
        self.assertEqual(status, 200)
        step = next(s for s in json.loads(data)['final_steps'] if s['source'] == 'operator')
        for step_id, done in [('apply', True), ('main', True), (step['id'], 'true')]:
            self.assertEqual(self.request(port, 'POST', path, {'step_id': step_id, 'done': done}, headers)[0], 400)
        self.assertEqual(self.request(port, 'POST', path, {'step_id': step['id'], 'done': True}, headers)[0], 200)
        self.assertEqual(self.queue.get(record['id'])['status'], 'pending_approval')

    def test_worker_cannot_mark_final_steps_completed(self):
        for value in [[{'text': 'Commit', 'done': True}], [''], 'do this', ['x'] * 41]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                change_worker.validate_report({'iteration': 1, 'revision': 1, 'final_steps': value})


class WatchTests(unittest.TestCase):
    def test_watch_tracks_updates_until_review_and_prints_final_steps(self):
        records = iter([{'id': 'a', 'number': 1, 'title': 'Task', 'status': status,
                         'final_steps': [{'id': 'bake', 'text': 'Bake the map', 'done': False}]}
                        for status in ['queued', 'running', 'pending_approval']])
        out = StringIO()
        with patch.object(change_watch.time, 'sleep'), contextlib.redirect_stdout(out):
            self.assertEqual(change_watch.watch(lambda: next(records)), 0)
        self.assertIn('pending_approval', out.getvalue())
        self.assertIn('[ ] bake: Bake the map', out.getvalue())

    def test_timeout_leaves_job_running_and_json_is_parseable(self):
        record = {'id': 'a', 'status': 'running'}
        out = StringIO()
        with patch.object(change_watch.time, 'monotonic', side_effect=[0, 1]), contextlib.redirect_stdout(out):
            self.assertEqual(change_watch.watch(lambda: record, timeout=1, as_json=True), 124)
        self.assertEqual(json.loads(out.getvalue().splitlines()[0])['changes'][0]['status'], 'running')
        self.assertEqual(record['status'], 'running')
