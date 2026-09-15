"""tinytown.references: captures, orientation, extra views, packets, briefs, planning. No network, no browser."""
import contextlib
import html
import io
import json
import math
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

from tinytown import browser, cli, references as refs
from tinytown.paths import SitePaths
from tinytown.site import M_PER_DEG_LAT
from tinytown.state import atomic_json, building_frame, pending_faces

try:
    from PIL import Image
except ImportError:  # pragma: no cover - the deploy-path python lacks Pillow
    Image = None


def building(bid=1, **extra):
    b = {"id": bid, "obb": {"cx": 0, "cz": 0, "angle": 0, "w": 10, "d": 8},
         "pts": [[-5, -4], [5, -4], [5, 4], [-5, 4]], "area": 80,
         "front": {"dir": 0, "road": "Main Street"}, "style": {"kind": "house"}}
    b.update(extra)
    return b


def site(buildings=None):
    return {"name": "fixture", "center": {"lat": 42, "lon": -77}, "buildings": buildings or [building()],
            "roads": [{"name": "Main Street", "pts": [[-40, 20], [40, 20]], "width": 6}]}


class Fixture(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.paths = SitePaths("fixture", root=self.root)
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))
        self.enterContext(contextlib.redirect_stderr(io.StringIO()))

    def write_site(self, scene=None, overrides=None):
        atomic_json(self.paths.scene, scene or site())
        atomic_json(self.paths.overrides, overrides or {})

    def png(self, path, size=(40, 30), color="white"):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        if Image is None:
            path.write_bytes(b"image")
        else:
            Image.new("RGB", size, color).save(path)
        return path


# --- record conventions --------------------------------------------------------

class Records(unittest.TestCase):
    def test_old_photo_names_map_to_face_files_relative_to_the_building(self):
        self.assertEqual(refs.normalize_file("front_1090362838_+u.png"), "fronts/+u.png")
        self.assertEqual(refs.normalize_file("front_1090362838_-v_2.png"), "fronts/-v-2.png")
        self.assertEqual(refs.normalize_file("front_-10004169957_+v_3.png"), "fronts/+v-3.png")
        self.assertEqual(refs.normalize_file("front_820059627_oblique_1.png"), "fronts/oblique-1.png")
        self.assertEqual(refs.normalize_file("fronts/+u-2.png"), "fronts/+u-2.png")
        self.assertEqual(refs.normalize_file("+u.png"), "fronts/+u.png")
        self.assertEqual(refs.photo_name("+u"), "fronts/+u.png")
        self.assertEqual(refs.photo_name("+u", 3), "fronts/+u-3.png")

    def test_normalize_fronts_rewrites_every_photo_without_touching_the_input(self):
        record = {"id": "1", "faces": {"+u": {"photos": [{"file": "front_1_+u.png", "dist": 20}]}},
                  "extra_views": {"photos": [{"file": "front_1_oblique_1.png"}],
                                  "attempts": [{"file": "front_1_oblique_1.png", "result": "captured"}]}}
        out = refs.normalize_fronts(record, "1")
        self.assertEqual(out["faces"]["+u"]["photos"][0], {"file": "fronts/+u.png", "dist": 20})
        self.assertEqual(out["extra_views"]["photos"][0]["file"], "fronts/oblique-1.png")
        self.assertEqual(out["extra_views"]["attempts"][0]["file"], "fronts/oblique-1.png")
        self.assertEqual(record["faces"]["+u"]["photos"][0]["file"], "front_1_+u.png")
        self.assertIsNone(refs.normalize_fronts(None))


class PendingFaces(Fixture):
    def test_committed_records_with_absent_images_stay_pending_until_recaptured(self):
        b = self.paths.building("1")
        atomic_json(b.fronts, {"faces": {"+u": {"coverage": True, "photos": [{"file": "front_1_+u.png"}]},
                                         "-u": {"coverage": False, "status": "no-coverage"}}})
        index = refs.load_fronts(self.paths, "1")
        self.assertEqual(pending_faces(index, ["+u", "-u", "+v"], b.dir), ["+u", "+v"])
        (b.fronts_dir).mkdir()
        (b.fronts_dir / "+u.png").write_bytes(b"image")
        self.assertEqual(pending_faces(index, ["+u", "-u", "+v"], b.dir), ["+v"])
        self.assertEqual(pending_faces(index, ["-u"], b.dir, retry_missing=True), ["-u"])


