"""Rendering through a (mocked) browser tab: paths, records, reuse, batches, comparisons."""
import json
import math
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tinytown import render as r
from tinytown.cli import build_parser
from tinytown.paths import SitePaths
from tinytown.state import fingerprint, read_json


def building(bid, cx, front_dir=0.0):
    return {'id': int(bid), 'obb': {'cx': cx, 'cz': 0.0, 'w': 10.0, 'd': 6.0, 'angle': 0.0},
            'pts': [[cx - 5, -3], [cx + 5, -3], [cx + 5, 3], [cx - 5, 3]],
            'front': {'dir': front_dir}, 'style': {'kind': 'house'}, 'blueprint': {'floors': 1, 'id': bid}}


class FakeTab:
    """Records the viewer drive sequence and writes a fake PNG."""

    def __init__(self, *size):
        self.size = size; self.calls = []; self.logs = []
        self.record = {'provider': 'headless-chromium', 'version': '152', 'headless': True, 'graphics': 'swiftshader', 'key': 'k'}
        self.closed = False

    def go(self, url): self.calls.append(('go', url))
    def wait_town(self): self.calls.append(('wait_town',)); return 1.0
    def hide(self, css): self.calls.append(('hide', css))
    def ev(self, expr): self.calls.append(('ev', expr)); return 1
    def shot(self, path):
        self.calls.append(('shot', path))
        Path(path).parent.mkdir(parents=True, exist_ok=True); Path(path).write_bytes(b'\x89PNG fake')
        return path
    def close(self): self.closed = True
    def __enter__(self): return self
    def __exit__(self, *exc): self.close()


