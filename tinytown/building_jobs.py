"""Buildings in the change queue: a derived building index and bounded authoring jobs.

The dashboard's Buildings view is computed from the files under
data/<site>/buildings/<id>/ and overrides.json on every request (with a short
cache), never stored in the queue database: status stays derived (ARCHITECTURE
rule 3). Only work in progress becomes a queue record.

Building jobs
-------------
A queue record with `kind: "building"` runs the bounded per-building state
machine of `town author` (author.Run) for `building_ids` of one `site`, in the
main checkout. It needs no Git snapshot: a draft (buildings/<id>/draft.json) is
already a proposal, and the Street View photos and renders the author needs are
gitignored, so a snapshot could not see them. Approval runs `author.accept`
(which writes overrides.json and rebuilds data/<site>/site.json) and commits
exactly that delta, plus the building's already-tracked JSON/Markdown records
(and draft.json), to local main with the queue's separate-index commit. Model
call records, reviews, references, render provenance and human-feedback.json
stay local unless something already tracks them. Approval refuses a draft that
changed after the job finished (it was not the reviewed one), and a building
awaiting approval or held by an escalation cannot join another job. A refused acceptance (a forced
publication, an unapproved re-authoring) can be approved anyway with force.

Record fields: kind="building", site, building_ids, mode ("author" or
"reauthor"), options (extra author.Run keyword arguments, JSON scalars only),
buildings ({id: {status, steps, error, refused, commit, draft_hash}}).

Human feedback file
-------------------
Iterating on a building job writes buildings/<id>/human-feedback.json:

    {"entries": [
        {"id": "3f2a9c1d0b7e",          # 12 hex characters, unique per entry
         "text": "The porch roof should be a shed roof sloping away from the door.",
         "draft_hash": "<state.fingerprint(draft.json) when written, or null without a draft>",
         "at": "2026-09-23T17:04:00+00:00",   # UTC ISO 8601
         "job": "a1b2c3d4e5f6",           # queue change id, or null
         "source": "dashboard"}           # dashboard | cli
    ]}

Entries are append-only. An entry is *pending* while its draft_hash equals the
fingerprint of the current draft.json (or both are null): the next repair
prompt should present pending entries as the highest-priority review ("a
person reviewed the current renders"), ahead of the model review, and they
should justify a repair even when the model review passed or the automated
repair rounds are spent. Once a repair writes a new draft, the hashes differ
and the entries are history.

author.py answers pending entries with a `human-repair-<n>.json` pass
(author.pending_feedback): it does not use an automated repair round, runs even
after a passed review or accepted blueprint, and each entry is answered once.
"""
from datetime import datetime, timezone
import inspect
import json
import mimetypes
import re
import shutil
import stat
import threading
import time
import uuid

from .paths import SITE_NAME, SitePaths
from .state import atomic_json, fingerprint, read_json

BUILDING_ID = re.compile(r'-?[A-Za-z0-9_]{1,40}')
GROUPS = ('needs-refs', 'needs-author', 'in-progress', 'ready', 'needs-attention', 'accepted', 'failed')
MODES = ('author', 'reauthor')
MAX_IDS = 200
IMAGE_TYPES = {'.png', '.jpg', '.jpeg', '.webp'}
# author.Run arguments a job never takes from a request: selection, publication and binaries.
RESERVED_OPTIONS = {'self', 'paths', 'ids', 'all', 'reauthor', 'dry_run', 'accept', 'force', 'log', 'codex',
                    'labels', 'web_references'}
CACHE_SECONDS = 3
_cache, _cache_lock = {}, threading.Lock()


def now():
    return datetime.now(timezone.utc).isoformat()


def _author():
    from . import author
    return author


# --- validation ------------------------------------------------------------------

def site_paths(root, site):
    if not isinstance(site, str) or not SITE_NAME.fullmatch(site):
        raise ValueError('Choose a town')
    paths = SitePaths(site, root)
    if not paths.scene.is_file():
        raise ValueError(f'Unknown town {site!r} (no data/{site}/site.json)')
    return paths


def validate_id(bid):
    bid = str(bid)
    if not BUILDING_ID.fullmatch(bid):
        raise ValueError(f'Invalid building id: {bid!r}')
    return bid


