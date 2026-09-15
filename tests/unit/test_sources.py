"""Offline tests for tinytown.sources (stage 1: fetch, aerial crops). No network."""
import argparse
import contextlib
import io
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tinytown import sources  # noqa: E402
from tinytown.paths import SitePaths  # noqa: E402
from tinytown.state import atomic_json  # noqa: E402

try:
    from PIL import Image
except ImportError:  # pragma: no cover - the deploy-path python lacks Pillow
    Image = None

REQUEST = {"center": {"lat": 42.91201, "lon": -77.74548}, "size_m": {"w": 420, "h": 380}}


def response(payload):
    return contextlib.closing(io.BytesIO(payload))


class SourcesCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.paths = SitePaths("fixture", root=self.root)
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))
        self.enterContext(contextlib.redirect_stderr(io.StringIO()))
        self.enterContext(patch.object(sources, "OVERPASS_PAUSE", 0))
        self.cache = sources.Cache(self.root / "cache")

    def snapshot(self):
        return {p.name: p.read_bytes() for p in self.paths.source.iterdir() if p.is_file()}

    def setup_cache(self, request=REQUEST):
        self.paths.source.mkdir(parents=True)
        if request is not None:
            atomic_json(self.paths.request, request)
        for path in (self.paths.osm, self.paths.elevation, self.paths.satellite, self.paths.satellite_meta):
            path.write_bytes(b"old data")

    def fake_downloads(self):
        def one(bounds, path, *rest, **kw):
            Path(path).write_bytes(b"new data")

        def satellite(bounds, image, meta, *rest, **kw):
            one(bounds, image)
            one(bounds, meta)

        return [self.enterContext(patch.object(sources, name, side_effect=fn)) for name, fn in
                (("fetch_osm", one), ("fetch_elevation", one), ("fetch_satellite", satellite))]

    def fetch(self, center=(42.91201, -77.74548), size="420,380", **kw):
        return sources.fetch(self.paths, center, size, cache=self.cache, **kw)


class GeometryTests(unittest.TestCase):
    def test_bbox_is_symmetric_and_scaled_by_margin(self):
        bb = sources.bbox_for(42.0, -77.0, 400, 200)
        self.assertAlmostEqual((bb["north"] - bb["south"]) * sources.M_PER_DEG_LAT, 200)
        self.assertAlmostEqual((bb["east"] - bb["west"]) * sources.M_PER_DEG_LAT * math.cos(math.radians(42)), 400)
        self.assertAlmostEqual((bb["north"] + bb["south"]) / 2, 42.0)
        wide = sources.bbox_for(42.0, -77.0, 400, 200, margin=1.25)
        self.assertAlmostEqual((wide["north"] - wide["south"]) / (bb["north"] - bb["south"]), 1.25)
        self.assertEqual(sources.overpass_bbox(bb), f"{bb['south']},{bb['west']},{bb['north']},{bb['east']}")

    def test_tile_maths_round_trip(self):
        x, y = sources.tile_coords(42.91201, -77.74548, 19)
        lat, lon = sources.tile_latlon(x, y, 19)
        self.assertAlmostEqual(lat, 42.91201, places=9)
        self.assertAlmostEqual(lon, -77.74548, places=9)


