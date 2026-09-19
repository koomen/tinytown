"""Stage 3: gather references per building into data/<site>/buildings/<id>/.

    ./town refs avon-extended 1090362846 1090362845            # head-on Street View captures, all four faces
    ./town refs avon-extended 1090362846 --faces=-v,+u --dists 20,35
    ./town refs avon-extended --list queue.txt --workers 2 --force
    ./town refs avon-extended --all --aerials                  # also crop aerials (sources.crop_aerials)
    ./town refs avon-extended 1090362846 --web --extra-views 1 # also assemble the model packet (references.json)
    ./town brief avon-extended 1090362846                      # buildings/<id>/brief.md + footprint.png
    ./town plan avon-extended --limit 8                        # which structures still need research

Everything recorded about one structure lives in buildings/<id>/:

    fronts.json        Street View capture records (see `capture_fronts`), photos in fronts/
    fronts/<face>.png  head-on capture of a face; more photos of the same face are
                       fronts/<face>-2.png, fronts/<face>-3.png; obliques fronts/oblique-<n>.png
    aerial.json        aerial crop record written by sources.crop_aerials (aerial.png beside it)
    references.json    the packet assembled for the model: which images, why, camera poses
    images/            packet imagery: reference-<n>.jpg, orientation.png, street-views.jpg,
                       web-original-<hash> downloads
    brief.md           human-readable brief for the author
    footprint.png      footprint card (polygon in the blueprint u/v frame)

Every `file`/`path` field inside fronts.json and references.json is relative
to that building directory (`fronts/+u.png`, `images/reference-1.jpg`), so a
site can be moved or renamed without rewriting records. Records written
before September 2026 name photos `front_<id>_<face>[_n].png`;
`normalize_fronts` maps those to the new names on read, so committed records
keep working (the images themselves are regenerable and gitignored).

Third-party content: Street View captures, aerial crops and downloaded web
images are reference material for the person or model authoring a blueprint.
They are used locally under the respective services' terms, are never
published with the miniature, and every such image directory is gitignored
(`fronts/`, `images/`, `*.png`, `*.jpg` under buildings/). Only the JSON
records describing where a capture stood are committed.

Faces are named by outward normal in the blueprint frame (+u, -u, +v, -v),
see site.faces. A capture stands `dist` metres straight out from the face
midpoint, lets Google snap to the nearest panorama, re-aims from where the
pano really is, and screenshots headless Chromium with the Maps UI hidden.
Faces without coverage (back lots, party walls) are recorded as such.

Standard library only at import time; PIL, websocket and the browser harness
are imported inside the functions that need them.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import html
import io
import json
import math
from pathlib import Path
import re
import threading
import time
import urllib.parse
import urllib.request

from .paths import ROOT, SitePaths, site_paths
from .site import (FACE_NAMES, M_PER_DEG_LAT, bearing, compass, faces, find_building, load_overrides, load_site,
                   neighbours, polygon_uv, settings, street_view_url, terrain_at, to_latlon, to_uv, viewpoints)
from .state import (atomic_json, atomic_text, building_frame, building_status, fingerprint, pending_faces,
                    read_json)

MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
DEFAULT_WORKERS = 2
WORKERS_WARNING = "--workers 3+ makes Google flaky; captures may come back black or land on the wrong pano"
MIN_SEPARATION = 8.0  # metres; moving within one panorama does not reveal an occluded wall
FRONTS_DIR = 'fronts'
IMAGES_DIR = 'images'
OLD_FRONT = re.compile(r'^front_(-?\d+)_([+-][uv]|oblique)(?:_(\d+))?\.png$')
_print_lock = threading.Lock()


def log(*a):
    with _print_lock:
        print(*a, flush=True)


def _paths(site_or_paths):
    return site_or_paths if isinstance(site_or_paths, SitePaths) else site_paths(site_or_paths)


# --------------------------------------------------------------------------
# Record conventions

def photo_name(face, n=1):
    """fronts/<face>.png for the first photo of a face, fronts/<face>-<n>.png after that."""
    return f'{FRONTS_DIR}/{face}.png' if n <= 1 else f'{FRONTS_DIR}/{face}-{n}.png'


def normalize_file(name):
    """Map a pre-2026-09 photo name (front_<id>_+u_2.png) to fronts/+u-2.png; leave new names alone."""
    if not name:
        return name
    m = OLD_FRONT.match(Path(name).name)
    if m:
        _, face, n = m.groups()
        if face == 'oblique':
            return f'{FRONTS_DIR}/oblique-{int(n) if n else 1}.png'
        return photo_name(face, int(n) if n else 1)
    text = str(name).replace('\\', '/')
    if '/' not in text:
        return f'{FRONTS_DIR}/{text}'
    return text


def normalize_fronts(record, bid=None):
    """A fronts.json record with every photo `file` in the current convention (relative to buildings/<id>/).

    Returns a new record; the input is not modified. `bid` is accepted for
    symmetry with the old names but the mapping does not depend on it.
    """
    if not record:
        return record
    out = json.loads(json.dumps(record))
    for face in (out.get('faces') or {}).values():
        for photo in face.get('photos', []) or []:
            if photo.get('file'):
                photo['file'] = normalize_file(photo['file'])
    extra = out.get('extra_views') or {}
    for photo in extra.get('photos', []) or []:
        if photo.get('file'):
            photo['file'] = normalize_file(photo['file'])
    for attempt in extra.get('attempts', []) or []:
        if attempt.get('file'):
            attempt['file'] = normalize_file(attempt['file'])
    return out


def load_fronts(paths, bid, default=None):
    """buildings/<id>/fronts.json, normalized; `default` when absent."""
    record = read_json(_paths(paths).building(bid).fronts)
    return normalize_fronts(record, bid) if record else default


def all_records(index):
    """Every photo record in a fronts index: per-face photos then extra (oblique) views."""
    index = index or {}
    return ([r for f in index.get('faces', {}).values() for r in f.get('photos', [])]
            + (index.get('extra_views') or {}).get('photos', []))


def photo_path(building, record):
    """Absolute path of a photo record's image under buildings/<id>/."""
    return building.dir / normalize_file(record['file'])


# --------------------------------------------------------------------------
# Street View geometry helpers

def pano_position(url):
    m = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+),\d+(?:\.\d+)?a,", url)   # "…,3a," when requested, "…,199a," once resolved
    return (float(m.group(1)), float(m.group(2))) if m else None


def pano_id(url):
    return url.split("!1s", 1)[1].split("!", 1)[0] if "!1s" in url else None


def local_from_latlon(site, lat, lon):
    lat0, lon0 = site["center"]["lat"], site["center"]["lon"]
    k = M_PER_DEG_LAT * math.cos(math.radians(lat0))
    return (lon - lon0) * k, -(lat - lat0) * M_PER_DEG_LAT


world = local_from_latlon


def est_height(b):
    st = b.get("style") or {}
    return (st.get("floors") or 2) * (st.get("floorH") or 3.6) + 3


def default_dists(width, est_h):
    # 55° fov: the whole face fits from ~0.95 × width (or 1.3 × height) away; add a farther stand
    w = max(width, 8)
    near = round(max(14, min(70, max(0.95 * w, 1.2 * est_h))))
    far = round(max(24, min(90, max(1.6 * w, 2.0 * est_h))))
    return sorted({near, far, 30})


def is_dark(path, threshold=18):
    from PIL import Image, ImageStat
    im = Image.open(path).convert("L")
    im.thumbnail((200, 200))
    return ImageStat.Stat(im).mean[0] < threshold


def imagery_date(tab):
    try:
        txt = tab.ev("document.body ? document.body.innerText.slice(0, 6000) : ''") or ""
    except RuntimeError:
        return None
    m = re.search(rf"\b(?:{MONTHS})\w* \d{{4}}\b", txt)
    return m.group(0) if m else None


def street_view_urls(paths, bid, dists=(18, 28, 40), fov=55):
    """Head-on Street View viewpoints for every face (the old sv_urls tool).

    Returns {face: {'bearing', 'width', 'road', 'views': [{'dist','heading','lat','lon','url'}, ...]}}.
    Google snaps to the nearest pano, so try the distances in order; edit `…h`
    in a URL to nudge the heading and `…y` to zoom.
    """
    paths = _paths(paths)
    site = load_site(paths)
    b = find_building(site, bid)
    fs = faces(b)
    return {k: {'bearing': round(f['bearing']), 'width': round(f['width'], 1), 'road': f['road'],
                'views': viewpoints(site, b, k, tuple(dists), fov)} for k, f in fs.items()}


def format_street_view_urls(paths, bid, dists=(18, 28, 40)):
    site = load_site(_paths(paths))
    b = find_building(site, bid)
    o = b['obb']
    lines = [f"{b['id']} {b.get('addr') or ''} {b.get('name') or ''}  obb {o['w']:.1f} x {o['d']:.1f} m, "
             f"centroid local ({o['cx']:.0f}, {o['cz']:.0f})",
             f"  road side: {next((k for k, f in faces(b).items() if f['road']), None)} "
             f"({b['front']['road'] if b.get('front') else '?'})"]
    for name, f in street_view_urls(paths, bid, dists).items():
        lines.append(f"  face {name}: looks toward {f['bearing']}°, width {f['width']} m{'  <- road' if f['road'] else ''}")
        lines += [f"    {v['dist']:>3.0f} m: {v['url']}" for v in f['views']]
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Head-on captures

