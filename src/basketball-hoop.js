import * as THREE from 'three';
import {box, mat} from './kit.js';

// The two mapped points are the post and a point toward the playing area.
export function buildBasketballHoop(feature, grade = () => 0) {
  const [[x,z],target] = feature.pts;
  const root = new THREE.Group();
  root.name = `basketball-hoop-${feature.id}`;
  root.position.set(x,grade(x,z)+.08,z);
  root.rotation.y = Math.atan2(target[0]-x,target[1]-z);
  root.userData.streamKind = 'landmark';
  const add = (mesh,name) => {
    mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true;
    mesh.userData.streamCoarse=true; root.add(mesh); return mesh;
  };
  add(box(.16,3.5,.16,'#454a49',0,1.75,0),'hoop-post');
  add(box(.13,.13,.65,'#454a49',0,3.42,.30),'hoop-support');
  add(box(1.8,1.05,.09,'#e2e0d6',0,3.58,.62),'hoop-backboard');
  // Painted target rectangle on the court-facing side of the board.
  for (const dx of [-.30,.30]) add(box(.035,.44,.015,'#a64937',dx,3.30,.673),'board-target');
  for (const y of [3.08,3.52]) add(box(.635,.035,.015,'#a64937',0,y,.673),'board-target');
  add(box(.12,.05,.18,'#b95a35',0,3.05,.74),'rim-bracket');
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.23,.025,6,20),mat('#b95a35'));
  rim.rotation.x=Math.PI/2; rim.position.set(0,3.05,.98); add(rim,'hoop-rim');
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5;
    const top=new THREE.Vector3(Math.cos(a)*.22,3.03,.98+Math.sin(a)*.22);
    const bottom=new THREE.Vector3(Math.cos(a+.3)*.13,2.65,.98+Math.sin(a+.3)*.13);
    const delta=top.clone().sub(bottom);
    const net=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,delta.length(),4),mat('#e8e4d6'));
    net.position.copy(top.add(bottom).multiplyScalar(.5));
    net.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    add(net,'hoop-net');
  }
  return root;
}