# --- orientation ---------------------------------------------------------------

class Orientation(unittest.TestCase):
    def setUp(self):
        self.site = {'center': {'lat': 0, 'lon': 0}, 'roads': []}
        self.b = {'obb': {'cx': 0, 'cz': 0, 'w': 10, 'd': 10, 'angle': 0}}

    def test_resolved_camera_not_filename_determines_visible_sides(self):
        c = refs.capture_pose(self.site, self.b, {'face': '-u', 'position': {'lat': 0, 'lon': -.1},
            'url': f'https://example.org/@0.000000,{20/M_PER_DEG_LAT:.8f},3a,60y,270h,90t', 'heading': 90})
        self.assertEqual(c['geometrically_facing_camera'], ['+u'])
        self.assertEqual(c['looking_bearing'], 270)
        self.assertAlmostEqual(c['position_uv'][0], 20, places=1)
        self.assertEqual(c['image_left_bearing'], 180)

    def test_oblique_camera_can_see_two_faces(self):
        c = refs.capture_pose(self.site, self.b, {'face': '+v', 'position': {'lat': -20/M_PER_DEG_LAT, 'lon': 20/M_PER_DEG_LAT}, 'heading': 315})
        self.assertEqual(set(c['geometrically_facing_camera']), {'+u', '+v'})

    def test_filename_without_pose_stays_unlocated(self):
        self.assertEqual(refs.capture_pose(self.site, self.b, {'face': '+u'})['status'], 'unlocated')

    def test_outward_road_is_ray_intersection_not_diagonally_nearest_road(self):
        self.site['roads'] = [{'name': 'Nearby diagonal', 'pts': [[4, 5], [4, 15]]},
                              {'name': 'Across the face', 'pts': [[20, -10], [20, 10]]}]
        self.assertEqual(refs.nearest_road(self.site, (0, 0), (1, 0))['name'], 'Across the face')
        self.assertEqual(refs.face_context(self.site, self.b)['+u']['nearest_road_outward']['name'], 'Across the face')

    def test_inventory_includes_porch_doors_and_mirrored_face_tangents(self):
        bp = {'volumes': [{'id': 'wing', 'u': [-5, 5], 'v': [-4, 4], 'faces': {
            '+u': {'doors': [{'at': 0, 'color': '#ff0000'}]},
            '-u': {'porches': [{'at': 0, 'd': 2, 'door': {'color': '#aa0000'}}]}}}]}
        doors = refs.entrance_inventory(bp, self.b, self.site)
        self.assertEqual([d['position_uv'] for d in doors], [[5, 4], [-7, -4]])
        self.assertEqual([d['outward_bearing'] for d in doors], [90, 270])
        self.assertEqual(doors[1]['kind'], 'porch-door')

    def test_polygon_edge_uses_renderers_ccw_outward_normal(self):
        bp = {'volumes': [{'id': 'wing', 'polygon': [[0, 0], [10, 0], [10, 10], [0, 10]],
                           'faces': {'edge0': {'doors': [{'at': .25}]}}}]}
        door = refs.entrance_inventory(bp, self.b, self.site)[0]
        self.assertEqual(door['position_uv'], [7.5, 0])
        self.assertEqual(door['outward_bearing'], 0)


# --- extra views ---------------------------------------------------------------

