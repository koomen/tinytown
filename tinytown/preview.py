"""Disposable source previews, cropped or whole-map; never writes baked data."""
import hashlib
import html
import json
import math
from pathlib import Path
from urllib.parse import urlencode

from .paths import SitePaths
from .site import build, clip_polyline


def _asset(spec):
    asset = spec.get('asset')
    if isinstance(asset, str):
        asset = {'module': asset}
    if not isinstance(asset, dict):
        raise ValueError('asset must name a module and optional export')
    module = asset.get('module', '')
    path = Path(module)
    if not module or path.is_absolute() or '..' in path.parts or path.suffix not in ('.js', '.mjs') or ':' in module:
        raise ValueError('asset module must be a workspace-relative JavaScript path')
    name = path.as_posix()
    if not (name.startswith('src/') or name.startswith('tinytown/web/preview')):
        raise ValueError('asset module must be under src/ or named tinytown/web/preview*.js')
    return {'module': name, 'export': asset.get('export', 'preview')}


def _center(data, spec):
    if 'center' in spec:
        point = spec['center']
        if not isinstance(point, (list, tuple)) or len(point) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
            raise ValueError('center must be finite [x, z] coordinates in site metres')
        return point
    target = str(spec.get('target', '')).strip().casefold()
    if not target:
        raise ValueError('preview needs a building id, address, landmark target, or center')
    candidates = data.get('buildings', []) + data.get('landmarks', []) + data.get('pois', [])
    matches = [f for f in candidates if target in [str(f.get(k, '')).casefold() for k in ('id', 'addr', 'name')]]
    if not matches:
        matches = [f for f in candidates if any(target in str(f.get(k) or '').casefold() for k in ('addr', 'name'))]
    # Prefer the actual structure when an OSM POI repeats its name.
    structures = [f for f in matches if 'obb' in f]
    matches = structures or matches
    if len(matches) != 1:
        raise ValueError(f'preview target {target!r}: {len(matches)} matches; use an exact id or center')
    item = matches[0]
    if 'obb' in item:
        return [item['obb']['cx'], item['obb']['cz']]
    if 'x' in item:
        return [item['x'], item['z']]
    pts = item['pts']
    return [sum(p[i] for p in pts) / len(pts) for i in (0, 1)]


def _polygon(pts, bounds):
    for axis, bound, sign in ((0, bounds[0], 1), (0, bounds[2], -1), (1, bounds[1], 1), (1, bounds[3], -1)):
        output = []
        for a, b in zip(pts, pts[1:] + pts[:1]):
            ai, bi = sign * (a[axis] - bound) >= 0, sign * (b[axis] - bound) >= 0
            if ai != bi:
                t = (bound - a[axis]) / (b[axis] - a[axis])
                output.append([a[i] + t * (b[i] - a[i]) for i in (0, 1)])
            if bi:
                output.append(b)
        pts = output
    return pts


def scene(root, spec):
    """Build fresh source/overrides, optionally crop geometry and terrain."""
    if spec.get('asset'):
        asset = _asset(spec)
        root = Path(root).resolve()
        path = (root / asset['module']).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError('asset module is missing or outside the workspace')
        return {'asset': asset, 'title': spec.get('title', asset['module'])}
    if spec.get('whole_map'):
        data = build(SitePaths(spec['site'], root), write=False)
        data['preview'] = {'whole_map': True}
        return data
    radius = float(spec.get('radius', 60))
    if not math.isfinite(radius) or not 10 <= radius <= 200:
        raise ValueError('preview radius must be between 10 and 200 metres')
    data = build(SitePaths(spec.get('site', 'avon-extended'), root), write=False)
    x, z = _center(data, spec)
    bounds = [x-radius, z-radius, x+radius, z+radius]
    def nearby(item):
        pts = item.get('pts') or [[item.get('x', 0), item.get('z', 0)]]
        return (min(p[0] for p in pts) <= bounds[2] and max(p[0] for p in pts) >= bounds[0]
                and min(p[1] for p in pts) <= bounds[3] and max(p[1] for p in pts) >= bounds[1])
    for key in ('buildings', 'pois', 'extras'):
        data[key] = [item for item in data.get(key, []) if nearby(item)]
    for key in ('roads', 'linear_features'):
        data[key] = [{**item, 'pts': [[a+x, b+z] for a,b in pts]}
                     for item in data.get(key, []) if nearby(item)
                     for pts in clip_polyline([[a-x,b-z] for a,b in item['pts']], radius, radius)]
    for key in ('areas', 'landmarks'):
        result = []
        for item in data.get(key, []):
            if not nearby(item):
                continue
            if key == 'areas' or item.get('closed'):
                pts = _polygon(item['pts'], bounds)
                if len(pts) >= 3:
                    result.append({**item, 'pts': pts})
            else:
                for pts in clip_polyline([[a-x,b-z] for a,b in item['pts']], radius, radius):
                    result.append({**item, 'pts': [[a+x,b+z] for a,b in pts]})
        data[key] = result
    terrain = data['terrain']
    dx = (terrain['x1'] - terrain['x0']) / (terrain['cols'] - 1)
    dz = (terrain['z1'] - terrain['z0']) / (terrain['rows'] - 1)
    i0 = max(0, min(terrain['cols']-2, math.floor((bounds[0]-terrain['x0'])/dx)))
    j0 = max(0, min(terrain['rows']-2, math.floor((bounds[1]-terrain['z0'])/dz)))
    i1 = max(i0+1, min(terrain['cols']-1, math.ceil((bounds[2]-terrain['x0'])/dx)))
    j1 = max(j0+1, min(terrain['rows']-1, math.ceil((bounds[3]-terrain['z0'])/dz)))
    data['terrain'] = {**terrain, 'x0': terrain['x0']+i0*dx, 'x1': terrain['x0']+i1*dx,
                       'z0': terrain['z0']+j0*dz, 'z1': terrain['z0']+j1*dz,
                       'cols': i1-i0+1, 'rows': j1-j0+1,
                       'values': [terrain['values'][j*terrain['cols']+i] for j in range(j0,j1+1) for i in range(i0,i1+1)]}
    data.update(size={'w': radius*2, 'h': radius*2}, offset={'x': x, 'z': z})
    data.pop('outline', None)
    data['preview'] = {'center': [x,z], 'radius': radius, 'target': spec.get('target')}
    return data


