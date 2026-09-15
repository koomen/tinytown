import * as THREE from 'three';
import {buildBlueprint, blueprintFrontages} from '../../../src/blueprint.js';
import {makeRng} from '../../../src/rng.js';
import {bake} from '../../../src/bake.js';
import {compactFarAttributes} from '../../../src/far-geometry.js';

export function checkArcades() {
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const building={obb:{cx:0,cz:0,angle:0,w:12,d:12},style:{kind:'commercial'}};
  let rays=0, floorSamples=0;
  for(const [face,n,t] of [['+u',[1,0],[0,-1]],['-u',[-1,0],[0,1]],['+v',[0,1],[1,0]],['-v',[0,-1],[-1,0]]]) {
    const arcade={at:[.25,.5,.75],w:2,h:5,y:.5,depth:2,door:{type:'double',w:1.4,h:2.5,fanlight:'dark'},approachDepth:5};
    const bp={volumes:[{u:[-6,6],v:[-6,6],height:8,cornice:{dentils:false},faces:{[face]:{arcade}}}]};
    const root=buildBlueprint(makeRng('arcade'),building,bp,0,[]);root.updateMatrixWorld(true);
    const probe=(along,y,far)=>{rays++;return new THREE.Raycaster(new THREE.Vector3(n[0]*6.5+t[0]*along,y,n[1]*6.5+t[1]*along),new THREE.Vector3(-n[0],0,-n[1]),0,far).intersectObject(root,true);};
    for(const along of [-3,0,3]) {
      assert(!probe(along,4,2).length,face+': solid wall blocks open arch');
      const door=probe(along,1.5,4)[0];
      assert(door && door.distance>2.15 && door.distance<2.5,face+': door is not recessed behind arch');
      assert(probe(along,5.6,2).length,face+': missing wall above arch');
      assert(probe(along+.92,5.3,2).length,face+': curved arch shoulder is missing');
      assert(!probe(along,5.3,2).length,face+': arch head is closed');
    }
    assert(probe(1.5,4,2).length,face+': missing masonry pier');
    const frontage=blueprintFrontages({...building,blueprint:bp})[0];
    assert(frontage.doors.length===3 && frontage.depth===5 && frontage.pathAt===.5,'Arcade entrances missing from frontage calculations');
    root.traverse(o=>{if(o.geometry)assert(o.geometry.attributes.position.array.every(Number.isFinite),'Non-finite arcade geometry');});
    const checkFloor=group=>{
      group.updateMatrixWorld(true);
      for(const along of [-3.23,.23,3.23]) for(const depth of [.04,.75,1.65]) {
        const hits=new THREE.Raycaster(new THREE.Vector3(n[0]*(6-depth)+t[0]*along,1.5,n[1]*(6-depth)+t[1]*along),new THREE.Vector3(0,-1,0),0,2).intersectObject(group,true);
        assert(hits.length && Math.abs(hits[0].point.y-.5)<.005,'Arcade walking elevation changed');
        assert(hits.filter(hit=>Math.abs(hit.point.y-hits[0].point.y)<1e-5).length===1,'Coplanar sill/trim overlaps the arcade floor');
        floorSamples++;
      }
    };
    checkFloor(root);
    const baked=bake(root);checkFloor(baked);
    baked.traverse(o=>{if(!o.geometry)return;
      const attrs=Object.fromEntries(Object.entries(o.geometry.attributes).map(([key,a])=>[key,{array:a.array,itemSize:a.itemSize,normalized:a.normalized}]));
      for(const [key,a] of Object.entries(compactFarAttributes(attrs)))o.geometry.setAttribute(key,new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));
    });checkFloor(baked);
  }
  const stairs=buildBlueprint(makeRng('grounded-stairs'),building,{volumes:[],details:[
    {type:'stair',u:0,v:0,y:-1,height:2,length:4,w:6,foundationDepth:3,railing:false},
    {type:'landing',u:5,v:0,y:-1,height:2,length:2,w:6,construction:'solid',foundationDepth:3,railing:false},
  ]},0,[]);stairs.updateMatrixWorld(true);
  let treads=0;stairs.traverse(o=>{if(o.name==='solid-stair-step'||o.name==='stair-landing-floor') {
    const b=new THREE.Box3().setFromObject(o);assert(Math.abs(b.min.y+4)<1e-5,'Masonry base does not reach requested burial depth');treads++;
  }});
  assert(treads===12,'Stair or solid landing missing');
  assert(!stairs.getObjectByName('stair-landing-support'),'Solid masonry landing has exposed posts');
  return {faces:4,rays,floorSamples,groundedPieces:treads};
}
