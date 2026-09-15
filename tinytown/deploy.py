"""Stage 8: route documents, dist staging per deploy target, the dev server, live verification.

A deploy target (sites/deploy.json) is one Cloudflare Worker serving one dist
directory. Its routes come from the `deploy` placements in sites/*/site.json:
the site at `/` is the target's root; other sites get `/<route>.html`
documents that pin the shared viewer to their scene.

Standard library only: Cloudflare runs `python3 -m tinytown stage` with bare python3.
"""
import argparse
from functools import partial
import hashlib
import html as html_escape
import http.server
import io
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.parse import parse_qs, urlparse, urlsplit
from urllib.request import Request, urlopen

from . import config
from .bake import bake, stamp_viewer, versioned_html
from .paths import ROOT, SITE_NAME, SitePaths

ICONS = ('favicon.ico', 'favicon.png', 'favicon.svg', 'apple-touch-icon.png')
SOCIAL_PREVIEW = 'social-preview.jpg'
SITE_ASSETS = ICONS + (SOCIAL_PREVIEW,)
HEADERS = '_headers'
SURFACE_FILE = re.compile(r'surfaces-[0-9a-f]+\.bin\.gz')
STREAM_FILE = re.compile(r'(?:base(?:-part-\d+)?|(?:detail|region)--?\d+_-?\d+)-[0-9a-f]+\.bin\.gz')
TEXTURE = re.compile(rf'data/{SITE_NAME.pattern}/textures/[^/]+')
DEFAULT_PORT = 8734


# --- documents ----------------------------------------------------------------

def site_asset(site, name, root=ROOT):
    """sites/<site>/<name>, falling back to the repo-root file; None when neither exists."""
    for path in (SitePaths(site, root).site_dir / name, Path(root) / name):
        if path.is_file():
            return path
    return None


def _origin(domain):
    if not domain:
        return None
    origin = domain if '://' in domain else 'https://' + domain
    parsed = urlparse(origin)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.path not in ('', '/')
            or parsed.query or parsed.fragment or parsed.username or parsed.password):
        raise ValueError('Domain must be an HTTPS origin, without path, credentials or query')
    return origin.rstrip('/')


def render_document(site, root=ROOT, *, domain=None, page_path='/', asset_prefix=''):
    """The shared viewer with one site's title, description and social metadata.

    `asset_prefix` is the URL directory where the site's own icons and preview
    are published ('' at the dist root, '/sites/<site>' for a non-root site).
    Assets that fall back to the repo root are always published at the dist root.
    """
    if not SITE_NAME.fullmatch(site):
        raise ValueError('Invalid site name')
    root = Path(root)
    paths = SitePaths(site, root)
    settings = config.site_config(site, root)
    origin = _origin(domain or settings.get('domain'))
    _, document = versioned_html(root)
    esc = partial(html_escape.escape, quote=True)
    title, description = esc(settings['title']), esc(settings['description'])
    document = re.sub(r'<title>.*?</title>', lambda _: f'<title>{title}</title>', document)
    document = document.replace('<head>', f'<head>\n  <meta name="town-site" content="{site}" />')
    # Replace the viewer's default social metadata. Absolute canonical URLs
    # are emitted only when a deployment domain is configured.
    document = re.sub(r'^.*<(?:meta (?:name="(?:description|twitter:[^"]+)"|property="og:[^"]+")|link rel="canonical")[^>]*>\s*\n',
                      '', document, flags=re.M)
    tags = [f'<meta name="description" content="{description}" />',
            '<meta property="og:type" content="website" />',
            f'<meta property="og:site_name" content="{title}" />',
            f'<meta property="og:title" content="{title}" />',
            f'<meta property="og:description" content="{description}" />',
            '<meta name="twitter:card" content="summary_large_image" />',
            f'<meta name="twitter:title" content="{title}" />',
            f'<meta name="twitter:description" content="{description}" />']
    if origin:
        page_url = esc(origin) + esc(page_path)
        tags += [f'<link rel="canonical" href="{page_url}" />', f'<meta property="og:url" content="{page_url}" />']
    preview = site_asset(site, SOCIAL_PREVIEW, root)
    if preview:
        prefix = asset_prefix if preview.parent == paths.site_dir else ''
        revision = hashlib.sha256(preview.read_bytes()).hexdigest()[:12]
        image_url = esc(f'{origin or ""}{prefix}/{SOCIAL_PREVIEW}?v={revision}')
        image = settings.get('social_image', {})
        image_alt = esc(image.get('alt', settings['description']))
        tags += [f'<meta property="og:image" content="{image_url}" />',
                 f'<meta name="twitter:image" content="{image_url}" />',
                 '<meta property="og:image:type" content="image/jpeg" />',
                 f'<meta property="og:image:alt" content="{image_alt}" />',
                 f'<meta name="twitter:image:alt" content="{image_alt}" />']
        for dimension in ('width', 'height'):
            if dimension in image:
                tags.append(f'<meta property="og:image:{dimension}" content="{int(image[dimension])}" />')
    document = document.replace('</title>', '</title>\n  ' + '\n  '.join(tags), 1)
    if asset_prefix:
        for name in ICONS:
            if (paths.site_dir / name).is_file():
                document = document.replace(f'href="/{name}"', f'href="{asset_prefix}/{name}"')
    return document


