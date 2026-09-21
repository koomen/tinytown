import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tinytown import preview


class PreviewTests(unittest.TestCase):
    def source(self):
        return {'name': 'test', 'size': {'w': 1000, 'h': 1000},
                'terrain': {'x0': -500, 'x1': 500, 'z0': -500, 'z1': 500,
                            'cols': 101, 'rows': 101, 'values': list(range(10201))},
                'buildings': [{'id': 1, 'addr': '10 Main Street', 'pts': [[95,95],[105,95],[105,105]],
                               'obb': {'cx': 100, 'cz': 100}},
                              {'id': 2, 'pts': [[400,400]], 'obb': {'cx':400,'cz':400}}],
                'roads': [{'pts': [[-500,100],[500,100]], 'name': 'Main'}],
                'areas': [{'pts': [[-500,-500],[500,-500],[500,500],[-500,500]]}],
                'outline': {'pts': []}}

    def test_bounded_scene_clips_crossing_geometry_and_terrain_without_write(self):
        with patch.object(preview, 'build', side_effect=lambda *a, **k: self.source()) as build:
            data = preview.scene('/tmp', {'site':'test','target':'10 Main Street','radius':20})
        self.assertFalse(build.call_args.kwargs['write'])
        self.assertEqual([b['id'] for b in data['buildings']], [1])
        self.assertEqual(data['roads'][0]['pts'], [[80,100],[120,100]])
        self.assertEqual(data['size'], {'w':40,'h':40})
        self.assertEqual(data['offset'], {'x':100,'z':100})
        self.assertEqual(len(data['terrain']['values']),25)
        self.assertTrue(all(80<=v<=120 for p in data['areas'][0]['pts'] for v in p))
        self.assertNotIn('outline',data)

    def test_missing_and_ambiguous_targets_fail(self):
        data = self.source()
        with self.assertRaisesRegex(ValueError, '0 matches'):
            preview._center(data, {'target':'missing'})
        data['buildings'].append(dict(data['buildings'][0],id=3))
        with self.assertRaisesRegex(ValueError, '2 matches'):
            preview._center(data, {'target':'Main'})
        self.assertEqual(preview._center(data, {'target':'missing','center':[1,2]}),[1,2])

    def test_whole_map_keeps_entire_scene_without_a_bake(self):
        spec = preview.validate_spec('/tmp', {'site': 'test', 'whole_map': True})
        with patch.object(preview, 'build', side_effect=lambda *a, **k: self.source()) as build:
            data = preview.scene('/tmp', spec)
        self.assertFalse(build.call_args.kwargs['write'])
        self.assertEqual(data, {**self.source(), 'preview': {'whole_map': True}})
        doc = preview.document(spec, '/previews/job/map/', [{'name': 'test', 'title': '<Town>'}])
        self.assertIn('/previews/job/map/scene.json?site=test', doc)
        self.assertIn('/previews/job/map/events?site=test', doc)
        self.assertIn('preview-map.js', doc)
        self.assertIn('&lt;Town&gt;', doc)
        for bad in ({'site': '../escape', 'whole_map': True}, {'whole_map': 'true'},
                    {'site': 'test', 'whole_map': True, 'asset': 'src/test.js'}):
            with self.assertRaises(ValueError):
                preview.validate_spec('/tmp', bad)

    def test_whole_map_uses_current_builder_in_older_workspace(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / 'tinytown'
            package.mkdir()
            (package / '__init__.py').write_text('')
            (package / 'preview.py').write_text('def scene(*args): raise ValueError("old preview")')
            (package / 'paths.py').write_text('class SitePaths:\n def __init__(self, name): self.name = name\n')
            module = package / 'site.py'
            for version in (1, 2):
                module.write_text(f'def build(paths, write):\n assert not write\n print("diagnostic")\n return {{"version":{version},"name":paths.name}}\n')
                data = preview.fresh_scene(root, {'site': 'test', 'whole_map': True})
                self.assertEqual(data, {'version': version, 'name': 'test', 'preview': {'whole_map': True}})

    def test_validation_and_asset_without_site(self):
        for spec in ({'center':[0,float('nan')]},{'center':[0,0],'radius':1000},{'asset':'../secret.js'}, {'asset':'private/asset.js'}):
            with self.assertRaises(ValueError):
                preview.validate_spec('/tmp',spec)
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'src').mkdir()
            (root/'src'/'asset.js').write_text('export function preview() {}')
            result=preview.scene(root,{'asset':'src/asset.js'})
            self.assertEqual(result['asset']['export'],'preview')
            before=preview.fingerprint(root,{'asset':'src/asset.js'})
            (root/'src'/'asset.js').write_text('export function preview() { return null; }')
            self.assertNotEqual(before,preview.fingerprint(root,{'asset':'src/asset.js'}))

    def test_document_escapes_untrusted_title_and_scopes_files(self):
        doc=preview.document({'title':'</script><script>bad()'},'/previews/abc/')
        self.assertIn('<base href="/previews/abc/files/">',doc)
        self.assertIn('/previews/abc/scene.json',doc)
        self.assertNotIn('</script><script>bad()',doc)

    def test_fresh_scene_imports_workspace_edits_and_separates_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / 'tinytown'
            package.mkdir()
            (package/'__init__.py').write_text('')
            module = package/'preview.py'
            module.write_text('def scene(root, spec):\n print("builder warning")\n return {"version":1,"spec":spec}\n')
            self.assertEqual(preview.fresh_scene(root, {'target':'one'})['version'], 1)
            module.write_text('def scene(root, spec):\n return {"version":2}\n')
            self.assertEqual(preview.fresh_scene(root, {})['version'], 2)
            module.write_text('raise ValueError("invalid edit")\n')
            with self.assertRaisesRegex(ValueError, 'invalid edit'):
                preview.fresh_scene(root, {})
