"""Worker report command, also copied into old workspaces as a standalone script.

Only writes the current pass's report file. No queue database or HTTP access.
"""
import argparse
import fcntl
import json
import math
import os
from pathlib import Path
import sys
import tempfile

LIMIT = 32000
FIELDS = {'iteration', 'revision', 'status', 'progress', 'preview', 'preview_revision', 'outcome', 'title', 'summary'}


def validate_report(value):
    if not isinstance(value, dict) or set(value) - FIELDS:
        raise ValueError('Unknown worker report fields')
    for key in ('iteration', 'revision'):
        if type(value.get(key)) is not int or value[key] < 0:
            raise ValueError(f'{key} must be a nonnegative integer')
    if 'preview_revision' in value and (type(value['preview_revision']) is not int or
            not 0 <= value['preview_revision'] <= value['revision']):
        raise ValueError('Invalid preview revision')
    for key, limit in (('status', 1000), ('title', 140), ('summary', 12000)):
        if key in value and (not isinstance(value[key], str) or not value[key].strip() or len(value[key]) > limit):
            raise ValueError(f'{key} must be nonempty text, up to {limit} characters')
    progress = value.get('progress')
    if progress is not None and (type(progress) not in (int, float) or not math.isfinite(progress) or not 0 <= progress <= 100):
        raise ValueError('Progress must be between 0 and 100')
    if value.get('outcome', 'working') not in {'working', 'complete', 'blocked'}:
        raise ValueError('Outcome must be working, complete, or blocked')
    if value.get('preview') is not None and not isinstance(value['preview'], dict):
        raise ValueError('Preview must be an object or null')
    return value


def preview_spec(args):
    if getattr(args, 'whole_map', False):
        if getattr(args, 'asset', None):
            raise ValueError('Choose --whole-map or --asset')
        return {'site': args.site, 'whole_map': True}
    if getattr(args, 'asset', None):
        return {'asset': {'module': args.asset, 'export': args.export}}
    if getattr(args, 'target', None) or getattr(args, 'center', None):
        spec = {'site': args.site, 'radius': args.radius}
        if args.target:
            spec['target'] = args.target
        if getattr(args, 'center', None):
            spec['center'] = [float(n) for n in args.center.split(',')]
        return spec
    return None


def preview_flags(parser):
    parser.add_argument('--site', default='avon-extended')
    parser.add_argument('--target', help='Building id, address, or landmark name')
    parser.add_argument('--center', help='Local scene x,z in metres')
    parser.add_argument('--radius', type=float, default=60)
    parser.add_argument('--asset', help='JS module exporting a preview factory')
    parser.add_argument('--export', default='preview')
    parser.add_argument('--whole-map', action='store_true', help='Preview the entire town from source')


def report_flags(parser):
    parser.add_argument('--status', help='Current activity, e.g. "Checking roof geometry"')
    parser.add_argument('--progress', type=float, help='Estimated percent complete, 0–100')
    parser.add_argument('--title', help='Short descriptive change title')
    parser.add_argument('--summary', help='Current findings or final summary')
    parser.add_argument('--outcome', choices=['working', 'complete', 'blocked'])
    parser.add_argument('--clear-preview', action='store_true')
    preview_flags(parser)


def publish(args):
    name = os.environ.get('TOWN_CHANGE_REPORT')
    if not name or not os.environ.get('TOWN_CHANGE_ITERATION'):
        raise ValueError('This command runs inside a queued worker; no worker report context is set')
    path = Path(name)
    if path.is_symlink() or path.parent.is_symlink():
        raise ValueError('Worker report must not be a symlink')
    iteration = int(os.environ['TOWN_CHANGE_ITERATION'])
    with path.with_suffix('.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with path.open('rb') as stream:
            raw = stream.read(LIMIT + 1)
        if len(raw) > LIMIT:
            raise ValueError('Worker report exceeds 32 KB')
        report = validate_report(json.loads(raw))
        if report['iteration'] != iteration:
            raise ValueError('This worker pass has ended; the report belongs to a different iteration')
        for key in ('status', 'progress', 'title', 'summary', 'outcome'):
            if getattr(args, key, None) is not None:
                report[key] = getattr(args, key)
        spec = preview_spec(args)
        if spec is not None and args.clear_preview:
            raise ValueError('Choose a preview or --clear-preview, not both')
        report['revision'] += 1
        if spec is not None or args.clear_preview:
            report['preview'] = spec
            report['preview_revision'] = report['revision']
        encoded = json.dumps(validate_report(report), allow_nan=False).encode()
        if len(encoded) > LIMIT:
            raise ValueError('Worker report exceeds 32 KB')
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(encoded)
            os.replace(temporary, path)
        finally:
            if temporary:
                temporary.unlink(missing_ok=True)
    result = {'report': report, 'change_id': os.environ.get('TOWN_CHANGE_ID')}
    if report.get('preview'):
        result['preview_url'] = os.environ.get('TOWN_CHANGE_PREVIEW_URL')
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description='Publish live progress for the current queued change')
    report_flags(parser)
    args = parser.parse_args(argv)
    try:
        print(json.dumps(publish(args), indent=2))
        return 0
    except (ValueError, OSError) as error:
        print(f'Worker report: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
