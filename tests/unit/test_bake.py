"""`town bake --check` decides from fingerprints alone: no browser, standard library only."""
from contextlib import redirect_stdout
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tinytown import bake as module
from tinytown.bake import (WEB, bake, stamp_viewer, surface_source_hash, surfaces_status, versioned_html,
                           viewer_revision)
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

    def bake_surfaces(self, payload=b'packed surfaces'):
        """Record a baked surface asset the way a real bake does."""
        digest = hashlib.sha256(payload).hexdigest()
        self.write(f'data/ridge/surfaces-{digest[:16]}.bin.gz', payload)
        self.write('data/ridge/surfaces.json', json.dumps({
            'file': f'surfaces-{digest[:16]}.bin.gz', 'compressedBytes': len(payload), 'compressedSha256': digest,
            'inputSha256': hashlib.sha256(self.paths.scene.read_bytes()).hexdigest(),
            'sourceSha256': surface_source_hash(self.root)}))


class SurfaceFingerprints(Fixture):
    def test_generator_hash_covers_src_modules_and_the_precompute_page(self):
        # The page's repository path is part of every committed surfaces.json.
        expected = hashlib.sha256()
        for label, path in (('src/main.js', self.root / 'src/main.js'), ('src/site.js', self.root / 'src/site.js'),
                            ('tinytown/web/precompute.html', WEB / 'precompute.html')):
            expected.update(label.encode() + b'\0' + path.read_bytes())
        self.assertEqual(surface_source_hash(self.root), expected.hexdigest())
        self.write('src/site.js', '// generator v2')
        self.assertNotEqual(surface_source_hash(self.root), expected.hexdigest())

    def test_check_is_current_only_when_scene_generator_and_payload_all_match(self):
        self.assertFalse(surfaces_status(self.paths)[0], 'no manifest yet')
        self.bake_surfaces()
        self.assertTrue(surfaces_status(self.paths)[0])
        self.assertTrue(bake(self.paths, check=True, stream=False))
        self.write('data/ridge/site.json', '{"buildings": [{"id": 1}]}')
        self.assertFalse(bake(self.paths, check=True, stream=False), 'edited scene')
        self.bake_surfaces()
        self.write('src/site.js', '// generator v2')
        self.assertFalse(bake(self.paths, check=True, stream=False), 'edited generator')
        self.bake_surfaces()
        manifest = json.loads(self.paths.surfaces_index.read_text())
        self.write('data/ridge/' + manifest['file'], b'corrupt')
        self.assertFalse(bake(self.paths, check=True, stream=False), 'corrupt payload')
        (self.root / 'data/ridge' / manifest['file']).unlink()
        self.assertFalse(bake(self.paths, check=True, stream=False), 'missing payload')

    def test_check_never_touches_the_browser(self):
        with patch.dict('sys.modules', {'tinytown.browser': None}):
            self.assertFalse(bake(self.paths, check=True, stream=False))
            self.bake_surfaces()
            self.assertTrue(bake(self.paths, check=True, stream=False))

    def test_stream_check_delegates_to_the_node_exporter(self):
        with patch.object(module.subprocess, 'run') as run:
            run.return_value.returncode = 0
            self.assertTrue(bake(self.paths, check=True, surfaces=False))
            command, kwargs = run.call_args.args[0], run.call_args.kwargs
            self.assertEqual(command[:2], ['node', str(WEB / 'prepare_streaming.mjs')])
            self.assertEqual(command[2:], ['data/ridge', '--check'])
            self.assertEqual(kwargs['cwd'], self.root)
            run.return_value.returncode = 1
            self.assertFalse(bake(self.paths, check=True, surfaces=False))
            self.bake_surfaces()
            self.assertFalse(bake(self.paths, check=True), 'a stale stream fails the whole check')
            run.return_value.returncode = 0
            self.assertTrue(bake(self.paths, check=True))
            bake(self.paths, check=False, surfaces=False)
            self.assertEqual(run.call_args.args[0][2:], ['data/ridge'])


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
