"""`town bake` delegates site bakes to `node tinytown/web/bake.mjs`; viewer stamping is standard library."""
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tinytown import bake as module
from tinytown.bake import WEB, bake, stamp_viewer, versioned_html, viewer_revision
from tinytown.paths import SitePaths

INDEX = '''<html><head><script type="importmap">{"imports":{"three":"https://example.com/three.js"}}</script>
<link rel="modulepreload" href="./src/main.js"><script type="module" src="./src/main.js"></script></head></html>'''


class Fixture(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        quiet = redirect_stdout(io.StringIO())  # bake reports progress on stdout
        quiet.__enter__()
        self.addCleanup(quiet.__exit__, None, None, None)
        self.write('index.html', INDEX)
        self.write('src/main.js', '// viewer')
        self.write('src/site.js', '// generator')
        self.write('sites/deploy.json', '{}')
        self.write('sites/ridge/site.json', json.dumps({'title': 'Ridge', 'description': 'ridge'}))
        self.paths = SitePaths('ridge', self.root)
        self.write('data/ridge/site.json', '{"buildings": []}')

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content.encode() if isinstance(content, str) else content)



class SiteBake(Fixture):
    def test_site_bakes_run_the_node_baker(self):
        with patch.object(module.subprocess, 'run') as run:
            run.return_value.returncode = 0
            self.assertTrue(bake(self.paths, check=True))
            command, kwargs = run.call_args.args[0], run.call_args.kwargs
            self.assertEqual(command[:2], ['node', str(WEB / 'bake.mjs')])
            self.assertEqual(command[2:], ['data/ridge', '--check'])
            self.assertEqual(kwargs['cwd'], self.root)
            bake(self.paths)
            self.assertEqual(run.call_args.args[0][2:], ['data/ridge'])
            bake(self.paths, force=True, surfaces=False)
            self.assertEqual(run.call_args.args[0][2:], ['data/ridge', '--force', '--stream-only'])
            bake(self.paths, check=True, stream=False)
            self.assertEqual(run.call_args.args[0][2:], ['data/ridge', '--check', '--surfaces-only'])
            run.return_value.returncode = 1
            self.assertFalse(bake(self.paths), 'a failed bake fails the verb')


class ViewerStamp(Fixture):
    def test_stamps_follow_the_module_graph_and_check_reports_staleness(self):
        self.assertFalse(stamp_viewer(self.root, check=True), 'unstamped viewer is stale')
        self.assertEqual((self.root / 'index.html').read_text(), INDEX, 'check never writes')
        self.assertTrue(stamp_viewer(self.root))
        revision = viewer_revision(self.root)
        html = (self.root / 'index.html').read_text()
        self.assertEqual(html.count(f'?v={revision}'), 4)
        self.assertIn('"./src/site.js": "./src/site.js?v=', html)
        self.assertIn('https://example.com/three.js', html)
        self.assertTrue(stamp_viewer(self.root, check=True))
        self.assertEqual(versioned_html(self.root), (revision, html), 'stamping is idempotent')
        self.write('src/site.js', '// generator v2')
        self.assertFalse(stamp_viewer(self.root, check=True))
        self.assertTrue(stamp_viewer(self.root))
        self.assertNotEqual(viewer_revision(self.root), revision)
        self.assertNotIn(revision, (self.root / 'index.html').read_text())

    def test_viewer_without_an_import_map_is_rejected(self):
        self.write('index.html', '<html></html>')
        with self.assertRaisesRegex(ValueError, 'import map'):
            stamp_viewer(self.root)


if __name__ == '__main__':
    unittest.main()
