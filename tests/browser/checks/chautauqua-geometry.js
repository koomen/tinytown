import * as THREE from 'three';
import { lakeGrade } from '../../../src/lake-grade.js';
import { buildLandmarks } from '../../../src/landmarks.js';
import { buildBlueprint } from '../../../src/blueprint.js';
import { makeRng } from '../../../src/rng.js';

export function checkLakefront() {
  const features=[{id:1,kind:'water',closed:true,level:2,pts:[[-20,-20],[20,-20],[20,20],[-20,20]]}];
  const grade=lakeGrade(features,()=>8);
  if(grade(0,0)>=2||grade(40,40)!==8)throw new Error('Lake bed grading failed');
  const root=buildLandmarks(features,{grade});
  root.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-2.12)>1e-5)throw new Error('Lake water is not level');}});
  return true;
}
export function checkUpperPorches() {
  const bp={wall:'#eeeeee',trim:'#dddddd',roofColor:'#555555',volumes:[{id:'main',u:[-5,5],v:[-4,4],height:6.5,roof:{type:'gable',ridge:'u',pitch:.3},faces:{'+v':{porches:[{style:'open',w:8,d:2,height:2.67,floorH:3.43,floorThickness:.22,posts:4,roof:'flat',railing:true}]}}}]};
  const b={id:1,obb:{cx:0,cz:0,w:10,d:8,angle:0},pts:[[-5,-4],[5,-4],[5,4],[-5,4]],style:{}};
  const root=buildBlueprint(makeRng('porch'),b,bp,0,[]);root.updateMatrixWorld(true);
  const posts=[];root.traverse(o=>{if(o.name==='porch-post')posts.push(o);});
  if(posts.length!==4)throw new Error('Upper porch posts missing');
  for(const post of posts){const bounds=new THREE.Box3().setFromObject(post);if(Math.abs(bounds.min.y-3.43)>.01||Math.abs(bounds.max.y-6.1)>.01)throw new Error('Porch post exceeds its eave');}
  // Below the balcony but outside the wall: no solid foundation may fill it.
  const ray=new THREE.Raycaster(new THREE.Vector3(0,2,10),new THREE.Vector3(0,0,-1),0,5.5);
  if(ray.intersectObject(root,true).length)throw new Error('Upper deck is filled to the ground');
  return true;
}
