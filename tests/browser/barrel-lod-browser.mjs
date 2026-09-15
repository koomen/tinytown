import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
await withBrowser(root,async page=>{
  await page.go('/tinytown/web/stream-export.html');
  await waitFor(()=>page.evaluate('typeof window.exportStream === "function"'),'roof export modules');
  const report=await page.evaluate(`(async()=>{
    const THREE=await import('three');
    const {buildBlueprint}=await import('/src/blueprint.js');
    const {makeRng}=await import('/src/rng.js');
    const {coarseModel}=await import('/tinytown/web/stream-export.js');
    const {bakeMobile}=await import('/src/bake.js');
    const {compactFarAttributes}=await import('/src/far-geometry.js');
    const site=await(await fetch('/data/chautauqua/site.json')).json();
    const b=site.buildings.find(b=>b.id===820060204),o=b.obb,c=Math.cos(o.angle),s=Math.sin(o.angle);
    const full=buildBlueprint(makeRng('barrel-lod'),b,b.blueprint,18,[]);
    full.userData.streamKind='building';full.updateMatrixWorld(true);
    const sourceShell=full.getObjectByName('barrel-roof');
    const sourceEnds=[];full.traverse(o=>{if(o.name==='barrel-roof-end')sourceEnds.push(o);});
    const simple=coarseModel(full);
    const shellCopies=simple.children.filter(o=>o.geometry===sourceShell.geometry).length;
    const endCopies=sourceEnds.map(end=>simple.children.filter(o=>o.geometry===end.geometry).length);
    const coarse=await bakeMobile(simple);
    coarse.traverse(o=>{if(o.geometry)for(const[name,a]of Object.entries(compactFarAttributes(o.geometry.attributes)))o.geometry.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));});
    coarse.updateMatrixWorld(true);
    const differences=[];
    for(const u of [-11,-5,.1,5,11])for(const v of [-6.5,-5,-3,0,3,5,6.5]){
      const ray=new THREE.Raycaster(new THREE.Vector3(o.cx+c*u-s*v,40,o.cz+s*u+c*v),new THREE.Vector3(0,-1,0));
      const near=ray.intersectObject(full,true)[0],far=ray.intersectObject(coarse,true)[0];
      differences.push(near&&far?Math.abs(near.point.y-far.point.y):null);
    }
    const preservedMaterials=[];coarse.traverse(o=>{if(o.isMesh&&o.material.side===THREE.DoubleSide)preservedMaterials.push({roughness:o.material.roughness,color:o.material.color.getHex()});});
    return {shellCopies,endCopies,differences,preservedMaterials,sourceColor:sourceShell.material.color.getHex()};
  })()`);
  assert.equal(report.shellCopies,1,'Distant scenery must include the barrel roof once');
  assert.deepEqual(report.endCopies,[1,1],'Both end caps must survive exactly once');
  assert.equal(report.differences.length,35);
  assert.ok(report.differences.every(d=>d!==null&&d<.09),'Coarse roof must preserve the curved profile within seam height and far-position precision');
  assert.deepEqual(report.preservedMaterials,[{roughness:.65,color:report.sourceColor}],'Roof finish must survive batching');
  console.log('PASS barrel roof LOD:',report.differences.length,'profile probes, shell and both caps retained');
});