def validate_ids(ids):
    if isinstance(ids, (str, int)):
        ids = [ids]
    if not isinstance(ids, list) or not ids:
        raise ValueError('Choose at least one building')
    ids = list(dict.fromkeys(validate_id(bid) for bid in ids))
    if len(ids) > MAX_IDS:
        raise ValueError(f'A building job takes at most {MAX_IDS} buildings')
    return ids


def validate_options(options):
    """Extra author.Run keyword arguments. Names come from its signature, so new author options work unchanged."""
    if options in (None, {}):
        return {}
    if not isinstance(options, dict):
        raise ValueError('Author options must be an object')
    parameters = inspect.signature(_author().Run.__init__).parameters
    allowed = {name for name, p in parameters.items() if p.kind is p.KEYWORD_ONLY} - RESERVED_OPTIONS
    result = {}
    for key, value in options.items():
        if key not in allowed:
            raise ValueError(f'Unknown author option {key!r}; choose from {", ".join(sorted(allowed))}')
        if value is not None and not isinstance(value, (str, int, float, bool)):
            raise ValueError(f'Author option {key} must be text, a number or true/false')
        if isinstance(value, str) and len(value) > 200:
            raise ValueError(f'Author option {key} is too long')
        result[key] = value
    return result


# --- the derived building index ---------------------------------------------------

def _review(paths, bid, overrides):
    """(review record or None, publication record or None) for the building."""
    from .review import read_review
    record = read_review(paths, bid)  # wraps legacy bare responses
    accepted = (overrides.get('miniature_review') or {}).get(bid)
    accepted = accepted if isinstance(accepted, dict) else None
    return record, accepted


def _report(record):
    report = (record or {}).get('report')
    return report if isinstance(report, dict) else {}


def group_for(status, review, accepted_review):
    if status == 'unreferenced':
        return 'needs-refs'
    if status in ('referenced',):
        return 'needs-author'
    if status == 'failed':
        return 'failed'
    if status == 'reviewed':
        return 'ready' if (review or {}).get('passed') else 'needs-attention'
    if status == 'accepted':
        publication = (accepted_review or {}).get('publication') or {}
        if publication.get('forced') or (accepted_review or {}).get('status') == 'needs-attention':
            return 'needs-attention'
        return 'accepted'
    return 'in-progress'  # drafted, invalid-draft, needs-repair


def _row(paths, building, overrides, active):
    author = _author()
    bid = str(building['id'])
    b = paths.building(bid)
    blueprint = (overrides.get('blueprints') or {}).get(bid)
    if b.draft.is_file() or b.dir.is_dir():
        status = author.status(paths, bid, overrides)
    else:
        status = 'unreferenced'
    if status in ('unreferenced', 'referenced') and blueprint is not None and not b.draft.is_file():
        status = 'accepted'  # authored before per-building drafts were kept
    review, accepted = _review(paths, bid, overrides)
    group = group_for(status, review, accepted)
    job = active.get(bid)
    if job:
        group = 'in-progress'
    report = _report(review) or (accepted or {}).get('review') or {}
    publication = (accepted or {}).get('publication') or {}
    return {'id': bid, 'name': building.get('name'), 'address': building.get('addr'),
            'kind': (building.get('style') or {}).get('kind'), 'status': status, 'group': group,
            'verdict': report.get('verdict') if isinstance(report, dict) else None,
            'passed': (review or {}).get('passed'),
            'forced': bool(publication.get('forced') or (review or {}).get('repairs_exhausted')),
            'repairs': sum(1 for n in range(1, 10) if b.repair(n).is_file()),
            'has_draft': b.draft.is_file(), 'job': job}


def index(root, site, active=None):
    """Every structure in data/<site>/site.json with its derived status (cached a few seconds)."""
    paths = site_paths(root, site)
    active = active or {}
    key = (str(paths.root), site)
    stamp = (paths.scene.stat().st_mtime_ns, paths.overrides.stat().st_mtime_ns if paths.overrides.is_file() else 0,
             json.dumps(active, sort_keys=True))
    with _cache_lock:
        cached = _cache.get(key)
        if cached and cached[0] == stamp and time.monotonic() - cached[1] < CACHE_SECONDS:
            return cached[2]
    from .site import load_overrides, load_site
    data, overrides = load_site(paths), load_overrides(paths)
    rows = [_row(paths, building, overrides, active) for building in data.get('buildings', [])]
    with _cache_lock:
        _cache[key] = (stamp, time.monotonic(), rows)
    return rows