class CacheTests(SourcesCase):
    def test_request_cache_reuses_shared_response_and_validates_content(self):
        with patch.object(sources.urllib.request, "urlopen", side_effect=lambda *a, **kw: response(b'{"elements": []}')) as download:
            for _ in range(2):
                sources.get("https://fixture/tile/1", validate=sources.valid_osm, cache=self.cache)
            self.assertEqual(download.call_count, 1)
            request = download.call_args[0][0]
            self.assertEqual(request.get_header("User-agent"), sources.USER_AGENT)
            next(self.cache.dir.glob("*.bin")).write_bytes(b'{"remark": "timeout"}')
            sources.get("https://fixture/tile/1", validate=sources.valid_osm, cache=self.cache)
            self.assertEqual(download.call_count, 2)
            refreshing = sources.Cache(self.cache.dir, refresh=True)
            sources.get("https://fixture/tile/1", validate=sources.valid_osm, cache=refreshing)
            self.assertEqual(download.call_count, 3)

    def test_expired_entries_are_refetched(self):
        with patch.object(sources.urllib.request, "urlopen", side_effect=lambda *a, **kw: response(b'{"elements": []}')) as download:
            sources.get("https://fixture/tile/2", cache=self.cache)
            sources.get("https://fixture/tile/2", cache=sources.Cache(self.cache.dir, max_age=0))
            self.assertEqual(download.call_count, 2)

    def test_invalid_download_is_not_cached(self):
        with patch.object(sources.urllib.request, "urlopen", return_value=response(b'{"remark":"timeout"}')):
            with self.assertRaises(ValueError):
                sources.get("https://fixture/bad", validate=sources.valid_osm, cache=self.cache)
        self.assertFalse(self.cache.dir.exists() and list(self.cache.dir.iterdir()))

    def test_no_cache_never_touches_disk(self):
        with patch.object(sources.urllib.request, "urlopen", return_value=response(b"x")):
            self.assertEqual(sources.get("https://fixture/plain"), b"x")
        self.assertFalse(list(self.root.iterdir()))


class OverpassTests(SourcesCase):
    def test_osm_falls_back_to_the_second_host_and_writes_raw_json(self):
        payload = {"version": 0.6, "generator": "fixture", "elements": [
            {"type": "way", "id": 1, "tags": {"building": "yes"}},
            {"type": "way", "id": 2, "tags": {"highway": "residential"}}]}
        calls = []

        def urlopen(request, timeout=None):
            calls.append(request.full_url)
            if len(calls) == 1:
                raise OSError("down")
            return response(json.dumps(payload).encode())

        with patch.object(sources.urllib.request, "urlopen", side_effect=urlopen):
            record = sources.fetch_osm(sources.bbox_for(42, -77, 100, 100), self.root / "osm.json", cache=self.cache)
        self.assertEqual(calls, list(sources.OVERPASS_HOSTS))
        self.assertEqual(record, payload)
        self.assertEqual(json.loads((self.root / "osm.json").read_text()), payload)

    def test_every_host_failing_raises(self):
        with patch.object(sources.urllib.request, "urlopen", side_effect=OSError("down")):
            with self.assertRaises(OSError):
                sources.overpass("[out:json];out;")

    def test_extra_source_substitutes_the_bbox_token(self):
        seen = {}

        def urlopen(request, timeout=None):
            seen["query"] = sources.urllib.parse.parse_qs(request.data.decode())["data"][0]
            return response(b'{"version":0.6,"elements":[{"type":"relation","id":5}]}')

        bb = sources.bbox_for(42, -77, 100, 100)
        with patch.object(sources.urllib.request, "urlopen", side_effect=urlopen):
            sources.fetch_extra("lake", "[out:json];relation(5)({{bbox}});out geom;", bb, self.root / "lake-osm.json")
        self.assertIn(sources.overpass_bbox(bb), seen["query"])
        self.assertNotIn("{{bbox}}", seen["query"])
        self.assertEqual(json.loads((self.root / "lake-osm.json").read_text())["elements"][0]["id"], 5)


