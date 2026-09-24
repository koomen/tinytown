// Exercise the real extended scene around the former all-detail zoom cutoff.
// node tests/streaming-zoom-browser.mjs
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

const root=new URL('../../',import.meta.url).pathname;
const output=new URL('../../runs/zoom-detail/',import.meta.url);
await mkdir(output,{recursive:true});
const results=[];
await withBrowser(root,async page=>{
  const errors=[];
  page.events.add(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
  const ready=()=>waitFor(()=>page.evaluate(`!!window.__town?.streaming && !document.getElementById('loading')
    && !__town.streaming.stats.loading
    && __town.streaming.stats.desired.every(id=>__town.streaming.stats.resident.includes(id))`),'zoom detail');
  const move=distance=>page.evaluate(`(async()=>{
    const w=__town,target=w.controls.target.clone();target.set(-30,w.street.surfaces.grade(-30,12)+3,12);
    w.controls.set({target,theta:.9,distance:${distance}});w.renderLoop.wake();
    w.streaming.update(w.camera,w.controls.target);
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  })()`);
  for(const mobile of [false,true]) {
    await page.send('Emulation.setDeviceMetricsOverride',{width:mobile?390:1440,height:mobile?844:960,
      deviceScaleFactor:mobile?2:1,mobile});
    await page.go('/?site=avon-extended&time=day&quality='+(mobile?'mobile':'desktop'));await ready();
    // Portrait framing widens the vertical FOV. Compare equal projected
    // sector sizes instead of expecting the same metre cutoff in both views.
    const zoomScale=await page.evaluate('__town.camera.projectionMatrix.elements[5]')*Math.tan(13*Math.PI/180);
    const samples=[];
    for(const distance of [600,740,760,1000,1200,1400,1600,1800,2000,2200,2600]) {
      await move(distance*zoomScale);await ready();
      const state=await page.evaluate(`(()=>{
        const w=__town,s=w.streaming.stats,coarse=w.street.group.getObjectByName('stream-coarse');
        const sectors=s.totalRegions?coarse.children.flatMap(region=>region.children):coarse.children;
        return {...s,distance:w.controls.distance,lost:w.renderer.getContext().isContextLost(),
          coarseVisibilityCorrect:sectors.every(o=>o.visible===(s.visibleSectors.includes(o.name)&&!s.resident.includes(o.name)))};
      })()`);
      state.referenceDistance=distance;
      assert.ok(Math.abs(state.distance-distance*zoomScale)<.01);
      assert.equal(state.lost,false);assert.deepEqual(state.failures,[]);
      assert.ok(state.residentBytes<=state.budgetBytes && state.cacheBytes<=state.cacheBudgetBytes);
      assert.ok(state.resident.length<=(mobile?6:12));
      assert.ok(state.resident.every(id=>state.visibleSectors.includes(id)));
      assert.equal(state.coarseVisibilityCorrect,true);
      if(distance<=1600)assert.ok(state.resident.length>0,`useful detail remains at ${distance}`);
      if(distance===2600)assert.equal(state.residentBytes,0,'overview frees detailed scenery');
      samples.push(state);
      if([760,1400,1800].includes(distance)) {
        const shot=await page.send('Page.captureScreenshot',{format:'png'});
        await writeFile(new URL(`${mobile?'mobile':'desktop'}-${distance}.png`,output),Buffer.from(shot.data,'base64'));
      }
    }
    assert.deepEqual(samples[2].resident,samples[1].resident,'crossing the former cutoff keeps the same detail');
    assert.ok(new Set(samples.filter(s=>s.referenceDistance>=1000).map(s=>s.resident.length)).size>=3,
      'detail falls away in several sector steps instead of all at once');
    await move(1000*zoomScale);await ready();
    const restored=await page.evaluate('__town.streaming.stats');
    assert.ok(restored.resident.length>0 && restored.loads>samples.at(-1).loads,'zooming back restores detail');
    for(const distance of [1005,995,1000]) {await move(distance*zoomScale);await ready();}
    assert.equal(await page.evaluate('__town.streaming.stats.loads'),restored.loads,'small zoom reversals avoid reloading');
    results.push({mobile,samples});
    console.log('PASS extended zoom',JSON.stringify({mobile,samples:samples.map(s=>({distance:s.distance,
      sectors:s.resident.length,MiB:s.residentBytes/2**20}))}));
  }
  assert.deepEqual(errors,[]);
});
await writeFile(new URL('checks.json',output),JSON.stringify(results,null,2)+'\n');