class ExtraViews(Fixture):
    def setUp(self):
        super().setUp()
        self.site = {'center': {'lat': 0, 'lon': 0}, 'roads': []}
        self.b = {'id': '1', 'obb': {'cx': 0, 'cz': 0, 'w': 10, 'd': 10, 'angle': 0},
                  'pts': [[-5, -5], [5, -5], [5, 5], [-5, 5]]}

    def rec(self, name, x, z, pano, face='+u'):
        return {'file': name, 'face': face, 'pano': pano, 'heading': 0,
                'position': {'lat': -z/M_PER_DEG_LAT, 'lon': x/M_PER_DEG_LAT}}

    def test_same_pano_or_nearby_camera_is_not_an_extra_view(self):
        a = self.rec('a', 20, 0, 'p1')
        self.assertFalse(refs.distinct(self.site, self.b, self.rec('b', 30, 20, 'p1'), [a]))
        self.assertFalse(refs.distinct(self.site, self.b, self.rec('b', 21, 3, 'p2'), [a]))
        self.assertTrue(refs.distinct(self.site, self.b, self.rec('b', 30, 20, 'p2'), [a]))
        self.assertFalse(refs.distinct(self.site, self.b, {'file': 'unknown.png'}, [a]))

    def test_selection_keeps_base_and_caps_distinct_located_extras(self):
        records = [self.rec('fronts/+u.png', 20, 0, 'base'),
                   self.rec('fronts/oblique-1.png', 30, 20, 'base'),
                   self.rec('fronts/oblique-2.png', 30, -20, 'extra1'),
                   self.rec('fronts/oblique-3.png', -30, 20, 'extra2'),
                   self.rec('fronts/oblique-4.png', -30, -20, 'extra3')]
        index = {'frame': building_frame(self.site, self.b), 'faces': {'+u': {'photos': records[:1]}},
                 'extra_views': {'photos': records[1:]}}
        b = self.paths.building('1')
        for r in records:
            self.png(b.dir / r['file'])
        base, extra = refs.select_views(self.site, self.b, index, b.dir, 2)
        self.assertEqual([r['file'] for r in base], ['fronts/+u.png'])
        self.assertEqual(len(extra), 2)
        self.assertNotIn('base', [r['pano'] for r in extra])
        self.assertEqual(refs.select_views(self.site, self.b, index, b.dir, 0)[1], [])
        index['frame'] = 'stale'
        self.assertEqual(refs.select_views(self.site, self.b, index, b.dir, 2)[1], [])

    def test_base_views_prefer_the_least_oblique_photo_and_accept_old_record_names(self):
        b = self.paths.building('1')
        for name in ('fronts/+u.png', 'fronts/+u-2.png', 'fronts/-v.png'):
            self.png(b.dir / name)
        index = {'faces': {'+u': {'photos': [{'file': 'front_1_+u.png', 'off_axis_deg': 40, 'pano': 'a'},
                                             {'file': 'front_1_+u_2.png', 'off_axis_deg': 5, 'pano': 'b'}]}}}
        base = refs.base_views(refs.normalize_fronts(index), b.dir)
        self.assertEqual([(r['face'], r['file']) for r in base], [('+u', 'fronts/+u-2.png'), ('-v', 'fronts/-v.png')])
        self.assertEqual(base[0]['pano'], 'b')

    def test_candidates_come_from_roads_and_show_two_geometric_faces(self):
        self.site['roads'] = [{'name': 'Unimportant name', 'pts': [[-40, 20], [40, 20]]}]
        candidates = list(refs.road_candidates(self.site, self.b))
        self.assertTrue(candidates)
        self.assertTrue(all(z == 20 and abs(x) > 7 for x, z in candidates))
        self.assertIsNone(refs.corner_score(self.b, (0, 20), []))
        self.assertIsNone(refs.corner_score(self.b, (200, 200), []))

    def test_extra_views_refuse_a_stale_frame_and_skip_browser_work_when_cached(self):
        scene = {**site([self.b]), 'center': self.site['center']}  # records above stand around a (0, 0) origin
        self.write_site(scene)
        b = self.paths.building('1')
        atomic_json(b.fronts, {'frame': 'stale', 'faces': {}})
        with self.assertRaisesRegex(ValueError, 'compatible capture frame'):
            refs.capture_extra_views(self.paths, '1', 1)
        records = [self.rec('fronts/+u.png', 20, 0, 'base'), self.rec('fronts/oblique-1.png', 30, 20, 'x')]
        for r in records:
            self.png(b.dir / r['file'])
        atomic_json(b.fronts, {'frame': building_frame(scene, self.b), 'faces': {'+u': {'photos': records[:1]}},
                               'extra_views': {'photos': records[1:]}})
        with patch.object(browser, 'Tab', side_effect=AssertionError('browser opened')):
            refs.capture_extra_views(self.paths, '1', 1)


# --- captures ------------------------------------------------------------------

class FakeTab:
    def __init__(self, *args, **kwargs):
        self.ws = None
    def __enter__(self): return self
    def __exit__(self, *args): pass