class FetchTests(SourcesCase):
    def test_matching_request_reuses_cache(self):
        self.setup_cache()
        downloads = self.fake_downloads()
        before = self.snapshot()
        request = self.fetch()
        for download in downloads:
            download.assert_not_called()
        self.assertEqual(request["center"], REQUEST["center"])
        self.assertEqual({k: v for k, v in self.snapshot().items() if k != "site_request.json"},
                         {k: v for k, v in before.items() if k != "site_request.json"})

    def test_resume_without_coordinates_uses_recorded_request(self):
        self.setup_cache({**REQUEST, "title": "Fixture", "bounds": {"n": 1}})
        self.paths.elevation.unlink()
        downloads = self.fake_downloads()
        request = sources.fetch(self.paths, cache=self.cache)
        downloads[1].assert_called_once()
        downloads[0].assert_not_called()
        downloads[2].assert_not_called()
        self.assertEqual(self.paths.elevation.read_bytes(), b"new data")
        self.assertEqual(request, {**REQUEST, "title": "Fixture", "bounds": {"n": 1}})
        self.assertEqual(json.loads(self.paths.request.read_text()), request)

    def test_resume_without_request_or_coordinates_fails(self):
        with self.assertRaises(sources.RequestMismatch):
            sources.fetch(self.paths, cache=self.cache)

    def test_changed_request_preserves_cache_and_metadata(self):
        self.setup_cache()
        downloads = self.fake_downloads()
        before = self.snapshot()
        for args in ({"center": (40, -75)}, {"size": "500,380"}):
            with self.subTest(args=args), self.assertRaises(sources.RequestMismatch):
                self.fetch(**args)
            self.assertEqual(self.snapshot(), before)
        for download in downloads:
            download.assert_not_called()

    def test_unknown_cache_requires_force(self):
        self.setup_cache(request=None)
        before = self.snapshot()
        with self.assertRaises(sources.RequestMismatch):
            self.fetch()
        self.assertEqual(self.snapshot(), before)

    def test_force_refresh_replaces_every_cached_file(self):
        self.setup_cache({**REQUEST, "title": "Old title", "building_ids": ["1"]})
        downloads = self.fake_downloads()
        request = self.fetch(center="40,-75", force=True)
        for download in downloads:
            download.assert_called_once()
        written = json.loads(self.paths.request.read_text())
        self.assertEqual(written, request)
        self.assertEqual(written["center"], {"lat": 40, "lon": -75})
        self.assertEqual(written["size_m"], {"w": 420, "h": 380})
        self.assertEqual(written["title"], "Old title")
        self.assertNotIn("building_ids", written)
        self.assertEqual(written["bounds"], sources.bbox_for(40, -75, 420, 380))
        self.assertEqual(self.paths.osm.read_bytes(), b"new data")
        self.assertFalse(list(self.paths.source.glob(".fetch-*")))

    def test_fresh_site_records_request_with_bounds_and_title(self):
        self.fake_downloads()
        request = self.fetch(title="Fixture Town")
        self.assertEqual(request["center"], REQUEST["center"])
        self.assertEqual(request["size_m"], {"w": 420.0, "h": 380.0})
        self.assertEqual(request["title"], "Fixture Town")
        self.assertEqual(set(request["bounds"]), {"north", "south", "east", "west"})
        self.assertEqual(request["bounds"], sources.bbox_for(42.91201, -77.74548, 420, 380))
        self.assertEqual(json.loads(self.paths.request.read_text()), request)
        self.assertTrue(self.paths.satellite.exists() and self.paths.satellite_meta.exists())

    def test_invalid_coordinates_are_rejected(self):
        self.fake_downloads()
        for center, size in (((91, 0), "10,10"), ((42, -77), "0,10")):
            with self.subTest(center=center, size=size), self.assertRaises(ValueError):
                sources.fetch(self.paths, center, size, cache=self.cache)
        self.assertFalse(self.paths.source.exists())

    def test_failed_download_leaves_source_intact(self):
        self.setup_cache()
        self.paths.osm.unlink()
        before = self.snapshot()
        with patch.object(sources, "fetch_osm", side_effect=OSError("overpass down")), \
             patch.object(sources, "fetch_elevation"), patch.object(sources, "fetch_satellite"):
            with self.assertRaises(OSError):
                self.fetch()
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(list(self.paths.source.glob(".fetch-*")))

    def test_stages_overlap_and_preview_omits_imagery(self):
        barrier = threading.Barrier(3)

        def download(bb, *paths, **kw):
            barrier.wait(timeout=3)
            for path in paths:
                if isinstance(path, Path):
                    path.write_text("fixture")

        with patch.object(sources, "fetch_osm", side_effect=download), \
             patch.object(sources, "fetch_elevation", side_effect=download), \
             patch.object(sources, "fetch_satellite", side_effect=download):
            self.fetch()  # deadlocks/times out if stages regress to sequential

        def preview(bb, path, *rest, **kw):
            Path(path).write_text("fixture")

        with patch.object(sources, "fetch_osm", side_effect=preview), \
             patch.object(sources, "fetch_elevation", side_effect=preview), \
             patch.object(sources, "fetch_satellite") as satellite:
            self.fetch(center=(42.0, -77.0), force=True, satellite=False)
            satellite.assert_not_called()
        # A resized preview must not retain imagery from the previous extent.
        self.assertFalse(self.paths.satellite.exists())
        self.assertFalse(self.paths.satellite_meta.exists())

    def test_extra_sources_are_fetched_into_named_files_and_skipped_when_present(self):
        self.fake_downloads()
        extras = []

        def fake_extra(name, query, bb, out, *rest, **kw):
            extras.append((name, query, bb))
            Path(out).write_text("{}")

        with patch.object(sources, "fetch_extra", side_effect=fake_extra):
            self.fetch(extra_sources=lambda request: {"lake": f"relation(1)({{{{bbox}}}});# {request['center']['lat']}"})
            self.assertEqual([e[0] for e in extras], ["lake"])
            self.assertIn("{{bbox}}", extras[0][1])
            self.assertEqual(extras[0][2], sources.bbox_for(42.91201, -77.74548, 420, 380, sources.OSM_MARGIN))
            self.assertTrue(self.paths.extra_source("lake").exists())
            self.fetch(extra_sources={"lake": "again", "barriers": "way[barrier]({{bbox}});"})
        self.assertEqual([e[0] for e in extras], ["lake", "barriers"])
        self.assertTrue(self.paths.extra_source("barriers").exists())

    def test_margin_scales_every_service_box(self):
        boxes = {}

        def record(name):
            def fn(bb, *paths, **kw):
                boxes[name] = bb
                for path in paths:
                    if isinstance(path, Path):
                        path.write_text("fixture")
            return fn

        with patch.object(sources, "fetch_osm", side_effect=record("osm")), \
             patch.object(sources, "fetch_elevation", side_effect=record("elevation")), \
             patch.object(sources, "fetch_satellite", side_effect=record("satellite")):
            self.fetch(margin=2.0)
        lat, lon = 42.91201, -77.74548
        self.assertEqual(boxes["osm"], sources.bbox_for(lat, lon, 420, 380, 2.0 * sources.OSM_MARGIN))
        self.assertEqual(boxes["elevation"], sources.bbox_for(lat, lon, 420, 380, 2.0 * sources.ELEVATION_MARGIN))
        self.assertEqual(boxes["satellite"], sources.bbox_for(lat, lon, 420, 380, 2.0 * sources.SATELLITE_MARGIN))


