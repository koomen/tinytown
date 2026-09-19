"""tinytown.site: building scenes, scoping, landmark clipping and outlines.

Run with: .venv/bin/python -B -m unittest tests.unit.test_site -v
"""
import contextlib
import io
import json
import math
import os
from pathlib import Path
import tempfile
import unittest

from tinytown import site as S
from tinytown.paths import ROOT, SitePaths, site_paths

REQUEST = {"center": {"lat": 42.91201, "lon": -77.74548}, "size_m": {"w": 420, "h": 380}}
GOLDEN_SITES = ("avon-extended", "chautauqua")


def elevation(center, value=100):
    return {"cols": 2, "rows": 2, "values": [value] * 4,
            "bounds": {"north": center["lat"] + .01, "south": center["lat"] - .01,
                       "east": center["lon"] + .01, "west": center["lon"] - .01}}


def way(bid, tags, points):
    return {"type": "way", "id": bid, "tags": tags, "geometry": [{"lat": lat, "lon": lon} for lon, lat in points]}


def square(lon, lat, size=.0002):
    return [[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]]


def summarize(got, want):
    """Top-level keys where two scenes differ, with list counts; '' when equal."""
    out = []
    for key in sorted(set(got) | set(want)):
        if got.get(key) != want.get(key):
            g, w = got.get(key), want.get(key)
            if isinstance(g, list) and isinstance(w, list):
                out.append(f"{key}[{len(g)} vs {len(w)} items, {sum(1 for a, b in zip(g, w) if a != b)} differ]")
            else:
                out.append(f"{key}({json.dumps(g)[:80]} != {json.dumps(w)[:80]})")
    return ", ".join(out)


