"""Scene building, scoping, and footprint geometry.

Geometry is in the site's local frame (metres, x east, z south) or in a
building's blueprint frame (u along the long side of its oriented bounding
box, v across; origin at the box centre). Faces are named by their outward
normal: +u, -u, +v, -v.

`build(paths)` turns data/<site>/source/ + overrides.json into site.json:

  frame      local metres: x = east, z = south, y = up; origin at the centre
  size       diorama extent in metres
  terrain    heightmap grid (metres above the centre's ground level)
  roads      clipped polylines with class, name, width (footways also carry
             foot = sidewalk | crossing | path, and crossings marked = true/false)
  areas      land-cover polygons (park, grass, parking, wood, ...)
  buildings  footprint polygons + a style guess, with overrides applied
  pois       named points (shops, monuments) for signs and props
  landmarks  authored/mapped features (water, pitches, gardens, barriers), clipped
  outline    a non-rectangular physical outline, when the site has one

The style guess is deliberately simple; overrides.json is where the real
building-by-building knowledge (from photos / Street View) lives.

`scope(paths, ...)` maintains sites/<site>/scope.json (the frozen list of
structures a miniature contains) and, given a `source` site, seeds a new
site's data/<site>/source/ from that site's cached downloads.

Per-site behaviour comes from sites/<site>/site.json and the plugin module it
names (tinytown/plugins/<name>.py). Hooks `build` and `scope` call when the
plugin defines them:

    landmarks(site, paths) -> list[dict]
        Authored landmark features projected into the site's local frame.
        They replace overrides/request landmarks with the same id and are
        appended after the rest, then clipped to the site bounds.
    outline(site, request, overrides, paths) -> dict | None
        A geographic ({"coordinates": [[lon, lat], ...]}) or local ({"pts": ...})
        outline record, consulted when neither overrides nor the request has one.
        Sites may instead name a sidecar file with an "outline" key in site.json.
    refine_building(building) -> None
        Last-chance edits to a built structure record (with its blueprint).
    scope_filter(elements, request) -> list[dict]
        Given every cached OSM element (osm.json plus the *-osm.json extras)
        return the building elements the miniature should contain. Used by
        `scope --source` when no explicit ids are given.

Standard library only at import time (deploy path).
"""
import importlib
import json
import math
import shutil
import zlib

from .config import site_config
from .paths import SitePaths, site_paths
from .state import atomic_json, building_frame, read_json

M_PER_DEG_LAT = 111_320.0
FACE_NAMES = ("+u", "-u", "+v", "-v")

FOOT_WIDTH = {"sidewalk": 1.8, "crossing": 2.6, "path": 2.2}

ROAD_WIDTH = {
    "motorway": 12, "trunk": 10.5, "primary": 10, "secondary": 9, "tertiary": 8.5,
    "unclassified": 7, "residential": 7, "living_street": 6, "service": 4,
    "footway": 1.8, "path": 1.5, "pedestrian": 3, "cycleway": 2.5, "steps": 1.5,
}

AREA_KIND = {
    ("natural", "water"): "water", ("landuse", "reservoir"): "water",
    ("leisure", "park"): "park", ("landuse", "grass"): "grass", ("landuse", "recreation_ground"): "park",
    ("amenity", "parking"): "parking", ("landuse", "wood"): "wood", ("natural", "wood"): "wood",
    ("landuse", "cemetery"): "cemetery", ("landuse", "residential"): "residential",
    ("landuse", "commercial"): "commercial", ("landuse", "retail"): "commercial",
    ("landuse", "industrial"): "industrial", ("landuse", "religious"): "religious",
    ("amenity", "school"): "school", ("landuse", "school"): "school", ("leisure", "pitch"): "pitch",
    ("leisure", "playground"): "playground", ("landuse", "farmland"): "field", ("landuse", "meadow"): "field",
}

# Streets whose frontage is read as commercial when OSM lacks a building type.
# A heuristic for the style guess only; overrides.json decides the real style.
COMMERCIAL_STREETS = ("Genesee Street", "West Main Street", "East Main Street")

PASTEL_WALLS = ["white", "white", "cream", "grey", "sage", "butter", "slate", "tan", "paleblue", "white"]


# --------------------------------------------------------------------------
# Site access

def _paths(site_or_paths):
    return site_or_paths if isinstance(site_or_paths, SitePaths) else site_paths(site_or_paths)


def load_site(paths):
    """The built scene (site.json). Accepts SitePaths, a site name, or data/<site>."""
    return json.loads(_paths(paths).scene.read_text())


def load_overrides(paths):
    return read_json(_paths(paths).overrides, {})


def find_building(site, bid):
    b = next((x for x in site["buildings"] if str(x["id"]) == str(bid)), None)
    if b is None:
        raise KeyError(f"no building {bid} in site.json")
    return b


def settings(paths):
    """sites/<site>/site.json, or {} for a site that has no config yet."""
    paths = _paths(paths)
    try:
        return site_config(paths.name, paths.root)
    except KeyError:
        return {}


def plugin_for(paths, config=None):
    """The plugin module named by the site config, or None."""
    config = settings(paths) if config is None else config
    name = config.get("plugin")
    return importlib.import_module(f"tinytown.plugins.{name}") if name else None


def hook(plugin, name):
    return getattr(plugin, name, None) if plugin else None


def authored_path(paths, key, config=None):
    """A hand-authored sidecar named in site.json (e.g. "landmarks", "outline"),
    resolved relative to sites/<site>/. None when the config has no such key."""
    paths = _paths(paths)
    config = settings(paths) if config is None else config
    name = config.get(key)
    return (paths.site_dir / name) if name else None


def load_scope(paths, config=None):
    """sites/<site>/scope.json when the site config names one, else None."""
    paths = _paths(paths)
    config = settings(paths) if config is None else config
    if not config.get("scope"):
        return None
    return read_json(paths.site_dir / config["scope"])


def scoped_ids(paths, request, config=None):
    """The structure ids the miniature contains, or None for "everything in bounds".

    sites/<site>/scope.json is canonical; a request's building_ids is honoured
    only for sites without a scope file. Exclusions are removed either way.
    """
    scope = load_scope(paths, config) or {}
    ids = scope.get("building_ids")
    if ids is None:
        ids = request.get("building_ids")
    if ids is None:
        return None
    return set(map(str, ids)) - set(map(str, scope.get("exclusions", [])))


# --------------------------------------------------------------------------
# Geometry helpers

