import * as THREE from 'three';
import {buildLandmarks} from '../../../src/landmarks.js';
import {buildLandscapeTree,landscapeTreeProxy,treeSpacing} from '../../../src/vegetation.js';
import {bakeMobile} from '../../../src/bake.js';
import {StreamObjectLoader} from '../../../src/stream-loader.js';
import {disposeStreamScene} from '../../../src/streaming.js';
import {makeRng} from '../../../src/rng.js';
import {createStreetGrade} from '../../../src/street-grade.js';

export async function checkLandscape() {
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const admit=treeSpacing();
  assert(admit(9,9,5),'First tree rejected');
  assert(!admit(11,11,3),'Neighbouring-cell tree overlaps established canopy');
  assert(admit(16,16,3),'Clear tree site rejected');
  const a=buildLandscapeTree(makeRng('same')),b=buildLandscapeTree(makeRng('same'));
  assert(a!==b && a.children[0]!==b.children[0],'Trees must have independent transforms');
  assert(a.scale.equals(b.scale)&&a.rotation.equals(b.rotation),'Identical seeds must reproduce tree poses');
  const box=new THREE.Box3().setFromObject(a);
  assert(box.min.y>=-.01 && box.max.y>3 && box.max.y<9,'Tree must be grounded and have a plausible crown');
  assert(a.children[0].geometry===b.children[0].geometry,'Repeated trees must share their detailed geometry');
  a.position.set(13,2,-7);a.updateMatrixWorld(true);
  const proxy=landscapeTreeProxy(a);
  assert(proxy.position.equals(a.position),'Far crown must stay aligned with the detailed tree');
  const vertices=root=>{let n=0;root.traverse(o=>{n+=o.geometry?.attributes.position.count||0;});return n;};
  assert(vertices(proxy)<vertices(a)/10,'Far trees must discard leaf-level geometry');
  const grove=new THREE.Group();grove.add(a,b);
  const baked=await bakeMobile(grove);
  const instances=[];baked.traverse(o=>{if(o.isInstancedMesh&&o.userData.instanceVegetation)instances.push(o);});
  assert(instances.length===1 && instances[0].count===2,'Sector bake must instance complete tree crowns even in small groves');
  const shared=instances[0].geometry;
  const json=baked.toJSON();json.geometries=[];
  const loaded=await new StreamObjectLoader({[shared.uuid]:shared}).parseAsync(json);
  assert(loaded.children[0].geometry===shared,'Sector decoding must reuse the base tree geometry');
  let disposed=0;shared.addEventListener('dispose',()=>disposed++);
  disposeStreamScene(loaded,new Set([shared]));
  assert(disposed===0,'Evicting a sector must not dispose trees used by other sectors');
  const library=new THREE.Group();library.add(new THREE.Mesh(shared));
  disposeStreamScene(library);
  assert(disposed===1,'Disposing the miniature must release its shared tree geometry once');
  const grid={xs:new Float64Array([-20,-8,4,16,20]),zs:new Float64Array([-20,-8,4,16,20]),nx:4,nz:4};
  const grade=createStreetGrade((x,z)=>Math.sin(x*.2)+Math.cos(z*.3),40,40,grid);
  const root=buildLandmarks([{id:'test',kind:'water',width:5,pts:[[-18,-15],[0,0],[18,15]]}],{grade,grid});
  root.updateMatrixWorld(true);
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert(meshes.some(m=>m.material.userData.surface==='riverbank'),'Water is missing a bank');
  const water=meshes.find(m=>m.material.userData.surface==='water');assert(water,'Water lost its material');
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  for(let i=1;i<20;i++) {
    const x=-18+36*i/20,z=x*15/18;ray.ray.origin.set(x,10,z);
    const hit=ray.intersectObject(water)[0];
    assert(hit&&hit.point.y-grade(x,z)>.1,'Grass penetrates the water at a rural terrain seam');
  }
  return {bankMeshes:meshes.length,waterProbes:19,treeHeight:box.max.y};
}