class Captures(Fixture):
    def test_capture_checkpoints_completed_face_before_interruption(self):
        scene = site()
        b = self.paths.building("1")
        records = [{"face": "+u", "coverage": True, "file": "fronts/+u.png"}]
        self.png(b.dir / "fronts/+u.png")
        with patch.object(browser, "Tab", FakeTab):
            with patch.object(refs, "capture_face", side_effect=[records, RuntimeError("interrupted")]):
                with self.assertRaises(RuntimeError):
                    refs.capture_building(self.paths, scene, "1", ["+u", "-u"], [20], 55)
            saved = json.loads(b.fronts.read_text())
            self.assertEqual(saved["faces"]["+u"]["photos"][0]["file"], "fronts/+u.png")
            self.assertEqual(saved["frame"], building_frame(scene, scene["buildings"][0]))
            with patch.object(refs, "capture_face", return_value=[{"face": "-u", "dist": 20, "coverage": False}]) as capture:
                refs.capture_building(self.paths, scene, "1", ["+u", "-u"], [20], 55)
                self.assertEqual(capture.call_count, 1)
                self.assertEqual(capture.call_args.args[3], "-u")
                self.assertEqual(capture.call_args.args[6], b.dir)
            self.assertEqual(json.loads(b.fronts.read_text())["faces"]["-u"]["status"], "no-coverage")
            with patch.object(refs, "capture_face") as capture:
                refs.capture_building(self.paths, scene, "1", ["+u", "-u"], [20], 55)
                capture.assert_not_called()
            moved = json.loads(json.dumps(scene))
            moved["buildings"][0]["obb"]["cx"] += 1
            with self.assertRaisesRegex(ValueError, "frame changed"):
                refs.capture_building(self.paths, moved, "1", ["+u"], [20], 55)

    def test_quick_mode_stops_after_first_usable_photo_and_names_files_by_face(self):
        class Tab:
            def reset(self): pass
            def go(self, url): pass
            def wait_pano(self, **kwargs): return "pano-1"
            def url(self): return "https://fixture/!1spid!"
            def hide_all_but_canvas(self): pass
            def shot(self, path): Path(path).write_bytes(b"image")
        b = self.paths.building("1")
        with patch.object(refs.time, "sleep"), patch.object(refs, "is_dark", return_value=False), \
             patch.object(refs, "imagery_date", return_value=None):
            tab = Tab()
            with patch.object(tab, "go", wraps=tab.go) as navigate:
                records = refs.capture_face(tab, site(), building(), "+u", [20, 30, 40], 55, b.dir, set(), 1)
                self.assertEqual(len(records), 1)
                self.assertEqual(navigate.call_count, 1)
        self.assertEqual(records[0]["file"], "fronts/+u.png")
        self.assertTrue((b.dir / "fronts/+u.png").is_file())
        self.assertEqual(sorted(records[0]), sorted(["face", "file", "pano", "dist", "off_axis_deg", "fov", "tilt", "heading",
                                                     "date", "coverage", "url", "position"]))

    def test_capture_fronts_warns_about_flaky_worker_counts_and_reports_failures(self):
        self.write_site()
        out = io.StringIO()
        with patch.object(browser, "ensure_browser"), patch.object(refs, "capture_building", side_effect=ValueError("boom")), \
             contextlib.redirect_stdout(out):
            with self.assertRaisesRegex(RuntimeError, "1: boom"):
                refs.capture_fronts(self.paths, ["1", "1"], workers=3)
        self.assertIn("WARNING", out.getvalue())
        self.assertIn("flaky", out.getvalue())
        with patch.object(browser, "ensure_browser") as ensure:
            refs.capture_fronts(self.paths, [])
            ensure.assert_not_called()

    def test_face_list_spellings(self):
        scene = site()
        self.assertEqual(refs.face_list_for(scene, "1"), ["+u", "-u", "+v", "-v"])
        self.assertEqual(refs.face_list_for(scene, "1", "road"), ["+u"])
        self.assertEqual(refs.face_list_for(scene, "1", "-u,-v,bogus"), ["-u", "-v"])
        self.assertEqual(refs.face_list_for(scene, "1", ["+v"]), ["+v"])


