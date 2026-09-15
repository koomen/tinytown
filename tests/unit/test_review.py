"""tinytown.review: blueprint lint, geometry audit, render evidence, review records, repair policy."""
import contextlib
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tinytown import review
from tinytown.paths import SitePaths
from tinytown.review import (MAX_REPAIRS, audit_geometry, completed_repairs, lint_blueprint, needs_repair,
                             publication_record, read_review, repair_phase, reset_scene, review_errors,
                             review_record, scene_repairs, write_review)
from tinytown.state import atomic_json, building_frame, building_status, fingerprint


def building(bid, x=0, tags=None):
    return {'id': bid, 'centroid': [x, 0], 'pts': [[x - 10, -4], [x + 10, -4], [x + 10, 4], [x - 10, 4]],
            'obb': {'cx': x, 'cz': 0, 'w': 20, 'd': 8, 'angle': 0}, 'area': 160, 'tags': tags or {},
            'style': {'kind': 'house'}}


SQUARE = {'obb': {'cx': 0, 'cz': 0, 'angle': 0, 'w': 12, 'd': 12}, 'pts': [[-6, -6], [6, -6], [6, 6], [-6, 6]]}


# --- lint ---------------------------------------------------------------------

class LintBasics(unittest.TestCase):
    b = {"id": 1, "obb": {"cx": 0, "cz": 0, "angle": 0, "w": 10, "d": 8},
         "pts": [[-5, -4], [5, -4], [5, 4], [-5, 4]], "area": 80, "front": {"dir": 0}, "style": {"kind": "garage"}}
    bp = {"volumes": [{"id": "main", "u": [-5, 5], "v": [-4, 4], "height": 6}]}

    def test_clean_blueprint_has_no_findings(self):
        L = lint_blueprint(self.bp, self.b, 'test')
        self.assertEqual((L.errors, L.warnings, L.label), ([], [], 'test'))

    def test_invalid_custom_outlines_and_subdivisions_fail_before_render(self):
        for spec in ({'parapets': [{'outline': [[-.5, 0], [.5, 1], [-.5, 1], [.5, 0]]}]},
                     {'storeys': [{'y': 1, 'windows': {'at': [.5], 'divisions': {'vertical': [.8, .2]}}}]}):
            bp = copy.deepcopy(self.bp); bp['volumes'][0]['faces'] = {'-v': spec}
            self.assertTrue(lint_blueprint(bp, self.b, '1').errors)

    def test_error_and_warning_texts_are_preserved(self):
        bp = {'wall': 'mauve', 'volumes': [{'id': 'main', 'u': [5, -5], 'v': [-4, 4], 'height': 6, 'colour': 1}]}
        L = lint_blueprint(bp, self.b, 'x')
        self.assertIn("top.wall: colour `mauve` is neither #rrggbb nor a swatch (" + ', '.join(sorted(review.SWATCHES)) + ")", L.errors)
        self.assertIn("volumes[0](main): `u` = [5, -5] must be [lo, hi] with lo < hi", L.errors)
        self.assertTrue(any(w.startswith("volumes[0](main): unknown key `colour` (schema volume has: ") for w in L.warnings))
        L = lint_blueprint({'volumes': []}, self.b, 'x')
        self.assertEqual(L.errors, ["top: `volumes` must be a non-empty list"])
        L = lint_blueprint({'volumes': [{'u': [-5, 5], 'v': [-4, 4], 'height': 6, 'faces': {'north': {}}}]}, self.b, 'x')
        self.assertEqual(L.errors, ["volumes[0].faces: face `north` not one of +u, -u, +v, -v, default"])

    def test_non_finite_numbers_and_non_objects_are_errors(self):
        self.assertEqual(lint_blueprint({'volumes': [{'height': float('nan')}]}, self.b, 'x').errors,
                         ['top.volumes[0].height: non-finite number'])
        self.assertEqual(lint_blueprint([1], self.b, 'x').errors, ['top: blueprint must be a JSON object'])

    def test_footprint_coverage_and_protrusion_warnings(self):
        bp = {'volumes': [{'id': 'main', 'u': [-2, 2], 'v': [-1, 1], 'height': 6}]}
        warnings = lint_blueprint(bp, self.b, 'x').warnings
        self.assertTrue(any('volumes cover only' in w for w in warnings), warnings)
        bp = {'volumes': [{'id': 'main', 'u': [-5, 5], 'v': [-4, 4], 'height': 6},
                          {'id': 'annex', 'u': [-5, 5], 'v': [4, 12], 'height': 4}]}
        warnings = lint_blueprint(bp, self.b, 'x').warnings
        self.assertTrue(any('sticks out of the footprint box' in w for w in warnings), warnings)
        bp['volumes'][1]['id'] = 'porch'
        self.assertFalse(any('sticks out' in w for w in lint_blueprint(bp, self.b, 'x').warnings))

    def test_open_pavilion_has_no_enclosing_building_volumes(self):
        b = {'id': 1, 'obb': {'cx': 0, 'cz': 0, 'angle': 0, 'w': 12, 'd': 10}, 'pts': [[-6, -5], [6, -5], [6, 5], [-6, 5]]}
        blueprint = {'pavilion': {'height': 3.1, 'pitch': .43, 'bents': 3, 'furniture': True}, 'volumes': []}
        self.assertEqual(lint_blueprint(blueprint, b, 'x').errors, [])
        self.assertTrue(lint_blueprint({**blueprint, 'volumes': [{'id': 'enclosure', 'u': [-6, 6], 'v': [-5, 5], 'height': 3}]}, b, 'x').errors)
        self.assertTrue(lint_blueprint({**blueprint, 'bridge': {'type': 'steel-girder'}}, b, 'x').errors)

    def test_kit_validation_rejects_custom_profiles_and_invalid_dimensions(self):
        b = {'id': '1', 'obb': {'w': 10, 'd': 10}, 'pts': []}
        self.assertTrue(lint_blueprint({'volumes': []}, b, 'x').errors)
        self.assertTrue(lint_blueprint({'volumes': [{'profile': []}]}, b, 'x').errors)

    def test_point_in_poly(self):
        poly = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        self.assertTrue(review._point_in_poly(poly, 0, 0))
        self.assertFalse(review._point_in_poly(poly, 2, 0))


