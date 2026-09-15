"""Stage 1: fetch the public source data for a site, and crop aerials per building.

    town fetch avon --center 42.91201,-77.74548 --size 340,380 --title "avon.town"
    town fetch avon                      # resume: fetch whatever source/ still lacks
    town fetch avon --aerials 123 456    # then crop aerial references for two buildings

`fetch(paths, center, size_m)` pulls, for a box of `size_m` metres (east-west,
north-south) around `center`, into data/<site>/source/:

  site_request.json   {"center": {"lat", "lon"}, "size_m": {"w", "h"}, "bounds": {...}, "title"?}
  osm.json            Overpass JSON: buildings, roads, rails, water, land cover, trees, POIs
  elevation.json      {"cols", "rows", "bounds", "order", "units", "values": [m, ...]}
                      row-major from the north-west corner
  satellite.jpg       Esri World Imagery mosaic (gitignored; refetched on demand)
  satellite.json      {"z", "px": [w, h], "bounds": {...}, "source": "Esri World Imagery"}
  <name>-osm.json     any extra Overpass extract a site plugin asks for
                      (`plugins/<site>.py: extra_sources(request) -> {name: query}`;
                      the token {{bbox}} in a query becomes "south,west,north,east")

Everything is public and keyless. Re-running skips files that already exist
and errors when the recorded request has different coordinates or size;
pass --force to refetch. Individual HTTP responses are cached for 30 days in
data/.town-cache/ (shared by adjacent sites; imagery tiles overlap) and only
validated responses enter the cache. Downloads are staged in source/.fetch-*
and moved into place at the end, so a failed refresh leaves the previous
cache and its request record intact. Independent services run concurrently;
Overpass gets one request at a time with a pause between queries.

`crop_aerials(paths, ids)` needs a built scene (site.json) and the satellite
mosaic. For every building it writes buildings/<id>/aerial.png (the crop),
aerial_footprint.png (the mapped footprint drawn in yellow) and aerial.json:

  {"source": "data/<site>/source/satellite.jpg", "source_metadata": <satellite.json>,
   "crop_pixels": [x0, y0, x1, y1], "source_pixels": [w, h], "decoded_pixels": [w, h],
   "north_up": true, "id": "<id>", "note": "Yellow outline is the mapped footprint, ..."}

It is exposed both as a function (references.py imports it) and through
`town fetch <site> --aerials [ID ...]`, which crops the listed buildings, or
every building in the scene when none are listed, after the idempotent fetch.

Data sources and their terms
----------------------------
* OpenStreetMap data via the Overpass API (overpass-api.de, with
  overpass.kumi.systems as a fallback). (c) OpenStreetMap contributors, Open
  Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright.
  Derived miniatures must credit "(c) OpenStreetMap contributors".
* USGS 3D Elevation Program (3DEP) bare-earth elevation, exported from the
  National Map ImageServer (elevation.nationalmap.gov). U.S. public domain;
  cite "U.S. Geological Survey, 3D Elevation Program": https://www.usgs.gov/3dep.
* Esri World Imagery tiles (server.arcgisonline.com). Research reference only,
  never redistributed: satellite.jpg and the aerial crops are gitignored and are
  not part of any deployment. Use is subject to the Esri Master Agreement and
  the World Imagery attribution requirements ("Esri, Maxar, Earthstar
  Geographics, and the GIS User Community"):
  https://www.esri.com/en-us/legal/terms/full-master-agreement.

Only the standard library is imported at module level; PIL is imported inside
the functions that decode imagery.
"""
import hashlib
import io
import json
import math
import os
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .paths import SitePaths, site_paths
from .site import M_PER_DEG_LAT, find_building, load_site, to_latlon
from .state import atomic_json, read_json

USER_AGENT = "tiny-town/0.2 (+https://github.com/koomen/tinytown)"
HEADERS = {"User-Agent": USER_AGENT}

OVERPASS_HOSTS = ("https://overpass-api.de/api/interpreter",
                  "https://overpass.kumi.systems/api/interpreter")
ELEVATION_URL = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
IMAGERY_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
IMAGERY_SOURCE = "Esri World Imagery"