class RenderFixture(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(); self.addCleanup(directory.cleanup)
        self.root = Path(directory.name).resolve()
        (self.root / 'index.html').write_text('<html>viewer</html>')
        (self.root / 'src').mkdir(); (self.root / 'src' / 'a.js').write_text('a'); (self.root / 'src' / 'b.js').write_text('b')
        (self.root / 'src' / 'notes.md').write_text('not a module')
        self.paths = SitePaths('town', self.root)
        # Building 1 faces +x (east): its road face is +u. Building 2 sits east of it.
        self.site = {'center': {'lat': 42.9, 'lon': -77.7}, 'size': 400, 'terrain': {'t': 1}, 'roads': [],
                     'buildings': [building('1', 0.0), building('2', 20.0, math.pi)]}
        self.paths.scene.parent.mkdir(parents=True); self.paths.scene.write_text(json.dumps(self.site))
        for bid in ('1', '2'):
            draft = self.paths.building(bid).draft
            draft.parent.mkdir(parents=True); draft.write_text(json.dumps({'floors': 2, 'id': bid, 'draft': True}))
        sleep = patch.object(r.time, 'sleep'); sleep.start(); self.addCleanup(sleep.stop)


class Render(RenderFixture):
    def test_named_face_writes_png_and_record(self):
        tab = FakeTab()
        out = r.render(self.paths, '1', face='+u', dist=40, extra=['2'], tab=tab)
        self.assertEqual(out, self.paths.building('1').render('+u'))
        self.assertTrue(out.exists())
        record = read_json(Path(str(out) + '.json'))
        url = record['url']
        self.assertTrue(url.startswith('http://localhost:8734/?site=town&focus=1&side=%2Bu&dist=40&height=8&stage=detail&free=1'))
        self.assertIn('&bp=1,2', url); self.assertIn('&notrees=1', url)
        self.assertEqual(record['view'], '+u'); self.assertEqual(record['stage'], 'detail'); self.assertIsNone(record['pose'])
        self.assertEqual(record['blueprint'], fingerprint({'floors': 2, 'id': '1', 'draft': True}))
        self.assertEqual(record['renderer'], r.renderer_signature(self.root))
        self.assertEqual(record['context'], r.visual_context(self.site, self.site['buildings'][0]))
        self.assertEqual(record['neighbors'], {'2': {'draft': True, 'frame': record['neighbors']['2']['frame'],
                                                     'blueprint': fingerprint({'floors': 2, 'id': '2', 'draft': True})}})
        self.assertEqual(record['browser'], {'provider': 'headless-chromium', 'version': '152', 'headless': True, 'graphics': 'swiftshader'})
        self.assertNotIn('batch_phase', record)
        self.assertEqual(set(record), {'key', 'url', 'blueprint', 'frame', 'context', 'renderer', 'view', 'stage', 'pose', 'neighbors', 'browser'})
        # Scene loaded once, UI hidden, camera aimed then lifted above the grade, then the shot.
        kinds = [c[0] for c in tab.calls]
        self.assertEqual(kinds, ['go', 'wait_town', 'hide', 'ev', 'ev', 'shot'])
        self.assertIn('lookAtBuilding(...["1", "+u", 40, 8])', tab.calls[3][1])
        self.assertEqual(tab.calls[2][1], r.HIDE_UI)

    def test_front_uses_the_road_face_name_and_neighbours_without_drafts(self):
        out = r.render(self.paths, '1', tab=FakeTab())
        self.assertEqual(out.name, '+u.png')
        record = read_json(Path(str(out) + '.json'))
        self.assertIn('&side=front&dist=60&', record['url']); self.assertIn('&bp=1&', record['url'])
        self.assertEqual(record['neighbors']['2'], {'draft': False, 'frame': record['neighbors']['2']['frame'],
                                                    'blueprint': fingerprint({'floors': 1, 'id': '2'})})

    def test_iso_and_no_bp(self):
        tab = FakeTab()
        out = r.render(self.paths, '1', face='+v', iso=True, no_bp=True, trees=True, tab=tab)
        self.assertEqual(out.name, 'iso.png')
        record = read_json(Path(str(out) + '.json'))
        self.assertNotIn('free=1', record['url']); self.assertNotIn('bp=', record['url']); self.assertNotIn('notrees', record['url'])
        self.assertEqual(record['blueprint'], fingerprint({'floors': 1, 'id': '1'}))
        self.assertEqual([c[0] for c in tab.calls], ['go', 'wait_town', 'hide', 'ev', 'shot'])  # no grade lift for iso

    def test_unchanged_inputs_reuse_the_saved_render(self):
        first = FakeTab(); r.render(self.paths, '1', face='-u', tab=first)
        second = FakeTab(); out = r.render(self.paths, '1', face='-u', tab=second)
        self.assertEqual(second.calls, []); self.assertTrue(out.exists())
        r.render(self.paths, '1', face='-u', tab=second, force=True)
        self.assertEqual(second.calls[-1][0], 'shot')
        self.paths.building('1').draft.write_text(json.dumps({'floors': 3}))
        third = FakeTab(); r.render(self.paths, '1', face='-u', tab=third)
        self.assertEqual(third.calls[-1][0], 'shot')

    def test_one_scene_serves_many_faces_until_the_drafts_change(self):
        tab = FakeTab()
        r.render(self.paths, '1', face='+u', tab=tab); r.render(self.paths, '1', face='-u', tab=tab)
        self.assertEqual([c[0] for c in tab.calls].count('go'), 1)
        r.render(self.paths, '1', face='-u', extra=['2'], tab=tab)
        self.assertEqual([c[0] for c in tab.calls].count('go'), 2)

    def test_explicit_out_and_bearing_face(self):
        out = self.root / 'scratch' / 'view.png'
        result = r.render(self.paths, '1', face='135', out=out, tab=FakeTab())
        self.assertEqual(result, out); self.assertTrue(out.exists())
        self.assertEqual(read_json(Path(str(out) + '.json'))['view'], '135')

    def test_render_opens_its_own_tab_when_none_is_given(self):
        tab = FakeTab()
        with patch('tinytown.browser.Tab', return_value=tab) as Tab, patch('tinytown.browser.ensure_browser') as browser, \
                patch('tinytown.browser.ensure_server') as server:
            r.render(self.paths, '1', face='+u', width=800, height=600, scale=2)
        Tab.assert_called_once_with(800, 600, 2); browser.assert_called_once(); server.assert_called_once()
        self.assertTrue(tab.closed)


class Inputs(RenderFixture):
    def test_renderer_signature_covers_only_viewer_modules(self):
        before = r.renderer_signature(self.root)
        (self.root / 'src' / 'notes.md').write_text('changed'); (self.root / 'index.html').write_text('changed')
        self.assertEqual(r.renderer_signature(self.root), before)
        (self.root / 'src' / 'a.js').write_text('changed')
        self.assertNotEqual(r.renderer_signature(self.root), before)

    def test_render_inputs_track_viewer_scene_and_drafts(self):
        base = r.render_inputs(self.paths, ['1'])
        self.assertEqual(r.render_inputs(self.paths, ['1']), base)
        self.assertNotEqual(r.render_inputs(self.paths, ['1', '2']), base)
        (self.root / 'index.html').write_text('new viewer')
        changed = r.render_inputs(self.paths, ['1']); self.assertNotEqual(changed, base)
        self.paths.building('2').draft.write_text(json.dumps({'floors': 9}))
        self.assertEqual(r.render_inputs(self.paths, ['1']), changed)  # other drafts do not matter

    def test_local_images_are_hashed_and_remote_images_force_a_render(self):
        (self.root / 'data' / 'town' / 'textures').mkdir(parents=True)
        (self.root / 'data' / 'town' / 'textures' / 'brick.jpg').write_bytes(b'1')
        self.paths.building('1').draft.write_text(json.dumps({'walls': {'image': '/data/town/textures/brick.jpg'}}))
        base = r.render_inputs(self.paths, ['1'])
        (self.root / 'data' / 'town' / 'textures' / 'brick.jpg').write_bytes(b'2')
        self.assertNotEqual(r.render_inputs(self.paths, ['1']), base)
        self.paths.building('1').draft.write_text(json.dumps({'walls': {'image': 'https://example.com/brick.jpg'}}))
        self.assertNotEqual(r.render_inputs(self.paths, ['1']), r.render_inputs(self.paths, ['1']))

    def test_view_names_and_extras(self):
        b = self.site['buildings'][0]
        self.assertEqual(r.view_name(b, None, False), '+u'); self.assertEqual(r.view_name(b, 'front', True), 'iso')
        self.assertEqual(r.view_name(b, '-v', False), '-v'); self.assertEqual(r.view_name({**b, 'front': None}, 'front', False), 'front')
        self.assertEqual(r._extras('3,1, 2'), ['1', '2', '3']); self.assertEqual(r._extras(['2', 2, '']), ['2']); self.assertEqual(r._extras(None), [])


class Compare(RenderFixture):
    def setUp(self):
        super().setUp()
        from PIL import Image
        self.render_path = self.paths.building('1').render('+u')
        self.render_path.parent.mkdir(parents=True)
        Image.new('RGB', (40, 30), 'blue').save(self.render_path)
        self.fronts = self.paths.building('1').fronts_dir; self.fronts.mkdir()
        self.Image = Image

    def test_without_a_photo_returns_none(self):
        with patch('builtins.print'):
            self.assertIsNone(r.compare(self.paths, '1', '+u', self.render_path))

    def test_photo_beside_render(self):
        self.Image.new('RGB', (30, 30), 'red').save(self.fronts / '+u.png')
        out = r.compare(self.paths, '1', '+u', self.render_path)
        self.assertEqual(out, self.paths.building('1').renders / 'compare-+u.png')
        with self.Image.open(out) as image:
            self.assertEqual(image.size, (900 + 1200 + 12, 928))

    def test_photo_named_in_fronts_json_is_found(self):
        self.Image.new('RGB', (30, 30), 'red').save(self.fronts / 'front_1_+u_3.png')
        self.paths.building('1').fronts.write_text(json.dumps({'faces': {'+u': {'photos': [{'file': 'front_1_+u_3.png'}]}}}))
        self.assertEqual(r.reference_photo(self.paths, '1', '+u'), self.fronts / 'front_1_+u_3.png')


class Batch(RenderFixture):
    def test_batch_shares_scenes_and_writes_phase_records(self):
        tabs = []
        def make_tab(*size):
            tabs.append(FakeTab(*size)); return tabs[-1]
        with patch('tinytown.browser.Tab', side_effect=make_tab), patch('tinytown.browser.ensure_browser') as browser, \
                patch('tinytown.browser.ensure_server') as server:
            batch = r.RenderBatch(self.paths, drafts=['1', '2'], phase='author')
            browser.assert_called_once(); server.assert_called_once()
            renders = self.paths.building('1').renders
            b1 = self.site['buildings'][0]
            batch.capture(b1, 'front', 35.0, False, renders / 'author-front.png')
            batch.capture('1', '+u', 35.0, False, renders / 'author-+u.png')
            batch.capture(b1, 'front', 120.0, True, renders / 'author-overview.png')
            batch.capture(b1, 'front', 35.0, False, renders / 'author-front.png')  # unchanged: reused
            batch.close()
        self.assertEqual(len(tabs), 2); self.assertEqual(tabs[0].size, (1000, 750, 1))
        self.assertEqual([c[0] for c in tabs[0].calls].count('go'), 1); self.assertEqual([c[0] for c in tabs[0].calls].count('shot'), 2)
        self.assertEqual([c[0] for c in tabs[1].calls].count('shot'), 1)
        self.assertTrue(all(t.closed for t in tabs))
        record = read_json(renders / 'author-front.png.json')
        self.assertEqual(record['view'], 'front'); self.assertEqual(record['batch_phase'], 'author')
        self.assertEqual(record['key'], fingerprint([batch.inputs, '1', 'front', 35.0, False, False, 'author']))
        self.assertIn('&bp=1,2&', record['url']); self.assertIn('&dist=35.0&', record['url'])
        self.assertEqual(record['browser']['graphics'], 'swiftshader'); self.assertEqual(record['renderer'], batch.renderer)
        self.assertEqual(record['neighbors']['2']['draft'], True)
        overview = read_json(renders / 'author-overview.png.json')
        self.assertEqual(overview['view'], 'iso'); self.assertNotIn('free=1', overview['url'])
        self.assertEqual(set(record), {'key', 'url', 'blueprint', 'frame', 'context', 'renderer', 'view', 'stage', 'pose',
                                       'neighbors', 'browser', 'batch_phase'})


class Cli(RenderFixture):
    def parse(self, *argv):
        return build_parser({'render'}).parse_args(['render', *argv])

    def test_face_flags_and_with_list_parse(self):
        args = self.parse('town', '1', '--face=-u', '--face', '+v', '--with', '2', '3', '--iso', '--dist', '40')
        self.assertEqual(args.face, ['-u', '+v']); self.assertEqual(args.extra, ['2', '3'])
        self.assertTrue(args.iso); self.assertEqual(args.dist, 40)

    def test_run_renders_reuses_and_compares(self):
        tab = FakeTab()
        with patch('tinytown.render.site_paths', return_value=self.paths), patch('tinytown.browser.Tab', return_value=tab), \
                patch('tinytown.browser.ensure_browser'), patch('tinytown.browser.ensure_server'), \
                patch('builtins.print') as out:
            self.assertEqual(self.parse('town', '1', '--face=+u', '--face=-u').run(self.parse('town', '1', '--face=+u', '--face=-u')), 0)
            self.assertEqual([c[0] for c in tab.calls].count('shot'), 2)
            self.assertEqual(self.parse('town', '1', '--face=+u').run(self.parse('town', '1', '--face=+u')), 0)
        self.assertIn('unchanged, reused', out.call_args.args[0])
        self.assertTrue(self.paths.building('1').render('+u').exists()); self.assertTrue(self.paths.building('1').render('-u').exists())


if __name__ == '__main__':
    unittest.main()
