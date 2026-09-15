#!/usr/bin/env python3
"""Exercise real headless WebGL, concurrent isolation, orphan cleanup and restart.

Run after `./town browser setup`, using a Python with websocket-client
(.venv/bin/python). This uses a separate temporary browser supervisor; it never
stops active pipeline browsers.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tinytown import browser  # noqa: E402
from tinytown.browser import Tab, ensure_browser, ensure_server  # noqa: E402


def wait_ready(tab, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if tab.ev('document.readyState') == 'complete':
                return True
        except RuntimeError:
            pass
        time.sleep(0.25)
    return False


def main():
    port = ensure_server()
    with tempfile.TemporaryDirectory(prefix='miniature-headless-test-') as directory:
        browser.STATE_DIR = Path(directory).resolve()
        os.environ['PIPELINE_BROWSER_STATE_DIR'] = str(browser.STATE_DIR)
        try:
            with ThreadPoolExecutor(max_workers=4) as pool:
                records = list(pool.map(lambda _: ensure_browser(), range(4)))
            assert len({r['key'] for r in records}) == 1, 'Concurrent startup created duplicate browsers'
            record = records[0]

            def render(n):
                with Tab(400, 300) as tab:
                    # Any small same-origin document will do for a WebGL smoke test.
                    tab.go(f'http://127.0.0.1:{port}/sites/deploy.json')
                    assert wait_ready(tab)
                    result = tab.ev('''(()=>{
                      const canvas=document.createElement('canvas');
                      const gl=canvas.getContext('webgl2');
                      if(!gl)throw new Error('Missing WebGL2');
                      gl.clearColor(1,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
                      const pixel=new Uint8Array(4);
                      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
                      localStorage.setItem('isolation-test', ''' + json.dumps(str(n)) + ''');
                      return {pixel:[...pixel],viewport:[innerWidth,innerHeight]};
                    })()''')
                    assert result == {'pixel': [255,0,0,255], 'viewport': [400,300]}, result
                    # Keep all contexts active until their different values are set.
                    barrier.wait(timeout=30)
                    assert tab.ev('localStorage.getItem("isolation-test")') == str(n)
                    return tab.record['context_id']
            import threading
            barrier = threading.Barrier(4)
            with ThreadPoolExecutor(max_workers=4) as pool:
                contexts = list(pool.map(render, range(4)))
            assert len(set(contexts)) == 4
            assert browser.request(record, 'Target.getBrowserContexts')['browserContextIds'] == []

            child = subprocess.run([sys.executable, '-c',
                'import sys;sys.path.insert(0,sys.argv[1]);from tinytown import browser as b;'
                'b.open_tab();print("abandoned lease created")', str(ROOT)],
                check=True, capture_output=True, text=True)
            assert 'created' in child.stdout
            assert not browser.cleanup_orphans(record=record)['errors']
            assert browser.request(record, 'Target.getBrowserContexts')['browserContextIds'] == []

            # Simulate losing the browser while its supervisor is still present.
            browser.request(record, 'Browser.close')
            replacement = ensure_browser()
            assert replacement['key'] != record['key']
            assert browser.healthy(replacement)
            assert replacement['profile'] != record['profile']
            print(json.dumps({'status': 'passed', 'concurrent_contexts': len(contexts),
                              'orphan_cleanup': True, 'restart': True,
                              'provider': replacement['provider'], 'version': replacement['version']}))
        finally:
            browser.stop_owned(browser.read(browser.STATE_DIR / 'browser.json'))


if __name__ == '__main__':
    main()
