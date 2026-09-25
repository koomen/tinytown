"""Persistent integration checklist; checking a step records work, never runs it."""
import hashlib


def prepare(record):
    steps = record.setdefault('final_steps', [])
    integration = record.setdefault('integration', {'target_branch': 'main'})
    legacy_approval = record['status'] == 'approved' and not integration.get('commit')
    if legacy_approval:
        # Older approvals predate the checklist and commit tracking. Missing
        # metadata is not evidence of unfinished work. Remove only backfilled
        # obligations, retaining explicit follow-ups and recorded completions.
        steps[:] = [step for step in steps if not (
            step.get('source') == 'queue' and step['id'] in {'plan', 'main'} and not step['done'])]
    defaults = [
        ('plan', 'Record any remaining rebuilds, checks, or other steps before merging.'),
        ('apply', 'Approve and apply this change to the local checkout.'),
        ('main', 'Commit the approved source change to local main.'),
    ]
    for step_id, text in defaults:
        if legacy_approval and step_id in {'plan', 'main'}:
            continue
        if not any(step['id'] == step_id for step in steps):
            steps.append({'id': step_id, 'text': text, 'done': False, 'source': 'queue'})
    for step in steps:
        if step['id'] == 'apply':
            step['done'] = record['status'] == 'approved'
        elif step['id'] == 'plan' and not legacy_approval:
            step['done'] = record.get('final_steps_iteration') == record['iteration']
        elif step['id'] == 'main' and record.get('integration', {}).get('commit'):
            step['done'] = True
    return record


def worker_steps(record, texts):
    prepare(record)
    previous = {step['id']: step for step in record['final_steps']
                if step.get('iteration') == record['iteration']}
    steps = [step for step in record['final_steps'] if step['source'] != 'worker']
    for text in dict.fromkeys(text.strip() for text in texts):
        step_id = 'worker-' + hashlib.sha256(text.encode()).hexdigest()[:12]
        steps.insert(-1, previous.get(step_id) or {
            'id': step_id, 'text': text, 'done': False,
            'source': 'worker', 'iteration': record['iteration'],
        })
    record['final_steps'] = steps
    record['final_steps_iteration'] = record['iteration']
    prepare(record)


def reset(record):
    for step in record.get('final_steps', []):
        step['done'] = False
        step.pop('completed_at', None)
    record.pop('final_steps_iteration', None)
    prepare(record)
