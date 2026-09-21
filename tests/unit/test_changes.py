"""Local change jobs: real temporary Git snapshots, fake workers, no model calls."""
import base64
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
import http.client
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest
from unittest import mock

from tinytown import changes, change_images


class ChangeQueueFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'repo'
        self.root.mkdir()
        self.write('.gitignore', 'runs/\n.env\nprivate/\n')
        self.write('src/main.js', 'original\n')
        self.write('src/other.js', 'unrelated\n')
        self.write('src/delete.js', 'delete me\n')
        self.write('data/example/stream/manifest.json', '{}')
        self.write('data/example/surfaces.json', '{}')
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                 'commit', '-qm', 'baseline')
        self.binary = Path(self.temp.name) / 'fake-codex'
        self.set_worker("Path('src/main.js').write_text('worker edit\\n')")
        self.queue = changes.ChangeQueue(root=self.root, workers=2, binary=str(self.binary), timeout=10)
        self.addCleanup(self.queue.stop)

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.root), *args], check=True,
                              capture_output=True, text=True).stdout

    def set_worker(self, body):
        self.binary.write_text('#!/usr/bin/env python3\nimport json,sys,time,os\nfrom pathlib import Path\n'
                               'for flag in ("--cd", "-C"):\n'
                               '    if flag in sys.argv: os.chdir(sys.argv[sys.argv.index(flag)+1])\n'
                               + body + '\nprint(json.dumps({"type": "turn.completed"}))\n')
        self.binary.chmod(0o755)

    def wait_status(self, change_id, expected):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            record = self.queue.get(change_id, detail=True)
            if record['status'] == expected:
                return record
            time.sleep(.02)
        self.fail(f"Job never became {expected}: {record}")

    def workspace(self, change_id):
        matches = [p.parent for p in (self.root / 'runs' / 'changes').rglob('.git')
                   if change_id in str(p)]
        self.assertEqual(len(matches), 1)
        return matches[0]

    def complete(self, request='Make a change'):
        record = self.queue.create(request)
        self.queue.start()
        return self.wait_status(record['id'], 'pending_approval')

    def server(self):
        server = changes.ChangeServer(('127.0.0.1', 0), self.queue)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        def close():
            self.queue.stop()
            server.shutdown()
            server.server_close()
            worker.join(5)
        self.addCleanup(close)
        return server.server_port

    def request(self, port, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        try:
            connection.request(method, path, json.dumps(body) if body is not None else None,
                               headers or {})
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()

    def screenshot(self, name='screen.png', format='PNG'):
        from PIL import Image
        stream = BytesIO()
        Image.new('RGB', (8, 6), (42, 80, 150)).save(stream, format=format)
        mime = change_images.FORMATS[format][0]
        return {'name': name, 'data': f'data:{mime};base64,' + base64.b64encode(stream.getvalue()).decode()}



class ChangeQueueTests(ChangeQueueFixture):
    def test_snapshot_captures_dirty_and_untracked_source_without_private_or_bakes(self):
        self.write('src/main.js', 'dirty source\n')
        self.write('src/new.js', 'untracked source\n')
        self.write('.env', 'SECRET=private')
        self.write('private/key', 'secret')
        self.write('runs/old/output', 'old run')
        self.set_worker('pass')
        record = self.complete()
        workspace = self.workspace(record['id'])
        self.assertEqual((workspace / 'src/main.js').read_text(), 'dirty source\n')
        self.assertEqual((workspace / 'src/new.js').read_text(), 'untracked source\n')
        for relative in ('.env', 'private/key', 'runs/old/output',
                         'data/example/stream/manifest.json', 'data/example/surfaces.json'):
            self.assertFalse((workspace / relative).exists(), relative)
        self.assertEqual((self.root / 'src/main.js').read_text(), 'dirty source\n')

    def test_approval_applies_add_edit_delete_and_preserves_unrelated_changes(self):
        self.set_worker("Path('src/main.js').write_text('worker edit\\n')\n"
                        "Path('src/added.js').write_text('added\\n')\n"
                        "Path('src/delete.js').unlink()")
        record = self.complete()
        self.write('src/other.js', 'new unrelated change\n')
        self.queue.approve(record['id'])
        self.assertEqual(self.queue.get(record['id'])['status'], 'approved')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'worker edit\n')
        self.assertEqual((self.root / 'src/added.js').read_text(), 'added\n')
        self.assertFalse((self.root / 'src/delete.js').exists())
        self.assertEqual((self.root / 'src/other.js').read_text(), 'new unrelated change\n')

    def test_conflicting_approval_makes_no_partial_changes(self):
        self.set_worker("Path('src/aaa.js').write_text('must not apply\\n')\n"
                        "Path('src/main.js').write_text('worker edit\\n')")
        record = self.complete()
        self.write('src/main.js', 'concurrent edit\n')
        self.queue.stop()
        result = self.queue.approve(record['id'])
        self.assertEqual(result['status'], 'queued')
        self.assertEqual(result['merge']['files'], ['src/main.js'])
        self.assertEqual((self.queue.paths.merge_backup(record['id'], 1) / 'src/main.js').read_text(), 'worker edit\n')
        self.assertFalse((self.root / 'src/aaa.js').exists())
        self.assertEqual((self.root / 'src/main.js').read_text(), 'concurrent edit\n')

    def test_iteration_preserves_previous_workspace_edits(self):
        record = self.complete()
        self.set_worker("assert Path('src/main.js').read_text() == 'worker edit\\n'\n"
                        "Path('src/feedback.js').write_text('feedback applied\\n')")
        self.queue.iterate(record['id'], 'Also apply this feedback')
        updated = self.wait_status(record['id'], 'pending_approval')
        self.assertEqual(updated['iteration'], record['iteration'] + 1)
        self.assertIn('Also apply this feedback', json.dumps(updated))
        self.assertTrue((self.workspace(record['id']) / 'src/feedback.js').exists())
        self.assertFalse((self.root / 'src/feedback.js').exists())

    def test_failed_job_can_retry(self):
        self.set_worker('sys.exit(1)')
        record = self.queue.create('Fail then retry')
        self.queue.start()
        self.wait_status(record['id'], 'failed')
        self.set_worker("Path('src/main.js').write_text('retried\\n')")
        self.queue.retry(record['id'])
        self.wait_status(record['id'], 'pending_approval')
        self.assertEqual((self.workspace(record['id']) / 'src/main.js').read_text(), 'retried\n')

    def test_cancel_queued_job_and_retry(self):
        record = self.queue.create('Wait for worker')
        self.assertEqual(record['status'], 'queued')
        self.queue.cancel(record['id'])
        self.assertEqual(self.queue.get(record['id'])['status'], 'cancelled')
        self.queue.retry(record['id'])
        self.queue.start()
        self.wait_status(record['id'], 'pending_approval')

    def test_cancel_running_worker(self):
        self.set_worker('time.sleep(30)')
        record = self.queue.create('Slow worker')
        self.queue.start()
        self.wait_status(record['id'], 'running')
        self.queue.cancel(record['id'])
        self.wait_status(record['id'], 'cancelled')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')

    def test_discard_completed_change_preserves_checkout_and_can_restore(self):
        record = self.complete()
        self.queue.discard(record['id'])
        self.assertEqual(self.queue.get(record['id'])['status'], 'discarded')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')
        self.assertEqual((self.workspace(record['id']) / 'src/main.js').read_text(), 'worker edit\n')
        with self.assertRaises(ValueError):
            self.queue.approve(record['id'])
        self.queue.retry(record['id'])
        self.wait_status(record['id'], 'pending_approval')
        self.queue.approve(record['id'])
        with self.assertRaises(ValueError):
            self.queue.discard(record['id'])
        self.assertEqual((self.root / 'src/main.js').read_text(), 'worker edit\n')

    def test_discard_running_change_stops_worker_and_ignores_late_reports(self):
        self.set_worker("Path('src/started.js').touch()\ntime.sleep(30)")
        record = self.queue.create('Discard a running change')
        self.queue.start()
        deadline = time.monotonic() + 5
        while not (self.queue.paths.workspace(record['id']) / 'src/started.js').exists():
            self.assertLess(time.monotonic(), deadline)
            time.sleep(.02)
        process = self.queue.processes[record['id']]
        self.queue.discard(record['id'])
        self.assertIsNotNone(process.poll())
        report_path = self.queue.paths.worker_report(record['id'])
        report_path.write_text(json.dumps({'iteration': 1, 'revision': 999, 'status': 'Late update'}))
        self.queue._ingest_report(record)
        final = self.queue.get(record['id'])
        self.assertEqual(final['status'], 'discarded')
        self.assertNotEqual(final['worker_status'], 'Late update')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')

    def test_worker_reports_progress_and_preview_before_exiting(self):
        self.set_worker("import subprocess\n"
                        "reporter = [sys.executable, os.environ['TOWN_CHANGE_REPORTER']]\n"
                        "first = subprocess.check_output(reporter + ['--status','Checking roof','--progress','40',"
                        "'--title','Roof repair','--site','example','--target','12 Main Street'], text=True)\n"
                        "assert json.loads(first)['preview_url'].endswith('/previews/' + os.environ['TOWN_CHANGE_ID'] + '/')\n"
                        "while not Path('release').exists(): time.sleep(.02)\n"
                        "Path('release').unlink()\n"
                        "Path('src/main.js').write_text('reported edit\\n')\n"
                        "subprocess.run(reporter + ['--status','Tests passed','--progress','100','--outcome','complete'], check=True)")
        record = self.queue.create('Repair roof')
        self.queue.start()
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            current = self.queue.get(record['id'])
            if current.get('worker_status') == 'Checking roof':
                break
            time.sleep(.02)
        self.assertEqual(current['status'], 'running')
        self.assertEqual(current['progress'], 40)
        self.assertEqual(current['title'], 'Roof repair')
        self.assertEqual(current['preview']['target'], '12 Main Street')
        self.assertEqual(current['preview_url'], f'/previews/{record["id"]}/')
        (self.workspace(record['id']) / 'release').touch()
        finished = self.wait_status(record['id'], 'pending_approval')
        self.assertEqual(finished['worker_status'], 'Tests passed')
        self.assertEqual(finished['progress'], 100)
        self.assertEqual(finished['files'], ['src/main.js'])
        self.queue.approve(record['id'])
        self.assertFalse((self.root / 'runs/change-worker').exists())

    def test_blocked_worker_without_edits_cannot_be_approved(self):
        self.set_worker("import subprocess\nsubprocess.run([sys.executable, os.environ['TOWN_CHANGE_REPORTER'],"
                        "'--outcome','blocked','--status','Missing source data'], check=True)")
        record = self.queue.create('Report a blocker')
        self.queue.start()
        failed = self.wait_status(record['id'], 'failed')
        self.assertEqual(failed['error'], 'Missing source data')
        with self.assertRaises(ValueError):
            self.queue.approve(record['id'])

    def test_blocked_check_keeps_edits_reviewable_by_number(self):
        self.set_worker("import subprocess\nPath('src/main.js').write_text('finished tweak\\n')\n"
                        "subprocess.run([sys.executable, os.environ['TOWN_CHANGE_REPORTER'],"
                        "'--outcome','blocked','--status','Chromium review unavailable'], check=True)")
        record = self.queue.create('Keep my changes reviewable')
        self.queue.start()
        review = self.wait_status(record['id'], 'pending_approval')
        self.assertEqual(review['review_warning'], 'Chromium review unavailable')
        self.assertIsNone(review['error'])
        self.assertEqual(review['worker_outcome'], 'blocked')
        self.assertEqual(review['files'], ['src/main.js'])
        self.queue.approve(str(record['number']))
        self.assertEqual((self.root / 'src/main.js').read_text(), 'finished tweak\n')

    def test_process_failure_preserves_edits_for_feedback_or_discard(self):
        self.set_worker("Path('src/main.js').write_text('partial edit\\n')\nsys.exit(1)")
        record = self.queue.create('Review partial work')
        self.queue.start()
        review = self.wait_status(record['id'], 'pending_approval')
        self.assertIn('exited with code 1', review['review_warning'])
        self.set_worker("Path('src/main.js').write_text('fixed edit\\n')")
        self.queue.iterate(str(record['number']), 'Finish this tweak')
        review = self.wait_status(record['id'], 'pending_approval')
        self.assertIsNone(review['review_warning'])
        self.assertEqual(review['number'], record['number'])
        self.queue.discard(str(record['number']))
        self.assertEqual(self.queue.get(record['number'])['status'], 'discarded')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')

    def test_restart_recovers_old_failed_edits_without_rerunning_worker(self):
        record = self.complete()
        self.queue.stop()
        record.update(status='failed', worker_outcome='blocked', error='Browser sockets denied')
        self.queue._save(record)
        reopened = changes.ChangeQueue(root=self.root, binary=str(self.binary))
        self.addCleanup(reopened.stop)
        reopened.start()
        restored = reopened.get(record['number'])
        self.assertEqual(restored['status'], 'pending_approval')
        self.assertEqual(restored['review_warning'], 'Browser sockets denied')
        self.assertEqual(restored['iteration'], 1)
        self.assertEqual(restored['files'], ['src/main.js'])
        self.assertEqual(restored['number'], record['number'])
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')

    def test_numbers_are_stable_sequential_and_work_as_references(self):
        first = self.queue.create('First')
        second = self.queue.create('Second')
        self.assertEqual([r['number'] for r in self.queue.list()], [1, 2])
        self.assertEqual(self.queue.get('#1')['id'], first['id'])
        self.queue.cancel('2')
        self.assertEqual(self.queue.get(second['id'])['status'], 'cancelled')
        self.queue.iterate('2', 'Adjust this')
        self.queue.discard('1')
        reopened = changes.ChangeQueue(root=self.root)
        self.assertEqual(reopened.get('1')['id'], first['id'])
        self.assertEqual(reopened.create('Third')['number'], 3)
        for reference in ('0', '-1', '999', '../../queue.sqlite3', '9' * 100):
            with self.assertRaises(ValueError):
                reopened.get(reference)

    def test_number_migration_uses_creation_order_and_does_not_renumber(self):
        first = self.queue.create('First')
        second = self.queue.create('Second')
        with self.queue.db() as db:
            db.execute('DROP TABLE change_numbers')
        reopened = changes.ChangeQueue(root=self.root)
        self.assertEqual(reopened.get('1')['id'], first['id'])
        self.assertEqual(reopened.get('2')['id'], second['id'])
        again = changes.ChangeQueue(root=self.root)
        self.assertEqual(again.create('Third')['number'], 3)

    def test_simultaneous_requests_receive_distinct_numbers(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            records = list(pool.map(lambda i: self.queue.create(f'Request {i}'), range(12)))
        self.assertEqual(sorted(r['number'] for r in records), list(range(1, 13)))
        self.assertEqual([r['number'] for r in self.queue.list()], list(range(1, 13)))

    def test_http_number_references_and_original_ids_address_same_change(self):
        record = self.queue.create('Numbered request')
        port = self.server()
        for reference in ('1', '%231', record['id']):
            status, body = self.request(port, 'GET', f'/api/changes/{reference}')
            self.assertEqual(status, 200, body)
            self.assertEqual(json.loads(body)['id'], record['id'])
        status, body = self.request(port, 'POST', '/api/changes/%231/cancel', {}, {'X-TinyTown': 'changes'})
        self.assertEqual(status, 200, body)
        self.assertEqual(json.loads(body)['status'], 'cancelled')
        self.assertEqual(self.queue.get(record['id'])['status'], 'cancelled')

    def test_report_validation_iteration_and_preview_updates(self):
        record = self.queue.create('Report validation')
        record['status'] = 'running'
        self.queue._save(record)
        self.queue._snapshot(record)
        self.queue._prepare_report(record)
        path = self.queue.paths.worker_report(record['id'])
        def publish(**fields):
            path.write_text(json.dumps({'iteration': 1, 'revision': 1, **fields}))
            self.queue._ingest_report(record)
            return self.queue.get(record['id'])
        current = publish(status='Checking geometry', progress=25,
                          preview={'site': 'example', 'target': '12 Main Street'})
        url = current['preview_url']
        current = publish(revision=2, preview={'asset': {'module': 'src/asset.js'}})
        self.assertEqual(current['preview_url'], url)
        self.assertEqual(current['preview']['asset']['module'], 'src/asset.js')
        current = publish(revision=3, approve=True)
        self.assertIn('Unknown', current['report_error'])
        self.assertEqual(current['status'], 'running')
        current = publish(revision=3, progress=150)
        self.assertEqual(current['progress'], 25)
        current = publish(iteration=0, revision=100, status='Old pass')
        self.assertEqual(current['worker_status'], 'Checking geometry')
        current = publish(revision=3, preview=None, status='Preview removed')
        self.assertIsNone(current['preview_url'])
        self.assertIsNone(current['report_error'])
        self.assertEqual(current['status'], 'running')

    def test_progress_report_does_not_undo_a_manual_preview_change(self):
        record = self.queue.create('Preview ownership')
        record['status'] = 'running'
        self.queue._save(record)
        self.queue._snapshot(record)
        self.queue._prepare_report(record)
        path = self.queue.paths.worker_report(record['id'])
        payload = {'iteration': 1, 'revision': 1, 'preview_revision': 1,
                   'preview': {'site': 'example', 'target': 'Worker target'}}
        path.write_text(json.dumps(payload))
        self.queue._ingest_report(record)
        self.queue.set_preview(record['id'], {'site': 'example', 'target': 'Manual target'})
        payload.update(revision=2, status='Checking', progress=50)
        path.write_text(json.dumps(payload))
        self.queue._ingest_report(record)
        self.assertEqual(self.queue.get(record['id'])['preview']['target'], 'Manual target')
        payload.update(revision=3, preview_revision=3)
        path.write_text(json.dumps(payload))
        self.queue._ingest_report(record)
        self.assertEqual(self.queue.get(record['id'])['preview']['target'], 'Worker target')

    def test_reporting_command_never_starts_a_server(self):
        from tinytown import cli
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(changes, 'ensure_server') as start:
            self.assertEqual(cli.main(['changes', 'report', '--status', 'No worker context']), 1)
            start.assert_not_called()

    def test_immediate_retry_waits_for_cancelled_pass_to_unwind(self):
        entered, unwind, retried = threading.Event(), threading.Event(), threading.Event()
        calls = []
        def execute(record, workspace):
            calls.append(record['iteration'])
            if record['iteration'] == 1:
                entered.set()
                self.assertTrue(unwind.wait(5))
                raise RuntimeError('Cancelled first pass')
            retried.set()
            (workspace / 'src/main.js').write_text('retry result\n')
            return 'Retry done'
        with mock.patch.object(self.queue, '_execute', side_effect=execute):
            record = self.queue.create('Race cancellation and retry')
            self.queue.start()
            try:
                self.assertTrue(entered.wait(5))
                self.queue.cancel(record['id'])
                self.queue.retry(record['id'])
                self.assertFalse(retried.wait(.7), 'Retry entered while old pass owned the workspace')
                self.assertEqual(self.queue.get(record['id'])['status'], 'queued')
            finally:
                unwind.set()
            self.wait_status(record['id'], 'pending_approval')
        self.assertEqual(calls, [1, 2])

    def test_timeout_terminates_worker_and_preserves_checkout(self):
        self.queue.timeout = .1
        self.set_worker('time.sleep(30)')
        record = self.queue.create('Exceed deadline')
        self.queue.start()
        failed = self.wait_status(record['id'], 'failed')
        self.assertIn('time limit', failed['error'])
        self.assertNotIn(record['id'], self.queue.processes)
        self.assertEqual((self.root / 'src/main.js').read_text(), 'original\n')

    def test_two_jobs_run_concurrently_in_independent_astra_sessions(self):
        self.set_worker("assert sys.argv[sys.argv.index('--model')+1] == 'gpt-6-astra'\n"
                        "assert os.environ['TOWN_CHANGE_MAP_URL'].endswith('/previews/' + os.environ['TOWN_CHANGE_ID'] + '/map/')\n"
                        "assert '--approve-for-me' in sys.argv\n"
                        "assert 'approval_policy=\"never\"' not in sys.argv\n"
                        "assert 'resume' not in sys.argv\n"
                        "assert 'CODEX_THREAD_ID' not in os.environ\n"
                        "Path('src/started.js').write_text(str(Path.cwd()))\n"
                        "while not Path('release').exists(): time.sleep(.02)\n"
                        "Path('release').unlink()")
        with mock.patch.dict(os.environ, {'CODEX_THREAD_ID': 'parent-session'}):
            records = [self.queue.create(f'Independent task {i}') for i in range(2)]
            self.queue.start()
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                spaces = [self.queue.paths.workspace(r['id']) for r in records]
                if all((space / 'src/started.js').exists() for space in spaces):
                    break
                time.sleep(.02)
            self.assertTrue(all((space / 'src/started.js').exists() for space in spaces))
            self.assertNotEqual(spaces[0], spaces[1])
            for space in spaces:
                self.assertEqual((space / 'src/started.js').read_text(), str(space))
                (space / 'release').touch()
            for record in records:
                self.wait_status(record['id'], 'pending_approval')
        self.assertFalse((self.root / 'src/started.js').exists())

    def test_approval_detects_concurrent_executable_mode_change(self):
        record = self.complete()
        path = self.root / 'src/main.js'
        path.chmod(path.stat().st_mode | 0o111)
        self.queue.approve(record['id'])
        self.assertEqual(path.read_text(), 'worker edit\n')
        self.assertTrue(path.stat().st_mode & 0o111)

    def test_approval_rejects_parent_symlink_even_when_it_stays_in_checkout(self):
        record = self.complete()
        (self.root / 'src').rename(self.root / 'redirected')
        (self.root / 'src').symlink_to('redirected', target_is_directory=True)
        with self.assertRaises(ValueError):
            self.queue.approve(record['id'])
        self.assertEqual((self.root / 'redirected/main.js').read_text(), 'original\n')

    def test_approval_preserves_existing_file_with_temporary_suffix(self):
        record = self.complete()
        temporary = self.write('src/main.js.town-change-tmp', 'user-owned file\n')
        self.queue.approve(record['id'])
        self.assertTrue(temporary.exists())
        self.assertEqual(temporary.read_text(), 'user-owned file\n')

    def test_requests_persist_for_a_new_queue_instance(self):
        record = self.queue.create('Persistent request', title='Saved title')
        reopened = changes.ChangeQueue(root=self.root, binary=str(self.binary))
        self.addCleanup(reopened.stop)
        self.assertEqual(reopened.get(record['id'])['title'], 'Saved title')
        self.assertEqual([item['id'] for item in reopened.list()], [record['id']])
        reopened.start()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if reopened.get(record['id'])['status'] == 'pending_approval':
                break
            time.sleep(.02)
        self.assertEqual(reopened.get(record['id'])['status'], 'pending_approval')

    def test_screenshots_persist_and_download_with_request(self):
        port = self.server()
        upload = self.screenshot('../../screen.png')
        status, body = self.request(port, 'POST', '/api/changes',
                                    {'request': 'Match this image', 'attachments': [upload]},
                                    {'X-TinyTown': 'changes'})
        self.assertEqual(status, 201, body)
        record = json.loads(body)
        attachment = record['attachments'][0]
        self.assertEqual(attachment['name'], 'screen.png')
        self.assertNotIn('data', attachment)
        self.assertEqual((attachment['width'], attachment['height']), (8, 6))
        status, data = self.request(port, 'GET', attachment['url'])
        self.assertEqual(status, 200)
        self.assertEqual(data, base64.b64decode(upload['data'].split(',')[1]))
        reopened = changes.ChangeQueue(root=self.root)
        self.assertEqual(reopened.get(record['id'])['attachments'], record['attachments'])
        other = self.queue.create('Other change')
        for url in (attachment['url'].replace(record['id'], other['id']),
                    attachment['url'] + '/../../queue.sqlite3',
                    f'/api/changes/{record["id"]}/attachments/%2e%2e%2fqueue.sqlite3'):
            self.assertIn(self.request(port, 'GET', url)[0], (400, 404))

    def test_invalid_screenshot_batches_do_not_create_or_modify_jobs(self):
        valid = self.screenshot()
        invalid = {'name': 'broken.png', 'data': 'data:image/png;base64,' + base64.b64encode(b'not an image').decode()}
        with self.assertRaises(ValueError):
            self.queue.create('Bad batch', attachments=[valid, invalid])
        self.assertEqual(self.queue.list(), [])
        record = self.queue.create('Keep this request', attachments=[valid])
        with self.assertRaises(ValueError):
            self.queue.add_attachments(record['id'], [valid, invalid])
        self.assertEqual(self.queue.get(record['id'])['attachments'], record['attachments'])
        self.assertEqual(len(list(self.queue.paths.attachments(record['id']).iterdir())), 1)
        with self.assertRaises(ValueError):
            self.queue.add_attachments(record['id'], [valid] * 8)
        with mock.patch.object(change_images, 'MAX_IMAGE_BYTES', 8):
            with self.assertRaises(ValueError):
                self.queue.add_attachments(record['id'], [valid])
        with mock.patch.object(change_images, 'MAX_TOTAL_BYTES', record['attachments'][0]['bytes']):
            with self.assertRaises(ValueError):
                self.queue.add_attachments(record['id'], [valid])
        self.queue.cancel(record['id'])
        before = self.queue.get(record['id'])
        with self.assertRaises(ValueError):
            self.queue.iterate(record['id'], 'Invalid image', [invalid])
        self.assertEqual(self.queue.get(record['id']), before)

    def test_http_can_append_screenshots_and_iterate_with_images(self):
        record = self.queue.create('Request before screenshots')
        port = self.server()
        headers = {'X-TinyTown': 'changes'}
        status, body = self.request(port, 'POST', f'/api/changes/{record["id"]}/attachments',
                                    {'attachments': [self.screenshot(format='JPEG')]}, headers)
        self.assertEqual(status, 200, body)
        self.assertEqual(json.loads(body)['attachments'][0]['mime'], 'image/jpeg')
        self.assertEqual(json.loads(body)['status'], 'queued')
        self.queue.cancel(record['id'])
        status, body = self.request(port, 'POST', f'/api/changes/{record["id"]}/iterate',
                                    {'feedback': 'Use both pictures', 'attachments': [self.screenshot(format='WEBP')]}, headers)
        self.assertEqual(status, 200, body)
        self.assertEqual(len(json.loads(body)['attachments']), 2)
        self.assertEqual(json.loads(body)['iteration'], 2)

    def test_http_accepts_screenshots_larger_than_old_json_limit(self):
        from PIL import Image
        stream = BytesIO()
        Image.frombytes('RGB', (300, 300), os.urandom(300 * 300 * 3)).save(stream, format='PNG')
        upload = {'name': 'large.png', 'data': 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode()}
        self.assertGreater(len(upload['data']), 100000)
        status, body = self.request(self.server(), 'POST', '/api/changes',
                                    {'request': 'Larger screenshot', 'attachments': [upload]},
                                    {'X-TinyTown': 'changes'})
        self.assertEqual(status, 201, body)
        self.assertEqual(json.loads(body)['attachments'][0]['bytes'], len(stream.getvalue()))

    def test_worker_receives_images_and_running_upload_is_used_next_pass(self):
        self.set_worker("images = [sys.argv[i+1] for i, value in enumerate(sys.argv) if value == '--image']\n"
                        "assert all(Path(image).is_file() for image in images)\n"
                        "Path('src/main.js').write_text(str(len(images)))\n"
                        "Path('runs/change-worker/received.json').write_text(json.dumps(images))\n"
                        "while not Path('runs/change-worker/release').exists(): time.sleep(.02)")
        record = self.queue.create('Use screenshots', attachments=[self.screenshot()])
        self.queue.start()
        workspace = self.queue.paths.workspace(record['id'])
        received = workspace / 'runs/change-worker/received.json'
        deadline = time.monotonic() + 10
        while not received.exists() and time.monotonic() < deadline:
            time.sleep(.02)
        self.assertTrue(received.exists())
        original = self.queue.paths.attachment(record['id'], record['attachments'][0])
        self.assertEqual(Path(json.loads(received.read_text())[0]).read_bytes(), original.read_bytes())
        self.queue.add_attachments(record['id'], [self.screenshot('follow-up.png')])
        (received.parent / 'release').touch()
        first = self.wait_status(record['id'], 'pending_approval')
        self.assertEqual((workspace / 'src/main.js').read_text(), '1')
        self.assertEqual(len(first['attachments']), 2)
        self.assertEqual(first['files'], ['src/main.js'])
        self.queue.iterate(record['id'], 'Use the additional screenshot')
        second = self.wait_status(record['id'], 'pending_approval')
        self.assertEqual((workspace / 'src/main.js').read_text(), '2')
        self.assertEqual(second['files'], ['src/main.js'])
        self.assertIn('follow-up.png', self.queue._prompt(second))
        self.queue.approve(record['id'])
        self.assertEqual((self.root / 'src/main.js').read_text(), '2')
        self.assertFalse((self.root / 'runs/change-worker').exists())
        with self.assertRaises(ValueError):
            self.queue.add_attachments(record['id'], [self.screenshot()])

    def test_http_rejects_cross_origin_mutations_and_untrusted_hosts(self):
        port = self.server()
        payload = {'request': 'HTTP job'}
        for headers in ({}, {'X-TinyTown': 'changes', 'Origin': 'https://evil.example'},
                        {'X-TinyTown': 'changes', 'Host': f'evil.example:{port}'}):
            status, _ = self.request(port, 'POST', '/api/changes', payload, headers)
            self.assertEqual(status, 403)
        self.assertEqual(self.queue.list(), [])
        status, body = self.request(port, 'POST', '/api/changes', payload,
                                    {'X-TinyTown': 'changes', 'Origin': f'http://127.0.0.1:{port}'})
        self.assertEqual(status, 201, body)
        self.assertEqual(json.loads(body)['status'], 'queued')
        status, _ = self.request(port, 'GET', '/api/changes', headers={'Host': 'evil.example'})
        self.assertEqual(status, 403)

    def test_ensure_server_reuses_persisted_running_server(self):
        port = self.server()
        self.queue.paths.server.write_text(json.dumps({'port': port, 'root': str(self.queue.root)}))
        with mock.patch.object(changes.subprocess, 'Popen') as spawn:
            self.assertEqual(changes.ensure_server(root=self.root), port)
            spawn.assert_not_called()

    def test_explicit_port_refuses_another_service_without_spawning(self):
        port = self.server()
        with mock.patch.object(changes, 'api', return_value={'service': 'another-app'}), \
                mock.patch.object(changes.subprocess, 'Popen') as spawn:
            with self.assertRaisesRegex(ValueError, 'another application'):
                changes.ensure_server(port=port, root=self.root)
            spawn.assert_not_called()

    def test_automatic_port_skips_occupied_service_and_starts_on_next_free_port(self):
        probe = mock.MagicMock()
        probe.__enter__.return_value = probe
        probe.connect_ex.side_effect = [0, 111]
        health = {'service': 'tinytown-changes', 'root': str(self.queue.root)}
        with mock.patch.object(changes.socket, 'socket', return_value=probe), \
                mock.patch.object(changes, 'api', side_effect=[{'service': 'another-app'}, health]) as api, \
                mock.patch.object(changes.subprocess, 'Popen') as spawn:
            self.assertEqual(changes.ensure_server(root=self.root), changes.PORT + 1)
            command = spawn.call_args.args[0]
            self.assertEqual(command[command.index('--port') + 1], str(changes.PORT + 1))
            self.assertEqual(api.call_args_list, [mock.call(changes.PORT, '/api/health'),
                                                 mock.call(changes.PORT + 1, '/api/health')])

    def test_preview_assets_reject_traversal_private_files_and_symlinks(self):
        self.write('src/asset.js', 'export function preview() {}')
        self.write('.env', 'SECRET=private')
        outside = Path(self.temp.name) / 'outside.js'
        outside.write_text('private outside source')
        (self.root / 'src' / 'escape.js').symlink_to(outside)
        record = self.queue.create_preview({'asset': {'module': 'src/asset.js'}})
        port = self.server()
        prefix = record['url'] + 'files/'
        status, body = self.request(port, 'GET', prefix + 'src/asset.js')
        self.assertEqual(status, 200, body)
        for name in ('src/../../outside.js', 'src/%2e%2e/%2e%2e/outside.js',
                     'src/escape.js', '.env', '.git/config', 'runs/changes/queue.sqlite3'):
            status, body = self.request(port, 'GET', prefix + name)
            self.assertIn(status, (400, 403, 404), (name, body))
            self.assertNotIn(b'private outside source', body)

    def test_sse_announces_new_queue_records(self):
        port = self.server()
        connection = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        self.addCleanup(connection.close)
        connection.request('GET', '/api/events')
        response = connection.getresponse()
        self.addCleanup(response.close)
        self.assertEqual(response.status, 200)
        self.assertEqual(response.getheader('Content-Type'), 'text/event-stream')
        self.assertEqual(response.readline(), b'retry: 1000\n')
        self.assertEqual(response.readline(), b'\n')
        self.assertEqual(response.readline(), b'event: changes\n')
        self.assertEqual(json.loads(response.readline().removeprefix(b'data: '))['changes'], [])
        self.assertEqual(response.readline(), b'\n')
        record = self.queue.create('Visible on event stream')
        for _ in range(10):
            line = response.readline()
            if line.startswith(b'data: '):
                items = json.loads(line.removeprefix(b'data: '))['changes']
                if any(item['id'] == record['id'] for item in items):
                    break
        else:
            self.fail('New queue record was never sent to the event stream')

    def test_updates_can_be_read_without_holding_a_connection(self):
        record = self.queue.create('Poll the queue')
        code, body = self.request(self.server(), 'GET', '/api/events?poll=1')
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(body)['changes'][0]['id'], record['id'])


if __name__ == '__main__':
    unittest.main()
