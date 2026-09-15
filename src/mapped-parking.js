// Surveyed parking rows use the same little cars and real sedan scale as Avon.
// Only explicitly authored rows opt a lot out of the generic parking planner.
import * as THREE from 'three';
import {buildCar} from './kit.js';
import {makeRng} from './rng.js';

const SCALE=1.3,LENGTH=3.7*SCALE,WIDTH=1.75*SCALE;
function inside(ring,x,z){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
}return hit;}
function separated(a,b){for(const ring of [a,b])for(let i=0;i<ring.length;i++){
  const p=ring[i],q=ring[(i+1)%ring.length],nx=q[1]-p[1],nz=p[0]-q[0];
  const pa=a.map(([x,z])=>x*nx+z*nz),pb=b.map(([x,z])=>x*nx+z*nz);
  if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return true;
}return false;}

export function planParkingRows(rows=[],{lots=[],surfaceY=()=>0,roadEdge=()=>Infinity,W=Infinity,H=Infinity}={}){
  const result=[],byId=new Map(lots.map(l=>[String(l.id),l]));
  for(const row of rows.filter(r=>r.kind==='parking-row').sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
    const lot=byId.get(String(row.parkingLotId));if(!lot||!row.pts?.length)continue;
    const outline=lot.osmPts||lot.pts,rng=makeRng(`mapped-parking:${row.id}`),spacing=row.spacing||3.1;
    for(let segment=1;segment<row.pts.length;segment++){
      const a=row.pts[segment-1],b=row.pts[segment],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<spacing)continue;
      const ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
      for(let along=spacing/2,index=0;along<=length-spacing/2;along+=spacing,index++){
        const occupied=rng.chance(row.occupancy??.6),jitter=rng.range(-.09,.09),yawJitter=rng.range(-.02,.02);
        if(!occupied)continue;
        const x=a[0]+ux*(along+jitter),z=a[1]+uz*(along+jitter);
        const angle=Math.atan2(-uz,ux)+(row.yawOffset||0)+((row.face??1)<0?Math.PI:0)+yawJitter;
        const fx=Math.sin(angle),fz=Math.cos(angle),rx=fz,rz=-fx;
        const footprint=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>[x+fx*s*(LENGTH/2+.18)+rx*t*(WIDTH/2+.18),z+fz*s*(LENGTH/2+.18)+rz*t*(WIDTH/2+.18)]);
        // Check full edges as well as corners: the North Lot has a concave L.
        if(footprint.some((p,i)=>{
          const q=footprint[(i+1)%4];for(let k=0;k<=6;k++){
            const px=p[0]+(q[0]-p[0])*k/6,pz=p[1]+(q[1]-p[1])*k/6;
            if(!inside(outline,px,pz)||roadEdge(px,pz)<.2||Math.abs(px)>W/2-1||Math.abs(pz)>H/2-1)return true;
          }return false;
        })||result.some(p=>!separated(footprint,p.footprint)))continue;
        // Fit the four wheels to the local paved grade, preserving pitch and
        // roll. Reject sharply folded terrain rather than float over a curb.
        const track=.82*SCALE,wheelbase=1.15*SCALE;
        const sample=(side,end)=>surfaceY(x+rx*side*track+fx*end*wheelbase,z+rz*side*track+fz*end*wheelbase);
        const fl=sample(-1,1),fr=sample(1,1),bl=sample(-1,-1),br=sample(1,-1);
        const forward=new THREE.Vector3(fx,(fl+fr-bl-br)/(4*wheelbase),fz).normalize();
        const right=new THREE.Vector3(rx,(fr+br-fl-bl)/(4*track),rz).normalize();
        const up=forward.clone().cross(right).normalize();right.crossVectors(up,forward).normalize();
        const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));
        const wheels=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([side,end])=>{
          const offset=new THREE.Vector3(side*track,0,end*wheelbase).applyQuaternion(quaternion);
          return {x:x+offset.x,z:z+offset.z,offsetY:offset.y,grade:surfaceY(x+offset.x,z+offset.z)};
        });
        const supports=wheels.map(w=>w.grade-w.offsetY);if(Math.max(...supports)-Math.min(...supports)>.12)continue;
        const y=Math.max(...supports)+.015;for(const w of wheels)w.clearance=y+w.offsetY-w.grade;
        result.push({id:`${row.id}-${segment}-${index}`,rowId:row.id,parkingLotId:row.parkingLotId,x,y,z,angle,quaternion:quaternion.toArray(),footprint,wheels});
      }
    }
  }
  return result;
}

export function buildMappedParking(rows=[],options={}){
  const group=new THREE.Group();group.name='mapped-parking';
  for(const placement of planParkingRows(rows,options)){
    const car=buildCar(makeRng(`mapped-car:${placement.id}`));car.name=`parked-${placement.id}`;car.scale.setScalar(SCALE);
    car.position.set(placement.x,placement.y,placement.z);car.quaternion.fromArray(placement.quaternion);
    car.userData.streamKind='landmark';car.userData.parking=placement;
    // The rounded body, dark cabin, and four wheels remain recognizable when
    // another sector is loaded; these are the unchanged existing car meshes.
    car.traverse(o=>{if(o.isMesh){o.userData.streamCoarse=true;o.castShadow=true;o.receiveShadow=true;}});
    group.add(car);
  }
  return group;
}