def bearing(x, z):
    """Compass bearing (degrees) of a local direction vector (x east, z south)."""
    return (math.degrees(math.atan2(x, -z)) + 360) % 360


def compass(deg):
    return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][int((deg + 11.25) // 22.5) % 16]


def to_latlon(site, x, z):
    lat0, lon0 = site["center"]["lat"], site["center"]["lon"]
    k = M_PER_DEG_LAT * math.cos(math.radians(lat0))
    return lat0 - z / M_PER_DEG_LAT, lon0 + x / k


def make_projector(lat0, lon0):
    """(lat, lon) -> local (x, z) metres around the centre."""
    k = M_PER_DEG_LAT * math.cos(math.radians(lat0))

    def to_local(lat, lon):
        return ((lon - lon0) * k, -(lat - lat0) * M_PER_DEG_LAT)

    return to_local


def geo_point(center):
    """[lon, lat] -> [x, z] rounded to millimetres; the projection every authored
    sidecar (landmarks, outlines) uses so features follow the geographic origin."""
    k = M_PER_DEG_LAT * math.cos(math.radians(center["lat"]))

    def point(p):
        return [round((p[0] - center["lon"]) * k, 3), round(-(p[1] - center["lat"]) * M_PER_DEG_LAT, 3)]

    return point


def bbox_for(lat, lon, w_m, h_m, margin=1.0):
    dlat = (h_m / 2) * margin / M_PER_DEG_LAT
    dlon = (w_m / 2) * margin / (M_PER_DEG_LAT * math.cos(math.radians(lat)))
    return {"south": lat - dlat, "north": lat + dlat, "west": lon - dlon, "east": lon + dlon}


def to_uv(b, x, z):
    o = b["obb"]
    c, s = math.cos(o["angle"]), math.sin(o["angle"])
    dx, dz = x - o["cx"], z - o["cz"]
    return dx * c + dz * s, -dx * s + dz * c


def polygon_uv(b, nd=1):
    return [tuple(round(t, nd) for t in to_uv(b, x, z)) for x, z in b["pts"]]


def faces(b):
    """Per face: outward normal (local x,z), compass bearing, width, midpoint, road flag.

    Fractions along a face run 0..1 from the LEFT end as seen from outside;
    `left` is the compass direction that left end lies toward.
    """
    o = b["obb"]
    c, s = math.cos(o["angle"]), math.sin(o["angle"])
    normals = {"+u": (c, s), "-u": (-c, -s), "+v": (-s, c), "-v": (s, -c)}
    half = {"+u": o["w"] / 2, "-u": o["w"] / 2, "+v": o["d"] / 2, "-v": o["d"] / 2}
    width = {"+u": o["d"], "-u": o["d"], "+v": o["w"], "-v": o["w"]}
    # screen-right tangent when looking at the face from outside (same table as blueprint.js)
    right_uv = {"+u": (0, -1), "-u": (0, 1), "+v": (1, 0), "-v": (-1, 0)}
    road = None
    if b.get("front"):
        fx, fz = math.cos(b["front"]["dir"]), math.sin(b["front"]["dir"])
        road = max(normals, key=lambda f: normals[f][0] * fx + normals[f][1] * fz)
    out = {}
    for f in FACE_NAMES:
        nx, nz = normals[f]
        ru, rv = right_uv[f]
        # left end direction in local xz: -(right) expressed via the u/v axes
        lx = -(ru * c - rv * s)
        lz = -(ru * s + rv * c)
        out[f] = {
            "normal": (nx, nz),
            "bearing": bearing(nx, nz),
            "width": width[f],
            "mid": (o["cx"] + nx * half[f], o["cz"] + nz * half[f]),
            "road": f == road,
            "left": bearing(lx, lz),
        }
    return out


def road_face(b):
    for k, f in faces(b).items():
        if f["road"]:
            return k
    return None


def street_view_url(lat, lon, heading, fov=55, pitch=90):
    return f"https://www.google.com/maps/@{lat:.6f},{lon:.6f},3a,{fov}y,{heading:.0f}h,{pitch}t/data=!3m1!1e1"


def viewpoints(site, b, face, dists=(18, 28, 40), fov=55):
    """Head-on Street View URLs standing `dist` m out from a face, looking back."""
    f = faces(b)[face]
    nx, nz = f["normal"]
    mx, mz = f["mid"]
    h = bearing(-nx, -nz)
    out = []
    for d in dists:
        lat, lon = to_latlon(site, mx + nx * d, mz + nz * d)
        out.append({"dist": d, "heading": round(h), "lat": round(lat, 6), "lon": round(lon, 6),
                    "url": street_view_url(lat, lon, h, fov)})
    return out


def neighbours(site, b, radius=10.0):
    """Other buildings whose footprint comes within `radius` m of this one, with the
    face of `b` they sit off and the gap between the two polygons (approx.)."""
    fs = faces(b)
    o = b["obb"]
    out = []
    for n in site["buildings"]:
        if n["id"] == b["id"]:
            continue
        dcx = n["obb"]["cx"] - o["cx"]
        dcz = n["obb"]["cz"] - o["cz"]
        if math.hypot(dcx, dcz) > (o["w"] + o["d"] + n["obb"]["w"] + n["obb"]["d"]) / 2 + radius:
            continue
        gap = min(_seg_poly_dist(p, q, n["pts"]) for p, q in zip(b["pts"], b["pts"][1:] + b["pts"][:1]))
        if gap > radius:
            continue
        # which face of b it lies off: the face whose normal best matches the centre offset
        face = max(fs, key=lambda k: fs[k]["normal"][0] * dcx + fs[k]["normal"][1] * dcz)
        out.append({"id": n["id"], "addr": n.get("addr"), "name": n.get("name"), "face": face,
                    "gap": round(gap, 1), "kind": (n.get("style") or {}).get("kind"),
                    "blueprint": bool(n.get("blueprint"))})
    out.sort(key=lambda r: r["gap"])
    return out


def point_seg_dist(p, a, b):
    ax, az = a; bx, bz = b; px, pz = p
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    t = 0 if L2 == 0 else max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / L2))
    return math.hypot(px - (ax + t * dx), pz - (az + t * dz))


_pt_seg_dist = point_seg_dist


def _seg_poly_dist(p, q, poly):
    d = min(_pt_seg_dist(v, p, q) for v in poly)
    for a, b in zip(poly, poly[1:] + poly[:1]):
        d = min(d, _pt_seg_dist(p, a, b), _pt_seg_dist(q, a, b))
    return d


