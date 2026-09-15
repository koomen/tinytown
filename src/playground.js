// Photo-grounded park equipment. Positions and headings come from the authored
// landmark; every support samples its own foot so it follows the terrain.
import * as THREE from 'three';
import { box, mat } from './kit.js';

const C = { wood:0x826044, lightWood:0x9b7955, darkWood:0x634936, roof:0x775645,
  green:0x267c76, metal:0x727a6e, chain:0x9d9d8d, seat:0x284e46,
  red:0xc86552, yellow:0xe4bd55, iron:0x353e36 };
const up = new THREE.Vector3(0,1,0);

function rod(group, a, b, radius, color, name = 'playground-rail') {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const axis = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,axis.length(),8),mat(color));
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(up,axis.normalize());
  mesh.name=name; group.add(mesh); return mesh;
}

function support(group, ground, x, z, top, radius, color = C.wood) {
  const bottom=ground(x,z)-.025;
  const mesh=rod(group,[x,bottom,z],[x,top,z],radius,color,'playground-support');
  mesh.userData.foot=[x,bottom,z];
  return mesh;
}

function deck(group,x,z,width,depth,height) {
  const n=Math.ceil(width/.2), step=width/n;
  for(let i=0;i<n;i++) {
    const plank=box(step-.012,.14,depth,i%3===0?C.lightWood:C.wood,x-width/2+step*(i+.5),height-.07,z);
    plank.name='playground-deck';group.add(plank);
  }
  for(const side of [-1,1]) group.add(box(width,.2,.15,C.darkWood,x,height-.2,z+side*(depth/2-.12)));
}

function railing(group,a,b,height) {
  for(const y of [height+.18,height+.87]) rod(group,[a[0],y,a[1]],[b[0],y,b[1]],.075,C.wood);
  const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.24);
  for(let i=0;i<=n;i++) {
    const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    rod(group,[x,height+.18,z],[x,height+.87,z],.034,C.lightWood);
  }
}

function roof(group,x,z,width,depth,eave,rise) {
  const half=width/2+.2, len=depth+.4, slope=Math.hypot(half,rise);
  for(const side of [-1,1]) {
    const mesh=box(slope,.1,len,C.roof,x+side*half/2,eave+rise/2,z);
    mesh.rotation.z=-side*Math.atan2(rise,half);mesh.name='playground-gabled-roof';group.add(mesh);
    // Shingle courses are shallow strips, readable without a custom shader.
    for(let i=1;i<=5;i++) {
      const t=i/6, row=box(.055,.026,len+.025,i%2?C.lightWood:C.roof,
        x+side*half*t,eave+rise*(1-t)+.065,z);
      row.rotation.z=mesh.rotation.z;group.add(row);
    }
    for(const end of [-1,1])rod(group,[x,eave+rise,z+end*len/2],
      [x+side*half,eave,z+end*len/2],.065,C.darkWood);
  }
  rod(group,[x,eave+rise+.055,z-len/2],[x,eave+rise+.055,z+len/2],.08,C.darkWood);
}

function tower(group,ground,{x=0,z=0,width=1.8,depth=1.8,height=2.1,open=[]}) {
  const eave=height+1.55;
  for(const sx of [-1,1])for(const sz of [-1,1]) {
    const u=x+sx*width/2,v=z+sz*depth/2;
    support(group,ground,u,v,eave+.1,.13);
  }
  deck(group,x,z,width,depth,height);
  for(const side of [-1,1]) {
    if(!open.includes(side<0?'front':'back'))railing(group,[x-width/2,z+side*depth/2],[x+width/2,z+side*depth/2],height);
    if(!open.includes(side<0?'left':'right'))railing(group,[x+side*width/2,z-depth/2],[x+side*width/2,z+depth/2],height);
  }
  roof(group,x,z,width,depth,eave,.65);
}

function ladder(group,ground,{x,z,height,length=1.4,width=.8}) {
  const footZ=z+length, bottom=Math.max(ground(x-width/2,footZ),ground(x+width/2,footZ))+.08;
  for(const side of [-1,1]) {
    const u=x+side*width/2;
    rod(group,[u,ground(u,footZ),footZ],[u,height,z],.065,C.wood,'playground-ladder-stringer');
    rod(group,[u,bottom+.75,footZ],[u,height+.8,z],.045,C.red);
    rod(group,[u,height,z],[u,height+.8,z],.045,C.red);
  }
  const n=Math.max(3,Math.ceil((height-bottom)/.27));
  for(let i=1;i<=n;i++) {
    const t=i/n;
    rod(group,[x-width/2,bottom+(height-bottom)*t,footZ-length*t],
      [x+width/2,bottom+(height-bottom)*t,footZ-length*t],.055,C.lightWood,'playground-ladder-rung');
  }
}