class CommandLine(Fixture):
    def test_empty_explicit_queues_do_not_start_browser_or_authoring(self):
        queue = self.root / "empty.txt"
        queue.write_text("")
        for verb in ("refs", "brief"):
            with self.subTest(verb=verb), patch.object(browser, "ensure_browser") as ensure:
                # No site.json exists under this root; a no-op reads neither it nor the browser.
                with patch.object(refs, "site_paths", return_value=self.paths):
                    self.assertEqual(cli.main([verb, "fixture", "--list", str(queue)]), 0)
                    with self.assertRaises(SystemExit):
                        cli.main([verb, "fixture"])
                ensure.assert_not_called()

    def test_faces_and_distances_parse_with_the_documented_spelling(self):
        args = cli.build_parser({"refs"}).parse_args(["refs", "fixture", "1", "--faces=-u,-v", "--dists", "20,35", "--quick"])
        self.assertEqual((args.faces, args.dists, args.quick, args.workers), ("-u,-v", "20,35", True, 2))
        args = cli.build_parser({"plan"}).parse_args(["plan", "fixture", "--limit", "3"])
        self.assertEqual(args.limit, 3)

    def test_plan_verb_prints_counts_and_writes_the_queue_file(self):
        self.write_site(site([building(i) for i in range(1, 4)]))
        out = io.StringIO()
        queue = self.root / "queue.txt"
        with patch.object(refs, "site_paths", return_value=self.paths), contextlib.redirect_stdout(out):
            self.assertEqual(cli.main(["plan", "fixture", "--limit", "2", "--out", str(queue)]), 0)
        self.assertEqual(queue.read_text().split(), ["1", "2"])
        self.assertIn('"new": 3', out.getvalue())


# --- planning ------------------------------------------------------------------

class Planning(Fixture):
    def test_default_queue_covers_all_structures_including_outbuildings(self):
        self.write_site(site([building(i) for i in range(12)]))
        all_work = refs.plan(self.paths)
        self.assertEqual(len(all_work["selected"]), 12)
        batch = refs.plan(self.paths, 2)
        self.assertEqual(len(batch["selected"]), 2)
        self.assertEqual(batch["remaining"], 12)
        self.assertFalse(batch["complete"])
        self.assertEqual(len(batch["buildings"]), 12)
        self.assertEqual(batch["capture_ids"], batch["selected"])
        self.assertEqual(len(refs.plan(self.paths, 0)["selected"]), 0)

    def test_queue_preserves_merged_models_and_flags_incomplete_or_stale_drafts(self):
        bp = {"volumes": [{"id": "main", "u": [-5, 5], "v": [-4, 4], "height": 6}]}
        buildings = [building(i) for i in range(1, 6)]
        buildings[0]["blueprint"] = bp
        buildings[3]["style"]["kind"] = "church"
        scene = site(buildings)
        self.write_site(scene, {"blueprints": {"1": bp, "5": bp}, "blueprint_frames": {"5": "older-footprint"}})
        for bid in (2, 3):
            atomic_json(self.paths.building(str(bid)).draft, bp)
        self.paths.building("2").notes.write_text("Observed front; other sides inferred.")
        result = refs.plan(self.paths, 2)
        states = {row["id"]: row["state"] for row in result["buildings"]}
        self.assertEqual(states, {"1": "merged", "2": "review-draft", "3": "incomplete-draft", "4": "new", "5": "review-frame"})
        self.assertEqual(set(result["selected"]), {"2", "3"})
        self.assertEqual(result["counts"], {"merged": 1, "review-draft": 1, "incomplete-draft": 1, "new": 1, "review-frame": 1})
        self.assertTrue(result["buildings"][0]["priority"] >= 200)

    def test_accepted_drafts_are_done_and_changed_drafts_reopen_review(self):
        bp = {"volumes": [{"id": "main", "u": [-5, 5], "v": [-4, 4], "height": 6}]}
        self.write_site(site(), {"blueprints": {"1": bp}})
        b = self.paths.building("1")
        atomic_json(b.draft, bp)
        self.assertTrue(refs.plan(self.paths)["complete"])
        changed = json.loads(json.dumps(bp))
        changed["volumes"][0]["height"] = 7
        atomic_json(b.draft, changed)
        b.notes.write_text("changed")
        self.assertEqual(refs.plan(self.paths)["counts"], {"review-draft": 1})
        atomic_json(b.review, {"draft_hash": refs.fingerprint(changed), "passed": True, "findings": []})
        self.assertEqual(refs.plan(self.paths)["buildings"][0]["next_step"], "accept")

    def test_stale_capture_frames_are_never_queued_for_recapture(self):
        scene = site([building(1), building(2)])
        self.write_site(scene)
        atomic_json(self.paths.building("1").fronts, {"frame": "stale", "faces": {}})
        atomic_json(self.paths.building("2").fronts, {"frame": building_frame(scene, scene["buildings"][1]),
                                                       "faces": {"+u": {"coverage": False, "status": "no-coverage"}}})
        result = refs.plan(self.paths)
        rows = {row["id"]: row for row in result["buildings"]}
        self.assertEqual(rows["1"]["capture_state"], "stale-or-unknown")
        self.assertEqual(rows["1"]["pending_road_faces"], ["+u"])
        self.assertEqual(rows["2"]["pending_road_faces"], [])
        self.assertEqual(result["capture_ids"], [])