class ArcadeSchemaTests(unittest.TestCase):
    def setUp(self):
        self.building = SQUARE
        self.blueprint = {'volumes': [{'u': [-6, 6], 'v': [-6, 6], 'height': 8, 'faces': {'+u': {'arcade': {'at': [.25, .5, .75], 'w': 2, 'h': 5, 'y': .5, 'depth': 2, 'door': {'type': 'double', 'w': 1.4, 'h': 2.5}}}}}]}

    def test_valid_arcade(self):
        self.assertEqual(lint_blueprint(self.blueprint, self.building, 'test').errors, [])

    def test_rejects_impossible_or_overlapping_recesses(self):
        for change in [{'at': [.1, .2]}, {'at': [0]}, {'depth': 12}, {'w': float('nan')}, {'h': 10}, {'y': -2}, {'door': {'w': 3}}, {'door': {'steps': 2}}]:
            with self.subTest(change=change):
                bp = copy.deepcopy(self.blueprint)
                bp['volumes'][0]['faces']['+u']['arcade'].update(change)
                self.assertTrue(lint_blueprint(bp, self.building, 'test').errors)

    def test_rejects_masonry_bands_across_openings(self):
        for change in [{'plinth': {'height': 1}}, {'beltCourses': [{'y': 4, 'height': .2}]}, {'upperWall': 'white'}]:
            with self.subTest(change=change):
                bp = copy.deepcopy(self.blueprint)
                bp['volumes'][0].update(change)
                self.assertTrue(lint_blueprint(bp, self.building, 'test').errors)

    def test_rejects_multiple_arcade_faces(self):
        bp = copy.deepcopy(self.blueprint)
        bp['volumes'][0]['faces']['-u'] = copy.deepcopy(bp['volumes'][0]['faces']['+u'])
        self.assertTrue(lint_blueprint(bp, self.building, 'test').errors)


