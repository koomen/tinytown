"""Render a building (with its draft blueprint) through the viewer in headless Chromium.

    ./town render avon-extended 247541316                  # road face, photo-like view
    ./town render avon-extended 247541316 --face=+u --face=-v
    ./town render avon-extended 247541316 --face=+u --dist 40 --iso
    ./town render avon-extended 247541316 --face=+u --compare
    ./town render avon-extended 247541316 --with 247541280 1090362847

The viewer is loaded from the dev server with
`?site=<site>&free=1&bp=<id>&focus=<id>&side=<face>&dist=<m>`, so the draft
`data/<site>/buildings/<id>/draft.json` is previewed without touching
overrides.json. The image goes to `buildings/<id>/renders/<view>.png` with a
provenance record `<view>.png.json` beside it (blueprint, frame, context and
renderer fingerprints; neighbours' blueprints). `--iso` uses the diorama camera
instead of the low free camera; `--with` also loads the drafts of neighbouring
buildings; `--no-bp` renders the current merged state; trees are left out
unless `--trees`; `--compare` puts the render beside the Street View capture of
that face in `renders/compare-<face>.png`. Faces: +u -u +v -v, front, or a
compass bearing in degrees to stand at (spell `--face=-u`, the `=` keeps argparse
from reading `-u` as an option). Re-running with unchanged inputs reuses the
saved image. The dev server and headless browser are started if they are not
running.
"""
import argparse
import contextlib
import hashlib
import json
from pathlib import Path
import time
import urllib.parse

from .paths import ROOT, SitePaths, site_paths
from .site import find_building, load_site, road_face
from .state import atomic_json, building_frame, fingerprint, read_json

HIDE_UI = "#loading,#place{display:none!important}"
DEFAULT_DIST = 60
DEFAULT_EYE = 8
BATCH_SIZE = (1000, 750)
BROWSER_KEYS = ('provider', 'version', 'headless', 'graphics')


def viewer_url(port=None):
    from .browser import SERVER_PORT
    return f'http://localhost:{port or SERVER_PORT}/'


def _paths(site_or_paths):
    return site_or_paths if isinstance(site_or_paths, SitePaths) else site_paths(site_or_paths)


def _file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def renderer_signature(root=ROOT):
    """Hash of the viewer's modules (src/*.js). A change invalidates every render and review."""
    return fingerprint([(p.name, _file_hash(p)) for p in sorted((Path(root) / 'src').glob('*.js'))])


def visual_context(site, building):
    # Blueprints inherit style defaults and are seated using terrain/street
    # geometry. Merging a reviewed draft must not itself change this signature.
    return fingerprint({"style": building.get("style"), "front": building.get("front"),
                        "terrain": site.get("terrain"), "roads": site.get("roads"),
                        "size": site.get("size")})