# Each service gets a slightly more generous box than the miniature itself so
# roads run off the edge cleanly, terrain covers the margin, and aerial crops
# near the edge stay inside the mosaic.
OSM_MARGIN = 1.25
ELEVATION_MARGIN = 1.3
SATELLITE_MARGIN = 1.1
ELEVATION_GRID = (96, 96)
SATELLITE_ZOOM = 19
TILE_SIZE = 256
TILE_WORKERS = 8
TILE_ATTEMPTS = 3
OVERPASS_PAUSE = 1.0      # seconds between successive Overpass queries
CACHE_MAX_AGE = 30 * 86400
AERIAL_PAD = 45           # pixels of context around a footprint crop
AERIAL_NOTE = "Yellow outline is the mapped footprint, not an observed roof outline."

OVERPASS_QUERY = """[out:json][timeout:90];
(
  way["building"]({bbox});
  relation["building"]({bbox});
  way["highway"]({bbox});
  way["railway"]({bbox});
  way["waterway"]({bbox});
  way["landuse"]({bbox});
  way["leisure"]({bbox});
  way["natural"]({bbox});
  way["amenity"]({bbox});
  way["man_made"]({bbox});
  node["natural"="tree"]({bbox});
  node["amenity"]({bbox});
  node["shop"]({bbox});
  node["historic"]({bbox});
  node["tourism"]({bbox});
  node["man_made"]({bbox});
  node["highway"="street_lamp"]({bbox});
);
out body geom;"""


class RequestMismatch(ValueError):
    """source/ holds data for different coordinates or size than requested."""


# --- HTTP with a validated, shared response cache ----------------------------

class Cache:
    """Individual responses, including imagery tiles shared by adjacent sites.

    Completed requests survive a later stage failing. Only validated responses
    enter the cache; atomic replacement also permits independent jobs.
    """

    def __init__(self, directory, max_age=CACHE_MAX_AGE, refresh=False):
        self.dir = Path(directory) if directory is not None else None
        self.max_age = max_age
        self.refresh = refresh

    def path(self, url, data=None):
        if self.dir is None:
            return None
        key = hashlib.sha256(url.encode() + b"\0" + (data or b"")).hexdigest()
        return self.dir / (key + ".bin")

    def load(self, path, validate=None):
        if path is None or self.refresh or not path.exists():
            return None
        if time.time() - path.stat().st_mtime >= self.max_age:
            return None
        raw = path.read_bytes()
        try:
            if validate:
                validate(raw)
        except Exception:  # noqa: BLE001 - discard an incomplete or obsolete entry
            return None
        return raw

    def store(self, path, raw):
        if path is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            temp = Path(stream.name)
            stream.write(raw)
        try:
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)


NO_CACHE = Cache(None)


def default_cache_dir(paths):
    """data/.town-cache/, next to every site's data directory."""
    return paths.data.parent / ".town-cache"


