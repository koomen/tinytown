// Node 22+, private headless Chromium, uv, and internet access for pinned CDN imports.
// Run: node tests/browser/run.mjs (or node tests/browser/viewer-browser.mjs). Every test page is an owned private headless Chromium tab.
// TOWN_VIEWER_PHASE=desktop|mobile selects an independent phase for targeted reruns.
import assert from 'node:assert/strict';
import { privateBrowser } from '../../tinytown/browser.mjs';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { checkRendering } from './checks/rendering.mjs';
import { checkLighting } from './checks/lighting.mjs';
import { viewerFixture } from './viewer-fixture.mjs';

const root = fileURLToPath(new URL('../../',import.meta.url));
const fixture = viewerFixture(JSON.parse(await readFile(root+'data/avon-extended/site.json','utf8')));
let fixtureSurfaces, fixtureBytes;
let fault;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (fault === 'slow module' && path === '/src/main.js') await delay(600);
  if ((fault === 'module' && path === '/src/site.js') ||
      (fault === 'site-data module' && path === '/src/site-data.js') ||
      (fault === 'request' && path === '/data/avon-extended/site.json')) {
    res.writeHead(503); res.end('Unavailable'); return;
  }
  if (fault === 'json' && path === '/data/avon-extended/site.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{broken'); return;
  }
  if (fault === 'surface' && path.endsWith('.bin.gz')) {
    res.writeHead(200); res.end('interrupted asset'); return;
  }
  const query = new URL(req.url, 'http://localhost').searchParams;
  if (query.has('viewer-fixture') && path === '/data/avon-extended/site.json') {
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(fixture)); return;
  }
  if (query.has('viewer-fixture') && path === '/data/avon-extended/surfaces.json') {
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(fixtureSurfaces)); return;
  }
  if (fixtureSurfaces && path === '/data/avon-extended/'+fixtureSurfaces.file) {
    res.end(fixtureBytes); return;
  }
  const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    const content = await readFile(file);
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
});