def query(root, site, *, group=None, q=None, offset=0, limit=100, active=None):
    rows = index(root, site, active)
    counts = {name: 0 for name in GROUPS}
    for row in rows:
        counts[row['group']] += 1
    if group:
        if group not in GROUPS:
            raise ValueError(f'Unknown building group {group!r}')
        rows = [row for row in rows if row['group'] == group]
    if q:
        needle = str(q).casefold().strip()
        rows = [row for row in rows if any(needle in str(row.get(k) or '').casefold() for k in ('id', 'name', 'address'))]
    offset, limit = max(0, int(offset)), max(1, min(500, int(limit)))
    return {'site': site, 'total': len(rows), 'counts': counts, 'offset': offset, 'limit': limit,
            'groups': list(GROUPS), 'rows': rows[offset:offset + limit]}


def _images(paths, bid):
    """Reference photos and the latest renders, newest first, as files/<relative path> entries."""
    b = paths.building(bid)
    found = []
    for directory, kind in ((b.renders, 'render'), (b.fronts_dir, 'photo'), (b.images, 'photo'), (b.dir, 'reference')):
        if not directory.is_dir():
            continue
        for path in directory.iterdir():
            if path.is_file() and not path.is_symlink() and path.suffix.lower() in IMAGE_TYPES:
                found.append((path.stat().st_mtime, kind, path))
    found.sort(key=lambda item: -item[0])
    result, seen = [], set()
    # Paired photo/render comparisons first, then face sheets and overviews, then everything else.
    order = lambda item: (0 if item[2].name.startswith('compare-') else 1 if item[2].name.endswith('-faces.jpg')  # noqa: E731
                          else 2 if item[2].name.endswith('-overview.png') else 3 if item[1] == 'photo' else 4)
    for _, kind, path in sorted(found, key=order):
        relative = path.relative_to(b.dir).as_posix()
        if relative in seen:
            continue
        seen.add(relative)
        result.append({'name': relative, 'kind': 'compare' if path.name.startswith('compare-') else kind,
                       'url': f'/api/buildings/{paths.name}/{bid}/files/{relative}'})
        if len(result) >= 24:
            break
    return result


def details(root, site, bid, active=None):
    author = _author()
    paths = site_paths(root, site)
    bid = validate_id(bid)
    row = next((r for r in index(root, site, active) if r['id'] == bid), None)
    if row is None:
        raise ValueError(f'No building {bid} in {site}')
    from .site import load_overrides
    overrides = load_overrides(paths)
    review, accepted = _review(paths, bid, overrides)
    b = paths.building(bid)
    last = author.last_response(b) or {}
    report = _report(review)
    return {**row, 'review': {'verdict': report.get('verdict'), 'summary': report.get('summary'),
                              'issues': report.get('issues') or [], 'orientation': report.get('orientation'),
                              'scores': report.get('scores'), 'findings': (review or {}).get('findings') or [],
                              'passed': (review or {}).get('passed'),
                              'repairs_exhausted': (review or {}).get('repairs_exhausted'),
                              'scene_review': (review or {}).get('scene_review')} if review else None,
            'accepted_review': accepted, 'cues': last.get('cues') or [], 'uncertainties': last.get('uncertainties') or [],
            'feedback': (read_json(b.human_feedback) or {}).get('entries', []),
            'images': _images(paths, bid),
            'preview': {'site': site, 'target': bid, 'radius': 60, **({'drafts': [bid]} if b.draft.is_file() else {})}}


def image_file(root, site, bid, name):
    """A reference or render image under buildings/<id>/; nothing else is served."""
    paths = site_paths(root, site)
    b = paths.building(validate_id(bid))
    parts = name.split('/')
    if not name or len(parts) > 2 or any(p in ('', '.', '..') or p.startswith('.') for p in parts):
        raise ValueError('Not a building image')
    path = b.dir.joinpath(*parts)
    if path.suffix.lower() not in IMAGE_TYPES or path.is_symlink() or path.parent.is_symlink():
        raise ValueError('Not a building image')
    if not path.resolve().is_relative_to(b.dir.resolve()) or not path.is_file():
        raise FileNotFoundError('Image not found')
    return path, mimetypes.guess_type(path.name)[0] or 'application/octet-stream'