def get(url, data=None, timeout=120, validate=None, cache=NO_CACHE):
    """GET (or POST when `data` is given) with the polite User-Agent and the response cache."""
    path = cache.path(url, data)
    raw = cache.load(path, validate)
    if raw is not None:
        return raw
    request = urllib.request.Request(url, data=data, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
    if validate:
        validate(raw)
    cache.store(path, raw)
    return raw


def valid_osm(raw):
    value = json.loads(raw)
    if not isinstance(value.get("elements"), list) or value.get("remark"):
        raise ValueError("Overpass returned an incomplete result")


def valid_image(raw):
    from PIL import Image
    with Image.open(io.BytesIO(raw)) as image:
        image.load()


# --- geometry -----------------------------------------------------------------

def bbox_for(lat, lon, w_m, h_m, margin=1.0):
    """{south, north, west, east} of a w x h metre box around (lat, lon), scaled by margin."""
    dlat = (h_m / 2) * margin / M_PER_DEG_LAT
    dlon = (w_m / 2) * margin / (M_PER_DEG_LAT * math.cos(math.radians(lat)))
    return {"south": lat - dlat, "north": lat + dlat, "west": lon - dlon, "east": lon + dlon}


def overpass_bbox(bb):
    """Overpass bounding-box syntax: south,west,north,east."""
    return f"{bb['south']},{bb['west']},{bb['north']},{bb['east']}"


def _pair(value, keys):
    """(a, b) from a tuple/list, a 'a,b' string, or a dict with `keys`."""
    if isinstance(value, dict):
        return float(value[keys[0]]), float(value[keys[1]])
    if isinstance(value, str):
        value = value.split(",")
    a, b = value
    return float(a), float(b)


# --- the individual services --------------------------------------------------

_overpass_lock = threading.Lock()
_overpass_last = [0.0]


def overpass(query, cache=NO_CACHE, log=print):
    """One Overpass query, tried on each host in turn, at most one at a time."""
    data = urllib.parse.urlencode({"data": query}).encode()
    with _overpass_lock:
        wait = _overpass_last[0] + OVERPASS_PAUSE - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        try:
            errors = []
            for host in OVERPASS_HOSTS:
                try:
                    return json.loads(get(host, data=data, timeout=180, validate=valid_osm, cache=cache))
                except Exception as error:  # noqa: BLE001 - try the next mirror
                    errors.append(f"{host}: {error}")
                    print(f"  overpass {host} failed: {error}", file=sys.stderr)
            raise OSError("Overpass unavailable: " + "; ".join(errors))
        finally:
            _overpass_last[0] = time.monotonic()


def fetch_osm(bb, out, cache=NO_CACHE, log=print):
    raw = overpass(OVERPASS_QUERY.format(bbox=overpass_bbox(bb)), cache, log)
    atomic_json(out, raw, compact=True)
    elements = raw["elements"]
    buildings = sum(1 for e in elements if "building" in e.get("tags", {}))
    ways = sum(1 for e in elements if "highway" in e.get("tags", {}) and e["type"] == "way")
    log(f"  osm: {len(elements)} elements ({buildings} buildings, {ways} road/path ways)")
    return raw


def fetch_extra(name, query, bb, out, cache=NO_CACHE, log=print):
    """A plugin's extra Overpass extract; {{bbox}} in the query is the OSM box."""
    raw = overpass(query.replace("{{bbox}}", overpass_bbox(bb)), cache, log)
    atomic_json(out, raw, compact=True)
    log(f"  {name}: {len(raw['elements'])} elements")
    return raw


def fetch_elevation(bb, out, grid=ELEVATION_GRID, cache=NO_CACHE, log=print):
    cols, rows = grid
    url = ELEVATION_URL + "?" + urllib.parse.urlencode({
        "bbox": f"{bb['west']},{bb['south']},{bb['east']},{bb['north']}",
        "bboxSR": "4326", "imageSR": "4326", "size": f"{cols},{rows}",
        "format": "tiff", "pixelType": "F32", "noData": "-9999",
        "interpolation": "RSP_BilinearInterpolation", "f": "image",
    })
    from PIL import Image
    with Image.open(io.BytesIO(get(url, validate=valid_image, cache=cache))) as image:
        size = image.size
        values = list(image.get_flattened_data()) if hasattr(image, "get_flattened_data") else list(image.getdata())
    good = [v for v in values if v > -1000]
    if not good:
        raise ValueError("elevation export contains no data")
    lo, hi = min(good), max(good)
    values = [v if v > -1000 else lo for v in values]
    record = {"cols": size[0], "rows": size[1], "bounds": bb, "order": "row-major from north-west",
              "units": "m", "values": [round(v, 2) for v in values]}
    atomic_json(out, record, compact=True)
    log(f"  elevation: {size[0]}x{size[1]} grid, {lo:.1f}..{hi:.1f} m")
    return record


def tile_coords(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def tile_latlon(x, y, z):
    n = 2 ** z
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n)))), x / n * 360 - 180


def fetch_tile(z, x, y, cache=NO_CACHE):
    for attempt in range(TILE_ATTEMPTS):
        try:
            return get(IMAGERY_TILE.format(z=z, x=x, y=y), timeout=25, validate=valid_image, cache=cache)
        except (OSError, ValueError):
            if attempt == TILE_ATTEMPTS - 1:
                raise
            time.sleep(attempt + 1)  # back off politely before retrying a tile


def fetch_satellite(bb, out_image, out_meta, z=SATELLITE_ZOOM, cache=NO_CACHE, log=print):
    x0, y0 = tile_coords(bb["north"], bb["west"], z)
    x1, y1 = tile_coords(bb["south"], bb["east"], z)
    xs = list(range(int(x0), int(x1) + 1))
    ys = list(range(int(y0), int(y1) + 1))
    coords = [(x, y) for y in ys for x in xs]
    with ThreadPoolExecutor(TILE_WORKERS) as pool:
        tiles = list(pool.map(lambda xy: fetch_tile(z, xy[0], xy[1], cache), coords))
    from PIL import Image
    mosaic = Image.new("RGB", (len(xs) * TILE_SIZE, len(ys) * TILE_SIZE))
    for (x, y), raw in zip(coords, tiles):
        with Image.open(io.BytesIO(raw)) as tile:
            mosaic.paste(tile.convert("RGB"), ((x - xs[0]) * TILE_SIZE, (y - ys[0]) * TILE_SIZE))
    out_image = Path(out_image)
    out_image.parent.mkdir(parents=True, exist_ok=True)
    mosaic.save(out_image, format="JPEG", quality=90)
    north, west = tile_latlon(xs[0], ys[0], z)
    south, east = tile_latlon(xs[-1] + 1, ys[-1] + 1, z)
    meta = {"z": z, "px": list(mosaic.size),
            "bounds": {"north": north, "south": south, "west": west, "east": east},
            "source": IMAGERY_SOURCE}
    atomic_json(out_meta, meta)
    log(f"  satellite: {mosaic.size[0]}x{mosaic.size[1]} px mosaic of {len(tiles)} tiles")
    return meta


