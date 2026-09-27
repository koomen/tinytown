import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {bridgePython, withBrowser, waitFor} from '../../tinytown/browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const base = '/previews/school-track/';
const generated = spawnSync(bridgePython(), ['-B', '-c', `
import json
from tinytown.preview import document, scene
spec = {'site': 'avon-extended', 'target': 'avon-school-running-track', 'radius': 120}
print(json.dumps({'document': document(spec, '${base}'), 'scene': scene('.', spec)}))
`], {cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
assert.equal(generated.status, 0, generated.stderr);
const fixture = JSON.parse(generated.stdout);
const output = root + 'runs/school-track-preview';
await mkdir(output, {recursive: true});
let releaseImage;
const imageReady = new Promise(resolve => { releaseImage = resolve; });
const imageRequests = [];
await withBrowser(root, async page => {
  const errors = [];
  page.events.add(m => { if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails); });
  await page.go(base);
  await waitFor(() => page.evaluate('!!window.__townPreview'), 'track preview', 60000);
  // Hold the image until the first render. A successful request alone is not
  // enough: its canvas texture must reach the GPU without any camera input.
  const before = await page.evaluate(`(() => {
    const p = __townPreview, mesh = p.scene.getObjectByName('football-field-paint');
    window.fieldTexture = mesh.material.map;
    return {version: fieldTexture.version, frame: p.renderer.info.render.frame,
      pixels: fieldTexture.image.getContext('2d').getImageData(460,970,100,100).data.join(',')};
  })()`);
  releaseImage();
  await waitFor(() => page.evaluate(`fieldTexture.version > ${before.version}
    && __townPreview.renderer.properties.get(fieldTexture).__version === fieldTexture.version
    && __townPreview.renderer.info.render.frame > ${before.frame}`), 'midfield logo uploaded and rendered', 15000);
  const after = await page.evaluate("fieldTexture.image.getContext('2d').getImageData(460,970,100,100).data.join(',')");
  assert.notEqual(after, before.pixels, 'Braves image changes the midfield pixels');
  assert.deepEqual(imageRequests, [base + 'files/data/avon-extended/textures/avon-braves-emblem.png'],
    'load the emblem from the preview workspace');
  for (const [name, offset] of [['top', [0,310,55]], ['iso', [180,220,180]]]) {
    await page.evaluate(`(() => {
      const p = __townPreview, field = p.scene.getObjectByName('football-field-paint');
      field.geometry.computeBoundingSphere();
      const center = field.localToWorld(field.geometry.boundingSphere.center.clone());
      p.controls.target.copy(center);
      p.camera.position.copy(center).add({x:${offset[0]}, y:${offset[1]}, z:${offset[2]}});
      p.controls.update();
    })()`);
    const shot = await page.send('Page.captureScreenshot', {format: 'png'});
    await writeFile(output + '/' + name + '.png', Buffer.from(shot.data, 'base64'));
  }
  assert.deepEqual(errors, [], 'preview has no browser exceptions');
  console.log('PASS track preview: workspace emblem URL, delayed logo pixels uploaded and rendered without interaction');
}, {width: 1400, height: 1000, route: async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const reply = (body, type = 'application/json') => { res.setHeader('Content-Type', type); res.end(body); return true; };
  if (path === base) return reply(fixture.document, 'text/html');
  if (path === base + 'scene.json') return reply(JSON.stringify(fixture.scene));
  if (path === base + 'events') return reply(JSON.stringify({fingerprint: 'test'}));
  if (path.endsWith('/avon-braves-emblem.png')) {
    imageRequests.push(path);
    if (!path.startsWith(base + 'files/')) { res.writeHead(404); res.end(); return true; }
    await imageReady;
  }
  if (path.startsWith(base + 'files/')) {
    const name = path.slice((base + 'files/').length);
    const type = name.endsWith('.png') ? 'image/png' : 'text/javascript';
    return reply(await readFile(root + name), type);
  }
  return false;
}});