function slide(group,ground,{x,z,height,length=3.6,width=.75}) {
  // A continuous open trough, with a level runout and raised green sides.
  const finish=ground(x,z-length)+.18;
  const profile=[[0,height],[.12,height-.03],[.28,height-.26],[.52,height*.55+finish*.45],
    [.76,finish+.3],[.9,finish+.06],[1,finish]];
  const positions=[],indices=[];
  for(const [t,y] of profile) {
    const lip=t>.85?.11:.24;
    for(const [u,dy] of [[-.5,lip],[-.43,0],[.43,0],[.5,lip]])positions.push(x+u*width,y+dy,z-t*length);
  }
  for(let i=0;i<profile.length-1;i++)for(let j=0;j<3;j++) {
    const a=i*4+j,b=a+4;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,mat(C.green,{side:THREE.DoubleSide}));mesh.name='playground-slide';group.add(mesh);
  for(const side of [-1,1])for(let i=0;i<profile.length-1;i++) {
    const [t,y]=profile[i],[t1,y1]=profile[i+1];
    rod(group,[x+side*width/2,y+(t>.85?.11:.24),z-t*length],
      [x+side*width/2,y1+(t1>.85?.11:.24),z-t1*length],.045,C.green);
  }
  for(const side of [-1,1])rod(group,[x+side*.42,height,z+.03],[x+side*.42,height+.58,z+.03],.05,C.green);
}

function climbingFrame(group,ground) {
  const x=-3.45,z=.12,height=1.3;
  for(const side of [-1,1])support(group,ground,x,z+side*.73,height+1.1,.115);
  for(const side of [-1,1])rod(group,[x,height+1.1,z+side*.73],[-3.05,height+1.1,z+side*.73],.095,C.wood);
  // A sloping wooden climbing panel with spaced grips, next to the lower deck.
  const bottom=ground(x-1.05,z)+.06;
  for(const dz of [-.4,0,.4])rod(group,[x-1.05,bottom,z+dz],[-3.05,height,z+dz],.075,C.wood);
  for(let i=1;i<=5;i++) {
    const t=i/5;
    rod(group,[x-1.05+(1.45)*t,bottom+(height-bottom)*t,z-.43],
      [x-1.05+1.45*t,bottom+(height-bottom)*t,z+.43],.065,C.lightWood,'playground-climbing-rung');
  }
}

function playTowers(group,ground,small) {
  if(small) {
    tower(group,ground,{height:1.05,width:1.65,depth:1.65,open:['front','left']});
    tower(group,ground,{x:-2.05,height:.9,width:1.65,depth:1.65,open:['right','back']});
    deck(group,-1.03,0,.65,1.35,.98);
    for(const side of [-1,1])railing(group,[-1.35,side*.72],[-.7,side*.72],.98);
    ladder(group,ground,{x:-2.05,z:.825,height:.9,length:1.65});
    slide(group,ground,{x:0,z:-.825,height:1.05,length:2.3});
  } else {
    tower(group,ground,{height:2.1,open:['front','left','back']});
    tower(group,ground,{x:-2.15,height:1.3,open:['right','left']});
    deck(group,-1.08,0,.6,1.5,1.7);
    for(const side of [-1,1])railing(group,[-1.25,side*.77],[-.9,side*.77],1.7);
    ladder(group,ground,{x:0,z:.9,height:2.1,length:1.4});
    slide(group,ground,{x:0,z:-.9,height:2.1,length:3.6});
    climbingFrame(group,ground);
  }
}