def route_document(site, root=ROOT, target=None, fixed_site=True):
    """The document served for `site` on one deploy target.

    Targets with named routes below `/` pin every document to its scene: a
    `<base href="/">` so relative URLs resolve from the root, and (fixed_site)
    a script dropping a `?site=` override so the path alone chooses the scene.
    """
    target = target or default_target(root)
    table = config.routes(target, root)
    if site not in table.values():
        raise ValueError('Unknown miniature route')
    root_name = table['/']
    domain = config.site_config(root_name, root).get('domain')
    page_path = next(route for route, name in table.items() if name == site)
    asset_prefix = '' if site == root_name else '/sites/' + site
    document = render_document(site, root, domain=domain, page_path=page_path, asset_prefix=asset_prefix)
    if not any(route != '/' for route in table):
        return document
    head = f'<base href="/" />\n  <meta name="town-route" content="{site}" />'
    if fixed_site:
        # Named routes choose the scene; retain camera/time parameters and the
        # requested path while the shared renderer loads the selected scene.
        head += '''
  <script>
    { const url = new URL(location.href);
      if (url.searchParams.has('site')) {
        url.searchParams.delete('site');
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      }
    }
  </script>'''
    return document.replace('<head>', '<head>\n  ' + head, 1)


def default_target(root=ROOT):
    return next(iter(config.deploy_targets(root)))


def preview_document(url, root=ROOT, target=None):
    """The dev server's document for a request URL, or None to serve a file.

    Named routes serve their route document; `/?site=<name>` keeps query-based
    authoring previews (a route document without the site pin for deployed
    sites, the plain viewer for anything else).
    """
    root = Path(root)
    try:
        target = target or default_target(root)
        table = config.routes(target, root)
    except (FileNotFoundError, StopIteration):
        return None  # not a repository checkout (e.g. serving a dist directory)
    if '/' not in table:
        return None
    request = urlsplit(url)
    path = request.path.rstrip('/') or '/'
    if path.endswith('.html'):
        path = path[:-5]
    if path == '/index':
        path = '/'
    if path == '/':
        site = parse_qs(request.query).get('site', [table['/']])[0]
        if site != table['/']:
            if not SITE_NAME.fullmatch(site):
                raise ValueError('Invalid authoring site name')
            if site in table.values():
                return route_document(site, root, target, fixed_site=False)
            return versioned_html(root)[1].replace('<head>', '<head>\n  <base href="/" />', 1)
    site = table.get(path)
    return route_document(site, root, target) if site else None


# --- dist staging -------------------------------------------------------------

def copy_file(root, destination, name, record=None):
    relative = Path(name)
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Invalid runtime asset path: ' + name)
    source = root / relative
    if not source.resolve().is_relative_to(root.resolve()):
        raise ValueError('Runtime asset is outside the repository: ' + name)
    content = source.read_bytes()
    if record:
        if hashlib.sha256(content).hexdigest() != record['sha256'] or len(content) != record['bytes']:
            raise ValueError('Runtime asset does not match its manifest: ' + name)
    target = destination / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)


def runtime_images(value):
    if isinstance(value, dict):
        if isinstance(value.get('image'), str):
            yield value['image']
        for child in value.values():
            yield from runtime_images(child)
    elif isinstance(value, list):
        for child in value:
            yield from runtime_images(child)