def capture_face(tab, site, b, face, dists, fov, out_dir, seen, max_photos=None, deadline=None):
    """Capture up to len(dists) distinct panos for one face into out_dir/fronts/. Returns the record list.

    `deadline` is a time.monotonic() value; when set, each pano gets one
    attempt and the loop stops ten seconds before it.
    """
    out_dir = Path(out_dir)
    f = faces(b)[face]
    est_h = est_height(b)
    nx, nz = f["normal"]
    mx, mz = f["mid"]
    recs = []
    n_ok = 0
    for vp in viewpoints(site, b, face, dists, fov):
        if deadline and time.monotonic() > deadline - 10:
            break
        pid = None
        for attempt in range(1 if deadline else 3):
            tab.reset()
            tab.go(vp["url"])
            pid = tab.wait_pano(settle=0, **({'timeout': min(16, max(1, deadline - time.monotonic()))} if deadline else {}))
            if pid:
                break
            if not deadline:
                time.sleep(3 + 3 * attempt)
        if not pid:
            recs.append({"face": face, "dist": vp["dist"], "coverage": False})
            log(f"  {b['id']} {face} @{vp['dist']}m: no Street View coverage")
            continue
        pos = pano_position(tab.url())
        if pos:
            px, pz = local_from_latlon(site, *pos)
            dx, dz = mx - px, mz - pz
            actual_d = math.hypot(dx, dz)
            head = bearing(dx, dz)                                   # from the pano to the face midpoint
            off = abs((math.degrees(math.atan2(dx * nz - dz * nx, -(dx * nx + dz * nz))) + 180) % 360 - 180)  # angle off head-on
        else:
            actual_d, head, off = vp["dist"], vp["heading"], 0.0
        key = (pid, round(head / 5))
        if key in seen:
            log(f"  {b['id']} {face} @{vp['dist']}m: same pano as before ({pid[:8]}), skipped")
            continue
        seen.add(key)
        # widen the view for close stands so the whole face fits, and tilt up a
        # little toward the middle of a tall facade (the camera is ~2.5 m up)
        d_eff = max(actual_d, 4)
        need = max(2 * math.degrees(math.atan2(f["width"] / 2, d_eff)) + 12,
                   2 * math.degrees(math.atan2((est_h + 1) / 2, d_eff)) + 10)
        use_fov = min(80, max(fov, round(need)))                  # Maps ignores fov much past 80 / tilt past 100
        tilt = 90 + int(max(0, min(10, math.degrees(math.atan2(est_h / 2 - 2.5, d_eff)))))
        if pos and (abs(head - vp["heading"]) > 4 or use_fov != fov or tilt != 90):
            tab.reset()
            tab.go(street_view_url(pos[0], pos[1], head, use_fov, tilt))
            tab.wait_pano(settle=0, **({'timeout': min(16, max(1, deadline - time.monotonic()))} if deadline else {}))
        time.sleep(6.0 + (3.0 if use_fov > 65 else 0))  # let the WebGL tiles finish streaming (wide views load more)
        date = imagery_date(tab)
        tab.hide_all_but_canvas()
        time.sleep(0.5)
        tab.hide_all_but_canvas()  # Maps re-mounts some chrome after the first pass
        n_ok += 1
        name = photo_name(face, n_ok)
        path = out_dir / name
        path.parent.mkdir(parents=True, exist_ok=True)
        tab.shot(str(path))
        for _ in range(2):  # a black frame means the WebGL tiles had not drawn yet
            if not is_dark(path):
                break
            time.sleep(4.0)
            tab.hide_all_but_canvas()
            tab.shot(str(path))
        if is_dark(path):
            log(f"  {b['id']} {face}: capture stayed black, dropped")
            path.unlink(missing_ok=True)
            n_ok -= 1
            continue
        rec = {"face": face, "file": name, "pano": pid, "dist": round(actual_d, 1), "off_axis_deg": round(off),
               "fov": use_fov, "tilt": tilt, "heading": round(head), "date": date, "coverage": True,
               "url": tab.url() if "google.com/maps" in tab.url() else vp["url"],
               "position": {"lat": pos[0], "lon": pos[1]} if pos else None}
        recs.append(rec)
        log(f"  {b['id']} {face} -> {name}  pano {pid[:8]} {rec['dist']} m out, {rec['off_axis_deg']}° off axis, {rec['date']}")
        if max_photos and n_ok >= max_photos:
            break
    return recs


def capture_building(paths, site, bid, face_list, dists=None, fov=55, force=False, missing=False, max_photos=None,
                     budget_seconds=None, deadline=None):
    """Capture the pending faces of one building into buildings/<id>/fronts/ and fronts.json.

    Resumes: faces already complete (record and image present) are skipped
    unless `force`; `missing` retries faces recorded without coverage. Raises
    ValueError when the footprint moved since the record was written (the old
    evidence must be reviewed; `force` recaptures the selected faces).
    """
    from .browser import Tab
    paths = _paths(paths)
    building = paths.building(bid)
    b = find_building(site, bid)
    fs = faces(b)
    old = load_fronts(paths, bid)
    frame = building_frame(site, b)
    if old and old.get("frame") != frame and not force:
        raise ValueError(f"{bid}: capture frame changed or is unknown; review existing evidence and use --force for selected faces")
    selected = pending_faces(old, face_list, building.dir, force, missing)
    if not selected:
        log(f"{bid}: selected faces complete; no browser work")
        return old
    # Keep unselected faces, even with --force; never delete evidence up front.
    done = dict((old or {}).get("faces", {})) if not old or old.get("frame") == frame else {}
    idx = {"id": str(bid), "addr": b.get("addr"), "name": b.get("name"), "frame": frame, "faces": done}
    if old and old.get('frame') == frame and old.get('extra_views'):
        idx['extra_views'] = old['extra_views']
    log(f"{bid} {b.get('addr') or ''}: capturing {', '.join(selected)}")
    if budget_seconds and not deadline:
        deadline = time.monotonic() + budget_seconds
    building.dir.mkdir(parents=True, exist_ok=True)
    with Tab(1400, 1000) as tab:
        if deadline and getattr(tab, 'ws', None) is not None:
            tab.ws.settimeout(20)
        for face in selected:
            if deadline and time.monotonic() > deadline - 10:
                break
            d = dists or default_dists(fs[face]["width"], est_height(b))
            records = capture_face(tab, site, b, face, d, fov, building.dir, set(), max_photos, deadline)
            photos = [r for r in records if r.get("coverage")]
            done[face] = {"bearing": round(fs[face]["bearing"]), "width": round(fs[face]["width"], 1),
                          "road": fs[face]["road"], "photos": photos, "coverage": bool(photos),
                          "status": "complete" if photos else ("no-coverage" if len(records) == len(d) and all(not r.get("coverage") for r in records) else "retry"),
                          "attempts": len(d), "photo_limit": max_photos}
            idx["captured"] = time.strftime("%Y-%m-%d %H:%M")
            atomic_json(building.fronts, idx)  # interruption loses at most the active face
    log(f"{bid}: saved {building.fronts}")
    return idx


def face_list_for(site, bid, faces_spec=None):
    """`faces_spec`: None/'all' -> the four faces; 'road' -> the road face; or an iterable / comma list of names."""
    if faces_spec in (None, 'all'):
        return list(FACE_NAMES)
    if faces_spec == 'road':
        fs = faces(find_building(site, bid))
        return [k for k in fs if fs[k]["road"]] or ["+u"]
    names = faces_spec.split(',') if isinstance(faces_spec, str) else list(faces_spec)
    return [x for x in names if x in FACE_NAMES]


def capture_fronts(paths, ids, *, faces=None, force=False, missing=False, max_photos=None, workers=DEFAULT_WORKERS,
                   dists=None, fov=55, deadline=None, budget_seconds=None, extra_views=0, extra_seconds=90):
    """Head-on Street View captures for `ids` (see `capture_building`), `workers` buildings at once.

    `faces`: None for all four, 'road', or a list / comma list of face names.
    `deadline`: a time.monotonic() value after which no new pano is probed
    (faces left pending resume on the next run); `budget_seconds` bounds each
    building instead. `extra_views` adds up to two distinct oblique
    panoramas per building afterwards (`capture_extra_views`). Raises
    RuntimeError after the batch if any building failed.
    """
    paths = _paths(paths)
    ids = list(dict.fromkeys(str(x) for x in ids))
    if not ids:
        log("No queued buildings; nothing to do.")
        return
    if workers >= 3:
        log(f"WARNING: {WORKERS_WARNING}")
    site = load_site(paths)
    from .browser import ensure_browser
    ensure_browser()

    def work(bid):
        capture_building(paths, site, bid, face_list_for(site, bid, faces), dists, fov, force, missing, max_photos,
                         budget_seconds, deadline)
        if extra_views:
            capture_extra_views(paths, bid, extra_views, extra_seconds, site=site)

    errors = []
    with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        futures = {ex.submit(work, bid): bid for bid in ids}
        for future, bid in futures.items():
            try:
                future.result()
            except Exception as e:  # keep the batch going
                errors.append(f"{bid}: {e}")
                log(f"ERROR: {bid}: {e}")
    if errors:
        raise RuntimeError("; ".join(errors))


# --------------------------------------------------------------------------
# Orientation: geographic context and rendered entrance locations (no model inference)

def uv_world(b, u, v):
    o = b['obb']; c, s = math.cos(o['angle']), math.sin(o['angle'])
    return o['cx'] + u * c - v * s, o['cz'] + u * s + v * c


