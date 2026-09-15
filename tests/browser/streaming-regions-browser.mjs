// Real extended-Avon assets: partial startup, exploration, overview, cancellation,
// integrity failures, and recovery. Uses the private headless browser.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
const root=new URL('../../',import.meta.url).pathname;
const manifest=JSON.parse(await readFile(root+'data/avon-extended/stream/manifest.json'));
assert.ok(manifest.regions?.length>0);
const errors=[],requests=[];let fault='',expectedCorruptions=0;
await mkdir(root+'runs/avon-load-speed',{recursive:true});
await withBrowser(root,async page=>{
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    if(location.search.includes('background-test')) {
      window.testHidden=true;
      Object.defineProperty(document,'hidden',{get:()=>window.testHidden});
    }
  `});
  page.events.add(m=>{
    if(m.method!=='Runtime.exceptionThrown')return;
    const error=m.params.exceptionDetails;
    if(fault==='corrupt'&&/Damaged stream asset region-/.test(error.exception?.description||''))expectedCorruptions++;
    else errors.push(error);
  });
  const stats=()=>page.evaluate('__town.streaming.stats');
  const ready=()=>waitFor(()=>page.evaluate(`!!window.__town && !document.getElementById('loading') && !__town.streaming.stats.loading
    && __town.streaming.stats.desiredRegions.every(id=>__town.streaming.stats.loadedRegions.includes(id))
    && __town.streaming.stats.desired.every(id=>__town.streaming.stats.resident.includes(id))`),'region and detail scenery');
  const move=async(x,z,distance=320)=>page.evaluate(`(()=>{
    const w=__town,target=w.controls.target.clone().set(${x},w.street.surfaces.grade(${x},${z})+3,${z});
    w.controls.set({target,theta:2,distance:${distance}});w.streaming.update(w.camera,target);w.renderLoop.wake();
  })()`);
  const covered=()=>page.evaluate(`(()=>{
    const s=__town.streaming.stats,c=__town.street.group.getObjectByName('stream-coarse');
    return s.visibleSectors.every(id=>{
      const group=c.getObjectByName(id);
      return group && group.visible===!s.resident.includes(id);
    });
  })()`);
  await page.go('/?site=avon-extended');await ready();
  const opening=await stats();
  assert.ok(opening.loadedRegions.length>0&&opening.loadedRegions.length<manifest.regions.length/4);
  assert.ok(await covered(),'every visible opening sector has its fallback geometry');
  assert.equal(opening.failures.length,0);
  assert.ok(!requests.some(p=>p.endsWith('/site.json')||p.endsWith('/surfaces.json')));
  const startupBytes=manifest.base.bytes+manifest.regions.filter(r=>opening.loadedRegions.includes(r.id)).reduce((n,r)=>n+r.bytes,0);
  assert.ok(startupBytes<28*1024*1024,'opening download must stay well below the former 55 MiB base');
  console.log('PASS partial startup',JSON.stringify({startupBytes,regions:opening.loadedRegions.length,totalRegions:manifest.regions.length}));

  fault='slow';await move(1000,-1000);
  await waitFor(()=>page.evaluate('__town.streaming.stats.loading?.startsWith("region:")'),'region request');
  const cancelled=(await stats()).loading.slice('region:'.length);
  await move(-25,25);fault='';await ready();
  assert.ok(!(await stats()).loadedRegions.includes(cancelled),'cancelled offscreen region must not arrive late');
  console.log('PASS rapid pan cancels unneeded region');

  for(const [x,z] of [[1000,-1000],[-650,1600],[-25,25]]) {
    await move(x,z);await ready();
    const s=await stats();
    assert.ok(await covered());assert.equal(s.failures.length,0,JSON.stringify(s.failures));
    assert.ok(s.residentBytes<=s.budgetBytes);assert.ok(s.cacheBytes<=s.cacheBudgetBytes);
    for(const id of opening.loadedRegions)assert.ok(s.loadedRegions.includes(id),'visited silhouettes stay resident');
  }
  await page.evaluate(`(()=>{
    const w=__town;w.frameCamera();
    w.controls.set({target:w.controls.target,theta:w.controls.theta,distance:w.camera.position.distanceTo(w.controls.target)*1.5});
    w.streaming.update(w.camera,w.controls.target);w.renderLoop.wake();
  })()`);
  await ready();
  const overview=await stats();
  assert.equal(overview.loadedRegions.length,manifest.regions.length,'whole-map overview loads every region');
  assert.ok(await covered());
  assert.equal(await page.evaluate('__town.renderer.getContext().isContextLost()'),false);
  const shot=await page.send('Page.captureScreenshot',{format:'png'});
  await writeFile(root+'runs/avon-load-speed/region-overview.png',Buffer.from(shot.data,'base64'));
  console.log('PASS exploration, retained landmarks, and complete overview');

  fault='corrupt';await page.go('/?site=avon-extended&diagnose');
  await waitFor(()=>page.evaluate('document.getElementById("loading")?.classList.contains("failed")'),'corrupt region rejected');
  assert.match(await page.evaluate('document.getElementById("loading").textContent'),/Damaged stream asset/);
  assert.equal(expectedCorruptions,1,'the injected corruption reaches the startup error handler');
  fault='';await page.evaluate('document.querySelector("#loading .retry").click()');await ready();
  assert.ok(await covered());
  console.log('PASS corrupted opening region rejected; retry restores scenery');

  fault='failure';await move(1000,-1000);
  await waitFor(()=>page.evaluate('__town.streaming.stats.failures.some(f=>f.id.startsWith("region:"))'),'failed exploration region');
  fault='';await ready();assert.ok(await covered());
  assert.equal((await stats()).failures.length,0);
  assert.equal(await page.evaluate('__town.renderer.getContext().isContextLost()'),false);
  console.log('PASS transient region failure retries without losing the scene');

  await page.go('/?site=avon-extended&background-test');
  await waitFor(()=>page.evaluate('document.querySelector("#loading .what")?.textContent.includes("loading the opening view")'),'hidden opening prepared');
  assert.equal(await page.evaluate('!!window.__town'),false);
  await page.evaluate('window.testHidden=false;document.dispatchEvent(new Event("visibilitychange"))');
  await ready();assert.ok(await covered());
  assert.deepEqual(errors,[]);
  console.log('PASS background-tab startup resumes when the tab becomes visible');
},{route:async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
  if(path.includes('/stream/region-')) {
    if(fault==='slow')await delay(700);
    if(fault==='failure'){res.writeHead(503);res.end('Temporary failure');return true;}
    if(fault==='corrupt') {const bytes=await readFile(root+path);bytes[bytes.length-1]^=1;res.end(bytes);return true;}
  }
  return false;
}});
