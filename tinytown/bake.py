"""Stage 7b: bake a scene's runtime assets and stamp the viewer.

Three independent products, each keyed by a fingerprint of its inputs so a
re-run with the same inputs does no work:

* surfaces  - terrain, asphalt and sidewalks: data/<site>/surfaces-<hash>.bin.gz + surfaces.json
* stream    - camera-sector geometry chunks: data/<site>/stream/
* viewer    - the `?v=` cache stamps in index.html, from a hash of src/

`node tinytown/web/bake.mjs` bakes the first two in plain Node (three.js and
@napi-rs/canvas from `npm ci`; no browser); one generator run makes both.
`--check` needs only Node and Python's standard library, no node_modules.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from .paths import ROOT, site_paths

WEB = Path(__file__).resolve().parent / 'web'
BAKE_SCRIPT = WEB / 'bake.mjs'


# --- surfaces and stream ------------------------------------------------------

def bake_command(paths, *, check=False, surfaces=True, stream=True, force=False):
    command = ['node', str(BAKE_SCRIPT), paths.relative(paths.data)]
    if check:
        command.append('--check')
    elif force:
        command.append('--force')
    if not stream:
        command.append('--surfaces-only')
    elif not surfaces:
        command.append('--stream-only')
    return command


def bake(paths, *, check=False, surfaces=True, stream=True, force=False):
    """Bake one site's runtime assets; with check=True only report whether they are current.

    Assets whose fingerprints already match are left alone (both exports are
    byte-reproducible, so a rebuild would change nothing); force=True
    re-exports the streaming chunks anyway.
    """
    command = bake_command(paths, check=check, surfaces=surfaces, stream=stream, force=force)
    return subprocess.run(command, cwd=paths.root).returncode == 0


# --- viewer version stamps ----------------------------------------------------

def versioned_html(root=ROOT):
    """(revision, index.html text) with every local module URL stamped `?v=<revision>`."""
    root = Path(root)
    sources = sorted(p for p in (root / 'src').iterdir() if p.suffix in ('.js', '.css'))
    hasher = hashlib.sha256()
    for path in sources:
        hasher.update(path.name.encode() + b'\0' + path.read_bytes())
    revision = hasher.hexdigest()[:16]
    html = (root / 'index.html').read_text()
    match = re.search(r'(<script type="importmap">)(.*?)(</script>)', html, re.S)
    if not match:
        raise ValueError('Missing viewer import map')
    imports = json.loads(match[2])
    imports['imports'] = {k: v for k, v in imports['imports'].items() if not k.startswith('./src/')}
    for path in sources:
        if path.suffix == '.js':
            url = './src/' + path.name
            imports['imports'][url] = f'{url}?v={revision}'
    body = '\n' + '\n'.join('    ' + line for line in json.dumps(imports, indent=2).splitlines()) + '\n  '
    html = html[:match.start(2)] + body + html[match.end(2):]
    # Script entries and modulepreload links bypass import-map resolution.
    # Match their URLs to the map so the early data entry runs exactly once.
    html = re.sub(r'((?:src|href)="\./src/[^"?]+)(?:\?[^\"]*)?"', lambda m: f'{m[1]}?v={revision}"', html)
    return revision, html


def viewer_revision(root=ROOT):
    return versioned_html(root)[0]


def stamp_viewer(root=ROOT, check=False):
    """Rewrite index.html's `?v=` stamps; with check=True only report whether they are current."""
    root = Path(root)
    revision, expected = versioned_html(root)
    path = root / 'index.html'
    if path.read_text() == expected:
        print(f'Viewer revision: {revision}')
        return True
    if check:
        print('Viewer URLs are stale; run town bake --viewer', file=sys.stderr)
        return False
    # A threaded preview must never serve a partly rewritten import map.
    with tempfile.NamedTemporaryFile(mode='w', dir=root, prefix='.viewer-', delete=False) as output:
        temporary = Path(output.name)
        output.write(expected)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Viewer revision: {revision}')
    return True


# --- CLI ----------------------------------------------------------------------

def register(subparsers):
    parser = subparsers.add_parser('bake', help='bake surfaces and streaming chunks for a site, or stamp the viewer',
                                   description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('site', nargs='?', help="site name or data directory, e.g. avon or data/avon")
    parser.add_argument('--check', action='store_true', help='report whether assets are current; needs no node_modules')
    parser.add_argument('--force', action='store_true', help='re-export streaming chunks even when they are current')
    only = parser.add_mutually_exclusive_group()
    only.add_argument('--surfaces-only', action='store_true')
    only.add_argument('--stream-only', action='store_true')
    only.add_argument('--viewer', action='store_true', help='stamp index.html module URLs instead of baking a site')
    parser.set_defaults(run=_run)


def _run(args):
    if args.viewer:
        return 0 if stamp_viewer(ROOT, check=args.check) else 1
    if not args.site:
        print('town bake: a site (or --viewer) is required', file=sys.stderr)
        return 2
    paths = site_paths(args.site)
    return 0 if bake(paths, check=args.check, surfaces=not args.stream_only, stream=not args.surfaces_only,
                     force=args.force) else 1
