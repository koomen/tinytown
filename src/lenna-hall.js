// Lenna Hall's mapped, clipped-corner roof and continuous covered veranda.
// The hall walls remain blueprint volumes; this supplies their shared roof,
// porch and masonry portals, with stair feet sampled against the scene grade.
import * as THREE from 'three';
import {box,mat} from './kit.js';
import {surfaceMaterial} from './materials.js';

const C={stone:0xbab59f,deck:0xaaa493,wood:0x62432c,rail:0x765333,roof:0x797b78};
function inset(points,d) {
  return points.map((p,i)=>{
    const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
    const l0=Math.hypot(p[0]-a[0],p[1]-a[1]),l1=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const n0=[(p[1]-a[1])/l0,-(p[0]-a[0])/l0],n1=[(b[1]-p[1])/l1,-(b[0]-p[0])/l1];
    const k=-d/(1+n0[0]*n1[0]+n0[1]*n1[1]);
    return [p[0]+k*(n0[0]+n1[0]),p[1]+k*(n0[1]+n1[1])];
  });
}
export function buildLennaHall(spec,ground={}) {
  const root=new THREE.Group();root.name='lenna-covered-porch';
  const outer=spec.outline,inner=inset(outer,spec.porchDepth),floor=spec.floorH,eave=spec.eave;
  const yAt=ground.heightAt||(()=>-.2),UP=new THREE.Vector3(0,1,0);
  const add=(g,m,name,coarse=true)=>{const mesh=new THREE.Mesh(g,typeof m==='number'?mat(m):m);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;if(coarse)mesh.userData.streamCoarse=true;root.add(mesh);return mesh;};
  const block=(w,h,d,c,u,y,v,name,coarse=true)=>{const m=box(w,h,d,c,u,y,v);m.name=name;m.castShadow=true;m.receiveShadow=true;if(coarse)m.userData.streamCoarse=true;root.add(m);return m;};
  const beam=(a,b,w,c,name,coarse=true)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p);const m=add(new THREE.BoxGeometry(w,delta.length(),w),c,name,coarse);m.position.copy(p.add(q).multiplyScalar(.5));m.quaternion.setFromUnitVectors(UP,delta.normalize());return m;};
  const slab=(pts,bottom,top,c,name)=>{
    const shape=new THREE.Shape(pts.map(([u,v])=>new THREE.Vector2(u,-v)));
    const geo=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false});geo.rotateX(-Math.PI/2);geo.translate(0,bottom,0);return add(geo,c,name);
  };
  const roof=(pts,levels,name)=>{
    const rings=levels.map(([d,y])=>inset(pts,d).map(([u,v])=>[u,y,v])),positions=[];
    for(let r=1;r<rings.length;r++)for(let i=0;i<pts.length;i++){
      const j=(i+1)%pts.length,a=rings[r-1][i],b=rings[r-1][j],c=rings[r][i],d=rings[r][j];
      positions.push(...a,...c,...b,...b,...c,...d);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
    add(geo,surfaceMaterial('shingles',C.roof),name);
    const [d,y]=levels.at(-1),cap=inset(pts,d),center=cap.reduce((p,q)=>[p[0]+q[0]/cap.length,p[1]+q[1]/cap.length],[0,0]),top=[];
    for(let i=0;i<cap.length;i++){const a=cap[i],b=cap[(i+1)%cap.length];top.push(a[0],y,a[1],center[0],y+.75,center[1],b[0],y,b[1]);}
    const capGeo=new THREE.BufferGeometry();capGeo.setAttribute('position',new THREE.Float32BufferAttribute(top,3));capGeo.computeVertexNormals();add(capGeo,surfaceMaterial('shingles',C.roof),name+'-cap');
    slab(pts,levels[0][1]-.22,levels[0][1]-.02,C.wood,name+'-fascia');
  };
  // A shallow flared eave changes into the steep upper roof, all following
  // the same eight real corners. No rectangular shoulder roofs overlap it.
  roof(outer,[[0,eave],[2.0,eave+.24],[3.8,eave+1.15],[6.4,eave+6.5]],'lenna-main-roof');
  if(spec.annexOutline)roof(spec.annexOutline,[[0,4.4],[3.3,6.45]],'lenna-annex-roof');
  slab(inset(outer,.15),floor-.20,floor,C.deck,'lenna-wraparound-deck');
  // Fill under the veranda to the local terrain, including its downhill side.
  for(let i=0;i<outer.length;i++){
    if(i===4)continue; // the rear annex joins the hall here
    const a=outer[i],b=outer[(i+1)%outer.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const n=Math.ceil(L/1.5);
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t;
      const bottom=Math.min(yAt(u,v),yAt(u+(b[0]-a[0])/n/2,v+(b[1]-a[1])/n/2))-.15;
      if(bottom<floor-.2){const m=block(L/n+.025,floor-.2-bottom,.32,C.stone,u,(floor-.2+bottom)/2,v,'lenna-porch-foundation');m.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);}
    }
  }
  const edge=(i)=>{const a=outer[i],b=outer[(i+1)%outer.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);return {a,b,L,t:[(b[0]-a[0])/L,(b[1]-a[1])/L],n:[(b[1]-a[1])/L,-(b[0]-a[0])/L]};};
  const rail=(a,b)=>{
    beam([a[0],floor+1.0,a[1]],[b[0],floor+1.0,b[1]],.14,C.rail,'lenna-porch-handrail');
    beam([a[0],floor+.17,a[1]],[b[0],floor+.17,b[1]],.12,C.wood,'lenna-porch-lower-rail');
    const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.floor(L/.36);
    for(let j=1;j<n;j++){const f=j/n,u=a[0]+f*(b[0]-a[0]),v=a[1]+f*(b[1]-a[1]);block(.10,.76,.10,C.rail,u,floor+.56,v,'lenna-porch-baluster',false);}
  };
  for(let i=0;i<outer.length;i++){
    if(i===4)continue;
    const {a,L,t,n}=edge(i),at=d=>[a[0]+t[0]*d-n[0]*.43,a[1]+t[1]*d-n[1]*.43];
    const count=Math.ceil(L/6);
    for(let j=0;j<count;j++){
      const p=at(.45+j*(L-.9)/count);if(i===0&&Math.abs(.45+j*(L-.9)/count-L/2)<3.1)continue;
      block(.50,eave-floor-.22,.50,C.stone,p[0],(eave-.22+floor)/2,p[1],'lenna-porch-pier');
      block(.70,.20,.70,C.wood,p[0],eave-.20,p[1],'lenna-pier-capital');
    }
    if(i===0){rail(at(.45),at(L/2-3.1));rail(at(L/2+3.1),at(L-.45));}
    else rail(at(.45),at(L-.45));
    beam([a[0],eave-.25,a[1]],[outer[(i+1)%outer.length][0],eave-.25,outer[(i+1)%outer.length][1]],.25,C.wood,'lenna-eave-beam');
  }
  // Pale radial masonry walls form real walk-through arches at the corners.
  for(const i of [0,1,2,3,6,7]){
    const a=inner[i],b=outer[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),margin=.33,r=(L-2*margin)/2;
    // The opening meets the floor, so it is a notch in the outline, not a
    // closed hole crossing outside the shape (which triangulates as a wall).
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(margin,0);shape.lineTo(margin,1.9);
    shape.absarc(L/2,1.9,r,Math.PI,0,true);shape.lineTo(L-margin,0);shape.lineTo(L,0);
    shape.lineTo(L,3.8);shape.lineTo(0,eave-floor-.28);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:false});geo.translate(0,0,-.24);
    const m=add(geo,C.stone,'lenna-arched-porch-support');m.position.set(a[0],floor,a[1]);m.rotation.y=-Math.atan2(dz,dx);
  }
  // One broad entrance flight. Its solid risers reach below the ground at
  // both edges; rail feet follow the same height as their respective tread.
  const {a,b,t,n}=edge(0),center=[(a[0]+b[0])/2,(a[1]+b[1])/2],width=6.0,run=2.8;
  const boardU=(inner[0][0]+inner[1][0])/2+n[0]*.08,boardV=(inner[0][1]+inner[1][1])/2+n[1]*.08;
  const board=block(4.0,1.02,.14,0x7e8977,boardU,floor+1.95,boardV,'lenna-front-notice-board');board.rotation.y=-Math.atan2(t[1],t[0]);
  const sill=block(4.25,.10,.20,C.stone,boardU,floor+1.41,boardV,'lenna-notice-board-sill');sill.rotation.copy(board.rotation);
  const at=(across,out)=>[center[0]+t[0]*across+n[0]*out,center[1]+t[1]*across+n[1]*out];
  const toe=Math.max(...[-width/2,0,width/2].map(u=>yAt(...at(u,run)))),rise=Math.max(.18,floor-toe),steps=Math.max(1,Math.ceil(rise/.18));
  const report=[];
  for(let i=0;i<steps;i++){
    const out=run*(i+.5)/steps,top=floor-rise*(i+1)/steps+.025;
    const bottom=Math.min(...[-width/2,0,width/2].map(u=>yAt(...at(u,out+run/steps/2))))-.14;
    const p=at(0,out),m=block(width,Math.max(.08,top-bottom),run/steps+.025,C.deck,p[0],(top+bottom)/2,p[1],'lenna-entrance-step');m.rotation.y=-Math.atan2(t[1],t[0]);
    report.push({top,bottom,point:p});
  }
  for(const u of [-width/2+.12,0,width/2-.12]){
    const p=at(u,-.12),q=at(u,run-.12);
    beam([p[0],floor+.90,p[1]],[q[0],toe+.93,q[1]],.07,C.stone,'lenna-stair-handrail');
    for(const f of [0,.5,1]){const o=-.12+run*f,pt=at(u,o),y=floor-rise*f;beam([pt[0],y,pt[1]],[pt[0],y+.90,pt[1]],.065,C.stone,'lenna-stair-rail-post');}
  }
  root.userData.lennaHall={outline:outer,inner,porchDepth:spec.porchDepth,steps:report,toe,floor};
  return root;
}
