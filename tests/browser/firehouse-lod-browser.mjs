// Real Avon streaming regression. Source-only snapshots can point
// TOWN_TEST_STREAM_DIR at a local copy of an existing Avon stream bake.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

const root=new URL('../../',import.meta.url).pathname;
const stream=resolve(process.env.TOWN_TEST_STREAM_DIR||root+'data/avon-extended/stream');
const output=resolve(root,'runs/firehouse-lod');
await mkdir(output,{recursive:true});
const samples=[];
await withBrowser(root,async page=>{
  const errors=[];
  page.events.add(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
  const ready=()=>waitFor(()=>page.evaluate(`!!window.__town?.streaming && !document.getElementById('loading')
    && !__town.streaming.stats.loading
    && __town.streaming.stats.desired.every(id=>__town.streaming.stats.resident.includes(id))`),'firehouse detail');
  const move=async(x,z,distance,theta=3.4)=>{
    await page.evaluate(`(()=>{
      const w=__town,target=w.controls.target.clone().set(${x},w.street.surfaces.grade(${x},${z})+3,${z});
      w.controls.set({target,distance:${distance},theta:${theta}});
      w.streaming.update(w.camera,w.controls.target);w.renderLoop.wake();
    })()`);
    await ready();
  };
  const check=async(label)=>{
    const state=await page.evaluate(`(()=>{
      const w=__town,s=w.streaming.stats;
      return {...s,coarse:w.street.group.getObjectByName('stream-coarse').getObjectByName('-1_1').visible,
        lost:w.renderer.getContext().isContextLost()};
    })()`);
    assert.ok(state.resident.includes('-1_1'),label+': firehouse garage doors must remain detailed');
    assert.equal(state.coarse,false,label+': coarse firehouse must be hidden');
    assert.equal(state.lost,false);assert.deepEqual(state.failures,[]);
    assert.ok(state.residentBytes<=state.budgetBytes && state.cacheBytes<=state.cacheBudgetBytes);
    assert.ok(state.resident.length<= (state.budgetBytes===40*2**20?6:12));
    samples.push({label,...state});
  };
  const shot=async(name)=>{
    // Let the invalidated frame paint after the last tile finishes decoding.
    await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const result=await page.send('Page.captureScreenshot',{format:'png'});
    await writeFile(resolve(output,name+'.png'),Buffer.from(result.data,'base64'));
  };
  for(const mobile of [true,false]) {
    await page.send('Emulation.setDeviceMetricsOverride',{width:mobile?390:1440,height:mobile?844:960,
      deviceScaleFactor:mobile?2:1,mobile,screenWidth:mobile?390:1440,screenHeight:mobile?844:960});
    await page.go('/avon?time=day&quality='+(mobile?'mobile':'desktop'));await ready();
    // Arrive from the neighboring block first: resident tiles used to win
    // every equal-distance comparison, starving the firehouse on phones.
    await move(-30,12,190);
    for(const distance of [190,100,60,30,15,100]) {
      await move(2,95,distance);await check(`${mobile?'phone':'desktop'} zoom ${distance}`);
      if(distance===100)await shot(mobile?'phone-portrait':'desktop');
    }
    for(const [x,z] of [[-15,95],[-5,122],[2,110],[2,95]]) {
      await move(x,z,100);await check(`pan ${mobile} ${x},${z}`);
    }
    for(const theta of [0,.9,2,3.4]) {
      await move(2,95,100,theta);await check(`rotate ${mobile} ${theta}`);
    }
    if(mobile) {
      await page.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true,screenWidth:844,screenHeight:390});
      await waitFor(()=>page.evaluate('Math.abs(__town.camera.aspect-844/390)<.001'),'landscape resize');
      await ready();await check('phone landscape resize');await shot('phone-landscape');
    }
    await move(2,95,2600);
    assert.equal(await page.evaluate('__town.streaming.stats.residentBytes'),0,'overview still frees all detail');
    await move(2,95,100);await check(`restore ${mobile}`);
    console.log('PASS firehouse zoom, pan, rotation and restore',mobile?'mobile':'desktop');
  }
  assert.deepEqual(errors,[]);
},{route:async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith('/data/avon-extended/stream/'))return false;
  const file=path.slice('/data/avon-extended/stream/'.length);
  if(!/^[\w.-]+$/.test(file)){res.writeHead(404);res.end();return true;}
  const bytes=await readFile(resolve(stream,file));
  res.setHeader('Content-Type',file.endsWith('.json')?'application/json':'application/octet-stream');
  res.end(bytes);return true;
}});
await writeFile(resolve(output,'checks.json'),JSON.stringify(samples,null,2)+'\n');