def terrain_at(site, x, z):
    t = site["terrain"]
    cols, rows = t["cols"], t["rows"]
    fx = (x - t["x0"]) / (t["x1"] - t["x0"]) * (cols - 1)
    fz = (z - t["z0"]) / (t["z1"] - t["z0"]) * (rows - 1)
    i, j = int(max(0, min(cols - 2, math.floor(fx)))), int(max(0, min(rows - 2, math.floor(fz))))
    a, c = fx - i, fz - j
    v = t["values"]
    g = lambda ii, jj: v[jj * cols + ii]
    return (g(i, j) * (1 - a) + g(i + 1, j) * a) * (1 - c) + (g(i, j + 1) * (1 - a) + g(i + 1, j + 1) * a) * c


def poly_area(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, z0 = pts[i]
        x1, z1 = pts[(i + 1) % len(pts)]
        a += x0 * z1 - x1 * z0
    return a / 2


def centroid(pts):
    a = poly_area(pts)
    if abs(a) < 1e-6:
        return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    cx = cz = 0.0
    for i in range(len(pts)):
        x0, z0 = pts[i]
        x1, z1 = pts[(i + 1) % len(pts)]
        f = x0 * z1 - x1 * z0
        cx += (x0 + x1) * f
        cz += (z0 + z1) * f
    return (cx / (6 * a), cz / (6 * a))


def oriented_bbox(pts):
    """Minimum-area bounding rectangle by testing each edge direction."""
    best = None
    for i in range(len(pts)):
        x0, z0 = pts[i]
        x1, z1 = pts[(i + 1) % len(pts)]
        ang = math.atan2(z1 - z0, x1 - x0)
        c, s = math.cos(-ang), math.sin(-ang)
        us = [(x * c - z * s, x * s + z * c) for x, z in pts]
        u0, u1 = min(u for u, _ in us), max(u for u, _ in us)
        v0, v1 = min(v for _, v in us), max(v for _, v in us)
        area = (u1 - u0) * (v1 - v0)
        if best is None or area < best[0]:
            cu, cv = (u0 + u1) / 2, (v0 + v1) / 2
            c2, s2 = math.cos(ang), math.sin(ang)
            best = (area, {"cx": cu * c2 - cv * s2, "cz": cu * s2 + cv * c2,
                           "angle": ang, "w": u1 - u0, "d": v1 - v0})
    return best[1]


def clip_segment(p, q, hw, hh):
    """Liang–Barsky clip of segment p→q against the box |x|<=hw, |z|<=hh."""
    t0, t1 = 0.0, 1.0
    dx, dz = q[0] - p[0], q[1] - p[1]
    for pk, qk in ((-dx, p[0] + hw), (dx, hw - p[0]), (-dz, p[1] + hh), (dz, hh - p[1])):
        if pk == 0:
            if qk < 0:
                return None
            continue
        t = qk / pk
        if pk < 0:
            if t > t1:
                return None
            t0 = max(t0, t)
        else:
            if t < t0:
                return None
            t1 = min(t1, t)
    return ((p[0] + t0 * dx, p[1] + t0 * dz), (p[0] + t1 * dx, p[1] + t1 * dz))


def clip_polyline(pts, hw, hh):
    out, cur = [], []
    for i in range(len(pts) - 1):
        seg = clip_segment(pts[i], pts[i + 1], hw, hh)
        if seg is None:
            if len(cur) > 1:
                out.append(cur)
            cur = []
            continue
        a, b = seg
        if not cur:
            cur = [a]
        elif math.hypot(cur[-1][0] - a[0], cur[-1][1] - a[1]) > 1e-6:
            out.append(cur)
            cur = [a]
        cur.append(b)
    if len(cur) > 1:
        out.append(cur)
    return out


def contains(ring, lon, lat):
    """Even-odd point-in-polygon for a closed [lon, lat] ring."""
    inside = False
    for a, b in zip(ring, ring[1:]):
        if (a[1] > lat) != (b[1] > lat) and lon < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def rnd(v, n=2):
    return round(v, n)


# --------------------------------------------------------------------------
# Landmarks and outlines

def clipped(features, site):
    """Clip landmark features to the site's geographic bounds.

    Clipping uses the actual bounds, not a symmetric extent: an expanded town
    deliberately retains the original centre for its existing buildings. Closed
    features (except tracks) are clipped as polygons; open ones are cut into
    segment runs so no line is fabricated along the crop boundary.
    """
    c = site['center']; b = site['bounds']; k = M_PER_DEG_LAT * math.cos(math.radians(c['lat']))
    bounds = [(b['west'] - c['lon']) * k, -(b['north'] - c['lat']) * M_PER_DEG_LAT,
              (b['east'] - c['lon']) * k, -(b['south'] - c['lat']) * M_PER_DEG_LAT]

    def polygon(pts):
        for axis, edge, greater in [(0, bounds[0], True), (0, bounds[2], False), (1, bounds[1], True), (1, bounds[3], False)]:
            out = []
            for i, q in enumerate(pts):
                p = pts[i - 1]
                pin = p[axis] >= edge if greater else p[axis] <= edge
                qin = q[axis] >= edge if greater else q[axis] <= edge
                if pin != qin:
                    t = (edge - p[axis]) / (q[axis] - p[axis])
                    out.append([p[j] + t * (q[j] - p[j]) for j in (0, 1)])
                if qin:
                    out.append(q)
            pts = out
            if not pts:
                break
        return pts

    out = []
    for f in features:
        if f.get('closed') and f['kind'] != 'track':
            pts = polygon(f['pts'])
            if len(pts) >= 3:
                out.append(dict(f, pts=pts))
            continue
        pts = f['pts'] + ([f['pts'][0]] if f.get('closed') else [])
        if all(bounds[0] <= p[0] <= bounds[2] and bounds[1] <= p[1] <= bounds[3] for p in pts):
            out.append(f)
            continue
        runs = []; run = []
        for p, q in zip(pts, pts[1:]):
            lo, hi = 0., 1.; dx = q[0] - p[0]; dz = q[1] - p[1]
            for a, bv in [(-dx, p[0] - bounds[0]), (dx, bounds[2] - p[0]), (-dz, p[1] - bounds[1]), (dz, bounds[3] - p[1])]:
                if a == 0:
                    if bv < 0:
                        hi = -1
                        break
                elif a < 0:
                    lo = max(lo, bv / a)
                else:
                    hi = min(hi, bv / a)
            if lo <= hi:
                segment = [[p[0] + t * dx, p[1] + t * dz] for t in (lo, hi)]
                if run and math.hypot(run[-1][0] - segment[0][0], run[-1][1] - segment[0][1]) < 1e-6:
                    run.append(segment[1])
                else:
                    if run:
                        runs.append(run)
                    run = segment
            elif run:
                runs.append(run); run = []
        if run:
            runs.append(run)
        for i, run in enumerate(runs):
            out.append(dict(f, id=str(f['id']) + '-' + str(i), closed=False, pts=run))
    return out


def project_outline(record, center):
    """Project a geographic outline record into the local frame without mutating it."""
    result = {key: value for key, value in record.items() if key != 'coordinates'}
    if 'coordinates' in record:
        result['pts'] = [geo_point(center)(p) for p in record['coordinates']]
    pts = result.get('pts', [])
    if len(pts) < 3 or any(len(p) != 2 or not all(math.isfinite(v) for v in p) for p in pts):
        raise ValueError('Outline must contain at least three finite points')
    return result


def site_outline(site, request, overrides, paths=None, config=None, plugin=None):
    """The projected outline, or None for a plain rectangular miniature.

    Precedence: overrides.outline, request.outline, the plugin's `outline`
    hook, then the sidecar file named by "outline" in site.json.
    """
    record = overrides.get('outline', request.get('outline'))
    if record is None and paths is not None:
        outline_hook = hook(plugin, 'outline')
        if outline_hook:
            record = outline_hook(site, request, overrides, paths)
        if record is None:
            path = authored_path(paths, 'outline', config)
            if path and path.exists():
                record = json.loads(path.read_text())
    return project_outline(record, site['center']) if record else None


def merge_landmarks(base, authored):
    """Authored features replace same-id entries of `base` where they sit;
    features new to `base` follow, in authored order. Keeping positions keeps
    the drawing order the overrides established."""
    by_id = {str(f['id']): f for f in authored}
    seen = set()
    merged = []
    for f in base or []:
        key = str(f['id'])
        if key in by_id:
            merged.append(by_id[key]); seen.add(key)
        else:
            merged.append(f)
    return merged + [f for f in authored if str(f['id']) not in seen]


# --------------------------------------------------------------------------
# Style guess

def guess_style(tags, area, obb, name_hint):
    b = tags.get("building", "yes")
    amenity = tags.get("amenity", "")
    street = tags.get("addr:street", "")
    if amenity == "place_of_worship" or b in ("church", "chapel"):
        return {"kind": "church", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "slate", "steeple": True}
    if b in ("garage", "shed", "roof", "carport"):
        return {"kind": "garage", "floors": 1, "roof": "gable", "wall": "white", "roofColor": "grey"}
    if b in ("house", "detached", "residential", "semidetached_house", "terrace"):
        return {"kind": "house", "floors": 2, "roof": "gable", "wall": PASTEL_WALLS[zlib.crc32(str(name_hint).encode()) % len(PASTEL_WALLS)], "roofColor": "auto", "porch": True}
    if b in ("apartments",):
        return {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}
    if b in ("commercial", "retail") or street in COMMERCIAL_STREETS or amenity in ("bank", "restaurant", "bar", "townhall", "library", "post_office", "courthouse", "fire_station"):
        return {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "brick", "roofColor": "tar", "storefront": True}
    if area > 350:
        return {"kind": "commercial", "floors": 1, "roof": "flat", "wall": "brick", "roofColor": "tar"}
    return {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}


# --------------------------------------------------------------------------
# Building the scene

def authored_building_elements(records, mapped):
    """Keep measured buildings absent from OSM in an explicit geographic source.

    Their blueprints and stable footprint frames use the same override path as
    mapped buildings. Never insert invented records into the cached OSM data.
    """
    if not isinstance(records, list):
        raise ValueError('authored_buildings must be a list')
    ids = {str(e['id']) for e in mapped if 'building' in e.get('tags', {})}
    result = []
    for i, record in enumerate(records):
        label = f'authored_buildings[{i}]'
        if (not isinstance(record, dict) or isinstance(record.get('id'), bool)
                or not isinstance(record.get('id'), (int, str)) or not str(record['id']).strip()):
            raise ValueError(f'{label} requires a stable id')
        if str(record['id']) in ids:
            raise ValueError(f'{label} duplicates a building id')
        ids.add(str(record['id']))
        tags, points = record.get('tags'), record.get('coordinates')
        if not isinstance(tags, dict) or not isinstance(tags.get('building'), str) or not tags['building']:
            raise ValueError(f'{label}.tags requires a building type')
        if (not isinstance(points, list) or len(points) < 3 or
                any(not isinstance(p, (list, tuple)) or len(p) != 2 or
                    any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in p)
                    or not -180 <= p[0] <= 180 or not -90 <= p[1] <= 90 for p in points)):
            raise ValueError(f'{label}.coordinates requires finite [longitude, latitude] points')
        if len({tuple(p) for p in points}) < 3 or abs(poly_area(points)) < 1e-12:
            raise ValueError(f'{label}.coordinates must enclose a building footprint')
        result.append({'id': record['id'], 'type': 'way', 'tags': tags,
                       'geometry': [{'lon': p[0], 'lat': p[1]} for p in points]})
    return result


