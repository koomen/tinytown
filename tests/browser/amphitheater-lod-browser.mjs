import assert from 'node:assert/strict';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

await withBrowser(new URL('../../',import.meta.url).pathname,async page=>{
  await page.go('/tinytown/web/stream-export.html');
  await waitFor(()=>page.evaluate('typeof exportStream === "function"'),'amphitheatre export modules');
  const report=await page.evaluate(`(async()=>{
    const THREE=await import('three');
    const {buildBlueprint}=await import('/src/blueprint.js');
    const {makeRng}=await import('/src/rng.js');
    const {coarseModel}=await import('/tinytown/web/stream-export.js');
    const {bakeMobile}=await import('/src/bake.js');
    const {compactFarAttributes}=await import('/src/far-geometry.js');
    const site=await(await fetch('/data/chautauqua/site.json')).json();
    const {checkAmphitheaterAccess}=await import('/tests/browser/checks/amphitheater.js');
    checkAmphitheaterAccess(site);
    const building=site.buildings.find(b=>b.id===619932539);
    const full=buildBlueprint(makeRng('amphitheater-lod'),building,building.blueprint,3,[]);
    full.userData.streamKind='building';full.updateMatrixWorld(true);
    const simple=coarseModel(full),roofNames=['amphitheater-roof','amphitheater-backstage-roof','amphitheater-monitor-roof'];
    const sources=[];full.traverse(o=>{if(roofNames.includes(o.name))sources.push(o);});
    const copies=sources.map(o=>({name:o.name,count:simple.children.filter(s=>s.geometry===o.geometry&&s.material===o.material).length}));
    const coarse=await bakeMobile(simple);
    coarse.traverse(o=>{if(o.geometry)for(const[name,a]of Object.entries(compactFarAttributes(o.geometry.attributes)))o.geometry.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));});
    coarse.updateMatrixWorld(true);
    const differences=[];
    for(const roof of sources){
      const p=roof.geometry.attributes.position;
      for(let i=0;i<p.count;i+=3){
        const center=new THREE.Vector3();for(let j=0;j<3;j++)center.add(new THREE.Vector3().fromBufferAttribute(p,i+j));center.divideScalar(3);roof.localToWorld(center);
        const ray=new THREE.Raycaster(new THREE.Vector3(center.x,60,center.z),new THREE.Vector3(0,-1,0));
        const near=ray.intersectObject(full,true)[0],far=ray.intersectObject(coarse,true)[0];
        differences.push(near&&far?Math.abs(near.point.y-far.point.y):null);
      }
    }
    const profiles=new Set();coarse.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(m.userData.nightEmission)profiles.add(m);});
    return{copies,differences,nightProfiles:profiles.size};
  })()`);
  assert.equal(report.copies.length,3);
  assert.ok(report.copies.every(r=>r.count===1),'all three exterior roofs survive coarse export exactly once');
  assert.ok(report.differences.length>=40);
  assert.ok(report.differences.every(d=>d!==null&&d<.12),'distant roof profiles match the full building after quantization');
  assert.ok(report.nightProfiles>=3,'night lighting profiles survive coarse batching');
  console.log('PASS Amphitheater LOD:',report.differences.length,'roof probes; day/night structure retained');
});
