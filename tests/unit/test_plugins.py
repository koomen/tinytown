"""tinytown.plugins: the avon and chautauqua landmark, outline and scope hooks.

Run with: .venv/bin/python -B -m unittest tests.unit.test_plugins -v
"""
import json
import math
from pathlib import Path
import tempfile
import unittest

from tinytown.paths import ROOT, site_paths
from tinytown.plugins import avon, chautauqua

AVON_LANDMARKS = ROOT / "sites/avon-extended/landmarks.json"


class AvonLandmarks(unittest.TestCase):
    def test_fences_gates_and_dugouts_follow_geographic_origin(self):
        feature = dict(id="field", kind="pitch", sport="baseball", coordinates=[[0, 0], [.001, 0], [0, .001]],
                       openings=[dict(coordinates=[.0002, 0], width=5)],
                       baseball=dict(fences=[dict(coordinates=[[0, 0], [.001, 0]], height=2,
                                                  openings=[dict(coordinates=[.0004, 0], width=3)])],
                                     dugouts=[dict(coordinates=[.0005, .0002], angle=1.2, length=7)]))
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "landmarks.json"
            path.write_text(json.dumps(dict(features=[feature])))
            a = avon.authored_features(dict(center=dict(lat=0, lon=0)), path)[0]
            b = avon.authored_features(dict(center=dict(lat=0, lon=.001)), path)[0]
        self.assertEqual(a["baseball"]["fences"][0]["pts"], [[0, 0], [111.32, 0]])
        pairs = [(a["openings"][0]["point"], b["openings"][0]["point"]),
                 (a["baseball"]["fences"][0]["openings"][0]["point"], b["baseball"]["fences"][0]["openings"][0]["point"]),
                 (a["baseball"]["dugouts"][0]["position"], b["baseball"]["dugouts"][0]["position"])]
        for p, q in pairs:
            self.assertAlmostEqual(p[0] - q[0], 111.32, places=3)
            self.assertEqual(p[1], q[1])
        self.assertEqual(a["baseball"]["dugouts"][0]["angle"], 1.2)
        self.assertEqual(a["openings"][0]["width"], 5)
        self.assertNotIn("coordinates", a)

    def test_surveyed_park_stays_geographic_when_origin_changes(self):
        site = dict(center=dict(lat=42.91201, lon=-77.74548))
        other = dict(center=dict(lat=42.91201, lon=-77.74448))
        first = avon.authored_features(site, AVON_LANDMARKS)
        second = avon.authored_features(other, AVON_LANDMARKS)
        shift = .001 * 111320 * math.cos(math.radians(42.91201))
        # Two Driving Park diamonds and three school diamonds.
        self.assertEqual(len([f for f in first if len(f.get("bases", [])) == 4]), 5)
        for a, b in zip(first, second):
            for p, q in zip(a["pts"], b["pts"]):
                self.assertAlmostEqual(p[0] - q[0], shift, delta=.002)
                self.assertEqual(p[1], q[1])
            for ea, eb in zip(a.get("equipment", []), b.get("equipment", [])):
                self.assertAlmostEqual(ea["position"][0] - eb["position"][0], shift, delta=.002)
            for sa, sb in zip(a.get("baseball", {}).get("surfaces", []),
                              b.get("baseball", {}).get("surfaces", [])):
                for p, q in zip(sa["pts"], sb["pts"]):
                    self.assertAlmostEqual(p[0] - q[0], shift, delta=.002)
                    self.assertEqual(p[1], q[1])
        oval = next(f for f in first if f["kind"] == "track")
        self.assertTrue(oval["closed"])
        self.assertGreater(max(p[1] for p in oval["pts"]) - min(p[1] for p in oval["pts"]), 300)

    def test_avon_uses_its_own_survey_through_its_config(self):
        site = dict(center=dict(lat=42.91201, lon=-77.74548))
        extended = avon.landmarks(site, site_paths("avon-extended"))
        self.assertEqual(extended, avon.authored_features(site, AVON_LANDMARKS))
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "sites" / "bare").mkdir(parents=True)
            (root / "sites" / "bare" / "site.json").write_text('{"title": "bare", "plugin": "avon"}')
            self.assertEqual(avon.landmarks(site, site_paths("bare", root)), [], "no sidecar named, no landmarks")