def nearest_road(site, point, outward=None):
    choices = []
    for road in site.get('roads', []):
        if not road.get('name'):
            continue
        for a, b in zip(road['pts'], road['pts'][1:]):
            dx, dz = b[0] - a[0], b[1] - a[1]; length = dx * dx + dz * dz
            if outward:
                # Cast straight outward: a merely nearby diagonal street must
                # not be mislabeled as the street this elevation faces.
                nx, nz = outward; den = nx * dz - nz * dx
                if abs(den) < 1e-9:
                    continue
                ax, az = a[0] - point[0], a[1] - point[1]
                distance = (ax * dz - az * dx) / den; along = (ax * nz - az * nx) / den
                if 0 < distance < 200 and 0 <= along <= 1:
                    choices.append((distance, road['name'], road.get('circular', False)))
                continue
            t = max(0, min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (length or 1)))
            x, z = a[0] + t * dx - point[0], a[1] + t * dz - point[1]
            choices.append((math.hypot(x, z), road['name'], road.get('circular', False)))
    if not choices:
        return None
    distance, name, circular = min(choices)
    return {'name': name, 'circular': circular, 'distance_m': round(distance, 1)}


def face_context(site, b):
    return {k: {'bearing': round(f['bearing']), 'compass': compass(f['bearing']),
                'left_bearing': round(f['left']), 'right_bearing': round((f['left'] + 180) % 360),
                'nearest_road_outward': nearest_road(site, f['mid'], f['normal']),
                'nearest_road_hint': f['road']}
            for k, f in faces(b).items()}


def capture_pose(site, b, record):
    """Where a capture really stood and looked. The resolved panorama URL takes precedence over the requested face name."""
    url = record.get('url', '') or ''
    match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
    position = ({'lat': float(match[1]), 'lon': float(match[2])} if match else record.get('position'))
    heading_match = re.search(r',([\d.]+)h', url)
    heading = float(heading_match[1]) if heading_match else record.get('heading')
    if not position or heading is None:
        return {'status': 'unlocated', 'reason': 'No resolved panorama position and heading; filename is only a capture request.'}
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (position.get('lat'), position.get('lon'), heading)):
        return {'status': 'unlocated', 'reason': 'Invalid camera coordinates.'}
    x, z = world(site, position['lat'], position['lon']); u, v = to_uv(b, x, z)
    facing = [k for k, f in faces(b).items() if (x - f['mid'][0]) * f['normal'][0] + (z - f['mid'][1]) * f['normal'][1] > .2]
    toward = bearing(b['obb']['cx'] - x, b['obb']['cz'] - z)
    return {'status': 'located', 'source': 'resolved-panorama-url' if match else 'capture-position',
            'lat': position['lat'], 'lon': position['lon'], 'position_xz': [round(x, 2), round(z, 2)],
            'position_uv': [round(u, 2), round(v, 2)], 'looking_bearing': round(heading % 360, 1),
            'looking_compass': compass(heading), 'image_left_bearing': round((heading - 90) % 360, 1),
            'image_right_bearing': round((heading + 90) % 360, 1),
            'target_center_offset_deg': round((toward - heading + 180) % 360 - 180, 1),
            'geometrically_facing_camera': facing, 'requested_face': record.get('face'),
            'off_axis_deg': record.get('off_axis_deg'), 'fov': record.get('fov'), 'tilt': record.get('tilt'),
            'near_road': nearest_road(site, (x, z)),
            'limitation': 'Approximate panorama pose; facing-camera sides are not proof of visibility, identity or lack of occlusion.'}


def entrance_inventory(bp, b, site):
    """Enumerate actual door components of a blueprint, including nested porch doors and face defaults."""
    result = []
    for vol in (bp or {}).get('volumes', []):
        poly = vol.get('polygon')
        for i, key in enumerate([f'edge{i}' for i in range(len(poly))] if poly else FACE_NAMES):
            spec = vol.get('faces', {}).get(key, vol.get('faces', {}).get('default', {}))
            if not isinstance(spec, dict):
                continue
            if poly:
                a, q = poly[i], poly[(i + 1) % len(poly)]; du, dv = q[0] - a[0], q[1] - a[1]; length = math.hypot(du, dv)
                if not length:
                    continue
                normal = (dv / length, -du / length)
                point = lambda f: (q[0] - f * du, q[1] - f * dv)
            else:
                if not all(k in vol for k in ('u', 'v')):
                    continue
                u0, u1 = vol['u']; v0, v1 = vol['v']
                normal = {'+u': (1, 0), '-u': (-1, 0), '+v': (0, 1), '-v': (0, -1)}[key]
                point = lambda f: {'+u': (u1, v1 - f * (v1 - v0)), '-u': (u0, v0 + f * (v1 - v0)),
                                   '+v': (u0 + f * (u1 - u0), v1), '-v': (u1 - f * (u1 - u0), v0)}[key]
            o = b['obb']; c, s = math.cos(o['angle']), math.sin(o['angle'])
            nx, nz = normal[0] * c - normal[1] * s, normal[0] * s + normal[1] * c
            items = [('door', d, 0) for d in spec.get('doors', [])]
            for porch in spec.get('porches', []):
                if porch.get('style') not in ('open', 'carport'):
                    items.append(('porch-door', {**porch.get('door', {}), 'at': porch.get('at', .5)}, porch.get('d', 1)))
            for kind, door, depth in items:
                at = door.get('at', .5); u, v = point(at); u += normal[0] * depth; v += normal[1] * depth
                x, z = uv_world(b, u, v)
                result.append({'volume': vol.get('id'), 'face': key, 'kind': kind, 'at': at,
                               'position_uv': [round(u, 2), round(v, 2)], 'position_xz': [round(x, 2), round(z, 2)],
                               'outward_bearing': round(bearing(nx, nz)), 'outward_compass': compass(bearing(nx, nz)),
                               'type': door.get('type', 'rect'), 'color': door.get('color', 'renderer default'),
                               'toward_road': nearest_road(site, (x, z), (nx, nz))})
    return result


def orientation_card(site, b, records, target):
    """North-up diagram with labeled roads, footprint sides and panorama rays, saved to `target`."""
    from PIL import Image, ImageDraw, ImageFont
    font = ImageFont.load_default(size=17); small = ImageFont.load_default(size=14)
    im = Image.new('RGB', (900, 820), '#f5f3ed'); d = ImageDraw.Draw(im)
    o = b['obb']; cx, cz = o['cx'], o['cz']
    cameras = [r['camera'] for r in records if r.get('camera', {}).get('status') == 'located']
    extent = max(60, max((math.hypot(c['position_xz'][0] - cx, c['position_xz'][1] - cz) + 12 for c in cameras), default=0),
                 max(o['w'], o['d']) * .8)
    scale = 305 / extent
    P = lambda x, z: (450 + (x - cx) * scale, 350 + (z - cz) * scale)
    labeled = set(); labels = []
    for road in site.get('roads', []):
        pts = [P(x, z) for x, z in road['pts']]
        if len(pts) < 2:
            continue
        d.line(pts, fill='#ccc6b8', width=max(2, round(road.get('width', 5) * scale)))
        name = road.get('name')
        if name and name not in labeled:
            candidates = [p for p in pts if 85 < p[0] < 760 and 60 < p[1] < 625]
            if candidates:
                x, y = min(candidates, key=lambda p: abs(p[0] - 450) + abs(p[1] - 350))
                label = name + (' (circle)' if road.get('circular') else '')
                labels.append(((x + 5, y - 22), label)); labeled.add(name)
    for pos, label in labels:
        box = d.textbbox(pos, label, font=small)
        d.rectangle((box[0] - 3, box[1] - 2, box[2] + 3, box[3] + 2), fill='#f5f3ed')
        d.text(pos, label, fill='#706345', font=small)
    for other in site.get('buildings', []):
        if str(other['id']) != str(b['id']):
            d.polygon([P(x, z) for x, z in other['pts']], fill='#e0ddd3', outline='#a7a598')
    d.polygon([P(x, z) for x, z in b['pts']], fill='#dce8d6', outline='#355d4f', width=3)
    for k, f in faces(b).items():
        nx, nz = f['normal']; x, z = f['mid']; px, py = P(x + nx * 6, z + nz * 6)
        d.rectangle((px - 17, py - 12, px + 19, py + 12), fill='#f5f3ed')
        d.text((px - 14, py - 11), k, fill='#205f9d', font=font)
    for record in records:
        cam = record.get('camera', {})
        if cam.get('status') != 'located':
            continue
        x, z = cam['position_xz']; heading = math.radians(cam['looking_bearing'])
        start = P(x, z); end = P(x + math.sin(heading) * 12, z - math.cos(heading) * 12)
        d.line((start, end), fill='#c0672e', width=3)
        angle = math.atan2(end[1] - start[1], end[0] - start[0])
        d.polygon([end, (end[0] - 9 * math.cos(angle - .5), end[1] - 9 * math.sin(angle - .5)),
                   (end[0] - 9 * math.cos(angle + .5), end[1] - 9 * math.sin(angle + .5))], fill='#c0672e')
        d.ellipse((start[0] - 5, start[1] - 5, start[0] + 5, start[1] + 5), fill='#c0672e')
        d.text((start[0] + 7, start[1] + 3), record['id'], fill='#9f491c', font=font)
    d.line([(845, 110), (845, 60)], fill='#263e39', width=3); d.text((837, 38), 'N', fill='#263e39', font=font)
    d.rectangle((0, 0, 900, 36), fill='#f5f3ed')
    d.text((20, 10), 'NORTH UP | camera arrows show viewing direction, not facade normals', fill='#263e39', font=font)
    d.rectangle((0, 658, 900, 820), fill='#f5f3ed')
    d.text((20, 665), 'Face normals point OUT of the building. Nearest-road hint is NOT the main entrance.', font=small, fill='#263e39')
    for i, (key, f) in enumerate(face_context(site, b).items()):
        r = f['nearest_road_outward']; road = r['name'] + (' (circle)' if r['circular'] else '') if r else 'no named road'
        d.text((22, 692 + i * 27), f"{key}: {f['compass']} {f['bearing']} deg outward | toward {road} | image-left for head-on view: {compass(f['left_bearing'])}",
               font=small, fill='#263e39')
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    im.save(target)
    return Path(target)


