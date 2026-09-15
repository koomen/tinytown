// Alumni Hall's faceted upper balcony follows the projecting bay below it.
// The rear cap slopes into the main hip rather than stopping above its eave.
import * as THREE from 'three';
import {box,mat} from './kit.js';
import {surfaceMaterial,facadeMaterial} from './materials.js';

export function buildAlumniHallBalcony() {
  const root=new THREE.Group();root.name='alumni-hall-balcony';
  const trim=0xf0e9db,roofColor=0x59606a,floor=8.12,eave=10.46;
  const add=(g,m,name)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;o.userData.streamCoarse=true;root.add(o);return o;};
  const block=(w,h,d,x,y,z,name)=>{const o=box(w,h,d,trim,x,y,z);o.name=name;o.castShadow=true;o.receiveShadow=true;o.userData.streamCoarse=true;root.add(o);return o;};
  const beam=(a,b,width,name)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);const o=block(width,d.length(),width,0,0,0,name);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
  const plan=[[10,-3.1],[12.1,-3.1],[13.3,-1.9],[13.3,3.1],[12.1,4.3],[10,4.3]];
  const slab=new THREE.ExtrudeGeometry(new THREE.Shape(plan.map(([u,v])=>new THREE.Vector2(u,-v))),{depth:.18,bevelEnabled:false});
  slab.rotateX(-Math.PI/2);slab.translate(0,floor-.18,0);add(slab,mat(trim),'alumni-balcony-deck');
  // The reference shows a room face and door behind the open balcony, not
  // a bare roof slope crossing the usable deck.
  const back=block(.14,2.32,6.65,11.72,floor+1.16,.6,'alumni-balcony-room-wall');
  back.material=facadeMaterial(0xd5d4ca,'commercial','','siding');
  const door=block(.08,2.03,1.05,11.83,floor+1.015,.6,'alumni-balcony-room-door');door.material=mat(0x46565d);
  for(const v of [.01,1.19])block(.12,2.12,.11,11.90,floor+1.06,v,'alumni-balcony-door-jamb');
  block(.12,.13,1.29,11.90,floor+2.12,.6,'alumni-balcony-door-head');
  // Four front columns are over the four matching corners of the bay.
  const posts=plan.slice(1,5).map(([u,v])=>[u-.10,v+(v<.6?.10:-.10)]);
  for(const [u,v] of posts){block(.22,eave-floor,.22,u,(floor+eave)/2,v,'alumni-balcony-post');block(.34,.12,.34,u,floor+.06,v,'alumni-balcony-post-base');block(.33,.15,.33,u,eave-.075,v,'alumni-balcony-capital');}
  const railPlan=[[10.25,-3.0],...posts,[10.25,4.2]];
  for(let i=1;i<railPlan.length;i++){
    const [a,b]=[railPlan[i-1],railPlan[i]];
    for(const [h,w] of [[.94,.095],[.13,.065]])beam([a[0],floor+h,a[1]],[b[0],floor+h,b[1]],w,'alumni-balcony-rail');
    const count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.27);
    for(let j=1;j<count;j++){const t=j/count;block(.045,.76,.045,a[0]+(b[0]-a[0])*t,floor+.52,a[1]+(b[1]-a[1])*t,'alumni-balcony-baluster');}
  }
  // The rear edge is buried within the main roof. Front facets sit on the
  // columns; the raised point gives the compact pavilion its pitched cap.
  const perimeter=[[10,eave+.12,-3.4],[12.2,eave+.12,-3.4],[13.6,eave+.12,-2],[13.6,eave+.12,3.2],[12.2,eave+.12,4.6],[10,eave+.12,4.6]];
  const ceilingPlan=[[10,-3.4],...[1,2,3,4].map(i=>[perimeter[i][0],perimeter[i][2]]),[10,4.6]];
  const ceiling=new THREE.ExtrudeGeometry(new THREE.Shape(ceilingPlan.map(([u,v])=>new THREE.Vector2(u,-v))),{depth:.10,bevelEnabled:false});
  ceiling.rotateX(-Math.PI/2);ceiling.translate(0,eave,0);add(ceiling,mat(trim),'alumni-balcony-ceiling');
  const apex=[10.7,12.0,.6],vertices=[];
  for(let i=0;i<perimeter.length;i++)vertices.push(...perimeter[(i+1)%perimeter.length],...perimeter[i],...apex);
  const rearA=[6.5,8.8,-3.4],rearB=[6.5,8.8,4.6];
  vertices.push(...rearA,...rearB,...perimeter[0],...perimeter[0],...rearB,...perimeter[5]);
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));cap.computeVertexNormals();add(cap,surfaceMaterial('shingles',roofColor),'alumni-balcony-hip-cap');
  for(let i=0;i<5;i++)beam(perimeter[i],perimeter[i+1],.18,'alumni-balcony-fascia');
  root.userData.alumniHallBalcony={floor,eave,posts,roofRear:[6.5,8.8,.6],roofApex:apex,source:'Google Street View ENE and South Avenue, July 2012'};
  return root;
}