def building_ring(element):
    """The outer [{'lat','lon'}] ring of a building element, or None."""
    if element["type"] == "way" and "geometry" in element:
        return element["geometry"]
    if element["type"] == "relation":
        outer = [m for m in element.get("members", []) if m.get("role") == "outer" and "geometry" in m]
        return outer[0]["geometry"] if outer else None
    return None


def _frame_review_path(paths):
    # Written beside site.json; review/references read it as well.
    return paths.frame_review


def _road_points(points, source):
    if (not isinstance(points, list) or len(points) < 2 or
            any(not isinstance(p, (list, tuple)) or len(p) != 2 or
                any(isinstance(v, bool) or not isinstance(v, (int, float)) or
                    not math.isfinite(v) for v in p) for p in points)):
        raise ValueError(f"{source}.pts must contain at least two finite [x, z] points")
    return points


def build(paths, *, write=True):
    """Build the scene from data/<site>/source/ + overrides.json.

    Returns the site dict; with `write` it is also stored compactly at
    data/<site>/site.json (atomically, so readers never see a partial file).
    """
    paths = _paths(paths)
    config = settings(paths)
    plugin = plugin_for(paths, config)
    req = read_json(paths.request)
    osm = read_json(paths.osm)
    elev = read_json(paths.elevation)
    for value, path in ((req, paths.request), (osm, paths.osm), (elev, paths.elevation)):
        if value is None:
            raise FileNotFoundError(f"missing source file {path}")
    ov = load_overrides(paths)

    lat0, lon0 = req["center"]["lat"], req["center"]["lon"]
    W, H = req["size_m"]["w"], req["size_m"]["h"]
    hw, hh = W / 2, H / 2
    to_local = make_projector(lat0, lon0)
    # An append can enlarge an asymmetric rectangle without moving the original
    # coordinate frame (and invalidating every existing model/camera pose).
    bounds = req.get('bounds')
    offset_x = offset_z = 0.0
    if bounds:
        left, top = to_local(bounds['north'], bounds['west'])
        right, bottom = to_local(bounds['south'], bounds['east'])
        W, H = right - left, bottom - top
        hw, hh = W / 2, H / 2
        offset_x, offset_z = (left + right) / 2, (top + bottom) / 2

    def inside(x, z, pad=0):
        return abs(x - offset_x) <= hw + pad and abs(z - offset_z) <= hh + pad

    def clipped_line(pts, pad=12):
        return [[(x + offset_x, z + offset_z) for x, z in piece] for piece in
                clip_polyline([(x - offset_x, z - offset_z) for x, z in pts], hw + pad, hh + pad)]

    # --- terrain -----------------------------------------------------------
    eb = elev["bounds"]
    x0, z0 = to_local(eb["north"], eb["west"])
    x1, z1 = to_local(eb["south"], eb["east"])
    cols, rows = elev["cols"], elev["rows"]
    vals = elev["values"]
    # ground level at the centre → 0
    ci = int((0 - x0) / (x1 - x0) * (cols - 1))
    cj = int((0 - z0) / (z1 - z0) * (rows - 1))
    base = vals[cj * cols + ci]
    terrain = {"x0": rnd(x0), "z0": rnd(z0), "x1": rnd(x1), "z1": rnd(z1), "cols": cols, "rows": rows,
               "base_m": rnd(base), "values": [rnd(v - base) for v in vals]}

    # --- roads -------------------------------------------------------------
    roads, road_polys = [], []
    road_ov = ov.get("roads", {})

    def append_road(road, precision=2):
        for piece in clipped_line(road["pts"]):
            roads.append({**road, "pts": [[rnd(x, precision), rnd(z, precision)] for x, z in piece]})
            if road["class"] not in ("footway", "path", "steps", "cycleway"):
                road_polys.append(piece)

    for e in osm["elements"]:
        t = e.get("tags", {})
        if e["type"] != "way" or "highway" not in t or "geometry" not in e:
            continue
        cls = t["highway"]
        if cls not in ROAD_WIDTH:
            continue
        pts = [to_local(p["lat"], p["lon"]) for p in e["geometry"]]
        width = ROAD_WIDTH[cls]
        if t.get("lanes"):
            try:
                width = max(width, 3.4 * int(t["lanes"]) + (3.5 if cls != "service" else 0))
            except ValueError:
                pass
        name = t.get("name")
        # An individual way can override its street's defaults, including
        # unnamed factory entrances without widening every service road.
        way_override = road_ov.get(str(e["id"]), {})
        road_override = {**road_ov.get(name, {}), **way_override}
        # Correct a measured driveway in the site's fixed local frame. Geometry
        # is per-way only: a street-name default must not duplicate one path on
        # every way sharing that name. Clip the replacement just like OSM data.
        if "pts" in way_override:
            pts = _road_points(way_override["pts"], f"roads[{e['id']}]")
        if "width" in road_override:
            width = road_override["width"]
        # Footways come in three flavours that render very differently:
        # sidewalks (concrete, beside a road), crossings (painted bars on the
        # road) and free-standing paths (flagstone, through a park).
        foot = None
        if cls in ("footway", "path", "steps", "cycleway", "pedestrian"):
            foot = t.get("footway") if t.get("footway") in ("sidewalk", "crossing") else "path"
            width = FOOT_WIDTH[foot]
        road = {"id": e["id"], "class": cls, "name": name, "width": width,
                "oneway": t.get("oneway") == "yes", "circular": t.get("junction") in ("roundabout", "circular"),
                "pts": pts}
        # Preserve grade separation: these mapped spans must cross above
        # waterways instead of sharing their draped blue surface.
        road.update({key: t[key] for key in ("bridge", "tunnel", "layer", "ford") if key in t})
        if "surface" in road_override or "surface" in t:
            road["surface"] = road_override.get("surface", t.get("surface"))
        if "lanes" in road_override:
            road["lanes"] = road_override["lanes"]
        if foot:
            road["foot"] = foot
            if foot == "crossing":
                road["marked"] = t.get("crossing") != "unmarked" and t.get("crossing:markings") != "no"
                if road_override.get("marking") in ("ladder", "zebra"):
                    road["marking"] = road_override["marking"]
        append_road(road, 3 if "pts" in way_override else 2)

    # Measured roads absent from OSM use the same fixed local frame, clipping,
    # paving and frontage inputs as mapped roads. Their IDs must stay distinct.
    authored_roads = ov.get("authored_roads", [])
    if not isinstance(authored_roads, list):
        raise ValueError("authored_roads must be a list of road records")
    road_ids = {str(e["id"]) for e in osm["elements"]
                if e["type"] == "way" and "highway" in e.get("tags", {})}
    for index, authored in enumerate(authored_roads):
        source = f"authored_roads[{index}]"
        if (not isinstance(authored, dict) or isinstance(authored.get("id"), bool) or
                not isinstance(authored.get("id"), (int, str)) or not str(authored["id"]).strip()):
            raise ValueError(f"{source} requires a stable integer or string id")
        if str(authored["id"]) in road_ids:
            raise ValueError(f"{source}.id duplicates another road: {authored['id']}")
        road_ids.add(str(authored["id"]))
        cls = authored.get("class")
        if cls not in ROAD_WIDTH:
            raise ValueError(f"{source}.class must be a supported road class")
        width = authored.get("width", ROAD_WIDTH[cls])
        if isinstance(width, bool) or not isinstance(width, (int, float)) or not math.isfinite(width) or width <= 0:
            raise ValueError(f"{source}.width must be a positive finite number")
        append_road({"name": None, "oneway": False, "circular": False, **authored,
                     "width": width, "pts": _road_points(authored.get("pts"), source)}, 3)

    linear_features = []
    for e in osm['elements']:
        t = e.get('tags', {})
        if e['type'] != 'way' or 'geometry' not in e or t.get('building') == 'bridge':
            continue
        kind = 'rail' if t.get('railway') == 'rail' else 'water' if t.get('waterway') in ('stream', 'river', 'canal', 'ditch') else None
        if not kind:
            continue
        pts = [to_local(p['lat'], p['lon']) for p in e['geometry']]
        width = 4 if kind == 'rail' else 8 if t.get('waterway') == 'river' else 2.5
        for piece in clipped_line(pts, 0):
            linear_features.append({'id': e['id'], 'kind': kind, 'width': width, 'name': t.get('name'),
                                    'pts': [[rnd(x), rnd(z)] for x, z in piece]})

    # --- areas -------------------------------------------------------------
    areas = []
    for e in osm["elements"]:
        t = e.get("tags", {})
        if e["type"] != "way" or "geometry" not in e or "building" in t or "highway" in t:
            continue
        kind = None
        for k in ("leisure", "landuse", "amenity", "natural"):
            if (k, t.get(k)) in AREA_KIND:
                kind = AREA_KIND[(k, t.get(k))]
                break
        if not kind:
            continue
        pts = [to_local(p["lat"], p["lon"]) for p in e["geometry"]]
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts = pts[:-1]
        if len(pts) < 3:
            continue
        cx, cz = centroid(pts)
        if not inside(cx, cz, 60):
            continue
        areas.append({"id": e["id"], "kind": kind, "name": t.get("name"),
                      "pts": [[rnd(x), rnd(z)] for x, z in pts]})

    # --- buildings ---------------------------------------------------------
    b_ov = ov.get("buildings", {})
    # An explicit scope is persistent across rebuilds and research merges.
    include_ids = scoped_ids(paths, req, config)
    refine = hook(plugin, 'refine_building')
    buildings = []
    building_sources = osm['elements'] + authored_building_elements(ov.get('authored_buildings', []), osm['elements'])
    for e in building_sources:
        t = e.get("tags", {})
        if "building" not in t:
            continue
        if include_ids is not None and str(e["id"]) not in include_ids:
            continue
        ring = building_ring(e)
        if ring is None:
            continue
        # Archived authored models retain their measured footprint frame even
        # when their original raw OSM download is no longer available.
        saved_frame = ov.get('footprints', {}).get(str(e['id']))
        pts = ([tuple(p) for p in saved_frame['pts']] if saved_frame else
               [to_local(p["lat"], p["lon"]) for p in ring])
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts = pts[:-1]
        if len(pts) < 3:
            continue
        if poly_area(pts) < 0:  # keep a consistent winding (counter-clockwise in x/z)
            pts.reverse()
        cx, cz = centroid(pts)
        if not inside(cx, cz):
            continue
        # drop anything that would hang more than a couple of metres off the slab
        if any(not inside(x, z, 2) for x, z in pts):
            continue
        area = abs(poly_area(pts))
        if area < 8:
            continue
        obb = dict(saved_frame['obb']) if saved_frame else oriented_bbox(pts)
        fill = area / max(1e-6, obb["w"] * obb["d"])

        # Which road does it face? Nearest named vehicular road to the centroid.
        best = None
        for r in roads:
            if r["class"] in ("footway", "path", "steps", "cycleway", "service"):
                continue
            for i in range(len(r["pts"]) - 1):
                d = point_seg_dist((cx, cz), r["pts"][i], r["pts"][i + 1])
                if best is None or d < best[0]:
                    ax, az = r["pts"][i]
                    bx, bz = r["pts"][i + 1]
                    best = (d, r["name"], math.atan2(bz - az, bx - ax), (ax, az, bx, bz))
        front = None
        if best:
            # closest point on that road → direction from building to road
            ax, az, bx, bz = best[3]
            dx, dz = bx - ax, bz - az
            L2 = dx * dx + dz * dz or 1
            tt = max(0, min(1, ((cx - ax) * dx + (cz - az) * dz) / L2))
            fx, fz = ax + tt * dx - cx, az + tt * dz - cz
            front = {"road": best[1], "dist": rnd(best[0]), "dir": rnd(math.atan2(fz, fx), 3)}

        addr = " ".join(x for x in (t.get("addr:housenumber"), t.get("addr:street")) if x) or None
        style = guess_style(t, area, obb, addr or e["id"])
        display_name = t.get("name")
        blueprint = None
        for key in (str(e["id"]), addr):
            if key and key in b_ov:
                override = dict(b_ov[key])
                # A hand-authored display name lives beside the style keys.
                display_name = override.pop('name', display_name)
                style.update(override)
            if key and key in ov.get("blueprints", {}):
                blueprint = ov["blueprints"][key]
        if style.get("demolished"):   # OSM still has the footprint but the lot is empty now
            continue
        building = {
            "id": e["id"], "addr": addr, "name": display_name,
            "tags": {k: v for k, v in t.items() if k in ("building", "amenity", "shop", "historic", "building:levels", "roof:shape", "height", "miniature:open_lane")},
            "pts": [list(p) for p in pts] if saved_frame else [[rnd(x), rnd(z)] for x, z in pts],
            "centroid": [rnd(cx), rnd(cz)], "area": rnd(area, 1),
            "obb": dict(obb) if saved_frame else {k: rnd(v, 3) for k, v in obb.items()}, "fill": rnd(fill, 3),
            "front": front, "style": style, "blueprint": blueprint,
        }
        if refine:
            refine(building)
        buildings.append(building)

    if include_ids is not None:
        missing = include_ids - {str(b["id"]) for b in buildings}
        if missing:
            raise ValueError("Requested structures absent or outside bounds: " + ", ".join(sorted(missing)))

    # --- pois --------------------------------------------------------------
    pois = []
    for e in osm["elements"]:
        t = e.get("tags", {})
        if e["type"] != "node" or not t:
            continue
        x, z = to_local(e["lat"], e["lon"])
        if not inside(x, z):
            continue
        kind = t.get("amenity") or t.get("shop") or t.get("historic") or t.get("tourism") or t.get("natural") or t.get("man_made") or t.get("highway")
        pois.append({"id": e["id"], "kind": kind, "name": t.get("name"), "x": rnd(x), "z": rnd(z)})

    site = {
        "name": paths.name,
        "title": ov.get("title"),
        "center": {"lat": lat0, "lon": lon0}, "frame": "x=east z=south y=up, metres, origin at centre",
        "size": {"w": W, "h": H},
        "terrain": terrain, "roads": roads, "areas": areas, "buildings": buildings, "pois": pois,
        "extras": ov.get("extras", []),
    }
    landmarks = ov.get('landmarks', req.get('landmarks'))
    landmarks_hook = hook(plugin, 'landmarks')
    if landmarks_hook:
        landmarks = merge_landmarks(landmarks, landmarks_hook(site, paths))
    if landmarks:
        landmark_bounds = bounds or bbox_for(lat0, lon0, W, H)
        visible = clipped(landmarks, {'center': site['center'], 'bounds': landmark_bounds})
        if visible:
            site['landmarks'] = visible
    if bounds:
        site['bounds'] = bounds
        site['offset'] = {'x': offset_x, 'z': offset_z}
    if linear_features:
        site['linear_features'] = linear_features
    for feature in ov.get('linear_features', []):
        for piece in clipped_line(feature['pts'], 0):
            site.setdefault('linear_features', []).append({**feature, 'pts': piece})
    for area in ov.get('areas', []):
        cx, cz = centroid(area['pts'])
        if inside(cx, cz, 60):
            site['areas'].append(area)
    if "seed" in ov:
        site["seed"] = ov["seed"]
    # Last so the key order matches the published scenes.
    outline = site_outline(site, req, ov, paths, config, plugin)
    if outline:
        site['outline'] = outline

    # Authored coordinates belong to a footprint frame. An expanded area with
    # the same centre reuses models; changed OSM geometry needs review first.
    frames = dict(ov.get("blueprint_frames", {}))
    review_path = _frame_review_path(paths)
    for bid, frame in (read_json(review_path) or {}).items():
        frames.setdefault(bid, frame)
    if paths.scene.exists():
        previous = load_site(paths)
        for b in previous.get("buildings", []):
            if b.get("blueprint"):
                frames.setdefault(str(b["id"]), building_frame(previous, b))
    changed = [str(b["id"]) for b in buildings if b.get("blueprint") and str(b["id"]) in frames
               and frames[str(b["id"])] != building_frame(site, b)]
    if changed:
        # Keep authored JSON in overrides untouched; expose updated footprints
        # for the research tools without rendering old geometry in a new frame.
        if write:
            atomic_json(review_path, {bid: frames[bid] for bid in changed})
        site["frame_review"] = changed
        for b in buildings:
            if str(b["id"]) in changed:
                b["blueprint"] = None
        print("Frame review required (generic preview): " + ", ".join(changed))
    if write:
        if not changed:
            review_path.unlink(missing_ok=True)
        atomic_json(paths.scene, site, compact=True)
    return site


