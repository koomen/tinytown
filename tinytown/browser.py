"""One headless Chromium harness for Python (this module) and Node (browser.mjs).

The repository owns a pinned Playwright chromium-headless-shell under
runs/headless-browser/runtime/. A small supervisor (`serve`) launches it with a
private profile and publishes its loopback CDP endpoint in browser.json. Every
operation leases an isolated browser context (`open_tab`), drives it over a
flat CDP session (`Tab`), and disposes it when done. Completed, abandoned and
crashed operations are cleaned up by `cleanup_orphans`. Desktop browsers are
never discovered or opened.

    ./town browser setup      install the private browser once (Playwright venv in runs/)
    ./town browser status     record, health and open leases
    ./town browser cleanup    dispose contexts whose owners have exited
    ./town browser stop       stop the owned supervisor

`python -m tinytown.browser ensure|open-tab|close-tab|serve` is the bridge that
browser.mjs and the supervisor use; it is not meant to be typed by hand.

Environment: PIPELINE_BROWSER_STATE_DIR relocates the state directory (tests and
the supervisor use it); PIPELINE_PYTHON selects the Python that browser.mjs
spawns for the bridge. `websocket` (websocket-client) is imported lazily so the
module imports with bare python3.
"""
import argparse
import base64
from contextlib import contextmanager
import fcntl
import itertools
import json
import logging
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from .paths import ROOT
from .state import atomic_json

STATE_DIR = Path(os.environ.get('PIPELINE_BROWSER_STATE_DIR', ROOT / 'runs/headless-browser'))
RUNTIME = ROOT / 'runs/headless-browser/runtime'
PROVIDER = 'headless-chromium'
PLAYWRIGHT_VERSION = '1.62.0'
WEBSOCKET_CLIENT_VERSION = '1.8.0'
LOCK_SECONDS = 45
STARTUP_SECONDS = 35
IDLE_SECONDS = 300           # the supervisor exits after this long without a lease
SERVER_PORT = 8734           # the dev server the viewer is loaded from
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36")
SETUP_HINT = 'Install the private browser once: ./town browser setup'
_lock = threading.Lock()
_ids = itertools.count(1)
_log = logging.getLogger(__name__)


def _websocket():
    """websocket-client, imported on first use so the module stays stdlib-only at import."""
    import websocket
    return websocket


def _websocket_errors():
    try:
        return (_websocket().WebSocketException,)
    except ImportError:
        return ()


# --- supervisor ownership ----------------------------------------------------

@contextmanager
def browser_lock():
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if not _lock.acquire(timeout=LOCK_SECONDS):
        raise RuntimeError('Headless browser startup lock timed out.')
    try:
        with (STATE_DIR / 'startup.lock').open('a') as lock:
            deadline = time.monotonic() + LOCK_SECONDS
            while True:
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Headless browser startup lock timed out.')
                    time.sleep(.1)
            yield
    finally:
        _lock.release()


def read(path):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return {}


REQUEST_SECONDS = 5           # ordinary browser-level CDP calls
DISPOSE_SECONDS = 30          # disposing a context tears down its renderer; a WebGL scene takes ~6s
GONE = ('failed to find context', 'cannot find context', 'not found', 'no target with given id')


def request(record, method, timeout=REQUEST_SECONDS, **params):
    """One browser-level CDP call over a fresh connection, answered within `timeout` seconds."""
    endpoint = urllib.parse.urlparse(record['webSocketDebuggerUrl'])
    if endpoint.hostname != '127.0.0.1' or endpoint.port != record['port']:
        raise ValueError('Headless CDP endpoint must use its recorded loopback port.')
    ws = _websocket().create_connection(record['webSocketDebuggerUrl'], suppress_origin=True, timeout=timeout)
    try:
        ws.send(json.dumps({'id': 1, 'method': method, 'params': params}))
        while True:
            response = json.loads(ws.recv())
            if response.get('id') != 1:
                continue
            if 'error' in response:
                raise RuntimeError(str(response['error']))
            return response.get('result', {})
    finally:
        ws.close()


