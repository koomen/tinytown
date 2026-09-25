"""Coding agents that can run a queued change: the OpenAI Codex CLI or Claude Code.

Each agent builds one non-interactive command for a workspace and reads its own
event log afterwards. The queue owns everything else (snapshots, environment,
reports, timeouts), so both agents run under identical rules.

    agent.command(binary, model, workspace, output, images) -> argv (prompt on stdin)
    agent.prompt_note(images) -> extra prompt text, or ''
    agent.finish(log, output) -> final message; raises RuntimeError when the run failed

Claude Code cannot attach images on the command line, so its prompt names the
copied screenshot files and the command grants read access to their directory.
"""
import json
import re
from pathlib import Path

MODEL_PATTERN = re.compile(r'[A-Za-z0-9][A-Za-z0-9._:\-\[\]]{0,79}')


def _events(log):
    for line in Path(log).read_text(errors='replace').splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if isinstance(event, dict):
            yield event


class Codex:
    name = 'codex'
    default_model = 'gpt-6-astra'
    default_binary = 'codex'

    def command(self, binary, model, workspace, output, images=()):
        command = [binary, 'exec', '--model', model, '--approve-for-me',
                   '-c', 'model_reasoning_effort="high"',
                   '--json', '--color', 'never', '--output-last-message', str(output),
                   '--cd', str(workspace)]
        for image in images:
            command.extend(['--image', str(image)])
        command.append('-')
        return command

    def prompt_note(self, images):
        return ''

    def finish(self, log, output):
        completed = False
        for event in _events(log):
            if event.get('type') in {'turn.failed', 'error'}:
                raise RuntimeError(str(event.get('error') or event.get('message') or 'Agent failed'))
            completed |= event.get('type') == 'turn.completed'
        if not completed:
            raise RuntimeError('Codex exited without completing a turn. See the agent log.')
        return Path(output).read_text() if Path(output).exists() else 'Agent completed. Review the diff and preview.'


class Claude:
    """`claude -p` with stream-json events.

    `--permission-mode auto` is Claude Code's counterpart of Codex's Approve for
    me: routine actions proceed and risky ones are classified automatically.
    `--permission-prompts none` denies anything that would still need a person,
    so a headless worker never waits on an invisible prompt.
    """
    name = 'claude'
    default_model = 'claude-opus-5-5'
    default_binary = 'claude'

    def command(self, binary, model, workspace, output, images=()):
        command = [binary, '-p', '--output-format', 'stream-json', '--verbose',
                   '--model', model, '--effort', 'high', '--permission-mode', 'auto',
                   '--permission-prompts', 'none', '--no-session-persistence']
        directories = sorted({str(Path(image).parent) for image in images})
        if directories:
            command.extend(['--add-dir', *directories])
        return command

    def prompt_note(self, images):
        if not images:
            return ''
        names = '\n'.join(f'  {Path(image)}' for image in images)
        return ('\nThe attached screenshots are image files; open each with the Read tool before starting:\n'
                + names + '\n')

    def finish(self, log, output):
        result = None
        for event in _events(log):
            if event.get('type') == 'result':
                result = event
        if result is None:
            raise RuntimeError('Claude Code exited without a result. See the agent log.')
        text = result.get('result') if isinstance(result.get('result'), str) else ''
        if text:
            Path(output).write_text(text)
        if result.get('is_error') or result.get('subtype') not in (None, 'success'):
            reason = text or result.get('subtype') or 'Agent failed'
            errors = result.get('errors')
            if isinstance(errors, list) and errors:
                reason = '; '.join(str(e) for e in errors)
            raise RuntimeError(str(reason))
        return text or 'Agent completed. Review the diff and preview.'


AGENTS = {'codex': Codex(), 'claude': Claude()}


def agent(name):
    try:
        return AGENTS[name or 'codex']
    except KeyError:
        raise ValueError(f'Unknown agent {name!r}; choose {" or ".join(AGENTS)}') from None


def validate_model(model):
    if model is None:
        return None
    if not isinstance(model, str) or not MODEL_PATTERN.fullmatch(model):
        raise ValueError('Model must be a model id or alias, e.g. gpt-6-astra or claude-opus-5-5')
    return model