# --- stage 1 ------------------------------------------------------------------

def _request(paths, center, size_m, title, force):
    """The request record to write, reconciled with the one already on disk."""
    previous = read_json(paths.request)
    if isinstance(previous, dict) and not ("center" in previous and "size_m" in previous):
        previous = None
    if center is None or size_m is None:
        if previous is None:
            raise RequestMismatch(f"{paths.request} is missing; pass --center and --size")
        request = dict(previous)
    else:
        lat, lon = _pair(center, ("lat", "lon"))
        w, h = _pair(size_m, ("w", "h"))
        if not (-85 < lat < 85 and -180 <= lon <= 180 and w > 0 and h > 0):
            raise ValueError("coordinates must be valid and size must be positive")
        request = {"center": {"lat": lat, "lon": lon}, "size_m": {"w": w, "h": h}}
        same = previous is not None and previous["center"] == request["center"] and previous["size_m"] == request["size_m"]
        if same:
            request = {**previous, **request}
        elif previous is not None and not force:
            raise RequestMismatch(f"{paths.source} holds data for {previous['center']} {previous['size_m']}, "
                                  f"not {request['center']} {request['size_m']}; use --force to refetch")
        elif previous is not None and previous.get("title") and not title:
            request["title"] = previous["title"]
        request.setdefault("bounds", bbox_for(lat, lon, w, h))
    if title:
        request["title"] = title
    return request, previous


def _cached_files(paths):
    return [p for p in (paths.osm, paths.elevation, paths.satellite, paths.satellite_meta) if p.exists()]


def fetch(paths, center=None, size_m=None, *, margin=1.0, satellite=True, elevation=True, extra_sources=None,
          title=None, force=False, zoom=SATELLITE_ZOOM, grid=ELEVATION_GRID, cache=None, log=print):
    """Fetch every missing source file for `paths` (a SitePaths) and return the request record.

    `center` is (lat, lon) or 'lat,lon'; `size_m` is (w, h) metres or 'w,h'.
    Omit both to resume the request recorded in site_request.json. `margin`
    scales every service box (each service also keeps its own generosity).
    `extra_sources` is {name: overpass_query} or a callable request -> that
    dict; each is written to source/<name>-osm.json. Existing files are kept
    unless `force`; a different request than the recorded one needs `force`.
    """
    paths = paths if isinstance(paths, SitePaths) else site_paths(paths)
    request, previous = _request(paths, center, size_m, title, force)
    if previous is None and _cached_files(paths) and not force:
        raise RequestMismatch(f"{paths.source} holds data with an unknown request; use --force to refetch")
    if cache is None:
        cache = Cache(default_cache_dir(paths), refresh=force)
    lat, lon = request["center"]["lat"], request["center"]["lon"]
    w, h = request["size_m"]["w"], request["size_m"]["h"]
    if callable(extra_sources):
        extra_sources = extra_sources(request) or {}
    extra_sources = dict(extra_sources or {})

    paths.source.mkdir(parents=True, exist_ok=True)
    log(f"site {paths.name}: {lat},{lon} {w:.0f}x{h:.0f} m -> {paths.source}")
    osm_box = bbox_for(lat, lon, w, h, margin * OSM_MARGIN)
    # A failed refresh must leave both the old metadata and old data intact.
    with tempfile.TemporaryDirectory(prefix=".fetch-", dir=paths.source) as temp:
        stage = Path(temp)

        def osm_jobs():
            if force or not paths.osm.exists():
                fetch_osm(osm_box, stage / paths.osm.name, cache, log)
            for name, query in extra_sources.items():
                if force or not paths.extra_source(name).exists():
                    fetch_extra(name, query, osm_box, stage / paths.extra_source(name).name, cache, log)

        jobs = []
        # Independent services run concurrently; Overpass itself gets one request at a time.
        with ThreadPoolExecutor(max_workers=3) as pool:
            jobs.append(pool.submit(osm_jobs))
            if elevation and (force or not paths.elevation.exists()):
                jobs.append(pool.submit(fetch_elevation, bbox_for(lat, lon, w, h, margin * ELEVATION_MARGIN),
                                        stage / paths.elevation.name, grid, cache, log))
            if satellite and (force or not (paths.satellite.exists() and paths.satellite_meta.exists())):
                jobs.append(pool.submit(fetch_satellite, bbox_for(lat, lon, w, h, margin * SATELLITE_MARGIN),
                                        stage / paths.satellite.name, stage / paths.satellite_meta.name, zoom, cache, log))
            for job in jobs:
                job.result()
        # A resized preview must not retain imagery from the previous extent.
        if force and not satellite and previous is not None and (
                previous["center"] != request["center"] or previous["size_m"] != request["size_m"]):
            paths.satellite.unlink(missing_ok=True)
            paths.satellite_meta.unlink(missing_ok=True)
        for path in stage.iterdir():
            os.replace(path, paths.source / path.name)
        atomic_json(paths.request, request)
    log("done")
    return request


