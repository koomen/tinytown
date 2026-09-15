import * as THREE from 'three';
import {buildBlueprint} from '../../../src/blueprint.js';
import {makeRng} from '../../../src/rng.js';
import {bake} from '../../../src/bake.js';

export async function checkAwnings() {
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const building={obb:{cx:0,cz:0,angle:0,w:12,d:12},style:{kind:'commercial'}};
  let rays=0,roundTrips=0;
  for(const [face,n,t] of [['+u',[1,0],[0,-1]],['-u',[-1,0],[0,1]],['+v',[0,1],[1,0]],['-v',[0,-1],[-1,0]]]) {
    const awning={type:'barrel',range:[.3,.7],y:3.8,depth:3,rise:2.2,color:'#782b3c',trim:'#f4e4ca',posts:true,brand:'athenaeum-hotel'};
    const bp={volumes:[{u:[-6,6],v:[-6,6],height:8,faces:{[face]:{awnings:[awning]}}}]};
    const root=buildBlueprint(makeRng('barrel-awning'),building,bp,0,[]);root.updateMatrixWorld(true);
    const probe=(along,out,y,dy=0,far=3)=>{
      rays++;
      return new THREE.Raycaster(new THREE.Vector3(n[0]*out+t[0]*along,y,n[1]*out+t[1]*along),
        dy?new THREE.Vector3(0,dy,0):new THREE.Vector3(-n[0],0,-n[1]),0,far).intersectObject(root,true);
    };
    assert(!probe(0,10,2,0,2.5).length,face+': front passage beneath canopy is obstructed');
    const ceiling=probe(0,8,2,1,6)[0];
    assert(ceiling?.object.name==='awning-fabric-shell'&&Math.abs(ceiling.point.y-6)<1e-5,face+': solid bottom closes the curved shell');
    assert(probe(2.36,10,2)[0]?.object.name==='awning-support-post',face+': front support is missing');
    assert(probe(1.5,10,4.2)[0]?.object.name==='awning-front-valance',face+': front fabric end is missing');
    const crest=root.getObjectByName('awning-hotel-crest');
    assert(crest?.material.map?.image.width===768,'Local crest texture is missing');
    const canopy=root.getObjectByName('barrel-awning');
    canopy.traverse(o=>{if(o.geometry)assert(o.geometry.attributes.position.array.every(Number.isFinite),'Non-finite awning geometry');});
    const original=new THREE.Box3().setFromObject(crest);
    const baked=bake(root);baked.updateMatrixWorld(true);
    const json=baked.toJSON();
    assert(json.images?.some(image=>typeof image.url==='string'&&image.url.startsWith('data:image/')),'Crest is not embedded in scene serialization');
    const restored=await new THREE.ObjectLoader().parseAsync(json);restored.updateMatrixWorld(true);
    let restoredCrest;restored.traverse(o=>{if(o.material?.userData.landmarkBrand==='athenaeum-hotel')restoredCrest=o;});
    assert(restoredCrest?.material.map?.image.width===768,'Crest was lost during bake/scene reload');
    const bounds=new THREE.Box3().setFromObject(restoredCrest);
    assert(original.min.distanceTo(bounds.min)<1e-5&&original.max.distanceTo(bounds.max)<1e-5,'Crest moved during bake/scene reload');
    assert(restoredCrest.material.side===THREE.DoubleSide&&restoredCrest.material.alphaTest===.4,'Crest material changed during bake/scene reload');
    roundTrips++;
  }
  return {faces:4,rays,roundTrips};
}