def copy_scene(root, destination, site):
    """Copy one site's runtime files: scene, baked surfaces, stream chunks, textures."""
    paths = SitePaths(site, root)
    scene_bytes = paths.scene.read_bytes()
    scene = json.loads(scene_bytes)
    scope = config.scope(site, root)
    if scope:
        if {str(b['id']) for b in scene['buildings']} != set(scope['building_ids']):
            raise ValueError(f'{site} scene does not match its scope')
        if any(not b.get('blueprint') for b in scene['buildings']):
            raise ValueError(f'{site} has unauthored structures')
    copy_file(root, destination, paths.relative(paths.scene))
    surfaces = json.loads(paths.surfaces_index.read_text())
    if not SURFACE_FILE.fullmatch(surfaces['file']):
        raise ValueError('Invalid surface payload name')
    copy_file(root, destination, paths.relative(paths.surfaces_index))
    copy_file(root, destination, paths.relative(paths.data / surfaces['file']),
              {'sha256': surfaces['compressedSha256'], 'bytes': surfaces['compressedBytes']})
    manifest = json.loads(paths.stream_manifest.read_text())
    if manifest['inputSha256'] != hashlib.sha256(scene_bytes).hexdigest():
        raise ValueError(site + ' stream does not match the scene')
    copy_file(root, destination, paths.relative(paths.stream_manifest))
    base = manifest['base']
    for record in [*base.get('parts', [base]), *manifest.get('regions', []), *manifest['tiles']]:
        if not STREAM_FILE.fullmatch(record['file']):
            raise ValueError('Invalid stream payload name')
        copy_file(root, destination, paths.relative(paths.stream / record['file']), record)
    for image in set(runtime_images(scene)):
        url = urlsplit(image)
        if url.scheme in ('https', 'http', 'data'):
            continue
        name = url.path.removeprefix('./').removeprefix('/')
        if url.netloc or not TEXTURE.fullmatch(name):
            raise ValueError('Expected a local runtime texture: ' + image)
        copy_file(root, destination, name)


def precheck(sites, root=ROOT):
    """Baked assets and the viewer stamp must be current; building never generates them."""
    ok = all([bake(SitePaths(site, root), check=True) for site in sites])
    if not stamp_viewer(root, check=True) or not ok:
        raise ValueError('Baked assets are stale; see the messages above')


def build(target, root=ROOT, check=True):
    """Stage dist/<target> for one deploy target; returns the destination directory."""
    root = Path(root).resolve()
    destination = root / config.deploy_targets(root)[target]['dist']
    table = config.routes(target, root)
    root_name = table['/']
    sites = config.sites_for_target(target, root)
    if check:
        precheck(sites, root)
    if destination.is_symlink():
        raise ValueError('Build destination must not be a symlink')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent, prefix=f'.{destination.name}-') as tmp:
        staged = Path(tmp) / destination.name
        staged.mkdir()
        shutil.copytree(root / 'src', staged / 'src',
                        ignore=lambda path, names: [n for n in names if Path(n).suffix not in ('.js', '.css')])
        for route, site in table.items():
            name = 'index.html' if route == '/' else route[1:] + '.html'
            (staged / name).write_text(route_document(site, root, target))
        for site in sites:
            copy_scene(root, staged, site)
            for name in SITE_ASSETS:
                source = site_asset(site, name, root)
                if source is None:
                    continue
                # The root site's own assets and repo-root fallbacks live at the
                # dist root; other sites keep theirs under sites/<site>/.
                own = source.parent != root
                published = staged / 'sites' / site / name if own and site != root_name else staged / name
                published.parent.mkdir(parents=True, exist_ok=True)
                published.write_bytes(source.read_bytes())
        headers = site_asset(root_name, HEADERS, root)
        if headers is None:
            raise FileNotFoundError(HEADERS)
        (staged / HEADERS).write_bytes(headers.read_bytes())
        previous = Path(tmp) / 'previous'
        if destination.exists():
            destination.rename(previous)
        try:
            staged.rename(destination)
        except BaseException:
            if previous.exists():
                previous.rename(destination)
            raise
    return destination


# --- dev server ---------------------------------------------------------------

