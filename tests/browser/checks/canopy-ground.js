import * as THREE from 'three';
import {buildCanopy} from '../../../src/site.js';
import {makeRng} from '../../../src/rng.js';

export function checkCanopyGround() {
  let vertices=0;
  for(const rotation of [0,.7,-1.2])for(const grade of [
    (x,z)=>.12*x-.08*z,
    (x,z)=>.4*Math.sin(x*.5)+.3*Math.cos(z*.4),
  ]) {
    const ex={x:12,z:-8,w:14,d:9,height:5,rotation};
    const world=(u,v)=>[ex.x+Math.cos(rotation)*u+Math.sin(rotation)*v,ex.z-Math.sin(rotation)*u+Math.cos(rotation)*v];
    const base=grade(ex.x,ex.z),g=buildCanopy(makeRng('canopy'),ex,grade);
    const pad=g.getObjectByName('canopy-pavement'),p=pad.geometry.attributes.position;
    for(let i=0;i<pad.geometry.userData.topVertexCount;i++) {
      const clearance=base+p.getY(i)-grade(...world(p.getX(i),p.getZ(i)));
      if(Math.abs(clearance-.08)>.00001)throw new Error('Pavement must follow the full terrain, including interior bumps');
      vertices++;
    }
    for(const post of g.children.filter(o=>o.name==='canopy-post')) {
      const bounds=new THREE.Box3().setFromObject(post),floor=grade(...world(post.position.x,post.position.z))-base+.08;
      if(Math.abs(bounds.min.y-(floor-.05))>.00001||Math.abs(bounds.max.y-5)>.00001)
        throw new Error('Posts must meet the sloping pad and level canopy');
    }
  }
  return {vertices,poses:6};
}