class AwningSchemaTests(unittest.TestCase):
    def setUp(self):
        self.building = SQUARE
        self.blueprint = {'volumes': [{'u': [-6, 6], 'v': [-6, 6], 'height': 8, 'faces': {'+u': {'awnings': [{'type': 'barrel', 'range': [.3, .7], 'y': 3.8, 'depth': 3, 'rise': 2.2, 'color': '#782b3c', 'trim': '#f4e4ca', 'posts': True, 'brand': 'athenaeum-hotel'}]}}}]}

    def test_accepts_curved_and_existing_sloped_awnings(self):
        self.assertEqual(lint_blueprint(self.blueprint, self.building, 'test').errors, [])
        self.blueprint['volumes'][0]['faces']['+u']['awnings'] = [{'range': [.3, .7], 'depth': 1.5, 'color': 'navy'}]
        self.assertEqual(lint_blueprint(self.blueprint, self.building, 'test').errors, [])

    def test_rejects_invalid_curved_awnings(self):
        for change in [{'type': 'dome'}, {'rise': -1}, {'rise': float('nan')}, {'depth': 0}, {'depth': '3'}, {'posts': 'yes'}, {'brand': 'missing-crest'}]:
            with self.subTest(change=change):
                bp = copy.deepcopy(self.blueprint)
                bp['volumes'][0]['faces']['+u']['awnings'][0].update(change)
                self.assertTrue(lint_blueprint(bp, self.building, 'test').errors)


class PavilionStairs(unittest.TestCase):
    building = {'id': 820060447, 'obb': {'w': 28.572, 'd': 18.703}}
    blueprint = {'volumes': [], 'pavilion': {'floorH': 2, 'railing': True, 'railingStyle': 'ornamental',
                                             'entranceStairs': {'length': 8.4, 'width': 5, 'bottomY': -2.24, 'foundationDepth': .55}}}

    def test_valid_terrain_aware_stairs(self):
        for axis in ('u', 'v'):
            for end in ('positive', 'negative'):
                bp = copy.deepcopy(self.blueprint)
                bp['pavilion'].update(axis=axis, entranceEnd=end)
                lint = lint_blueprint(bp, self.building, 'test')
                self.assertEqual(lint.errors + lint.warnings, [])

    def test_reject_invalid_or_uphill_stairs(self):
        for key, value in [('length', None), ('length', 0), ('length', float('nan')), ('width', 19), ('width', -1),
                           ('bottomY', 2), ('bottomY', float('inf')), ('foundationDepth', 0), ('railing', 'yes')]:
            with self.subTest(key=key, value=value):
                bp = copy.deepcopy(self.blueprint)
                bp['pavilion']['entranceStairs'][key] = value
                self.assertTrue(lint_blueprint(bp, self.building, 'test').errors)

    def test_reject_unknown_style_and_nonobject_stairs(self):
        for key, value in [('railingStyle', 'unknown'), ('entranceStairs', False)]:
            bp = copy.deepcopy(self.blueprint)
            bp['pavilion'][key] = value
            self.assertTrue(lint_blueprint(bp, self.building, 'test').errors)


# --- geometry audit and massing -------------------------------------------------

class GeometryAudit(unittest.TestCase):
    bp = {"volumes": [{"id": "main", "u": [-5, 5], "v": [-4, 4], "height": 6}]}

    def test_roof_caps_overlapping_windows_and_near_coplanar_walls_flagged(self):
        bp = copy.deepcopy(self.bp); v = bp['volumes'][0]
        v['roof'] = {'type': 'hip'}
        v['faces'] = {'-v': {'pilasters': {'height': 6}, 'storeys': [{'y': 1, 'windows': {'at': [.5, .51], 'w': 2, 'h': 2}}]}}
        bp['volumes'].append({**copy.deepcopy(v), 'id': 'duplicate'})
        found = audit_geometry(bp)
        for suffix in ('capital-roof', 'overlap', 'coplanar'):
            self.assertTrue(any(suffix in f['id'] for f in found), found)
        v['faces']['-v']['pilasters']['fitUnderEave'] = True
        self.assertFalse(any(f['id'] == 'main/-v/capital-roof' for f in audit_geometry(bp)))

    def test_edge_crossing_and_unsupported_raised_door(self):
        bp = copy.deepcopy(self.bp)
        bp['volumes'][0]['faces'] = {'+v': {'storeys': [{'y': 0, 'windows': {'at': [0.02], 'w': 1.2}}],
                                            'doors': [{'at': .5, 'y': 1}]}}
        ids = [f['id'] for f in audit_geometry(bp)]
        self.assertIn('main/+v/window-0-0/edge', ids)
        self.assertIn('main/+v/door-0/support', ids)
        self.assertEqual(audit_geometry(self.bp), [])

    def test_massing_signature_ignores_decoration_but_not_silhouette(self):
        base = review.massing_signature(self.bp)
        trimmed = copy.deepcopy(self.bp)
        trimmed['volumes'][0]['faces'] = {'-u': {'storeys': [{'y': 1, 'windows': {'trim': 'white'}}]}}
        self.assertEqual(review.massing_signature(trimmed), base)
        altered = copy.deepcopy(self.bp)
        altered['volumes'][0]['faces'] = {'-u': {'parapets': [{'height': 3, 'type': 'mission'}]}}
        self.assertNotEqual(review.massing_signature(altered), base)
        taller = copy.deepcopy(self.bp); taller['volumes'][0]['height'] = 7
        self.assertNotEqual(review.massing_signature(taller), base)


