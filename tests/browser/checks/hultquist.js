import * as THREE from 'three';
import {buildBlueprint} from '../../../src/blueprint.js';
import {makeRng} from '../../../src/rng.js';
import {coarseModel} from '../../../tinytown/web/stream-export.js';

export async function checkHultquistAndBaptist() {
  const site=await (await fetch('/data/chautauqua/site.json')).json();
  const build=id=>{
    const b=site.buildings.find(b=>b.id===id);
    const root=buildBlueprint(makeRng('reference-check'),{...b,obb:{...b.obb,cx:0,cz:0,angle:0}},b.blueprint,0,[]);
    root.userData.streamKind='building';root.updateMatrixWorld(true);return root;
  };
  const hall=build(1416154858),veranda=hall.getObjectByName('hultquist-veranda');
  const all=[];hall.traverse(o=>{if(o.isMesh){all.push(o);if(!o.geometry.attributes.position.array.every(Number.isFinite))throw new Error('Non-finite Hultquist geometry');}});
  const ray=(root,p,d)=>new THREE.Raycaster(new THREE.Vector3(...p),new THREE.Vector3(...d)).intersectObject(root,true)[0];
  const {front,side,eave}=veranda.userData.hultquist;
  // Look through every arch above the rail: the first surface must be the
  // recessed room wall, not glazing or a filled wall across the veranda.
  for(const row of [front,side])for(let i=1;i<row.length;i++){
    const a=row[i-1],b=row[i],p=[(a[0]+b[0])/2,5.1,(a[1]+b[1])/2];
    const direction=row===front?[0,0,-1]:[-1,0,0];p[row===front?2:0]+=1;
    const hit=ray(hall,p,direction);
    if(!hit||hit.distance<3)throw new Error('Hultquist upper veranda is blocked');
    const roofHit=ray(hall,[p[0]+direction[0]*1.7,eave+10,p[2]+direction[2]*1.7],[0,-1,0]);
    if(!roofHit||roofHit.object.name!=='hultquist-main-hip')throw new Error('Veranda lacks its shared main roof');
  }
  const coarse=coarseModel(hall);
  // The distant model must preserve open bays and their structure as well.
  if(!['hultquist-open-arch','hultquist-corner-sign'].every(name=>coarse.children.some(o=>o.geometry===hall.getObjectByName(name).geometry)))throw new Error('Hultquist identity lost in coarse geometry');
  const opening=ray(hall,[6.5,1.6,16.8],[-Math.SQRT1_2,0,-Math.SQRT1_2]);
  if(!opening||opening.distance<2.5)throw new Error('Hultquist corner entrance is blocked');
  const baptist=build(820058828),steps=[];
  baptist.traverse(o=>{if(o.name==='stair-tread')steps.push(o);});
  if(steps.length<7||steps.length>11)throw new Error('Baptist side stair has the wrong rise');
  const bounds=new THREE.Box3();steps.forEach(o=>bounds.union(new THREE.Box3().setFromObject(o)));
  if(bounds.min.x< -6.8||bounds.max.x> -5.55||bounds.max.z-bounds.min.z<2.7||bounds.max.x-bounds.min.x>1.15)throw new Error('Baptist stair projects toward the hall or intersects the wall');
  const hit=ray(baptist,[-10,3.6,-3],[1,0,0]);
  if(!hit||hit.point.x< -4.35)throw new Error('Baptist gallery is not recessed');
  const landing=baptist.getObjectByName('stair-landing-floor'),top=new THREE.Box3().setFromObject(steps.at(-1)),deck=new THREE.Box3().setFromObject(landing);
  if(Math.abs(top.max.y-deck.max.y)>.02||Math.abs(top.min.z-deck.max.z)>.03)throw new Error('Baptist stair does not meet its landing');
  return {hultquistArches:all.filter(o=>o.name==='hultquist-open-arch').length,baptistSteps:steps.length};
}