def healthy(record):
    """Check the exact private profile and endpoint, not a familiar port or PID."""
    try:
        if record.get('provider') != PROVIDER or not re.fullmatch('[0-9a-f]{32}', record.get('key', '')):
            return False
        profile = STATE_DIR / 'profiles' / record['key']
        if Path(record['profile']).resolve() != profile.resolve():
            return False
        with urllib.request.urlopen(f'http://127.0.0.1:{record["port"]}/json/version', timeout=2) as r:
            version = json.load(r)
        if version['webSocketDebuggerUrl'] != record['webSocketDebuggerUrl']:
            return False
        arguments = request(record, 'Browser.getBrowserCommandLine')['arguments']
        return (f'--user-data-dir={profile.resolve()}' in arguments
                and any(a == '--headless' or a.startswith('--headless=') for a in arguments))
    except (OSError, ValueError, KeyError, RuntimeError, *_websocket_errors()):
        return False


def supervisor_command(python, key):
    return [str(python), '-B', '-m', 'tinytown.browser', 'serve', '--instance', key]


def stop_owned(record):
    """Terminate only the supervisor process group carrying this instance token."""
    pid = record.get('pid')
    if not pid or pid == os.getpid():
        return
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'command='], capture_output=True, text=True)
    expected = ['tinytown.browser', 'serve', '--instance', record.get('key', '')]
    if result.returncode or not all(part and part in result.stdout for part in expected):
        return
    try:
        if os.getpgid(pid) != pid:
            return
        os.kill(pid, signal.SIGTERM)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                return
            time.sleep(.1)
        # The supervisor normally closes Playwright and all its children. If
        # it is hung, terminate its owned group where the OS permits it.
        try:
            os.killpg(pid, signal.SIGKILL)
        except PermissionError:
            os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def installed():
    return (RUNTIME / 'installation.json').exists()


