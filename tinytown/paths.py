"""Every filesystem path the pipeline uses. Nothing else builds data/ or sites/ paths by hand.

Standard library only; imported on the deploy path.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SITE_NAME = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')


class ChangePaths:
    """Local development queue, isolated workspaces and standalone previews."""

    def __init__(self, root=ROOT):
        self.root = Path(root).resolve()

    directory = property(lambda self: self.root / 'runs' / 'changes')
    database = property(lambda self: self.directory / 'queue.sqlite3')
    lock = property(lambda self: self.directory / 'server.lock')
    server = property(lambda self: self.directory / 'server.json')
    browser_runtime = property(lambda self: self.root / 'runs' / 'headless-browser' / 'runtime')

    def change(self, change_id):
        if not re.fullmatch(r'[a-f0-9]{12}', change_id):
            raise ValueError('Invalid change id')
        return self.directory / change_id

    def workspace(self, change_id):
        return self.change(change_id) / 'workspace'

    def bake(self, change_id, build_id):
        if not re.fullmatch(r'[a-f0-9]{12}', build_id):
            raise ValueError('Invalid bake id')
        return self.change(change_id) / 'bakes' / build_id

    def merge_backup(self, change_id, iteration):
        return self.change(change_id) / f'workspace-before-merge-{int(iteration)}'

    def worker_report(self, change_id):
        return self.workspace(change_id) / 'runs' / 'change-worker' / 'report.json'

    def worker_reporter(self, change_id):
        return self.worker_report(change_id).with_name('report.py')

    def attachments(self, change_id):
        return self.change(change_id) / 'attachments'

    def attachment(self, change_id, attachment):
        if not re.fullmatch(r'[a-f0-9]{12}', attachment['id']) or attachment['extension'] not in {'png', 'jpg', 'webp'}:
            raise ValueError('Invalid screenshot id or format')
        return self.attachments(change_id) / f"{attachment['id']}.{attachment['extension']}"

    def worker_images(self, change_id):
        return self.worker_report(change_id).parent / 'images'

    def worker_browser_state(self, change_id):
        return self.workspace(change_id) / 'runs' / 'headless-browser'


class BuildingPaths:
    """Everything recorded about one structure: data/<site>/buildings/<id>/."""

    def __init__(self, site, bid):
        self.site = site
        self.id = str(bid)
        self.dir = site.buildings / self.id

    brief = property(lambda self: self.dir / 'brief.md')
    fronts = property(lambda self: self.dir / 'fronts.json')
    fronts_dir = property(lambda self: self.dir / 'fronts')
    aerial = property(lambda self: self.dir / 'aerial.json')
    references = property(lambda self: self.dir / 'references.json')
    draft = property(lambda self: self.dir / 'draft.json')
    notes = property(lambda self: self.dir / 'notes.md')
    author = property(lambda self: self.dir / 'author.json')
    review = property(lambda self: self.dir / 'review.json')
    comparison = property(lambda self: self.dir / 'comparison.json')
    footprint = property(lambda self: self.dir / 'footprint.png')
    images = property(lambda self: self.dir / 'images')
    renders = property(lambda self: self.dir / 'renders')

    def repair(self, n):
        return self.dir / f'repair-{int(n)}.json'

    def render(self, view):
        return self.renders / f'{view}.png'

    def __repr__(self):
        return f'BuildingPaths({self.site.name!r}, {self.id!r})'


class SitePaths:
    """Paths for one miniature. `name` is the site key, e.g. 'avon'."""

    def __init__(self, name, root=ROOT):
        if not SITE_NAME.fullmatch(name):
            raise ValueError(f'invalid site name: {name!r}')
        self.name = name
        self.root = Path(root)

    # sites/<name>/ : deployment metadata
    site_dir = property(lambda self: self.root / 'sites' / self.name)
    config = property(lambda self: self.site_dir / 'site.json')
    scope = property(lambda self: self.site_dir / 'scope.json')
    labels = property(lambda self: self.site_dir / 'labels.json')
    web_references = property(lambda self: self.site_dir / 'web-references.json')

    # data/<name>/ : the miniature
    data = property(lambda self: self.root / 'data' / self.name)
    source = property(lambda self: self.data / 'source')
    request = property(lambda self: self.source / 'site_request.json')
    osm = property(lambda self: self.source / 'osm.json')
    elevation = property(lambda self: self.source / 'elevation.json')
    satellite = property(lambda self: self.source / 'satellite.jpg')
    satellite_meta = property(lambda self: self.source / 'satellite.json')
    sv_index = property(lambda self: self.source / 'sv_index.json')
    composition = property(lambda self: self.source / 'composition.json')
    overrides = property(lambda self: self.data / 'overrides.json')
    scene = property(lambda self: self.data / 'site.json')
    surfaces_index = property(lambda self: self.data / 'surfaces.json')
    stream = property(lambda self: self.data / 'stream')
    stream_manifest = property(lambda self: self.stream / 'manifest.json')
    textures = property(lambda self: self.data / 'textures')
    buildings = property(lambda self: self.data / 'buildings')
    frame_review = property(lambda self: self.data / 'frame_review.json')

    def extra_source(self, name):
        """A plugin-requested OSM extract: source/<name>-osm.json."""
        return self.source / f'{name}-osm.json'

    def surfaces(self, digest):
        return self.data / f'surfaces-{digest}.bin.gz'

    def building(self, bid):
        return BuildingPaths(self, bid)

    def building_ids(self):
        if not self.buildings.is_dir():
            return []
        return sorted(p.name for p in self.buildings.iterdir() if p.is_dir())

    # Paths relative to the repository root, as the viewer and dist builds use them.
    def relative(self, path):
        return Path(path).resolve().relative_to(self.root.resolve()).as_posix()

    def __repr__(self):
        return f'SitePaths({self.name!r})'

    def __eq__(self, other):
        return isinstance(other, SitePaths) and (self.name, self.root) == (other.name, other.root)

    def __hash__(self):
        return hash((self.name, self.root))


def site_paths(name_or_dir, root=ROOT):
    """Accept 'avon', 'data/avon', or an absolute data directory."""
    text = str(name_or_dir).rstrip('/')
    if '/' in text or text.startswith('.'):
        path = Path(text)
        if not path.is_absolute():
            path = Path(root) / path
        path = path.resolve()
        if path.parent.name != 'data':
            raise ValueError(f'not a site data directory: {name_or_dir}')
        return SitePaths(path.name, path.parents[1])
    return SitePaths(text, root)
