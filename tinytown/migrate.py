"""One-time move from the pre-September-2026 layout to docs/ARCHITECTURE.md's data layout.

Old layout                                   New layout
data/<s>/{osm,elevation,satellite,...}.json  data/<s>/source/...
data/<s>/research/blueprint_<id>.json        data/<s>/buildings/<id>/draft.json
data/<s>/research/blueprint_<id>.notes.md    data/<s>/buildings/<id>/notes.md
data/<s>/research/brief_<id>.md              data/<s>/buildings/<id>/brief.md
data/<s>/research/fronts_<id>.json           data/<s>/buildings/<id>/fronts.json   (photo files -> fronts/<face>[-n].png)
data/<s>/research/aerial_<id>.json           data/<s>/buildings/<id>/aerial.json
data/<s>/research/render_<id>_<view>.png.json data/<s>/buildings/<id>/renders/<view>.png.json
data/<s>/research/sv_index.json              data/<s>/source/sv_index.json
data/<s>/miniature/<id>/*                    data/<s>/buildings/<id>/*  (renamed, see MINIATURE_FILES)
data/<s>/miniature/history/, run-level files deleted (campaign provenance)

Absolute local paths inside migrated JSON are made repository-relative.
Standard library only. Uses `git mv` when the file is tracked so history follows.
"""
import json
from pathlib import Path
import re
import shutil
import subprocess

from .paths import ROOT, site_paths
from .state import atomic_json

SOURCE_FILES = ('osm.json', 'elevation.json', 'satellite.json', 'satellite.jpg', 'site_request.json',
                'composition.json')
MINIATURE_FILES = {
    'author-response.json': 'author.json',
    'review.json': 'review.json',
    'references.json': 'references.json',
    'initial-blueprint.json': 'author-blueprint.json',
    'repair-response.json': 'repair-1.json',
    'repaired-blueprint.json': 'repair-1-blueprint.json',
    'material-correction.json': 'material-correction.json',
    'material-corrected-blueprint.json': 'material-corrected-blueprint.json',
    'baseline-comparison.json': 'baseline-comparison.json',
    'initial-front.png.json': 'renders/author-front.png.json',
    'initial-overview.png.json': 'renders/author-overview.png.json',
    'repaired-front.png.json': 'renders/repair-1-front.png.json',
    'repaired-overview.png.json': 'renders/repair-1-overview.png.json',
    'final-front.png.json': 'renders/final-front.png.json',
    'final-overview.png.json': 'renders/final-overview.png.json',
}
LOCAL_PREFIX = re.compile(r'^/Users/[^/]+/git/koomen/(?:avon\.town|town)/')
RESEARCH = re.compile(r'^(blueprint|brief|fronts|aerial|render)_(-?\d+)(?:_([^.]+))?\.(json|md|notes\.md|png\.json)$')


