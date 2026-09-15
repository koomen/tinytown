import * as THREE from 'three';
import { buildFountain } from '../../../src/fountain.js';
import { bakeMobile } from '../../../src/bake.js';
import { createNightSpotlights, applyNightEmission } from '../../../src/lighting.js';
import { coarseModel } from '../../../tinytown/web/stream-export.js';

export function checkFountain() {
  const root = buildFountain({w: 11, d: 11});
  root.updateMatrixWorld(true);
  const counts = {};
  root.traverse(o => {
    counts[o.name] = (counts[o.name] || 0) + 1;
    if (o.geometry && !o.geometry.attributes.position.array.every(Number.isFinite)) throw new Error('Non-finite fountain geometry');
  });
  for (const name of ['fountain-fish', 'fountain-jet', 'fountain-relief', 'fountain-uplight-lens']) {
    if (counts[name] !== 4) throw new Error('Missing four-sided fountain feature: ' + name);
  }
  const ray = new THREE.Raycaster(new THREE.Vector3(2, 8, 0), new THREE.Vector3(0, -1, 0));
  if (ray.intersectObject(root, true)[0]?.object.name !== 'fountain-water') throw new Error('Basin is enclosed or water is missing');
  ray.set(new THREE.Vector3(0, 8, 0), new THREE.Vector3(0, -1, 0));
  if (ray.intersectObject(root, true)[0]?.object.name !== 'fountain-stepped-cap') throw new Error('Pylon crown is missing');
  return counts;
}

export async function checkFountainLighting() {
  const root=buildFountain({w:11,d:11},{height:4.9,pylonWidth:1.5});
  root.userData.streamKind='building';root.position.set(17,3,-8);root.rotation.y=1.03;root.updateMatrixWorld(true);
  const inspect=model=>{
    const lenses=[];model.updateMatrixWorld(true);
    model.traverse(o=>{if(o.userData.nightSpotlight)lenses.push(o);});
    if(lenses.length!==4)throw new Error('Four fixture anchors must survive scenery preparation');
    return lenses.map(lens=>({position:lens.getWorldPosition(new THREE.Vector3()).toArray(),
      target:lens.localToWorld(new THREE.Vector3(...lens.userData.nightSpotlight.target)).toArray()}));
  };
  const before=inspect(root),target=root.localToWorld(new THREE.Vector3(0,.87+(4.4-.87)*.57,0));
  for(const lens of before) {
    if(new THREE.Vector3(...lens.target).distanceTo(target)>1e-8)throw new Error('Fixture must aim at the central pillar');
    if(lens.position[1]>=root.position.y+.68+.5)throw new Error('Fixture must sit below the fish mouth');
  }
  const coarse=await bakeMobile(coarseModel(root));
  const baked=await bakeMobile(await bakeMobile(root));
  const roundTrip=model=>{
    const clone=model.clone(true);clone.traverse(o=>{if(o.geometry)o.geometry=new THREE.BufferGeometry().copy(o.geometry);});
    return new THREE.ObjectLoader().parse(clone.toJSON());
  };
  const restored=roundTrip(baked),far=roundTrip(coarse);
  for(const model of [baked,restored,far])inspect(model).forEach((after,i)=>{
    for(const key of ['position','target'])if(new THREE.Vector3(...after[key]).distanceTo(new THREE.Vector3(...before[i][key]))>1e-7)
      throw new Error('Fixture transforms changed while baking '+key);
  });
  const scene=new THREE.Scene(),sector=new THREE.Group();scene.add(sector,far);sector.add(restored);far.visible=false;
  const lighting=createNightSpotlights(scene);lighting.refresh(scene);lighting.update(1,target);scene.updateMatrixWorld(true);
  if(lighting.lights.length!==4||lighting.lights.some(l=>l.intensity!==90))throw new Error('Night must enable four bounded uplights');
  restored.traverse(o=>{if(o.name==='fountain-uplight-lens'){
    applyNightEmission(o.material,0);if(o.material.emissiveIntensity!==0)throw new Error('Day lens must be unlit');
    applyNightEmission(o.material,1);if(o.material.emissiveIntensity!==2.6)throw new Error('Night lens must glow');
  }});
  lighting.update(0,target);if(lighting.lights.some(l=>l.intensity))throw new Error('Day uplights must be off');
  sector.visible=false;lighting.update(1,target);if(lighting.lights.some(l=>l.intensity))throw new Error('Hidden sectors must not cast light');
  far.visible=true;lighting.update(1,target);if(lighting.lights.some(l=>l.intensity!==90))throw new Error('Coarse fountain must retain uplights');
  far.visible=false;scene.remove(sector);lighting.refresh(scene);lighting.update(1,target);
  if(lighting.lights.some(l=>l.intensity))throw new Error('Evicted fixtures must not cast light');
  return {fixtures:4,roundTrips:2,lightSlots:lighting.lights.length};
}
