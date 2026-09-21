"""Live preview smoke: node tests/browser/run.mjs preview (private Chromium required)."""
import json,shutil,tempfile,threading,time
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tinytown.changes import ChangeQueue,ChangeServer
from tinytown.browser import Tab
from tinytown.paths import SitePaths

def asset(version):
 return f'''import * as THREE from 'three';
export function preview() {{const mesh=new THREE.Mesh(new THREE.BoxGeometry(4,4,4),new THREE.MeshStandardMaterial({{color:0x4488aa}}));mesh.name='version-{version}';return mesh;}}
'''
def wait(tab, expression, timeout=35):
 for _ in range(timeout*4):
  try:
   value=tab.ev(expression)
   if value:return value
  except RuntimeError:pass
  time.sleep(.25)
 raise AssertionError(tab.ev('document.body.innerText'))
with tempfile.TemporaryDirectory(prefix='town-preview-sse-') as directory:
 root=Path(directory)
 shutil.copytree(ROOT/'tinytown',root/'tinytown',ignore=shutil.ignore_patterns('__pycache__'))
 shutil.copytree(ROOT/'src',root/'src')
 module=root/'src'/'example.js'
 module.write_text(asset(1))
 queue=ChangeQueue(root)
 record=queue.create_preview({'asset':{'module':'src/example.js'}})
 server=ChangeServer(('127.0.0.1',0),queue)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with Tab() as tab:
   tab.go(f'http://127.0.0.1:{server.server_port}'+record['url'])
   wait(tab,"window.__townPreview?.scene.getObjectByName('version-1')?.name")
   tab.ev('__townPreview.camera.position.set(12,14,16);__townPreview.controls.update();__townPreview.controls.dispatchEvent({type:"end"})')
   expected=tab.ev('__townPreview.camera.position.toArray()')
   module.write_text(asset(2))
   wait(tab,"window.__townPreview?.scene.getObjectByName('version-2')?.name")
   actual=tab.ev('__townPreview.camera.position.toArray()')
   assert all(abs(a-b)<1e-8 for a,b in zip(expected,actual)),(expected,actual)
   module.write_text('export broken syntax')
   wait(tab,'document.querySelector("#status.error")?.textContent')
   module.write_text(asset(3))
   wait(tab,"window.__townPreview?.scene.getObjectByName('version-3')?.name")
   for name in ('tree', 'bench', 'playground', 'fountain'):
    stock = queue.create_preview({'asset': {'module': 'tinytown/web/preview-assets.js', 'export': name}})
    tab.go(f'http://127.0.0.1:{server.server_port}'+stock['url'])
    wait(tab, f"window.__townPreview?.scene.getObjectByName('preview-{name}')?.children.length")
    print(f'PASS stock asset preview: {name}')
   print('PASS real ChangeServer SSE: asset reload, camera preserved, invalid edit error, recovery')
   # Small real source towns keep the map interaction test quick. Unit tests
   # separately verify workspace routing and that whole scenes are not cropped.
   for name, width in [('first', 80), ('second', 120)]:
    paths = SitePaths(name, root)
    values = [(paths.config, {'title': name}),
              (paths.request, {'center': {'lat': 42, 'lon': -77}, 'size_m': {'w': width, 'h': 80}}),
              (paths.osm, {'elements': []}),
              (paths.elevation, {'cols': 2, 'rows': 2, 'values': [100]*4,
                                'bounds': {'north':42.01, 'south':41.99, 'east':-76.99, 'west':-77.01}})]
    for path, value in values:
     path.parent.mkdir(parents=True, exist_ok=True); path.write_text(json.dumps(value))
   standalone = queue.create_preview({'site': 'first', 'whole_map': True})
   tab.go(f'http://127.0.0.1:{server.server_port}' + standalone['url'])
   wait(tab, 'window.__townPreview?.data.preview.whole_map')
   assert tab.ev('__townPreview.data.size.w') == 80
   tab.ev('__townPreview.camera.position.set(12,14,16);__townPreview.controls.update();__townPreview.controls.dispatchEvent({type:"end"})')
   expected = tab.ev('__townPreview.camera.position.toArray()')
   override = SitePaths('first', root).overrides
   override.write_text(json.dumps({'title': 'Edited map'}))
   wait(tab, 'window.__townPreview?.data.title === "Edited map"')
   assert all(abs(a-b)<1e-8 for a,b in zip(expected,tab.ev('__townPreview.camera.position.toArray()')))
   tab.ev('document.querySelector("#map-time").click()')
   assert tab.ev('document.querySelector("#map-time").textContent') == 'Day'
   override.write_text('invalid json')
   wait(tab, 'document.querySelector("#status.error")?.textContent')
   override.write_text(json.dumps({'title': 'Recovered map'}))
   wait(tab, 'window.__townPreview?.data.title === "Recovered map"')
   assert tab.ev('document.querySelector("#map-time").textContent') == 'Day'
   tab.ev('document.querySelector("#map-fit").click()')
   assert tab.ev('__townPreview.camera.position.toArray()') != expected
   tab.ev('const select=document.querySelector("#map-site");select.value="second";select.dispatchEvent(new Event("change"))')
   wait(tab, 'window.__townPreview?.data.size.w === 120')
   assert tab.ev('window.previewConfig.events.endsWith("?site=second")')
   print('PASS standalone source map: source edits, camera preserved, day/night, error recovery, fit, town switching')
 finally:
  queue.halt.set();server.shutdown();server.server_close()
