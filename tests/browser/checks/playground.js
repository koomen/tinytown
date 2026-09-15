import * as THREE from 'three';
import { buildPlaygroundEquipment } from '../../../src/playground.js';
import { bake } from '../../../src/bake.js';
import { packSceneJSON, unpackSceneJSON } from '../../../src/stream-format.js';
import { StreamObjectLoader } from '../../../src/stream-loader.js';

export async function checkPlayground() {
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const grade=(x,z)=>.06*x-.035*z+.08*Math.sin(x*.7);
  const equipment=[
    {type:'wooden-playset',position:[4,5],angle:.8},
    {type:'wooden-playset',position:[15,20],angle:-.6,size:'small'},
    {type:'swings',position:[-10,12],angle:1.2,length:8.4,seats:4,height:3},
    {type:'swings',position:[-10,22],angle:1.2,length:6.4,seats:3,toddler:true},
    {type:'spring-seesaw',position:[0,15],angle:.3},
    {type:'bench',position:[5,25],angle:-1.3},
    {type:'bench',position:[-3,2],angle:.4},
    {type:'bench',position:[15,6],angle:2.1},
  ];
  const root=buildPlaygroundEquipment(equipment,grade);root.updateMatrixWorld(true);
  const counts={};let triangles=0,feet=0;
  root.traverse(o=>{
    if(!o.isMesh)return;
    counts[o.name]=(counts[o.name]||0)+1;
    const p=o.geometry.attributes.position;
    assert(Array.from(p.array).every(Number.isFinite),'Equipment contains a non-finite vertex');
    triangles+=(o.geometry.index?.count||p.count)/3;
    if(o.userData.foot) {
      const foot=new THREE.Vector3(...o.userData.foot).applyMatrix4(o.parent.matrixWorld);
      const embed=o.name==='playground-support'?-.025:0;
      assert(Math.abs(foot.y-grade(foot.x,foot.z)-.12-embed)<1e-10,'A rotated equipment foot misses terrain');feet++;
      const bottom=new THREE.Vector3(0,-o.geometry.parameters.height/2,0).applyMatrix4(o.matrixWorld);
      assert(bottom.distanceTo(foot)<1e-7,'Support geometry does not reach its declared foot');
    }
  });
  assert(counts['playground-gabled-roof']===8,'Both structures must contain two open gabled towers');
  assert(counts['playground-slide']===2,'Both wooden structures need a green slide');
  assert(counts['playground-swing-seat']===4&&counts['playground-toddler-seat']===3,'Adult and toddler swings are missing');
  assert(counts['playground-seesaw-seat']===4&&counts['playground-seesaw-spring']===4,'Four-seat spring seesaw is incomplete');
  assert(counts['playground-ladder-rung']>=10&&counts['playground-climbing-rung']===5,'Climbing access is incomplete');
  assert(triangles<20000,'Playground exceeds the low-poly geometry budget');

  const before=new THREE.Box3().setFromObject(root,true),baked=bake(root,{compactNormals:true});
  const json=baked.toJSON(),types={Float32Array,Uint32Array,Uint16Array,Int16Array,Uint8Array};
  for(const g of json.geometries)for(const a of [...Object.values(g.data.attributes),g.data.index].filter(Boolean))a.array=new types[a.type](a.array);
  const packed=await packSceneJSON(json).arrayBuffer();
  const restored=new StreamObjectLoader().parse(unpackSceneJSON(packed));
  const after=new THREE.Box3().setFromObject(restored,true);
  assert(before.min.distanceTo(after.min)<1e-4&&before.max.distanceTo(after.max)<1e-4,'Stream roundtrip changed playground bounds');
  let restoredTriangles=0;restored.traverse(o=>{if(o.isMesh)restoredTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  assert(restoredTriangles===triangles,'Baking or stream serialization dropped equipment triangles');
  return {feet,triangles,streamBytes:packed.byteLength,counts};
}
