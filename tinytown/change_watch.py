"""Watch queue state without retaining an HTTP connection or changing jobs."""
import json
import sys
import time

TERMINAL = {'pending_approval', 'approved', 'failed', 'cancelled', 'discarded'}


def watch(fetch, *, interval=2, timeout=0, as_json=False):
    if not 1 <= interval <= 60 or timeout < 0:
        raise ValueError('Use an interval of 1–60 seconds and a nonnegative timeout')
    deadline = time.monotonic() + timeout if timeout else None
    previous = None
    try:
        while True:
            response = fetch()
            records = response.get('changes', [response] if 'id' in response else [])
            values = [{key: record.get(key) for key in (
                'id', 'number', 'title', 'status', 'iteration', 'worker_status', 'progress',
                'preview_url', 'map_url', 'review_warning', 'error', 'report_error',
                'summary', 'final_steps', 'integration')} for record in records]
            signature = json.dumps(values, sort_keys=True)
            if signature != previous:
                if as_json:
                    print(json.dumps({'changes': values}), flush=True)
                elif not values:
                    print('No changes.', flush=True)
                else:
                    for record in values:
                        print(f"#{record['number']} {record['title']} — {record['status']}"
                              + (f" · {record['worker_status']}" if record['worker_status'] else ''), flush=True)
                        for key in ('preview_url', 'map_url', 'review_warning', 'error', 'report_error'):
                            if record[key]:
                                print(f'  {key}: {record[key]}', flush=True)
                        if record['status'] in TERMINAL:
                            if record['summary']:
                                print(record['summary'], flush=True)
                            if (record['integration'] or {}).get('commit'):
                                print(f"  Local main: {record['integration']['commit']}", flush=True)
                            for step in record['final_steps'] or []:
                                print(f"  [{'x' if step['done'] else ' '}] {step['id']}: {step['text']}", flush=True)
                previous = signature
            if all(record['status'] in TERMINAL for record in records):
                return 0
            if deadline is not None and time.monotonic() >= deadline:
                print('Watch timed out; jobs continue in the background.', file=sys.stderr, flush=True)
                return 124
            time.sleep(min(interval, max(0, deadline - time.monotonic())) if deadline is not None else interval)
    except KeyboardInterrupt:
        return 130
