"""Local change queue: independent Codex workspaces, human review and live previews.

This development service is separate from the static deployment/authoring path.
It uses Git and the installed Codex; screenshot uploads also use Pillow.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import http.server
import json
import mimetypes
import os
from pathlib import Path
import shutil
import signal
import socket
import sqlite3
import stat
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.request import Request, urlopen
import uuid

from .paths import ROOT, ChangePaths
from . import change_worker, change_images, change_bakes, change_merge

PORT = 8735
MODEL = 'gpt-6-astra'
TERMINAL = {'pending_approval', 'approved', 'failed', 'cancelled', 'discarded'}


def now():
    return datetime.now(timezone.utc).isoformat()


def process_identity(pid):
    """A start time plus command guards recovery against a reused OS process id."""
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'lstart=', '-o', 'command='],
                            capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def stop_saved_worker(record):
    pid, identity = record.get('worker_pid'), record.get('worker_identity')
    if not pid or not identity or process_identity(pid) != identity:
        return
    try:
        if os.getpgid(pid) != pid:
            return
        os.killpg(pid, signal.SIGTERM)
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline and process_identity(pid) == identity:
            time.sleep(.05)
        if process_identity(pid) == identity:
            os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def public_record(record):
    result = {**{key: value for key, value in record.items()
            if key not in {'baseline_modes', 'worker_pid', 'worker_identity', 'worker_revision', 'worker_preview_revision'}},
            'map_url': f'/previews/{record["id"]}/map/'}
    if 'bake' in result:
        result['bake'] = {k: v for k, v in result['bake'].items() if k not in {'worker_pid', 'worker_identity'}}
    return result


def git(workspace, *args, text=True):
    return subprocess.run(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(workspace), *args],
                          check=True, capture_output=True, text=text).stdout


def source_file(name):
    """Keep source snapshots small and exclude local state and generated bakes."""
    parts = Path(name).parts
    return bool(parts) and not any(p in {'.git', '.venv', 'node_modules', '__pycache__',
        'runs', 'dist', '.town-cache', '.wrangler'} for p in parts) and not any(
        p.startswith('.env') for p in parts) and not (
        parts[0] == 'data' and ('stream' in parts or Path(name).name.startswith('surfaces')))


def safe_path(root, name):
    root = Path(root).resolve()
    path = root / name
    if Path(name).is_absolute() or '..' in Path(name).parts or not source_file(name):
        raise ValueError(f'Not an editable source path: {name}')
    if any(parent.is_symlink() for parent in [path, *path.parents] if parent != root and parent.is_relative_to(root)):
        raise ValueError(f'Symlinks are not editable source paths: {name}')
    if not path.resolve().is_relative_to(root):
        raise ValueError(f'Path outside the workspace: {name}')
    return path


def validate_preview(root, spec):
    if spec is None:
        return None
    from . import preview
    return preview.validate_spec(root, spec)


class ChangeQueue(change_bakes.Bakes):
    def __init__(self, root=ROOT, workers=2, binary='codex', timeout=3600):
        self.root = Path(root).resolve()
        self.paths = ChangePaths(self.root)
        self.paths.directory.mkdir(parents=True, exist_ok=True)
        self.workers = max(1, min(int(workers), 8))
        self.binary, self.timeout = binary, timeout
        self.lock = threading.RLock()
        self.halt = threading.Event()
        self.threads, self.processes, self.active = [], {}, set()
        self.bake_process = None
        self.base_url = None
        with self.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS changes (id TEXT PRIMARY KEY, record TEXT NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS previews (id TEXT PRIMARY KEY, spec TEXT NOT NULL)')
            db.execute('CREATE TABLE IF NOT EXISTS change_numbers (number INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL)')
            # Old requests receive numbers in creation order, once. Updating a
            # job never changes its number, including across server restarts.
            records = [json.loads(row[0]) for row in db.execute('SELECT record FROM changes')]
            for record in sorted(records, key=lambda r: (r['created_at'], r['id'])):
                if db.execute('SELECT 1 FROM change_numbers WHERE id=?', (record['id'],)).fetchone() is None:
                    db.execute('INSERT INTO change_numbers (id) VALUES (?)', (record['id'],))

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.paths.database, timeout=30)
        try:
            with db:
                yield db
        finally:
            db.close()

    def _save(self, record):
        record['updated_at'] = now()
        with self.db() as db:
            row = db.execute('SELECT number FROM change_numbers WHERE id=?', (record['id'],)).fetchone()
            if row is None:
                number = db.execute('INSERT INTO change_numbers (id) VALUES (?)', (record['id'],)).lastrowid
            else:
                number = row[0]
            record['number'] = number
            db.execute('INSERT OR REPLACE INTO changes VALUES (?, ?)',
                       (record['id'], json.dumps(record)))
        return record

    def list(self):
        with self.db() as db:
            records = [dict(json.loads(row[0]), number=row[1]) for row in db.execute(
                'SELECT record, number FROM changes JOIN change_numbers USING (id) ORDER BY number')]
        return records

    def get(self, change_id, detail=False):
        reference = str(change_id).removeprefix('#')
        with self.db() as db:
            # UUIDs remain valid, including the rare all-digit 12-character ID.
            row = db.execute('SELECT record, number FROM changes JOIN change_numbers USING (id) WHERE id=?', (reference,)).fetchone()
            if row is None and reference.isascii() and reference.isdigit() and 0 < int(reference) < 2**63:
                row = db.execute('SELECT record, number FROM changes JOIN change_numbers USING (id) WHERE number=?', (int(reference),)).fetchone()
        if not row:
            raise ValueError('Unknown change')
        record = dict(json.loads(row[0]), number=row[1])
        directory = self.paths.change(record['id'])
        if detail:
            record = self.bake_info(record)
            if record.get('bake'):
                bake_log = self.paths.bake(record['id'], record['bake']['id']) / 'bake.log'
                if bake_log.is_file():
                    with bake_log.open('rb') as stream:
                        stream.seek(max(0, bake_log.stat().st_size - 30000))
                        record['bake_log'] = stream.read().decode(errors='replace')
            log = directory / f"iteration-{record['iteration']}.jsonl"
            if log.exists():
                with log.open('rb') as stream:
                    stream.seek(max(0, log.stat().st_size - 60000))
                    record['log'] = stream.read().decode(errors='replace')
            else:
                record['log'] = ''
            diff = directory / 'change.patch'
            record['diff'] = diff.read_text(errors='replace')[:200000] if diff.exists() else ''
        return record

    def _save_with_images(self, record, uploads):
        """Called under the queue lock: validate the full batch before publishing."""
        images = change_images.decode_uploads(uploads, record.get('attachments', []))
        written = []
        record.setdefault('attachments', [])
        try:
            for metadata, data in images:
                path = self.paths.attachment(record['id'], metadata)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                written.append(path)
                metadata.update(url=f'/api/changes/{record["id"]}/attachments/{metadata["id"]}',
                                iteration=record['iteration'])
                record['attachments'].append(metadata)
            return self._save(record)
        except Exception:
            for path in written:
                path.unlink(missing_ok=True)
            raise

    def add_attachments(self, change_id, attachments):
        if not attachments:
            raise ValueError('Choose screenshots to attach')
        with self.lock:
            record = self.get(change_id)
            if record['status'] == 'approved':
                raise ValueError('This change has already been applied')
            return self._save_with_images(record, attachments)

    def get_attachment(self, change_id, attachment_id):
        record = self.get(change_id)
        attachment = next((item for item in record.get('attachments', []) if item['id'] == attachment_id), None)
        if attachment is None:
            raise ValueError('Unknown screenshot')
        return self.paths.attachment(record['id'], attachment), attachment['mime']

    def create(self, request, title=None, preview=None, attachments=None):
        if not isinstance(request, str) or not request.strip():
            raise ValueError('Describe the requested change')
        if len(request) > 50000:
            raise ValueError('Request is too long (maximum 50,000 characters)')
        if title is not None and not isinstance(title, str):
            raise ValueError('Title must be text')
        spec = validate_preview(self.root, preview)
        change_id = uuid.uuid4().hex[:12]
        record = dict(id=change_id, title=(title or request.strip().splitlines()[0])[:140],
                      request=request.strip(), status='queued', created_at=now(), iteration=1,
                      model=MODEL, summary='', error=None, files=[], feedback=[], preview=spec,
                      worker_status='', progress=None, worker_outcome='working', report_error=None,
                      preview_url=f'/previews/{change_id}/' if spec else None)
        with self.lock:
            return self._save_with_images(record, attachments)

    def iterate(self, change_id, feedback, attachments=None):
        if not isinstance(feedback, str) or not feedback.strip() or len(feedback) > 50000:
            raise ValueError('Enter feedback (up to 50,000 characters)')
        with self.lock:
            record = self.get(change_id)
            if record['status'] not in {'pending_approval', 'failed', 'cancelled'}:
                raise ValueError('Wait for the current pass to finish before iterating')
            record['feedback'].append({'text': feedback.strip(), 'at': now()})
            record.update(status='queued', iteration=record['iteration'] + 1, error=None,
                          worker_status='', progress=None, worker_outcome='working', report_error=None, review_warning=None)
            return self._save_with_images(record, attachments)

    def retry(self, change_id):
        with self.lock:
            record = self.get(change_id)
            if record['status'] not in {'failed', 'cancelled', 'discarded'}:
                raise ValueError('Only failed, cancelled, or discarded changes can be retried')
            record.update(status='queued', iteration=record['iteration'] + 1, error=None,
                          worker_status='', progress=None, worker_outcome='working', report_error=None, review_warning=None)
            return self._save(record)

    @staticmethod
    def _terminate(process):
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
            except ProcessLookupError:
                pass

    def cancel(self, change_id):
        with self.lock:
            record = self.get(change_id)
            if record['status'] not in {'queued', 'running'}:
                raise ValueError('Only queued or running changes can be cancelled')
            record['status'] = 'cancelled'
            self._save(record)
            process = self.processes.get(record['id'])
            if process:
                self._terminate(process)
            return record

    def set_preview(self, change_id, spec):
        with self.lock:
            record = self.get(change_id)
            workspace = self.paths.workspace(record['id'])
            record['preview'] = validate_preview(workspace if workspace.exists() else self.root, spec)
            record['preview_url'] = f'/previews/{record["id"]}/' if spec else None
            return self._save(record)

    def discard(self, change_id):
        """Archive without applying files; keep the workspace available for restore."""
        with self.lock:
            record = self.get(change_id)
            if record['status'] == 'approved':
                raise ValueError('This change has already been applied; discard cannot undo it')
            if record['status'] == 'discarded':
                return record
            record['status'] = 'discarded'
            self._save(record)
            process = self.processes.get(record['id'])
            if process:
                self._terminate(process)
            return record

    def create_preview(self, spec):
        spec = validate_preview(self.root, spec)
        if not spec:
            raise ValueError('Specify a preview target')
        preview_id = uuid.uuid4().hex[:12]
        with self.db() as db:
            db.execute('INSERT INTO previews VALUES (?,?)', (preview_id, json.dumps(spec)))
        return {'id': preview_id, 'url': f'/previews/{preview_id}/', 'preview': spec}

    def preview_context(self, preview_id):
        self.paths.change(preview_id)  # validate ID before any path access
        with self.db() as db:
            row = db.execute('SELECT spec FROM previews WHERE id=?', (preview_id,)).fetchone()
        if row:
            return self.root, json.loads(row[0])
        record = self.get(preview_id)
        if not record['preview']:
            raise ValueError('This change has no preview yet')
        workspace = self.paths.workspace(preview_id)
        # A partial snapshot must not render. Baseline means snapshot is complete.
        return (workspace if record.get('baseline') else self.root), record['preview']

    def map_context(self, change_id, site=None):
        from . import config
        record = self.get(change_id)
        root = self.paths.workspace(record['id']) if record.get('baseline') else self.root
        sites = config.all_sites(root)
        site = site or (record.get('preview') or {}).get('site')
        if not site:
            site = next((name for name in sites if any(p.get('route') == '/' for p in config.site_config(name, root)['deploy'])), sites[0] if sites else None)
        if site not in sites:
            raise ValueError('Choose an available town for the whole map')
        return root, {'site': site, 'whole_map': True}

    def _snapshot(self, record):
        workspace = self.paths.workspace(record['id'])
        if record.get('baseline'):
            if not (workspace / '.git').is_dir():
                raise ValueError('The saved workspace is missing; its changes cannot be recovered')
            return workspace
        if workspace.exists():
            shutil.rmtree(workspace)  # only an incomplete snapshot owned by this queue
        baseline_modes = self._copy_source(self.root, workspace)
        self._init_snapshot(workspace)
        record['baseline'] = git(workspace, 'rev-parse', 'HEAD').strip()
        record['baseline_modes'] = baseline_modes
        with self.lock:
            current = self.get(record['id'])
            current['baseline'] = record['baseline']
            current['baseline_modes'] = baseline_modes
            self._save(current)
        return workspace

    def _copy_source(self, root, workspace):
        workspace.mkdir(parents=True, exist_ok=True)
        names = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0')
        baseline_modes = {}
        for name in sorted(set(names)):
            if not source_file(name):
                continue
            source = safe_path(root, name)
            if source.is_file():
                target = workspace / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                baseline_modes[name] = stat.S_IMODE(source.stat().st_mode)
        return baseline_modes

    @staticmethod
    def _init_snapshot(workspace):
        git(workspace, 'init', '-q')
        with (workspace / '.git/info/exclude').open('a') as stream:
            stream.write('\n/runs/\n')
        git(workspace, 'config', 'user.name', 'TinyTown change queue')
        git(workspace, 'config', 'user.email', 'changes@localhost')
        git(workspace, 'add', '-A')
        git(workspace, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Current checkout snapshot', '--allow-empty')

    def _prompt(self, record):
        history = '\n\n'.join(f"Feedback {i+1}: {f['text']}" for i, f in enumerate(record['feedback']))
        images = '\n'.join(f"Image {i+1}: {item['name']} (attached during pass {item['iteration']})"
                           for i, item in enumerate(record.get('attachments', [])))
        return f'''Complete this TinyTown change autonomously in this isolated workspace.
Read CLAUDE.md and docs/ARCHITECTURE.md. Make reasonable decisions without asking the user questions.
Implement the request fully, run relevant tests and visually inspect when useful.
Permission requests are handled by Codex Auto-review, not by the user. When a browser,
local server, or required test hits a sandbox restriction, request tool escalation with
a specific justification. Do not disable Chromium's sandbox or bypass Codex safeguards.
Use the repository's private browser harness. Its installed runtime is available at
TOWN_BROWSER_RUNTIME; create a symlink to it at runs/headless-browser/runtime if needed.
Keep browser state/profiles inside this workspace and use PIPELINE_PYTHON for Python.
Do not commit, push, deploy, bake the whole town, or edit outside this workspace.
This workspace is a snapshot including the user's uncommitted edits; preserve unrelated work.
Generated streaming/surface bakes are intentionally omitted. Live previews render source directly.
TOWN_CHANGE_MAP_URL opens this task's last successful world bake, independently of the
live close-up preview. The dashboard's Bake world action builds an isolated source snapshot.
If this is a merge repair, read runs/change-worker/merge.json and its base/current/task files.
Preserve the already-approved checkout changes AND the requested task changes. The workspace
baseline is now the current checkout. Resolve conflicts, run relevant checks, and return for
review; do not apply to the parent checkout. Never merely choose one side of a conflict.
Your final response must summarize changes, tests, and any remaining limitations honestly.
If a check remains blocked, preserve your edits and report the exact unchecked part.
The user can still review and approve saved edits; do not claim blocked checks passed.
A previous pass may have already edited this workspace. Continue from its current files.

Publish a short live status when you start and when the activity changes:
  "$PIPELINE_PYTHON" "$TOWN_CHANGE_REPORTER" --status "Inspecting the building" --progress 10
This command writes a local report; it does not need network access. Update the title if useful with --title.
For visual work, choose and attach a preview early; the command prints its stable URL:
  "$PIPELINE_PYTHON" "$TOWN_CHANGE_REPORTER" --site avon-extended --target "75 South Avenue" --radius 60
Replace the example with the actual town and property/landmark or use --center=x,z.
For assets, use --asset tinytown/web/preview-assets.js --export tree (also bench, playground, fountain),
or create a JS module under src/ exporting preview({{THREE}}) that returns an Object3D or {{group}}.
Use --asset src/your-preview.js --export preview to attach that module. Change the target whenever needed.
Do not start a separate queue server or write to its database. The queue derives the preview URL from your task id.
At completion report --outcome complete --status "Tests passed" --progress 100 only if true.
If blocked, report --outcome blocked --status "The specific blocker" before your final response.
Reports cannot approve/apply changes; successful process exit is still required for review.

Requested change #{record.get('number', record['id'])}: {record['request']}

Preview: {json.dumps(record['preview'])}
Attached screenshots (in image order; use these as reference for the request and feedback):
{images or 'None'}
{history}
'''

    def _prepare_report(self, record):
        from .state import atomic_json
        path = self.paths.worker_report(record['id'])
        workspace = self.paths.workspace(record['id'])
        if any(p.is_symlink() for p in (path, path.parent, path.parent.parent,
                                        self.paths.worker_reporter(record['id']))):
            raise ValueError('Worker report paths must not be symlinks')
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(change_worker.__file__, self.paths.worker_reporter(record['id']))
        runtime = self.paths.worker_browser_state(record['id']) / 'runtime'
        if runtime.parent.is_symlink():
            raise ValueError('Worker browser state must not be a symlink')
        if self.paths.browser_runtime.is_dir() and not runtime.exists() and not runtime.is_symlink():
            runtime.parent.mkdir(parents=True, exist_ok=True)
            runtime.symlink_to(self.paths.browser_runtime, target_is_directory=True)
        # Exclude reporting metadata even when a task changes .gitignore.
        with (workspace / '.git/info/exclude').open('a') as stream:
            stream.write('\n/runs/change-worker/\n')
        atomic_json(path, {'iteration': record['iteration'], 'revision': 0, 'outcome': 'working'})
        with self.lock:
            current = self.get(record['id'])
            if current['status'] == 'running' and current['iteration'] == record['iteration']:
                current.update(worker_revision=0, worker_preview_revision=0, worker_status='Starting', progress=None,
                               worker_outcome='working', report_error=None, worker_updated_at=None)
                self._save(current)

    def _ingest_report(self, record):
        """Accept only display fields for this active pass, never lifecycle commands."""
        path = self.paths.worker_report(record['id'])
        try:
            workspace = self.paths.workspace(record['id']).resolve()
            if path.is_symlink() or not path.resolve().is_relative_to(workspace) or not path.is_file():
                raise ValueError('Worker report is outside its workspace')
            with path.open('rb') as stream:
                raw = stream.read(change_worker.LIMIT + 1)
            if len(raw) > change_worker.LIMIT:
                raise ValueError('Worker report exceeds 32 KB')
            report = change_worker.validate_report(json.loads(raw))
            if report['iteration'] != record['iteration']:
                return  # A cancelled pass cannot update a later iteration.
            with self.lock:
                current = self.get(record['id'])
                if current['status'] != 'running' or current['iteration'] != record['iteration']:
                    return
                if report['revision'] <= current.get('worker_revision', 0):
                    return
                preview_revision = report.get('preview_revision', report['revision'])
                if 'preview' in report and preview_revision > current.get('worker_preview_revision', 0):
                    current['preview'] = validate_preview(workspace, report['preview'])
                    current['preview_url'] = f'/previews/{record["id"]}/' if report['preview'] else None
                    current['worker_preview_revision'] = preview_revision
                for source, target in (('status', 'worker_status'), ('progress', 'progress'),
                                       ('outcome', 'worker_outcome'), ('title', 'title'), ('summary', 'summary')):
                    if source in report:
                        current[target] = report[source]
                current.update(worker_revision=report['revision'], worker_updated_at=now(), report_error=None)
                self._save(current)
        except (OSError, ValueError, TypeError, KeyError) as error:
            with self.lock:
                current = self.get(record['id'])
                if (current['status'] == 'running' and current['iteration'] == record['iteration']
                        and current.get('report_error') != str(error)):
                    current['report_error'] = str(error)
                    self._save(current)

    def _execute(self, record, workspace):
        directory = self.paths.change(record['id'])
        output = directory / f"iteration-{record['iteration']}.txt"
        log = directory / f"iteration-{record['iteration']}.jsonl"
        prompt = self._prompt(record)
        (directory / f"iteration-{record['iteration']}.prompt.txt").write_text(prompt)
        command = [self.binary, 'exec', '--model', MODEL, '--approve-for-me',
                   '-c', 'model_reasoning_effort="high"',
                   '--json', '--color', 'never', '--output-last-message', str(output),
                   '--cd', str(workspace)]
        if record.get('attachments'):
            images = self.paths.worker_images(record['id'])
            if images.is_symlink():
                raise ValueError('Worker screenshot directory must not be a symlink')
            images.mkdir(parents=True, exist_ok=True)
            for item in record['attachments']:
                source = self.paths.attachment(record['id'], item)
                target = images / source.name
                if target.is_symlink():
                    raise ValueError('Worker screenshots must not be symlinks')
                shutil.copyfile(source, target)
                command.extend(['--image', str(target)])
        command.append('-')
        env = dict(os.environ, PIPELINE_PYTHON=sys.executable)
        env.pop('CODEX_THREAD_ID', None)
        env.update(TOWN_CHANGE_ID=record['id'], TOWN_CHANGE_ITERATION=str(record['iteration']),
                   TOWN_CHANGE_NUMBER=str(record['number']),
                   TOWN_BROWSER_RUNTIME=str(self.paths.browser_runtime),
                   PIPELINE_BROWSER_STATE_DIR=str(self.paths.worker_browser_state(record['id'])),
                   TOWN_CHANGE_REPORT=str(self.paths.worker_report(record['id'])),
                   TOWN_CHANGE_REPORTER=str(self.paths.worker_reporter(record['id'])),
                   TOWN_CHANGE_PREVIEW_URL=f'{self.base_url or ""}/previews/{record["id"]}/')
        env['TOWN_CHANGE_MAP_URL'] = f'{self.base_url or ""}/previews/{record["id"]}/map/'
        with log.open('w') as stream:
            with self.lock:
                if self.get(record['id'])['status'] != 'running' or self.halt.is_set():
                    raise RuntimeError('Cancelled before the agent started')
                process = subprocess.Popen(command, cwd=workspace, env=env, stdin=subprocess.PIPE,
                                           stdout=stream, stderr=subprocess.STDOUT, text=True,
                                           start_new_session=True)
                self.processes[record['id']] = process
                current = self.get(record['id'])
                current.update(worker_pid=process.pid, worker_identity=process_identity(process.pid))
                self._save(current)
            try:
                process.stdin.write(prompt)
                process.stdin.close()
                deadline, previous_size = time.monotonic() + self.timeout, -1
                while process.poll() is None:
                    if self.halt.wait(.5) or time.monotonic() > deadline:
                        self._terminate(process)
                        raise RuntimeError('Worker stopped' if self.halt.is_set() else 'Agent time limit reached; retry to continue')
                    self._ingest_report(record)
                    size = log.stat().st_size
                    if size != previous_size:
                        with self.lock:
                            current = self.get(record['id'])
                            self._save(current)
                        previous_size = size
                if process.returncode:
                    raise RuntimeError(f'Codex exited with code {process.returncode}. See the agent log.')
            finally:
                self._terminate(process)
                self._ingest_report(record)  # Capture final reports even from very short runs.
                with self.lock:
                    self.processes.pop(record['id'], None)
                    current = self.get(record['id'])
                    if current.get('worker_pid') == process.pid:
                        current.pop('worker_pid', None)
                        current.pop('worker_identity', None)
                        self._save(current)
        completed = False
        for line in log.read_text(errors='replace').splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get('type') in {'turn.failed', 'error'}:
                raise RuntimeError(str(event.get('error') or event.get('message') or 'Agent failed'))
            completed |= event.get('type') == 'turn.completed'
        if not completed:
            raise RuntimeError('Codex exited without completing a turn. See the agent log.')
        return output.read_text() if output.exists() else 'Agent completed. Review the diff and preview.'

    def _collect(self, record):
        workspace = self.paths.workspace(record['id'])
        git(workspace, 'add', '-A')
        names = git(workspace, 'diff', '--cached', '--name-only', '-z', record['baseline']).split('\0')
        files = [name for name in names if name]
        for name in files:
            safe_path(workspace, name)
        patch = git(workspace, 'diff', '--cached', '--binary', record['baseline'], text=False)
        (self.paths.change(record['id']) / 'change.patch').write_bytes(patch)
        return files

    def _record_problem(self, record, error, files=None):
        """Execution/check failures do not prevent human review of saved edits."""
        if files is None:
            try:
                files = self._collect(record) if record.get('baseline') else []
            except Exception as collection_error:
                files = []
                error = f'{error}\nCould not collect changes: {collection_error}'
        output = self.paths.change(record['id']) / f"iteration-{record['iteration']}.txt"
        if output.is_file():
            record['summary'] = output.read_text(errors='replace')
        record.update(status='pending_approval' if files else 'failed', files=files,
                      review_warning=str(error) if files else None, error=None if files else str(error))
        return self._save(record)

    def _work(self):
        while not self.halt.is_set():
            with self.lock:
                queued = [r for r in self.list() if r['status'] == 'queued' and r['id'] not in self.active]
                record = queued[0] if queued else None
                if record:
                    self.active.add(record['id'])
                    record['status'] = 'running'
                    self._save(record)
            if record is None:
                self.halt.wait(.3)
                continue
            try:
                workspace = self._snapshot(record)
                self._prepare_report(record)
                summary = self._execute(record, workspace)
                files = self._collect(record)
                with self.lock:
                    current = self.get(record['id'])
                    if current['status'] == 'running':
                        blocked = current.get('worker_outcome') == 'blocked'
                        if current.get('merge', {}).get('status') == 'repairing':
                            current['merge']['status'] = 'needs_review'
                        current.update(summary=summary, files=files)
                        if blocked:
                            self._record_problem(current, current.get('worker_status') or 'Worker reported a blocker', files)
                        else:
                            current.update(status='pending_approval', error=None, review_warning=None)
                            if current.get('worker_outcome') != 'complete':
                                current['worker_status'] = 'Finished'
                            current.update(progress=100, worker_outcome='complete')
                            self._save(current)
            except Exception as error:
                with self.lock:
                    current = self.get(record['id'])
                    if current['status'] == 'running':
                        self._record_problem(current, str(error))

            finally:
                with self.lock:
                    self.active.discard(record['id'])

    def start(self):
        if self.threads:
            return
        self.halt.clear()
        # The server holds the process lock before recovering interrupted jobs.
        with self.lock:
            for record in self.list():
                if record.get('worker_pid'):
                    stop_saved_worker(record)
                    record.pop('worker_pid', None)
                    record.pop('worker_identity', None)
                    self._save(record)
                if record['status'] == 'running':
                    self._record_problem(record, 'Queue server interrupted. Review saved edits or iterate to continue.')
                elif record['status'] == 'failed' and record.get('baseline'):
                    self._record_problem(record, record.get('error') or 'Worker stopped before completing its checks.')
        for _ in range(self.workers):
            thread = threading.Thread(target=self._work, daemon=True)
            thread.start()
            self.threads.append(thread)
        self.start_bakes()

    def stop(self):
        self.halt.set()
        with self.lock:
            for process in list(self.processes.values()):
                self._terminate(process)
            if self.bake_process:
                self._terminate(self.bake_process)
        for thread in self.threads:
            thread.join(timeout=10)
        self.threads = []

    def _repair_merge(self, record, updates, conflicts):
        """Rebase in a replacement workspace; retain the entire original for recovery."""
        workspace = self.paths.workspace(record['id'])
        backup = self.paths.merge_backup(record['id'], record['iteration'])
        if backup.exists():
            raise ValueError('A previous merge backup already exists for this pass')
        staging = Path(tempfile.mkdtemp(prefix='merge-', dir=self.paths.change(record['id'])))
        swapped = False
        try:
            modes = self._copy_source(self.root, staging)
            for name, _, _, expected, expected_mode in updates:
                copied = safe_path(staging, name)
                if (copied.read_bytes() if copied.is_file() else None) != expected or modes.get(name) != expected_mode:
                    raise ValueError('Checkout changed during merge preparation; approve again')
            for name, _, expected, _, _ in conflicts:
                copied = safe_path(staging, name)
                if (copied.read_bytes() if copied.is_file() else None) != expected:
                    raise ValueError('Checkout changed during merge preparation; approve again')
            self._init_snapshot(staging)
            baseline = git(staging, 'rev-parse', 'HEAD').strip()
            inputs = staging / 'runs/change-worker'
            inputs.mkdir(parents=True, exist_ok=True)
            manifest = []
            for name, merged, mode, original, original_mode in updates:
                target = safe_path(staging, name)
                if merged is None:
                    target.unlink(missing_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(merged); target.chmod(mode)
            for index, item in enumerate(conflicts):
                name, base, current, task, task_mode = item
                entry = {'path': name, 'task_mode': task_mode}
                for label, data in [('base', base), ('current', current), ('task', task)]:
                    relative = f'runs/change-worker/merge-{index}-{label}'
                    entry[label] = relative if data is not None else None
                    if data is not None: (staging / relative).write_bytes(data)
                manifest.append(entry)
                # Start on the checkout version; the task side remains in the
                # inputs and original workspace so it cannot silently replace it.
            (inputs / 'merge.json').write_text(json.dumps(manifest, indent=2))
            workspace.rename(backup)
            try:
                staging.rename(workspace)
                swapped = True
            except Exception:
                backup.rename(workspace)
                raise
            record['feedback'].append({'text': 'Resolve approval conflicts in ' + ', '.join(item[0] for item in conflicts) +
                '. Read runs/change-worker/merge.json. Combine both intents, preserve previously approved work, and test the result.', 'at': now()})
            record.update(baseline=baseline, baseline_modes=modes, status='queued', iteration=record['iteration']+1,
                          error=None, review_warning=None, worker_outcome='working', progress=None,
                          worker_revision=-1, worker_preview_revision=-1,
                          worker_status='Queued to resolve merge conflicts',
                          merge={'status': 'repairing', 'files': [item[0] for item in conflicts]})
            record['files'] = self._collect(record)
            return self._save(record)
        except Exception:
            if swapped:
                workspace.rename(staging)
                backup.rename(workspace)
                self._collect(self.get(record['id']))
            raise
        finally:
            if staging.exists(): shutil.rmtree(staging)

    def approve(self, change_id):
        with self.lock:
            record = self.get(change_id)
            if record['status'] != 'pending_approval':
                raise ValueError('Only a completed change can be approved')
            workspace = self.paths.workspace(record['id'])
            files = self._collect(record)
            updates, conflicts, merged_files = [], [], []
            for name in files:
                target = safe_path(self.root, name)
                source = safe_path(workspace, name)
                if target.exists() and not target.is_file():
                    raise ValueError(f'Checkout path is not a file: {name}')
                try:
                    baseline = git(workspace, 'show', f"{record['baseline']}:{name}", text=False)
                except subprocess.CalledProcessError:
                    baseline = None
                actual = target.read_bytes() if target.is_file() else None
                desired = source.read_bytes() if source.is_file() else None
                actual_mode = stat.S_IMODE(target.stat().st_mode) if target.is_file() else None
                baseline_mode = record.get('baseline_modes', {}).get(name)
                desired_mode = stat.S_IMODE(source.stat().st_mode) if source.is_file() else None
                try:
                    merged = change_merge.content(name, baseline, actual, desired)
                    mode = change_merge.value(baseline_mode, actual_mode, desired_mode)
                except change_merge.Conflict:
                    conflicts.append((name, baseline, actual, desired, desired_mode))
                    continue
                updates.append((name, merged, mode, actual, actual_mode))
                if actual != baseline and actual != desired:
                    merged_files.append(name)
            if conflicts:
                return self._repair_merge(record, updates, conflicts)
            # Approval operations are serialized. Also detect outside edits made
            # while preparing the merge, before writing any file.
            for name, _, _, expected, mode in updates:
                target = safe_path(self.root, name)
                if (target.read_bytes() if target.is_file() else None) != expected or (stat.S_IMODE(target.stat().st_mode) if target.is_file() else None) != mode:
                    raise ValueError('Checkout changed during approval; approve again')
            applied = []
            try:
                for name, content, mode, original, original_mode in updates:
                    target = safe_path(self.root, name)
                    applied.append((target, original, original_mode))
                    if content is not None:
                        target.parent.mkdir(parents=True, exist_ok=True)
                        descriptor, temporary_name = tempfile.mkstemp(prefix='.town-change-', dir=target.parent)
                        os.close(descriptor)
                        temporary = Path(temporary_name)
                        try:
                            temporary.write_bytes(content); temporary.chmod(mode)
                            os.replace(temporary, target)
                        finally:
                            temporary.unlink(missing_ok=True)
                    else:
                        target.unlink(missing_ok=True)
            except Exception:
                for target, content, mode in reversed(applied):
                    if content is None:
                        target.unlink(missing_ok=True)
                    else:
                        target.write_bytes(content); target.chmod(mode)
                raise
            record.update(status='approved', error=None, files=files,
                          merge={'status': 'merged', 'files': merged_files})
            return self._save(record)


class ChangeServer(http.server.ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, queue):
        self.queue = queue
        super().__init__(address, ChangeHandler)
        queue.base_url = f'http://127.0.0.1:{self.server_port}'


class ChangeHandler(http.server.BaseHTTPRequestHandler):
    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass  # Normal when a live preview reloads its document.

    def log_message(self, *_):
        pass

    @property
    def queue(self):
        return self.server.queue

    def reply(self, data, status=200, content_type='application/json; charset=utf-8'):
        content = json.dumps(data).encode() if content_type.startswith('application/json') and not isinstance(data, bytes) else data
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(content)

    def payload(self):
        return {'changes': [public_record(r) for r in self.queue.list()], 'workers': self.queue.workers}

    def trusted_host(self):
        host = self.headers.get('Host', '')
        return host in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}

    def do_GET(self):
        if not self.trusted_host():
            return self.reply({'error': 'Local requests only'}, 403)
        path = unquote(urlsplit(self.path).path)
        try:
            if path in {'/', '/changes', '/changes/'}:
                return self.file(self.queue.root / 'tinytown/web/changes.html')
            if path in {'/changes.js', '/changes.css', '/tinytown/web/changes.js', '/tinytown/web/changes.css', '/tinytown/web/live-updates.js'}:
                return self.file(self.queue.root / 'tinytown/web' / Path(path).name)
            if path == '/api/changes':
                return self.reply(self.payload())
            if path == '/api/sites':
                from . import config
                return self.reply({'sites': [{'name': name, 'title': config.site_config(name, self.queue.root).get('title', name)}
                                             for name in config.all_sites(self.queue.root)]})
            if path == '/api/health':
                return self.reply({'service': 'tinytown-changes', 'root': str(self.queue.root), 'screenshots': True})
            if path == '/api/events':
                return self.events('changes', self.payload)
            if path.startswith('/api/changes/'):
                parts = path.strip('/').split('/')
                if len(parts) == 5 and parts[3] == 'attachments':
                    image, mime = self.queue.get_attachment(parts[2], parts[4])
                    return self.reply(image.read_bytes(), content_type=mime)
                if len(parts) == 3:
                    return self.reply(public_record(self.queue.get(parts[2], detail=True)))
                return self.reply({'error': 'Not found'}, 404)
            if path.startswith('/previews/'):
                return self.preview(path)
            self.reply({'error': 'Not found'}, 404)
        except (ValueError, FileNotFoundError) as error:
            self.reply({'error': str(error)}, 400)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as error:
            self.reply({'error': str(error)}, 500)

    def file(self, path):
        if not path.is_file():
            raise FileNotFoundError('File not found')
        return self.reply(path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')

    def events(self, event, fetch):
        if parse_qs(urlsplit(self.path).query).get('poll') == ['1']:
            return self.reply(fetch())
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        self.end_headers()
        # Older open pages still use EventSource. Periodically release their
        # connections too, so they cannot starve navigations and asset downloads.
        self.wfile.write(b'retry: 1000\n\n')
        deadline = time.monotonic() + 5
        previous = None
        try:
            while not self.queue.halt.is_set() and time.monotonic() < deadline:
                data = json.dumps(fetch(), sort_keys=True)
                if data != previous:
                    self.wfile.write(f'event: {event}\ndata: {data}\n\n'.encode())
                    previous = data
                else:
                    self.wfile.write(b': heartbeat\n\n')
                self.wfile.flush()
                self.queue.halt.wait(1)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def preview(self, path):
        from . import preview
        pieces = path.split('/')
        preview_id = pieces[2]
        suffix = '/'.join(pieces[3:])
        whole_map = suffix == 'map' or suffix.startswith('map/')
        if whole_map:
            return change_bakes.serve_map(self, preview_id, suffix[3:])
        def context():
            root, spec = self.queue.preview_context(preview_id)
            site = parse_qs(urlsplit(self.path).query).get('site', [None])[0]
            if spec.get('whole_map') and site:
                from . import config
                if site not in config.all_sites(root):
                    raise ValueError('Choose an available town')
                spec = {**spec, 'site': site}
            return root, spec
        root, spec = context()
        base = f'/previews/{preview_id}/'
        if not suffix:
            sites = None
            if spec.get('whole_map'):
                from . import config
                sites = [{'name': name, 'title': config.site_config(name, root).get('title', name)} for name in config.all_sites(root)]
            return self.reply(preview.document(spec, base, sites).encode(), content_type='text/html; charset=utf-8')
        if suffix == 'scene.json':
            return self.reply(preview.fresh_scene(root, spec))
        if suffix == 'events':
            def stamp():
                current_root, current_spec = context()
                return {'fingerprint': preview.fingerprint(current_root, current_spec)}
            return self.events('preview', stamp)
        if suffix.startswith('files/'):
            name = suffix.removeprefix('files/')
            # Queue-owned viewer shell; scene modules and data below still come
            # from the job. This also works with snapshots made before map views.
            if name == 'tinytown/web/preview-map.js':
                return self.file(self.queue.root / name)
            # Serve only runtime source/assets, never queue DB, prompts, .git or private files.
            parts = Path(name).parts
            allowed = parts and (parts[0] == 'src' or name.startswith('tinytown/web/preview') or name == 'tinytown/web/stream-export.js' or
                       (parts[0] == 'data' and 'textures' in parts))
            if not allowed or Path(name).suffix.lower() not in {'.js', '.mjs', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.json'}:
                raise ValueError('Not a preview asset')
            return self.file(safe_path(root, name))
        self.reply({'error': 'Not found'}, 404)

    def do_POST(self):
        # Browser mutations require a same-origin custom header: forms and CORS
        # requests from unrelated websites cannot launch agents or approve files.
        origin = self.headers.get('Origin')
        expected = f"http://{self.headers.get('Host')}"
        if not self.trusted_host() or self.headers.get('X-TinyTown') != 'changes' or (origin and origin != expected):
            return self.reply({'error': 'Same-origin TinyTown request required'}, 403)
        try:
            path = unquote(urlsplit(self.path).path)
            parts = path.strip('/').split('/')
            accepts_images = path == '/api/changes' or (
                len(parts) == 4 and parts[:2] == ['api', 'changes'] and parts[3] in {'iterate', 'attachments'})
            limit = change_images.MAX_BODY_BYTES if accepts_images else 100000
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= limit:
                raise ValueError('Request body is empty or too large')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError('Expected a JSON object')
            if path == '/api/changes':
                return self.reply(public_record(self.queue.create(body.get('request'), body.get('title'), body.get('preview'), body.get('attachments'))), 201)
            if path == '/api/previews':
                return self.reply(self.queue.create_preview(body), 201)
            parts = path.strip('/').split('/')
            if len(parts) != 4 or parts[:2] != ['api', 'changes']:
                return self.reply({'error': 'Not found'}, 404)
            change_id, action = parts[2:]
            if action == 'iterate':
                record = self.queue.iterate(change_id, body.get('feedback'), body.get('attachments'))
            elif action == 'bake':
                record = self.queue.request_bake(change_id, body.get('site'))
            elif action == 'attachments':
                record = self.queue.add_attachments(change_id, body.get('attachments'))
            elif action == 'preview':
                record = self.queue.set_preview(change_id, body)
            elif action in {'approve', 'retry', 'cancel', 'discard'}:
                record = getattr(self.queue, action)(change_id)
            else:
                raise ValueError('Unknown action')
            self.reply(public_record(record))
        except (ValueError, TypeError, KeyError) as error:
            self.reply({'error': str(error)}, 400)
        except Exception as error:
            self.reply({'error': str(error)}, 500)


def serve(port=None, workers=2, root=ROOT, binary='codex', timeout=3600):
    queue = ChangeQueue(root, workers, binary, timeout)
    with queue.paths.lock.open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('A change queue server is already running for this checkout')
        if port is None:
            for candidate in range(PORT, PORT + 20):
                try:
                    server = ChangeServer(('127.0.0.1', candidate), queue)
                    break
                except OSError as error:
                    if error.errno not in {48, 98}:  # EADDRINUSE on macOS/Linux
                        raise
            else:
                raise ValueError('No available dashboard port; specify --port')
        else:
            server = ChangeServer(('127.0.0.1', port), queue)
        from .state import atomic_json
        atomic_json(queue.paths.server, {'port': server.server_port, 'root': str(queue.root)})
        queue.start()
        print(f'Change dashboard: http://127.0.0.1:{server.server_port}/changes', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            queue.stop()
            server.server_close()


def api(port, path, body=None):
    request = Request(f'http://127.0.0.1:{port}{path}',
                      data=json.dumps(body).encode() if body is not None else None,
                      headers={'Content-Type': 'application/json', 'X-TinyTown': 'changes'})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def ensure_server(port=None, root=ROOT):
    paths = ChangePaths(root)
    paths.directory.mkdir(parents=True, exist_ok=True)
    explicit = port is not None
    if port is None and paths.server.exists():
        try:
            port = json.loads(paths.server.read_text())['port']
        except (ValueError, KeyError):
            pass
    candidates = [port] if port is not None else list(range(PORT, PORT + 20))
    if not explicit:
        candidates += [p for p in range(PORT, PORT + 20) if p not in candidates]
    for candidate in candidates:
        with socket.socket() as probe:
            probe.settimeout(.3)
            occupied = probe.connect_ex(('127.0.0.1', candidate)) == 0
        if not occupied:
            port = candidate
            break
        try:
            health = api(candidate, '/api/health')
            if health.get('service') == 'tinytown-changes' and health.get('root') == str(Path(root).resolve()):
                return candidate
        except (OSError, ValueError):
            pass
        if explicit:
            raise ValueError(f'Port {candidate} is already serving another application')
    else:
        raise ValueError('No available dashboard port; specify --port')
    with (paths.directory / 'server.log').open('a') as log:
        process = subprocess.Popen([sys.executable, '-B', '-m', 'tinytown', 'changes', 'serve', '--port', str(port)],
                                   cwd=root, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    for _ in range(100):
        try:
            health = api(port, '/api/health')
            if health.get('root') == str(Path(root).resolve()):
                return port
        except OSError:
            pass
        if process.poll() is not None:
            break
        time.sleep(.1)
    raise ValueError(f'Could not start the queue server. See {paths.directory / "server.log"}')


def _spec(args):
    return change_worker.preview_spec(args)


def _run(args):
    try:
        if args.verb == 'changes' and args.action == 'report':
            print(json.dumps(change_worker.publish(args), indent=2))
            return 0
        if args.verb == 'changes' and args.action == 'serve':
            serve(args.port, args.workers, binary=args.binary, timeout=args.timeout)
            return 0
        args.port = ensure_server(args.port)
        if args.verb == 'preview':
            result = api(args.port, '/api/previews', _spec(args) or {})
        elif args.action == 'add':
            result = api(args.port, '/api/changes', {'request': args.request, 'title': args.title, 'preview': _spec(args)})
        elif args.action == 'list':
            result = api(args.port, '/api/changes')
        elif args.action == 'show':
            result = api(args.port, f'/api/changes/{quote(args.id, safe="")}')
        else:
            body = {'feedback': args.feedback} if args.action == 'iterate' else {'site': args.site} if args.action == 'bake' else {}
            result = api(args.port, f'/api/changes/{quote(args.id, safe="")}/{args.action}', body)
        print(json.dumps(result, indent=2))
        print(f'http://127.0.0.1:{args.port}' + result.get('url', f'/changes#{result.get("number", result["id"])}' if 'id' in result else '/changes'))
        return 0
    except Exception as error:
        if hasattr(error, 'read'):
            try:
                error = json.loads(error.read()).get('error', str(error))
            except ValueError:
                pass
        print(f'town: {error}', file=sys.stderr)
        return 1


def _preview_flags(parser):
    change_worker.preview_flags(parser)


def register(subparsers):
    parser = subparsers.add_parser('changes', help='Queue independent Astra changes and review them live')
    actions = parser.add_subparsers(dest='action', required=True)
    for action in ('serve', 'add', 'list', 'show', 'iterate', 'approve', 'cancel', 'retry', 'discard', 'report', 'bake'):
        child = actions.add_parser(action)
        child.set_defaults(run=_run)
        if action == 'report':
            change_worker.report_flags(child)
            continue
        child.add_argument('--port', type=int, help='Dashboard port (auto-select and remember a free port by default)')
        if action == 'serve':
            child.add_argument('--workers', type=int, default=2)
            child.add_argument('--binary', default='codex')
            child.add_argument('--timeout', type=int, default=3600, help='Seconds allowed per agent pass')
        if action == 'add':
            child.add_argument('request')
            child.add_argument('--title')
            _preview_flags(child)
        if action in {'show', 'iterate', 'approve', 'cancel', 'retry', 'discard', 'bake'}:
            child.add_argument('id', help='Change number or full change ID')
        if action == 'bake':
            child.add_argument('--site', help='Town to bake (defaults to the task preview town)')
        if action == 'iterate':
            child.add_argument('feedback')
    parser = subparsers.add_parser('preview', help='Create a live source preview without baking')
    parser.add_argument('--port', type=int, help='Dashboard port (auto-select by default)')
    _preview_flags(parser)
    parser.set_defaults(run=_run)
