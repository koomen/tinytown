// Squat, upward-headed carved fish on the four basin corners. Their mouths
// are the actual start points of the inward water arcs, in fish-local space.
import * as THREE from 'three';
import {mat} from './kit.js';

export function buildFountainFish(stone, mouthDistance) {
  const root=new THREE.Group();root.name='fountain-fish';
  const material=mat(stone),groove=mat(new THREE.Color(stone).multiplyScalar(.58));
  const add=(geometry,name,coarse=true,materialOverride=material)=>{
    const mesh=new THREE.Mesh(geometry,materialOverride);mesh.name=name;
    if(coarse)mesh.userData.streamCoarse=true;
    root.add(mesh);return mesh;
  };
  const oval=(name,p,scale)=>{
    const m=add(new THREE.SphereGeometry(1,14,10),name);m.position.set(...p);m.scale.set(...scale);return m;
  };
  const line=(name,points,radius=.011,coarse=false)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve,points.length*4,radius,5,false),name,coarse);
  };
  const fin=(name,points,position,rotation)=>{
    const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
    const m=add(new THREE.ExtrudeGeometry(s,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:1,steps:1}),name);
    m.position.set(...position);m.rotation.set(...rotation);return m;
  };
  oval('fountain-fish-body',[0,.22,-.10],[.29,.23,.34]);
  oval('fountain-fish-raised-head',[0,.39,.225],[.235,.235,.235]);
  // A broad forked tail and splayed pectoral fins read as fins, with a low
  // center ridge running up the back toward the fish's raised head.
  fin('fountain-fish-tail',[[-.09,-.2],[-.34,-.39],[-.37,-.54],[0,-.44],[.37,-.54],[.34,-.39],[.09,-.2]],
    [0,.10,0],[Math.PI/2,0,0]);
  for(const sign of [-1,1]) {
    fin('fountain-fish-pectoral-fin',[[sign*.17,.17],[sign*.32,.1],[sign*.43,-.12],[sign*.38,-.2],[sign*.26,-.13]],
      [0,.15,0],[Math.PI/2,0,0]);
    for(let i=0;i<3;i++)line('fountain-fish-fin-ray',[[sign*.2,.164,.085],[sign*(.29+i*.035),.164,-.075-i*.04]],.008);
    line('fountain-fish-gill',[[sign*.16,.57,.19],[sign*.225,.46,.10],[sign*.255,.31,.08],[sign*.205,.18,.075]],.013);
    oval('fountain-fish-eye',[sign*.205,.478,.319],[.047,.053,.039]);
    const eye=add(new THREE.SphereGeometry(1,8,6),'fountain-fish-eye-carving',false,groove);
    eye.position.set(sign*.247,.482,.329);eye.scale.set(.009,.019,.021);
  }
  fin('fountain-fish-dorsal-fin',[[-.40,.20],[-.33,.36],[-.23,.37],[-.14,.49],[-.05,.46],[.05,.57],[.15,.50],[.12,.32]],
    [-.022,0,0],[0,-Math.PI/2,0]);
  // Overlapping scalloped scale rows follow the body surface. The shallow
  // grooves sit on both flanks and remain individual stone ridges up close.
  for(const sign of [-1,1])for(let row=0;row<4;row++)for(let col=0;col<4;col++) {
    const z=-.32+row*.095,angle=.22+col*.31+(row%2)*.10;
    const surface=(v,a)=>{const ring=Math.sqrt(Math.max(0,1-((v+.10)/.34)**2));return [sign*.294*ring*Math.sin(a),.22+.234*ring*Math.cos(a),v];};
    line('fountain-fish-scale',[surface(z-.026,angle-.12),surface(z+.022,angle),surface(z-.026,angle+.12)],.009);
  }
  // Torus + inset interior leave a visible open mouth. Its axis follows the
  // initial rising tangent of the jet, rather than terminating under the fish.
  const mouth=new THREE.Vector3(0,.33,mouthDistance),axis=new THREE.Vector3(0,.30,.954).normalize();
  const snout=add(new THREE.CylinderGeometry(.099,.136,.16,12,1,true),'fountain-fish-snout');
  snout.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
  snout.position.copy(mouth).addScaledVector(axis,-.09);
  const rim=add(new THREE.TorusGeometry(.10,.025,6,16),'fountain-fish-open-mouth');
  rim.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);rim.position.copy(mouth);
  const inside=add(new THREE.CircleGeometry(.077,16),'fountain-fish-mouth-interior',true,groove);
  inside.quaternion.copy(rim.quaternion);inside.position.copy(mouth).addScaledVector(axis,-.085);
  root.userData.mouth=mouth.toArray();
  return root;
}
