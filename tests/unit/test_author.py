"""tinytown.author: the per-building author/review/repair state machine, scene critique, baseline comparison, accept.

No model, browser or network: model.execute, render, references, sources and browser are replaced by fakes.
"""
from collections import Counter
import contextlib
import copy
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tinytown import author, cli, model, review  # noqa: E402
from tinytown.paths import SitePaths  # noqa: E402
from tinytown.review import MAX_REPAIRS, POLICY, read_review  # noqa: E402
from tinytown.state import atomic_json, building_frame, building_status, fingerprint, read_json  # noqa: E402

BP = {'volumes': [{'id': 'main', 'u': [-10, 10], 'v': [-4, 4], 'height': 5}]}
BP2 = {'volumes': [{'id': 'main', 'u': [-10, 10], 'v': [-4, 4], 'height': 6}]}
BP3 = {'volumes': [{'id': 'main', 'u': [-10, 10], 'v': [-4, 4], 'height': 7}]}
BP4 = {'volumes': [{'id': 'main', 'u': [-10, 10], 'v': [-4, 4], 'height': 8}]}
BAD = {'volumes': []}
READY = {'verdict': 'ready', 'summary': 'fine', 'orientation': {'status': 'correct', 'summary': 'ok'}, 'issues': []}
REPAIR = {'verdict': 'repair', 'summary': 'fix the porch', 'orientation': {'status': 'correct', 'summary': 'ok'},
          'issues': [{'severity': 'major', 'problem': 'porch', 'fix': 'narrow it'}]}


def building(bid, x=0, tags=None):
    return {'id': bid, 'centroid': [x, 0], 'pts': [[x - 10, -4], [x + 10, -4], [x + 10, 4], [x - 10, 4]],
            'obb': {'cx': x, 'cz': 0, 'w': 20, 'd': 8, 'angle': 0}, 'area': 160, 'tags': tags or {},
            'style': {'kind': 'house'}, 'front': {'dir': 0}}


def response(bp=None, patch_ops=None, base=None):
    """An AUTHOR-schema response: a full blueprint, or a hash-bound patch of `base`."""
    if patch_ops is not None:
        return {'blueprint_json': '', 'patch_json': json.dumps({'base_hash': fingerprint(base), 'operations': patch_ops}),
                'cues': ['cue'], 'references_used': ['SV1'], 'uncertainties': [], 'entrance_plan': []}
    return {'blueprint_json': json.dumps(bp), 'patch_json': '', 'cues': ['cue'], 'references_used': ['SV1'],
            'uncertainties': [], 'entrance_plan': [{'volume': 'main', 'face': '-v', 'role': 'principal',
                                                    'evidence': ['SV1'], 'confidence': 'observed'}]}


class FakeModel:
    """Scripted model.execute: a queue of responses per role, every call recorded."""

    def __init__(self, usage=1000):
        self.scripts = {}
        self.calls = []
        self.usage = usage
        self.lock = threading.Lock()

    def script(self, role, *responses):
        self.scripts.setdefault(role, []).extend(responses)
        return self

    def __call__(self, directory, prompt, schema, images, *, model, effort='medium', timeout=120, cancel=None,
                 binary='codex', thread=None):
        directory = Path(directory)
        role = directory.name.split('-', 3)[3]
        with self.lock:
            queue = self.scripts.get(role, [])
            item = queue.pop(0) if queue else None
            call = {'role': role, 'building': directory.parent.name, 'prompt': prompt, 'images': [str(i) for i in images],
                    'model': model, 'timeout': timeout, 'directory': str(directory)}
            self.calls.append(call)
        if callable(item):
            item = item(call)
        directory.mkdir(parents=True, exist_ok=True)
        result = {'response': None, 'usage': {'input_tokens': self.usage, 'output_tokens': 0, 'total_tokens': self.usage},
                  'usage_complete': True, 'error': None, 'directory': str(directory), 'duration': .1, 'model': model,
                  'returncode': 0, 'completed_turns': 1}
        if item is None:
            result.update(error='codex exited 1', usage_complete=False)
        elif isinstance(item, Exception):
            result.update(error=str(item), usage_complete=False)
        else:
            result['response'] = copy.deepcopy(item)
            (directory / 'response.json').write_text(json.dumps(item))
        return result

    def roles(self):
        return Counter(c['role'] for c in self.calls)


class FakeBatch:
    """render.RenderBatch stand-in: writes the image and a provenance record like render.record does."""
    captures = []
    signature = 'renderer-1'

    def __init__(self, paths, drafts=(), phase=None, site=None):
        self.paths, self.drafts, self.phase, self.site = paths, list(drafts), phase, site
        self.closed = False

    def capture(self, building, face, distance, iso, out, no_bp=False, force=False):
        out = Path(out)
        out.parent.mkdir(parents=True, exist_ok=True)
        bid = str(building['id'])
        draft = self.paths.building(bid).draft
        bp = json.loads(draft.read_text()) if not no_bp and bid in self.drafts and draft.exists() else building.get('blueprint')
        out.write_bytes(b'png')
        atomic_json(str(out) + '.json', {'blueprint': fingerprint(bp), 'renderer': FakeBatch.signature,
                                         'frame': building_frame(self.site, building), 'view': 'iso' if iso else face,
                                         'batch_phase': self.phase, 'no_bp': no_bp})
        FakeBatch.captures.append((bid, self.phase, face, iso, no_bp))
        return out

    def close(self):
        self.closed = True


