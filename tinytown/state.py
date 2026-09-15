"""Fingerprints, atomic JSON, hash-bound patches, and derived per-building status.

Standard library only; imported on the deploy path.
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def building_frame(site, building):
    # Include the geographic origin: otherwise a moved site could accidentally
    # reuse captures or a model from an unrelated footprint at the same x/z.
    return fingerprint({"center": site.get("center"), "obb": building["obb"], "pts": building["pts"]})


def read_json(path, default=None):
    path = Path(path)
    if not path.is_file():
        return default
    return json.loads(path.read_text())


def atomic_json(path, value, compact=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as stream:
        temp = Path(stream.name)
        json.dump(value, stream, **({'separators': (',', ':')} if compact else {'indent': 1}))
        stream.write("\n")
    try:
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def atomic_text(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as stream:
        temp = Path(stream.name)
        stream.write(text)
    try:
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def pending_faces(index, selected, out_dir, force=False, retry_missing=False):
    """Resume faces independently; a missing image is never treated as complete."""
    if force:
        return list(selected)
    pending = []
    for face in selected:
        record = (index or {}).get("faces", {}).get(face)
        if not record:
            pending.append(face)
            continue
        photos = record.get("photos", [])
        if record.get("coverage"):
            if not photos or any(not (Path(out_dir) / p["file"]).is_file() for p in photos):
                pending.append(face)
        elif retry_missing or record.get("status") != "no-coverage":
            pending.append(face)
    return pending


# --- hash-bound JSON patches -------------------------------------------------

def _index(container, key, append=False):
    if isinstance(container, dict):
        return key
    if not isinstance(container, list):
        raise ValueError('patch path traverses a scalar')
    if key.startswith('@'):
        matches = [i for i, value in enumerate(container) if isinstance(value, dict) and value.get('id') == key[1:]]
        if len(matches) != 1:
            raise ValueError(f'patch selector {key} must match exactly one item')
        return matches[0]
    if key == '-' and append:
        return len(container)
    if not re.fullmatch(r'0|[1-9][0-9]*', key):
        raise ValueError('invalid array index')
    value = int(key)
    if value >= len(container) + int(append):
        raise ValueError('array index outside artifact')
    return value


def apply_patch(base, patch):
    """Apply add/remove/replace operations bound to the base's fingerprint."""
    if not isinstance(patch, dict):
        raise ValueError('patch must be an object')
    if patch.get('base_hash') != fingerprint(base):
        raise ValueError('patch belongs to a different artifact; use current-artifacts.json hashes')
    result = copy.deepcopy(base)
    operations = patch.get('operations')
    if not isinstance(operations, list):
        raise ValueError('patch requires an operations array')
    for operation in operations:
        if not isinstance(operation, dict):
            raise ValueError('each patch operation must be an object')
        op, path = operation.get('op'), operation.get('path', '')
        if op not in ('add', 'remove', 'replace') or not isinstance(path, str) or not path.startswith('/'):
            raise ValueError('patch requires add/remove/replace and a non-root JSON pointer')
        parts = [x.replace('~1', '/').replace('~0', '~') for x in path[1:].split('/')]
        parent = result
        try:
            for part in parts[:-1]:
                parent = parent[_index(parent, part)]
            key = _index(parent, parts[-1], append=op == 'add')
            if op == 'remove':
                del parent[key]
            elif op == 'add' and isinstance(parent, list):
                parent.insert(key, copy.deepcopy(operation['value']))
            else:
                if op == 'replace':
                    parent[key]  # must already exist
                parent[key] = copy.deepcopy(operation['value'])
        except (KeyError, IndexError, TypeError) as exc:
            raise ValueError(f'invalid patch target {path}: {exc}') from exc
    if not isinstance(result, dict):
        raise ValueError('artifact must remain an object')
    return result


# --- derived building status -------------------------------------------------

STATUSES = ('unreferenced', 'referenced', 'drafted', 'needs-repair', 'reviewed', 'accepted', 'failed')


def building_status(paths, bid, overrides=None, max_repairs=2):
    """Derive a structure's status from the files under buildings/<id>/.

    See docs/ARCHITECTURE.md. `overrides` may be passed to avoid re-reading it
    for every building.
    """
    b = paths.building(bid)
    author = read_json(b.author) or {}
    if author.get('error') and author.get('terminal'):
        return 'failed'
    draft = read_json(b.draft)
    if draft is None:
        if b.fronts.is_file() or b.aerial.is_file() or b.references.is_file():
            return 'referenced'
        return 'unreferenced'
    digest = fingerprint(draft)
    if overrides is None:
        overrides = read_json(paths.overrides) or {}
    accepted = (overrides.get('blueprints') or {}).get(str(bid))
    if accepted is not None and fingerprint(accepted) == digest:
        return 'accepted'
    review = read_json(b.review)
    if not review or review.get('draft_hash') != digest:
        return 'drafted'
    if review.get('passed'):
        return 'reviewed'
    repairs = sum(1 for n in range(1, max_repairs + 1) if b.repair(n).is_file())
    return 'reviewed' if repairs >= max_repairs else 'needs-repair'


def site_status(paths, max_repairs=2):
    overrides = read_json(paths.overrides) or {}
    return {bid: building_status(paths, bid, overrides, max_repairs) for bid in paths.building_ids()}


def register(subparsers):
    p = subparsers.add_parser('status', help='per-building status of a miniature')
    p.add_argument('site')
    p.add_argument('--ids', nargs='*', help='limit to these structure ids')
    p.set_defaults(run=_run_status)


def _run_status(args):
    from collections import Counter
    from .paths import site_paths
    paths = site_paths(args.site)
    table = site_status(paths)
    if args.ids:
        table = {bid: table.get(bid, 'unreferenced') for bid in args.ids}
    for bid, status in sorted(table.items(), key=lambda kv: (STATUSES.index(kv[1]), kv[0])):
        print(f'{status:13} {bid}')
    counts = Counter(table.values())
    print(' '.join(f'{name}={counts[name]}' for name in STATUSES if counts[name]) or 'no buildings')
    return 0