# --- feedback --------------------------------------------------------------------

def write_feedback(root, site, bid, text, job=None, source='dashboard'):
    """Append one human review entry (format in the module docstring); returns it."""
    paths = site_paths(root, site)
    b = paths.building(validate_id(bid))
    draft = read_json(b.draft)
    entry = {'id': uuid.uuid4().hex[:12], 'text': text.strip(), 'draft_hash': fingerprint(draft) if draft is not None else None,
             'at': now(), 'job': job, 'source': source}
    record = read_json(b.human_feedback) or {}
    entries = record.get('entries') if isinstance(record.get('entries'), list) else []
    atomic_json(b.human_feedback, {**record, 'entries': [*entries, entry]})
    return entry


# --- jobs -------------------------------------------------------------------------

def job_fields(root, site, ids, mode='author', options=None):
    paths = site_paths(root, site)
    ids = validate_ids(ids)
    if mode not in MODES:
        raise ValueError('Mode must be author or reauthor')
    from .site import load_site
    mapped = {str(b['id']) for b in load_site(paths).get('buildings', [])}
    unknown = [bid for bid in ids if bid not in mapped]
    if unknown:
        raise ValueError(f'Not in {site}: {", ".join(unknown[:5])}')
    label = ids[0] if len(ids) == 1 else f'{len(ids)} buildings'
    verb = 'Re-author' if mode == 'reauthor' else 'Author'
    request = f'{verb} {label} in {site} with the bounded authoring pipeline (town author).'
    return {'kind': 'building', 'site': site, 'building_ids': ids, 'mode': mode,
            'options': validate_options(options), 'buildings': {bid: {'status': None} for bid in ids},
            'request': request, 'title': f'{verb} {site} {label}',
            'preview': {'site': site, 'target': ids[0], 'radius': 60, 'drafts': ids[:20]}}


def active_buildings(records):
    """{building id: change number} for every queued or running building job, and running escalations."""
    result = {}
    for record in records:
        if record.get('status') not in ('queued', 'running'):
            continue
        if record.get('kind') == 'building':
            for bid in record.get('building_ids', []):
                result[f'{record["site"]}/{bid}'] = record.get('number')
        elif record.get('escalation'):
            e = record['escalation']
            result[f'{e["site"]}/{e["id"]}'] = record.get('number')
    return result


def claimed_buildings(records):
    """{site/id: change number} a new job may not take: active work, unapproved building jobs, open escalations."""
    result = active_buildings(records)
    for record in records:
        if record.get('status') != 'pending_approval':
            continue
        if record.get('kind') == 'building':
            done = record.get('buildings') or {}
            for bid in record.get('building_ids', []):
                if not (done.get(bid) or {}).get('commit'):
                    result.setdefault(f'{record["site"]}/{bid}', record.get('number'))
        elif record.get('escalation'):
            e = record['escalation']
            result.setdefault(f'{e["site"]}/{e["id"]}', record.get('number'))
    return result


def claimed_in(records, site):
    return {key.split('/', 1)[1]: number for key, number in claimed_buildings(records).items() if key.startswith(site + '/')}


def draft_hash(paths, bid):
    draft = read_json(paths.building(bid).draft)
    return fingerprint(draft) if draft is not None else None


def active_in(records, site):
    return {key.split('/', 1)[1]: number for key, number in active_buildings(records).items() if key.startswith(site + '/')}


def busy(record, running):
    """Does this building job share a building with a running job?"""
    mine = {f'{record["site"]}/{bid}' for bid in record.get('building_ids', [])}
    for other in running:
        if other.get('kind') == 'building' and mine & {f'{other["site"]}/{bid}' for bid in other.get('building_ids', [])}:
            return True
    return False