# --- web search ----------------------------------------------------------------

class WebSearch(unittest.TestCase):
    def test_search_rejects_a_result_matching_only_the_place_name(self):
        records = [{'murl': 'https://example.test/cosmetics.jpg', 't': 'Avon cosmetics'},
                   {'murl': 'https://example.test/school.jpg', 't': 'Avon Elementary School'}]
        page = ''.join('<a m="' + html.escape(json.dumps(r), quote=True) + '"></a>' for r in records)
        with patch.object(refs, 'fetch', return_value=page.encode()):
            result = refs.search_images('Avon Elementary School Avon New York exterior')
        self.assertEqual([r['url'] for r in result], ['https://example.test/school.jpg'])

    def test_image_search_preserves_sources_and_filters_unrelated_results(self):
        a = {'murl': 'https://example.org/church.jpg', 'purl': 'https://example.org/history', 't': 'Zion Avon exterior'}
        b = {'murl': 'https://example.org/cartoon.jpg', 't': 'Monster Energie Tekening'}
        page = ' '.join('m="' + json.dumps(x).replace('"', '&quot;') + '"' for x in [a, b])
        with patch.object(refs, 'fetch', return_value=page.encode()):
            results = refs.search_images('Zion Avon building exterior')
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['page_url'], a['purl'])
        self.assertEqual(results[0]['provider'], 'bing-images')

    def test_fetch_refuses_non_http_urls(self):
        with self.assertRaises(ValueError):
            refs.fetch('file:///etc/passwd')


# --- briefs and cards ----------------------------------------------------------

class Briefs(Fixture):
    def test_brief_is_written_once_and_lists_photos_by_their_building_relative_names(self):
        scene = site()
        self.write_site(scene, {"blueprints": {"1": {"volumes": []}}, "notes": {"1": "brick, two storeys"}})
        b = self.paths.building("1")
        text = refs.brief(self.paths, "1", card=False)
        self.assertEqual(b.brief.read_text(), text)
        self.assertIn("No head-on captures yet. Run `./town refs fixture 1`", text)
        self.assertIn("A blueprint already exists", text)
        self.assertIn("brick, two storeys", text)
        self.assertIn("./town lint fixture 1", text)
        self.assertIn("--face=+u", text)
        self.assertNotIn("pipeline/", text)
        stamp = b.brief.stat().st_mtime_ns
        atomic_json(b.fronts, {"frame": building_frame(scene, scene["buildings"][0]), "faces": {
            "+u": {"photos": [{"file": "front_1_+u.png", "dist": 20, "off_axis_deg": 3, "fov": 55, "date": "Aug 2025"}]},
            "-u": {"photos": []}}})
        text = refs.brief(self.paths, "1", card=False)
        self.assertIn("`fronts/+u.png` — face `+u`, 20 m out", text)
        self.assertIn("image not on disk", text)
        self.assertIn("face `-u`: no Street View coverage", text)
        self.assertNotEqual(stamp, b.brief.stat().st_mtime_ns)
        stamp = b.brief.stat().st_mtime_ns
        self.assertEqual(refs.brief(self.paths, "1", card=False), text)
        self.assertEqual(stamp, b.brief.stat().st_mtime_ns)

    def test_stale_capture_frame_is_flagged_in_the_brief(self):
        self.write_site()
        atomic_json(self.paths.building("1").fronts, {"frame": "old", "faces": {}})
        self.assertIn("older footprint", refs.brief(self.paths, "1", card=False))

    def test_street_view_urls_cover_every_face(self):
        self.write_site()
        table = refs.street_view_urls(self.paths, "1", (20, 35))
        self.assertEqual(set(table), {"+u", "-u", "+v", "-v"})
        self.assertTrue(table["+u"]["road"])
        self.assertEqual([v["dist"] for v in table["-v"]["views"]], [20, 35])
        self.assertTrue(all(v["url"].startswith("https://www.google.com/maps/@") for v in table["+v"]["views"]))
        self.assertIn("<- road", refs.format_street_view_urls(self.paths, "1", (20,)))

    @unittest.skipUnless(Image, "Pillow not installed")
    def test_footprint_card_is_drawn_once_per_frame(self):
        self.write_site()
        out = refs.footprint_card(self.paths, "1")
        self.assertEqual(out, self.paths.building("1").dir / "footprint.png")
        self.assertEqual(Image.open(out).size, (600, 600))
        stamp = out.stat().st_mtime_ns
        self.assertEqual(refs.footprint_card(self.paths, "1"), out)
        self.assertEqual(out.stat().st_mtime_ns, stamp)
        refs.brief(self.paths, "1")
        self.assertEqual(out.stat().st_mtime_ns, stamp)


