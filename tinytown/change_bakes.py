"""Serialized task bakes from immutable source snapshots, separate from worker edits."""
import html
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import uuid

from . import preview


RUNNER = '''import functools, http.server, sys, threading
from pathlib import Path
from tinytown import bake, site, browser
from tinytown.paths import SitePaths
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(Path.cwd())))
threading.Thread(target=server.serve_forever, daemon=True).start()
bake.SERVER_PORT = server.server_port
paths = SitePaths(sys.argv[1])
try:
    print('Building scene', flush=True)
    site.build(paths)
    print('Baking surfaces and world', flush=True)
    if not bake.bake(paths): raise RuntimeError('World bake failed')
    bake.stamp_viewer()
    print('Checking baked assets', flush=True)
    if not bake.bake(paths, check=True): raise RuntimeError('Baked assets did not validate')
    print('Bake ready', flush=True)
finally:
    server.shutdown(); server.server_close()
    browser.main(['stop'])
'''


def fingerprint(root, site, version=2):
    # Scene fingerprints include source data, overrides, generators and plugins.
    import hashlib
    stamp = hashlib.sha256(preview.fingerprint(root, {'site': site}).encode())
    for path in sorted(Path(root).iterdir()):
        if path.is_file() and path.suffix in {'.html', '.css', '.js'}:
            stamp.update(path.name.encode()); stamp.update(path.read_bytes())
    if version >= 2:
        for path in sorted((Path(root) / 'tinytown/web').rglob('*')):
            if path.is_file() and path.suffix in {'.html', '.css', '.js', '.mjs'}:
                stamp.update(str(path.relative_to(root)).encode()); stamp.update(path.read_bytes())
    return stamp.hexdigest()


class Bakes:
    def request_bake(self, change_id, site=None):
        from .changes import now
        with self.lock:
            record = self.get(change_id)
            if record.get('bake', {}).get('status') in {'queued', 'running'}:
                return record
            _, spec = self.map_context(record['id'], site)
            record['bake'] = {'id': uuid.uuid4().hex[:12], 'site': spec['site'], 'status': 'queued',
                              'iteration': record['iteration'], 'updated_at': now()}
            return self._save(record)

    def bake_info(self, record):
        baked = record.get('baked')
        if not baked:
            return record
        record = dict(record, baked=dict(baked))
        root = self.paths.workspace(record['id']) if record.get('baseline') else self.root
        try:
            record['baked']['stale'] = fingerprint(root, baked['site'], baked.get('fingerprint_version', 1)) != baked['fingerprint']
        except (OSError, ValueError):
            record['baked']['stale'] = True
        return record

    def _bake_work(self):
        from .changes import now, process_identity
        while not self.halt.is_set():
            with self.lock:
                queued = [r for r in self.list() if r.get('bake', {}).get('status') == 'queued'
                          and (r.get('baseline') or r['status'] not in {'queued', 'running'})]
                record = queued[0] if queued else None
                if record:
                    record['bake'].update(status='running', updated_at=now())
                    self._save(record)
            if not record:
                self.halt.wait(.3)
                continue
            attempt = record['bake']
            directory = self.paths.bake(record['id'], attempt['id'])
            directory.mkdir(parents=True, exist_ok=True)
            process = None
            try:
                source = self.paths.workspace(record['id']) if record.get('baseline') else self.root
                world = directory / 'world'
                for retry in range(3):
                    stamp = fingerprint(source, attempt['site'])
                    if world.exists(): shutil.rmtree(world)
                    self._copy_source(source, world)
                    if stamp == fingerprint(source, attempt['site']): break
                else:
                    raise ValueError('Source changed while copying. Bake again after the current edit.')
                runtime = world / 'runs' / 'headless-browser' / 'runtime'
                runtime.parent.mkdir(parents=True, exist_ok=True)
                if self.paths.browser_runtime.exists(): runtime.symlink_to(self.paths.browser_runtime, target_is_directory=True)
                env = dict(os.environ, PIPELINE_PYTHON=sys.executable,
                           PIPELINE_BROWSER_STATE_DIR=str(runtime.parent), PYTHONUNBUFFERED='1')
                with (directory / 'bake.log').open('w') as log:
                    process = subprocess.Popen([sys.executable, '-u', '-B', '-c', RUNNER, attempt['site']],
                                               cwd=world, env=env, stdout=log, stderr=subprocess.STDOUT,
                                               start_new_session=True)
                    with self.lock:
                        self.bake_process = process
                        current = self.get(record['id'])
                        current['bake'].update(worker_pid=process.pid, worker_identity=process_identity(process.pid))
                        self._save(current)
                    deadline, size = time.monotonic() + 3600, -1
                    while process.poll() is None:
                        if self.halt.wait(.5) or time.monotonic() > deadline:
                            self._terminate(process)
                            raise RuntimeError('Bake interrupted' if self.halt.is_set() else 'Bake time limit reached')
                        length = (directory / 'bake.log').stat().st_size
                        if length != size:
                            with self.lock: self._save(self.get(record['id']))
                            size = length
                    if process.returncode:
                        raise RuntimeError(f'Bake failed (exit {process.returncode}). See bake log.')
                ready = {'id': attempt['id'], 'site': attempt['site'], 'iteration': attempt['iteration'],
                         'fingerprint': stamp, 'fingerprint_version': 2, 'finished_at': now()}
                (directory / 'ready.json').write_text(json.dumps(ready))
                with self.lock:
                    current = self.get(record['id'])
                    current['baked'] = ready
                    current['bake'].update(status='ready', error=None, updated_at=now())
                    self._save(current)
            except Exception as error:
                with self.lock:
                    current = self.get(record['id'])
                    current['bake'].update(status='failed', error=str(error), updated_at=now())
                    self._save(current)
            finally:
                if process is not None: self._terminate(process)
                with self.lock:
                    self.bake_process = None
                    current = self.get(record['id'])
                    current['bake'].pop('worker_pid', None); current['bake'].pop('worker_identity', None)
                    self._save(current)

    def start_bakes(self):
        from .changes import stop_saved_worker
        for record in self.list():
            if record.get('bake', {}).get('status') == 'running':
                stop_saved_worker(record['bake'])
                record['bake'].update(status='failed', error='Bake interrupted; bake again to retry')
                self._save(record)
        thread = threading.Thread(target=self._bake_work, daemon=True)
        thread.start(); self.threads.append(thread)


