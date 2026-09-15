import * as THREE from 'three';
import {buildBoat,buildMooredBoats,planMoorings} from '../../../src/boats.js';
import {shiftLandmark} from '../../../src/landmark-frame.js';
import {coarseModel} from '../../../tinytown/web/stream-export.js';
import {bake} from '../../../src/bake.js';
import {packSceneJSON,unpackSceneJSON} from '../../../src/stream-format.js';
import {StreamObjectLoader} from '../../../src/stream-loader.js';

export async function checkBoats(){
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const water={id:'lake',kind:'water',closed:true,level:-4,pts:[[0,-45],[120,-45],[120,45],[0,45]]};
  const dock={id:'dock',kind:'pier',pts:[[-2,0],[50,0]],width:1.5,mooring:{layout:'parallel',minFraction:0,occupancy:1,maxBoats:30}};
  const obstruction={id:'other-dock',kind:'pier',pts:[[8,4],[42,4]],width:2};
  const features=[water,dock,obstruction],placements=planMoorings(features);
  assert(placements.length>4,'Explicit moorings should populate');
  assert(planMoorings([water,{...dock,mooring:undefined}]).length===0,'Unannotated piers must not acquire boats');
  assert(planMoorings([dock]).length===0,'No boats without surveyed finite-level water');
  assert(JSON.stringify(placements)===JSON.stringify(planMoorings([...features].reverse())),'Feature order must not change boats');
  const moved=planMoorings(features.map(f=>shiftLandmark(f,133,-67)));
  assert(moved.length===placements.length,'Recentering must retain every mooring');
  for(let i=0;i<placements.length;i++){
    const p=placements[i];assert(Math.abs(p.x-133-moved[i].x)<1e-8&&Math.abs(p.z+67-moved[i].z)<1e-8,'Recentering moved a boat');
    assert(p.footprint.every(([x,z])=>x>=0&&x<=120&&z>=-45&&z<=45),'Padded hull must stay on water');
    assert(!p.footprint.some(([x,z])=>x>8&&x<42&&z>3&&z<5),'Padded hull crossed neighboring dock');
  }
  const root=buildMooredBoats(features);root.updateMatrixWorld(true);
  for(const model of root.children){
    const simple=coarseModel(model),hull=model.getObjectByName('boat-hull');
    assert(simple.children.some(o=>o.geometry===hull.geometry),'Distant streaming must preserve hulls');
  }
  const models=new THREE.Group();for(const [i,type] of ['runabout','pontoon','sailboat'].entries()){
    const model=buildBoat({type});model.position.x=i*10;models.add(model);
  }
  let triangles=0;models.traverse(o=>{if(o.isMesh){const g=o.geometry;assert(Array.from(g.attributes.position.array).every(Number.isFinite),'Invalid boat vertex');triangles+=(g.index?.count||g.attributes.position.count)/3;}});
  assert(triangles<6500,'The three boat variants exceed their geometry budget');
  models.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(models,true),baked=bake(models,{compactNormals:true});
  const json=baked.toJSON(),types={Float32Array,Uint32Array,Uint16Array,Int16Array,Uint8Array};
  for(const g of json.geometries)for(const a of [...Object.values(g.data.attributes),g.data.index].filter(Boolean))a.array=new types[a.type](a.array);
  const packed=await packSceneJSON(json).arrayBuffer(),restored=new StreamObjectLoader().parse(unpackSceneJSON(packed)),after=new THREE.Box3().setFromObject(restored,true);
  assert(before.min.distanceTo(after.min)<1e-4&&before.max.distanceTo(after.max)<1e-4,'Stream roundtrip changed boats');
  return{placements:placements.length,triangles,streamBytes:packed.byteLength};
}
