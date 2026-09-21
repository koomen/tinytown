import * as THREE from 'three';
import { buildPlaygroundEquipment } from '../../../src/playground.js';
import { buildLandmarks } from '../../../src/landmarks.js';
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
    {type:'school-playset',position:[30,40],angle:Math.PI-.235},
    {type:'school-swings',position:[40,40],angle:.6},
    {type:'round-picnic-table',position:[25,45],angle:.2},
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
  assert(counts['playground-slide']===2,'Both wooden playsets need their green slides');
  assert(counts['school-playground-canopy']===1,'The school playset needs one roofed platform');
  assert(counts['school-double-slide']===2&&counts['school-curved-slide']===1,'The school playset needs a curved chute and two adjacent wave chutes');
  assert(counts['school-monkey-bar']>0&&counts['school-playground-step']>0,'School climbing access is incomplete');
  assert(counts['school-swing-seat']===4&&counts['school-swing-chain']===8,'The school swing row needs four seats hanging from paired chains');
  assert(counts['playground-swing-seat']===4&&counts['playground-toddler-seat']===3,'Adult and toddler swings are missing');
  assert(counts['playground-seesaw-seat']===4&&counts['playground-seesaw-spring']===4,'Four-seat spring seesaw is incomplete');
  assert(counts['playground-ladder-rung']>=10&&counts['playground-climbing-rung']===5,'Climbing access is incomplete');
  assert(triangles<45000,'Playground exceeds the low-poly geometry budget');

  // Check the authored, rotated installation against the actual irregular lot,
  // including slides and roof overhangs, rather than just its anchor point.
  const site=await fetch('/data/avon-extended/site.json').then(r=>r.json());
  const lot=site.landmarks.find(f=>String(f.id)==='248254718');
  assert(lot?.equipment?.filter(e=>e.type==='school-playset').length===1,'School lot needs exactly one photo-based playset');
  assert(lot.equipment.filter(e=>e.type==='school-swings').length===1,'The school lot needs its separate swing row');
  assert(!lot.equipment.some(e=>e.type==='wooden-castle'),'The illustrative fort must be removed');
  const inside=(x,z)=>{
    let hit=false;
    for(let i=0,j=lot.pts.length-1;i<lot.pts.length;j=i++) {
      const [a,b]=lot.pts[i],[c,d]=lot.pts[j];
      if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)hit=!hit;
    }
    return hit;
  };
  const installed=buildPlaygroundEquipment(lot.equipment,grade);installed.updateMatrixWorld(true);
  installed.traverse(o=>{
    if(!o.isMesh)return;
    const p=o.geometry.attributes.position,v=new THREE.Vector3();
    for(let i=0;i<p.count;i++) {
      v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
      assert(inside(v.x,v.z),'School playground equipment extends beyond the dirt lot');
    }
  });

  const court=site.landmarks.find(f=>String(f.id)==='248254719');
  const courtRoot=buildLandmarks([court],{grade});courtRoot.updateMatrixWorld(true);
  const [cx,cz]=courtRoot.getObjectByName('basketball-court').userData.court.center;
  const rims=[],markings=[];
  courtRoot.traverse(o=>{if(o.name==='hoop-rim')rims.push(o);if(o.name.startsWith('basketball-')&&o.isMesh)markings.push(o);});
  assert(rims.length===2&&markings.length>=9,'The court needs two hoops and its full playing lines');
  for(const rim of rims) {
    const hoop=rim.parent,toward=new THREE.Vector3(0,0,1).transformDirection(hoop.matrixWorld);
    const center=new THREE.Vector3(cx,0,cz);
    const post=hoop.getWorldPosition(new THREE.Vector3());center.sub(post).setY(0).normalize();
    assert(toward.dot(center)>.999,'A basketball hoop faces away from the court');
  }
  for(const m of markings) {
    const p=m.geometry.attributes.position;
    for(let i=0;i<p.count;i++)assert(Math.abs(p.getY(i)-grade(p.getX(i),p.getZ(i))-.155)<1e-4,'A painted court line misses the terrain');
  }
  const fences=site.landmarks.filter(f=>String(f.id).startsWith('avon-elementary-')&&f.kind==='barrier');
  assert(fences.some(f=>f.height>=3)&&fences.some(f=>f.height<=1.3),'School grounds need high court screens and the lower street fence');

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
