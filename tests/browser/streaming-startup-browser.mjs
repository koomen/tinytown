// node tests/streaming-startup-browser.mjs — worker ownership and startup failures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, waitFor } from '../../tinytown/browser.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const manifest=JSON.parse(await readFile(root+'/data/avon/stream/manifest.json'));
const expectedBuildings=JSON.parse(await readFile(root+'/data/avon/site.json')).buildings.length;
const firstBase=manifest.base.parts?.[0]||manifest.base;
const base=await readFile(root+'/data/avon/stream/'+firstBase.file);
let fault='',releaseDownload;
await withBrowser(root,async page=>{
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    if(location.search.includes('short-timeout')) {
      const original=setTimeout;
      window.setTimeout=(fn,ms,...args)=>original(fn,ms===30000?500:ms,...args);
    }
    if(location.search.includes('no-decoder'))window.DecompressionStream=undefined;
  `});
  const ready=()=>waitFor(()=>page.evaluate('!!window.__town && !document.getElementById("loading")'),'first scene');
  const failed=()=>waitFor(()=>page.evaluate('document.getElementById("loading")?.classList.contains("failed") && !document.querySelector("#loading .retry").hidden'),'visible startup retry');

  fault='pause';await page.go('/avon');
  await waitFor(()=>page.evaluate('Number(document.querySelector("#loading .what")?.textContent.match(/(\\d+)%/)?.[1])>0'),'real download progress');
  assert.equal(await page.evaluate('!!window.__town'),false);
  releaseDownload();fault='';await ready();
  console.log('PASS startup paints real progress during a slow base download');

  // Compare the worker/zero-copy loader to Three's standard loader using a
  // real prepared tile. Check values AND buffer identity, including normalized
  // colors/normals, index buffers, groups and instanced matrices.
  const tile=manifest.tiles.find(t=>t.id==='-1_0');
  const result=await page.evaluate(`(async()=>{
    const THREE=await import('three');
    const {decodeStream,StreamObjectLoader}=await import('./src/stream-loader.js');
    const bytes=new Uint8Array(await (await fetch('./data/avon/stream/${tile.file}')).arrayBuffer());
    const parts=[bytes.subarray(0,13),bytes.subarray(13)];
    let ticks=0;const heartbeat=setInterval(()=>ticks++,0);
    const json=await decodeStream(parts,${tile.rawBytes});clearInterval(heartbeat);
    const sharedGeometry={};
    __town.street.group.getObjectByName('stream-tree-library').traverse(o=>{if(o.geometry)sharedGeometry[o.geometry.uuid]=o.geometry;});
    const direct=await new StreamObjectLoader(sharedGeometry).parseAsync(json);
    const standard=await new THREE.ObjectLoader().parseAsync({...json,
      geometries:[...json.geometries,...Object.values(sharedGeometry).map(g=>g.toJSON())]});
    let arrays=0,instances=0,equal=true,shared=true;
    const records=new Map(json.geometries.map(g=>[g.uuid,g]));
    const same=(a,b)=>a.constructor===b.constructor&&a.length===b.length&&a.every((n,i)=>Object.is(n,b[i]));
    direct.traverse(o=>{
      const other=standard.getObjectByProperty('uuid',o.uuid);
      if(o.geometry){
        const g=o.geometry,expected=records.get(g.uuid)?.data;
        if(!expected)shared&&=g===sharedGeometry[g.uuid];
        for(const [name,a] of Object.entries(g.attributes)){
          arrays++;if(expected)shared&&=a.array===expected.attributes[name].array;
          equal&&=a.itemSize===other.geometry.attributes[name].itemSize&&a.normalized===other.geometry.attributes[name].normalized&&same(a.array,other.geometry.attributes[name].array);
        }
        if(g.index){if(expected)shared&&=g.index.array===expected.index.array;equal&&=same(g.index.array,other.geometry.index.array);}
        equal&&=JSON.stringify(g.groups)===JSON.stringify(other.geometry.groups);
      }
      if(o.isInstancedMesh){instances++;equal&&=same(o.instanceMatrix.array,other.instanceMatrix.array);}
    });
    const controller=new AbortController();
    const aborted=decodeStream(new Uint8Array([1,2,3]),8,{signal:controller.signal}).then(()=>false,e=>e.name==='AbortError');controller.abort();
    const corrupt=await decodeStream(new Uint8Array([1,2,3]),8).then(()=>false,e=>!!e.message);
    return {arrays,instances,equal,shared,ticks,transferred:bytes.byteLength===0&&parts.every(p=>p.byteLength===0),aborted:await aborted,corrupt};
  })()`);
  assert.ok(result.arrays>0&&result.instances>0&&result.ticks>0,JSON.stringify(result));
  for(const key of ['equal','shared','transferred','aborted','corrupt'])assert.equal(result[key],true,key);
  console.log('PASS worker transfers multipart buffers, preserves geometry exactly, stays responsive, and handles cancellation/corruption');

  fault='worker';await page.go('/avon?diagnose');await failed();
  const detail=await page.evaluate('document.querySelector("#loading .error-details pre").textContent');
  assert.match(detail,/Stage: unpacking the landscape/);
  assert.match(detail,/Loader: streaming/);
  assert.match(detail,/Error:/);
  assert.equal(await page.evaluate('document.querySelector("#loading .error-details").open'),true);
  console.log('PASS missing worker shows retry instead of a stuck loading screen');
  fault='';await page.evaluate('document.querySelector("#loading .retry").click()');await ready();
  console.log('PASS retry reloads the scenery after a decoder failure');

  fault='stall';await page.go('/avon?short-timeout&diagnose');await failed();
  assert.match(await page.evaluate('document.querySelector("#loading .error-details pre").textContent'),/download stalled/);
  console.log('PASS stalled base download times out to a visible retry');
  fault='';
  await page.go('/avon?no-decoder');await ready();
  assert.equal(await page.evaluate('__town.streaming'),null);
  assert.equal(await page.evaluate('__town.siteData.buildings.length'),expectedBuildings);
  console.log('PASS browsers without streaming APIs retain the original loader');

  fault='worker';await page.go('/avon?time=night');await ready();
  assert.equal(await page.evaluate('__town.streaming'),null);
  assert.equal(await page.evaluate('new URLSearchParams(location.search).get("stream")'),'0');
  assert.equal(await page.evaluate('new URLSearchParams(location.search).get("time")'),'night');
  assert.match(await page.evaluate('sessionStorage.getItem("town-stream-failure")'),/unpacking the landscape/);
  console.log('PASS streaming failure automatically recovers using the original loader and preserves night mode');

  fault='both';await page.go('/avon');await failed();
  assert.equal(await page.evaluate('new URLSearchParams(location.search).get("stream")'),'0');
  assert.match(await page.evaluate('document.querySelector("#loading .error-details pre").textContent'),/Previous streaming failure/);
  console.log('PASS a failed recovery stops with details instead of redirecting in a loop');

  fault='pause';await page.go('/avon?diagnose');
  await waitFor(()=>page.evaluate('Number(document.querySelector("#loading .what")?.textContent.match(/(\\d+)%/)?.[1])>0'),'loading before rejected promise');
  await page.evaluate('void Promise.reject(new Error("startup rejection test"))');await failed();
  releaseDownload();fault='';
  console.log('PASS asynchronous startup errors show retry');
},{route:async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if((path==='/src/stream-worker.js'&&['worker','both'].includes(fault)) || (path==='/data/avon/site.json'&&fault==='both')){res.writeHead(503);res.end('Temporary failure');return true;}
  if(path.endsWith('/'+firstBase.file)&&['pause','stall'].includes(fault)){
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':base.length});
    const split=Math.round(base.length/4);res.write(base.subarray(0,split));
    if(fault==='stall'){await new Promise(resolve=>res.on('close',resolve));return true;}
    await new Promise(resolve=>{releaseDownload=resolve;res.on('close',resolve);});
    res.end(base.subarray(split));return true;
  }
  return false;
}});