def launch():
    python = RUNTIME / 'bin/python'
    if not installed():
        raise RuntimeError(SETUP_HINT)
    key = uuid.uuid4().hex
    with (STATE_DIR / 'browser.log').open('a') as log:
        child = subprocess.Popen(supervisor_command(python, key), cwd=ROOT,
            env={**os.environ, 'PIPELINE_BROWSER_STATE_DIR': str(STATE_DIR.resolve()),
                 'PLAYWRIGHT_BROWSERS_PATH': str(RUNTIME / 'browsers')},
            stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    deadline = time.monotonic() + STARTUP_SECONDS
    while time.monotonic() < deadline:
        record = read(STATE_DIR / 'browser.json')
        if record.get('key') == key and healthy(record):
            return record
        if child.poll() is not None:
            break
        time.sleep(.2)
    stop_owned({'pid': child.pid, 'key': key})
    error = read(STATE_DIR / f'error-{key}.json')
    raise RuntimeError('Private headless browser failed to start: ' + str(error.get('error', STATE_DIR / 'browser.log')))


def ensure_browser():
    """The record of a healthy private browser (port, webSocketDebuggerUrl, key, ...), starting one if needed."""
    with browser_lock():
        record = read(STATE_DIR / 'browser.json')
        if healthy(record):
            cleanup_orphans(record=record)
            return record
        stop_owned(record)
        return launch()


# --- context leases ----------------------------------------------------------

def lease_path(record):
    if not re.fullmatch('[0-9a-f]{32}', record.get('lease_id', '')):
        raise ValueError('Invalid headless context lease.')
    return STATE_DIR / 'leases' / (record['lease_id'] + '.json')


def open_tab(record=None, *, owner_pid=None, persistent=False):
    """Lease a fresh isolated browser context with one about:blank target."""
    record = record or ensure_browser()
    owned = {**record, 'lease_id': uuid.uuid4().hex, 'owner_pid': owner_pid or os.getpid(),
             'persistent': persistent, 'opened_at': time.time()}
    owned['context_id'] = request(record, 'Target.createBrowserContext')['browserContextId']
    atomic_json(lease_path(owned), owned)
    try:
        owned['target_id'] = request(record, 'Target.createTarget', url='about:blank',
            browserContextId=owned['context_id'], background=True)['targetId']
        atomic_json(lease_path(owned), owned)
        return owned
    except BaseException:
        close_tab(owned)
        raise


def close_tab(record):
    path = lease_path(record)
    saved = read(path)
    if not saved:
        return
    if any(saved.get(k) != record.get(k) for k in ('key', 'context_id', 'webSocketDebuggerUrl')):
        raise ValueError('Headless context lease changed; refusing to close it.')
    current = read(STATE_DIR / 'browser.json')
    if current.get('key') != record['key']:
        path.unlink(missing_ok=True)
        return  # An old lease must never touch a replacement browser.
    atomic_json(path, {**saved, 'closing': True})
    dispose_context(record)
    path.unlink(missing_ok=True)


def _gone(exc):
    return any(text in str(exc).lower() for text in GONE)


def context_exists(record):
    return record['context_id'] in request(record, 'Target.getBrowserContexts').get('browserContextIds', [])


def dispose_context(record):
    """Close the page, then dispose its context. An already-gone context counts as closed.

    Disposing a context waits for its renderer to exit, which takes several
    seconds for a loaded WebGL scene; the page is closed first so nothing keeps
    rendering, and a timeout is checked against the browser before it counts
    as a failure (the lease then stays marked `closing` for cleanup to retry).
    """
    if record.get('target_id'):
        try:
            request(record, 'Target.closeTarget', targetId=record['target_id'])
        except RuntimeError as exc:
            if not _gone(exc):
                raise
    try:
        request(record, 'Target.disposeBrowserContext', timeout=DISPOSE_SECONDS, browserContextId=record['context_id'])
    except RuntimeError as exc:
        if not _gone(exc):
            raise
    except (*_websocket_errors(), OSError) as exc:
        if context_exists(record):
            raise TimeoutError(f'Headless context {record["context_id"]} did not dispose: {exc}') from exc


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def cleanup_orphans(owner_pid=None, record=None):
    """Dispose contexts whose owners have exited (persistent ones after ten minutes)."""
    cleaned, errors = [], []
    for path in (STATE_DIR / 'leases').glob('*.json'):
        lease = read(path)
        try:
            if record and lease.get('key') != record['key']:
                path.unlink(missing_ok=True)
                continue
            if not lease.get('closing') and lease.get('owner_pid') != owner_pid:
                if alive(lease['owner_pid']):
                    continue
                if lease.get('persistent') and time.time() - lease['opened_at'] < 600:
                    continue
            close_tab(lease)
            cleaned.append(lease.get('target_id'))
        except Exception as exc:
            errors.append({'lease': str(path), 'error': str(exc)})
    return {'closed': cleaned, 'errors': errors}


def persistent_tab(key):
    """A named context that survives the calling process, reused while the browser lives."""
    browser = ensure_browser()
    with browser_lock():
        path = STATE_DIR / 'agent-tabs.json'
        saved = read(path)
        record = saved.get(key)
        if record and record['key'] == browser['key'] and lease_path(record).exists():
            try:
                target = request(record, 'Target.getTargetInfo', targetId=record['target_id'])['targetInfo']
                reusable = target.get('browserContextId') == record['context_id']
            except (RuntimeError, KeyError):
                reusable = False
            if reusable:
                record.update(owner_pid=os.getpid(), opened_at=time.time())
                atomic_json(lease_path(record), record)
                return record
            close_tab(record)
        record = open_tab(browser, persistent=True)
        saved[key] = record
        atomic_json(path, saved)
        return record


# --- the supervisor process --------------------------------------------------

def serve(key):
    """Own the headless shell for one instance token until idle or signalled."""
    from playwright.sync_api import sync_playwright
    stopped = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopped.set())
    profile = (STATE_DIR / 'profiles' / key).resolve()
    profile.mkdir(parents=True, exist_ok=False)
    try:
        with sync_playwright() as playwright:
            context = playwright.chromium.launch_persistent_context(str(profile), headless=True,
                chromium_sandbox=True, timeout=25000, args=[
                    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
                    '--enable-automation',
                    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                    '--max-active-webgl-contexts=32', '--disable-background-networking',
                    '--no-first-run', '--no-default-browser-check', '--mute-audio'])
            try:
                port, endpoint = (profile / 'DevToolsActivePort').read_text().splitlines()[:2]
                record = {'provider': PROVIDER, 'key': key, 'pid': os.getpid(), 'port': int(port),
                          'profile': str(profile), 'webSocketDebuggerUrl': f'ws://127.0.0.1:{port}{endpoint}',
                          'started_at': time.time(), 'headless': True, 'graphics': 'swiftshader',
                          'version': context.browser.version}
                atomic_json(STATE_DIR / 'browser.json', record)
                last_used = time.monotonic()
                while not stopped.is_set():
                    cleanup_orphans(record=record)
                    if list((STATE_DIR / 'leases').glob('*.json')):
                        last_used = time.monotonic()
                    if time.monotonic() - last_used > IDLE_SECONDS:
                        break
                    context.pages[0].wait_for_timeout(1000)
            finally:
                context.close()
    except Exception as exc:
        atomic_json(STATE_DIR / f'error-{key}.json', {'error': str(exc), 'at': time.time()})
        raise
    finally:
        shutil.rmtree(profile, ignore_errors=True)


