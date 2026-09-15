// Carnahan–Jackson Garden, southwest of the Chautauqua Amphitheater.
// The geographic boundary/anchor live in the Chautauqua landmark sidecar.
// Small dimensions and planting placement are photo-based approximations.
import * as THREE from 'three';
import {box, mat} from './kit.js';

const C={red:0x923c32,redLight:0xa94d3e,redDark:0x73342d,
  stone:0x92927e,lightStone:0xb6b29c,darkStone:0x686f5c,
  flag:0xb6b2a1,soil:0x626449,water:0x547f76,foam:0xd8e6d4,
  leaf:0x43633e,leafLight:0x5f7748,leafDark:0x304e35};
const up=new THREE.Vector3(0,1,0);

export function buildAmphitheaterGarden(feature, grade=()=>0) {
  const root=new THREE.Group();root.name='carnahan-jackson-garden';
  const spec=feature.garden||{},anchor=spec.position;
  if(!anchor?.every(Number.isFinite)||anchor.length!==2)return root;
  const [x,z]=anchor,angle=spec.angle||0,c=Math.cos(angle),s=Math.sin(angle);
  const base=grade(x,z);root.position.set(x,base,z);root.rotation.y=angle;
  const ground=(u,v)=>grade(x+c*u+s*v,z-s*u+c*v)-base;
  const add=(geometry,color,name,coarse=true)=>{
    const mesh=new THREE.Mesh(geometry,typeof color==='object'?color:mat(color));
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
    if(coarse)mesh.userData.streamCoarse=true;
    root.add(mesh);return mesh;
  };
  const block=(w,h,d,color,u,y,v,name,coarse=true)=>{
    const mesh=box(w,h,d,color,u,y,v);mesh.name=name;
    mesh.castShadow=true;mesh.receiveShadow=true;
    if(coarse)mesh.userData.streamCoarse=true;root.add(mesh);return mesh;
  };
  const rod=(a,b,r,color,name,coarse=true)=>{
    const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),axis=bb.clone().sub(aa);
    const mesh=add(new THREE.CylinderGeometry(r,r,axis.length(),6),color,name,coarse);
    mesh.position.copy(aa.add(bb).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(up,axis.normalize());return mesh;
  };
  const curve=(points,r,color,name,coarse=true)=>add(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),
      Math.max(12,points.length*4),r,5,false),color,name,coarse);
  const rock=(u,y,v,rx,ry,rz,i=0,name='garden-cascade-stone',coarse=true)=>{
    const mesh=add(new THREE.IcosahedronGeometry(1,1),[C.stone,C.lightStone,C.darkStone][i%3],name,coarse);
    mesh.position.set(u,y,v);mesh.scale.set(rx,ry,rz);mesh.rotation.set(.13*i,.71*i,.08*i);return mesh;
  };
  const slab=(points,top,color,name,coarse=true,supported=false)=>{
    const shape=new THREE.Shape(points.map(([u,v])=>new THREE.Vector2(u,-v)));
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false});
    geo.rotateX(-Math.PI/2); // shape y=-v becomes local z=v
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++) {
      const u=p.getX(i),v=p.getZ(i),bottom=top(u,v);
      p.setY(i,supported&&p.getY(i)<.01?Math.min(ground(u,v)-.025,bottom):bottom+p.getY(i));
    }
    geo.computeVertexNormals();return add(geo,color,name,coarse);
  };

  // Three stone bowls step down through the sunken garden. Their walls
  // conceal the supporting base above the local garden terrain.
  const pools=[{u:-1.75,v:-4.0,r:.48},{u:-1.65,v:-2.08,r:.58},{u:-1.65,v:.03,r:.68}];
  const floor=Math.max(...pools.flatMap(p=>Array.from({length:12},(_,i)=>
    ground(p.u+Math.cos(i*Math.PI/6)*(p.r+.21),p.v+Math.sin(i*Math.PI/6)*(p.r+.21)))))+.22;
  const levels=[floor+1.05,floor+.57,floor+.09];
  root.userData.garden={anchor:[...anchor],poolCount:3,pools,waterLevels:levels.map(v=>v+base),
    source:feature.source,reference:'User garden photograph, 2026-09-13'};
  const water=mat(C.water,{roughness:.33,metalness:.12});
  pools.forEach((p,i)=>{
    const level=levels[i],bottom=ground(p.u,p.v)-.07;
    const shell=add(new THREE.CylinderGeometry(p.r+.12,p.r+.21,level-bottom,24,1,true),C.darkStone,'garden-pool-wall');
    shell.position.set(p.u,(level+bottom)/2,p.v);
    // Exactly three horizontal water surfaces; the narrow downstream rill
    // is an open channel, not an extra splash pool.
    const disc=add(new THREE.CircleGeometry(p.r,32),water,'garden-splash-pool');
    disc.rotation.x=-Math.PI/2;disc.position.set(p.u,level,p.v);
    disc.castShadow=false;disc.userData.poolIndex=i;
    const rim=add(new THREE.TorusGeometry(p.r+.04,.065,6,32,i===2?Math.PI*2-.30:Math.PI*2),C.lightStone,'garden-pool-rim');
    rim.rotation.x=Math.PI/2;rim.rotation.z=(i===2?1.21:Math.PI/2)+.15;
    rim.position.set(p.u,level+.045,p.v);
    for(let row=0;row<3;row++)for(let j=0;j<14;j++) {
      const a=(j+row*.42)*Math.PI/7,yy=bottom+(level-bottom)*(row+.5)/3;
      rock(p.u+Math.cos(a)*(p.r+.085),yy,p.v+Math.sin(a)*(p.r+.085),
        .13+(j%3)*.018,(level-bottom)/6+.03,.115,j+row,'garden-pool-masonry',false);
    }
  });
  const waterfall=(a,b,label)=>{
    const middle=[(a[0]+b[0])/2,a[1]-.06,(a[2]+b[2])/2];
    curve([a,middle,b],.073,water,'garden-running-water');
    curve([a.map((v,i)=>v+(i===0?.015:0)),[middle[0]+.015,middle[1]+.016,middle[2]],
      [b[0],b[1]+.014,b[2]]],.018,C.foam,'garden-water-highlight',false);
    for(let i=0;i<3;i++)rock(b[0]+(i-1)*.15,b[1]+.015,b[2]+i*.055,.11,.035,.065,i,'garden-splash',false);
    root.userData.garden[label]=[a,b];
  };
  // Retain the small source at the upper bowl. The three bowls stand apart;
  // no oversized stone bridges or tubular spillways connect them.
  for(let i=0;i<12;i++) {
    const u=-1.8+Math.sin(i*2.3)*(.42+(i%3)*.13),v=-5.08+Math.cos(i*1.4)*.38;
    rock(u,ground(u,v)+.35+(i%3)*.25,v,.35,.37,.31,i);
  }
  for(let i=0;i<3;i++)rock(-1.82+(i-1)*.26,levels[0]+.19+(i===1?.11:0),-5.08,
    .39,.38,.34,i,'garden-cascade-head');
  waterfall([-1.8,levels[0]+.52,-4.95],[-1.75,levels[0]+.015,-4.24],'sourceDrop');
  const channelLevel=levels[2]-.055;
  slab([[-1.62,.76],[-1.27,.43],[1.60,1.23],[1.61,1.83],[-.05,1.79]],
    ()=>channelLevel-.17,C.darkStone,'garden-rill-bed',true,true);
  slab([[-1.47,.76],[-1.26,.58],[1.43,1.35],[1.43,1.63],[-.06,1.58]],
    ()=>channelLevel-.115,water,'garden-rill-water');
  for(let i=0;i<11;i++)for(const side of [-1,1]) {
    const t=i/10,u=-1.45+3.04*t,v=.80+.64*t+side*.27;
    rock(u,channelLevel-.025,v,.18,.13,.19,i,'garden-rill-stone');
  }

  // A small hump-backed plank footbridge, with continuous red handrails and
  // upright posts. The underside clears the stream at the channel crossing.
  const bridge={u:.25,v:1.35,length:3.5,width:1.24};
  const deck=Math.max(channelLevel+.22,...[-1,1].flatMap(side=>[-1,1].map(end=>
    ground(bridge.u+side*bridge.width/2,bridge.v+end*bridge.length/2)+.12)));
  const deckY=t=>deck+.34*Math.sin(Math.PI*t);
  const count=25;
  for(let i=0;i<count;i++) {
    const t=(i+.5)/count,v=bridge.v-bridge.length/2+t*bridge.length;
    const plank=block(bridge.width,.075,bridge.length/count-.014,i%4===0?C.redLight:C.red,
      bridge.u,deckY(t),v,'garden-bridge-plank');
    plank.rotation.x=-Math.atan(.34*Math.PI*Math.cos(Math.PI*t)/bridge.length);
  }
  for(const side of [-1,1]) {
    const u=bridge.u+side*(bridge.width/2-.025);
    const points=Array.from({length:19},(_,i)=>{
      const t=i/18;return[u,deckY(t)-.12,bridge.v-bridge.length/2+t*bridge.length];});
    curve(points,.075,C.redDark,'garden-bridge-stringer');
    for(const height of [.52,1.01])curve(points.map(([a,b,d])=>[a,b+height+.12,d]),
      height>.8?.046:.024,C.red,'garden-bridge-handrail');
    for(let i=0;i<=4;i++) {
      const t=i/4,v=bridge.v-bridge.length/2+t*bridge.length,y=deckY(t);
      block(.095,1.08,.095,C.redDark,u,y+.49,v,'garden-bridge-post');
    }
    for(const end of [-1,1]) {
      const v=bridge.v+end*bridge.length/2,foot=ground(u,v)-.05;
      block(.2,deck-foot,.2,C.redDark,u,(deck+foot)/2,v,'garden-bridge-foot');
    }
  }
  root.userData.garden.bridge={...bridge,deck:deck+base,archRise:.34,channelLevel:channelLevel+base};

  // The public approach is on the Amphitheater side. Its short level landing
  // feeds a west-to-east flight down into the planted pocket, then the path
  // turns around the lower pool to the bridge's near abutment.
  const entry=spec.entry||[-10.8,1.4];
  const upperPosition=spec.stairs?.upper||[-8.4,1.4],lowerPosition=spec.stairs?.lower||[-5.7,1.4];
  const entryLift=spec.entryLift??.04;
  const top=ground(...entry)+entryLift,lower=ground(...lowerPosition)+.12;
  const run=Math.hypot(lowerPosition[0]-upperPosition[0],lowerPosition[1]-upperPosition[1]);
  const direction=lowerPosition.map((v,i)=>(v-upperPosition[i])/run),across=[-direction[1],direction[0]];
  const steps=Math.max(2,Math.ceil((top-lower)/.18));
  const flightPoint=(t,side=0)=>upperPosition.map((v,i)=>v+direction[i]*run*t+across[i]*side);
  const pathHeight=(u,v)=>{
    const bridgeEnd=bridge.v+bridge.length/2;
    const nearBridge=Math.abs(u-bridge.u)<1.3&&v>-1.15&&v<5.05;
    if(nearBridge&&v>bridgeEnd) {
      const t=Math.min(1,(v-bridgeEnd)/(5.05-bridgeEnd));
      return Math.max(ground(u,v)+.10,(deck-.025)*(1-t)+(ground(u,v)+.10)*t);
    }
    if(v<bridge.v-bridge.length/2) {
      const weight=Math.max(0,1-Math.hypot(u-bridge.u,v-bridge.v+bridge.length/2)/2.2);
      return Math.max(ground(u,v)+.1,(deck-.025)*weight+(ground(u,v)+.1)*(1-weight));
    }
    return nearBridge?Math.max(ground(u,v)+.10,deck-.025):ground(u,v)+.1;
  };
  const path=(points,width,height=pathHeight)=>{
    const line=new THREE.CatmullRomCurve3(points.map(([u,v])=>new THREE.Vector3(u,0,v)),false,'centripetal');
    const n=Math.ceil(line.getLength()/.64);
    const point=(t,w)=>{const p=line.getPointAt(t),d=line.getTangentAt(t);return[p.x-d.z*w,p.z+d.x*w];};
    for(let j=0;j<n;j++)for(let side=0;side<2;side++) {
      const t0=(j+.025)/n,t1=(j+.975)/n,l=-width/2+side*width/2+.015,r=l+width/2-.03;
      const p0=point(t0,l),p1=point(t1,l),p2=point(t1,r),p3=point(t0,r);
      // Diagonal joints alternate with broad flags like the reference path.
      const flags=(j+side)%3===0?[[p0,p1,p2],[p0,p2,p3]]:[[p0,p1,p2,p3]];
      for(const flag of flags)slab(flag,(u,v)=>Math.max(height(u,v),ground(u,v)+.08)-.12,
        (j+side)%3?C.flag:C.lightStone,'garden-flagstone',true,true);
    }
  };
  // Broad, gapless landings prevent the flagstone joints becoming a lip at
  // either end of the stairs; flagstone paths start flush with each landing.
  const landing=(a,b,width,height,name)=>{
    const du=b[0]-a[0],dv=b[1]-a[1],length=Math.hypot(du,dv),side=[-dv/length*width/2,du/length*width/2];
    return slab([[a[0]+side[0],a[1]+side[1]],[b[0]+side[0],b[1]+side[1]],
      [b[0]-side[0],b[1]-side[1]],[a[0]-side[0],a[1]-side[1]]],()=>height-.12,C.flag,name,true,true);
  };
  landing(entry,upperPosition,1.44,top,'garden-upper-landing');
  const lowerExit=lowerPosition.map((v,i)=>v+direction[i]*.65);
  landing(lowerPosition,lowerExit,1.44,lower,'garden-lower-landing');
  path([lowerExit,[-4.5,2.6],[-2.3,4.3],[bridge.u,4.55],[bridge.u,3.15]],1.34);
  path([[bridge.u,-.43],[1.45,-1.35],[2.2,-3.4],[1.2,-4.45]],1.15);
  path([[1.45,-1.35],[2.55,.5],[3.0,3.1],[2.1,4.65],[bridge.u,4.55]],1.08);
  for(let i=0;i<steps;i++) {
    const y=top-(top-lower)*(i+1)/steps,[u,v]=flightPoint((i+.5)/steps);
    const edges=[flightPoint(i/steps,-.72),flightPoint(i/steps,.72),
      flightPoint((i+1)/steps,-.72),flightPoint((i+1)/steps,.72)];
    const bottom=Math.min(...edges.map(p=>ground(...p)))-.08;
    const tread=block(1.44,Math.max(.1,y-bottom),run/steps+.014,C.flag,u,(y+bottom)/2,v,'garden-entrance-step');
    tread.rotation.y=Math.atan2(direction[0],direction[1]);
    tread.userData.stepIndex=i;
    const nose=flightPoint((i+1)/steps-.018/run);
    const nosing=block(1.48,.035,.07,C.lightStone,nose[0],y-.005,nose[1],'garden-step-nosing',false);
    nosing.rotation.y=tread.rotation.y;
  }
  for(const side of [-1,1]) {
    const a=flightPoint(-.14/run,side*.83),b=flightPoint(1+.14/run,side*.83);
    rod([a[0],top+.8,a[1]],[b[0],lower+.8,b[1]],.028,C.darkStone,'garden-stair-handrail');
    for(const [p,y] of [[a,top],[b,lower]])
      rod([p[0],ground(...p),p[1]],[p[0],y+.8,p[1]],.03,C.darkStone,'garden-stair-post');
  }
  root.userData.garden.stairs={count:steps,upper:top+base,lower:lower+base,
    entryLevel:ground(...entry)+base+entryLift,riser:(top-lower)/steps,entry,
    upperPosition,lowerPosition,run,direction};

  // Dense, low rhododendron-like shrubs enclose the cascade without covering
  // its pools or the bridge. Deliberate placements leave the flagstone loop open.
  const shrubs=[[-3.45,-4.35,1.0],[-2.85,-5.5,1.05],[-1.05,-5.75,1.15],[.65,-5.65,1.0],
    [2.3,-4.9,.85],[3.1,-3.8,.88],[-3.8,-2.5,.9],[-3.65,-.65,.85],[-3.3,1.35,.85],
    [-2.2,2.15,.62],[-1.8,6.55,.85],[-.45,7.1,.7],[-2.15,8.5,.6],
    [3.65,-1.7,.78],[3.95,.15,.82],[4,2.1,.8],[3.85,4.55,.85],[3.2,6.25,.8],[1.55,8.1,.65]];
  shrubs.forEach(([u,v,r],i)=>{
    const y=ground(u,v);
    const soil=add(new THREE.CircleGeometry(r*1.14,12),C.soil,'garden-planting-bed');
    soil.rotation.x=-Math.PI/2;soil.position.set(u,y+.055,v);
    for(let j=0;j<5;j++) {
      const a=j*Math.PI*.77,rr=j===0?0:r*.49;
      const mesh=add(new THREE.IcosahedronGeometry(1,1),[C.leaf,C.leafLight,C.leafDark][(i+j)%3],'garden-shrub');
      mesh.position.set(u+Math.cos(a)*rr,y+r*(j===0?.78:.52),v+Math.sin(a)*rr);
      mesh.scale.set(r*.63,r*(j===0?.70:.48),r*.64);mesh.rotation.y=a+i;
    }
    // Sparse broad leaf tips preserve the soft outline in nearby detail.
    for(let j=0;j<7;j++) {
      const a=j*2.4+i,leaf=add(new THREE.SphereGeometry(1,5,3),C.leafLight,'garden-leaf',false);
      leaf.scale.set(.17,.035,.075);leaf.position.set(u+Math.cos(a)*r*.82,y+r*.8,v+Math.sin(a)*r*.82);
      leaf.rotation.set(.2,a,.22);
    }
  });
  // A small memorial plaque on the cascade head is geometry, with no texture.
  const plaque=block(.43,.35,.05,0x665b43,-1.73,levels[0]+.43,-5.2,'garden-memorial-plaque',false);
  plaque.rotation.x=-.15;
  return root;
}
