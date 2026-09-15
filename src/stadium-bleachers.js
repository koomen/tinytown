// The surveyed quad runs along the front edge, then around the back of the
// grandstand. Seating faces the track; the press box faces the same direction.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './kit.js';
import { drapeTriangles } from './landmark-drape.js';

export function buildStadiumBleachers(feature, grade = () => 0, grid = null) {
  const root = new THREE.Group(); root.name = 'stadium-bleachers';
  if (feature.pts?.length !== 4) return root;
  const [a,b,c,d] = feature.pts, length = Math.hypot(b[0]-a[0],b[1]-a[1]);
  if (!Number.isFinite(length) || length < 4) return root;
  const ux=(b[0]-a[0])/length, uz=(b[1]-a[1])/length;
  const vx=-uz, vz=ux, x=(a[0]+b[0])/2, z=(a[1]+b[1])/2;
  const depth=((c[0]+d[0])/2-x)*vx+((c[1]+d[1])/2-z)*vz;
  if (!Number.isFinite(depth) || depth < 3) return root;
  const base=grade(x,z), world=(u,v)=>[x+ux*u+vx*v,z+uz*u+vz*v];
  const ground=(u,v)=>grade(...world(u,v))-base;
  root.position.set(x,base,z); root.rotation.y=Math.atan2(vx,ux);
  const rows=feature.bleachers?.rows || 12, rise=.29, tread=(depth-2)/rows;
  // Level tiers sit above the highest point beneath them. Every steel foot
  // reaches the local ground even where the parking-side verge slopes.
  let floor=-Infinity;
  for(let u=-length/2;u<=length/2+.01;u+=length/24) for(let row=0;row<=rows;row++)
    floor=Math.max(floor,ground(u,row*tread)-Math.max(0,row-1)*rise+.15);
  const batches=new Map(), cube=new THREE.BoxGeometry(1,1,1), up=new THREE.Vector3(0,1,0);
  const add=(geometry,color)=>{
    if(!batches.has(color))batches.set(color,[]);
    batches.get(color).push(geometry);
  };
  const block=(w,h,d,color,u,y,v)=>{
    if(h<=0)return;
    add(cube.clone().scale(w,h,d).translate(u,y,v),color);
  };
  const beam=(a,b,size,color)=>{
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),axis=q.clone().sub(p);
    const geometry=cube.clone().scale(size,axis.length(),size);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,axis.normalize()));
    geometry.translate(...p.add(q).multiplyScalar(.5).toArray());add(geometry,color);
  };
  const silver=0xc7ccc6, deck=0x9ca59f, steel=0x5c6863, trim=0xe5e4d6, glass=0x344d53;
  const aisles=[-length/2+1.05,-length/6,length/6,length/2-1.05], aisleWidth=1.2;
  const edges=[-length/2,...aisles.flatMap(u=>[u-aisleWidth/2,u+aisleWidth/2]),length/2];
  for(let row=0;row<rows;row++) {
    const v=(row+.5)*tread, y=floor+row*rise;
    // Footboards are darker than the narrow aluminum benches, keeping each
    // tier legible at the miniature's normal viewing distance.
    block(length,.10,tread-.025,deck,0,y-.05,v);
    for(let i=0;i<edges.length;i+=2) {
      const width=edges[i+1]-edges[i];
      if(width<.7)continue;
      block(width,.09,.29,silver,(edges[i]+edges[i+1])/2,y+.43,v+.09);
      for(let u=edges[i]+.3;u<edges[i+1];u+=2.6)
        block(.065,.41,.21,steel,u,y+.205,v+.09);
    }
    for(const u of aisles) {
      block(aisleWidth,.08,tread/2,deck,u,y+rise/2-.04,(row+.75)*tread);
      if(row%3===0)block(.045,.84,.045,steel,u,y+.42,v);
    }
  }
  const rearY=floor+(rows-1)*rise, rearV=rows*tread;
  block(length,.13,2,deck,0,rearY-.065,rearV+1);
  const feet=[];
  for(let u=-length/2+.15;u<=length/2;u+=length/20) {
    const front=ground(u,.12)-.12, back=ground(u,depth-.18)-.12;
    beam([u,front,.12],[u,floor,.12],.11,steel);
    beam([u,back,depth-.18],[u,rearY,depth-.18],.13,steel);
    beam([u,floor-.12,0],[u,rearY-.12,rearV],.16,steel);
    beam([u,back,depth-.18],[u,floor-.12,.12],.08,steel);
    feet.push({point:world(u,depth-.18),bottom:base+back});
  }
  // Continuous guardrails at the rear and ends, with aisle handrails and
  // short grounded approach steps leading into the seating.
  for(const h of [.52,1.04]) {
    beam([-length/2,rearY+h,depth-.1],[length/2,rearY+h,depth-.1],.05,steel);
    for(const u of [-length/2,length/2])beam([u,floor+h,0],[u,rearY+h,rearV],.05,steel);
  }
  for(let u=-length/2;u<=length/2+.01;u+=length/32)
    block(.05,1.04,.05,steel,u,rearY+.52,depth-.1);
  for(const u of [-length/2,length/2])for(let row=0;row<rows;row+=2)
    block(.05,1.04,.05,steel,u,floor+row*rise+.52,(row+.5)*tread);
  for(const u of aisles) {
    beam([u,floor+.84,tread/2],[u,rearY+.84,rearV-tread/2],.045,steel);
    const entryGround=ground(u,-.35), n=Math.max(1,Math.ceil((floor-entryGround)/.18));
    for(let i=0;i<n;i++) {
      const v=-(n-i)*.28+.14, top=entryGround+(floor-entryGround)*(i+1)/n;
      const bottom=Math.min(ground(u-aisleWidth/2,v),ground(u+aisleWidth/2,v))-.1;
      block(aisleWidth,top-bottom,.30,deck,u,(top+bottom)/2,v);
    }
  }
  // Compact white press box at midfield, behind the last seating row.
  const boxWidth=7.6, boxDepth=1.85, boxV=depth-boxDepth/2;
  block(boxWidth,2.32,boxDepth,trim,0,rearY+1.16,boxV);
  block(boxWidth+.35,.14,boxDepth+.30,silver,0,rearY+2.39,boxV);
  block(boxWidth-.5,.95,.035,glass,0,rearY+1.52,boxV-boxDepth/2-.025);
  for(let u=-boxWidth/2+.25;u<=boxWidth/2;u+=(boxWidth-.5)/5)
    block(.075,1.08,.07,trim,u,rearY+1.52,boxV-boxDepth/2-.05);
  block(boxWidth-.4,.075,.07,trim,0,rearY+1.02,boxV-boxDepth/2-.05);
  for(const [color,geometries] of batches) {
    const geometry=mergeGeometries(geometries,false);
    geometries.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,mat(color));mesh.name='stadium-bleacher-structure';
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.streamCoarse=true;root.add(mesh);
  }
  cube.dispose();
  const padData=drapeTriangles(feature.pts,[0,1,2,0,2,3],grade,grid,.1);
  for(let i=0;i<padData.positions.length;i+=3) {
    const dx=padData.positions[i]-x,dz=padData.positions[i+2]-z;
    padData.positions[i]=dx*ux+dz*uz;padData.positions[i+1]-=base;padData.positions[i+2]=dx*vx+dz*vz;
  }
  const padGeometry=new THREE.BufferGeometry();padGeometry.setAttribute('position',new THREE.Float32BufferAttribute(padData.positions,3));
  padGeometry.setIndex(padData.indices);padGeometry.computeVertexNormals();
  const pad=new THREE.Mesh(padGeometry,mat(0x8b9085));pad.name='stadium-bleacher-pad';pad.receiveShadow=true;pad.userData.streamCoarse=true;root.add(pad);
  root.userData.bleachers={rows,length,depth,pressBox:true,aisles:aisles.length,feet};
  return root;
}
