import assert from 'node:assert/strict';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

await withBrowser(new URL('../../',import.meta.url).pathname,async page=>{
  await page.go('/tinytown/web/stream-export.html');
  await waitFor(()=>page.evaluate('typeof exportStream === "function"'),'pavilion export modules');
  const report=await page.evaluate(`(async()=>{
    const THREE=await import('three'),{buildBlueprint}=await import('/src/blueprint.js'),{makeRng}=await import('/src/rng.js');
    const {coarseModel}=await import('/tinytown/web/stream-export.js'),{bakeMobile}=await import('/src/bake.js'),{compactFarAttributes}=await import('/src/far-geometry.js');
    const site=await(await fetch('/data/chautauqua/site.json')).json(),b=site.buildings.find(b=>b.id===820057908);
    const full=buildBlueprint(makeRng('pavilion-lod'),b,b.blueprint,3,[]);full.userData.streamKind='building';full.updateMatrixWorld(true);
    const simple=coarseModel(full),roof=full.getObjectByName('pavilion-flat-roof'),floor=full.getObjectByName('pavilion-floor');
    const copies=[roof,floor].map(o=>simple.children.filter(s=>s.geometry===o.geometry&&s.material===o.material).length);
    const coarse=await bakeMobile(simple);coarse.traverse(o=>{if(o.geometry)for(const[name,a]of Object.entries(compactFarAttributes(o.geometry.attributes)))o.geometry.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));});coarse.updateMatrixWorld(true);
    const differences=[];
    for(const u of [-.4,-.2,0,.2,.4])for(const v of [-.4,-.2,0,.2,.4]){
      const p=full.localToWorld(new THREE.Vector3(u*b.obb.w,0,v*b.obb.d));
      const ray=new THREE.Raycaster(new THREE.Vector3(p.x,30,p.z),new THREE.Vector3(0,-1,0));
      const near=ray.intersectObject(full,true)[0],far=ray.intersectObject(coarse,true)[0];differences.push(near&&far?Math.abs(near.point.y-far.point.y):null);
    }
    return{copies,differences};
  })()`);
  assert.deepEqual(report.copies,[1,1],'Smith Wilkes roof and supporting floor survive coarse export');
  assert.equal(report.differences.length,25);
  assert.ok(report.differences.every(d=>d!==null&&d<.12),'the entire roof remains present after far-geometry quantization');
  console.log('PASS pavilion LOD: 25 Smith Wilkes roof probes, roof and floor retained');
});