class Handler(http.server.SimpleHTTPRequestHandler):
    """Static files with caching disabled, route documents, `?site=` previews, clean paths."""

    def send_head(self):
        root = Path(self.directory)
        try:
            document = preview_document(self.path, root)
        except ValueError as error:
            self.send_error(400, str(error))
            return None
        if document is not None:
            content = document.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            return io.BytesIO(content)
        # Match the deployment host's clean paths when serving a dist directory.
        path = urlsplit(self.path).path.rstrip('/')
        if path and not Path(path).suffix and Path(self.translate_path(path + '.html')).is_file():
            self.path = path + '.html'
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def serve(port=DEFAULT_PORT, root=ROOT):
    http.server.test(HandlerClass=partial(Handler, directory=str(root)), port=port)


# --- live verification --------------------------------------------------------

def verify(bundle, domain, site, attempts=12, delay=10):
    """Check that `domain` serves `bundle`'s root document and current runtime files."""
    bundle = Path(bundle)
    paths = SitePaths(site, bundle)
    files = ['index.html', 'src/main.js'] + [paths.relative(p) for p in (paths.scene, paths.surfaces_index, paths.stream_manifest)]
    expected = {name: (bundle / name).read_bytes() for name in files}
    for attempt in range(attempts):
        try:
            for name, content in expected.items():
                route = '' if name == 'index.html' else name
                digest = hashlib.sha256(content).hexdigest()
                # Allow a new deployment to reach the edge without reusing an
                # intermediary's cached document from a previous release.
                url = f'{domain.rstrip("/")}/{route}?deployment-check={digest[:16]}'
                request = Request(url, headers={'User-Agent': 'tiny-town-deployment-check/1.0',
                                                'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity'})
                with urlopen(request, timeout=20) as response:
                    actual = response.read()
                if name == 'index.html':
                    # Cloudflare Web Analytics inserts its own beacon at the
                    # edge. Compare the authored HTML without that insertion.
                    actual = re.sub(rb'<script\b[^>]*\bsrc="https://static\.cloudflareinsights\.com/'
                                    rb'beacon\.min\.js[^\"]*"[^>]*></script>\n?', b'', actual)
                if actual != content:
                    raise ValueError(f'{domain}/{route} does not match the built file')
            print(f'Verified {domain}/: {site}, current viewer, scene, surfaces and stream manifest')
            return True
        except (URLError, TimeoutError, ValueError) as error:
            if attempt + 1 == attempts:
                print(f'Deployment check failed: {error}', file=sys.stderr)
                return False
            print(f'Waiting for deployment ({attempt + 1}/{attempts}): {error}', flush=True)
            time.sleep(delay)
    return False


# --- CLI ----------------------------------------------------------------------

def register(subparsers):
    targets = list(config.deploy_targets())
    deploy = subparsers.add_parser('stage', help='stage dist/<target> for Cloudflare',
                                   description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    deploy.add_argument('--target', choices=targets + ['all'], default='all')
    deploy.add_argument('--no-check', action='store_true', help='skip the bake --check and viewer stamp checks')
    deploy.set_defaults(run=_run_deploy)

    server = subparsers.add_parser('serve', help='dev server for the viewer (route documents, ?site= previews)')
    server.add_argument('--port', type=int, default=DEFAULT_PORT)
    server.add_argument('--dist', nargs='?', const=targets[0], choices=targets, metavar='TARGET',
                        help='serve a built dist directory instead of the repository')
    server.set_defaults(run=_run_serve)

    check = subparsers.add_parser('verify', help='check that a domain serves the built bundle')
    check.add_argument('target', choices=targets)
    check.add_argument('domain')
    check.add_argument('site', nargs='?', help="site to verify (default: the target's root site)")
    check.set_defaults(run=_run_verify)


def _run_deploy(args):
    targets = list(config.deploy_targets()) if args.target == 'all' else [args.target]
    for target in targets:
        try:
            print(build(target, check=not args.no_check))
        except ValueError as error:
            print(f'town stage {target}: {error}', file=sys.stderr)
            return 1
    return 0


def _run_serve(args):
    root = ROOT / config.deploy_targets()[args.dist]['dist'] if args.dist else ROOT
    serve(args.port, root)
    return 0


def _run_verify(args):
    bundle = ROOT / config.deploy_targets()[args.target]['dist']
    site = args.site or config.root_site(args.target)
    return 0 if verify(bundle, args.domain, site) else 1