def summary(site):
    """The one-line report `town build` prints."""
    kinds = {}
    for b in site["buildings"]:
        kinds[b["style"]["kind"]] = kinds.get(b["style"]["kind"], 0) + 1
    terrain = site["terrain"]
    return (f"{len(site['roads'])} road pieces, {len(site['areas'])} areas, {len(site['buildings'])} buildings {kinds}, "
            f"{len(site['pois'])} pois, terrain {terrain['cols']}x{terrain['rows']} rel "
            f"{min(terrain['values']):.1f}..{max(terrain['values']):.1f} m")


# --------------------------------------------------------------------------
# Scoping

def _id_key(value):
    text = str(value)
    try:
        return (0, int(text), "")
    except ValueError:
        return (1, 0, text)


def parse_bounds(text):
    """'S,W,N,E' -> {'south','west','north','east'}."""
    parts = [float(v) for v in str(text).split(",")]
    if len(parts) != 4 or not all(math.isfinite(v) for v in parts):
        raise ValueError("bounds must be four finite numbers: south,west,north,east")
    south, west, north, east = parts
    if not (south < north and west < east):
        raise ValueError("bounds must satisfy south < north and west < east")
    return {"south": south, "west": west, "north": north, "east": east}


def read_ids(path):
    return [line.strip() for line in open(path) if line.strip() and not line.lstrip().startswith("#")]


