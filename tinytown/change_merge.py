"""Three-way source merges; ambiguous changes are left for an isolated repair pass."""
import json
from pathlib import Path
import subprocess
import tempfile


class Conflict(ValueError):
    pass


MISSING = object()


def value(base, current, task):
    if current == task or task == base:
        return current
    if current == base:
        return task
    if all(isinstance(v, dict) for v in (base, current, task)):
        merged = {}
        for key in dict.fromkeys([*current, *task, *base]):
            result = value(base.get(key, MISSING), current.get(key, MISSING), task.get(key, MISSING))
            if result is not MISSING:
                merged[key] = result
        return merged
    # Collections with stable ids (buildings, landmarks) can merge separately.
    if all(isinstance(v, list) for v in (base, current, task)):
        def keyed(items):
            if not all(isinstance(item, dict) and isinstance(item.get('id'), (str, int)) for item in items):
                raise Conflict('Overlapping list edits')
            result = {str(item['id']): item for item in items}
            if len(result) != len(items):
                raise Conflict('Duplicate ids')
            return result
        return list(value(keyed(base), keyed(current), keyed(task)).values())
    raise Conflict('Overlapping edits')


def content(name, base, current, task):
    if current == task or task == base:
        return current
    if current == base:
        return task
    if None in (base, current, task):
        raise Conflict('Concurrent addition or deletion')
    if name.endswith('.json'):
        try:
            result = value(*(json.loads(v) for v in (base, current, task)))
            return (json.dumps(result, indent=2, ensure_ascii=False) + '\n').encode()
        except (UnicodeError, json.JSONDecodeError) as error:
            raise Conflict('Invalid JSON') from error
    if any(b'\0' in v for v in (base, current, task)):
        raise Conflict('Binary edits')
    with tempfile.TemporaryDirectory(prefix='town-merge-') as directory:
        paths = [Path(directory) / name for name in ('current', 'base', 'task')]
        for path, data in zip(paths, (current, base, task)):
            path.write_bytes(data)
        result = subprocess.run(['git', 'merge-file', '-p', *map(str, paths)], capture_output=True)
        if result.returncode:
            raise Conflict('Overlapping text edits')
        return result.stdout
