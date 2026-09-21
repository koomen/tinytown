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
  const school=feature.style==='school',reach=school?1.12:.62,offset=reach-.62;
  if(school) {
    const path=new THREE.CatmullRomCurve3([[0,0,0],[0,2.6,0],[0,3.2,.12],[0,3.58,.52],[0,3.58,1.07]].map(p=>new THREE.Vector3(...p)));
    add(new THREE.Mesh(new THREE.TubeGeometry(path,24,.065,10,false),mat('#68716a')),'hoop-gooseneck');
    const shape=new THREE.Shape();shape.moveTo(-.84,3.1);shape.lineTo(.84,3.1);shape.lineTo(.84,3.57);
    shape.quadraticCurveTo(.8,3.96,0,4.0);shape.quadraticCurveTo(-.8,3.96,-.84,3.57);shape.closePath();
    const board=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false}),mat('#bfc4bb'));
    board.position.z=reach-.045;add(board,'hoop-backboard');
  } else {
    add(box(.16,3.5,.16,'#454a49',0,1.75,0),'hoop-post');
    add(box(.13,.13,.65,'#454a49',0,3.42,.30),'hoop-support');
    add(box(1.8,1.05,.09,'#e2e0d6',0,3.58,.62),'hoop-backboard');
  }
  // Painted target rectangle on the court-facing side of the board.
  for (const dx of [-.30,.30]) add(box(.035,.44,.015,school?'#e0e1d6':'#a64937',dx,3.30,.673+offset),'board-target');
  for (const y of [3.08,3.52]) add(box(.635,.035,.015,school?'#e0e1d6':'#a64937',0,y,.673+offset),'board-target');
  add(box(.12,.05,.18,'#b95a35',0,3.05,.74+offset),'rim-bracket');
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.23,.025,6,20),mat('#b95a35'));
  rim.rotation.x=Math.PI/2; rim.position.set(0,3.05,.98+offset); add(rim,'hoop-rim');
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5;
    const top=new THREE.Vector3(Math.cos(a)*.22,3.03,.98+offset+Math.sin(a)*.22);
    const bottom=new THREE.Vector3(Math.cos(a+.3)*.13,2.65,.98+offset+Math.sin(a+.3)*.13);
    const delta=top.clone().sub(bottom);
    const net=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,delta.length(),4),mat('#e8e4d6'));
    net.position.copy(top.add(bottom).multiplyScalar(.5));
    net.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    add(net,'hoop-net');
  }
  return root;
}