@unittest.skipUnless(Image, "Pillow not installed")
class ImageryTests(SourcesCase):
    def png(self, size=(256, 256), color=(90, 120, 60)):
        buffer = io.BytesIO()
        Image.new("RGB", size, color).save(buffer, format="PNG")
        return buffer.getvalue()

    def test_satellite_mosaic_and_metadata(self):
        requested = []

        def urlopen(request, timeout=None):
            requested.append(request.full_url)
            return response(self.png())

        bb = sources.bbox_for(42.91201, -77.74548, 60, 60)
        with patch.object(sources.urllib.request, "urlopen", side_effect=urlopen):
            meta = sources.fetch_satellite(bb, self.root / "satellite.jpg", self.root / "satellite.json", z=19, cache=self.cache)
        self.assertTrue(all("World_Imagery/MapServer/tile/19/" in url for url in requested))
        self.assertEqual(len(requested), len(set(requested)))
        with Image.open(self.root / "satellite.jpg") as mosaic:
            self.assertEqual(list(mosaic.size), meta["px"])
            self.assertEqual(mosaic.format, "JPEG")
        self.assertEqual(set(meta), {"z", "px", "bounds", "source"})
        self.assertEqual(meta["z"], 19)
        self.assertEqual(meta["source"], "Esri World Imagery")
        self.assertEqual(set(meta["bounds"]), {"north", "south", "west", "east"})
        self.assertLess(meta["bounds"]["west"], bb["west"])
        self.assertGreater(meta["bounds"]["east"], bb["east"])
        self.assertGreater(meta["bounds"]["north"], bb["north"])
        self.assertLess(meta["bounds"]["south"], bb["south"])
        self.assertEqual(json.loads((self.root / "satellite.json").read_text()), meta)
        self.assertEqual(meta["px"][0] % 256, 0)

    def test_tile_retries_then_raises(self):
        with patch.object(sources.urllib.request, "urlopen", side_effect=OSError("503")) as download, \
             patch.object(sources.time, "sleep") as sleep:
            with self.assertRaises(OSError):
                sources.fetch_tile(19, 1, 2)
        self.assertEqual(download.call_count, sources.TILE_ATTEMPTS)
        self.assertEqual(sleep.call_count, sources.TILE_ATTEMPTS - 1)

    def test_elevation_grid_record(self):
        grid = Image.new("F", (4, 3))
        grid.putdata([100.5, 101.25, -9999.0, 103.0] + [110.0] * 4 + [120.0] * 4)
        buffer = io.BytesIO()
        grid.save(buffer, format="TIFF")
        bb = sources.bbox_for(42, -77, 100, 100)
        with patch.object(sources.urllib.request, "urlopen", return_value=response(buffer.getvalue())) as download:
            record = sources.fetch_elevation(bb, self.root / "elevation.json", grid=(4, 3), cache=self.cache)
        url = download.call_args[0][0].full_url
        self.assertTrue(url.startswith(sources.ELEVATION_URL))
        self.assertIn("size=4%2C3", url)
        self.assertEqual(set(record), {"cols", "rows", "bounds", "order", "units", "values"})
        self.assertEqual((record["cols"], record["rows"]), (4, 3))
        self.assertEqual(record["bounds"], bb)
        self.assertEqual(record["order"], "row-major from north-west")
        self.assertEqual(record["units"], "m")
        self.assertEqual(len(record["values"]), 12)
        self.assertEqual(record["values"][:4], [100.5, 101.25, 100.5, 103.0])  # no-data filled with the minimum
        self.assertEqual(json.loads((self.root / "elevation.json").read_text()), record)