def setup(runtime=RUNTIME):
    """Install the pinned Playwright and its chromium-headless-shell into a venv under runs/."""
    if sys.version_info < (3, 10):
        raise SystemExit('Use Python 3.10+ to install the private browser: ./town browser setup')
    import venv
    python = runtime / 'bin/python'
    if not python.exists():
        venv.EnvBuilder(with_pip=True, symlinks=True).create(runtime)
    subprocess.run([str(python), '-m', 'pip', '--disable-pip-version-check', 'install',
                    f'playwright=={PLAYWRIGHT_VERSION}', f'websocket-client=={WEBSOCKET_CLIENT_VERSION}'], check=True)
    environment = {**os.environ, 'PLAYWRIGHT_BROWSERS_PATH': str(runtime / 'browsers')}
    subprocess.run([str(python), '-m', 'playwright', 'install', 'chromium', '--only-shell'],
                   env=environment, check=True)
    (runtime / 'installation.json').write_text(json.dumps({
        'playwright': PLAYWRIGHT_VERSION, 'browser': 'chromium-headless-shell',
        'browsers_path': environment['PLAYWRIGHT_BROWSERS_PATH']}, indent=2) + '\n')
    print(f'Private headless browser installed in {runtime}')
    return runtime


def status():
    record = read(STATE_DIR / 'browser.json')
    leases = [read(p) for p in (STATE_DIR / 'leases').glob('*.json')]
    return {'installed': installed(), 'installation': read(RUNTIME / 'installation.json'),
            'state_dir': str(STATE_DIR), 'record': record, 'healthy': bool(record) and healthy(record),
            'leases': [{k: lease.get(k) for k in ('lease_id', 'owner_pid', 'persistent', 'opened_at', 'closing')}
                       for lease in leases]}


# --- the dev server ----------------------------------------------------------

def server_up(port=SERVER_PORT):
    try:
        urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=2)
        return True
    except (urllib.error.URLError, OSError):
        return False


def server_command(port=SERVER_PORT, root=ROOT):
    """`town serve` when deploy.py is present, else a plain static server on the repo."""
    if (Path(root) / 'tinytown' / 'deploy.py').exists():
        return [sys.executable, '-B', '-c', f'from tinytown.deploy import serve; serve(port={int(port)})']
    return [sys.executable, '-m', 'http.server', str(int(port)), '--bind', '127.0.0.1', '--directory', str(root)]


