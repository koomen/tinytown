// Explicitly mapped vehicle barriers. pts[0] is the hinge and pts[1] is the
// lowered tip; ordinary landmark projection therefore preserves the whole arm.
import * as THREE from 'three';
import {box,rbox,mat} from './kit.js';

const WHITE='#f2ecdd',RED='#b84b40',DARK='#4c5654',METAL='#a2aaa2';
const ARM_H=.20,ARM_D=.16;
function part(mesh,name,coarse=true){mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;if(coarse)mesh.userData.streamCoarse=true;return mesh;}

export function planGateBarrier(feature,{grade=()=>0}={}){
  const [a,b]=feature.pts||[];
  if(!a||!b)return null;
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(!Number.isFinite(length)||length<1)return null;
  const ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
  const point=(x,z)=>[a[0]+ux*x-uz*z,a[1]+uz*x+ux*z];
  const surface=(x,z)=>grade(...point(x,z))+(feature.pavementLift??.04);
  const footing=(x,z,w,d)=>{
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>point(x+u*w/2,z+v*d/2));
    const levels=corners.map(p=>grade(...p)+(feature.pavementLift??.04));
    return{x,z,w,d,corners,bottom:Math.min(...levels)-.04,top:Math.max(...levels)+.075};
  };
  const cabinet=footing(0,-.48,.82,.92),rest=footing(length,0,.48,.56);
  const hingeY=cabinet.top+(feature.hingeHeight??1.23);
  const angle=THREE.MathUtils.degToRad(THREE.MathUtils.clamp(feature.angle??0,0,90));
  return{length,ux,uz,yaw:-Math.atan2(uz,ux),angle,hingeY,cabinet,rest,
    anchor:a,closedTip:b,raisedTip:[a[0]+ux*length*Math.cos(angle),hingeY+length*Math.sin(angle),a[1]+uz*length*Math.cos(angle)],
    point,surface};
}

export function buildGateBarrier(feature,options={}){
  const root=new THREE.Group();root.name=`gate-barrier-${feature.id}`;
  const p=planGateBarrier(feature,options);if(!p)return root;
  root.position.set(p.anchor[0],0,p.anchor[1]);root.rotation.y=p.yaw;
  root.userData.streamKind='landmark';root.userData.source=feature.source;
  root.userData.gateBarrier={id:feature.id,gate:feature.gate,angle:feature.angle??0,length:p.length};
  for(const [name,foot] of [['cabinet',p.cabinet],['rest',p.rest]])
    root.add(part(box(foot.w,foot.top-foot.bottom,foot.d,'#b6b3a3',foot.x,(foot.top+foot.bottom)/2,foot.z),`${name}-footing`));
  const base=p.cabinet.top;
  root.add(part(rbox(.65,1.10,.70,'#d6d8c7',.055,0,base+.55,-.48),'barrier-cabinet'));
  root.add(part(rbox(.71,.11,.76,DARK,.035,0,base+1.135,-.48),'cabinet-cap'));
  root.add(part(box(.44,.75,.023,'#bec5b9',0,base+.54,-.835),'cabinet-service-panel',false));
  root.add(part(box(.05,.14,.035,DARK,.15,base+.56,-.855),'cabinet-handle',false));
  root.add(part(box(.40,.07,.025,RED,0,base+.95,-.846),'cabinet-reflector'));
  // A real axle and an offset arm plane keep the counterweight clear of the
  // cabinet throughout the lift. Only this group rotates about the hinge.
  const axle=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.38,10),mat(DARK));
  axle.rotation.x=Math.PI/2;axle.position.set(0,p.hingeY,-.095);root.add(part(axle,'hinge-axle'));
  const pivot=new THREE.Group();pivot.name='barrier-arm-pivot';pivot.position.y=p.hingeY;pivot.rotation.z=p.angle;
  pivot.userData.angleDegrees=feature.angle??0;root.add(pivot);
  const sections=Math.max(4,Math.ceil(p.length/.58)),step=p.length/sections;
  for(let i=0;i<sections;i++)pivot.add(part(box(step,ARM_H,ARM_D,i%2?RED:WHITE,step*(i+.5),0,0),'barrier-arm-stripe'));
  pivot.add(part(rbox(.49,.30,.22,DARK,.035,-.25,0,0),'barrier-counterweight'));
  pivot.add(part(box(.07,ARM_H+.025,ARM_D+.025,RED,p.length-.035,0,0),'barrier-tip'));
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.115,.115,.04,10),mat(METAL));
  hub.rotation.x=Math.PI/2;hub.position.z=.135;pivot.add(part(hub,'hinge-hub'));
  // The rest remains at the lowered tip even when the arm is raised. Each
  // footing independently reaches the paved grade rather than floating across
  // the crossfall of the road.
  const restTop=p.hingeY-ARM_H/2-.04,restHeight=Math.max(.1,restTop-p.rest.top);
  root.add(part(box(.18,restHeight,.18,DARK,p.length,p.rest.top+restHeight/2,0),'barrier-rest'));
  root.add(part(box(.34,.08,.34,METAL,p.length,p.hingeY-ARM_H/2-.04,0),'barrier-rest-saddle'));
  for(const side of [-1,1])root.add(part(box(.22,.16,.045,METAL,p.length,p.hingeY-ARM_H/2+.04,side*.15),'barrier-rest-ear',false));
  root.add(part(box(.20,.18,.022,RED,p.length,p.rest.top+restHeight*.65,-.102),'barrier-rest-reflector',false));
  return root;
}