function swings(group,ground,equipment) {
  const length=equipment.length||4.3, count=equipment.seats||2;
  const height=equipment.height||2.65, half=length/2-.15, spread=1.3;
  const bays=Math.ceil(count/2);
  for(let i=0;i<=bays;i++) {
    const x=-half+2*half*i/bays;
    for(const side of [-1,1]) {
      const foot=[x,ground(x,side*spread),side*spread];
      const leg=rod(group,foot,[x,height,0],.065,C.metal,'playground-swing-leg');leg.userData.foot=foot;
    }
    rod(group,[x,height*.43,-spread*.57],[x,height*.43,spread*.57],.042,C.metal);
  }
  rod(group,[-length/2,height,0],[length/2,height,0],.082,C.metal,'playground-swing-beam');
  for(let i=0;i<count;i++) {
    const x=-half+2*half*(i+.5)/count,y=.62;
    const toddler=equipment.toddler===true || (Array.isArray(equipment.toddler)&&equipment.toddler.includes(i));
    const seat=box(.52,.075,.34,toddler?C.green:C.seat,x,y,0);seat.name=toddler?'playground-toddler-seat':'playground-swing-seat';group.add(seat);
    for(const side of [-1,1])rod(group,[x+side*.24,y+.06,0],[x+side*.24,height-.08,0],.016,C.chain,'playground-swing-chain');
    if(toddler) {
      group.add(box(.56,.27,.07,C.green,x,y+.18,.17));
      for(const side of [-1,1])group.add(box(.07,.22,.36,C.green,x+side*.25,y+.16,0));
      group.add(box(.07,.18,.08,C.green,x,y+.11,-.17),box(.55,.075,.075,C.green,x,y+.25,-.17));
    }
  }
}

function springSeesaw(group,ground) {
  for(const x of [-.32,.32])for(const z of [-.28,.28]) {
    const bottom=ground(x,z)+.045, points=[];
    for(let i=0;i<=32;i++) {
      const t=i/32,angle=t*Math.PI*8;
      points.push(new THREE.Vector3(x+Math.cos(angle)*.11,bottom+(.52-bottom)*t,z+Math.sin(angle)*.11));
    }
    const spring=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.027,5,false),mat(C.iron));
    spring.name='playground-seesaw-spring';group.add(spring);
  }
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.13,12),mat(C.red));hub.position.y=.61;group.add(hub);
  for(const x of [-1,1])for(const z of [-1,1]) {
    const u=x*1.1,v=z*.55;
    rod(group,[0,.59,0],[u,.59,v],.073,C.red);
    const seat=box(.44,.08,.38,C.yellow,u,.7,v);seat.name='playground-seesaw-seat';group.add(seat);
    group.add(box(.44,.22,.07,C.yellow,u,.83,v+z*.18));
    rod(group,[u,.7,v-z*.15],[u,1.04,v-z*.15],.035,C.yellow);
    rod(group,[u-.18,1.04,v-z*.15],[u+.18,1.04,v-z*.15],.035,C.yellow);
  }
}

function bench(group,ground,equipment) {
  const length=equipment.length||2.35;
  for(const x of [-length*.35,length*.35]) {
    for(const z of [-.2,.22])support(group,ground,x,z,.47,.035,C.iron);
    rod(group,[x,.4,.23],[x,.95,.36],.04,C.iron);
    rod(group,[x,.41,-.24],[x,.41,.3],.045,C.iron);
  }
  for(let i=0;i<3;i++)group.add(box(length,.06,.135,C.lightWood,0,.47,-.16+i*.16));
  for(let i=0;i<3;i++)group.add(box(length,.105,.055,C.lightWood,0,.66+i*.135,.3+i*.025));
}

export function buildPlaygroundEquipment(equipment = [],grade = () => 0) {
  const root=new THREE.Group();root.name='playground-equipment';
  for(const item of equipment) {
    if(!Array.isArray(item.position)||item.position.length!==2||!item.position.every(Number.isFinite))continue;
    const [x,z]=item.position, angle=item.angle||0, base=grade(x,z)+.12;
    const group=new THREE.Group();group.name=`playground-${item.type}`;
    group.position.set(x,base,z);group.rotation.y=angle;
    const c=Math.cos(angle),s=Math.sin(angle);
    const ground=(u,v)=>grade(x+c*u+s*v,z-s*u+c*v)+.12-base;
    if(item.type==='swings')swings(group,ground,item);
    else if(item.type==='wooden-playset')playTowers(group,ground,item.size==='small');
    else if(item.type==='spring-seesaw')springSeesaw(group,ground);
    else if(item.type==='bench')bench(group,ground,item);
    root.add(group);
  }
  return root;
}
