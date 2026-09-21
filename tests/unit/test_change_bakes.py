import json
import time
from unittest import mock
from tinytown import change_bakes, changes
from tests.unit.test_changes import ChangeQueueFixture


FAKE_BAKE = '''from pathlib import Path
import json,sys
root=Path('.')
data=root/'data'/sys.argv[1]/'stream'
data.mkdir(parents=True,exist_ok=True)
(data/'manifest.json').write_text('{"version":4}')
(root/'index.html').write_text('<html><head></head><body>Frozen world</body></html>')
print('Bake ready',flush=True)
'''


class TaskBakes(ChangeQueueFixture):
    def setUp(self):
        super().setUp()
        self.write('sites/example/site.json', '{"title":"Example","deploy":[{"route":"/"}]}')
        self.write('tinytown/web/change-map.html', '<html>Whole map __CHANGE_ID__</html>')

    def wait_bake(self, change_id, expected):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            record = self.queue.get(change_id, detail=True)
            if record.get('bake', {}).get('status') == expected:
                return record
            time.sleep(.02)
        self.fail(str(record))

    def test_bake_isolated_snapshot_and_failure_preserves_previous_world(self):
        self.write('tinytown/web/stream-export.js', '// initial exporter')
        record = self.complete()
        with mock.patch.object(change_bakes, 'RUNNER', FAKE_BAKE):
            queued = self.queue.request_bake(record['id'])
            duplicate = self.queue.request_bake(record['id'])
            self.assertEqual(queued['bake']['id'], duplicate['bake']['id'])
            ready = self.wait_bake(record['id'], 'ready')
        world = self.queue.paths.bake(record['id'], ready['baked']['id']) / 'world'
        self.assertEqual((world/'src/main.js').read_text(), 'worker edit\n')
        self.assertFalse(ready['baked']['stale'])
        exporter = self.queue.paths.workspace(record['id']) / 'tinytown/web/stream-export.js'
        exporter.write_text('// changed exporter')
        self.assertTrue(self.queue.get(record['id'], detail=True)['baked']['stale'])
        exporter.write_text('// initial exporter')
        (self.queue.paths.workspace(record['id'])/'src/main.js').write_text('next edit\n')
        self.assertTrue(self.queue.get(record['id'], detail=True)['baked']['stale'])
        self.assertEqual((world/'src/main.js').read_text(), 'worker edit\n')
        with mock.patch.object(change_bakes, 'RUNNER', "raise RuntimeError('test bake failed')"):
            self.queue.request_bake(record['id'])
            failed = self.wait_bake(record['id'], 'failed')
        self.assertEqual(failed['baked']['id'], ready['baked']['id'])
        self.assertEqual(failed['status'], 'pending_approval')
        self.assertIn('test bake failed', failed['bake_log'])
        self.assertEqual(self.queue._collect(failed), ['src/main.js'])
        self.assertEqual((self.root/'data/example/stream/manifest.json').read_text(), '{}')

    def test_map_serves_only_ready_bake_assets_and_never_live_scene(self):
        record = self.complete()
        port = self.server()
        url = f'/previews/{record["id"]}/map/'
        self.assertEqual(self.request(port, 'GET', url)[0], 200)
        self.assertEqual(self.request(port, 'GET', url+'scene.json')[0], 400)
        with mock.patch.object(change_bakes, 'RUNNER', FAKE_BAKE):
            code, body = self.request(port, 'POST', f'/api/changes/{record["id"]}/bake', {'site':'example'}, {'X-TinyTown':'changes'})
            self.assertEqual(code, 200, body)
            ready = self.wait_bake(record['id'], 'ready')
        prefix = url + ready['baked']['id'] + '/'
        code, html = self.request(port, 'GET', prefix)
        self.assertEqual(code, 200, html)
        self.assertIn(f'<base href="{prefix}">'.encode(), html)
        self.assertEqual(self.request(port, 'GET', prefix+'data/example/stream/manifest.json')[0], 200)
        self.assertEqual(self.request(port, 'GET', prefix+'src/main.js')[1], b'worker edit\n')
        for path in ('.git/config', 'runs/headless-browser/runtime/private', 'data/example/source/osm.json', '../workspace/src/main.js'):
            self.assertIn(self.request(port, 'GET', prefix+path)[0], (400, 404))

    def test_interrupted_bake_is_retryable_without_failing_task(self):
        record = self.complete()
        self.queue.stop()
        record['bake'] = {'id':'abcdef123456','status':'running','site':'example'}
        self.queue._save(record)
        self.queue.start()
        recovered = self.wait_bake(record['id'], 'failed')
        self.assertEqual(recovered['status'], 'pending_approval')
