import * as THREE from 'three';
import {buildGateBarrier,planGateBarrier} from '../../../src/gate-barrier.js';
import {buildLandmarks} from '../../../src/landmarks.js';
import {shiftLandmark} from '../../../src/landmark-frame.js';
import {coarseModel} from '../../../tinytown/web/stream-export.js';

export function checkGateBarriers(){
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const grade=(x,z)=>x*.04-z*.025;
  const features=[0,35,80].map((angle,i)=>({id:`barrier-${i}`,kind:'gate-barrier',angle,pts:[[15*i,4],[15*i+4.5,6]]}));
  const built=buildLandmarks(features,{grade});built.updateMatrixWorld(true);
  assert(built.children.length===3,'Only explicitly mapped barriers should be created');
  for(const [i,model] of built.children.entries()){
    const feature=features[i],p=planGateBarrier(feature,{grade}),pivot=model.getObjectByName('barrier-arm-pivot');
    assert(pivot,'A raisable arm needs its own hinge pivot');
    assert(model.userData.streamKind==='landmark','Each barrier must stream in its own location');
    const hinge=new THREE.Vector3().setFromMatrixPosition(pivot.matrixWorld);
    assert(Math.hypot(hinge.x-p.anchor[0],hinge.z-p.anchor[1])<1e-8,'The lift must pivot at its mapped hinge');
    const tip=new THREE.Vector3(p.length,0,0).applyMatrix4(pivot.matrixWorld);
    assert(tip.distanceTo(new THREE.Vector3(...p.raisedTip))<1e-8,'Raised tip has the wrong pose');
    const moved=planGateBarrier(shiftLandmark(feature,123,-67),{grade:(x,z)=>grade(x+123,z-67)});
    assert(Math.abs(moved.length-p.length)<1e-8&&Math.abs(moved.hingeY-p.hingeY)<1e-8,'Recentering changed barrier geometry');
    for(const name of ['cabinet','rest'])for(const corner of p[name].corners){
      const y=grade(...corner)+.04;
      assert(p[name].bottom<y&&p[name].top>y,'The footing must intersect the pavement at every corner');
    }
    const coarse=coarseModel(model),stripes=[];
    model.traverse(o=>{if(o.name==='barrier-arm-stripe')stripes.push(o);});
    assert(stripes.length>=4,'Arm stripes should be native meshes');
    for(const stripe of stripes)assert(coarse.children.some(o=>o.geometry===stripe.geometry&&o.material===stripe.material),'Distant streaming lost the striped arm');
    // Raising about local z must never carry the arm or its counterweight
    // through the cabinet. Their offset planes leave a visible axle between.
    const cabinet=model.getObjectByName('barrier-cabinet');
    cabinet.geometry.computeBoundingBox();const cabinetFront=cabinet.position.z+cabinet.geometry.boundingBox.max.z;
    for(const object of pivot.children)if(object.isMesh){object.geometry.computeBoundingBox();const back=object.position.z+object.geometry.boundingBox.min.z;assert(back>cabinetFront,'Arm swept through the pivot cabinet');}
    assert(new THREE.Box3().setFromObject(model).max.y>hinge.y,'The arm and hinge must survive traversal');
  }
  assert(buildGateBarrier({pts:[]}).children.length===0,'Missing geographic anchors must not invent a gate');
  return{barriers:features.length,poses:features.map(f=>f.angle),groundedFootings:features.length*2};
}