def work(queue, record):
    """Run one pass of a building job in the main checkout; the queue lock is not held."""
    author = _author()
    directory = queue.paths.change(record['id'])
    directory.mkdir(parents=True, exist_ok=True)
    log_path = directory / f"iteration-{record['iteration']}.log"
    paths = site_paths(queue.root, record['site'])
    ids = list(record['building_ids'])
    last = [0.0]

    def log(text):
        line = f'{time.strftime("%H:%M:%S")} {text}'
        with log_path.open('a') as stream:
            stream.write(line + '\n')
        if time.monotonic() - last[0] >= .5:
            last[0] = time.monotonic()
            with queue.lock:
                current = queue.get(record['id'])
                if current['status'] == 'running' and current['iteration'] == record['iteration']:
                    current['worker_status'] = str(text)[:1000]
                    queue._save(current)

    log_path.write_text('')
    options = dict(record.get('options') or {})
    reauthor = ids if record.get('mode') == 'reauthor' else ()
    run = author.Run(paths, ids, reauthor=reauthor, log=log, **options)
    with queue.lock:
        queue.building_runs[record['id']] = run
        if queue.get(record['id'])['status'] != 'running' or queue.halt.is_set():
            queue.building_runs.pop(record['id'], None)
            raise RuntimeError('Cancelled before the author run started')
    try:
        log(f'town author {paths.name} {" ".join(ids)}' + (' (re-author)' if reauthor else ''))
        summary = run.run()
    finally:
        with queue.lock:
            queue.building_runs.pop(record['id'], None)
    return finish(queue, record, summary, log)


def finish(queue, record, summary, log=print):
    author = _author()
    paths = site_paths(queue.root, record['site'])
    with queue.lock:
        current = queue.get(record['id'])
        if current['status'] != 'running' or current['iteration'] != record['iteration']:
            return current
        buildings = current.setdefault('buildings', {})
        for bid in current['building_ids']:
            entry = (summary.get('buildings') or {}).get(bid) or {}
            skipped = (summary.get('skipped') or {}).get(bid)
            status = author.status(paths, bid)
            buildings[bid] = {**buildings.get(bid, {}), 'status': status, 'steps': entry.get('steps', []),
                              'error': entry.get('error'), 'skipped': skipped, 'draft_hash': draft_hash(paths, bid)}
            buildings[bid].pop('refused', None)
        ready = [bid for bid, e in buildings.items() if e['status'] == 'reviewed']
        counts = {}
        for e in buildings.values():
            counts[e['status']] = counts.get(e['status'], 0) + 1
        budget = summary.get('budget') or {}
        lines = [', '.join(f'{n} {s}' for s, n in sorted(counts.items()))]
        if budget:
            lines.append(f'{budget.get("tokens", 0):,} tokens in {budget.get("calls", 0)} model calls, {budget.get("seconds", 0)} s.')
        idle = [bid for bid in current['building_ids'] if not buildings[bid]['steps'] and buildings[bid]['status'] != 'accepted']
        if idle and current['iteration'] > 1:
            lines.append('No automated step ran for ' + ', '.join(idle[:8]) +
                         ' (no repair round left). Use Hand to agent for further changes.')
        errors = [f'{bid}: {e["error"]}' for bid, e in buildings.items() if e.get('error')]
        lines += errors
        if summary.get('stopped'):
            lines.append(f'Stopped: {summary["stopped"]}. Retry to resume.')
        current.update(summary='\n'.join(lines), files=[], progress=100)
        from . import change_steps
        change_steps.worker_steps(current, [f'./town bake {current["site"]}, then commit the regenerated '
                                            f'data/{current["site"]}/ assets to local main'])
        if ready:
            current.update(status='pending_approval', error=None, worker_outcome='complete', worker_status='Ready for review',
                           review_warning='\n'.join(errors + ([f'Stopped: {summary["stopped"]}'] if summary.get('stopped') else [])) or None)
        elif all(e['status'] == 'accepted' for e in buildings.values()):
            current.update(status='failed', worker_outcome='complete', worker_status='Nothing to review',
                           error='Every building is already accepted with this draft; use Re-author for a new version.')
        else:
            current.update(status='failed', worker_outcome='blocked', worker_status='No reviewed draft',
                           error='\n'.join(lines[1:]) or 'No building reached review.')
        log(current['summary'])
        return queue._save(current)


# --- approval ----------------------------------------------------------------------

def _read(path):
    return (path.read_bytes(), stat.S_IMODE(path.stat().st_mode)) if path.is_file() else (None, None)