def serve_map(handler, change_id, suffix):
    """A stable map page, plus versioned immutable production viewer assets."""
    queue = handler.queue
    record = queue.get(change_id)
    if suffix in {'', '/'}:
        document = (queue.root / 'tinytown/web/change-map.html').read_text()
        return handler.reply(document.replace('__CHANGE_ID__', record['id']).encode(), content_type='text/html; charset=utf-8')
    if suffix == '/events':
        from .changes import public_record
        return handler.events('map', lambda: public_record(queue.bake_info(queue.get(change_id))))
    if suffix in {'/change-map.js', '/change-map.css'}:
        return handler.file(queue.root / 'tinytown/web' / suffix.lstrip('/'))
    parts = suffix.lstrip('/').split('/')
    directory = queue.paths.bake(record['id'], parts[0])
    if not (directory / 'ready.json').is_file():
        raise ValueError('This bake is not ready')
    root = directory / 'world'
    name = '/'.join(parts[1:])
    if not name or name == 'index.html':
        ready = json.loads((directory / 'ready.json').read_text())
        base = f'/previews/{record["id"]}/map/{parts[0]}/'
        document = (root / 'index.html').read_text()
        document = document.replace('<head>', '<head><base href="' + html.escape(base, quote=True) + '"><meta name="town-site" content="' + ready['site'] + '"><style>#stream-debug{display:none!important}</style>', 1)
        return handler.reply(document.encode(), content_type='text/html; charset=utf-8')
    path = root / name
    pieces = Path(name).parts
    allowed = pieces and (pieces[0] == 'src' or
              (pieces[0] == 'data' and len(pieces) >= 3 and (pieces[2] in {'stream', 'textures', 'site.json'})) or
              (pieces[0] == 'sites' and path.suffix in {'.png', '.jpg', '.svg', '.webp', '.ico'}) or
              (len(pieces) == 1 and path.suffix in {'.css', '.png', '.jpg', '.svg', '.ico', '.webp'}))
    if not allowed or '..' in pieces or not path.resolve().is_relative_to(root.resolve()) or any(p.is_symlink() for p in [path, *path.parents] if p.is_relative_to(root)):
        raise ValueError('Not a baked map asset')
    return handler.file(path)