class FakeTab:
    def __init__(self, *a, **k):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def go(self, url):
        FakeBrowser.urls.append(url)

    def wait_town(self):
        pass

    def hide(self, css):
        pass

    def ev(self, expr):
        return 1

    def shot(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_bytes(b'scene')


FakeBrowser = types.SimpleNamespace(ensure_server=lambda *a, **k: 8734, ensure_browser=lambda *a, **k: {}, Tab=FakeTab,
                                    urls=[])
FakeRender = types.SimpleNamespace(RenderBatch=FakeBatch, renderer_signature=lambda root=None: FakeBatch.signature,
                                   HIDE_UI='#loading{display:none}', viewer_url=lambda port=None: 'http://localhost:8734/')


class FakeReferences:
    """references.py stand-in: records captures, writes fronts.json and a packet with one attached image."""

    def __init__(self):
        self.captured = []

    def capture_fronts(self, paths, ids, *, faces=None, force=False, missing=False, max_photos=None, workers=2):
        self.captured.append(list(ids))
        for bid in ids:
            atomic_json(paths.building(bid).fronts, {'id': str(bid), 'faces': {f: {'photos': []} for f in faces or []}})

    def packet(self, paths, building, name, location, web_records, *, image_search='bing', max_web=1, extra_views=0):
        bid = str(building['id'])
        b = paths.building(bid)
        image = b.dir / 'reference-1.jpg'
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(b'jpg')
        record = {'id': 'SV1', 'kind': 'street-view', 'path': paths.relative(image), 'caption': 'SV1: requested face -v',
                  'camera': {'status': 'located'}}
        return {'version': 3, 'id': bid, 'name': name, 'location': location, 'address': building.get('addr'),
                'source_tags': building.get('tags', {}),
                'frame': {'width_u': 20, 'depth_v': 8, 'faces': {f: {'bearing': 90} for f in ('+u', '-u', '+v', '-v')}},
                'attachments': [record], 'images': [record], 'web': list(web_records), 'search': image_search,
                'max_web': max_web, 'extra_views': extra_views}

    def entrance_inventory(self, bp, b, site):
        return [{'volume': v.get('id'), 'face': '-v', 'kind': 'door'} for v in (bp or {}).get('volumes', [])]

    def contact_sheet(self, images, target, columns=2, cell=(600, 450)):
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        Path(target).write_bytes(b'sheet:' + ','.join(str(p) for p, _ in images).encode())


class FakeSources:
    def __init__(self):
        self.cropped = []

    def crop_aerials(self, paths, ids=None, **kw):
        self.cropped.append(list(ids or []))
        for bid in ids or []:
            atomic_json(paths.building(bid).aerial, {'id': str(bid), 'north_up': True})


class Fixture(unittest.TestCase):
    """A two-building site under a temporary root with every external module faked."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.paths = SitePaths('trial', self.root)
        self.site = {'name': 'trial', 'title': 'Trial Town', 'center': {'lat': 42, 'lon': -77}, 'size': {'w': 200, 'h': 200},
                     'buildings': [building('1'), building('2', 30)]}
        atomic_json(self.paths.scene, self.site)
        atomic_json(self.paths.overrides, {'title': 'Trial', 'blueprints': {}})
        atomic_json(self.paths.config, {'title': 'Trial Town', 'deploy': []})
        self.paths.satellite.parent.mkdir(parents=True, exist_ok=True)
        self.paths.satellite.write_bytes(b'jpg')
        self.model = FakeModel()
        self.refs = FakeReferences()
        self.sources = FakeSources()
        FakeBatch.captures = []
        FakeBatch.signature = 'renderer-1'
        FakeBrowser.urls = []
        self.build_calls = []
        stack = contextlib.ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.object(author, '_references', return_value=self.refs))
        stack.enter_context(patch.object(author, '_sources', return_value=self.sources))
        stack.enter_context(patch.object(author, '_render', return_value=FakeRender))
        stack.enter_context(patch.object(review, 'renderer_signature', lambda root=None: FakeBatch.signature))
        stack.enter_context(patch.object(author, '_browser', return_value=FakeBrowser))
        stack.enter_context(patch.object(model, 'execute', new=self.model))
        stack.enter_context(patch('tinytown.site.build', side_effect=lambda paths, write=True: self.build_calls.append(paths)))
        stack.enter_context(patch.object(author.time, 'sleep'))
        self.out = io.StringIO()
        stack.enter_context(contextlib.redirect_stdout(self.out))
        stack.enter_context(contextlib.redirect_stderr(io.StringIO()))

    def run_author(self, ids=None, **options):
        options.setdefault('workers', 1)
        options.setdefault('scene_review', False)
        options.setdefault('log', lambda text: None)
        return author.author(self.paths, ids, **options)

    def accept_site(self, bid, bp=BP):
        """Make `bid` an accepted building: blueprint in overrides and site.json, draft identical."""
        ov = read_json(self.paths.overrides)
        ov.setdefault('blueprints', {})[bid] = bp
        atomic_json(self.paths.overrides, ov)
        for b in self.site['buildings']:
            if str(b['id']) == bid:
                b['blueprint'] = bp
        atomic_json(self.paths.scene, self.site)
        atomic_json(self.paths.building(bid).draft, bp)

    def status(self, bid):
        return building_status(self.paths, bid, read_json(self.paths.overrides))


class PolicyHelpers(unittest.TestCase):
    def test_roof_color_alias_is_canonicalized_without_changing_intent(self):
        source = {'volumes': [{'id': 'main', 'roofColor': '#445566', 'roof': {'type': 'flat'}}]}
        result = author.canonical_blueprint(source)
        self.assertEqual(result['volumes'][0]['roof'], {'type': 'flat', 'color': '#445566'})
        self.assertNotIn('roofColor', result['volumes'][0])
        self.assertIn('roofColor', source['volumes'][0])
        source['volumes'][0]['roof']['color'] = '#112233'
        with self.assertRaises(ValueError):
            author.canonical_blueprint(source)

    def test_legacy_artwork_allowance_cannot_add_or_duplicate_custom_content(self):
        baseline = {'volumes': [{'id': 'main'}], 'signs': [{'image': 'mural.png'}], 'profile': [[0, 0], [1, 1]]}
        with patch.object(author, 'lint_blueprint', return_value=types.SimpleNamespace(errors=[], warnings=[])):
            self.assertEqual(author.validate(baseline, {'id': 1}, baseline), [])
            self.assertTrue(author.validate(baseline, {'id': 1}))
            for field, value in [('signs', [{'image': 'new.png'}]), ('profile', [[0, 0], [2, 2]]),
                                 ('signs', [{'image': 'mural.png'}, {'image': 'mural.png'}])]:
                candidate = copy.deepcopy(baseline)
                candidate[field] = value
                self.assertTrue(author.validate(candidate, {'id': 1}, baseline))

    def test_kit_validation_rejects_empty_and_custom_geometry(self):
        b = {'id': '1', 'obb': {'w': 10, 'd': 10}, 'pts': []}
        self.assertTrue(author.validate({'volumes': []}, b))
        self.assertTrue(author.validate({'volumes': [{'profile': []}]}, b))
        pavilion = {'pavilion': {'height': 3.1, 'pitch': .43, 'bents': 3, 'furniture': True}, 'volumes': []}
        self.assertEqual(author.validate(pavilion, {'id': 1, 'obb': {'cx': 0, 'cz': 0, 'angle': 0, 'w': 12, 'd': 10},
                                                    'pts': [[-6, -5], [6, -5], [6, 5], [-6, 5]]}), [])

    def test_comparison_approval_is_hash_bound_and_needs_views(self):
        baseline, candidate = BP, BP2
        self.assertTrue(author.comparison_approved(baseline, baseline, None))
        self.assertFalse(author.comparison_approved(baseline, candidate, None))
        record = {'verdict': 'approved', 'reason': 'kept the mural', 'reviewer': 'sol', 'baseline_hash': fingerprint(baseline),
                  'candidate_hash': fingerprint(candidate), 'baseline_views': ['a.png'], 'candidate_views': ['b.png']}
        self.assertTrue(author.comparison_approved(baseline, candidate, record))
        for change in ({'verdict': 'rejected'}, {'candidate_hash': 'other'}, {'baseline_views': []}, {'reason': ''}):
            self.assertFalse(author.comparison_approved(baseline, candidate, {**record, **change}), change)


class Authoring(Fixture):
    def test_full_flow_authors_renders_reviews_and_accepts(self):
        self.model.script('author', response(BP)).script('review', READY)
        result = self.run_author(['1'], accept=True)
        self.assertEqual(self.model.roles(), {'author': 1, 'review': 1})
        self.assertEqual(self.refs.captured, [['1']])
        self.assertEqual(self.sources.cropped, [['1']])
        b = self.paths.building('1')
        self.assertEqual(read_json(b.draft), BP)
        record = read_json(b.author)
        self.assertEqual((record['role'], record['number'], record['blueprint'], record['validation_errors']), ('author', 0, BP, []))
        self.assertEqual(record['draft_hash'], fingerprint(BP))
        self.assertIn('usage', record)
        self.assertEqual(read_json(b.references)['name'], 'Structure 1')
        views = {(phase, face, iso) for _, phase, face, iso, _ in FakeBatch.captures}
        self.assertEqual(views, {('initial', f, False) for f in ('+u', '-u', '+v', '-v')} | {('initial', 'front', True)})
        self.assertTrue((b.renders / 'initial-faces.jpg').is_file())
        review = read_json(b.review)
        self.assertEqual((review['draft_hash'], review['passed'], review['report']['verdict'], review['model']),
                         (fingerprint(BP), True, 'ready', 'sol'))
        self.assertEqual(review['renderer_signature'], 'renderer-1')
        self.assertEqual(set(review['renders']), {'overview', 'faces'})
        # the review saw the reference image, then the overview and the four-face sheet
        review_call = next(c for c in self.model.calls if c['role'] == 'review')
        self.assertEqual([Path(p).name for p in review_call['images']], ['reference-1.jpg', 'initial-overview.png', 'initial-faces.jpg'])
        self.assertIn('"actual_doors"', review_call['prompt'])
        self.assertEqual(result['accepted'], ['1'])
        self.assertEqual(result['buildings']['1']['status'], 'accepted')
        ov = read_json(self.paths.overrides)
        self.assertEqual(ov['blueprints']['1'], BP)
        self.assertEqual(ov['blueprint_frames']['1'], building_frame(self.site, building('1')))
        entry = ov['miniature_review']['1']
        self.assertEqual(set(entry), {'status', 'run', 'publication'})
        self.assertEqual((entry['status'], entry['run']), ('ready', record['run']))
        self.assertEqual((entry['publication']['forced'], entry['publication']['reason'], entry['publication']['policy']),
                         (False, 'inspection-passed', POLICY))
        self.assertEqual(entry['publication']['blueprint_hash'], fingerprint(BP))
        self.assertEqual(len(self.build_calls), 1)
        self.assertEqual(result['budget']['calls'], 2)
        self.assertEqual(self.status('1'), 'accepted')

    def test_author_prompt_carries_kit_packet_examples_and_return_contract(self):
        self.model.script('author', response(BP)).script('review', READY)
        self.run_author(['1'], location='Avon, New York')
        prompt = self.model.calls[0]['prompt']
        self.assertTrue(prompt.startswith(author.AUTHOR_TASK))
        self.assertIn('REFERENCE PACKET', prompt)
        self.assertIn('"location":"Avon, New York"', prompt)
        self.assertIn('APPROVED STYLE EXAMPLES', prompt)
        self.assertIn('Keep blueprint under 3500 output tokens.', prompt)
        self.assertIn('entrance_plan', prompt)
        self.assertEqual(self.model.calls[0]['model'], 'astra')
        self.assertEqual(self.model.calls[1]['model'], 'sol')

    def test_resume_skips_finished_steps(self):
        self.model.script('author', response(BP), response(BP2)).script('review', READY, READY)
        self.run_author(['1', '2'])
        self.assertEqual(self.model.roles(), {'author': 2, 'review': 2})
        self.assertEqual({self.status('1'), self.status('2')}, {'reviewed'})
        captures = len(FakeBatch.captures)
        again = self.run_author(['1', '2'])
        self.assertEqual(self.model.roles(), {'author': 2, 'review': 2}, 'no model call on resume')
        self.assertEqual(len(FakeBatch.captures), captures, 'no render on resume')
        self.assertEqual(self.refs.captured, [['1', '2']], 'fronts captured once')
        self.assertEqual({tuple(e['steps']) for e in again['buildings'].values()}, {()})
        # half-finished work resumes exactly where it stopped: a draft without a review is rendered and reviewed
        b = self.paths.building('2')
        b.review.unlink()
        for image in b.renders.iterdir():
            image.unlink()
        self.model.script('review', READY)
        third = self.run_author(['2'])
        self.assertEqual(third['buildings']['2']['steps'], ['render initial', 'review 0'])
        self.assertEqual(self.model.roles(), {'author': 2, 'review': 3})

    def test_dry_run_plans_without_calling_anything(self):
        self.model.script('author', response(BP))
        result = self.run_author(['1', '2'], dry_run=True)
        self.assertEqual(self.model.calls, [])
        self.assertEqual(self.refs.captured, [])
        self.assertEqual(FakeBatch.captures, [])
        self.assertEqual(result['buildings']['1'], {'status': 'unreferenced', 'steps': [], 'next': 'references'})
        self.assertTrue(result['dry_run'])

    def test_failed_author_call_leaves_status_failed_and_is_retried_only_when_asked(self):
        # no script: every author call fails; ATTEMPTS tries, then terminal
        result = self.run_author(['1'])
        self.assertEqual(self.model.roles(), {'author': author.ATTEMPTS})
        record = read_json(self.paths.building('1').author)
        self.assertTrue(record['terminal'])
        self.assertEqual(record['error'], 'codex exited 1')
        self.assertEqual(len(record['attempts']), author.ATTEMPTS - 1)
        self.assertEqual(self.status('1'), 'failed')
        self.assertEqual(result['buildings']['1']['status'], 'failed')
        self.assertIn('author call failed', result['buildings']['1']['error'])
        self.assertFalse(self.paths.building('1').draft.exists())
        second = self.run_author(['1'])
        self.assertEqual(self.model.roles(), {'author': author.ATTEMPTS}, 'a failed building is not retried by default')
        self.assertEqual(second['skipped'], {'1': 'failed'})
        self.model.script('author', response(BP)).script('review', READY)
        third = self.run_author(['1'], reauthor=['1'])
        self.assertEqual(self.model.roles(), {'author': author.ATTEMPTS + 1, 'review': 1})
        self.assertEqual(third['buildings']['1']['status'], 'reviewed')
        self.assertFalse(read_json(self.paths.building('1').author).get('terminal'))

    def test_transient_failure_is_retried_within_the_run(self):
        self.model.script('author', Exception(model.TIMEOUT_ERROR), response(BP)).script('review', READY)
        result = self.run_author(['1'])
        self.assertEqual(self.model.roles(), {'author': 2, 'review': 1})
        self.assertEqual(result['buildings']['1']['status'], 'reviewed')
        self.assertEqual([a['error'] for a in read_json(self.paths.building('1').author)['attempts']], [model.TIMEOUT_ERROR])

    def test_repairs_stop_at_max_and_record_forced_publication(self):
        self.model.script('author', response(BP))
        self.model.script('review', REPAIR, REPAIR, REPAIR)
        self.model.script('repair', response(BP2), response(BP))
        result = self.run_author(['1'])
        self.assertEqual(self.model.roles(), {'author': 1, 'review': MAX_REPAIRS + 1, 'repair': MAX_REPAIRS})
        self.assertEqual(result['buildings']['1']['steps'],
                         ['references', 'author 0', 'render initial', 'review 0', 'repair 1', 'render repaired', 'review 1',
                          'repair 2', 'render repaired-2', 'review 2'])
        b = self.paths.building('1')
        self.assertTrue(b.repair(1).is_file() and b.repair(2).is_file())
        self.assertEqual(read_json(b.repair(1))['base_hash'], fingerprint(BP))
        self.assertEqual(read_json(b.repair(2))['base_hash'], fingerprint(BP2))
        self.assertEqual(read_json(b.draft), BP)
        review = read_json(b.review)
        self.assertEqual((review['passed'], review['repairs'], review['repairs_exhausted']), (False, MAX_REPAIRS, True))
        self.assertEqual(self.status('1'), 'reviewed', 'exhausted repairs derive to reviewed')
        # the second repair saw the first repair's renders and the current review
        second = [c for c in self.model.calls if c['role'] == 'repair'][1]
        self.assertIn(f'REPAIR PASS 2 OF {MAX_REPAIRS}', second['prompt'])
        self.assertIn('"base_hash":"' + fingerprint(BP2) + '","operations"', second['prompt'])
        self.assertIn('"review":{"verdict":"repair"', second['prompt'])
        self.assertEqual([Path(p).name for p in second['images']], ['reference-1.jpg', 'repaired-overview.png', 'repaired-faces.jpg'])
        # a fresh run has nothing left to do for it
        self.assertEqual(self.run_author(['1'])['buildings']['1']['steps'], [])
        self.assertEqual(self.model.roles(), {'author': 1, 'review': MAX_REPAIRS + 1, 'repair': MAX_REPAIRS})
        # policy: recorded, refused without --force, accepted with it as a forced publication
        with self.assertRaisesRegex(ValueError, 'forced publication'):
            author.accept(self.paths, ['1'], out=lambda *a: None)
        self.assertEqual(read_json(self.paths.overrides)['blueprints'], {})
        self.assertEqual(author.accept(self.paths, ['1'], force=True, out=lambda *a: None), ['1'])
        entry = read_json(self.paths.overrides)['miniature_review']['1']
        self.assertEqual(entry['status'], 'needs-attention')
        publication = entry['publication']
        self.assertEqual((publication['forced'], publication['reason'], publication['repair_attempts'], publication['repair_limit']),
                         (True, 'repair-limit-reached', MAX_REPAIRS, MAX_REPAIRS))
        self.assertEqual(publication['inspection']['building']['verdict'], 'repair')
        self.assertEqual(publication['blueprint_hash'], fingerprint(BP))

    def test_invalid_author_response_goes_straight_to_repair(self):
        self.model.script('author', response(BAD)).script('repair', response(BP)).script('review', READY)
        result = self.run_author(['1'])
        self.assertEqual(result['buildings']['1']['steps'], ['references', 'author 0', 'repair 1', 'render repaired', 'review 1'])
        record = read_json(self.paths.building('1').author)
        self.assertEqual(record['blueprint'], BAD)
        self.assertTrue(record['validation_errors'])
        self.assertNotIn('draft_hash', record)
        repair = [c for c in self.model.calls if c['role'] == 'repair'][0]
        self.assertIn('generic fallback, not this draft', repair['prompt'])
        self.assertIn('"validation_errors":["', repair['prompt'])
        self.assertIn('"base_hash":"' + fingerprint(BAD) + '"', repair['prompt'])
        self.assertEqual(read_json(self.paths.building('1').draft), BP)
        self.assertEqual(result['buildings']['1']['status'], 'reviewed')

    def test_patch_responses_apply_to_the_hash_bound_candidate(self):
        ops = [{'op': 'replace', 'path': '/volumes/@main/height', 'value': 7}]
        self.model.script('author', response(BP)).script('review', REPAIR, READY)
        self.model.script('repair', response(patch_ops=ops, base=BP))
        self.run_author(['1'])
        self.assertEqual(read_json(self.paths.building('1').draft)['volumes'][0]['height'], 7)
        self.assertEqual(self.status('1'), 'reviewed')

    def test_lint_only_review_when_building_review_is_off(self):
        self.model.script('author', response(BP))
        result = self.run_author(['1'], building_review=False)
        self.assertEqual(self.model.roles(), {'author': 1})
        review = read_json(self.paths.building('1').review)
        self.assertEqual((review['passed'], review['report'], review['model']), (True, None, None))
        self.assertEqual(result['buildings']['1']['status'], 'reviewed')

    def test_renderer_change_invalidates_renders_and_reviews(self):
        self.model.script('author', response(BP)).script('review', READY)
        self.run_author(['1'])
        FakeBatch.signature = 'renderer-2'
        run = author.Run(self.paths, ['1'], log=lambda t: None)
        run.select()
        self.assertEqual(run.plan('1'), ('render', 'initial'))
        with self.assertRaisesRegex(ValueError, 'predates the current renderer'):
            author.accept(self.paths, ['1'], out=lambda *a: None)
        self.model.script('review', READY)
        result = self.run_author(['1'])
        self.assertEqual(result['buildings']['1']['steps'], ['render initial', 'review 0'])
        self.assertEqual(self.model.roles(), {'author': 1, 'review': 2})
        self.assertEqual(read_json(self.paths.building('1').review)['renderer_signature'], 'renderer-2')

    def test_budget_exhaustion_stops_admitting_calls_and_the_run_resumes(self):
        self.model.usage = 60_000
        self.model.script('author', response(BP), response(BP2)).script('review', READY, READY)
        result = self.run_author(['1', '2'], max_tokens=100_000)
        self.assertEqual(self.model.roles(), {'author': 1, 'review': 1}, 'the third call is never admitted')
        self.assertIn('budget', result['stopped'])
        self.assertEqual(result['budget']['tokens'], 120_000)
        self.assertEqual((self.status('1'), self.status('2')), ('reviewed', 'referenced'))
        self.assertEqual(result['buildings']['2']['steps'], ['references', 'author 0'], 'stopped before the call was admitted')
        self.assertFalse(self.paths.building('2').author.exists(), 'nothing recorded for a call that never ran')
        self.model.usage = 1000
        again = self.run_author(['1', '2'])
        self.assertIsNone(again['stopped'])
        self.assertEqual(self.model.roles(), {'author': 2, 'review': 2})
        self.assertEqual({self.status('1'), self.status('2')}, {'reviewed'})

    def test_parallel_workers_share_one_budget_and_one_render_lock(self):
        self.model.script('author', response(BP), response(BP2)).script('review', READY, READY)
        result = self.run_author(['1', '2'], workers=2, max_tokens=50_000)
        self.assertEqual(self.model.roles(), {'author': 2, 'review': 2})
        self.assertEqual(result['counts'], {'reviewed': 2})
        self.assertEqual(result['budget']['calls'], 4)

    def test_scene_critique_sends_failures_back_for_repair(self):
        scene_first = {'summary': 'one wrong entrance', 'buildings': [
            {'id': '1', 'verdict': 'needs-attention', 'summary': 'mirrored wing', 'orientation': {'status': 'incorrect', 'summary': 'x'}},
            {'id': '2', 'verdict': 'ready', 'summary': 'fine', 'orientation': {'status': 'correct', 'summary': 'ok'}}]}
        scene_second = {'summary': 'all good', 'buildings': [
            {'id': '1', 'verdict': 'ready', 'summary': 'fixed', 'orientation': {'status': 'correct', 'summary': 'ok'}},
            {'id': '2', 'verdict': 'ready', 'summary': 'fine', 'orientation': {'status': 'correct', 'summary': 'ok'}}]}
        self.model.script('author', response(BP), response(BP2)).script('review', READY, READY, READY)
        self.model.script('repair', response(BP2)).script('scene-review', scene_first, scene_second)
        result = self.run_author(['1', '2'], scene_review=True)
        self.assertEqual(self.model.roles(), {'author': 2, 'review': 3, 'repair': 1, 'scene-review': 2})
        self.assertEqual(result['buildings']['1']['steps'][-3:], ['repair 1', 'render repaired', 'review 1'])
        self.assertEqual(result['buildings']['2']['steps'], ['references', 'author 0', 'render initial', 'review 0'])
        one = read_json(self.paths.building('1').review)
        self.assertEqual(one['scene_review']['verdict'], 'ready')
        self.assertEqual(one['scene_review']['draft_hash'], fingerprint(BP2))
        repair = next(c for c in self.model.calls if c['role'] == 'repair')
        self.assertIn('"previous_scene_review":{"id":"1","verdict":"needs-attention"', repair['prompt'])
        self.assertEqual(result['counts'], {'reviewed': 2})
        self.assertTrue(FakeBrowser.urls and 'bp=1,2' in FakeBrowser.urls[0])
        scene_call = next(c for c in self.model.calls if c['role'] == 'scene-review')
        self.assertEqual([Path(p).name for p in scene_call['images']], ['scene.png', 'initial-faces.jpg', 'initial-faces.jpg'])
        self.assertTrue(scene_call['prompt'].startswith(author.SCENE_TASK))
        # a third run has the same drafts: no further critique
        self.run_author(['1', '2'], scene_review=True)
        self.assertEqual(self.model.roles()['scene-review'], 2)

    def test_baseline_comparison_keeps_the_existing_model_when_not_approved(self):
        self.accept_site('1', BP)
        self.assertEqual(self.status('1'), 'accepted')
        self.assertEqual(self.run_author(['1'])['skipped'], {'1': 'accepted'}, 'accepted buildings are left alone')
        self.model.script('author', response(patch_ops=[{'op': 'replace', 'path': '/volumes/@main/height', 'value': 6}], base=BP))
        self.model.script('review', READY, READY, READY)
        self.model.script('baseline-comparison', {'verdict': 'rejected', 'reason': 'lost the mural'},
                          {'verdict': 'rejected', 'reason': 'still plainer'}, {'verdict': 'rejected', 'reason': 'no'})
        self.model.script('repair', response(BP3), response(BP4))
        result = self.run_author(['1'], reauthor=['1'], accept=True)
        prompt = self.model.calls[0]['prompt']
        self.assertIn('PUBLISHED PRODUCTION BASELINE', prompt)
        self.assertIn('REFINEMENT: prefer a small patch', prompt)
        self.assertNotIn('Keep blueprint under 3500', prompt)
        self.assertEqual(self.model.roles(), {'author': 1, 'review': 3, 'repair': 2, 'baseline-comparison': 3})
        comparison = read_json(author.comparison_path(self.paths.building('1')))
        self.assertEqual((comparison['verdict'], comparison['baseline_hash'], comparison['candidate_hash'], comparison['reviewer']),
                         ('rejected', fingerprint(BP), fingerprint(BP4), 'sol'))
        self.assertEqual(read_json(self.paths.building('1').draft), BP4)
        self.assertEqual(self.status('1'), 'reviewed')
        exhausted = read_json(self.paths.building('1').review)
        self.assertTrue(exhausted['repairs_exhausted'] and exhausted['baseline_rejected'] and exhausted['passed'])
        first_repair = next(c for c in self.model.calls if c['role'] == 'repair')
        self.assertIn('lost the mural', first_repair['prompt'], 'the rejection reason drives the repair')
        self.assertEqual(len(comparison['baseline_views']), 2)
        self.assertTrue(any(no_bp and phase == 'production-baseline' for _, phase, _, _, no_bp in FakeBatch.captures))
        self.assertEqual(read_json(self.paths.overrides)['blueprints']['1'], BP, 'the accepted model stays')
        self.assertEqual(result['accepted'], [])
        self.assertTrue(result['refused'] and 'not approved' in result['refused'][0])
        with self.assertRaisesRegex(ValueError, 'not approved'):
            author.accept(self.paths, ['1'], out=lambda *a: None)
        self.assertEqual(self.build_calls, [])

    def test_approved_comparison_replaces_the_baseline(self):
        self.accept_site('1', BP)
        self.model.script('author', response(BP2)).script('review', READY)
        self.model.script('baseline-comparison', {'verdict': 'approved', 'reason': 'kept everything, better roof'})
        result = self.run_author(['1'], reauthor=['1'], accept=True)
        self.assertEqual(result['accepted'], ['1'])
        ov = read_json(self.paths.overrides)
        self.assertEqual(ov['blueprints']['1'], BP2)
        self.assertEqual(ov['miniature_review']['1']['status'], 'ready')
        self.assertEqual(ov['miniature_review']['1']['publication']['inspection']['baseline_comparison']['verdict'], 'approved')


class Accepting(Fixture):
    def reviewed(self, bid, bp=BP, passed=True):
        """Files for a building whose draft was reviewed with the current renderer."""
        b = self.paths.building(bid)
        atomic_json(b.draft, bp)
        atomic_json(b.author, {'role': 'author', 'number': 0, 'run': 'run-' + bid, 'blueprint': bp, 'validation_errors': [],
                               'response': {}, 'usage': {'total_tokens': 1}, 'error': None})
        frame = building_frame(self.site, building(bid, 0 if bid == '1' else 30))
        author.write_review(self.paths, bid, bp, READY if passed else REPAIR, renderer_signature=FakeBatch.signature,
                            model='sol', frame=frame)

    def test_accept_refuses_lint_errors_and_missing_reviews_without_changing_anything(self):
        self.reviewed('1', BAD)
        before = self.paths.overrides.read_bytes()
        with self.assertRaisesRegex(ValueError, 'lint'):
            author.accept(self.paths, ['1'], out=lambda *a: None)
        atomic_json(self.paths.building('2').draft, BP)
        with self.assertRaisesRegex(ValueError, 'visual review not recorded'):
            author.accept(self.paths, ['2'], out=lambda *a: None)
        with self.assertRaisesRegex(ValueError, 'no draft.json'):
            author.accept(self.paths, ['3'], out=lambda *a: None)
        self.assertEqual(self.paths.overrides.read_bytes(), before)
        self.assertEqual(self.build_calls, [])
        # --force accepts the unreviewed draft, never the lint failure
        self.assertEqual(author.accept(self.paths, ['2'], force=True, out=lambda *a: None), ['2'])
        entry = read_json(self.paths.overrides)['miniature_review']['2']
        self.assertEqual((entry['status'], entry['publication']['forced'], entry['publication']['reason']),
                         ('needs-attention', True, 'operator-forced'))
        with self.assertRaisesRegex(ValueError, 'lint'):
            author.accept(self.paths, ['1'], force=True, out=lambda *a: None)

    def test_accept_refuses_a_failed_review_with_repairs_remaining(self):
        self.reviewed('1', BP, passed=False)
        self.assertEqual(self.status('1'), 'needs-repair')
        with self.assertRaisesRegex(ValueError, 'repair rounds remain'):
            author.accept(self.paths, ['1'], out=lambda *a: None)

    def test_accept_is_idempotent_and_writes_the_committed_overrides_shape(self):
        self.reviewed('1')
        self.reviewed('2', BP2)
        self.assertEqual(author.accept(self.paths, ['1', '2'], out=lambda *a: None), ['1', '2'])
        ov = read_json(self.paths.overrides)
        self.assertEqual(ov['title'], 'Trial', 'other keys survive')
        self.assertEqual(ov['blueprints'], {'1': BP, '2': BP2})
        self.assertEqual(set(ov['blueprint_frames']), {'1', '2'})
        entry = ov['miniature_review']['1']
        self.assertEqual(set(entry), {'status', 'run', 'publication'})
        self.assertEqual((entry['status'], entry['run']), ('ready', 'run-1'))
        self.assertEqual(set(entry['publication']), {'published', 'forced', 'policy', 'reason', 'inspection_passed',
                                                     'inspection_status', 'repair_attempts', 'repair_limit', 'retroactive',
                                                     'published_at', 'run', 'blueprint_hash', 'inspection'})
        self.assertEqual(set(entry['publication']['inspection']), {'building', 'scene', 'baseline_comparison', 'validation_errors'})
        self.assertTrue(self.paths.overrides.read_text().startswith('{"title":"Trial","blueprints":{'), 'compact like the committed files')
        self.assertEqual(len(self.build_calls), 1)
        before = self.paths.overrides.read_bytes()
        self.assertEqual(author.accept(self.paths, ['1', '2'], out=lambda *a: None), ['1', '2'])
        self.assertEqual(self.paths.overrides.read_bytes(), before, 'identical drafts change nothing')
        self.assertEqual(len(self.build_calls), 1, 'no rebuild when nothing changed')
        self.assertEqual(author.accept(self.paths, ['1'], rebuild=False, out=lambda *a: None), ['1'])
        self.assertEqual(author.reviewed_ids(self.paths), [])

    def test_accept_all_reviewed_and_cli_wiring(self):
        self.reviewed('1')
        self.assertEqual(author.reviewed_ids(self.paths), ['1'])
        parser = cli.build_parser({'author', 'accept'})
        args = parser.parse_args(['accept', '--no-rebuild', 'trial', '--all-reviewed'])
        self.assertEqual((args.ids, args.all_reviewed, args.rebuild, args.force), ([], True, False, False))
        with patch.object(author, 'site_paths', return_value=self.paths):
            self.assertEqual(args.run(args), 0)
        self.assertIn('accepted 1 blueprint(s): 1', self.out.getvalue())
        self.assertEqual(self.build_calls, [])
        args = parser.parse_args(['author', 'trial', '--dry-run', '1', '2', '--reauthor', '1', '--no-scene-review',
                                  '--max-web-images', '0', '--capture', 'reuse-only'])
        self.assertEqual((args.ids, args.reauthor, args.scene_review, args.capture), (['1', '2'], ['1'], False, 'reuse-only'))
        with patch.object(author, 'site_paths', return_value=self.paths):
            self.assertEqual(args.run(args), 0)
        self.assertEqual(self.model.calls, [])
        self.assertIn('accepted      1  next: references', self.out.getvalue(), 'a re-authored building needs its packet first')
        self.assertIn('unreferenced  2  next: references', self.out.getvalue())
        with self.assertRaises(SystemExit):
            parser.parse_args(['author', 'trial', '--reasoning-effort', 'xhigh'])


if __name__ == '__main__':
    unittest.main()
