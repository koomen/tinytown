// node tests/streaming-browser.mjs — actual network, WebGL, and disposal checks.
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowser, waitFor } from '../../tinytown/browser.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const manifest=JSON.parse(await readFile(root+'/data/avon/stream/manifest.json'));
const expectedBuildings=JSON.parse(await readFile(root+'/data/avon/site.json')).buildings.length;
const requests=[],errors=[];
let fault='';
await withBrowser(root,async page=>{
  page.events.add(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
  const stats=()=>page.evaluate('__town.streaming.stats');
  const ready=async()=>{
    await waitFor(()=>page.evaluate('!!window.__town && !document.getElementById("loading")'),'streaming first frame');
    await waitFor(()=>page.evaluate('!__town.streaming.stats.loading && __town.streaming.stats.desired.every(id=>__town.streaming.stats.resident.includes(id))'),'visible details settle');
  };
  const move=async(x,z,distance=190)=>page.evaluate(`(async()=>{
    const w=__town,target=w.controls.target.clone();target.set(${x},w.street.surfaces.grade(${x},${z})+3,${z});
    w.controls.set({target,theta:0.9,distance:${distance}});w.renderLoop.wake();
    w.streaming.update(w.camera,w.controls.target);
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  })()`);
  const checkBudget=async()=>{
    const s=await stats();
    assert.ok(s.residentBytes<=s.budgetBytes,'resident detail exceeds budget');
    assert.ok(s.cacheBytes<=s.cacheBudgetBytes,'compressed cache exceeds budget');
    assert.equal(s.failures.length,0,JSON.stringify(s.failures));
    return s;
  };
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844});
  await page.go('/avon');
  await ready();
  assert.equal(await page.evaluate('!!__town.streaming && __town.quality.memoryOptimized'),true,'plain URL streams on phones');
  assert.equal(await page.evaluate('__town.renderer.getPixelRatio()'),1.75,'phones default to desktop pixel density');
  assert.equal(await page.evaluate('getComputedStyle(__town.renderer.domElement).imageRendering'),'auto');
  assert.equal(await page.evaluate('!!document.getElementById("stream-debug")'),false,'default view has no demo panel');
  const opening=await checkBudget();
  assert.equal(await page.evaluate(`(()=>{
    const {ground,lampPoolHeights}=__town.street;
    return ground.heights.buffer.byteLength===ground.heights.byteLength && lampPoolHeights.buffer.byteLength===lampPoolHeights.byteLength;
  })()`),true,'small navigation metadata must not retain the full decoded scene buffer');
  assert.ok(opening.resident.length>0 && opening.resident.length<manifest.tiles.length/2);
  assert.ok(!requests.some(p=>p.endsWith('/site.json')||p.endsWith('/surfaces.json')),'streaming must not download the original map/surfaces');
  console.log('Mobile opening',JSON.stringify(opening));
  const shot=await page.send('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/avon-streaming-mobile.png',Buffer.from(shot.data,'base64'));

  await page.evaluate(`(()=>{
    window.streamDisposed={geometries:0,materials:0,textures:0,instances:0};
    const coarse=__town.street.group.getObjectByName('stream-coarse');
    for(const child of __town.street.group.children) {
      if(child===coarse || !child.isGroup)continue;
      child.traverse(o=>{
        o.geometry?.addEventListener('dispose',()=>streamDisposed.geometries++);
        if(o.isInstancedMesh)o.addEventListener('dispose',()=>streamDisposed.instances++);
        for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]) {
          m.addEventListener('dispose',()=>streamDisposed.materials++);
          for(const t of Object.values(m))if(t?.isTexture)t.addEventListener('dispose',()=>streamDisposed.textures++);
        }
      });
    }
  })()`);
  for(const [x,z] of [[-160,240],[100,-300],[-180,-210],[80,220],[-30,12]]) {
    await move(x,z);await ready();await checkBudget();
  }
  const after=await stats(),disposed=await page.evaluate('streamDisposed');
  assert.ok(after.evictions>0 && after.loads>opening.loads);
  for(const kind of ['geometries','materials','textures','instances'])assert.ok(disposed[kind]>0,`${kind} must be disposed on eviction`);
  console.log('PASS mobile repeated pans and GPU disposal',disposed);
  await page.evaluate('__town.renderer.forceContextLoss()');
  await waitFor(()=>page.evaluate('!!document.querySelector(".render-error") && __town.renderLoop.sleeping'),'streamed phone context loss');
  await page.evaluate('__town.renderer.forceContextRestore()');
  await waitFor(()=>page.evaluate('!document.querySelector(".render-error") && !__town.renderer.getContext().isContextLost()'),'streamed phone context recovery');
  await ready();await checkBudget();
  console.log('PASS default streamed phone recovers its graphics context');

  await page.evaluate("__town.lighting.setMode('night',{persist:false})");
  await move(50,-150);await ready();
  await waitFor(()=>page.evaluate('__town.lighting.fixtures.lights.some(l=>l.intensity===42)'),'night lights');
  assert.equal(await page.evaluate(`(()=>{
    let glass=0;
    __town.street.group.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])
      if(['glass','shop'].includes(m.userData.surface)&&m.customProgramCacheKey().startsWith('surface-'))glass++;});
    return glass>0 && __town.renderer.info.programs.every(p=>p.diagnostics?.runnable!==false);
  })()`),true,'streamed windows restore night shaders');
  console.log('PASS night lighting survives new tile arrivals');

  await move(-30,12,2600);await ready();
  const overview=await stats();
  assert.equal(overview.residentBytes,0);
  assert.equal(await page.evaluate("__town.street.group.getObjectByName('stream-coarse').children.every(o=>o.visible===__town.streaming.stats.visibleSectors.includes(o.name))"),true);
  const baselineGeometries=await page.evaluate('__town.renderer.info.memory.geometries');
  for(let i=0;i<2;i++) {
    await move(-30,12);await ready();await move(-30,12,2600);await ready();
    assert.equal(await page.evaluate('__town.renderer.info.memory.geometries'),baselineGeometries,'renderer allocations must return to baseline after revisiting');
  }
  console.log('PASS overview releases all detail; repeated visits return to baseline',baselineGeometries);

  fault='slow';
  await move(-180,230);
  await waitFor(()=>page.evaluate('!!__town.streaming.stats.loading'),'delayed request starts');
  await move(130,-310);
  await ready();fault='';
  const rapid=await checkBudget();
  assert.ok(rapid.resident.every(id=>rapid.desired.includes(id)),'late responses must not resurrect old tiles');
  console.log('PASS rapid pan cancels stale requests');

  // Fresh page/cache: a failed detail transfer must leave a usable coarse map.
  fault='failure';await page.go('/avon?quality=mobile');
  await waitFor(()=>page.evaluate('!!window.__town && __town.streaming.stats.failures.length>0'),'failed detail fallback');
  assert.equal(await page.evaluate("__town.street.group.getObjectByName('stream-coarse').children.every(o=>o.visible===__town.streaming.stats.visibleSectors.includes(o.name))"),true);
  fault='';await ready();await checkBudget();
  console.log('PASS interrupted tile stays coarse and retries successfully');

  await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false,screenWidth:1440,screenHeight:960});
  await page.go('/avon?quality=desktop&time=night');await ready();
  assert.equal(await page.evaluate('!!document.getElementById("stream-debug")'),false);
  assert.equal((await checkBudget()).budgetBytes,80*1048576);
  assert.equal(await page.evaluate('__town.renderer.info.programs.every(p=>p.diagnostics?.runnable!==false)'),true);
  const night=await page.send('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/avon-streaming-night.png',Buffer.from(night.data,'base64'));
  console.log('Desktop opening',JSON.stringify(await stats()));
  await page.go('/avon?stream=1&tiles=1&quality=mobile');await ready();
  assert.equal(await page.evaluate('getComputedStyle(document.getElementById("stream-debug")).position'), 'fixed');
  assert.equal(await page.evaluate('__town.scene.getObjectByName("stream-tile-overlay").visible'),true);
  const comparisonCamera=await page.evaluate('__town.camera.position.toArray()');
  await page.evaluate('document.querySelector("[data-base-only]").click()');
  await waitFor(()=>page.evaluate('__town.streaming.stats.residentBytes===0 && !__town.streaming.stats.loading'),'base comparison unloads detail');
  assert.deepEqual(await page.evaluate('__town.camera.position.toArray()'),comparisonCamera);
  await page.evaluate('document.querySelector("[data-base-only]").click()');await ready();
  await waitFor(async()=>(await stats()).resident.length>0,'detail returns after enabling it');
  assert.ok((await stats()).resident.length>0);
  const original=await page.evaluate('document.querySelector("[data-original]").href');
  assert.equal(new URL(original).searchParams.get('stream'),'0');
  await page.go(new URL(original).pathname+new URL(original).search);
  await waitFor(()=>page.evaluate('!!window.__town && !document.getElementById("loading")'),'original loader link');
  assert.equal(await page.evaluate('__town.streaming'),null);
  assert.equal(await page.evaluate('__town.siteData.buildings.length'),expectedBuildings);
  assert.equal(await page.evaluate('__town.street.precomputedSurfaces'),true);
  console.log('PASS optional demo tools, same-camera comparison, and original-loader link');
  assert.deepEqual(errors,[],'uncaught browser errors');
  console.log('PASS desktop postprocessing and streaming shaders');
},{route:async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
  if(path.includes('/stream/detail-')) {
    if(fault==='slow')await delay(700);
    if(fault==='failure'){res.writeHead(503);res.end('Temporary failure');return true;}
  }
  return false;
}});
