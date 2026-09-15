#!/usr/bin/env python3
# /// script
# dependencies = ["websocket-client"]
# ///
"""Check the standalone Chautauqua release at desktop and phone sizes.

Build it first: ./town deploy --target chautauqua. Run: ./town browser setup, then
.venv/bin/python tests/browser/chautauqua-browser.py (or uv run for the inline deps).
"""
import base64
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tinytown.browser import Tab, ensure_server  # noqa: E402


def main():
    scope = json.loads((ROOT / 'sites/chautauqua/scope.json').read_text())
    expected = sorted(scope['building_ids'])
    dev = ensure_server()  # the repo-root dev server, for the shared check modules
    # Use an OS-assigned port so another local preview cannot be disrupted.
    server = subprocess.Popen([sys.executable, '-u', '-c',
        'import http.server,os;os.chdir("dist/chautauqua");'
        's=http.server.ThreadingHTTPServer(("127.0.0.1",0),http.server.SimpleHTTPRequestHandler);'
        'print(s.server_port,flush=True);s.serve_forever()'], cwd=ROOT,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        port = int(server.stdout.readline().strip())
        url = f'http://127.0.0.1:{port}/'
        with Tab(1200, 800) as tab:
            tab.go(f'http://127.0.0.1:{dev}/?site=chautauqua')
            tab.wait_town()
            tab.ev("import('/tests/browser/checks/fountain.js').then(m => m.checkFountain())")
            tab.ev("import('/tests/browser/checks/amphitheater.js').then(m => m.checkAmphitheater())")
            tab.ev("import('/tests/browser/checks/chautauqua-geometry.js').then(m => [m.checkLakefront(),m.checkUpperPorches()])")
            tab.ev("import('/tests/browser/checks/open-halls.js').then(m => [m.checkOpenHallsAndPerimeter(),m.checkHallFoundations(window.__town)])")
            for width, height, quality in [(1200,800,'desktop'), (390,844,'mobile')]:
                tab.send('Emulation.setDeviceMetricsOverride', sid=tab.sid,
                         width=width, height=height, screenWidth=width, screenHeight=height,
                         deviceScaleFactor=1, mobile=quality == 'mobile')
                tab.send('Emulation.setTouchEmulationEnabled', sid=tab.sid,
                         enabled=quality == 'mobile')
                tab.go(url + '?quality=' + quality)
                tab.wait_town()
                tab.ev('window.__town.frameCamera()')
                result = tab.ev("""(() => {
                  const town=window.__town;
                  return {ids:town.siteData.buildings.map(b=>String(b.id)).sort(),
                    perimeter:town.siteData.landmarks.filter(f=>f.kind==='barrier').length,
                    grounds:town.siteData.size_m,
                    authored:town.siteData.buildings.every(b=>!!b.blueprint),
                    title:document.title,site:document.querySelector('meta[name="town-site"]').content,
                    errors:document.querySelector('#loading .error-details pre')?.textContent || '',
                    canvas:!!document.querySelector('canvas'),
                    captionFits:document.querySelector('#place .name').getBoundingClientRect().right <= innerWidth,
                    metadata:[...document.querySelectorAll('meta,link[rel="canonical"]')].map(n=>n.outerHTML).join('')};
                })()""")
                assert result['ids'] == expected, result
                assert result['perimeter'] == 10, result
                assert result['authored'] and result['canvas'] and not result['errors'], result
                assert result['captionFits'], result
                assert result['site'] == 'chautauqua' and 'Chautauqua' in result['title'], result
                assert 'avon.town' not in result['metadata'], result
                tab.ev("window.__town.lighting.setMode('night'); window.__town.renderLoop.wake()")
                assert tab.ev("document.documentElement.dataset.time") == 'night'
                tab.ev("window.__town.lighting.setMode('day'); window.__town.renderLoop.wake()")
                time.sleep(.5)
                # Diagnostic captures live under runs/, not in the miniature's data.
                tab.shot(str(ROOT / f'runs/chautauqua/release-{quality}.png'))
                print(f'{quality}: {len(expected)} authored structures, independent default scene and metadata, day/night OK')
            tab.send('Emulation.setDeviceMetricsOverride', sid=tab.sid, width=1200, height=630,
                     screenWidth=1200, screenHeight=630, deviceScaleFactor=1, mobile=False)
            tab.send('Emulation.setTouchEmulationEnabled', sid=tab.sid, enabled=False)
            tab.go(url + '?time=day')
            tab.wait_town()
            tab.ev('window.__town.frameCamera()')
            tab.hide('#loading,#place{display:none!important}')
            tab.ev('window.__town.renderLoop.wake()')
            time.sleep(.5)
            # Keep diagnostic captures separate from the selected share image.
            overview = ROOT / 'runs/chautauqua/release-overview.jpg'
            overview.parent.mkdir(parents=True, exist_ok=True)
            overview.write_bytes(base64.b64decode(
                tab.send('Page.captureScreenshot', sid=tab.sid, format='jpeg', quality=92)['data']))
    finally:
        server.terminate()
        server.wait(timeout=5)


if __name__ == '__main__':
    main()