def request_bounds(request):
    return request.get("bounds") or bbox_for(request["center"]["lat"], request["center"]["lon"],
                                              request["size_m"]["w"], request["size_m"]["h"])


def source_elements(paths):
    """Every cached OSM element: osm.json plus the plugin extras (*-osm.json)."""
    elements = list((read_json(paths.osm) or {}).get("elements", []))
    for extra in sorted(paths.source.glob("*-osm.json")):
        elements.extend((read_json(extra) or {}).get("elements", []))
    return elements


def _building_elements(elements):
    return [e for e in elements if "building" in e.get("tags", {}) and building_ring(e)]


def _ring_centroid(ring):
    lon = sum(p["lon"] for p in ring) / len(ring)
    lat = sum(p["lat"] for p in ring) / len(ring)
    return lon, lat


def _in_bounds(bounds, lon, lat):
    return bounds["west"] <= lon <= bounds["east"] and bounds["south"] <= lat <= bounds["north"]


def select_buildings(paths, elements, bounds, request):
    """Mapped buildings inside `bounds`, narrowed by the plugin's `scope_filter`."""
    inside = [e for e in _building_elements(elements) if _in_bounds(bounds, *_ring_centroid(building_ring(e)))]
    scope_filter = hook(plugin_for(paths), "scope_filter")
    if scope_filter:
        chosen = scope_filter(elements, {**request, "bounds": bounds})
        inside = [e for e in chosen if _in_bounds(bounds, *_ring_centroid(building_ring(e)))]
    return inside