# --------------------------------------------------------------------------
# Extra oblique views: bounded, geometry-selected, no model calls

def base_views(index, directory, bid=None):
    """One best photo per requested face (lowest off-axis angle) among the images present under `directory`/fronts/."""
    directory = Path(directory)
    records = {normalize_file(r['file']): r for r in all_records(index) if r.get('file')}
    selected = []
    for face in FACE_NAMES:
        present = sorted(p for p in (directory / FRONTS_DIR).glob(f'{face}*.png')
                         if re.fullmatch(re.escape(face) + r'(?:[-_]\d+)?\.png', p.name))
        if present:
            rel = lambda p: f'{FRONTS_DIR}/{p.name}'
            p = min(present, key=lambda p: (records.get(rel(p), {}).get('off_axis_deg', 180), p.name))
            selected.append({**records.get(rel(p), {}), 'file': rel(p), 'face': face})
    return selected


def located(site, b, record):
    pose = capture_pose(site, b, record)
    return pose.get('position_xz') if pose.get('status') == 'located' else None


def distinct(site, b, record, selected):
    pos = located(site, b, record)
    if pos is None:
        return False
    for old in selected:
        if record.get('pano') and record['pano'] == old.get('pano'):
            return False
        other = located(site, b, old)
        if other and math.dist(pos, other) < MIN_SEPARATION:
            return False
    return True


def corner_score(b, pos, existing):
    """Reward a view of two OBB faces and angular separation from known views; None when not an oblique stand."""
    o = b['obb']; dx, dz = pos[0] - o['cx'], pos[1] - o['cz']
    dist = math.hypot(dx, dz)
    c, s = math.cos(o['angle']), math.sin(o['angle'])
    u, v = dx * c + dz * s, -dx * s + dz * c
    if dist < 10 or dist > 110 or abs(u) <= o['w'] / 2 + 2 or abs(v) <= o['d'] / 2 + 2:
        return None
    angle = math.atan2(dz, dx)
    angles = [math.atan2(p[1] - o['cz'], p[0] - o['cx']) for p in existing]
    gap = min((abs((angle - a + math.pi) % (2 * math.pi) - math.pi) for a in angles), default=math.pi)
    # Very distant stands and very unequal face projections provide less detail.
    balance = min(abs(u), abs(v)) / max(abs(u), abs(v))
    return math.degrees(gap) + 20 * balance - dist * .15


def select_views(site, b, index, directory, count=2):
    """(base, extra): the per-face selection plus up to `count` distinct located oblique views.

    `directory` is the building directory (photo files are relative to it).
    No extras when the index frame no longer matches the footprint.
    """
    index = normalize_fronts(index or {})
    base = base_views(index, directory, b['id'])
    if index.get('frame') != building_frame(site, b):
        return base, []
    extras = []
    candidates = [r for r in all_records(index) if r.get('file') and (Path(directory) / r['file']).exists()]
    while len(extras) < count:
        selected = base + extras
        positions = [p for r in selected if (p := located(site, b, r)) is not None]
        scored = [(corner_score(b, located(site, b, r), positions), r) for r in candidates
                  if distinct(site, b, r, selected)]
        scored = [(s, r) for s, r in scored if s is not None]
        if not scored:
            break
        extras.append(max(scored, key=lambda pair: (pair[0], pair[1]['file']))[1])
    return base, extras


def road_candidates(site, b):
    """Sample ordinary road centerlines; no named-road or entrance preference."""
    seen = set()
    for road in site.get('roads', []):
        pts = road.get('pts', [])
        segments = list(zip(pts, pts[1:]))
        if road.get('circular') and pts and pts[-1] != pts[0]:
            segments.append((pts[-1], pts[0]))
        for a, z in segments:
            n = max(1, math.ceil(math.dist(a, z) / 8))
            for i in range(n + 1):
                pos = tuple(a[k] + (z[k] - a[k]) * i / n for k in (0, 1))
                key = tuple(round(x / 3) for x in pos)
                if key not in seen and corner_score(b, pos, []) is not None:
                    seen.add(key)
                    yield pos


def capture_extra_views(paths, bid, count=2, seconds=90, *, site=None):
    """Up to `count` distinct oblique panoramas (fronts/oblique-<n>.png), at most four probes; every success saved immediately."""
    from .browser import Tab
    paths = _paths(paths)
    building = paths.building(bid)
    site = site or load_site(paths)
    b = find_building(site, bid)
    index = load_fronts(paths, bid, {})
    if index.get('frame') != building_frame(site, b):
        raise ValueError(f'{bid}: extra views require a compatible capture frame')
    base, extras = select_views(site, b, index, building.dir, count)
    if len(extras) >= count or count == 0:
        log(f'{bid}: {len(extras)} distinct cached oblique views; no extra browser work')
        return index
    saved = index.setdefault('extra_views', {})
    # An exhausted acquisition is cached too; no hidden retry on every new run.
    if saved.get('status') in ('complete', 'exhausted') and saved.get('requested', 0) >= count:
        return index
    saved.update(requested=count, status='running')
    saved.setdefault('photos', []); saved.setdefault('attempts', [])
    start = time.monotonic(); deadline = start + seconds
    selected = base + extras; attempted = []
    candidates = list(road_candidates(site, b)); o = b['obb']
    with Tab(1400, 1000) as tab:
        if getattr(tab, 'ws', None) is not None:
            tab.ws.settimeout(min(20, seconds))
        for _ in range(4):
            if len(extras) >= count or time.monotonic() > deadline - 12:
                break
            positions = [p for r in selected if (p := located(site, b, r)) is not None]
            available = [p for p in candidates if all(math.dist(p, old) >= MIN_SEPARATION for old in positions + attempted)]
            if not available:
                break
            pos = max(available, key=lambda p: corner_score(b, p, positions))
            attempted.append(pos)
            attempt = {'requested_xz': list(pos)}; saved['attempts'].append(attempt)
            try:
                lat, lon = to_latlon(site, *pos)
                tab.reset(); tab.go(street_view_url(lat, lon, bearing(o['cx'] - pos[0], o['cz'] - pos[1])))
                pid = tab.wait_pano(timeout=min(18, max(1, deadline - time.monotonic())), settle=0)
                resolved = pano_position(tab.url())
                if not pid or not resolved:
                    attempt['result'] = 'no-resolved-panorama'; continue
                actual = local_from_latlon(site, *resolved)
                rec = {'pano': pid, 'position': {'lat': resolved[0], 'lon': resolved[1]}}
                # capture_pose needs a heading to classify a record as located.
                rec['heading'] = round(bearing(o['cx'] - actual[0], o['cz'] - actual[1]))
                if not distinct(site, b, rec, selected) or corner_score(b, actual, positions) is None:
                    attempt['result'] = 'duplicate-or-not-oblique'; continue
                d = math.hypot(actual[0] - o['cx'], actual[1] - o['cz'])
                fov = min(80, max(45, round(math.degrees(2 * math.atan2(math.hypot(o['w'], o['d']) / 2, d)) + 12)))
                tilt = 90 + int(max(0, min(10, math.degrees(math.atan2(est_height(b) / 2 - 2.5, d)))))
                tab.reset(); tab.go(street_view_url(*resolved, rec['heading'], fov, tilt))
                if tab.wait_pano(timeout=min(18, max(1, deadline - time.monotonic())), settle=0) != pid:
                    attempt['result'] = 'panorama-changed-while-aiming'; continue
                time.sleep(min(8, max(0, deadline - time.monotonic())))
                name = f'{FRONTS_DIR}/oblique-{len(saved["photos"]) + 1}.png'
                path = building.dir / name
                path.parent.mkdir(parents=True, exist_ok=True)
                date = imagery_date(tab); tab.hide_all_but_canvas(); time.sleep(.5); tab.hide_all_but_canvas()
                tab.shot(str(path))
                if is_dark(path):
                    path.unlink(); attempt['result'] = 'black-frame'; continue
                fs = faces(b)
                face = max(fs, key=lambda f: sum((actual[k] - o[['cx', 'cz'][k]]) * fs[f]['normal'][k] for k in (0, 1)))
                rec.update(file=name, face=face, kind='oblique', coverage=True, fov=fov, tilt=tilt,
                           url=tab.url(), date=date, dist=round(d, 1))
                saved['photos'].append(rec); selected.append(rec); extras.append(rec)
                attempt.update(result='captured', file=name)
                log(f'{bid}: extra view -> {name}, distinct pano {pid[:8]}')
            except Exception as exc:
                attempt.update(result='failed', error=str(exc)[:250])
            finally:
                saved['elapsed_seconds'] = time.monotonic() - start
                atomic_json(building.fronts, index)
    saved.update(status='complete' if len(extras) >= count else 'exhausted', elapsed_seconds=time.monotonic() - start)
    atomic_json(building.fronts, index)
    log(f'{bid}: {len(extras)}/{count} additional views in {saved["elapsed_seconds"]:.1f}s')
    return index