def ensure_server(port=SERVER_PORT, root=ROOT):
    """Start the viewer's dev server on `port` if nothing answers there. Returns the port."""
    if server_up(port):
        return port
    subprocess.Popen(server_command(port, root), cwd=root, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(40):
        time.sleep(0.25)
        if server_up(port):
            return port
    raise RuntimeError(f'dev server did not come up on :{port}')


# --- one isolated tab over CDP -----------------------------------------------

class Tab:
    """One isolated headless context with a flat CDP session and a fixed viewport."""

    def __init__(self, width=1400, height=1000, scale=1, *, ua=UA, record=None, keep_open=False):
        self.ws = None; self.tid = None; self.logs = []; self.record = None; self.keep_open = keep_open
        try:
            self.record = record or open_tab()
            self.tid = self.record['target_id']
            self.ws = _websocket().create_connection(self.record['webSocketDebuggerUrl'], suppress_origin=True, timeout=10)
            self.ws.settimeout(120)
            self.sid = self.send('Target.attachToTarget', targetId=self.tid, flatten=True)['sessionId']
            for d in ('Page', 'Runtime', 'Network'):
                self.send(f'{d}.enable', sid=self.sid)
            self.send('Network.setUserAgentOverride', sid=self.sid, userAgent=ua)
            self.viewport(width, height, scale)
        except Exception:
            self.close()
            raise

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def send(self, method, sid=None, **params):
        i = next(_ids)
        msg = {'id': i, 'method': method, 'params': params}
        if sid:
            msg['sessionId'] = sid
        self.ws.send(json.dumps(msg))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('method') == 'Runtime.consoleAPICalled':
                self.logs.append(' '.join(str(a.get('value', a.get('description', ''))) for a in m['params']['args']))
            elif m.get('method') == 'Runtime.exceptionThrown':
                d = m['params']['exceptionDetails']
                self.logs.append('EXC ' + str((d.get('exception') or {}).get('description') or d.get('text')))
            if m.get('id') == i:
                if 'error' in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get('result', {})

    def viewport(self, width, height, scale=1):
        self._viewport = (width, height, scale)
        self.send('Emulation.setDeviceMetricsOverride', sid=self.sid, width=width, height=height,
                  deviceScaleFactor=scale, mobile=False)

    def go(self, url, **params):
        # The headless shell keeps fixed viewports for both Maps and local WebGL scenes.
        return self.send('Page.navigate', sid=self.sid, url=url, **params)

    def reset(self, timeout=5):
        """Navigate to about:blank and wait for it to commit. Google Maps is a
        single-page app: a second Maps URL loaded straight over the first is
        treated as an in-app move and keeps the old field of view and tilt."""
        self.go('about:blank')
        t0 = time.time()
        while time.time() - t0 < timeout:
            if self.url().startswith('about:blank'):
                return True
            time.sleep(0.1)
        return False

    def ev(self, expr):
        r = self.send('Runtime.evaluate', sid=self.sid, expression=expr, returnByValue=True, awaitPromise=True)
        if 'exceptionDetails' in r:
            d = r['exceptionDetails']
            raise RuntimeError((d.get('exception') or {}).get('description') or d.get('text'))
        return r.get('result', {}).get('value')

    def url(self):
        try:
            return self.ev('location.href') or ''
        except RuntimeError:
            return ''

    def wait_ready(self, timeout=20):
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                if self.ev('document.readyState') == 'complete':
                    return True
            except RuntimeError:
                pass
            time.sleep(0.25)
        return False

    def wait_town(self, timeout=90):
        """Block until the viewer has built the village (window.__town.street)."""
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                if self.ev('!!(window.__town && window.__town.street)'):
                    time.sleep(1.0)  # a couple of frames so the shadow map and post passes settle
                    return round(time.time() - t0, 1)
            except RuntimeError:
                pass
            time.sleep(0.5)
        errs = [l for l in self.logs if l.startswith('EXC')]
        raise TimeoutError('village never built' + (f': {errs[-1]}' if errs else ''))

    def wait_pano(self, timeout=45, settle=6.0):
        """Block until Google has resolved a Street View panorama.

        Returns the pano id (the `!1s<id>` URL segment) or None if Google
        says there is no coverage at that point.
        """
        t0 = time.time()
        pano = None
        while time.time() - t0 < timeout:
            u = self.url()
            if '!1s' in u:
                pano = u.split('!1s', 1)[1].split('!', 1)[0]
                break
            try:
                body = self.ev("document.body ? document.body.innerText.slice(0, 4000) : ''") or ''
                if 'No Street View' in body or "can't find Street View" in body:
                    return None
            except RuntimeError:
                pass
            time.sleep(0.5)
        if pano:
            time.sleep(settle)  # WebGL tiles keep streaming in after the URL resolves
        return pano

    def hide(self, css):
        """Inject a stylesheet (e.g. to hide UI chrome before a screenshot)."""
        try:
            self.ev("(()=>{const s=document.createElement('style');s.textContent=%s;document.head.appendChild(s);return 1})()"
                    % json.dumps(css))
        except RuntimeError:
            pass

    def hide_all_but_canvas(self):
        """Leave only the largest <canvas> (the Street View panorama) visible:
        every sibling on its ancestor chain is hidden, which removes Google's
        search box, title card, minimap and controls whatever their class names.
        Anything holding a text input (the search box is re-mounted late) is
        hidden too, up to the highest container that is not the canvas's own."""
        js = """(()=>{const cs=[...document.querySelectorAll('canvas')];if(!cs.length)return 0;
          const c=cs.sort((a,b)=>b.width*b.height-a.width*a.height)[0];
          const chain=new Set();let e=c;while(e){chain.add(e);e=e.parentElement;}
          for(const a of chain){if(!a.parentElement)continue;for(const s of a.parentElement.children){if(!chain.has(s))s.style.visibility='hidden';}}
          for(const inp of document.querySelectorAll('input,[role=search],[role=dialog]')){let t=inp,up=0;while(t.parentElement&&!chain.has(t.parentElement)&&up<12){t=t.parentElement;up++;}if(!chain.has(t))t.style.visibility='hidden';}
          return 1})()"""
        try:
            return self.ev(js)
        except RuntimeError:
            return 0

    def shot(self, path, clip=None):
        params = {'format': 'png'}
        if clip:
            params['clip'] = {**clip, 'scale': 1}
        d = self.send('Page.captureScreenshot', sid=self.sid, **params)['data']
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(base64.b64decode(d))
        return path

    def close(self):
        try:
            if self.record and not self.keep_open:
                close_tab(self.record)
                self.record = None
                self.tid = None
        except Exception:
            _log.warning('Could not close pipeline headless browser context', exc_info=True)
        finally:
            if self.ws:
                try:
                    self.ws.close()
                except Exception:
                    _log.warning('Could not close pipeline CDP connection', exc_info=True)
                self.ws = None


# --- CLI ---------------------------------------------------------------------

ACTIONS = ('setup', 'status', 'cleanup', 'stop', 'ensure', 'open-tab', 'close-tab', 'serve')


def run(args):
    action = args.action
    if action == 'setup':
        setup()
    elif action == 'status':
        print(json.dumps(status(), indent=1))
    elif action == 'cleanup':
        print(json.dumps(cleanup_orphans()))
    elif action == 'stop':
        with browser_lock():
            stop_owned(read(STATE_DIR / 'browser.json'))
    elif action == 'serve':
        if not re.fullmatch('[0-9a-f]{32}', args.instance or ''):
            raise SystemExit('serve requires an --instance token')
        serve(args.instance)
    elif action == 'ensure':
        print(json.dumps(ensure_browser()))
    elif action == 'open-tab':
        print(json.dumps(open_tab(owner_pid=args.owner_pid)))
    elif action == 'close-tab':
        close_tab(json.load(sys.stdin))
    return 0


def _arguments(parser):
    parser.add_argument('action', choices=ACTIONS, help='setup | status | cleanup | stop (the rest are the Node/supervisor bridge)')
    parser.add_argument('--owner-pid', type=int, help='open-tab: the process that owns the lease')
    parser.add_argument('--instance', help='serve: the instance token of this supervisor')
    parser.set_defaults(run=run)


def register(subparsers):
    _arguments(subparsers.add_parser('browser', help='the private headless Chromium: setup, status, cleanup, stop'))


def main(argv=None):
    parser = argparse.ArgumentParser(prog='python -m tinytown.browser', description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    _arguments(parser)
    return run(parser.parse_args(argv))


if __name__ == '__main__':
    sys.exit(main())