# --- packets -------------------------------------------------------------------

@unittest.skipUnless(Image, "Pillow not installed")
class Packets(Fixture):
    def setUp(self):
        super().setUp()
        self.scene = site()
        self.b = self.scene["buildings"][0]
        self.write_site(self.scene)
        self.building = self.paths.building("1")
        frame = building_frame(self.scene, self.b)
        lat, lon = 42 - 0 / M_PER_DEG_LAT, -77 + 20 / (M_PER_DEG_LAT * math.cos(math.radians(42)))
        self.photo = {"face": "+u", "file": "front_1_+u.png", "pano": "p1", "dist": 20, "off_axis_deg": 2, "fov": 55, "tilt": 92,
                      "heading": 270, "date": "Aug 2025", "coverage": True, "position": {"lat": lat, "lon": lon},
                      "url": f"https://www.google.com/maps/@{lat:.7f},{lon:.7f},3a,55y,270h,92t/data=!3m1!1e1!1sp1!2e0"}
        atomic_json(self.building.fronts, {"id": "1", "frame": frame, "faces": {
            "+u": {"bearing": 90, "width": 8, "road": True, "photos": [self.photo], "coverage": True}}})
        self.png(self.building.dir / "fronts/+u.png", (400, 300), "grey")
        self.png(self.building.dir / "aerial.png", (120, 120), "green")
        atomic_json(self.building.aerial, {"north_up": True, "id": "1"})

    def web_png(self):
        buffer = io.BytesIO()
        Image.new("RGB", (64, 48), "blue").save(buffer, format="PNG")
        return buffer.getvalue()

    def test_packet_records_relative_paths_and_is_idempotent(self):
        candidate = {"url": "https://example.org/hall.jpg", "page_url": "https://example.org", "title": "Fixture Hall"}
        with patch.object(refs, "search_images", return_value=[candidate]) as search, \
             patch.object(refs, "fetch", return_value=self.web_png()) as fetch:
            value = refs.packet(self.paths, self.b, "Fixture Hall", "Fixture, New York", [], extra_views=1)
        search.assert_called_once_with("Fixture Hall Fixture, New York building exterior")
        fetch.assert_called_once_with(candidate["url"])
        self.assertEqual(json.loads(self.building.references.read_text()), value)
        self.assertEqual([r["id"] for r in value["images"]], ["SV1", "AERIAL", "WEB1"])
        self.assertEqual([r["kind"] for r in value["images"]], ["street-view", "aerial", "web-image"])
        self.assertEqual(value["images"][0]["source_path"], "fronts/+u.png")
        self.assertEqual(value["images"][0]["camera"]["status"], "located")
        self.assertEqual(value["images"][0]["camera"]["geometrically_facing_camera"], ["+u"])
        self.assertEqual(value["images"][1]["source_path"], "aerial.png")
        self.assertTrue(value["images"][2]["source_path"].startswith("images/web-original-"))
        for n, record in enumerate(value["images"]):
            self.assertEqual(record["path"], f"images/reference-{n + 1}.jpg")
            self.assertTrue(refs.resolve(self.paths, "1", record["path"]).is_file())
            self.assertTrue(refs.resolve(self.paths, "1", record["source_path"]).is_file())
        self.assertEqual([a["id"] for a in value["attachments"]], ["MAP", "STREET-VIEWS", "AERIAL", "WEB1"])
        self.assertEqual(value["attachments"][0]["path"], "images/orientation.png")
        self.assertEqual(value["attachments"][1]["members"], ["SV1"])
        self.assertEqual(value["street_view_counts"], {"directional": 1, "additional": 0})
        self.assertEqual(value["frame"]["footprint_uv"], [[-5.0, -4.0], [5.0, -4.0], [5.0, 4.0], [-5.0, 4.0]])  # JSON shape, as on disk
        self.assertEqual(set(value["frame"]["faces"]), {"+u", "-u", "+v", "-v"})
        self.assertIn("Only 0/1 additional distinct oblique views", value["warnings"][0])
        self.assertEqual(sorted(value), sorted(["version", "id", "name", "location", "address", "source_tags", "street_view_counts",
                                                "frame", "attachments", "images", "search_query", "search_candidates", "warnings"]))
        stamp = self.building.references.stat().st_mtime_ns
        with patch.object(refs, "search_images", side_effect=AssertionError("searched again")), \
             patch.object(refs, "fetch", side_effect=AssertionError("downloaded again")):
            again = refs.packet(self.paths, self.b, "Fixture Hall", "Fixture, New York", [candidate], extra_views=1)
        self.assertEqual(again, value)
        self.assertEqual(self.building.references.stat().st_mtime_ns, stamp)

    def test_packet_survives_search_and_download_failures(self):
        with patch.object(refs, "search_images", side_effect=OSError("offline")):
            value = refs.packet(self.paths, self.b, "Fixture Hall", "", [])
        self.assertEqual([r["id"] for r in value["images"]], ["SV1", "AERIAL"])
        self.assertIn("Image search unavailable: offline", value["warnings"])
        with patch.object(refs, "fetch", side_effect=OSError("404")):
            value = refs.packet(self.paths, self.b, "Fixture Hall", "", [{"url": "https://example.org/x.jpg"}])
        self.assertTrue(any(w.startswith("Web image unavailable") for w in value["warnings"]))
        self.assertEqual(refs.packet(self.paths, self.b, "Fixture Hall", "", [], max_web=0)["warnings"], [])

    def test_stale_frame_marks_cameras_unlocated(self):
        index = json.loads(self.building.fronts.read_text())
        index["frame"] = "stale"
        atomic_json(self.building.fronts, index)
        value = refs.packet(self.paths, self.b, "Fixture Hall", "", [], max_web=0)
        self.assertEqual(value["images"][0]["camera"]["status"], "unlocated")
        self.assertIn("Capture frame differs from current footprint; camera metadata is untrusted.", value["warnings"])

    def test_photo_camera_and_comparison_use_the_capture_pose(self):
        refs.packet(self.paths, self.b, "Fixture Hall", "", [], max_web=0)
        im, camera = refs.photo_camera(self.paths, "1", "SV1")
        self.assertEqual(im["building"], "1")
        self.assertAlmostEqual(camera["position"][0], 20, places=1)
        self.assertAlmostEqual(camera["position"][1], 2.5)
        self.assertLess(camera["target"][0], camera["position"][0])  # looking west (270), back at the building
        self.assertTrue(55 < camera["hfov"] < 80)
        self.assertTrue(camera["approximate"])
        with self.assertRaisesRegex(ValueError, "accepted reference"):
            refs.photo_camera(self.paths, "1", "SV9")
        render = self.png(self.building.renders / "+u.png", (200, 150), "red")
        out = refs.comparison(self.paths, im, render)
        self.assertEqual(out, self.building.renders / "+u_compare.png")
        self.assertEqual(Image.open(out).size, (400 * 3, 300 + 32))  # photo | render | blend, at the photo's size
        pairs = [{"photo": [0, 0], "render": [0, 0]}, {"photo": [1, 0], "render": [1, 0]},
                 {"photo": [1, 1], "render": [1, 1]}, {"photo": [0, 1], "render": [0, 1]}]
        self.assertTrue(refs.comparison(self.paths, im, render, pairs).is_file())
        with self.assertRaises(ValueError):
            refs.comparison(self.paths, im, render, pairs[:2])

    def test_contact_sheet_and_orientation_card_render(self):
        a = self.png(self.root / "a.png", (300, 200), "red")
        sheet = refs.contact_sheet([(a, "SV1"), (a, "SV2"), (a, "SV3")], self.root / "sheet.jpg", cell=(100, 80))
        self.assertEqual(Image.open(sheet).size, (200, 2 * (80 + 30)))
        records = [{"id": "SV1", "camera": refs.capture_pose(self.scene, self.b, self.photo)}, {"id": "X", "camera": {"status": "unlocated"}}]
        card = refs.orientation_card(self.scene, self.b, records, self.root / "cards" / "orientation.png")
        self.assertEqual(Image.open(card).size, (900, 820))


if __name__ == "__main__":
    unittest.main()