class Migration:
    def __init__(self, paths, dry_run=False, verbose=True):
        self.paths = paths
        self.dry_run = dry_run
        self.verbose = verbose
        self.moved = self.deleted = self.rewritten = 0
        self.unmapped = []
        self.tracked = self._tracked()

    def _tracked(self):
        try:
            out = subprocess.run(['git', 'ls-files', '-z', '--', str(self.paths.data)], cwd=self.paths.root,
                                 capture_output=True, check=True).stdout
        except (subprocess.CalledProcessError, FileNotFoundError):
            return set()
        return {(self.paths.root / p).resolve() for p in out.decode().split('\0') if p}

    def log(self, *parts):
        if self.verbose:
            print(*parts)

    def move(self, src, dst):
        if not src.exists():
            return
        if dst.exists():
            raise FileExistsError(f'{dst} already exists; refusing to overwrite')
        self.log('mv', src.relative_to(self.paths.root), '->', dst.relative_to(self.paths.root))
        self.moved += 1
        if self.dry_run:
            return
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.resolve() in self.tracked:
            subprocess.run(['git', 'mv', '-k', str(src), str(dst)], cwd=self.paths.root, check=True)
            if src.exists():  # git mv -k skipped it
                shutil.move(str(src), str(dst))
        else:
            shutil.move(str(src), str(dst))

    def delete(self, path):
        if not path.exists():
            return
        self.log('rm', path.relative_to(self.paths.root))
        self.deleted += 1
        if self.dry_run:
            return
        if path.is_dir():
            tracked = [p for p in path.rglob('*') if p.resolve() in self.tracked]
            if tracked:
                subprocess.run(['git', 'rm', '-rq', '--', str(path)], cwd=self.paths.root, check=False)
            shutil.rmtree(path, ignore_errors=True)
        else:
            if path.resolve() in self.tracked:
                subprocess.run(['git', 'rm', '-q', '--', str(path)], cwd=self.paths.root, check=True)
            else:
                path.unlink()

    def run(self):
        p = self.paths
        for name in SOURCE_FILES:
            self.move(p.data / name, p.source / name)
        for extra in p.data.glob('*-osm.json'):
            self.move(extra, p.source / extra.name)
        # sites/<site>/scope.json is canonical; the data copy was a campaign snapshot.
        if (p.data / 'scope.json').exists():
            self.delete(p.data / 'scope.json')
        self.delete(p.data / 'pipeline-result.json')
        self.delete(p.data / 'expansion-progress.json')
        self.delete(p.data / 'expansion-monitor.json')
        self.migrate_research()
        self.migrate_miniature()
        for leftover in ('research', 'miniature'):
            d = p.data / leftover
            if d.exists() and not any(d.rglob('*')):
                self.log('rmdir', d.relative_to(p.root))
                if not self.dry_run:
                    shutil.rmtree(d)
        if not self.dry_run:
            self.rewrite_paths()
        return self

    def migrate_research(self):
        research = self.paths.data / 'research'
        if not research.is_dir():
            return
        self.move(research / 'sv_index.json', self.paths.sv_index)
        for item in sorted(research.iterdir()):
            if item.name == '.DS_Store':
                self.delete(item)
                continue
            if item.name == 'sv_index.json':
                continue
            if re.fullmatch(r'brief_[a-z_]+\.json', item.name):
                self.delete(item)  # research-group briefs from the retired merge_research step
                continue
            if item.name == 'overhead_labeled.jpg':
                self.move(item, self.paths.source / item.name)
                continue
            n = re.fullmatch(r'notes_(-?\d+)\.md', item.name)
            if n:
                self.move(item, self.paths.building(n.group(1)).notes)
                continue
            m = RESEARCH.match(item.name)
            if not m:
                self.unmapped.append(item)
                continue
            kind, bid, view, ext = m.groups()
            b = self.paths.building(bid)
            if kind == 'blueprint' and ext == 'json':
                self.move(item, b.draft)
            elif kind == 'blueprint' and ext == 'notes.md':
                self.move(item, b.notes)
            elif kind == 'brief':
                self.move(item, b.brief)
            elif kind == 'fronts':
                self.move(item, b.fronts)
            elif kind == 'aerial' and ext == 'json':
                self.move(item, b.aerial)
            elif kind == 'render' and ext == 'png.json':
                self.move(item, b.renders / f'{view}.png.json')
            else:
                self.unmapped.append(item)
        for pattern, target in (('front_*.png', 'fronts'), ('render_*.png', 'renders'), ('aerial_*.png', None),
                                ('aerial_*_footprint.png', None)):
            for image in research.glob(pattern):
                m = re.match(r'^(front|render|aerial)_(-?\d+)(?:_(.+?))?(_footprint)?\.png$', image.name)
                if not m:
                    self.unmapped.append(image)
                    continue
                kind, bid, view, footprint = m.groups()
                b = self.paths.building(bid)
                if kind == 'front':
                    # front_<id>_+u_2.png -> fronts/+u-2.png (references.py convention)
                    view = re.sub(r'_(\d+)$', r'-\1', view)
                    self.move(image, b.fronts_dir / f'{view}.png')
                elif kind == 'render':
                    self.move(image, b.renders / f'{view}.png')
                else:
                    self.move(image, b.dir / ('aerial_footprint.png' if footprint else 'aerial.png'))

    def migrate_miniature(self):
        miniature = self.paths.data / 'miniature'
        if not miniature.is_dir():
            return
        for item in sorted(miniature.iterdir()):
            if item.is_dir() and re.fullmatch(r'-?\d+', item.name):
                b = self.paths.building(item.name)
                for record in sorted(item.rglob('*')):
                    if record.is_dir():
                        continue
                    rel = record.relative_to(item).as_posix()
                    target = MINIATURE_FILES.get(rel)
                    if target:
                        self.move(record, b.dir / target)
                    elif re.fullmatch(r'repair-response-pass-\d+.*\.json|repair-base-[0-9a-f]+\.json', rel):
                        self.move(record, b.dir / rel)
                    elif record.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.sha256') \
                            or rel.startswith('web-original-'):
                        self.move(record, b.dir / 'images' / rel)
                    elif rel.endswith('.png.json'):
                        self.move(record, b.renders / rel)
                    elif '/' not in rel and rel.endswith('.json'):
                        self.move(record, b.dir / rel)  # hand corrections and recovery records keep their names
                    else:
                        self.unmapped.append(record)
                if not any(item.rglob('*')) and not self.dry_run:
                    shutil.rmtree(item)
            else:
                # history/<run>/, scene-review.json, practice-*.json: campaign provenance.
                self.delete(item)

    def rewrite_paths(self):
        """Make absolute local paths inside migrated JSON repository-relative."""
        for path in self.paths.buildings.rglob('*.json'):
            text = path.read_text()
            if '/Users/' not in text:
                continue
            value = json.loads(text)
            changed = self._relativize(value)
            if changed:
                self.rewritten += 1
                atomic_json(path, value)
        for path in (self.paths.composition,):
            if path.is_file() and '/Users/' in path.read_text():
                value = json.loads(path.read_text())
                if self._relativize(value):
                    self.rewritten += 1
                    atomic_json(path, value)

    def _relativize(self, value):
        changed = False
        if isinstance(value, dict):
            for key, child in value.items():
                if isinstance(child, str) and LOCAL_PREFIX.match(child):
                    value[key] = LOCAL_PREFIX.sub('', child)
                    changed = True
                else:
                    changed = self._relativize(child) or changed
        elif isinstance(value, list):
            for i, child in enumerate(value):
                if isinstance(child, str) and LOCAL_PREFIX.match(child):
                    value[i] = LOCAL_PREFIX.sub('', child)
                    changed = True
                else:
                    changed = self._relativize(child) or changed
        return changed


def migrate(name_or_dir, root=ROOT, dry_run=False, verbose=True):
    paths = site_paths(name_or_dir, root)
    result = Migration(paths, dry_run=dry_run, verbose=verbose).run()
    print(f'{paths.name}: moved {result.moved}, deleted {result.deleted}, rewrote {result.rewritten} JSON files'
          + (' (dry run)' if dry_run else ''))
    for item in result.unmapped:
        print('  unmapped:', item.relative_to(paths.root))
    return result


def register(subparsers):
    p = subparsers.add_parser('migrate', help='move a site from the pre-2026-09 layout to the current one')
    p.add_argument('site', nargs='+')
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('-q', '--quiet', action='store_true')
    p.set_defaults(run=lambda args: max(len(migrate(s, dry_run=args.dry_run, verbose=not args.quiet).unmapped)
                                        for s in args.site) and 1)