class TempRoot(unittest.TestCase):
    """A throwaway repository root with sites/ and data/ for one or more sites."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        (self.root / "sites").mkdir()
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))

    @staticmethod
    def write(path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value))

    def make(self, name="trial", request=REQUEST, osm=None, elev=None, overrides=None, config=None,
             scope=None, **sidecars):
        paths = SitePaths(name, self.root)
        self.write(paths.request, request)
        self.write(paths.osm, osm or {"elements": []})
        self.write(paths.elevation, elev or elevation(request["center"]))
        if overrides is not None:
            self.write(paths.overrides, overrides)
        if config is not None:
            self.write(paths.config, config)
        if scope is not None:
            self.write(paths.scope, scope)
        for key, value in sidecars.items():
            self.write(paths.site_dir / f"{key}.json", value)
        return paths


class GoldenScenes(unittest.TestCase):
    """`town build` must reproduce the committed scenes apart from the name field."""

    def test_build_reproduces_committed_scenes(self):
        for name in GOLDEN_SITES:
            with self.subTest(site=name):
                paths = site_paths(name)
                want_text = paths.scene.read_text()
                want = json.loads(want_text)
                # The committed files use the compact separators atomic_json writes,
                # so dict equality below is byte equality of the serialized scene
                # (up to non-ASCII escaping, which the committed files disagree on).
                self.assertIn(want_text.rstrip("\n"), (json.dumps(want, separators=(",", ":")),
                                                       json.dumps(want, separators=(",", ":"), ensure_ascii=False)))
                got = S.build(paths, write=False)
                self.assertEqual(got["name"], name)
                got.pop("name"); want.pop("name")
                self.assertEqual(list(got), list(want), "top-level key order")
                self.assertTrue(got == want, f"{name}: build() differs from committed site.json in {summarize(got, want)}")

    def test_build_is_deterministic_and_leaves_the_scene_untouched_without_write(self):
        paths = site_paths("avon-extended")
        before = paths.scene.read_bytes()
        first = S.build(paths, write=False)
        second = S.build(paths, write=False)
        self.assertEqual(first, second)
        self.assertEqual(paths.scene.read_bytes(), before)
        self.assertFalse((paths.data / "frame_review.json").exists())


class BuildTests(TempRoot):
    def test_road_width_and_lanes_overrides_apply_by_name_and_way(self):
        center = REQUEST["center"]
        osm = {"elements": [
            {"type": "way", "id": bid, "tags": tags, "geometry": [
                {"lat": center["lat"], "lon": center["lon"]},
                {"lat": center["lat"] + .0001, "lon": center["lon"]}]}
            for bid, tags in [(1, {"highway": "residential", "name": "Spring Street", "bridge": "yes", "layer": "1"}),
                              (2, {"highway": "residential", "name": "Spring Street"}),
                              (3, {"highway": "service", "tunnel": "yes", "layer": "-1"}), (4, {"highway": "service"}),
                              (5, {"highway": "footway", "footway": "crossing", "ford": "yes"})]]}
        paths = self.make(osm=osm, overrides={"roads": {
            "Spring Street": {"width": 9, "lanes": 2, "pts": [[100, 100], [120, 120]]},
            "2": {"width": 10}, "3": {"width": 8, "pts": [[-300, 0], [20, 0], [25.125, 30.678]]},
            "5": {"marking": "ladder"}}})
        S.build(paths)
        roads = {r["id"]: r for r in S.load_site(paths)["roads"]}
        self.assertEqual([roads[i]["width"] for i in (1, 2, 3, 4)], [9, 10, 8, 4])
        self.assertEqual([roads[i]["lanes"] for i in (1, 2)], [2, 2])
        self.assertFalse(roads[1]["oneway"])
        self.assertNotIn("lanes", roads[3])
        self.assertEqual(roads[5]["marking"], "ladder")
        self.assertEqual((roads[1]["bridge"], roads[1]["layer"]), ("yes", "1"))
        self.assertEqual((roads[3]["tunnel"], roads[3]["layer"]), ("yes", "-1"))
        self.assertEqual(roads[5]["ford"], "yes")
        self.assertNotIn("bridge", roads[4])
        self.assertEqual(roads[3]["pts"], [[-222, 0], [20, 0], [25.125, 30.678]])
        self.assertEqual(roads[1]["pts"], roads[2]["pts"])
        self.assertEqual(roads[1]["pts"][0], [0, 0])
        rebuilt = S.build(paths)["roads"]
        self.assertEqual(next(r for r in rebuilt if r["id"] == 3), roads[3])
        for invalid in ([], [[0, 0]], [[0, 0], [True, 1]], [[0, 0], [float("inf"), 1]], [[0, 0], [1, 2, 3]]):
            with self.subTest(points=invalid):
                self.write(paths.overrides, {"roads": {"3": {"pts": invalid}}})
                with self.assertRaisesRegex(ValueError, "finite"):
                    S.build(paths)

    def test_authored_roads_rebuild_and_preserve_mapped_roads(self):
        center = REQUEST["center"]
        osm = {"elements": [{"type": "way", "id": 1, "tags": {"highway": "residential", "name": "Spring Street"},
                             "geometry": [{"lat": center["lat"], "lon": center["lon"]},
                                          {"lat": center["lat"] + .0001, "lon": center["lon"]}]}]}
        paths = self.make(osm=osm)
        baseline = S.build(paths)["roads"]
        driveway = {"id": "301-driveway", "class": "service", "width": 4.4,
                    "pts": [[-300, 0], [20, 0], [25.125, 30.678]]}
        self.write(paths.overrides, {"authored_roads": [driveway]})
        roads = S.build(paths)["roads"]
        self.assertEqual(roads[:-1], baseline)
        self.assertEqual(roads[-1], {**driveway, "pts": [[-222, 0], [20, 0], [25.125, 30.678]],
                                     "name": None, "oneway": False, "circular": False})
        self.assertEqual(S.build(paths)["roads"], roads)
        invalid = [None, {}, {**driveway, "id": 1}, {**driveway, "id": True},
                   {**driveway, "class": "invented"}, {**driveway, "width": -1},
                   {**driveway, "width": float("nan")}, {**driveway, "width": True},
                   {**driveway, "pts": [[0, 0]]}, {**driveway, "pts": [[0, 0], [float("inf"), 1]]},
                   {**driveway, "pts": [[0, 0], [True, 1]]}]
        for record in invalid:
            with self.subTest(record=record):
                self.write(paths.overrides, {"authored_roads": [record]})
                with self.assertRaises(ValueError):
                    S.build(paths)
        for records in ({}, [driveway, driveway]):
            with self.subTest(records=records):
                self.write(paths.overrides, {"authored_roads": records})
                with self.assertRaises(ValueError):
                    S.build(paths)

    def test_authored_buildings_persist_without_changing_mapped_data(self):
        center = REQUEST["center"]
        lon, lat = center["lon"], center["lat"]
        points = [[lon, lat], [lon + .0002, lat], [lon + .0002, lat + .0001], [lon, lat + .0001]]
        mapped = {"id": 1, "type": "way", "tags": {"building": "house"},
                  "geometry": [{"lon": x - .001, "lat": y} for x, y in points]}
        authored = {"id": -20, "coordinates": points, "tags": {"building": "commercial", "name": "Measured restaurant"}}
        paths = self.make(request={**REQUEST, "building_ids": [1, -20]}, osm={"elements": [mapped]},
                          overrides={"authored_buildings": [authored]})
        first = S.build(paths)
        self.assertEqual([b["id"] for b in first["buildings"]], [1, -20])
        self.assertEqual(first["buildings"][1]["name"], "Measured restaurant")
        self.assertGreater(first["buildings"][1]["area"], 100)
        self.assertEqual(S.build(paths), first)
        self.assertEqual(json.loads(paths.osm.read_text()), {"elements": [mapped]})
        saved = {"pts": [[x + .00031, z + .00027] for x, z in first["buildings"][1]["pts"]],
                 "obb": {**first["buildings"][1]["obb"], "cx": .000173, "angle": .123456}}
        self.write(paths.overrides, {"authored_buildings": [authored], "footprints": {"-20": saved}})
        rebuilt = S.build(paths)["buildings"][1]
        self.assertEqual(rebuilt["pts"], saved["pts"])
        self.assertEqual(rebuilt["obb"], saved["obb"])
        # Scope selection remains authoritative even with extra authored data.
        self.write(paths.request, {**REQUEST, "building_ids": [1]})
        self.assertEqual(S.build(paths)["buildings"], first["buildings"][:1])
        invalid = [None, {}, {**authored, "id": 1}, {**authored, "id": True},
                   {**authored, "tags": {}}, {**authored, "coordinates": [[lon, lat]]},
                   {**authored, "coordinates": [[lon, lat]] * 3},
                   {**authored, "coordinates": [[lon, lat], [lon + .1, lat], [float("nan"), lat + .1]]}]
        for record in invalid:
            with self.subTest(record=record), self.assertRaises(ValueError):
                S.authored_building_elements([record], [mapped])
        with self.assertRaises(ValueError):
            S.authored_building_elements([authored, authored], [mapped])

    def test_scope_file_wins_over_request_and_reports_missing_structures(self):
        lon, lat = REQUEST["center"]["lon"], REQUEST["center"]["lat"]
        osm = {"elements": [way(1, {"building": "house"}, square(lon, lat)),
                            way(2, {"building": "house"}, square(lon + .0005, lat)),
                            way(3, {"building": "house"}, square(lon - .0005, lat))]}
        paths = self.make(request={**REQUEST, "building_ids": [1, 2, 3]}, osm=osm,
                          config={"title": "Trial", "scope": "scope.json"},
                          scope={"building_ids": ["1", "2"], "exclusions": ["2"]})
        self.assertEqual([b["id"] for b in S.build(paths)["buildings"]], [1])
        self.write(paths.scope, {"building_ids": ["1", "99"]})
        with self.assertRaisesRegex(ValueError, "99"):
            S.build(paths)
        # Without a scope key in the config the request's list applies.
        self.write(paths.config, {"title": "Trial"})
        self.assertEqual([b["id"] for b in S.build(paths)["buildings"]], [1, 2, 3])
        # No config at all: build still works for a bare data directory.
        paths.config.unlink()
        self.assertEqual(len(S.build(paths)["buildings"]), 3)

    def test_scene_is_written_compactly_and_named_after_the_site(self):
        paths = self.make(name="my-town", overrides={"title": "My Town", "seed": 7})
        site = S.build(paths)
        self.assertEqual((site["name"], site["title"], site["seed"]), ("my-town", "My Town", 7))
        self.assertEqual(paths.scene.read_text(), json.dumps(site, separators=(",", ":")) + "\n")
        self.assertNotIn("landmarks", site)
        self.assertNotIn("outline", site)
        self.assertIn("road pieces", S.summary(site))

    def test_frame_review_hides_blueprints_whose_footprint_moved(self):
        lon, lat = REQUEST["center"]["lon"], REQUEST["center"]["lat"]
        blueprint = {"volumes": [{"u": [-5, 5], "v": [-4, 4], "height": 6}]}
        paths = self.make(osm={"elements": [way(1, {"building": "house"}, square(lon, lat))]},
                          overrides={"blueprints": {"1": blueprint}})
        first = S.build(paths)
        self.assertEqual(first["buildings"][0]["blueprint"], blueprint)
        self.assertNotIn("frame_review", first)
        # The footprint moves in the source: the authored frame no longer fits.
        self.write(paths.osm, {"elements": [way(1, {"building": "house"}, square(lon + .0003, lat))]})
        moved = S.build(paths)
        self.assertEqual(moved["frame_review"], ["1"])
        self.assertIsNone(moved["buildings"][0]["blueprint"])
        self.assertTrue((paths.data / "frame_review.json").exists())
        self.assertEqual(json.loads(paths.scene.read_text())["frame_review"], ["1"])


class LandmarkTests(TempRoot):
    def test_authored_landmarks_regenerate_without_duplicate_or_lost_context(self):
        request = {"center": {"lat": 42, "lon": -79}, "size_m": {"w": 100, "h": 100}}
        mapped = {"id": "mapped", "kind": "water", "closed": True, "level": -2,
                  "pts": [[-20, -20], [20, -20], [20, 20], [-20, 20]]}
        stale = {"id": "authored", "kind": "paving", "closed": True, "pts": [[1, 1], [2, 1], [2, 2], [1, 2]]}
        authored = {"features": [{"id": "authored", "kind": "paving", "closed": True,
                                  "coordinates": [[-79.0001, 42.0001], [-78.9999, 42.0001], [-78.9999, 41.9999], [-79.0001, 41.9999]]}]}
        paths = self.make(request=request, elev=elevation(request["center"], 400),
                          overrides={"landmarks": [mapped, stale]},
                          config={"title": "t", "plugin": "chautauqua", "landmarks": "landmarks.json"},
                          landmarks=authored)
        first = S.build(paths)["landmarks"]
        self.assertEqual(first, S.build(paths)["landmarks"])
        self.assertEqual([f["id"] for f in first], ["mapped", "authored"])
        self.assertEqual(first[0], mapped)
        self.assertLess(first[1]["pts"][0][0], -8)
        self.assertLess(first[1]["pts"][0][1], -11)
        # A feature new to the overrides is appended after them.
        authored["features"].append({"id": "extra", "kind": "paving", "closed": True,
                                     "coordinates": [[-79.00005, 42.00005], [-78.99995, 42.00005], [-78.99995, 41.99995]]})
        self.write(paths.site_dir / "landmarks.json", authored)
        self.assertEqual([f["id"] for f in S.build(paths)["landmarks"]], ["mapped", "authored", "extra"])

    def test_mapped_context_survives_fresh_build_without_authored_overrides(self):
        request = {"center": {"lat": 42, "lon": -79}, "size_m": {"w": 100, "h": 100},
                   "landmarks": [{"id": 1, "kind": "water", "closed": True, "level": -2,
                                  "pts": [[-100, -20], [100, -20], [100, 20], [-100, 20]]}]}
        paths = self.make(request=request, elev=elevation(request["center"], 400))
        lake = S.build(paths)["landmarks"][0]
        self.assertEqual(lake["level"], -2)
        self.assertLessEqual(max(abs(p[0]) for p in lake["pts"]), 50.001)
        self.write(paths.overrides, {"landmarks": []})
        self.assertFalse(S.build(paths).get("landmarks"))

    def test_plugin_landmarks_outside_the_bounds_leave_no_landmarks_key(self):
        request = {"center": {"lat": 42, "lon": -79}, "size_m": {"w": 100, "h": 100}}
        far = {"features": [{"id": "far", "kind": "pitch", "closed": True,
                             "coordinates": [[-79.01, 42.01], [-79.009, 42.01], [-79.009, 42.009]]}]}
        paths = self.make(request=request, config={"title": "t", "plugin": "avon", "landmarks": "landmarks.json"},
                          landmarks=far)
        self.assertNotIn("landmarks", S.build(paths))

    def test_merge_replaces_in_place_and_appends_new(self):
        base = [{"id": 1, "v": "old"}, {"id": "b", "v": "keep"}, {"id": 3, "v": "old"}]
        authored = [{"id": "3", "v": "new"}, {"id": "1", "v": "new"}, {"id": "z", "v": "extra"}]
        self.assertEqual(S.merge_landmarks(base, authored),
                         [{"id": "1", "v": "new"}, {"id": "b", "v": "keep"}, {"id": "3", "v": "new"}, {"id": "z", "v": "extra"}])
        self.assertEqual(S.merge_landmarks(None, authored), authored)

    def test_clipped_stream_keeps_connected_interior_bends(self):
        site = dict(center=dict(lat=0, lon=0), bounds=dict(west=0, east=10 / 111320, north=0, south=-10 / 111320))
        features = [dict(id=7, kind="water", closed=False, pts=[[-5, 5], [2, 5], [5, 7], [8, 5], [15, 5]])]
        result = S.clipped(features, site)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["pts"], [[0, 5], [2, 5], [5, 7], [8, 5], [10, 5]])
        # An open feature leaving and re-entering becomes two runs with suffixed ids.
        zigzag = [dict(id=8, kind="water", closed=False, pts=[[1, 5], [12, 5], [12, 8], [1, 8]])]
        self.assertEqual([f["id"] for f in S.clipped(zigzag, site)], ["8-0", "8-1"])
        # Closed polygons are clipped as polygons; tracks stay polylines.
        box = [dict(id=9, kind="pitch", closed=True, pts=[[5, 2], [15, 2], [15, 8], [5, 8]])]
        self.assertEqual(S.clipped(box, site)[0]["pts"], [[5, 2], [10, 2], [10, 8], [5, 8]])


class OutlineTests(TempRoot):
    def test_existing_rectangular_sites_stay_opt_out(self):
        for name in ("avon-extended",):
            self.assertIsNone(S.site_outline({"name": name, "center": {"lat": 42, "lon": -79}}, {}, {}, site_paths(name)))
        self.assertNotIn("outline", S.build(self.make()))

    def test_geographic_projection_keeps_the_authoring_origin(self):
        record = {"coordinates": [[-79.5, 42.2], [-79.49, 42.2], [-79.49, 42.19]], "name": "test"}
        first = S.project_outline(record, {"lat": 42.2, "lon": -79.5})
        self.assertEqual(first["pts"][0], [0, 0])
        self.assertEqual(first["pts"][2][1], 1113.2)
        self.assertAlmostEqual(first["pts"][1][0], 1113.2 * math.cos(math.radians(42.2)), places=3)
        self.assertIn("coordinates", record, "projection must not mutate the source sidecar")
        site = {"name": "test", "center": {"lat": 42.2, "lon": -79.5}}
        self.assertEqual(S.site_outline(site, {}, {"outline": record})["pts"], first["pts"])
        self.assertEqual(S.site_outline(site, {"outline": record}, {})["pts"], first["pts"])

    def test_chautauqua_has_a_nonrectangular_geographic_boundary(self):
        paths = site_paths("chautauqua")
        record = json.loads((paths.site_dir / "outline.json").read_text())
        center = {"lat": 42.20938, "lon": -79.46614}
        pts = S.project_outline(record, center)["pts"]
        self.assertEqual(S.site_outline({"name": "Custom display title", "center": center}, {}, {}, paths)["pts"], pts)
        self.assertGreater(len(pts), 12)
        cross = lambda a, b, c: (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        turns = [cross(p, pts[(i + 1) % len(pts)], pts[(i + 2) % len(pts)]) for i, p in enumerate(pts)]
        self.assertLess(min(turns), 0)
        self.assertGreater(max(turns), 0)
        self.assertAlmostEqual(min(p[1] for p in pts), -877, places=3)
        area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2
        self.assertLess(area, 1730 ** 2 * .5)

    def test_config_named_outline_applies_without_a_plugin(self):
        record = {"coordinates": [[-77.746, 42.913], [-77.745, 42.913], [-77.745, 42.911]]}
        paths = self.make(config={"title": "t", "outline": "outline.json"}, outline=record)
        self.assertEqual(S.build(paths)["outline"]["pts"], S.project_outline(record, REQUEST["center"])["pts"])

    def test_invalid_outline_rejected(self):
        for points in [[], [[0, 0], [1, 1]], [[0, 0], [1, float("nan")], [2, 0]]]:
            with self.assertRaises(ValueError):
                S.project_outline({"pts": points}, {"lat": 42, "lon": -79})


class ScopeTests(TempRoot):
    def buildings(self):
        lon, lat = REQUEST["center"]["lon"], REQUEST["center"]["lat"]
        return {"elements": [way(1, {"building": "house"}, square(lon, lat)),
                             way(2, {"building": "house"}, square(lon + .0005, lat)),
                             way(3, {"building": "house"}, square(lon - .0005, lat)),
                             way(4, {"highway": "residential"}, [[lon - .001, lat], [lon + .001, lat]])]}

    def test_scope_writes_updates_and_is_idempotent(self):
        paths = self.make(osm=self.buildings(), config={"title": "Trial", "scope": "scope.json"})
        record = S.scope(paths, ids=["2", 1], title="Two houses")
        self.assertEqual(record, {"title": "Two houses", "building_ids": ["2", "1"]})
        self.assertEqual(json.loads(paths.scope.read_text()), record)
        stamp = paths.scope.stat().st_mtime_ns
        self.assertEqual(S.scope(paths, ids=["2", 1], title="Two houses"), record)
        self.assertEqual(paths.scope.stat().st_mtime_ns, stamp, "an unchanged scope is not rewritten")
        ids_file = self.root / "ids.txt"
        ids_file.write_text("# comment\n3\n\n1\n")
        record = S.scope(paths, ids_file=str(ids_file), exclude=["2"], bounds="42.9,-77.75,42.92,-77.74")
        self.assertEqual(record["building_ids"], ["1", "3"])
        self.assertEqual(record["exclusions"], ["2"])
        self.assertEqual(record["bounds"], {"south": 42.9, "west": -77.75, "north": 42.92, "east": -77.74})
        self.assertEqual(record["title"], "Two houses")
        self.assertEqual([b["id"] for b in S.build(paths)["buildings"]], [1, 3])
        with self.assertRaises(ValueError):
            S.scope(self.make(name="empty"), title="nothing selected")
        with self.assertRaises(ValueError):
            S.parse_bounds("1,2,3")
        with self.assertRaises(ValueError):
            S.parse_bounds("42.92,-77.75,42.9,-77.74")

    def test_bounds_alone_select_from_the_sites_own_source(self):
        lon, lat = REQUEST["center"]["lon"], REQUEST["center"]["lat"]
        paths = self.make(osm=self.buildings(), config={"title": "Trial", "scope": "scope.json"})
        record = S.scope(paths, bounds={"south": lat - .0003, "north": lat + .0003, "west": lon - .0003, "east": lon + .0003})
        self.assertEqual(record["building_ids"], ["1"])

    def test_source_seeds_a_new_site_and_scopes_it(self):
        origin = self.make(name="origin", osm=self.buildings(), config={"title": "Origin"})
        self.write(origin.satellite_meta, {"bounds": "x"})
        self.write(origin.extra_source("lake"), {"elements": [{"type": "node", "id": 9, "lat": 42.912, "lon": -77.745}]})
        trial = SitePaths("trial", self.root)
        record = S.scope(trial, ids=["1"], source="origin", title="One house")
        self.assertEqual(record["building_ids"], ["1"])
        self.assertEqual(json.loads(trial.config.read_text()), {"title": "One house", "scope": "scope.json"})
        for path in (trial.osm, trial.elevation, trial.satellite_meta, trial.extra_source("lake"), trial.request, trial.composition):
            self.assertTrue(path.exists(), path)
        self.assertEqual(json.loads(trial.osm.read_text()), self.buildings(), "the cached map is copied whole")
        request = json.loads(trial.request.read_text())
        bounds = request["bounds"]
        self.assertEqual(record["bounds"], bounds)
        lon, lat = REQUEST["center"]["lon"], REQUEST["center"]["lat"]
        self.assertLess(bounds["west"], lon); self.assertGreater(bounds["east"], lon + .0002)
        self.assertLess(bounds["south"], lat); self.assertGreater(bounds["north"], lat + .0002)
        self.assertEqual(request["size_m"]["w"] % 5, 0)
        self.assertGreaterEqual(request["size_m"]["w"], 16 + 48)
        self.assertEqual(json.loads(trial.overrides.read_text()), {"title": "One house"})
        self.assertEqual(json.loads(trial.composition.read_text())["imported_ids"], ["1"])
        site = S.build(trial)
        self.assertEqual([b["id"] for b in site["buildings"]], [1])
        self.assertEqual(site["title"], "One house")
        # Re-running is a no-op; the source is not imported twice.
        stamp = trial.osm.stat().st_mtime_ns
        self.assertEqual(S.scope(trial, ids=["1"], source="origin", title="One house"), record)
        self.assertEqual(trial.osm.stat().st_mtime_ns, stamp)
        with self.assertRaisesRegex(ValueError, "unknown structure"):
            S.scope(SitePaths("other", self.root), ids=["77"], source="origin")
        with self.assertRaisesRegex(ValueError, "beyond"):
            S.scope(SitePaths("wide", self.root), source="origin", bounds="42.0,-78.0,43.0,-77.0")
        with self.assertRaises(ValueError):
            S.scope(SitePaths("blank", self.root), source="origin")

    def test_source_with_bounds_selects_every_building_inside(self):
        self.make(name="origin", osm=self.buildings())
        lon, lat = REQUEST["center"]["lon"], REQUEST["center"]["lat"]
        record = S.scope(SitePaths("east", self.root), source="origin",
                         bounds={"south": lat - .0005, "north": lat + .0005, "west": lon - .0001, "east": lon + .001})
        self.assertEqual(record["building_ids"], ["1", "2"])
        request = json.loads(SitePaths("east", self.root).request.read_text())
        self.assertAlmostEqual(request["center"]["lon"], lon + .00045)
        self.assertNotIn("building_ids", request, "scope.json is the only list of structures")


class CliTests(unittest.TestCase):
    def test_verbs_register(self):
        import argparse
        parser = argparse.ArgumentParser()
        S.register(parser.add_subparsers(dest="verb"))
        args = parser.parse_args(["build", "avon"])
        self.assertEqual((args.verb, args.site), ("build", "avon"))
        args = parser.parse_args(["scope", "x", "--ids", "1", "2", "--bounds", "1,2,3,4", "--source", "avon", "--exclude", "9"])
        self.assertEqual((args.ids, args.bounds, args.source, args.exclude), (["1", "2"], "1,2,3,4", "avon", ["9"]))


if __name__ == "__main__":
    unittest.main()