def _record_files(root, paths, bid):
    """Changed JSON/Markdown records of one building that Git already tracks, plus draft.json.

    Untracked scratch (author/repair/self-check/human-repair records, review.json,
    references.json, renders/*.json provenance, human-feedback.json) is never
    added: it holds model transcripts and absolute run paths. Images are gitignored.
    """
    from . import change_commit
    b = paths.building(bid)
    prefix = b.dir.relative_to(root).as_posix() + '/'
    listed = change_commit.git(root, 'ls-files', '-z', '--cached', '--', prefix)
    names = {n for n in listed.decode().split('\0') if n}
    if b.draft.is_file():
        names.add(b.draft.relative_to(root).as_posix())
    changes = []
    for name in sorted(names):
        if not name.endswith(('.json', '.md')):
            continue
        head, head_mode = change_commit.entry(root, 'HEAD', name)
        current, current_mode = _read(root / name)
        if head != current:
            changes.append((name, head, current, head_mode, current_mode))
    return changes


def _restore(before):
    """Put back overrides.json/site.json/frame_review.json as they were before an accept."""
    for path, (content, mode) in before.items():
        if content is None:
            path.unlink(missing_ok=True)
        else:
            path.write_bytes(content)
            path.chmod(mode)


def refusals(message):
    """{building id: reason} from author.accept's refusal text."""
    result = {}
    for line in str(message).splitlines()[1:]:
        bid, _, reason = line.strip().partition(': ')
        if reason:
            result.setdefault(bid, []).append(reason)
    return {bid: '; '.join(reasons) for bid, reasons in result.items()}


def approve(queue, record, ids=None, force=False):
    """Accept reviewed drafts, rebuild the scene and commit the delta to local main. Caller holds queue.lock."""
    author = _author()
    from . import change_commit
    if record['status'] != 'pending_approval':
        raise ValueError('Only a completed building job can be approved')
    root = queue.root
    paths = site_paths(root, record['site'])
    buildings = record.setdefault('buildings', {})
    remaining = [bid for bid in record['building_ids'] if not buildings.get(bid, {}).get('commit')]
    ids = remaining if not ids else validate_ids(ids)
    stray = [bid for bid in ids if bid not in record['building_ids']]
    if stray:
        raise ValueError(f'Not part of this job: {", ".join(stray)}')
    changed = [bid for bid in ids if 'draft_hash' in buildings.get(bid, {})
               and buildings[bid]['draft_hash'] != draft_hash(paths, bid)]
    if changed:
        raise ValueError(f'The draft of {", ".join(changed)} changed after this job finished, so it is not the draft '
                         'reviewed here. Send feedback (iterate) or re-run the job to review the current draft.')
    statuses = {bid: author.status(paths, bid) for bid in ids}
    eligible = [bid for bid in ids if statuses[bid] == 'reviewed' or (force and paths.building(bid).draft.is_file()
                                                                       and statuses[bid] not in ('accepted', 'failed'))]
    if not eligible:
        raise ValueError('No reviewed draft to approve' + (f': {", ".join(f"{b} is {s}" for b, s in statuses.items())}' if statuses else ''))
    tracked = [paths.overrides, paths.scene, paths.frame_review]
    before = {path: _read(path) for path in tracked}
    output = []
    try:
        author.accept(paths, eligible, rebuild=True, force=force, out=output.append)
    except ValueError as error:
        _restore(before)
        for bid, reason in refusals(error).items():
            if bid in buildings:
                buildings[bid]['refused'] = reason
        queue._save(record)
        raise ValueError(str(error) + '\nApprove anyway to publish regardless.') from None
    except BaseException:
        _restore(before)
        raise
    changes = []
    for path in tracked:
        content, mode = _read(path)
        if content != before[path][0]:
            changes.append((path.relative_to(root).as_posix(), before[path][0], content, before[path][1], mode or 0o644))
    for bid in eligible:
        changes += _record_files(root, paths, bid)
    label = eligible[0] if len(eligible) == 1 else f'{len(eligible)} buildings'
    message = f"Change #{record['number']}: accept {record['site']} {label}" + ('' if len(eligible) == 1 else '\n\n' + ' '.join(eligible))
    try:
        with change_commit.prepare(root, changes, message) as publish:
            integration = publish()
    except Exception:
        _restore(before)
        raise
    for bid in eligible:
        buildings.setdefault(bid, {}).update(commit=integration['commit'], status='accepted', forced=bool(force))
        buildings[bid].pop('refused', None)
    left = [bid for bid in record['building_ids'] if buildings.get(bid, {}).get('status') == 'reviewed'
            and not buildings[bid].get('commit')]
    record.setdefault('integration', {})['commits'] = [*record['integration'].get('commits', []), integration['commit']]
    if not left:
        record.update(status='approved', error=None,
                      integration={**record['integration'], **integration, 'applied_at': now()})
    for step in record.get('final_steps', []):
        if step['id'] == 'integration-blocker':
            step.update(done=True, completed_at=now())
    record['integration'].pop('error', None)
    return queue._save(record)