def fingerprint(root, spec):
    """Cheap input signature for polling; includes removals and atomic replacements."""
    root = Path(root)
    files = set((root / 'src').rglob('*')) | set((root / 'tinytown').rglob('*.py')) | set((root / 'tinytown' / 'web').glob('preview.*'))
    if spec.get('asset'):
        files.add(root / _asset(spec)['module'])
    else:
        paths = SitePaths(spec.get('site', 'avon-extended'), root)
        for directory in (paths.site_dir, paths.source, paths.textures):
            files.update(directory.rglob('*'))
        files.add(paths.overrides)
    digest = hashlib.sha256(json.dumps(spec, sort_keys=True).encode())
    for path in sorted(files):
        try:
            if path.is_file():
                stat = path.stat()
                digest.update(f'{path.relative_to(root)}:{stat.st_mtime_ns}:{stat.st_size}:{stat.st_ino}'.encode())
        except FileNotFoundError:
            pass
    return digest.hexdigest()


def document(spec, base_url, sites=None):
    """Independent preview shell: source files are served below base_url/files/."""
    base = base_url.rstrip('/') + '/'
    query = '?' + urlencode({'site': spec['site']}) if spec.get('whole_map') else ''
    config = json.dumps({'spec': spec, 'scene': base+'scene.json'+query, 'events': base+'events'+query}).replace('<', '\\u003c')
    controls = ''
    script = 'preview.js'
    if spec.get('whole_map'):
        script = 'preview-map.js'
        options = ''.join('<option value="' + html.escape(item['name'], quote=True) + '"' +
                          (' selected' if item['name'] == spec['site'] else '') + '>' +
                          html.escape(item.get('title', item['name'])) + '</option>' for item in (sites or [{'name': spec['site']}]))
        controls = '<div id="map-controls"><label>Town <select id="map-site">' + options + '</select></label><button id="map-fit">Show whole map</button><button id="map-time">Night</button></div>'
    return '''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<base href="''' + html.escape(base+'files/', quote=True) + '''"><title>TinyTown live preview</title>
<style>body{margin:0;background:#d7eaf5;font:14px system-ui}canvas{display:block}#status{position:fixed;top:12px;left:12px;padding:10px 14px;background:#fffffff0;border-radius:8px;max-width:80vw;white-space:pre-wrap}#status.error{color:#9b2525}#map-controls{position:fixed;bottom:12px;left:12px;right:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}button,select{font:inherit;padding:6px 10px;border:1px solid #ccc;border-radius:4px;background:#fff}#map-controls label{background:#fff;padding-left:10px;border-radius:4px}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script>
</head><body><div id="status">Building live preview…</div>''' + controls + '''<script>window.previewConfig=''' + config + ''';</script><script type="module" src="tinytown/web/''' + script + '''"></script></body></html>'''


def validate_spec(root, spec):
    """Validate an API request without building the entire source scene."""
    if not isinstance(spec, dict):
        raise ValueError('preview must be an object')
    if 'whole_map' in spec and type(spec['whole_map']) is not bool:
        raise ValueError('whole_map must be true or false')
    if spec.get('whole_map'):
        if spec.get('asset'):
            raise ValueError('Choose a whole map or an asset preview')
        SitePaths(spec.get('site', ''), root)
        return {'site': spec['site'], 'whole_map': True}
    if spec.get('asset'):
        _asset(spec)
    else:
        SitePaths(spec.get('site', 'avon-extended'), root)
        radius = float(spec.get('radius', 60))
        if not math.isfinite(radius) or not 10 <= radius <= 200:
            raise ValueError('preview radius must be between 10 and 200 metres')
        if 'center' in spec:
            _center({}, spec)
        elif not str(spec.get('target', '')).strip():
            raise ValueError('preview needs a target or center')
    return dict(spec)


def fresh_scene(root, spec):
    """Load builders/plugins in a fresh workspace process, including uncommitted edits."""
    import subprocess
    import sys
    script = '''import contextlib, json, sys
spec = json.load(sys.stdin)
with contextlib.redirect_stdout(sys.stderr):
    if spec.get('whole_map'):
        # Older worker snapshots do not know this preview mode. Import their
        # current scene builder directly so their source/data edits still win.
        from tinytown.site import build
        from tinytown.paths import SitePaths
        result = build(SitePaths(spec['site']), write=False)
        result['preview'] = {'whole_map': True}
    else:
        from tinytown.preview import scene
        result = scene('.', spec)
json.dump(result, sys.stdout)
'''
    result = subprocess.run([sys.executable, '-B', '-c', script], cwd=Path(root).resolve(),
                            input=json.dumps(spec), capture_output=True, text=True, timeout=90)
    if result.returncode:
        raise ValueError(result.stderr.strip()[-6000:] or 'Preview scene builder failed')
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise ValueError('Preview scene builder returned invalid JSON') from error
