// Exercise the regional extended-Avon release through the ordinary viewer URL.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const site=JSON.parse(await readFile(root+'/data/avon-extended/site.json'));
const manifest=JSON.parse(await readFile(root+'/data/avon-extended/stream/manifest.json'));
const errors=[],samples=[];let corruptPart=false;
await mkdir(root+'/runs/avon-expansion-20260908',{recursive:true});
await withBrowser(root,async page=>{
  page.events.add(m=>{if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenWidth:390,screenHeight:844});
  const ready=()=>waitFor(()=>page.evaluate('!!window.__town && !document.getElementById("loading") && !__town.streaming.stats.loading && __town.streaming.stats.desired.every(id=>__town.streaming.stats.resident.includes(id))'),'regional streamed details');
  await page.go('/?site=avon-extended');await ready();
  const normals=await page.evaluate(`(()=>{
    let count=0,bad=0;__town.street.group.getObjectByName('stream-coarse').traverse(o=>{
      const a=o.geometry?.attributes.normal;if(a?.array instanceof Int8Array){count++;if(!a.normalized)bad++;}
    });return {count,bad};
  })()`);
  assert.ok(normals.count>100,'far geometry must load real Int8 normal attributes');assert.equal(normals.bad,0);
  const park=site.landmarks.find(f=>f.id==='driving-park-oval');
  const parkBounds={x0:Math.min(...park.pts.map(p=>p[0])),x1:Math.max(...park.pts.map(p=>p[0])),z0:Math.min(...park.pts.map(p=>p[1])),z1:Math.max(...park.pts.map(p=>p[1]))};
  // Align the oval's long north/south axis with the portrait frame and fit its
  // full bounds inside the narrow 26-degree camera field of view.
  const parkDistance=Math.ceil(Math.max((parkBounds.x1-parkBounds.x0)/(2*Math.tan(13*Math.PI/180)*(390/844)),(parkBounds.z1-parkBounds.z0)*1.5)*1.25/10)*10;
  const targets=[{id:'opening',x:0,z:0},...site.buildings.filter(b=>b.blueprint?.bridge || /barilla|wahl|donald/i.test(b.name||'')).map(b=>({id:String(b.id),x:b.obb.cx,z:b.obb.cz})),
    {id:'park',x:(parkBounds.x0+parkBounds.x1)/2,z:(parkBounds.z0+parkBounds.z1)/2,theta:0,distance:parkDistance},
    {id:'outskirts',x:850,z:-900}];
  for(const target of targets) {
    await page.evaluate(`(async()=>{const w=__town,p=w.controls.target.clone();p.set(${target.x},w.street.surfaces.grade(${target.x},${target.z})+3,${target.z});w.controls.set({target:p,theta:${target.theta??.9},distance:${target.distance??190}});w.renderLoop.wake();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);})()`);
    await ready();
    const stats=await page.evaluate(`(()=>{const w=__town;return {...w.streaming.stats,lost:w.renderer.getContext().isContextLost(),calls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles};})()`);
    assert.equal(stats.lost,false);assert.equal(stats.failures.length,0,JSON.stringify(stats.failures));
    assert.ok(stats.residentBytes<=stats.budgetBytes);assert.ok(stats.cacheBytes<=stats.cacheBudgetBytes);
    if((target.distance??190)<750) assert.ok(stats.resident.length>0);samples.push({id:target.id,...stats});
    {
      const shot=await page.send('Page.captureScreenshot',{format:'png'});
      await writeFile(root+'/runs/avon-expansion-20260908/regional-mobile-'+target.id+'.png',Buffer.from(shot.data,'base64'));
    }
  }
  assert.ok(samples.at(-1).loads>samples[0].loads);assert.ok(samples.at(-1).evictions>0);assert.deepEqual(errors,[]);
  await writeFile(root+'/runs/avon-expansion-20260908/regional-browser.json',JSON.stringify({normals,samples},null,2)+'\n');
  if(manifest.base.parts?.length>1) {
    corruptPart=true;await page.go('/?site=avon-extended&diagnose&corrupt-part=1');
    await waitFor(()=>page.evaluate('document.getElementById("loading")?.classList.contains("failed")'),'corrupt base part rejected');
    assert.match(await page.evaluate('document.getElementById("loading").textContent'),/Damaged stream asset/);
    corruptPart=false;await page.evaluate('document.querySelector("#loading .retry").click()');await ready();
    console.log('PASS corrupted base part rejected before decoding; retry recovered');
  }
  console.log('PASS regional mobile opening and pans',JSON.stringify({normals,views:samples.map(s=>({id:s.id,residentMiB:s.residentBytes/2**20,calls:s.calls,triangles:s.triangles,evictions:s.evictions}))}));
},{route:async (req,res)=>{
  if(corruptPart && req.url.endsWith(manifest.base.parts?.at(-1).file||'never')) {
    const bytes=await readFile(root+req.url);bytes[bytes.length-1]^=1;res.end(bytes);return true;
  }
  return false;
}});