class ChautauquaLandmarks(unittest.TestCase):
    CENTER = dict(center=dict(lat=42.20938, lon=-79.46614))

    def test_garden_anchor_and_holes_follow_origin(self):
        source = dict(features=[dict(id="test", kind="garden", closed=True,
                                     coordinates=[[1, 2], [1.001, 2], [1, 2.001]],
                                     holes=[[[1.0001, 2.0001], [1.0002, 2.0001], [1.0001, 2.0002]]],
                                     garden=dict(type="carnahan-jackson", coordinates=[1.0002, 2.0003], angle=-.6, entry=[-2, 10]))])
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "landmarks.json"
            path.write_text(json.dumps(source))
            a = chautauqua.authored_features(dict(center=dict(lat=2, lon=1)), path)[0]
            b = chautauqua.authored_features(dict(center=dict(lat=2, lon=1.001)), path)[0]
            self.assertEqual(chautauqua.authored_features(dict(center=dict(lat=2, lon=1)), Path(temp) / "missing.json"), [])
        expected = .001 * 111320 * math.cos(math.radians(2))
        pa = a["pts"] + a["holes"][0] + [a["garden"]["position"]]
        pb = b["pts"] + b["holes"][0] + [b["garden"]["position"]]
        for p, q in zip(pa, pb):
            self.assertAlmostEqual(p[0] - q[0], expected, delta=.002)
            self.assertEqual(p[1], q[1])
        self.assertEqual(a["garden"]["entry"], [-2, 10])
        self.assertEqual(a["garden"]["angle"], -.6)
        self.assertNotIn("coordinates", a)
        self.assertNotIn("coordinates", a["garden"])

    def test_persistent_garden_has_source_and_three_pool_renderer_type(self):
        features = chautauqua.landmarks(self.CENTER, site_paths("chautauqua"))
        garden = next(f for f in features if f["id"] == "carnahan-jackson-garden")
        self.assertEqual(garden["garden"]["type"], "carnahan-jackson")
        self.assertEqual(garden["garden"]["position"], [140.3, 168.7])
        self.assertTrue(garden["source"])
        self.assertTrue(garden["closed"])
        self.assertGreater(len(garden["pts"]), 3)

    def test_outline_hook_returns_the_reviewed_sidecar(self):
        paths = site_paths("chautauqua")
        record = chautauqua.outline({"center": self.CENTER["center"]}, {}, {}, paths)
        self.assertEqual(record, json.loads((paths.site_dir / "outline.json").read_text()))
        self.assertGreater(len(record["coordinates"]), 12)
        self.assertIsNone(chautauqua.outline({}, {}, {}, site_paths("avon")), "no outline sidecar, no outline")


def ring_elements(with_geometry):
    """The grounds relation as two outer ways forming a closed square 0..1."""
    nodes = {1: (0, 0), 2: (1, 0), 3: (1, 1), 4: (0, 1)}
    ways = {10: [1, 2, 3], 11: [3, 4, 1]}
    elements = [{"type": "relation", "id": chautauqua.GROUNDS_BOUNDARY, "members": []}]
    for wid, refs in ways.items():
        member = {"type": "way", "ref": wid, "role": "outer"}
        if with_geometry:
            member["geometry"] = [{"lon": nodes[n][0], "lat": nodes[n][1]} for n in refs]
        elements[0]["members"].append(member)
    if not with_geometry:
        elements += [{"type": "node", "id": n, "lon": x, "lat": y} for n, (x, y) in nodes.items()]
        elements += [{"type": "way", "id": wid, "nodes": refs} for wid, refs in ways.items()]
    return elements


def building(bid, lon, lat, size=.1):
    return {"type": "way", "id": bid, "tags": {"building": "yes"},
            "geometry": [{"lon": lon, "lat": lat}, {"lon": lon + size, "lat": lat}, {"lon": lon + size, "lat": lat + size},
                         {"lon": lon, "lat": lat + size}, {"lon": lon, "lat": lat}]}


class ChautauquaScope(unittest.TestCase):
    def test_grounds_ring_closes_from_either_extract_form(self):
        for form in (True, False):
            ring = chautauqua.grounds_ring(ring_elements(form))
            self.assertEqual(ring[0], ring[-1])
            self.assertEqual(sorted(map(tuple, ring[:-1])), [(0, 0), (0, 1), (1, 0), (1, 1)])

    def test_scope_filter_keeps_buildings_whose_centroid_is_inside(self):
        elements = ring_elements(True) + [building(1, .2, .2), building(2, 1.5, .2), building(3, .96, .96),
                                          {"type": "way", "id": 4, "tags": {"highway": "residential"}, "geometry": []}]
        chosen = chautauqua.scope_filter(elements, {})
        self.assertEqual([e["id"] for e in chosen], [1])

    def test_scope_filter_refuses_an_incomplete_boundary(self):
        with self.assertRaisesRegex(ValueError, "grounds-osm.json"):
            chautauqua.scope_filter([building(1, .2, .2)], {})
        holed = ring_elements(True)
        holed[0]["members"].append({"type": "way", "ref": 12, "role": "inner", "geometry": []})
        with self.assertRaisesRegex(ValueError, "holes"):
            chautauqua.grounds_ring(holed)
        open_ring = ring_elements(True)
        open_ring[0]["members"].pop()
        with self.assertRaisesRegex(ValueError, "close"):
            chautauqua.grounds_ring(open_ring)


if __name__ == "__main__":
    unittest.main()