# --- a temporary site -----------------------------------------------------------

class SiteCase(unittest.TestCase):
    """A throwaway repo root with data/town/{site.json,overrides.json,buildings/1/draft.json}."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        (self.root / 'src').mkdir()
        (self.root / 'src' / 'town.js').write_text('// viewer fixture\n')
        self.paths = SitePaths('town', self.root)
        self.b = building('1')
        self.site = {'name': 'town', 'center': {'lat': 42, 'lon': -77}, 'buildings': [self.b, building('2', 40)],
                     'pois': [], 'areas': []}
        self.bp = {'wall': '#aa9988', 'volumes': [{'id': 'main', 'u': [-10, 10], 'v': [-4, 4], 'height': 5}]}
        atomic_json(self.paths.scene, self.site)
        atomic_json(self.paths.overrides, {'blueprints': {}})
        atomic_json(self.paths.building('1').draft, self.bp)
        self.enterContext(patch.object(review, 'renderer_signature', lambda root=None: 'renderer-v1'))

    def render(self, bid, view, bp=None, **extra):
        b = self.paths.building(bid)
        image = b.render(view)
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(b'png fixture')
        other = next(x for x in self.site['buildings'] if x['id'] != bid)
        meta = {'blueprint': fingerprint(bp or self.bp), 'frame': building_frame(self.site, self.b),
                'context': review.visual_context(self.site, self.b), 'renderer': 'renderer-v1', 'view': view,
                'stage': 'detail', 'pose': None,
                'neighbors': {other['id']: {'draft': False, 'frame': building_frame(self.site, other),
                                            'blueprint': fingerprint(other.get('blueprint'))}}}
        meta.update(extra)
        atomic_json(review.render_record(image), meta)
        return image


class RenderEvidence(SiteCase):
    def test_current_face_renders_pass_and_stale_ones_fail_closed(self):
        renders = {view: self.render('1', view) for view in review.FACE_NAMES}
        self.assertEqual(review.render_errors(self.paths, self.site, self.b, self.bp, renders, require_views=False), [])
        self.assertEqual(review.render_errors(self.paths, self.site, self.b, self.bp, renders),
                         ['review requires all four face renders and an isometric render'])
        self.assertEqual(review.render_errors(self.paths, self.site, self.b, self.bp, renders, require_views=('+u', 'iso')),
                         ['review requires renders of iso'])
        changed = {**self.bp, 'wall': '#000000'}
        errors = review.render_errors(self.paths, self.site, self.b, changed, renders, require_views=False)
        self.assertEqual(len(errors), 4)
        self.assertTrue(all(e.startswith('stale or wrong-stage render: data/town/buildings/1/renders/') for e in errors))
        self.assertTrue(review.render_errors(self.paths, self.site, self.b, self.bp, renders, stage='massing', require_views=False))
        with patch.object(review, 'renderer_signature', lambda root=None: 'renderer-v2'):
            self.assertTrue(review.render_errors(self.paths, self.site, self.b, self.bp, renders, require_views=False))

    def test_missing_images_and_changed_neighbours_are_reported(self):
        image = self.render('1', '+u')
        errors = review.render_errors(self.paths, self.site, self.b, self.bp, {'+u': image, '-u': self.paths.building('1').render('-u')}, require_views=False)
        self.assertEqual(errors, ['missing render or provenance: data/town/buildings/1/renders/-u.png'])
        self.site['buildings'][1]['blueprint'] = {'volumes': [{'id': 'new'}]}
        self.assertEqual(review.render_errors(self.paths, self.site, self.b, self.bp, {'+u': image}, require_views=False),
                         ['render neighbor changed: 2; render again'])
        self.site['buildings'].pop()
        self.assertEqual(review.render_errors(self.paths, self.site, self.b, self.bp, {'+u': image}, require_views=False),
                         ['render neighbor disappeared: 2'])

    def test_neighbour_drafts_are_read_from_their_building_directory(self):
        other = self.site['buildings'][1]
        draft = {'volumes': [{'id': 'annex', 'u': [-10, 10], 'v': [-4, 4], 'height': 4}]}
        atomic_json(self.paths.building('2').draft, draft)
        image = self.render('1', '+u', neighbors={'2': {'draft': True, 'frame': building_frame(self.site, other),
                                                        'blueprint': fingerprint(draft)}})
        self.assertEqual(review.render_errors(self.paths, self.site, self.b, self.bp, {'+u': image}, require_views=False), [])
        self.paths.building('2').draft.unlink()
        self.assertEqual(review.render_errors(self.paths, self.site, self.b, self.bp, {'+u': image}, require_views=False),
                         ['render neighbor unavailable: 2'])

    def test_report_errors_require_a_real_comparison(self):
        for view in review.VIEWS:
            self.render('1', view)
        (self.paths.building('1').dir / 'fronts').mkdir()
        (self.paths.building('1').dir / 'fronts' / '+u.png').write_bytes(b'photo')
        report = {'reviewer': 'someone', 'summary': 'compared', 'checks': dict.fromkeys(review.CHECKS, True),
                  'limitations': [], 'references': ['buildings/1/fronts/+u.png'],
                  'renders': {view: f'buildings/1/renders/{view}.png' for view in review.VIEWS}}
        self.assertEqual(review.report_errors(self.paths, self.site, self.b, self.bp, report), [])
        bad = {**report, 'summary': ' ', 'checks': {}, 'limitations': None, 'references': []}
        errors = review.report_errors(self.paths, self.site, self.b, self.bp, bad)
        for text in ("reviewer and comparison summary are required", "every visual acceptance check must pass",
                     "limitations must list uncertain or unobserved details (may be empty)",
                     "at least one reference image is required; missing imagery is unfinished research"):
            self.assertIn(text, errors)
        with self.assertRaisesRegex(ValueError, 'inside the site directory'):
            review.report_errors(self.paths, self.site, self.b, self.bp, {**report, 'references': ['../../etc/passwd']})

    def test_check_combines_lint_geometry_and_render_evidence(self):
        for view in review.FACE_NAMES:
            self.render('1', view)
        result = review.check(self.paths, '1')
        self.assertEqual(result['findings'], [])
        self.assertEqual(result['label'], 'data/town/buildings/1/draft.json')
        bad = {'volumes': [{'id': 'main', 'u': [10, -10], 'v': [-4, 4], 'height': 5}]}
        atomic_json(self.paths.building('1').draft, bad)
        result = review.check(self.paths, '1')
        self.assertTrue(result['lint'].errors)
        self.assertEqual(result['geometry'], [])
        self.assertEqual(result['findings'], result['lint'].errors + result['render_errors'])
        self.assertEqual(len(result['render_errors']), 4)
        with self.assertRaises(FileNotFoundError):
            review.check(self.paths, '2')


# --- review records and status -------------------------------------------------

class ReviewRecords(SiteCase):
    def test_write_review_binds_the_draft_and_drives_building_status(self):
        self.assertEqual(building_status(self.paths, '1'), 'drafted')
        record = write_review(self.paths, '1', self.bp, {'verdict': 'ready', 'issues': []},
                              renderer_signature='renderer-v1', model='sol', frame=building_frame(self.site, self.b))
        self.assertEqual(record['draft_hash'], fingerprint(self.bp))
        self.assertTrue(record['passed'])
        self.assertEqual(record['findings'], [])
        self.assertEqual(record['repairs'], 0)
        self.assertEqual(record['model'], 'sol')
        self.assertEqual(read_review(self.paths, '1'), record)
        self.assertEqual(building_status(self.paths, '1'), 'reviewed')
        self.assertEqual(review_errors(self.paths, self.site, self.b, self.bp), [])
        # a different draft or footprint invalidates the record
        self.assertEqual(review_errors(self.paths, self.site, self.b, {**self.bp, 'wall': '#000000'}),
                         ['visual review belongs to an older blueprint or footprint'])
        moved = {**self.b, 'obb': {**self.b['obb'], 'cx': 3}}
        self.assertEqual(review_errors(self.paths, self.site, moved, self.bp),
                         ['visual review belongs to an older blueprint or footprint'])
        with patch.object(review, 'renderer_signature', lambda root=None: 'renderer-v2'):
            self.assertEqual(review_errors(self.paths, self.site, self.b, self.bp),
                             ['visual review predates the current renderer; review again'])
        self.assertEqual(review_errors(str(self.paths.data), self.site, self.b, self.bp), [])

    def test_failed_reviews_are_kept_and_repairs_are_counted_from_files(self):
        report = {'verdict': 'repair', 'orientation': {'status': 'uncertain'},
                  'issues': [{'severity': 'major', 'problem': 'wrong face'}]}
        record = write_review(self.paths, '1', self.bp, report, renderer_signature='renderer-v1')
        self.assertFalse(record['passed'])
        self.assertTrue(needs_repair(record))
        self.assertEqual(building_status(self.paths, '1'), 'needs-repair')
        self.assertEqual(review_errors(self.paths, self.site, self.b, self.bp), ['visual review did not pass'])
        b = self.paths.building('1')
        atomic_json(b.repair(1), {})
        self.assertEqual(completed_repairs(self.paths, '1'), 1)
        self.assertEqual(building_status(self.paths, '1'), 'needs-repair')
        atomic_json(b.repair(2), {})
        self.assertEqual(completed_repairs(self.paths, '1'), MAX_REPAIRS)
        self.assertEqual(building_status(self.paths, '1'), 'reviewed')
        self.assertEqual(completed_repairs(self.paths, '2'), 0)
        # findings alone fail a review, and are what review_errors reports
        record = write_review(self.paths, '1', self.bp, None, findings=['volumes[0]: bad'], geometry=[{'id': 'a', 'finding': 'b'}])
        self.assertFalse(record['passed'])
        self.assertEqual(record['repairs'], 2)
        self.assertEqual(review_errors(self.paths, self.site, self.b, self.bp), ['volumes[0]: bad'])
        self.assertEqual(read_review(self.paths, '1')['geometry'], [{'id': 'a', 'finding': 'b'}])

    def test_rewriting_an_identical_verdict_is_a_no_op(self):
        first = write_review(self.paths, '1', self.bp, {'verdict': 'ready'}, renderer_signature='renderer-v1')
        second = write_review(self.paths, '1', self.bp, {'verdict': 'ready'}, renderer_signature='renderer-v1')
        self.assertEqual(first['timestamp'], second['timestamp'])
        third = write_review(self.paths, '1', self.bp, {'verdict': 'ready'}, renderer_signature='renderer-v2')
        self.assertNotEqual(first['timestamp'], third['timestamp'])

    def test_legacy_bare_responses_read_back_wrapped_and_never_count_as_current(self):
        legacy = {'verdict': 'repair', 'summary': 'old', 'orientation': {'status': 'uncertain'}, 'issues': []}
        atomic_json(self.paths.building('1').review, legacy)
        record = read_review(self.paths, '1')
        self.assertTrue(record['legacy'])
        self.assertIsNone(record['draft_hash'])
        self.assertFalse(record['passed'])
        self.assertEqual(record['report'], legacy)
        self.assertEqual(building_status(self.paths, '1'), 'drafted')
        self.assertEqual(review_errors(self.paths, self.site, self.b, self.bp),
                         ['visual review belongs to an older blueprint or footprint'])
        self.assertIsNone(read_review(self.paths, '2'))
        self.assertEqual(review_errors(self.paths, self.site, building('2', 40), self.bp), ['visual review not recorded'])

    def test_needs_repair_semantics(self):
        self.assertFalse(needs_repair({'review': {'verdict': 'ready', 'issues': [{'severity': 'minor'}]}}))
        self.assertTrue(needs_repair({'review': {'verdict': 'insufficient-evidence'}}))
        self.assertTrue(needs_repair({'review': {'verdict': 'ready', 'orientation': {'status': 'incorrect'}}}))
        self.assertTrue(needs_repair({'review': {'verdict': 'ready', 'issues': [{'severity': 'broken'}]}}))
        self.assertTrue(needs_repair({'validation_errors': ['rejected last patch']}))
        self.assertTrue(needs_repair({'scene_repair_requested': True}))
        self.assertFalse(needs_repair({'passed': True}))
        self.assertTrue(needs_repair({'passed': True, 'scene_repair_requested': True}))
        self.assertFalse(needs_repair(None))
        self.assertEqual([repair_phase(n) for n in (0, 1, 2)], ['initial', 'repaired', 'repaired-2'])
        self.assertEqual(repair_phase(2, queue_pass=3), 'repaired-pass-3-2')


class PublicationPolicy(SiteCase):
    def test_failed_inspection_requires_two_repairs_and_is_never_relabelled_ready(self):
        st = {'status': 'needs-attention', 'review': {'verdict': 'repair'}, 'validation_errors': ['rejected last patch']}
        bp = {'volumes': [{'id': 'main'}]}
        before = copy.deepcopy(st)
        self.assertIsNone(publication_record(st, bp, 'run', {'verdict': 'needs-attention'}, 1))
        record = publication_record(st, bp, 'run', {'verdict': 'needs-attention'}, 2)
        self.assertEqual(st, before)
        self.assertTrue(record['published']); self.assertTrue(record['forced'])
        self.assertFalse(record['inspection_passed'])
        self.assertEqual(record['reason'], 'repair-limit-reached')
        self.assertEqual(record['inspection']['validation_errors'], st['validation_errors'])
        self.assertEqual(record['inspection']['scene'], {'verdict': 'needs-attention'})
        self.assertEqual(record['blueprint_hash'], fingerprint(bp))
        ready = publication_record({'status': 'ready', 'review': {'verdict': 'ready'}}, bp, 'run', None, 0)
        self.assertEqual((ready['forced'], ready['reason'], ready['repair_attempts']), (False, 'inspection-passed', 0))
        st['publication'] = record
        self.assertEqual(review_record(st, 'run'), {'status': 'needs-attention', 'run': 'run', 'publication': record})
        self.assertEqual(review_record({'status': 'ready'}, 'run'), {'status': 'ready', 'run': 'run'})

    def test_scene_repairs_mark_buildings_with_rounds_left_and_reset_the_scene(self):
        atomic_json(self.paths.building('2').draft, self.bp)
        write_review(self.paths, '1', self.bp, {'verdict': 'ready'}, renderer_signature='renderer-v1')
        write_review(self.paths, '2', self.bp, {'verdict': 'ready'}, renderer_signature='renderer-v1')
        for n in (1, 2):
            atomic_json(self.paths.building('2').repair(n), {})
        state = {'scene_review': {'buildings': [{'id': '1', 'verdict': 'ready', 'orientation': {'status': 'uncertain'}},
                                                {'id': '2', 'verdict': 'needs-attention'}]}}
        self.assertEqual(scene_repairs(self.paths, state), ['1'])
        record = read_review(self.paths, '1')
        self.assertFalse(record['passed'])
        self.assertTrue(record['scene_repair_requested'])
        self.assertEqual(record['followup_review'], state['scene_review_history'][0]['buildings'][0])
        self.assertIn(review.SCENE_FINDING, record['findings'])
        self.assertEqual(building_status(self.paths, '1'), 'needs-repair')
        self.assertTrue(read_review(self.paths, '2')['passed'])  # repairs exhausted: left alone
        self.assertNotIn('scene_review', state)
        self.assertEqual(state['scene_generation'], 1)
        # nothing to repair: the scene is kept
        state = {'scene_review': {'buildings': [{'id': '2', 'verdict': 'needs-attention'}]}, 'queue_scene_captured': True}
        self.assertEqual(scene_repairs(self.paths, state), [])
        self.assertIn('scene_review', state)
        reset_scene(state)
        self.assertEqual((state.get('scene_review'), state.get('queue_scene_captured'), state['scene_generation']), (None, None, 1))
        self.assertEqual(len(state['scene_review_history']), 1)

    def test_scene_repairs_create_a_record_for_unreviewed_buildings(self):
        state = {'scene_review': {'buildings': [{'id': '1', 'verdict': 'needs-attention'}, {'id': '2', 'verdict': 'needs-attention'}]}}
        self.assertEqual(scene_repairs(self.paths, state), ['1'])  # 2 has no draft
        record = read_review(self.paths, '1')
        self.assertEqual(record['draft_hash'], fingerprint(self.bp))
        self.assertEqual(building_status(self.paths, '1'), 'needs-repair')


# --- CLI --------------------------------------------------------------------------

class Verbs(SiteCase):
    def run_town(self, *argv):
        from tinytown.cli import main
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(list(argv))
        return code, out.getvalue()

    def test_lint_drafts_and_merged_blueprints(self):
        data = str(self.paths.data)
        code, out = self.run_town('lint', data)
        self.assertEqual((code, out), (0, 'data/town/buildings/1/draft.json: 0 error(s), 0 warning(s)\n'))
        code, out = self.run_town('lint', data, '-q')
        self.assertEqual((code, out), (0, ''))
        atomic_json(self.paths.building('1').draft, {'volumes': [{'id': 'main', 'u': [10, -10], 'v': [-4, 4], 'height': 5}]})
        code, out = self.run_town('lint', data, '1', '-q')
        self.assertEqual(code, 1)
        self.assertIn('data/town/buildings/1/draft.json: 1 error(s), 0 warning(s)\n  ERROR   volumes[0](main): `u` = [10, -10] must be [lo, hi] with lo < hi', out)
        atomic_json(self.paths.overrides, {'blueprints': {'1': self.bp, '2': {'volumes': []}, '9': self.bp}})
        code, out = self.run_town('lint', data, '--merged', '-q')
        self.assertEqual(code, 1)
        self.assertIn('overrides.json#2: 1 error(s), 0 warning(s)', out)
        self.assertIn("overrides.json#9: ERROR 'no building 9 in site.json'", out)
        self.assertNotIn('overrides.json#1:', out)
        code, out = self.run_town('lint', data, '1', '--merged', '-q')
        self.assertEqual((code, out), (0, ''))
        extra = self.root / 'candidate.json'
        extra.write_text(json.dumps(self.bp))
        self.assertEqual(self.run_town('lint', data, '--file', str(extra), '--id', '1', '-q')[0], 0)
        self.assertEqual(self.run_town('lint', data, '--file', str(extra))[0], 2)
        atomic_json(self.paths.overrides, {})
        self.assertEqual(self.run_town('lint', data, '--merged'), (0, 'nothing to lint\n'))

    def test_review_prints_findings_and_records_only_on_request(self):
        data = str(self.paths.data)
        code, out = self.run_town('review', data, '1')
        self.assertEqual(code, 1)
        self.assertIn('4 render issue(s)', out)
        self.assertIn('ERROR   missing render or provenance: data/town/buildings/1/renders/+u.png', out)
        self.assertFalse(self.paths.building('1').review.exists())
        for view in review.FACE_NAMES:
            self.render('1', view)
        code, out = self.run_town('review', data, '1', '--record')
        self.assertEqual(code, 0)
        self.assertIn('recorded data/town/buildings/1/review.json', out)
        record = read_review(self.paths, '1')
        self.assertEqual((record['passed'], record['renderer_signature'], record['frame'], record['report']),
                         (True, 'renderer-v1', building_frame(self.site, self.b), None))
        self.assertEqual(building_status(self.paths, '1'), 'reviewed')
        self.assertEqual(self.run_town('review', data, '1', '-q'), (0, ''))
        self.assertEqual(self.run_town('review', data, '2')[0], 1)


if __name__ == '__main__':
    unittest.main()