@unittest.skipUnless(Image, "Pillow not installed")
class AerialTests(SourcesCase):
    def setUp(self):
        super().setUp()
        self.paths.source.mkdir(parents=True)
        lat, lon = 42.0, -77.0
        self.bounds = sources.bbox_for(lat, lon, 400, 400)
        self.meta = {"z": 19, "px": [800, 800], "bounds": self.bounds, "source": "Esri World Imagery"}
        Image.new("RGB", (800, 800), (40, 90, 30)).save(self.paths.satellite, quality=90)
        atomic_json(self.paths.satellite_meta, self.meta)
        self.site = {"name": "fixture", "center": {"lat": lat, "lon": lon}, "buildings": [
            {"id": 1, "pts": [[-6, -4], [6, -4], [6, 4], [-6, 4]]},
            {"id": -22, "pts": [[50, 50], [70, 50], [70, 60], [50, 60]]},
            {"id": 3, "pts": [[190, 190], [210, 190], [210, 210], [190, 210]]}]}
        atomic_json(self.paths.scene, self.site)

    def test_crop_records_match_the_legacy_format(self):
        written = sources.crop_aerials(self.paths, ["1", -22])
        self.assertEqual(written, [self.paths.building("1").aerial, self.paths.building("-22").aerial])
        record = json.loads(self.paths.building("1").aerial.read_text())
        self.assertEqual(list(record), ["source", "source_metadata", "crop_pixels", "source_pixels",
                                        "decoded_pixels", "north_up", "id", "note"])
        self.assertEqual(record["source"], "data/fixture/source/satellite.jpg")
        self.assertEqual(record["source_metadata"], self.meta)
        self.assertEqual(record["source_pixels"], [800, 800])
        self.assertEqual(record["decoded_pixels"], [800, 800])
        self.assertTrue(record["north_up"])
        self.assertEqual(record["id"], "1")
        self.assertEqual(record["note"], sources.AERIAL_NOTE)
        x0, y0, x1, y1 = record["crop_pixels"]
        self.assertAlmostEqual(x1 - x0, 12 * 2 + 2 * sources.AERIAL_PAD, delta=2)  # 12 m footprint at 0.5 m/px, padded
        self.assertAlmostEqual((x0 + x1) / 2, 400, delta=1.5)
        self.assertAlmostEqual((y0 + y1) / 2, 400, delta=1.5)
        crop_path = self.paths.building("1").dir / "aerial.png"
        with Image.open(crop_path) as crop:
            self.assertEqual(crop.size, (x1 - x0, y1 - y0))
        footprint = self.paths.building("1").dir / "aerial_footprint.png"
        with Image.open(footprint) as annotated:
            colours = {c for _, c in annotated.convert("RGB").getcolors()}
        self.assertIn((255, 218, 97), colours)  # the yellow footprint outline
        self.assertFalse(self.paths.building("3").aerial.exists())

    def test_crops_are_idempotent_unless_forced(self):
        sources.crop_aerials(self.paths, ["1"])
        first = self.paths.building("1").aerial.stat().st_mtime_ns
        self.assertEqual(sources.crop_aerials(self.paths, ["1"]), [])
        self.assertEqual(self.paths.building("1").aerial.stat().st_mtime_ns, first)
        (self.paths.building("1").dir / "aerial.png").unlink()
        self.assertEqual(sources.crop_aerials(self.paths, ["1"]), [self.paths.building("1").aerial])
        self.assertEqual(sources.crop_aerials(self.paths, ["1"], force=True), [self.paths.building("1").aerial])

    def test_all_buildings_by_default_and_outside_imagery_is_reported_after_the_rest(self):
        with self.assertRaises(ValueError) as caught:
            sources.crop_aerials(self.paths)
        self.assertIn("3", str(caught.exception))
        self.assertTrue(self.paths.building("1").aerial.exists())
        self.assertTrue(self.paths.building("-22").aerial.exists())
        self.assertFalse(self.paths.building("3").dir.exists())

    def test_crop_from_another_sites_imagery(self):
        other = SitePaths("region", root=self.root)
        other.source.mkdir(parents=True)
        self.paths.satellite.rename(other.satellite)
        self.paths.satellite_meta.rename(other.satellite_meta)
        with self.assertRaises(FileNotFoundError):
            sources.crop_aerials(self.paths, ["1"])
        sources.crop_aerials(self.paths, ["1"], source=other)
        record = json.loads(self.paths.building("1").aerial.read_text())
        self.assertEqual(record["source"], "data/region/source/satellite.jpg")
        sources.crop_aerials(self.paths, ["-22"], source=other.source)
        self.assertTrue(self.paths.building("-22").aerial.exists())

    def test_unknown_building_and_missing_scene(self):
        with self.assertRaises(KeyError):
            sources.crop_aerials(self.paths, ["999"])
        self.paths.scene.unlink()
        with self.assertRaises(FileNotFoundError):
            sources.crop_aerials(self.paths, ["1"])


