import * as THREE from 'three';
import {buildBlueprint} from '../../../src/blueprint.js';
import {makeRng} from '../../../src/rng.js';
import {massingBlueprint} from '../../../src/massing.js';

export function checkFidelityGeometry() {
  const bp = {volumes:[{id:'main',u:[-4,4],v:[-3,3],height:6,roof:{type:'hip',h:2},cornice:{height:.4,dentils:false},faces:{'-v':{
    pilasters:{at:[.1,.9],height:6,fitUnderEave:true},
    storeys:[{y:1,windows:{type:'arch',w:2,h:3,at:[.5],divisions:{vertical:[.2,.5,.8],horizontal:[.3,.6]}}}],
    parapets:[{at:.5,width:3,height:2,outline:[[-.5,0],[.5,0],[.5,.3],[.2,.7],[0,1],[-.2,.7],[-.5,.3]]}],
    moldings:[{range:[0,1],y:.3,profile:[{height:.1,depth:.1},{height:.15,depth:.2}]}]
  }}}]};
  const root=buildBlueprint(makeRng('fidelity'),{obb:{cx:0,cz:0,angle:0}},bp,0,[]);
  root.updateMatrixWorld(true);
  let caps=0,bars=0;
  root.traverse(o=>{
    if(o.geometry) for(const attr of ['position','normal']) if(o.geometry.attributes[attr] && ![...o.geometry.attributes[attr].array].every(Number.isFinite)) throw new Error('Non-finite custom geometry');
    if(o.name==='pilaster-cap') {
      caps++;
      const bounds=new THREE.Box3().setFromObject(o);
      if(bounds.max.y >= 5.6) throw new Error('Fitted capital penetrates cornice/roof');
    }
    if(o.name==='custom-window-bar') {
      bars++;
      o.geometry.computeBoundingBox();
      const bounds=o.geometry.boundingBox.clone().translate(o.position);
      if(bounds.min.y < -1.51 || bounds.max.y > 1.51 || bounds.min.x < -1.01 || bounds.max.x > 1.01) throw new Error('Custom mullion escapes pane bounds');
    }
  });
  if(caps!==2 || bars!==5) throw new Error(`Expected two fitted capitals and five custom bars, got ${caps}/${bars}`);
  const simple=massingBlueprint(bp);
  if(simple.volumes[0].height!==6 || simple.volumes[0].faces['-v'].storeys[0].windows.at.length!==1 || !bp.volumes[0].faces['-v'].storeys[0].windows.divisions) throw new Error('Massing preview changed source architecture');
  const carrier = {volumes:[{id:'raised-roof',u:[-5,5],v:[-4,4],bottom:7.45,height:7.85,
    roof:{type:'gable',ridge:'u',pitch:.4}}]};
  const neutralCarrier = buildBlueprint(makeRng('carrier'),{obb:{cx:0,cz:0,angle:0}},massingBlueprint(carrier),0,[]);
  neutralCarrier.updateMatrixWorld(true);
  let carrierWalls = 0;
  neutralCarrier.traverse(o=>{
    if (!o.userData.volumeWall) return;
    carrierWalls++;
    const box=new THREE.Box3().setFromObject(o);
    if (box.min.y < 7.44 || box.max.y > 7.86) throw new Error('Massing introduced walls below the raised roof carrier');
  });
  if (carrierWalls !== 1) throw new Error('Massing introduced a wall split absent from the source');
  return {caps,bars};
}
