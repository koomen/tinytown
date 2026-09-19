// Build dist/avon first. Exercise camera sectors against actual network/GPU state.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

const root=new URL('../../',import.meta.url).pathname;
const output=new URL('../../runs/unified-renderer/',import.meta.url);
await mkdir(output,{recursive:true});
const results=[];
const ready=page=>waitFor(()=>page.evaluate(`!!window.__town?.street && !document.getElementById('loading')
  && !!__town.streaming && !__town.streaming.stats.loading
  && __town.streaming.stats.desired.every(id=>__town.streaming.stats.resident.includes(id))`),'sector detail');
const move=async(page,x,z,distance=190,theta=.9)=>page.evaluate(`(async()=>{
  const w=__town,target=w.controls.target.clone();target.set(${x},w.street.surfaces.grade(${x},${z})+3,${z});
  w.controls.set({target,theta:${theta},distance:${distance}});w.renderLoop.wake();
  w.streaming.update(w.camera,w.controls.target);
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
})()`);
const screenshot=async(page,name)=>{
  const shot=await page.send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL(name+'.png',output),Buffer.from(shot.data,'base64'));
};
let reference;
// The camera reference comes from Avon at its production route on the checkout.
await withBrowser(root,async page=>{
  await page.go('/avon?time=day');await ready(page);
  await move(page,-30,12);await ready(page);
  reference=await page.evaluate('({camera:__town.camera.position.toArray(),target:__town.controls.target.toArray()})');
  await screenshot(page,'avon-reference');
});

await withBrowser(root+'dist/avon',async page=>{
  const errors=[];
  page.events.add(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
  for(const [site,mobile] of [['avon-extended',false],['avon-extended',true],['chautauqua',true]]) {
    await page.send('Emulation.setDeviceMetricsOverride',{width:mobile?390:1440,height:mobile?844:960,
      deviceScaleFactor:mobile?2:1,mobile});
    await page.go('/'+site+'?time=day&quality='+(mobile?'mobile':'desktop'));await ready(page);
    if(site==='avon-extended'&&!mobile) {
      await move(page,-30,12);await ready(page);
      assert.deepEqual(await page.evaluate('({camera:__town.camera.position.toArray(),target:__town.controls.target.toArray()})'),reference);
      await screenshot(page,'avon-shared');
    }
    const targets=await page.evaluate(`(()=>{
      const buildings=__town.siteData.buildings;
      const xs=[...buildings].sort((a,b)=>a.obb.cx-b.obb.cx);
      return [__town.controls.target.toArray(),...[
        xs[Math.floor(xs.length*.08)],xs[Math.floor(xs.length*.92)]
      ].map(b=>[b.obb.cx,0,b.obb.cz])];
    })()`);
    const samples=[];
    for(const [i,[x,,z]] of targets.entries()) {
      await move(page,x,z,190,i===2?-.9:.9);await ready(page);
      const state=await page.evaluate(`(()=>{
        const w=__town,s=w.streaming.stats,coarse=w.street.group.getObjectByName('stream-coarse');
        let instancedTrees=0;
        w.street.group.traverse(o=>{if(o.isInstancedMesh&&o.userData.instanceVegetation)instancedTrees+=o.count;});
        return {...s,lost:w.renderer.getContext().isContextLost(),instancedTrees,
          coarseVisibilityCorrect:coarse.children.every(o=>o.visible===(s.visibleSectors.includes(o.name)&&!s.resident.includes(o.name))),
          sharedTreeGeometries:s.sharedTreeGeometries};
      })()`);
      assert.equal(state.lost,false);assert.deepEqual(state.failures,[]);
      assert.ok(state.resident.length>0 && state.resident.length<state.totalTiles,
        JSON.stringify({site,mobile,i,x,z,state}));
      assert.ok(state.resident.length<=(mobile?6:12));
      assert.ok(state.residentBytes<=state.budgetBytes && state.cacheBytes<=state.cacheBudgetBytes);
      assert.ok(state.resident.every(id=>state.visibleSectors.includes(id)));
      assert.ok(state.visibleSectors.length<state.totalTiles,'Offscreen sectors must be culled');
      assert.equal(state.coarseVisibilityCorrect,true);
      samples.push(state);
      if(i===0)await screenshot(page,site+(mobile?'-mobile':'-desktop'));
    }
    assert.ok(samples.at(-1).evictions>samples[0].evictions,'Panning must release the previous neighborhood');
    assert.ok(samples.at(-1).loads>samples[0].loads,'Panning must load the new neighborhood');
    assert.ok(samples.some(s=>s.instancedTrees>0),'New landscape detail must instance the original tree style');
    await move(page,0,0,2600);await ready(page);
    assert.equal(await page.evaluate('__town.streaming.stats.residentBytes'),0,'Overview must release all detailed scenery');
    results.push({site,mobile,samples});
    console.log('PASS sectors',JSON.stringify({site,mobile,samples:samples.map(s=>({visible:s.visibleSectors.length,
      loaded:s.resident.length,MiB:s.residentBytes/2**20,instancedTrees:s.instancedTrees}))}));
  }
  assert.deepEqual(errors,[]);
});
await writeFile(new URL('sector-checks.json',output),JSON.stringify({reference,results},null,2)+'\n');
