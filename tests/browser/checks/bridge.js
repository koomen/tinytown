import * as THREE from 'three';
import {buildBridge} from '../../../src/bridge.js';

// Both Genesee crossings lie outside compact Avon (data/avon) and exist only in
// the extended miniature (since 20d5656); the checks build them from its data
// regardless of which scene the driver's page has loaded.
const SITE='/data/avon-extended/site.json';

export async function checkSpringBridge() {
  const site=await (await fetch(SITE)).json();
  const b=site.buildings.find(b=>b.id===131432806),spec=b.blueprint.bridge;
  const root=buildBridge(b.obb,spec,b.blueprint.wall,b.blueprint.trim);
  root.updateMatrixWorld(true);
  const plates=root.children.filter(o=>o.name==='bridge-girder-web');
  const deck=new THREE.Box3().setFromObject(root.getObjectByName('bridge-deck'));
  const ray=new THREE.Raycaster();
  let probes=0;
  try {
    if(plates.length!==2) throw new Error('Spring Street needs two solid steel sides');
    for(const side of [-1,1]) for(let x=-b.obb.w/2+.3;x<b.obb.w/2-.3;x+=.4) {
      for(const y of [spec.height+.2,spec.height+.7]) {
        ray.set(new THREE.Vector3(x,y,side*(b.obb.d/2+1)),new THREE.Vector3(0,0,-side));ray.far=1;
        if(!ray.intersectObjects(plates).length) throw new Error(`Open gap in bridge side at ${x},${y},${side}`);
        probes++;
      }
    }
    for(const support of root.children.filter(o=>o.name==='bridge-abutment')) {
      const box=new THREE.Box3().setFromObject(support);
      if(deck.max.y-box.max.y<.05) throw new Error('Stone and steel share the deck top plane');
    }
    for(const rail of root.children.filter(o=>o.name==='bridge-track-rail')) {
      const box=new THREE.Box3().setFromObject(rail);
      if(Math.abs(box.max.y-spec.height-.205)>1e-6) throw new Error('Bridge rail heads do not match the approach elevation');
    }
    return probes;
  } finally {
    root.traverse(o=>o.geometry?.dispose());
  }
}

export async function checkFiveArchBridge() {
  const site=await (await fetch(SITE)).json();
  const b=site.buildings.find(b=>b.id===479903820),spec=b.blueprint.bridge;
  const root=buildBridge(b.obb,spec,b.blueprint.wall,b.blueprint.trim);
  root.updateMatrixWorld(true);
  try {
    if(spec.approaches!==false) throw new Error('Five Arch must remain freestanding');
    const relief=root.getObjectByName('bridge-limestone-faces');
    if(!relief || relief.geometry.attributes.position.count<1000) throw new Error('Missing raised limestone faces');
    const opening=(b.obb.w-6*spec.pierWidth)/5;
    for(let i=0;i<5;i++) {
      const x=-b.obb.w/2+spec.pierWidth+opening/2+i*(opening+spec.pierWidth);
      const ray=new THREE.Raycaster(new THREE.Vector3(x,2.5,10),new THREE.Vector3(0,0,-1),0,20);
      if(ray.intersectObject(root,true).length) throw new Error(`Stonework closes arch ${i+1}`);
    }
    const ray=new THREE.Raycaster(new THREE.Vector3(.35,20,.12),new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObject(root,true);
    if(hits.length<2 || hits[0].point.y-hits[1].point.y<.025) throw new Error('Bridge coping overlaps the core top');
    return 5;
  } finally {root.traverse(o=>o.geometry?.dispose());}
}