class CliTests(SourcesCase):
    def parser(self):
        parser = argparse.ArgumentParser(prog="town")
        sources.register(parser.add_subparsers(dest="verb"))
        return parser

    def test_register_parses_every_option(self):
        args = self.parser().parse_args(["fetch", "fixture", "--center", "42,-77", "--size", "300,200", "--title", "T",
                                         "--no-satellite", "--force", "--aerials", "1", "-22"])
        self.assertEqual(args.verb, "fetch")
        self.assertEqual(args.site, "fixture")
        self.assertEqual((args.center, args.size, args.title), ("42,-77", "300,200", "T"))
        self.assertTrue(args.no_satellite and args.force)
        self.assertEqual(args.aerials, ["1", "-22"])
        self.assertEqual(args.run, sources.run_fetch)
        bare = self.parser().parse_args(["fetch", "fixture"])
        self.assertIsNone(bare.center)
        self.assertIsNone(bare.aerials)
        self.assertEqual(self.parser().parse_args(["fetch", "fixture", "--aerials"]).aerials, [])

    def test_run_fetch_passes_plugin_sources_and_crops(self):
        args = self.parser().parse_args(["fetch", "fixture", "--center", "42,-77", "--size", "300,200",
                                         "--no-satellite", "--aerials"])
        hook = lambda request: {"lake": "q"}  # noqa: E731
        with patch.object(sources, "site_paths", return_value=self.paths), \
             patch.object(sources, "_plugin_sources", return_value=hook) as plugin, \
             patch.object(sources, "fetch") as fetch, patch.object(sources, "crop_aerials") as crop:
            self.assertEqual(sources.run_fetch(args), 0)
        plugin.assert_called_once_with("fixture")
        kwargs = fetch.call_args.kwargs
        self.assertIs(kwargs["extra_sources"], hook)
        self.assertFalse(kwargs["satellite"])
        self.assertTrue(kwargs["elevation"])
        self.assertIsInstance(kwargs["cache"], sources.Cache)
        self.assertEqual(kwargs["cache"].dir, self.root / "data" / ".town-cache")
        crop.assert_called_once_with(self.paths, None, source=None, force=False)

    def test_run_fetch_reports_mismatch_as_exit(self):
        self.setup_cache()
        args = self.parser().parse_args(["fetch", "fixture", "--center", "40,-75", "--size", "420,380"])
        with patch.object(sources, "site_paths", return_value=self.paths), \
             patch.object(sources, "_plugin_sources", return_value=None):
            with self.assertRaises(SystemExit):
                sources.run_fetch(args)

    def test_plugin_sources_for_a_site_without_config(self):
        from tinytown import config
        with patch.object(config, "plugin", side_effect=KeyError("unknown site")):
            self.assertIsNone(sources._plugin_sources("nowhere"))
        missing = ModuleNotFoundError("no plugin", name="tinytown.plugins.nowhere")
        with patch.object(config, "plugin", side_effect=missing):
            self.assertIsNone(sources._plugin_sources("nowhere"))
        with patch.object(config, "plugin", side_effect=ModuleNotFoundError("dep", name="numpy")):
            with self.assertRaises(ModuleNotFoundError):
                sources._plugin_sources("nowhere")
        hook = object()
        with patch.object(config, "plugin", return_value=type("Plugin", (), {"extra_sources": hook})):
            self.assertIs(sources._plugin_sources("nowhere"), hook)

    def test_module_imports_with_the_standard_library_only(self):
        code = ("import sys; sys.path.insert(0, %r); import tinytown.sources; "
                "assert 'PIL' not in sys.modules and 'websocket' not in sys.modules") % str(ROOT)
        subprocess.run([sys.executable, "-B", "-c", code], check=True)


if __name__ == "__main__":
    unittest.main()