def import_source(paths, source, ids, bounds=None, padding=24, title=None):
    """Seed data/<site>/source/ from another site's cached downloads.

    With explicit `ids` and no `bounds`, the bounds are the selected footprints
    padded by `padding` metres and rounded up to 5 m (the subset behaviour).
    Without ids, every mapped building inside `bounds` is selected, filtered by
    the plugin's `scope_filter` hook when it has one. Returns the selected ids.
    The destination's source/ must not hold data yet.
    """
    paths = _paths(paths)
    source = source if isinstance(source, SitePaths) else site_paths(source, paths.root)
    if paths.osm.exists() or paths.request.exists():
        raise ValueError(f"{paths.source} already holds source data; remove it to re-scope from {source.name}")
    request = read_json(source.request)
    osm = read_json(source.osm)
    if request is None or osm is None:
        raise FileNotFoundError(f"{source.name} has no fetched source data")
    if not ids and not bounds:
        raise ValueError("select structures with --ids/--ids-file or an area with --bounds")
    if padding < 5 or not math.isfinite(padding):
        raise ValueError("padding must be at least 5 metres")
    elements = source_elements(source)
    buildings = {str(e["id"]): e for e in _building_elements(elements)}
    ids = [str(i) for i in ids or []]
    missing = sorted(set(ids) - set(buildings), key=_id_key)
    if missing:
        raise ValueError("unknown structure ids: " + ", ".join(missing))
    lat0 = request["center"]["lat"]
    k = M_PER_DEG_LAT * math.cos(math.radians(lat0))
    if bounds is None:
        pts = [p for i in ids for p in building_ring(buildings[i])]
        lon0, lon1 = min(p["lon"] for p in pts), max(p["lon"] for p in pts)
        lat_s, lat_n = min(p["lat"] for p in pts), max(p["lat"] for p in pts)
        width = math.ceil(((lon1 - lon0) * k + 2 * padding) / 5) * 5
        height = math.ceil(((lat_n - lat_s) * M_PER_DEG_LAT + 2 * padding) / 5) * 5
        center = {"lat": (lat_s + lat_n) / 2, "lon": (lon0 + lon1) / 2}
        bounds = bbox_for(center["lat"], center["lon"], width, height)
        size = {"w": width, "h": height}
    else:
        center = {"lat": (bounds["south"] + bounds["north"]) / 2, "lon": (bounds["west"] + bounds["east"]) / 2}
        size = {"w": (bounds["east"] - bounds["west"]) * k, "h": (bounds["north"] - bounds["south"]) * M_PER_DEG_LAT}
    available = request_bounds(request)
    if (bounds["west"] < available["west"] - 1e-9 or bounds["east"] > available["east"] + 1e-9 or
            bounds["south"] < available["south"] - 1e-9 or bounds["north"] > available["north"] + 1e-9):
        raise ValueError(f"requested area extends beyond {source.name}'s cached source; fetch larger bounds")
    if not ids:
        ids = [str(e["id"]) for e in select_buildings(paths, elements, bounds, {**request, "center": center})]
    new_request = {"center": center, "size_m": size, "bounds": bounds}
    paths.source.mkdir(parents=True, exist_ok=True)
    for name in ("elevation.json", "satellite.json", "satellite.jpg"):
        if (source.source / name).exists():
            shutil.copy2(source.source / name, paths.source / name)
    for extra in source.source.glob("*-osm.json"):
        shutil.copy2(extra, paths.source / extra.name)
    shutil.copy2(source.osm, paths.osm)
    atomic_json(paths.request, new_request)
    atomic_json(paths.composition, {"source": source.name, "bounds": bounds, "structures": len(ids),
                                    "imported_ids": sorted(ids, key=_id_key)})
    if title and not paths.overrides.exists():
        atomic_json(paths.overrides, {"title": title})
    return sorted(set(ids), key=_id_key)