# --------------------------------------------------------------------------
# Web images and the packet

def fetch(url, limit=8_000_000, timeout=10):
    if urllib.parse.urlparse(url).scheme not in ('http', 'https'):
        raise ValueError('web reference must use http or https')
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (miniature-reference-cache)'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read(limit + 1)
    if len(body) > limit:
        raise ValueError('web reference exceeds download limit')
    return body


def search_images(query):
    """Best-effort Bing HTML adapter; failure is recorded, never blocks authoring.

    A sites/<site>/web-references.json manifest can supply results from any
    provider instead. Search results remain untrusted candidates for the
    author's eyes.
    """
    page = fetch('https://www.bing.com/images/search?q=' + urllib.parse.quote(query)).decode('utf-8', 'replace')
    words = set(re.findall(r'[a-z]{3,}', query.lower())) - {'building', 'exterior', 'photo', 'church', 'school'}
    results = []
    for raw in re.findall(r'\bm="([^"]+)"', page):
        try:
            record = json.loads(html.unescape(raw))
            title = record.get('t', '')
            matches = words & set(re.findall(r'[a-z]{3,}', title.lower()))
            # A place name alone is weak evidence (e.g. a town sharing a name
            # with a cosmetics brand). Keep search best-effort and reject such
            # candidates before paying image tokens to inspect them.
            if record.get('murl') and len(matches) >= min(2, len(words)) and matches:
                results.append({'url': record['murl'], 'page_url': record.get('purl', ''),
                                'title': title, 'query': query, 'provider': 'bing-images'})
        except ValueError:
            pass
    return results[:4]


def small_image(source, target, edge=900):
    from PIL import Image, ImageOps
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((edge, edge))
        image.save(target, quality=86)


