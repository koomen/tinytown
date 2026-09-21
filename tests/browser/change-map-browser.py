"""The task map opens immutable bakes and keeps the old world during rebuilds."""
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tinytown import changes, change_bakes
from tinytown.browser import Tab


def wait(tab, expression):
    for _ in range(120):
        try:
            if tab.ev(expression): return
        except RuntimeError: pass
        time.sleep(.1)
    raise AssertionError(tab.ev('document.body.innerText'))


with tempfile.TemporaryDirectory(prefix='town-baked-map-') as directory:
    root = Path(directory)
    shutil.copytree(ROOT/'tinytown/web', root/'tinytown/web')
    (root/'sites/example').mkdir(parents=True)
    (root/'sites/example/site.json').write_text('{"title":"Example"}')
    (root/'src').mkdir()
    (root/'src/version.js').write_text('version one')
    (root/'.gitignore').write_text('runs/\n')
    subprocess.run(['git', 'init', '-q', str(root)], check=True)
    queue = changes.ChangeQueue(root)
    record = queue.create('Map UI test')
    queue._snapshot(record)
    record = queue.get(record['id']); record['status'] = 'pending_approval'; queue._save(record)
    server = changes.ChangeServer(('127.0.0.1', 0), queue)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    runner = "from pathlib import Path\nPath('index.html').write_text('<html><head></head><body>Baked world</body></html>')\n"
    try:
        with patch.object(change_bakes, 'RUNNER', runner), Tab() as tab:
            queue.start()
            tab.go(f'http://127.0.0.1:{server.server_port}/previews/{record["id"]}/map/')
            wait(tab, 'document.querySelector("#status").textContent === "No bake yet"')
            assert tab.ev('document.querySelector("#world").hidden')
            tab.ev('document.querySelector("#bake").click()')
            wait(tab, 'document.querySelector("#world").contentDocument?.body?.textContent === "Baked world"')
            old_url = tab.ev('document.querySelector("#world").getAttribute("src")')
            tab.ev('document.querySelector("#world").contentWindow.testToken = "keep me"')
            (queue.paths.workspace(record['id'])/'src/version.js').write_text('version two')
            wait(tab, 'document.querySelector("#status").textContent === "Source changed since this bake"')
            assert tab.ev('document.querySelector("#world").contentWindow.testToken') == 'keep me'
            with patch.object(change_bakes, 'RUNNER', "raise RuntimeError('intentional failure')"):
                tab.ev('document.querySelector("#bake").click()')
                wait(tab, '!document.querySelector("#error").hidden')
            assert tab.ev('document.querySelector("#world").getAttribute("src")') == old_url
            assert tab.ev('document.querySelector("#world").contentWindow.testToken') == 'keep me'
            tab.ev('document.querySelector("#bake").click()')
            wait(tab, 'document.querySelector("#world").getAttribute("src") !== ' + json.dumps(old_url))
            print('PASS task map: bake action, immutable view, stale notice, failed rebuild keeps old world, successful rebuild switches world')
            # Old tabs may still hold EventSource connections. They must yield
            # the six HTTP/1 slots so a navigation or asset request can finish.
            tab.ev('window.opened=0;window.legacy=Array.from({length:6},()=>new EventSource("/api/events"));legacy.forEach(e=>e.onopen=()=>opened++)')
            wait(tab, 'opened >= 6')
            tab.ev('window.requestFinished=false;fetch("/api/health").then(r=>r.json()).then(()=>requestFinished=true)')
            wait(tab, 'requestFinished')
            tab.ev('legacy.forEach(e=>e.close())')
            tab.ev('window.maps=Array.from({length:8},()=>{const f=document.createElement("iframe");f.src=location.href;document.body.append(f);return f;})')
            wait(tab, 'maps.every(f=>f.contentDocument?.querySelector("#world")?.contentDocument?.body?.textContent === "Baked world")')
            print('PASS eight open map views load; legacy event streams cannot block other requests')
    finally:
        queue.stop(); server.shutdown(); server.server_close()