async function waitFor(fn, label, timeout = 90000) {
  const end = Date.now() + timeout;
  let lastError;
  while (Date.now() < end) {
    try { const result = await fn(); if (result) return result; }
    catch (error) { lastError = error; }
    await delay(200);
  }
  throw new Error(`Timed out: ${label}${lastError ? ` (${lastError.message})` : ''}`);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
  }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timer = setTimeout(() => {
        this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`));
      }, 90000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

const tabs = new Set();
let cdp;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await privateBrowser('ensure');
  const ws = new WebSocket(browser.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  cdp = new CDP(ws);

  async function page(width = 390, height = 844) {
    const record = await privateBrowser('open-tab');
    tabs.add(record);
    const targetId = record.target_id;
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    await send('Page.enable');
    // Redirect only the startup map/manifest reads. Geometry checks fetching
    // the real region explicitly (e.g. bridge fixtures) still get full data.
    await send('Page.addScriptToEvaluateOnNewDocument', {source: `
      const originalFetch = window.fetch.bind(window), redirected = new Set();
      window.fetch = (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        if (['/data/avon-extended/site.json','/data/avon-extended/surfaces.json'].includes(url.pathname)
            && !redirected.has(url.pathname)) {
          redirected.add(url.pathname); url.searchParams.set('viewer-fixture','1');
          return originalFetch(url.href, init);
        }
        return originalFetch(input, init);
      };
    `});
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    return { send, evaluate,
      // This suite exercises the full generator, its authoring geometry, and
      // procedural fallbacks. streaming-browser.mjs covers the default route.
      go: (path = '/') => {
        const url=new URL(path,origin);url.searchParams.set('stream','0');
        return send('Page.navigate', { url:url.href });
      },
      close: async () => { await privateBrowser('close-tab', record); tabs.delete(record); },
    };
  }

  const prepare = await page(400,300);
  await prepare.send('Page.navigate',{url:origin+'/tinytown/web/precompute.html'});
  await waitFor(()=>prepare.evaluate('typeof window.precomputeSurfaces === "function"'),'fixture surface builder');
  fixtureSurfaces = await prepare.evaluate("window.precomputeSurfaces('/data/avon-extended/site.json?viewer-fixture=1','avon-extended')");
  fixtureBytes = Buffer.from(fixtureSurfaces.base64,'base64');
  delete fixtureSurfaces.base64;
  fixtureSurfaces.file = 'surfaces-ffffffffffffffff.bin.gz';
  await prepare.close();

  if (process.env.TOWN_VIEWER_PHASE !== 'mobile') {
  const p = await page();
  await p.go();
  await waitFor(() => p.evaluate('!!window.__town'), 'Avon first render');
  assert.equal(await p.evaluate('window.__town.street.precomputedSurfaces'), true, 'Avon should use prepared surfaces');
  await waitFor(() => p.evaluate('!document.getElementById("loading")'), 'loading overlay dismissal');
  const surfaces = await p.evaluate(`(async () => {
    const {checkOpenPavilion}=await import('/tests/browser/checks/pavilion.js');
    checkOpenPavilion();
    const {checkSurfaceBaking,checkEntranceFrames}=await import('/tests/browser/checks/materials.js');
    const {checkJoinedSurfaces,checkGasStation,checkStreetGrade,checkFacadeJoins}=await import('/tests/browser/checks/surfaces.js');
    checkJoinedSurfaces();
    checkStreetGrade(window.__town);
    await checkFacadeJoins(window.__town);
    await checkGasStation();
    const {checkRuralSurfaces}=await import('/tests/browser/checks/rural-surfaces.js');
    await checkRuralSurfaces();
    const {checkSpringBridge,checkFiveArchBridge}=await import('/tests/browser/checks/bridge.js');
    await checkSpringBridge();
    await checkFiveArchBridge();
    const {checkVillageCrossings}=await import('/tests/browser/checks/crossings.js');
    checkVillageCrossings(window.__town);
    checkEntranceFrames();
    const count=checkSurfaceBaking();
    const programs=window.__town.renderer.info.programs;
    if(programs.some(p => p.diagnostics?.runnable===false)) throw new Error('Scene shader failed to compile');
    return count;
  })()`);
  console.log(`PASS joined street surfaces, pub/spa sidewalk heights, surface shaders, pane batching (${surfaces} batches), and entrance alignment`);
  const framing = await p.evaluate(`(() => {
    const {controls, camera} = window.__town;
    const initial = camera.position.distanceTo(controls.target);
    for (let i = 0; i < 120; i++) controls.update();
    return {initial, settled: camera.position.distanceTo(controls.target), limit: controls.maxDistance};
  })()`);
  assert.ok(Math.abs(framing.initial - 320) < 0.001, JSON.stringify(framing));
  assert.ok(Math.abs(framing.initial - framing.settled) < 0.001, 'portrait view must not zoom itself in');
  assert.ok(framing.limit >= framing.initial - 0.001);
  const opening = await p.evaluate(`(() => {
    const w=window.__town, target=w.controls.target;
    return {target:target.toArray(), ground:w.street.surfaces.grade(-25,25),
      theta:w.controls.theta, elevation:w.controls.elevation, fov:w.camera.fov};
  })()`);
  assert.deepEqual([opening.target[0],opening.target[2]],[-25,25]);
  assert.ok(Math.abs(opening.target[1]-opening.ground-3)<1e-6);
  assert.equal(opening.theta,2);
  assert.ok(Math.abs(opening.elevation-35.264*Math.PI/180)<1e-6);
  assert.equal(opening.fov,40, 'portrait framing must widen without excessive empty sky');

  // A previous tab's saved pose must not replace the chosen opening view.
  await p.evaluate(`(() => {
    const w=window.__town,s=w.siteData;
    w.controls.set({theta:0.4,distance:600,target:w.controls.target.clone().set(80,20,90)});
    sessionStorage.setItem('town-camera',JSON.stringify({site:'avon-extended',
      frame:JSON.stringify([s.center,s.bounds,s.size]),pos:w.camera.position.toArray(),
      target:w.controls.target.toArray(),groundFollowing:true}));
  })()`);
  await p.send('Page.reload');
  await waitFor(()=>p.evaluate('!!window.__town && window.__town.controls.target.x === -25'), 'opening camera after reload');
  assert.deepEqual(await p.evaluate('window.__town.controls.target.toArray()'),opening.target);
  await p.send('Emulation.setDeviceMetricsOverride',{width:1200,height:630,deviceScaleFactor:1,mobile:false});
  await waitFor(()=>p.evaluate('window.__town.camera.aspect === 1200/630'), 'landscape opening view');
  assert.equal(await p.evaluate('window.__town.camera.fov'),26);
  assert.deepEqual(await p.evaluate('window.__town.controls.target.toArray()'),opening.target);
  console.log('PASS Avon circle camera pose, portrait framing, reload reset, and landscape resize');
  await checkLighting(p, waitFor);
  await p.evaluate("localStorage.setItem('town-time','night')");
  await p.go('/?time=day');
  await waitFor(() => p.evaluate('!!window.__town && !document.getElementById("loading")'), 'explicit daytime override');
  assert.equal(await p.evaluate('window.__town.lighting.mode'), 'day');
  await p.go('/');
  await waitFor(() => p.evaluate('!!window.__town && !document.getElementById("loading")'), 'saved night preference');
  assert.equal(await p.evaluate('window.__town.lighting.mode'), 'night');
  await p.evaluate("window.__town.lighting.setMode('day')");
  console.log('PASS saved time of day and explicit URL override');

  const refs = await p.evaluate(`(() => {
    const street = window.__town.street;
    const inScene = o => { for (; o; o = o.parent) if (o === street.group) return true; return false; };
    return {count: street.smokes.length, valid: street.smokes.every(e =>
      Object.values(e).filter(v => v?.isObject3D).every(inScene) && e.puffs.every(p => inScene(p.mesh)))};
  })()`);
  assert.ok(refs.count > 0 && refs.valid, 'smoke must only retain objects in the baked scene');
  console.log(`PASS ${refs.count} blueprint smoke emitters retain only the baked scene`);
  const precomputed = await p.evaluate(`(async () => {
    const { checkPrecomputedSurfaces } = await import('/tests/browser/checks/precomputed.js');
    return checkPrecomputedSurfaces();
  })()`);
  console.log(`PASS precomputed/procedural geometry, seeded props, shifted terrain and ${precomputed.surfaceSamples} pavement samples`);

  const controls = await p.evaluate(`(() => {
    const {controls} = window.__town;
    const saved = controls.distance;
    controls.set({distance: controls.maxDistance * 2});
    const max = controls.distance === controls.maxDistance && controls.distance === controls._goal.distance;
    controls.set({distance: 0});
    const min = controls.distance === controls.minDistance && controls.distance === controls._goal.distance;
    controls.set({distance: saved});
    return min && max;
  })()`);
  assert.equal(controls, true);
  await p.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => p.evaluate('innerWidth === 320 && window.__town.camera.aspect === 320/900'), 'viewport resize');
  assert.equal(await p.evaluate(`(() => {
    const w=window.__town; w.frameCamera();
    return w.controls.distance > 2200 && w.controls.distance === w.controls._goal.distance;
  })()`), true);
  console.log('PASS camera clamping and reframing after resize');

  // Exercise the separate, procedural-house emitter path on a small site.
  const procedural = await p.evaluate(`(async () => {
    const {generateSite} = await import('/src/site.js');
    const buildings = Array.from({length: 4}, (_, i) => {
      const x = (i % 2) * 18 - 9, z = Math.floor(i / 2) * 18 - 9;
      return {id:i, centroid:[x,z], pts:[[x-5,z-4],[x+5,z-4],[x+5,z+4],[x-5,z+4]],
        obb:{cx:x,cz:z,w:10,d:8,angle:0}, style:{kind:'house',roof:'gable'}};
    });
    const street = await generateSite({size:{w:60,h:60}, roads:[], areas:[], pois:[], buildings,
      terrain:{x0:-40,x1:40,z0:-40,z1:40,cols:2,rows:2,values:[0,0,0,0]}}, 'smoke-regression', {trees:false});
    const inScene = o => { for (; o; o=o.parent) if (o===street.group) return true; return false; };
    return {count:street.smokes.length, valid:street.smokes.every(e =>
      Object.values(e).filter(v=>v?.isObject3D).every(inScene) && e.puffs.every(p=>inScene(p.mesh)))};
  })()`);
  assert.ok(procedural.count > 0 && procedural.valid, JSON.stringify(procedural));
  console.log('PASS procedural smoke emitters retain only the baked scene');
  const polygon = await p.evaluate(`(async () => {
    const {checkPolygonBlueprint} = await import('/tests/browser/checks/polygon.js');
    return checkPolygonBlueprint();
  })()`);
  console.log(`PASS polygon roof (${polygon.interior} interior / ${polygon.exterior} exterior samples) and ${polygon.edges} facade edges`);
  const frameSamples = await p.evaluate(`(async () => {
    const {checkWindowFrames} = await import('/tests/browser/checks/windows.js');
    return checkWindowFrames();
  })()`);
  console.log(`PASS uniform window frames (${frameSamples} edge measurements across seven window sizes/styles)`);
  const wallSamples = await p.evaluate(`(async () => {
    const {checkLaundromatWalls} = await import('/tests/browser/checks/surfaces.js');
    return checkLaundromatWalls();
  })()`);
  console.log(`PASS continuous laundromat side walls (${wallSamples} samples)`);
  const traceryOpenings = await p.evaluate(`(async () => {
    const {checkOrnamentalWindows} = await import('/tests/browser/checks/windows.js');
    return checkOrnamentalWindows();
  })()`);
  console.log(`PASS ornamental window tracery (${traceryOpenings} open panes)`);
  const railways = await p.evaluate(`(async () => {
    const {checkRailways} = await import('/tests/browser/checks/railways.js');
    return checkRailways();
  })()`);
  console.log(`PASS railway beds, paired rails and level crossings (${railways.sleepers} sleepers)`);
  const navigation = await p.evaluate(`(async () => {
    const {checkTerrainNavigation} = await import('/tests/browser/checks/navigation.js');
    return checkTerrainNavigation();
  })()`);
  assert.equal(navigation.terrainClearance, 4);
  console.log('PASS terrain-following camera panning preserves zoom distance');
  const fidelity = await p.evaluate(`(async()=>{const {checkFidelityGeometry}=await import('/tests/browser/checks/fidelity.js');return checkFidelityGeometry();})()`);
  console.log(`PASS custom fidelity geometry (${fidelity.caps} fitted capitals, ${fidelity.bars} clipped mullions)`);
  const heads = await p.evaluate(`(async () => {
    const {checkDoorHeads} = await import('/tests/browser/checks/doors.js');
    return checkDoorHeads();
  })()`);
  console.log(`PASS complete door transoms/fanlights (${heads.samples} samples across ${heads.cases} cases)`);
  await checkRendering(p, waitFor);
  await p.close();

  const free = await page(390, 844);
  await free.go('/?free=1');
  await waitFor(() => free.evaluate('!!window.__town'), 'orbit camera first render');
  await checkRendering(free, waitFor, {free: true});
  await free.close();
  }

  if (process.env.TOWN_VIEWER_PHASE !== 'desktop') {
  const phone = await page(390, 844);
  await phone.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844});
  await phone.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 2});
  await phone.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.documentStarts = Number(sessionStorage.documentStarts || 0) + 1;
    window.addEventListener('load', () => {
      window.__canvasAtLoad = !!document.querySelector('#app canvas');
    });
    window.__loadingSamples = [];
    function sampleProgress() {
      const bar = document.querySelector('#loading .bar');
      if (bar) window.__loadingSamples.push({ width: bar.getBoundingClientRect().width, phase: document.querySelector('#loading .what').textContent });
      if (!window.__town) requestAnimationFrame(sampleProgress);
    }
    requestAnimationFrame(sampleProgress);
  ` });
  fault = 'slow module';
  await phone.go();
  await waitFor(() => phone.evaluate('!!window.__town && !document.getElementById("loading")'), 'phone first render');
  fault = null;
  const startup = await phone.evaluate(`({
    documents: Number(sessionStorage.documentStarts), canvasAtLoad: window.__canvasAtLoad,
    textures: performance.getEntriesByType('resource').filter(r => r.name.includes('/textures/')).map(r => ({ name: r.name, start: r.startTime })),
    moduleStart: window.__town.timing.moduleStart,
  })`);
  assert.equal(startup.documents, 1, 'startup must not navigate or reload');
  assert.equal(startup.canvasAtLoad, true, 'document loading must include the viewer module graph');
  assert.equal(startup.textures.length, 2, 'each sign texture should download once');
  assert.ok(startup.textures.every(r => r.start < startup.moduleStart), 'textures must start before scene construction: '+JSON.stringify(startup));
  console.log('PASS one document load includes delayed scene modules and early, deduplicated textures');
  const mobile = await phone.evaluate(`(async () => {
    const {checkMobileGeometry, checkMobileScene} = await import('/tests/browser/checks/mobile.js');
    return {scene: checkMobileScene(window.__town), geometry: await checkMobileGeometry()};
  })()`);
  console.log(`PASS mobile geometry, foliage placement, pane variation and memory budget (${mobile.scene.geometryBytes} bytes)`);
  const loadingSamples = await phone.evaluate('window.__loadingSamples');
  assert.ok(new Set(loadingSamples.map(s => s.phase)).size >= 3, 'sample multiple loading phases');
  assert.ok(loadingSamples.every((s, i) => !i || s.width >= loadingSamples[i - 1].width - 0.1), 'mobile loading bar must never reset');
  console.log('PASS mobile progress advances across phases without resetting');
  await checkLighting(phone, waitFor, {mobile:true});
  await phone.send('Emulation.setDeviceMetricsOverride', {width: 844, height: 390, deviceScaleFactor: 3, mobile: true, screenWidth: 844, screenHeight: 390});
  await waitFor(() => phone.evaluate('window.__town.renderer.domElement.width === 1477 && window.__town.composer.renderTarget1.width === 1477'), 'phone rotation resizes buffers');
  await phone.evaluate('window.__town.renderer.forceContextLoss()');
  await waitFor(() => phone.evaluate('!!document.querySelector(".render-error") && window.__town.renderLoop.sleeping'), 'context loss pauses with recovery UI');
  await phone.evaluate('window.__town.renderer.forceContextRestore()');
  await waitFor(() => phone.evaluate('!document.querySelector(".render-error") && !window.__town.renderLoop.sleeping && !window.__town.renderer.getContext().isContextLost()'), 'graphics context recovers');
  await phone.go();
  await waitFor(() => phone.evaluate('!!window.__town && !document.getElementById("loading")'), 'phone reload');
  assert.equal(await phone.evaluate('window.__town.quality.name'), 'mobile');
  console.log('PASS phone rotation, WebGL context recovery and reload');
  await phone.close();

  const resolutionPhone = await page(390, 844);
  await resolutionPhone.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  for (const [resolution, ratio] of [['', 1.75], ['desktop', 1.75], ['0.5', 0.5], ['0.25', 0.25]]) {
    await resolutionPhone.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
    await resolutionPhone.go(resolution ? `/?resolution=${resolution}` : '/');
    await waitFor(() => resolutionPhone.evaluate('!!window.__town'), `phone resolution ${resolution}`);
    const inspect = () => resolutionPhone.evaluate(`(() => {
      const w = window.__town, canvas = w.renderer.domElement;
      return { ratio: w.renderer.getPixelRatio(), width: canvas.width, height: canvas.height,
        targetWidth: Math.floor(w.composer.renderTarget1.width), targetHeight: Math.floor(w.composer.renderTarget1.height),
        profile: w.quality.name, mobileGeometry: !!w.street.group.userData.mobileBake,
        expensiveEffects: !!(w.gtao || w.bokeh || w.bloom), shadow: w.sun.shadow.mapSize.x,
        scaling: getComputedStyle(canvas).imageRendering };
    })()`);
    const check = (state, width, height) => {
      assert.equal(state.ratio, ratio);
      assert.equal(state.width, Math.floor(width * ratio));
      assert.equal(state.height, Math.floor(height * ratio));
      assert.equal(state.targetWidth, state.width);
      assert.equal(state.targetHeight, state.height);
      assert.equal(state.profile, 'mobile');
      assert.equal(state.mobileGeometry, true);
      assert.equal(state.expensiveEffects, false);
      assert.equal(state.shadow, 1024);
      assert.equal(state.scaling, ratio < 1 ? 'pixelated' : 'auto');
    };
    check(await inspect(), 390, 844);
    await resolutionPhone.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true, screenWidth: 844, screenHeight: 390 });
    await waitFor(() => resolutionPhone.evaluate(`window.__town.renderer.domElement.width === ${Math.floor(844 * ratio)}`), `resolution ${resolution} rotation`);
    check(await inspect(), 844, 390);
  }
  await resolutionPhone.close();
  console.log('PASS sharp and pixelated phone resolutions preserve mobile budgets and resize all buffers');

  fault = 'surface';
  const fallback = await page(800, 600);
  await fallback.go('/?quality=mobile');
  await waitFor(() => fallback.evaluate('!!window.__town'), 'corrupt surface falls back to generation');
  assert.equal(await fallback.evaluate('window.__town.street.precomputedSurfaces'), false);
  await fallback.close();
  console.log('PASS corrupt surface asset still renders the complete town');
  fault = null;

  for (const mode of ['request', 'json', 'module', 'site-data module', 'missing']) {
    fault = mode;
    const p = await page(800, 600);
    await p.go(mode === 'missing' ? '/?site=missing-test-site' : '/');
    await waitFor(() => p.evaluate('!!document.querySelector("#loading.failed .retry:not([hidden])")'), `${mode} error UI`);
    assert.equal(await p.evaluate('document.querySelector("#loading .what").getAttribute("role")'), 'alert');
    console.log(`PASS ${mode} failure shows retry`);
    if (mode === 'request') {
      fault = null;
      await p.evaluate('document.querySelector(".retry").click()');
      await waitFor(() => p.evaluate('!!window.__town && !document.getElementById("loading")'), 'retry recovery');
      console.log('PASS retry loads the town after the failure clears');
    }
    await p.close();
  }
  }
  console.log('All selected browser checks passed.');
} finally {
  cdp?.ws.close();
  for (const record of tabs) await privateBrowser('close-tab', record).catch(error => console.error(error.message));
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