def scope(paths, *, ids=None, ids_file=None, bounds=None, exclude=None, title=None, source=None, padding=24):
    """Write or update sites/<site>/scope.json; returns the scope record.

    `ids` (and the lines of `ids_file`) join the frozen building_ids; `exclude`
    ids are recorded as exclusions and removed. `bounds` and `title` are stored
    when given; `bounds` alone selects every mapped building inside them from
    the site's own source/ (through the plugin's `scope_filter`). With `source`,
    a site whose source/ is still empty is first seeded from that site (see
    import_source) and the selected structures become the scope. Re-running
    with the same arguments changes nothing.
    """
    paths = _paths(paths)
    if isinstance(bounds, str):
        bounds = parse_bounds(bounds)
    wanted = [str(i) for i in (ids or [])] + (read_ids(ids_file) if ids_file else [])
    excluded = [str(i) for i in (exclude or [])]
    if source and not paths.osm.exists():
        wanted = import_source(paths, source, wanted, bounds, padding, title)
        bounds = (read_json(paths.request) or {}).get("bounds", bounds)
    elif not wanted and bounds and paths.osm.exists():
        request = read_json(paths.request) or {}
        wanted = [str(e["id"]) for e in select_buildings(paths, source_elements(paths), bounds, request)]
    current = read_json(paths.scope) or {}
    record = dict(current)
    if title:
        record["title"] = title
    if bounds:
        record["bounds"] = bounds
    building_ids = [str(i) for i in record.get("building_ids", [])]
    known = set(building_ids)
    for bid in wanted:
        if bid not in known and bid not in excluded:
            building_ids.append(bid); known.add(bid)
    exclusions = [str(i) for i in record.get("exclusions", [])]
    for bid in excluded:
        if bid not in exclusions:
            exclusions.append(bid)
    record["building_ids"] = [b for b in building_ids if b not in set(exclusions)]
    if exclusions:
        record["exclusions"] = exclusions
    if "building_ids" not in current and not record["building_ids"]:
        raise ValueError("a scope needs at least one structure (--ids, --ids-file, --bounds or --source)")
    if record != current:
        atomic_json(paths.scope, record)
    if not paths.config.exists():
        # A brand-new site: give it the minimal config `build` and `stage` read.
        atomic_json(paths.config, {"title": record.get("title", paths.name), "scope": paths.scope.name})
    elif not settings(paths).get("scope"):
        print(f"note: {paths.config} does not name a scope file; add \"scope\": \"{paths.scope.name}\" for build to honour it")
    return record


# --------------------------------------------------------------------------
# CLI

def register(subparsers):
    p = subparsers.add_parser("build", help="build data/<site>/site.json from source/ and overrides.json")
    p.add_argument("site", help="site name or data/<site>")
    p.set_defaults(run=_run_build)

    p = subparsers.add_parser("scope", help="freeze which structures a miniature contains (sites/<site>/scope.json)")
    p.add_argument("site")
    p.add_argument("--ids", nargs="*", default=None, help="structure ids to include")
    p.add_argument("--ids-file", help="file with one structure id per line")
    p.add_argument("--bounds", help="south,west,north,east in degrees")
    p.add_argument("--exclude", nargs="*", default=None, help="structure ids to leave out")
    p.add_argument("--source", help="seed data/<site>/source/ from this site's cached downloads")
    p.add_argument("--title")
    p.add_argument("--padding", type=float, default=24, help="metres around selected footprints when deriving bounds")
    p.set_defaults(run=_run_scope)


def _run_build(args):
    paths = site_paths(args.site)
    site = build(paths)
    print(f"{paths.scene}: {summary(site)}")
    return 0


def _run_scope(args):
    paths = site_paths(args.site)
    record = scope(paths, ids=args.ids, ids_file=args.ids_file, bounds=args.bounds, exclude=args.exclude,
                   title=args.title, source=args.source, padding=args.padding)
    print(f"{paths.scope}: {len(record.get('building_ids', []))} structures"
          + (f", {len(record['exclusions'])} excluded" if record.get("exclusions") else ""))
    return 0