# --- escalation to a coding agent ---------------------------------------------------

def escalation_request(root, site, bid, note=''):
    info = details(root, site, bid)
    review = info.get('review') or {}
    issues = '\n'.join(f'- [{i.get("severity")}] {i.get("problem")} Fix: {i.get("fix")}' for i in review.get('issues') or [])
    feedback = '\n'.join(f'- {e["text"]}' for e in info.get('feedback', [])[-5:])
    name = info.get('name') or info.get('address') or f'structure {bid}'
    return f'''Improve the miniature of {name} (building {bid}) in {site}.

Edit data/{site}/buildings/{bid}/draft.json (schema: docs/BLUEPRINT_SCHEMA.md and docs/MINIATURE_KIT.md).
Iterate until it is a charming, recognizable caricature of the reference photographs:
  ./town lint {site} {bid}
  ./town render {site} {bid} --compare          # renders/compare-<face>.png beside each Street View photo
  ./town render {site} {bid} --iso
  ./town review {site} {bid} --record          # records review.json for the final draft
Look at every compare image yourself after each change; fix silhouette, roof, porch and entrance first.
The reference photos and previous renders are in data/{site}/buildings/{bid}/ (gitignored copies).
Attach the preview early:
  "$PIPELINE_PYTHON" "$TOWN_CHANGE_REPORTER" --site {site} --target {bid} --radius 60 --draft {bid}
Do not edit overrides.json or run town accept; approval of this change accepts the draft.

Current review: {review.get('verdict') or 'none'} — {review.get('summary') or 'no summary'}
{issues or '(no recorded issues)'}
{('Human feedback:' + chr(10) + feedback) if feedback else ''}
{('Note: ' + note.strip()) if note and note.strip() else ''}'''.strip() + '\n'


def copy_images(root, workspace, site, bid):
    """Copy the building's gitignored images into a snapshot (copies, so re-renders never write through)."""
    source = SitePaths(site, root).building(bid).dir
    target = SitePaths(site, workspace).building(bid).dir
    if not source.is_dir():
        return 0
    copied = 0
    for path in source.rglob('*'):
        if path.is_symlink() or not path.is_file() or path.suffix.lower() not in IMAGE_TYPES:
            continue
        destination = target / path.relative_to(source)
        if destination.exists():
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
        copied += 1
    return copied


def after_escalation(queue, record):
    """Once an escalated change is approved, accept its draft and commit overrides/site.json. Caller holds queue.lock."""
    author = _author()
    from . import change_commit, change_steps
    escalation = record['escalation']
    paths = site_paths(queue.root, escalation['site'])
    bid = escalation['id']
    tracked = [paths.overrides, paths.scene, paths.frame_review]
    before = {path: _read(path) for path in tracked}
    try:
        author.accept(paths, [bid], rebuild=True, out=lambda *_: None)
    except ValueError as error:
        _restore(before)
        record['final_steps'].insert(-1, {'id': 'accept-' + bid, 'source': 'queue', 'done': False,
                                          'text': f'./town accept {paths.name} {bid} (refused after approval: '
                                                  f'{str(error).splitlines()[-1].strip()}); add --force to publish anyway'})
        change_steps.prepare(record)
        return record
    except BaseException:
        _restore(before)
        raise
    after = {path: _read(path) for path in tracked}
    changes = [(p.relative_to(queue.root).as_posix(), before[p][0], after[p][0], before[p][1], after[p][1] or 0o644)
               for p in tracked if after[p][0] != before[p][0]]
    if changes:
        try:
            with change_commit.prepare(queue.root, changes, f"Change #{record['number']}: accept {paths.name} {bid}") as publish:
                record['integration']['accept_commit'] = publish()['commit']
        except Exception as error:
            _restore(before)
            record['final_steps'].insert(-1, {'id': 'accept-' + bid, 'source': 'queue', 'done': False,
                                              'text': f'./town accept {paths.name} {bid} and commit overrides.json and site.json ({error})'})
    change_steps.prepare(record)
    return record