def contact_sheet(images, target, columns=2, cell=(600, 450)):
    """`images`: [(path, label)]; a labelled grid saved to `target`."""
    from PIL import Image, ImageDraw
    canvas = Image.new('RGB', (columns * cell[0], ((len(images) + columns - 1) // columns) * (cell[1] + 30)), '#f5f3ed')
    draw = ImageDraw.Draw(canvas)
    for index, (path, label) in enumerate(images):
        x, y = index % columns * cell[0], index // columns * (cell[1] + 30)
        with Image.open(path) as image:
            image = image.convert('RGB'); image.thumbnail(cell)
            canvas.paste(image, (x + (cell[0] - image.width) // 2, y + (cell[1] - image.height) // 2))
        draw.text((x + 10, y + cell[1] + 6), label, fill='#354b36')
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, quality=88)
    return Path(target)


def resolve(paths, bid, relative):
    """Absolute path of a `path`/`source_path`/`file` field from a building's records."""
    return _paths(paths).building(bid).dir / relative


def packet(paths, building, name, location, web_records, *, image_search='bing', max_web=1, extra_views=0, site=None):
    """Assemble buildings/<id>/references.json: Street View, aerial and optional web images for the model.

    Writes images/reference-<n>.jpg, images/orientation.png, images/street-views.jpg
    and images/web-original-<hash> downloads; every `path`/`source_path` in the
    record is relative to buildings/<id>/ (`resolve` makes them absolute).
    Re-running with the same inputs rewrites nothing.
    """
    from PIL import Image
    paths = _paths(paths)
    bid = str(building['id'])
    b = paths.building(bid)
    out = b.dir / IMAGES_DIR
    out.mkdir(parents=True, exist_ok=True)
    records, warnings = [], []
    site = site or load_site(paths)
    index = load_fronts(paths, bid, {})
    frame_ok = index.get('frame') == building_frame(site, building)
    if index and not frame_ok:
        warnings.append('Capture frame differs from current footprint; camera metadata is untrusted.')
    base, extra = select_views(site, building, index, b.dir, extra_views)
    for capture in base + extra:
        face = capture['face']
        camera = capture_pose(site, building, capture) if frame_ok else {'status': 'unlocated', 'reason': 'Missing or incompatible capture metadata.'}
        rid = f'SV{len(records) + 1}'
        records.append({'id': rid, 'source_path': capture['file'], 'kind': 'street-view',
                        'face': face, 'camera': camera, 'capture_url': capture.get('url'), 'pano': capture.get('pano'),
                        'additional_view': capture in extra,
                        'caption': f'{rid}: ' + ('additional oblique view; ' if capture in extra else '') +
                                   f'requested face {face}; use resolved camera, not filename, to interpret visible sides.'})
    if len(extra) < extra_views:
        warnings.append(f'Only {len(extra)}/{extra_views} additional distinct oblique views available within the capture limit.')
    aerial = b.dir / 'aerial.png'
    if aerial.exists():
        meta = read_json(b.aerial) or {}
        records.append({'id': 'AERIAL', 'source_path': aerial.name, 'kind': 'aerial',
                        'north_up': meta.get('north_up'),
                        'caption': 'Aerial: ' + ('north up. ' if meta.get('north_up') else 'orientation unverified. ') +
                                   'Match roof wings to the separate labeled footprint map; no facade orientation can be inferred from image-left alone.'})
    candidates = list(web_records or [])
    query = ' '.join(x for x in (name, location, 'building exterior') if x)
    if image_search == 'bing' and max_web and not candidates:
        try:
            candidates = search_images(query)
        except Exception as exc:
            warnings.append('Image search unavailable: ' + str(exc))
    if max_web and not candidates:
        warnings.append('No useful image-search candidates; using available Street View/aerial evidence.')
    kept = 0
    for candidate in candidates:
        if kept >= max_web:
            break
        try:
            raw = out / ('web-original-' + hashlib.sha256(candidate['url'].encode()).hexdigest()[:16])
            if not raw.is_file():
                body = fetch(candidate['url'])
                with Image.open(io.BytesIO(body)) as check:
                    check.verify()
                raw.write_bytes(body)
            records.append({**candidate, 'id': f'WEB{kept + 1}', 'source_path': f'{IMAGES_DIR}/{raw.name}', 'kind': 'web-image',
                            'camera': {'status': 'unlocated', 'reason': 'Web photo has no verified capture pose.'},
                            'caption': candidate.get('title', '') + ' (unlocated detail reference; verify identity and locate the facade using geolocated photographs before placing features)'})
            kept += 1
        except Exception as exc:
            warnings.append(f"Web image unavailable ({candidate.get('url')}): {exc}")
    for n, record in enumerate(records):
        source = b.dir / record['source_path']
        target = out / f'reference-{n + 1}.jpg'
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if not target.is_file() or _stamp(target) != digest:
            small_image(source, target)
            _stamp(target, digest)
        record['path'] = f'{IMAGES_DIR}/{target.name}'
        record['sha256'] = digest
    map_path = out / 'orientation.png'
    orientation_card(site, building, records, map_path)
    attachments = [{'id': 'MAP', 'kind': 'orientation-map', 'path': f'{IMAGES_DIR}/{map_path.name}',
                    'caption': 'North-up map: footprint, blueprint face normals, named roads, numbered Street View camera positions and viewing arrows.'}]
    street = [r for r in records if r['kind'] == 'street-view']
    if street:
        sheet = out / 'street-views.jpg'
        contact_sheet([(b.dir / r['path'], r['id'] + ' | requested ' + r['face'] + ' | looking ' +
                        str(r['camera'].get('looking_bearing', 'unknown')) + ' deg') for r in street], sheet, cell=(700, 500))
        attachments.append({'id': 'STREET-VIEWS', 'kind': 'street-view-atlas', 'path': f'{IMAGES_DIR}/{sheet.name}',
                            'caption': 'Labeled camera views; SV numbers match the orientation map.', 'members': [r['id'] for r in street]})
    attachments += [{k: r[k] for k in ('id', 'kind', 'path', 'caption')} for r in records if r['kind'] != 'street-view']
    value = {'version': 3, 'id': bid, 'name': name, 'location': location, 'address': building.get('addr'),
             'source_tags': building.get('tags', {}),
             'street_view_counts': {'directional': len(base), 'additional': len(extra)},
             'frame': {'width_u': building['obb']['w'], 'depth_v': building['obb']['d'],
                       'footprint_uv': polygon_uv(building),
                       'faces': face_context(site, building),
                       'rule': 'Face names describe outward normals, camera heading looks inward. The nearest-road hint and postal address do not establish the principal entrance.'},
             'attachments': attachments,
             'images': records, 'search_query': query, 'search_candidates': candidates, 'warnings': warnings}
    value = json.loads(json.dumps(value))  # what the file holds: tuples become lists, so equality means "unchanged"
    if read_json(b.references) != value:
        atomic_json(b.references, value)
    return value


def _stamp(target, digest=None):
    """Read or write the source digest recorded beside a derived image (gitignored .sha256)."""
    stamp = Path(str(target) + '.sha256')
    if digest is None:
        return stamp.read_text().strip() if stamp.is_file() else None
    stamp.write_text(digest + '\n')
    return digest


# --------------------------------------------------------------------------
# Photo-camera reconstruction and comparison sheets

def photo_camera(paths, bid, reference, site=None):
    """(image record, camera) for a reference id in buildings/<id>/references.json.

    The camera is the viewer pose reproducing the photo: `position` [x, y, z],
    `target`, `hfov`; `approximate` is always true. A located Street View
    capture supplies it; a record may instead carry an explicit `camera`
    with lat, lon, heading, tilt, hfov, eye.
    """
    paths = _paths(paths)
    b = paths.building(bid)
    site = site or load_site(paths)
    refs = (read_json(b.references) or {}).get('images', [])
    im = next((x for x in refs if x.get('id') == reference and x.get('status', 'accepted') == 'accepted'), None)
    if im is None:
        raise ValueError('choose an accepted reference ID')
    camera = im.get('camera')
    if camera is not None and camera.get('status') == 'located':
        camera = {'lat': camera['lat'], 'lon': camera['lon'], 'heading': camera['looking_bearing'],
                  'tilt': camera.get('tilt'), 'fov': camera.get('fov')}
    elif camera is not None and camera.get('status') is not None:
        camera = None  # an unlocated pose; fall back to the capture record
    if camera is None or 'hfov' not in camera:
        rec = None
        if camera is None:
            index = load_fronts(paths, bid, {})
            wanted = normalize_file(im.get('source_path') or im.get('path') or '')
            rec = next((r for r in all_records(index) if r.get('file') and normalize_file(r['file']) == wanted), None)
            if not rec:
                raise ValueError('reference lacks capture pose; supply image.camera explicitly')
            position = rec.get('position')
            if not position:
                m = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', rec.get('url', ''))
                if m:
                    position = {'lat': float(m[1]), 'lon': float(m[2])}
            if not position:
                raise ValueError('capture has no panorama coordinates; recapture or provide camera')
            camera = {**position, 'heading': rec['heading'], 'tilt': rec.get('tilt', 90), 'fov': rec.get('fov', 55)}
        if camera.get('tilt') is None or camera.get('fov') is None:
            raise ValueError('reference lacks fov/tilt; supply image.camera explicitly')
        # Maps' y/FOV zoom is vertical in these full-canvas captures. Convert
        # using the captured image aspect, not the output comparison crop.
        from PIL import Image
        with Image.open(b.dir / (im.get('path') or im['source_path'])) as photo:
            aspect = photo.width / photo.height
        hfov = 2 * math.degrees(math.atan(math.tan(math.radians(camera['fov']) / 2) * aspect))
        camera = {'lat': camera['lat'], 'lon': camera['lon'], 'heading': camera['heading'], 'tilt': camera['tilt'],
                  'hfov': hfov, 'eye': 2.5}
    if not all(type(camera.get(k)) in (int, float) and math.isfinite(camera[k]) for k in ('lat', 'lon', 'heading', 'tilt', 'hfov', 'eye')):
        raise ValueError('camera needs finite lat, lon, heading, tilt, hfov, eye')
    if not 1 < camera['hfov'] < 170:
        raise ValueError('invalid photo FOV')
    x, z = world(site, camera['lat'], camera['lon'])
    y = (terrain_at(site, x, z) if site.get('terrain') else 0) + camera['eye']
    heading = math.radians(camera['heading']); pitch = math.radians(camera['tilt'] - 90)
    target = [x + 50 * math.sin(heading) * math.cos(pitch), y + 50 * math.sin(pitch), z - 50 * math.cos(heading) * math.cos(pitch)]
    im = {**im, 'building': str(bid)}
    return im, {'position': [x, y, z], 'target': target, 'hfov': camera['hfov'], 'source': camera, 'approximate': True}


def solve(matrix, values):
    a = [list(row) + [v] for row, v in zip(matrix, values)]
    for i in range(len(a)):
        pivot = max(range(i, len(a)), key=lambda j: abs(a[j][i]))
        a[i], a[pivot] = a[pivot], a[i]
        if abs(a[i][i]) < 1e-10:
            raise ValueError('landmarks must span a nondegenerate quadrilateral')
        d = a[i][i]; a[i] = [v / d for v in a[i]]
        for j in range(len(a)):
            if j != i:
                d = a[j][i]; a[j] = [v - d * w for v, w in zip(a[j], a[i])]
    return [r[-1] for r in a]


def comparison(paths, im, render_path, landmarks=None, bid=None):
    """Photo | render | 50% blend sheet at <render>_compare.png.

    `im` is an image record from references.json (as returned by
    `photo_camera`, which adds `building`); `landmarks` is a JSON file (or
    list) of four {photo: [x, y], render: [x, y]} normalized pairs for a
    planar alignment of the render onto the photo.
    """
    from PIL import Image, ImageDraw
    paths = _paths(paths)
    bid = bid or im.get('building')
    if bid is None:
        raise ValueError('comparison needs the building id (pass bid= or an image record from photo_camera)')
    photo = Image.open(resolve(paths, bid, im.get('path') or im['source_path'])).convert('RGB')
    render = Image.open(render_path).convert('RGB').resize(photo.size)
    aligned = render
    if landmarks:
        pairs = landmarks if isinstance(landmarks, list) else read_json(landmarks)
        if not pairs or len(pairs) != 4:
            raise ValueError('four corresponding photo/render landmarks required')
        rows, values = [], []
        for pair in pairs:
            if not all(len(pair[k]) == 2 and all(type(v) in (int, float) and 0 <= v <= 1 for v in pair[k]) for k in ('photo', 'render')):
                raise ValueError('landmarks are normalized [x,y] pairs')
            x, y = [v * s for v, s in zip(pair['photo'], photo.size)]
            u, v = [v * s for v, s in zip(pair['render'], photo.size)]
            rows += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
            values += [u, v]
        aligned = render.transform(photo.size, Image.Transform.PERSPECTIVE, solve(rows, values), Image.Resampling.BICUBIC)
    crop = tuple(round(v * s) for v, s in zip(im.get('crop') or [0, 0, 1, 1], photo.size * 2))
    a, c = photo.crop(crop), aligned.crop(crop)
    sheet = Image.new('RGB', (a.width * 3, a.height + 32), 'white')
    for i, img in enumerate((a, c, Image.blend(a, c, .5))):
        sheet.paste(img, (i * a.width, 32))
    ImageDraw.Draw(sheet).text((8, 8), 'Photo | Render | 50% overlay — ' + ('planar landmark alignment; inspect raw render too' if landmarks else 'approximate capture camera'), fill='black')
    out = Path(render_path).with_name(Path(render_path).stem + '_compare.png')
    sheet.save(out)
    return out


# --------------------------------------------------------------------------
# Briefs and footprint cards

def is_rectangle(uv, w, d, tol=0.6):
    if len(uv) not in (4, 5):
        return False
    pts = uv[:4] if len(uv) == 5 and uv[0] == uv[4] else uv
    if len(pts) != 4:
        return False
    return all(abs(abs(u) - w / 2) < tol and abs(abs(v) - d / 2) < tol for u, v in pts)


def legacy_obliques(paths, bid):
    """Older `sv_<id>_*.png` captures from the style pass listed in source/sv_index.json, when the files still exist."""
    paths = _paths(paths)
    index = read_json(paths.sv_index) or {}
    entries = index.get(str(bid)) if isinstance(index, dict) else None
    found = []
    for entry in entries or []:
        path = Path(entry)
        if not path.is_absolute():
            path = paths.root / path
        if path.is_file():
            found.append(path)
    return found


def brief_text(paths, site, ov, bid):
    paths = _paths(paths)
    b = find_building(site, bid)
    building = paths.building(bid)
    o = b["obb"]
    fs = faces(b)
    uv = polygon_uv(b)
    road = next((k for k in fs if fs[k]["road"]), None)
    sid = str(bid)
    rel = paths.relative(building.dir)
    L = []
    p = L.append
    p(f"# Brief — OSM {sid} — {b.get('addr') or 'no address'}{(' — ' + b['name']) if b.get('name') else ''}")
    p("")
    p("## Identity")
    tags = {k: v for k, v in (b.get("tags") or {}).items()}
    p(f"- OSM id `{sid}`; address: {b.get('addr') or 'none in OSM'}; name: {b.get('name') or 'none in OSM'}; tags: {json.dumps(tags) if tags else 'none'}")
    st = b.get("style") or {}
    p(f"- Current generic style: {json.dumps({k: st[k] for k in ('kind', 'floors', 'roof', 'wall', 'roofColor', 'sign') if k in st})}")
    note = (ov.get("notes") or {}).get(sid)
    if note:
        p(f"- Earlier research note (from the style pass; verify, do not trust blindly): {note}")
    if sid in (ov.get("blueprints") or {}):
        p(f"- **A blueprint already exists** in overrides.json; you are refining it. Start from `{rel}/draft.json` if present, else copy it out of overrides.json.")
    pois = [x for x in site.get("pois", []) if abs(x.get("x", 1e9) - o["cx"]) < 20 and abs(x.get("z", 1e9) - o["cz"]) < 20]
    for x in pois:
        p(f"- Nearby POI: {json.dumps(x)}")
    p("")
    p("## Frame (blueprint u/v)")
    p(f"- OBB {o['w']:.1f} m along u × {o['d']:.1f} m along v; +u bears {fs['+u']['bearing']:.0f}° ({compass(fs['+u']['bearing'])}), +v bears {fs['+v']['bearing']:.0f}° ({compass(fs['+v']['bearing'])}). Centroid local ({o['cx']:.0f}, {o['cz']:.0f}) m.")
    p(f"- Road face: **{road or '?'}** ({b['front']['road'] if b.get('front') else 'no road found'}). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.")
    p("")
    p("| face | looks toward | width | left end lies toward | note |")
    p("|---|---|---|---|---|")
    for k in FACE_NAMES:
        f = fs[k]
        p(f"| `{k}` | {f['bearing']:.0f}° {compass(f['bearing'])} | {f['width']:.1f} m | {compass(f['left'])} | {'ROAD SIDE' if f['road'] else ''} |")
    p("")
    rect = is_rectangle(uv, o["w"], o["d"])
    p(f"- Footprint polygon in (u, v), metres: {uv}" + ("  — a plain rectangle; volumes can just span the OBB." if rect else
      "  — NOT a rectangle: model the notches/wings as separate volumes (see `footprint.png`)."))
    p(f"- Footprint card: `{rel}/footprint.png` (blue box = OBB, numbers = polygon vertices).")
    p("")
    p("## Terrain")
    if site.get("terrain"):
        hs = [terrain_at(site, x, z) for x, z in b["pts"]]
        base = min(hs)
        corner_uv = [(round(u, 1), round(v, 1), round(h - base, 1)) for (u, v), h in zip(uv, hs)]
        span = max(hs) - min(hs)
        p(f"- Ground at the polygon corners (u, v, metres above the lowest corner): {corner_uv}")
        if span > 1.0:
            p(f"- The lot slopes {span:.1f} m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.")
        else:
            p("- Flat lot (under 1 m across the footprint).")
    else:
        p("- No terrain grid in site.json; assume a flat lot.")
    p("")
    p("## Neighbours (within 10 m)")
    nb = neighbours(site, b)
    if not nb:
        p("- none")
    for n in nb:
        p(f"- `{n['id']}` {n.get('addr') or ''} {n.get('name') or ''} ({n.get('kind')}): off face `{n['face']}`, gap {n['gap']} m, {'HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one' if n['blueprint'] else 'generic style'}")
    p("")
    p("## Photos")
    p(f"- Photo paths below are relative to `{rel}/`.")
    idx = load_fronts(paths, bid)
    if idx:
        if idx.get("frame") not in (None, building_frame(site, b)):
            p("- WARNING: these captures were taken against an older footprint; camera metadata is untrusted. Recapture with `--force` after reviewing.")
        for k, f in idx.get("faces", {}).items():
            if f.get("photos"):
                for ph in f["photos"]:
                    present = '' if (building.dir / ph['file']).is_file() else ' (image not on disk; re-run `town refs` to regenerate)'
                    p(f"- `{ph['file']}` — face `{k}`, {ph.get('dist')} m out, {ph.get('off_axis_deg')}° off head-on, fov {ph.get('fov')}°, imagery {ph.get('date') or '?'}{present}")
            else:
                p(f"- face `{k}`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.")
        for ph in (idx.get('extra_views') or {}).get('photos', []):
            p(f"- `{ph['file']}` — oblique view toward face `{ph.get('face')}`, {ph.get('dist')} m out, imagery {ph.get('date') or '?'}")
    else:
        p(f"- No head-on captures yet. Run `./town refs {paths.name} {sid}` first (all four faces).")
    old = legacy_obliques(paths, bid)
    if old:
        p(f"- Older oblique captures from the style pass: {', '.join(paths.relative(x) for x in old)} (useful for colour and massing, not for bay counts).")
    if building.aerial.is_file():
        p(f"- Aerial crop: `aerial.png` (`aerial_footprint.png` outlines the mapped footprint; it is not an observed roof outline).")
    overhead = [paths.relative(x) for x in (paths.source / "overhead_labeled.jpg", paths.satellite) if x.exists()]
    if overhead:
        p("- Overhead references: " + ", ".join(f"`{name}`" for name in overhead) + ".")
    p("- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):")
    for k in FACE_NAMES:
        vp = viewpoints(site, b, k, (20, 35))
        p(f"  - `{k}`: " + " · ".join(f"[{v['dist']} m]({v['url']})" for v in vp))
    p("")
    p("## Tooling")
    p("- Schema: `docs/BLUEPRINT_SCHEMA.md`.")
    p(f"- Draft: `{rel}/draft.json`; notes: `{rel}/notes.md`. Touch nothing else in the repo.")
    p(f"- Lint: `./town lint {paths.name} {sid}` — fix every error before rendering.")
    p(f"- Render from a face (photo-like camera, trees hidden): `./town render {paths.name} {sid} --face={road or 'front'} --dist 45 --compare` → `{rel}/renders/` (render, and the photo beside it in `compare-<face>.png`). Other faces: `--face=-u`, `--face=+v`, …; `--iso` for the diorama camera; `--with <id> <id>` to load neighbours' drafts.")
    p(f"- Preview URL (same thing, by hand): `http://localhost:8734/?site={paths.name}&free=1&bp={sid}&focus={sid}&side={road or 'front'}&dist=45&notrees=1`")
    p(f"- Do NOT run `town accept` yourself; the coordinator accepts reviewed drafts into overrides.json.")
    p("")
    p("## Method")
    p("1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).")
    p("2. Preserve observed window counts, floor levels, proportions and distinctive silhouettes; do not replace accuracy with exaggeration. Faces without photos stay plain.")
    p("3. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, Observed features and measured proportions, Approximations / schema gaps, Confidence.")
    p("4. Every draft is reviewed independently (`town review`) against renders of all sides before it is accepted; resolve the findings it lists.")
    return "\n".join(L) + "\n"


def brief(paths, bid, *, card=True, site=None, overrides=None):
    """Write buildings/<id>/brief.md (and footprint.png) for one building; returns the brief text."""
    paths = _paths(paths)
    site = site or load_site(paths)
    ov = load_overrides(paths) if overrides is None else overrides
    text = brief_text(paths, site, ov, bid)
    b = paths.building(bid)
    if not b.brief.is_file() or b.brief.read_text() != text:
        atomic_text(b.brief, text)
    if card:
        try:
            footprint_card(paths, bid, site=site)
        except ImportError:
            log(f"{bid}: install Pillow for the footprint card")
    return text


def footprint_card(paths, bid, *, site=None):
    """Draw buildings/<id>/footprint.png: the footprint in the blueprint (u, v) frame. Returns its path."""
    paths = _paths(paths)
    site = site or load_site(paths)
    b = find_building(site, bid)
    out = paths.building(bid).dir / 'footprint.png'
    key = fingerprint({"frame": building_frame(site, b), "front": b.get("front"), "card": 2})
    if out.is_file() and _stamp(out) == key:
        return out
    from PIL import Image, ImageDraw
    o = b["obb"]
    c, s = math.cos(o["angle"]), math.sin(o["angle"])
    uv = polygon_uv(b)
    fs = faces(b)
    comp_u, comp_v = fs['+u']['bearing'], fs['+v']['bearing']
    road = next((k for k in fs if fs[k]["road"]), None)
    R = max(o["w"], o["d"]) / 2 + 5
    S = 560 / (2 * R)
    im = Image.new("RGB", (600, 600), "white")
    d = ImageDraw.Draw(im)
    P = lambda u, v: (300 + u * S, 300 + v * S)
    d.polygon([P(u, v) for u, v in uv], fill=(232, 205, 195), outline="black")
    d.rectangle([P(-o["w"] / 2, -o["d"] / 2), P(o["w"] / 2, o["d"] / 2)], outline=(60, 60, 220))
    d.text(P(o["w"] / 2 + 1, 0), "+u", fill=(60, 60, 220))
    d.text(P(0, o["d"] / 2 + 1), "+v", fill=(60, 60, 220))
    for i, (u, v) in enumerate(uv):
        d.text(P(u, v), str(i), fill=(0, 120, 0))
    if road:
        d.text((10, 10), f"road side: {road}   +u → {comp_u:.0f}°  +v → {comp_v:.0f}°", fill="red")
    d.line([(20, 580), (20 + 10 * S, 580)], fill="black", width=3)
    d.text((20, 562), "10 m", fill="black")
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    _stamp(out, key)
    return out


# --------------------------------------------------------------------------
# Research planning

LANDMARK_AMENITIES = ("townhall", "library", "courthouse", "fire_station", "place_of_worship")


def plan(paths, limit=None):
    """Which structures still need research, authoring or review, in priority order.

    State is derived from buildings/<id>/ files (state.building_status), the
    blueprints and blueprint_frames in overrides.json and the site's
    frame_review list. Priority determines order, never eligibility; `limit`
    batches the outstanding work. Returns a dict: total, remaining, complete,
    counts, selected (ids), capture_ids (ids whose road face still needs a
    capture and may be captured safely), buildings (one row per structure).
    """
    from .review import lint_blueprint
    paths = _paths(paths)
    site = load_site(paths)
    ov = load_overrides(paths)
    items = []
    for b in site["buildings"]:
        bid = str(b["id"])
        building = paths.building(bid)
        frame = building_frame(site, b)
        blueprint = b.get("blueprint") or (ov.get("blueprints") or {}).get(bid)
        status = building_status(paths, bid, ov)
        draft = read_json(building.draft)
        errors = []
        if (ov.get("blueprint_frames") or {}).get(bid, frame) != frame or bid in site.get("frame_review", []):
            state = "review-frame"
        elif status == "failed":
            state = "failed"
        elif status == "accepted" or (blueprint and draft is None):
            errors = lint_blueprint(blueprint, b, bid).errors
            state = "repair-merged" if errors else "merged"
        elif status == "drafted":
            try:
                errors = lint_blueprint(draft, b, bid).errors
            except (ValueError, TypeError, AttributeError, KeyError) as error:
                errors = [str(error)]
            state = "repair-draft" if errors else ("review-draft" if building.notes.is_file() else "incomplete-draft")
        elif status == "needs-repair":
            state = "repair-draft"
        elif status == "reviewed":
            state = "ready-to-merge"
        else:
            state = "new"
        road_faces = [face for face, props in faces(b).items() if props["road"]] or ["+u"]
        captures = load_fronts(paths, bid, {})
        capture_state = "current" if captures.get("frame") == frame else ("stale-or-unknown" if captures else "none")
        pending = pending_faces(captures if capture_state == "current" else None, road_faces, building.dir)
        tags, style = b.get("tags", {}), b.get("style", {})
        next_step = {"merged": "done", "repair-merged": "repair", "review-frame": "review-frame", "failed": "inspect",
                     "repair-draft": "repair", "review-draft": "review", "incomplete-draft": "notes",
                     "ready-to-merge": "accept"}.get(state, "references" if status == "unreferenced" else "author")
        landmark = style.get("kind") == "church" or tags.get("historic") or tags.get("amenity") in LANDMARK_AMENITIES
        priority = (100 if landmark else 0) + (40 if style.get("kind") == "commercial" else 0)
        priority += 15 if b.get("name") else 0
        priority += min(20, b.get("area", 0) / 100)
        if state not in ("new", "merged"):
            priority += 200  # finish/review existing work before commissioning more
        items.append({"id": bid, "address": b.get("addr"), "name": b.get("name"), "state": state, "status": status,
                      "priority": round(priority, 1), "frame": frame, "road_faces": road_faces,
                      "capture_state": capture_state, "pending_road_faces": pending, "errors": errors,
                      "next_step": next_step})
    items.sort(key=lambda row: (-row["priority"], row["id"]))
    outstanding = [row for row in items if row["state"] != "merged"]
    selected = outstanding[:limit]
    # A stale frame must be reviewed before any capture overwrites photos.
    capture_ids = [row["id"] for row in selected if row["pending_road_faces"] and row["capture_state"] in ("current", "none")]
    return {"site": site.get("name") or paths.name, "limit": limit, "total": len(items),
            "complete": not outstanding, "remaining": len(outstanding),
            "counts": dict(Counter(row["state"] for row in items)),
            "selected": [row["id"] for row in selected], "capture_ids": capture_ids, "buildings": items}


# --------------------------------------------------------------------------
# CLI

def read_ids(path):
    return [line.strip().split()[0] for line in Path(path).read_text().splitlines()
            if line.strip() and not line.startswith("#")]


def _ids(args, paths, site=None):
    ids = list(getattr(args, 'ids', None) or [])
    if getattr(args, 'list', None):
        ids += read_ids(args.list)
    if getattr(args, 'all', False):
        site = site or load_site(paths)
        ids += [str(b['id']) for b in site['buildings']]
    return list(dict.fromkeys(str(x) for x in ids))


def _location(paths, args):
    if getattr(args, 'location', None):
        return args.location
    request = read_json(paths.request) or {}
    return request.get('title') or settings(paths).get('title') or ''


def register(subparsers):
    p = subparsers.add_parser('refs', help='capture Street View fronts (and aerials, web packets) for buildings',
                              description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('site')
    p.add_argument('ids', nargs='*', help='structure ids')
    p.add_argument('--all', action='store_true', help='every building in site.json')
    p.add_argument('--list', help='file with one id per line')
    p.add_argument('--faces', default='all', help="comma list of +u,-u,+v,-v, or 'all' or 'road' (write --faces=-u,-v)")
    p.add_argument('--dists', help='comma list of stand-off distances in metres (default: scaled to face width)')
    p.add_argument('--fov', type=int, default=55)
    p.add_argument('--quick', action='store_true', help='budgeted first pass: road face only, stop after one usable photo')
    p.add_argument('--max-photos', type=int, help='stop a face after N usable photos (default: all distinct viewpoints)')
    p.add_argument('--extra-views', type=int, choices=[0, 1, 2], default=0, help='add up to two distinct oblique panoramas per building')
    p.add_argument('--extra-seconds', type=float, default=90, help='time budget for extra views per building; at most four probes')
    p.add_argument('--budget-seconds', type=float, help='optional directional-capture time budget per building')
    p.add_argument('--force', action='store_true', help='recapture even if fronts.json exists')
    p.add_argument('--missing', action='store_true', help='only retry faces recorded without coverage')
    p.add_argument('--workers', type=int, default=DEFAULT_WORKERS, help=f'buildings captured at once (default {DEFAULT_WORKERS}; 3+ makes Google flaky)')
    p.add_argument('--no-fronts', action='store_true', help='skip Street View captures (only --aerials / --web)')
    p.add_argument('--aerials', action='store_true', help='also crop aerial references (sources.crop_aerials)')
    p.add_argument('--aerial-source', help="crop from another site's mosaic (name, data/<site>, or a source directory)")
    p.add_argument('--web', action='store_true', help='also assemble references.json with a web image search')
    p.add_argument('--max-web', type=int, default=1, help='web images to keep in the packet (default 1)')
    p.add_argument('--location', help='place name used in image searches (default: the site title)')
    p.set_defaults(run=_run_refs)

    p = subparsers.add_parser('brief', help='write buildings/<id>/brief.md and footprint.png')
    p.add_argument('site')
    p.add_argument('ids', nargs='*')
    p.add_argument('--list', help='file with one id per line')
    p.add_argument('--no-card', action='store_true', help='skip drawing the footprint card')
    p.set_defaults(run=_run_brief)

    p = subparsers.add_parser('plan', help='which structures still need research, authoring or review')
    p.add_argument('site')
    p.add_argument('--limit', type=int, help='batch size (default: all outstanding structures)')
    p.add_argument('--out', help='write the selected ids, one per line, for --list')
    p.add_argument('--json', action='store_true', help='print the full plan as JSON')
    p.set_defaults(run=_run_plan)


def _run_refs(args):
    paths = site_paths(args.site)
    ids = _ids(args, paths)
    if not ids:
        if args.list or args.all:
            print("No queued buildings; nothing to do.")
            return 0
        raise SystemExit("town refs: no building ids")
    dists = [float(x) for x in args.dists.split(",")] if args.dists else None
    faces_spec = args.faces
    max_photos = args.max_photos
    if args.quick:
        faces_spec = "road"
        max_photos = max_photos or 1
    if max_photos is not None and max_photos < 1:
        raise SystemExit("town refs: --max-photos must be positive")
    if not 15 <= args.extra_seconds <= 180:
        raise SystemExit('town refs: --extra-seconds must be between 15 and 180')
    if args.budget_seconds is not None and not 20 <= args.budget_seconds <= 600:
        raise SystemExit('town refs: --budget-seconds must be between 20 and 600')
    if not paths.scene.is_file():
        raise SystemExit(f"town refs: {paths.scene} is missing; run `town build {paths.name}` first")
    status = 0
    if not args.no_fronts:
        try:
            capture_fronts(paths, ids, faces=faces_spec, force=args.force, missing=args.missing, max_photos=max_photos,
                           workers=args.workers, dists=dists, fov=args.fov, budget_seconds=args.budget_seconds,
                           extra_views=args.extra_views, extra_seconds=args.extra_seconds)
        except RuntimeError as error:
            log(f"town refs: {error}")
            status = 1
    if args.aerials:
        from .sources import crop_aerials
        source = None
        if args.aerial_source:
            candidate = Path(args.aerial_source)
            source = candidate if candidate.is_file() or (candidate / "satellite.jpg").is_file() else site_paths(args.aerial_source)
        try:
            crop_aerials(paths, ids, source=source, force=args.force)
        except (FileNotFoundError, KeyError, ValueError) as error:
            log(f"town refs --aerials: {error}")
            status = 1
    if args.web:
        site = load_site(paths)
        labels = read_json(paths.labels) or {}
        web = read_json(paths.web_references) or {}
        location = _location(paths, args)
        for bid in ids:
            b = find_building(site, bid)
            name = labels.get(bid) or b.get('name') or b.get('addr') or f'Structure {bid}'
            try:
                value = packet(paths, b, name, location, web.get(bid, []), max_web=args.max_web,
                               extra_views=args.extra_views, site=site)
            except Exception as error:
                log(f"{bid}: packet failed: {error}")
                status = 1
                continue
            log(f"{paths.building(bid).references}: {len(value['images'])} images" +
                (f", {len(value['warnings'])} warnings" if value['warnings'] else ''))
    return status


def _run_brief(args):
    paths = site_paths(args.site)
    ids = _ids(args, paths)
    if not ids:
        if args.list:
            print("No queued buildings; nothing to do.")
            return 0
        raise SystemExit("town brief: no building ids")
    site = load_site(paths)
    ov = load_overrides(paths)
    for bid in ids:
        brief(paths, bid, card=not args.no_card, site=site, overrides=ov)
        print(paths.building(bid).brief)
    return 0


def _run_plan(args):
    if args.limit is not None and args.limit < 0:
        raise SystemExit("town plan: --limit must be nonnegative")
    paths = site_paths(args.site)
    result = plan(paths, args.limit)
    if args.out:
        Path(args.out).write_text("".join(bid + "\n" for bid in result["selected"]))
    if args.json:
        print(json.dumps(result, indent=1))
    else:
        for row in result["buildings"]:
            if row["id"] in result["selected"]:
                pending = ",".join(row["pending_road_faces"]) or "-"
                print(f'{row["state"]:17} {row["next_step"]:11} capture:{pending:6} {row["id"]:>13} {row.get("address") or ""} {row.get("name") or ""}'.rstrip())
        print(json.dumps({"counts": result["counts"], "remaining": result["remaining"], "total": result["total"],
                          "selected": len(result["selected"]), "capture_ids": result["capture_ids"]}, indent=1))
    return 0