# --- aerial crops -------------------------------------------------------------

def _imagery(source):
    """(satellite.jpg, satellite.json record) for a SitePaths or a directory holding them."""
    if isinstance(source, SitePaths):
        image, meta = source.satellite, source.satellite_meta
    else:
        source = Path(source)
        if source.is_file():
            image, meta = source, source.with_suffix(".json")
        else:
            image, meta = source / "satellite.jpg", source / "satellite.json"
    if not image.is_file() or not meta.is_file():
        raise FileNotFoundError(f"no satellite mosaic at {image}; run `town fetch` first")
    return image, json.loads(meta.read_text())


def _mercator(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def crop_aerials(paths, ids=None, *, source=None, force=False, pad=AERIAL_PAD, log=print):
    """Crop the georeferenced mosaic around each building's footprint.

    `ids` defaults to every building in the built scene. `source` is another
    SitePaths (or a source directory / satellite.jpg) whose imagery covers the
    site; the default is the site's own mosaic. Records already on disk with
    the same crop are kept unless `force`. Returns the aerial.json paths
    written; raises ValueError afterwards for buildings outside the imagery.
    No building model or invented roof information comes from the imagery.
    """
    from PIL import Image, ImageDraw
    paths = paths if isinstance(paths, SitePaths) else site_paths(paths)
    if not paths.scene.is_file():
        raise FileNotFoundError(f"{paths.scene} is missing; run `town build {paths.name}` before cropping aerials")
    site = load_site(paths)
    image_path, meta = _imagery(source if source is not None else paths)
    bounds = meta["bounds"]
    try:
        source_label = paths.relative(image_path)
    except ValueError:
        source_label = str(image_path)
    buildings = [find_building(site, bid) for bid in ids] if ids is not None else list(site["buildings"])

    # These mosaics can exceed Pillow's default photo limit. Decode a JPEG
    # overview in the codec before allocating RGB pixels; a research batch
    # needs sub-metre imagery, not a 900 MB full-resolution intermediate.
    limit = Image.MAX_IMAGE_PIXELS
    try:
        Image.MAX_IMAGE_PIXELS = max(limit or 0, 400_000_000)
        with Image.open(image_path) as original:
            source_size = original.size
            original.draft("RGB", (8000, 8000))
            image = original.convert("RGB")
    finally:
        Image.MAX_IMAGE_PIXELS = limit

    north, south = _mercator(bounds["north"]), _mercator(bounds["south"])

    def pixel(x, z):
        lat, lon = to_latlon(site, x, z)
        return ((lon - bounds["west"]) / (bounds["east"] - bounds["west"]) * image.width,
                (north - _mercator(lat)) / (north - south) * image.height)

    written, outside = [], []
    for b in buildings:
        bid = str(b["id"])
        building = paths.building(bid)
        pts = [pixel(*p) for p in b["pts"]]
        box = (math.floor(min(x for x, _ in pts) - pad), math.floor(min(y for _, y in pts) - pad),
               math.ceil(max(x for x, _ in pts) + pad), math.ceil(max(y for _, y in pts) + pad))
        if box[0] < 0 or box[1] < 0 or box[2] > image.width or box[3] > image.height:
            outside.append(bid)
            continue
        crop_path = building.dir / "aerial.png"
        footprint_path = building.dir / "aerial_footprint.png"
        record = {"source": source_label, "source_metadata": meta, "crop_pixels": list(box),
                  "source_pixels": list(source_size), "decoded_pixels": list(image.size),
                  "north_up": True, "id": bid, "note": AERIAL_NOTE}
        existing = read_json(building.aerial)
        if not force and existing == record and crop_path.is_file() and footprint_path.is_file():
            continue
        crop = image.crop(box)
        building.dir.mkdir(parents=True, exist_ok=True)
        crop.save(crop_path)
        annotated = crop.copy()
        outline = [(x - box[0], y - box[1]) for x, y in pts + [pts[0]]]
        ImageDraw.Draw(annotated).line(outline, fill="#ffda61", width=2)
        annotated.save(footprint_path)
        atomic_json(building.aerial, record)
        written.append(building.aerial)
        log(str(building.aerial))
    if outside:
        raise ValueError(f"target crop outside cached imagery: {', '.join(outside)}")
    return written


# --- CLI ----------------------------------------------------------------------

def _plugin_sources(name):
    """The site plugin's extra_sources hook, or None for sites without one."""
    from . import config
    try:
        plugin = config.plugin(name)
    except KeyError:
        return None  # a brand-new site has no sites/<name>/site.json yet
    except ModuleNotFoundError as error:
        if not (error.name or "").startswith("tinytown.plugins."):
            raise
        print(f"town fetch: plugin {error.name} is not in this checkout; fetching without extra sources", file=sys.stderr)
        return None
    return getattr(plugin, "extra_sources", None) if plugin else None


def _source_arg(text):
    """--aerial-source: a satellite.jpg, a directory holding one, or a site name / data/<site>."""
    if not text:
        return None
    path = Path(text)
    if path.is_file() or (path / "satellite.jpg").is_file():
        return path
    return site_paths(text)


def run_fetch(args):
    paths = site_paths(args.site)
    cache = Cache(default_cache_dir(paths), max_age=args.cache_days * 86400, refresh=args.force)
    try:
        fetch(paths, args.center, args.size, margin=args.margin, satellite=not args.no_satellite,
              elevation=not args.no_elevation, extra_sources=_plugin_sources(paths.name),
              title=args.title, force=args.force, zoom=args.zoom, cache=cache)
    except (RequestMismatch, ValueError) as error:
        raise SystemExit(f"town fetch: {error}")
    if args.aerials is not None:
        try:
            crop_aerials(paths, args.aerials or None, source=_source_arg(args.aerial_source), force=args.force)
        except (FileNotFoundError, KeyError, ValueError) as error:
            raise SystemExit(f"town fetch --aerials: {error}")
    return 0


def register(subparsers):
    import argparse
    parser = subparsers.add_parser(
        "fetch", help="fetch OSM, elevation and imagery for a site into data/<site>/source/",
        description=__doc__.split("\n\n`fetch(")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("site", help="site name, e.g. avon (creates data/<site>/source/)")
    parser.add_argument("--center", metavar="LAT,LON", help="centre of the miniature (omit to resume the recorded request)")
    parser.add_argument("--size", metavar="W,H", help="metres east-west,north-south")
    parser.add_argument("--title", help="record a title in site_request.json")
    parser.add_argument("--margin", type=float, default=1.0, help="scale every fetch box (default 1.0)")
    parser.add_argument("--zoom", type=int, default=SATELLITE_ZOOM, help=f"imagery tile zoom (default {SATELLITE_ZOOM})")
    parser.add_argument("--no-satellite", action="store_true", help="skip imagery for a fast terrain/roads/buildings preview")
    parser.add_argument("--no-elevation", action="store_true", help="skip the elevation grid")
    parser.add_argument("--force", action="store_true", help="refetch existing files and bypass cached responses")
    parser.add_argument("--cache-days", type=float, default=CACHE_MAX_AGE / 86400,
                        help="maximum age of cached HTTP responses; 0 disables reuse")
    parser.add_argument("--aerials", nargs="*", metavar="ID",
                        help="after fetching, crop aerial references for these buildings (all when none listed); needs site.json")
    parser.add_argument("--aerial-source", metavar="SITE_OR_DIR",
                        help="crop from another site's mosaic (name, data/<site>, or a source directory)")
    parser.set_defaults(run=run_fetch)
    return parser