def _images(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "image" and isinstance(item, str):
                yield item
            yield from _images(item)
    elif isinstance(value, list):
        for item in value:
            yield from _images(item)


def render_inputs(paths, bids):
    """Hash local inputs once per batch; camera-specific settings are added later."""
    paths = _paths(paths)
    root = paths.root
    here = Path(__file__).resolve().parent
    files = [root / "index.html", here / "render.py", here / "browser.py", here / "browser.mjs", paths.scene]
    files += sorted((root / "src").glob("*.js"))
    files += [paths.building(bid).draft for bid in bids if bid]
    for path in list(files):
        if path.suffix == ".json" and path.exists():
            for image in _images(json.loads(path.read_text())):
                if urllib.parse.urlparse(image).scheme:
                    # Remote changes cannot be fingerprinted locally. Force this
                    # batch to render, rather than trusting an unversioned asset.
                    return fingerprint([time.time_ns(), str(path), image])
                files.append(root / urllib.parse.unquote(image.lstrip("/")))
    return fingerprint([(paths.relative(p) if _inside(p, root) else str(p),
                         _file_hash(p) if p.exists() else None) for p in files])


def _inside(path, root):
    try:
        Path(path).resolve().relative_to(Path(root).resolve())
        return True
    except ValueError:
        return False


def _extras(extra):
    """`--with` ids: a list, a comma string, or None."""
    if not extra:
        return []
    if isinstance(extra, str):
        extra = extra.split(',')
    return sorted({str(x).strip() for x in extra if str(x).strip()})


def view_name(building, face, iso):
    """The render's file stem: 'iso', a named face, or the road face for 'front'."""
    if iso:
        return 'iso'
    face = 'front' if face is None else str(face)
    return face if face != 'front' else (road_face(building) or 'front')


def render_url(paths, bid, *, face='front', dist=DEFAULT_DIST, iso=False, bps=(), trees=False, eye=DEFAULT_EYE,
               stage='detail', isolate=False, viewer=None):
    q = (f"site={urllib.parse.quote(paths.name)}&focus={bid}&side={urllib.parse.quote(str(face))}"
         f"&dist={dist}&height={eye}&stage={stage}")
    if not iso:
        q += "&free=1"
    if bps:
        q += "&bp=" + ",".join(bps)
    if not trees:
        q += "&notrees=1"
    if isolate:
        q += f'&isolate={bid}'
    return f"{viewer or viewer_url()}?{q}"


def _drive(tab, url, bid, face, dist, iso, eye, pose, build_key, out):
    """Load the scene once per build key, aim the camera, and screenshot."""
    if getattr(tab, "_town_render_key", None) != build_key:
        tab.go(url)
        tab.wait_town()
        tab.hide(HIDE_UI)
        tab._town_render_key = build_key
    # One town build for every face in this batch; only the camera moves.
    args = json.dumps([str(bid), face, dist, eye])
    tab.ev("(()=>{const w=window.__town; w.lookAtBuilding(..." + args +
           "); if(w.bokeh) w.bokeh.enabled=false; w.renderLoop.wake(); return 1})()")
    if not iso and not pose:
        # A fixed eye offset can put the camera inside an uphill riverbank.
        # Raise automatic elevation views just enough to clear the ground
        # along the sightline, retaining their exact compass direction.
        tab.ev("""(()=>{
          const w=window.__town,c=w.camera.position,t=w.controls.target;
          let y=c.y;
          for(let i=0;i<=17;i++) {
            const f=i/20,x=c.x+(t.x-c.x)*f,z=c.z+(t.z-c.z)*f;
            y=Math.max(y,(w.street.surfaces.grade(x,z)+1.5-t.y*f)/(1-f));
          }
          c.y=y;w.controls.update();w.renderLoop.wake();
        })()""")
    if pose:
        tab.ev("(()=>{const w=window.__town,p=" + json.dumps(pose) + ";w.controls.maxPolarAngle=Math.PI;"
               "w.camera.position.fromArray(p.position);w.controls.target.fromArray(p.target);"
               "w.camera.fov=2*Math.atan(Math.tan(p.hfov*Math.PI/360)/w.camera.aspect)*180/Math.PI;"
               "w.camera.updateProjectionMatrix();w.controls.update();w.renderLoop.wake();})()")
    time.sleep(0.6)
    tab.shot(str(out))
    return [l for l in tab.logs if l.startswith("EXC") or "?bp" in l]


def _blueprints(paths, site, bid, bps, no_bp):
    """The subject's blueprint and, per neighbour, whether its draft was loaded and its fingerprint."""
    def blueprint(other):
        ident = str(other['id'])
        draft = paths.building(ident).draft
        use = not no_bp and ident in bps and draft.exists()
        return use, (json.loads(draft.read_text()) if use else other.get('blueprint'))
    subject = find_building(site, bid)
    _, bp = blueprint(subject)
    neighbors = {}
    for other in site['buildings']:
        if str(other['id']) == str(bid):
            continue
        use, model = blueprint(other)
        neighbors[str(other['id'])] = {'draft': use, 'frame': building_frame(site, other), 'blueprint': fingerprint(model)}
    return subject, bp, neighbors


def record(paths, site, bid, *, key, url, view, bps, no_bp, tab=None, stage='detail', pose=None, phase=None,
           renderer=None):
    """The provenance written beside a render as <view>.png.json."""
    building, bp, neighbors = _blueprints(paths, site, bid, bps, no_bp)
    out = {"key": key, "url": url, "blueprint": fingerprint(bp), "frame": building_frame(site, building),
           "context": visual_context(site, building), "renderer": renderer or renderer_signature(paths.root),
           "view": view, "stage": stage, "pose": pose, "neighbors": neighbors}
    browser = getattr(tab, 'record', None)
    if browser:
        out["browser"] = {k: browser.get(k) for k in BROWSER_KEYS}
    if phase is not None:
        out["batch_phase"] = phase
    return out


def _cached(out, key, force):
    if force:
        return False
    saved = read_json(Path(str(out) + ".json")) or {}
    return Path(out).exists() and saved.get("key") == key


def render(paths, bid, *, face=None, dist=None, iso=False, extra=None, no_bp=False, out=None, width=1400, height=1000,
           scale=1, trees=False, eye=DEFAULT_EYE, tab=None, stage='detail', pose=None, isolate=False, site=None,
           force=False, inputs=None, viewer=None):
    """Render one view of `bid`; returns the PNG path (renders/<view>.png unless `out`).

    `tab` reuses an open browser.Tab across views (the scene is rebuilt only when
    the loaded drafts or projection change). With unchanged inputs and an
    existing image the saved render is reused.
    """
    paths = _paths(paths)
    bid = str(bid)
    site = site or load_site(paths)
    building = find_building(site, bid)
    face = 'front' if face is None else face
    dist = DEFAULT_DIST if dist is None else dist
    extras = _extras(extra)
    bps = [] if no_bp else sorted({bid, *extras})
    view = view_name(building, face, iso)
    out = Path(out) if out else paths.building(bid).render(view)
    inputs = inputs or render_inputs(paths, bps)
    key = fingerprint([inputs, bid, str(face), dist, iso, extras, no_bp, width, height, scale, trees, eye, stage, pose])
    if _cached(out, key, force):
        return out
    url = render_url(paths, bid, face=face, dist=dist, iso=iso, bps=bps, trees=trees, eye=eye, stage=stage,
                     isolate=isolate, viewer=viewer)
    build_key = (url.split('?')[0], paths.name, tuple(bps), iso, trees, stage, bid if isolate else None)
    with contextlib.ExitStack() as stack:
        if tab is None:
            from .browser import Tab, ensure_browser, ensure_server
            ensure_browser()
            ensure_server()
            tab = stack.enter_context(Tab(width, height, scale))
        warnings = _drive(tab, url, bid, face, dist, iso, eye, pose, build_key, out)
        atomic_json(str(out) + ".json", record(paths, site, bid, key=key, url=url, view=view, bps=bps, no_bp=no_bp,
                                               tab=tab, stage=stage, pose=pose))
    for w in warnings:
        print("  viewer:", w[:200])
    return out


def reference_photo(paths, bid, face):
    """The Street View capture of `face` under buildings/<id>/fronts/, or None."""
    b = _paths(paths).building(bid)
    names = [f"{face}.png", f"{face}_1.png", f"{face}_2.png"]
    fronts = read_json(b.fronts) or {}
    for photo in ((fronts.get('faces') or {}).get(face) or {}).get('photos', []):
        if photo.get('file'):
            names.append(Path(photo['file']).name)
    for name in names:
        candidate = b.fronts_dir / name
        if candidate.is_file():
            return candidate
    return None


def compare(paths, bid, face, render_path):
    """Photo beside render, labelled, at renders/compare-<face>.png. None without a photo."""
    from PIL import Image, ImageDraw
    paths = _paths(paths)
    photo = reference_photo(paths, bid, face)
    if not photo:
        print(f"  no fronts/{face}*.png to compare against")
        return None
    a, b = Image.open(photo).convert("RGB"), Image.open(render_path).convert("RGB")
    h = 900
    a = a.resize((round(a.width * h / a.height), h))
    b = b.resize((round(b.width * h / b.height), h))
    im = Image.new("RGB", (a.width + b.width + 12, h + 28), "white")
    im.paste(a, (0, 28)); im.paste(b, (a.width + 12, 28))
    d = ImageDraw.Draw(im)
    d.text((6, 8), f"photo {photo.name}", fill="black")
    d.text((a.width + 18, 8), f"render {Path(render_path).name}", fill="black")
    out = paths.building(bid).renders / f"compare-{face}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    return out


class RenderBatch:
    """Reuse two browser scenes (perspective and isometric) while capturing a batch's views.

    Projection type is fixed when the viewer loads, so one tab is kept for the
    isometric overview and one for every perspective elevation.
    """

    def __init__(self, paths, drafts=(), phase=None, site=None, size=BATCH_SIZE):
        from .browser import ensure_browser, ensure_server
        self.paths = _paths(paths)
        self.site = site or load_site(self.paths)
        self.drafts = _extras(drafts)
        self.phase = phase
        self.size = size
        self.tabs = {}
        self.inputs = render_inputs(self.paths, self.drafts)
        self.renderer = renderer_signature(self.paths.root)
        ensure_server(); ensure_browser()

    def close(self):
        for tab in self.tabs.values():
            tab.close()
        self.tabs.clear()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def tab(self, iso):
        if iso not in self.tabs:
            from .browser import Tab
            self.tabs[iso] = Tab(*self.size, 1)
        return self.tabs[iso]

    def capture(self, building, face, distance, iso, out, no_bp=False, force=False):
        """Render `face` of `building` (a site.json record or an id) to `out` and write `out`.json."""
        if not isinstance(building, dict):
            building = find_building(self.site, building)
        bid = str(building['id'])
        out = Path(out)
        key = fingerprint([self.inputs, bid, face, distance, iso, no_bp, self.phase])
        if _cached(out, key, force):
            return out
        bps = [] if no_bp else sorted({bid, *self.drafts})
        url = render_url(self.paths, bid, face=face, dist=distance, iso=iso, bps=bps, eye=DEFAULT_EYE)
        tab = self.tab(iso)
        build_key = (url.split('?')[0], self.paths.name, tuple(bps), iso, False, 'detail', None)
        warnings = _drive(tab, url, bid, face, distance, iso, DEFAULT_EYE, None, build_key, out)
        atomic_json(str(out) + '.json', record(self.paths, self.site, bid, key=key, url=url,
                                               view='iso' if iso else face, bps=bps, no_bp=no_bp, tab=tab,
                                               phase=self.phase, renderer=self.renderer))
        for w in warnings:
            print("  viewer:", w[:200])
        return out


# --- CLI ---------------------------------------------------------------------

def register(subparsers):
    p = subparsers.add_parser('render', help='render a building through the viewer in headless Chromium',
                              description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('site')
    p.add_argument('id')
    p.add_argument('--face', action='append', help="+u -u +v -v | front | <bearing> (repeatable; write --face=-u)")
    p.add_argument('--dist', type=float, default=DEFAULT_DIST)
    p.add_argument('--iso', action='store_true', help='diorama camera instead of the low free camera')
    p.add_argument('--with', dest='extra', nargs='*', default=[], help='other draft ids to load too')
    p.add_argument('--no-bp', action='store_true', help='render the current merged state, no draft')
    p.add_argument('--compare', action='store_true', help='also write renders/compare-<face>.png beside the photo')
    p.add_argument('--force', action='store_true', help='render again even when all local inputs match the saved image')
    p.add_argument('--out', help='output path (single face only)')
    p.add_argument('--size', default='1400x1000', help='viewport WxH (default 1400x1000)')
    p.add_argument('--scale', type=float, default=1.0, help='device scale factor')
    p.add_argument('--trees', action='store_true', help='keep the trees (hidden by default so nothing blocks the facade)')
    p.add_argument('--eye', type=float, default=DEFAULT_EYE, help='free-camera eye height above the target (default 8)')
    p.add_argument('--stage', choices=['massing', 'detail'], default='detail')
    p.set_defaults(run=_run_render)


def _run_render(args):
    paths = site_paths(args.site)
    site = load_site(paths)
    building = find_building(site, args.id)
    faces = args.face or ['front']
    if args.out and len(faces) > 1:
        raise SystemExit('--out only with a single face')
    width, height = (int(x) for x in args.size.lower().split('x'))
    extras = _extras(args.extra)
    inputs = render_inputs(paths, [] if args.no_bp else [args.id, *extras])
    with contextlib.ExitStack() as stack:
        tab = None
        for face in faces:
            out = Path(args.out) if args.out else paths.building(args.id).render(view_name(building, face, args.iso))
            key = fingerprint([inputs, str(args.id), str(face), args.dist, args.iso, extras, args.no_bp, width, height,
                               args.scale, args.trees, args.eye, args.stage, None])
            if _cached(out, key, args.force):
                print(f'{out} (unchanged, reused)')
            else:
                if tab is None:
                    from .browser import Tab, ensure_browser, ensure_server
                    ensure_browser(); ensure_server()
                    tab = stack.enter_context(Tab(width, height, args.scale))
                render(paths, args.id, face=face, dist=args.dist, iso=args.iso, extra=extras, no_bp=args.no_bp, out=out,
                       width=width, height=height, scale=args.scale, trees=args.trees, eye=args.eye, tab=tab,
                       stage=args.stage, site=site, force=args.force, inputs=inputs)
                print(f'{out}\n  {(read_json(Path(str(out) + ".json")) or {}).get("url", "")}')
            if args.compare:
                c = compare(paths, args.id, view_name(building, face, False), out)
                if c:
                    print(f'  {c}')
    return 0

