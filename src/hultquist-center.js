// Hultquist's two-storey veranda, from the supplied Bestor Plaza corner photo.
// The room walls stay in the blueprint; the porch and roof share one outline.
import * as THREE from 'three';
import {box,mat} from './kit.js';
import {surfaceMaterial,facadeMaterial} from './materials.js';

const C={wall:0xe1d3a6,trim:0xf0e7ce,accent:0x355a54,deck:0xa79d81,roof:0x6d6c66,red:0xa4414a,blue:0x283f61};
const UP=new THREE.Vector3(0,1,0);
export function buildHultquistCenter(spec={},ground={}) {
  const root=new THREE.Group();root.name='hultquist-veranda';
  const floor=spec.floorH??.55,upper=3.65,eave=7.15;
  const yAt=ground.heightAt||(()=>-.15);
  const add=(geo,material,name,coarse=true)=>{
    const m=new THREE.Mesh(geo,typeof material==='number'?mat(material):material);
    m.name=name;m.castShadow=true;m.receiveShadow=true;
    if(coarse)m.userData.streamCoarse=true;root.add(m);return m;
  };
  const block=(w,h,d,color,u,y,v,name,coarse=true)=>{
    const m=box(w,h,d,color,u,y,v);m.name=name;m.castShadow=true;m.receiveShadow=true;
    if(coarse)m.userData.streamCoarse=true;root.add(m);return m;
  };
  const beam=(a,b,width,color,name,coarse=true)=>{
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);
    const m=add(new THREE.BoxGeometry(width,d.length(),width),color,name,coarse);
    m.position.copy(p.add(q).multiplyScalar(.5));m.quaternion.setFromUnitVectors(UP,d.normalize());return m;
  };
  const slab=(pts,bottom,top,color,name)=>{
    const geo=new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([u,v])=>new THREE.Vector2(u,-v))),{depth:top-bottom,bevelEnabled:false});
    geo.rotateX(-Math.PI/2);geo.translate(0,bottom,0);return add(geo,color,name);
  };
  // Four Miller Avenue bays, a rounded entrance corner, then the long side.
  const corner=Array.from({length:13},(_,i)=>{
    const a=Math.PI/2*(1-i/12);return [3.8+2.3*Math.cos(a),14.1+2.3*Math.sin(a)];
  });
  const edge=[[-6.7,16.4],...corner,[6.1,-2.6]];
  const plan=[[-6.7,-2.6],...edge];
  const strip=(points,bottom,top,material,name,out=0)=>{
    const pos=[],uv=[],lengths=[0];
    for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],L=lengths[i]-lengths[i-1],n=[-(b[1]-a[1])/L,(b[0]-a[0])/L];
      const p=[a[0]+n[0]*out,bottom,a[1]+n[1]*out],q=[b[0]+n[0]*out,bottom,b[1]+n[1]*out];
      pos.push(...p,...q,p[0],top,p[2],...q,q[0],top,q[2],p[0],top,p[2]);
      const u0=lengths[i-1]/lengths.at(-1),u1=lengths[i]/lengths.at(-1);
      uv.push(u0,0,u1,0,u0,1,u1,0,u1,1,u0,1);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
    return add(g,material,name);
  };
  slab(plan,floor-.18,floor,C.deck,'hultquist-lower-deck');
  slab(plan,upper-.20,upper,C.deck,'hultquist-upper-deck');
  strip(edge,upper-.78,upper-.05,facadeMaterial(C.wall,'house','','siding'),'hultquist-veranda-fascia',.02);
  for(let i=1;i<edge.length;i++){
    const a=edge[i-1],b=edge[i];
    for(const y of [upper-.8,upper-.04])beam([a[0],y,a[1]],[b[0],y,b[1]],.12,C.trim,'hultquist-fascia-molding');
  }
  const rail=(a,b,y)=>{
    beam([a[0],y+.95,a[1]],[b[0],y+.95,b[1]],.10,C.trim,'hultquist-handrail');
    beam([a[0],y+.16,a[1]],[b[0],y+.16,b[1]],.085,C.trim,'hultquist-lower-rail');
    const count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.22);
    for(let j=1;j<count;j++){const t=j/count;block(.055,.74,.055,C.trim,a[0]+(b[0]-a[0])*t,y+.55,a[1]+(b[1]-a[1])*t,'hultquist-baluster',false);}
  };
  const front=Array.from({length:5},(_,i)=>[-6.5+i*10.3/4,16.23]);
  const side=Array.from({length:7},(_,i)=>[5.93,14.1-i*16.5/6]);
  const posts=[...front,...side];
  for(const [u,v] of posts){
    const bottom=Math.min(yAt(u,v)-.08,floor-.2);
    block(.34,floor-bottom,.34,C.trim,u,(floor+bottom)/2,v,'hultquist-footing');
    block(.23,upper-.8-floor,.23,C.trim,u,(floor+upper-.8)/2,v,'hultquist-lower-post');
    block(.32,.12,.32,C.accent,u,floor+.92,v,'hultquist-post-base-cap');
    block(.34,.12,.34,C.accent,u,upper-.84,v,'hultquist-lower-capital');
    block(.25,eave-upper,.25,C.trim,u,(upper+eave)/2,v,'hultquist-upper-post');
    block(.35,.13,.35,C.accent,u,5.48,v,'hultquist-arch-capital');
  }
  const arch=(a,b,rails=true)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),margin=.125,r=(L-2*margin)/2,spring=5.53;
    const shape=new THREE.Shape();shape.moveTo(margin,spring);
    shape.absellipse(L/2,spring,r,eave-spring-.12,Math.PI,0,true);
    shape.lineTo(L-margin,eave);shape.lineTo(margin,eave);shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false,curveSegments:20});g.translate(0,0,-.09);
    const m=add(g,C.wall,'hultquist-open-arch');m.position.set(a[0],0,a[1]);m.rotation.y=-Math.atan2(dz,dx);
    if(rails){rail(a,b,upper);rail(a,b,floor);}
    // Shallow radial trim follows the arch opening without filling its void.
    const pts=Array.from({length:25},(_,i)=>{const t=Math.PI*(1-i/24);return new THREE.Vector3(L/2+r*Math.cos(t),spring+(eave-spring-.12)*Math.sin(t),.11);});
    const rim=add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),32,.045,5,false),C.trim,'hultquist-arch-trim');
    rim.position.copy(m.position);rim.rotation.copy(m.rotation);
  };
  for(const row of [front,side])for(let i=1;i<row.length;i++)arch(row[i-1],row[i]);
  // The rounded corner remains an open entrance below the continuous gallery.
  for(let i=1;i<corner.length;i++)rail(corner[i-1],corner[i],upper);
  arch(front.at(-1),side[0],false);
  // One hip covers the room and both veranda faces; no second porch roof.
  const outer=[[-7.05,-2.95],[-7.05,16.75],...corner.map(([u,v])=>[u+.20,v+.20]),[6.45,-2.95]];
  const roofPos=[],ridgeA=[-.3,10.5,3.8],ridgeB=[-.3,10.5,10.0];
  for(let i=0;i<outer.length;i++){
    const a=outer[i],b=outer[(i+1)%outer.length],p=[a[0],eave+.10,a[1]],q=[b[0],eave+.10,b[1]];
    if(i===0)roofPos.push(...p,...q,...ridgeB,...p,...ridgeB,...ridgeA);
    else if(i===outer.length-2)roofPos.push(...p,...q,...ridgeA,...p,...ridgeA,...ridgeB);
    else roofPos.push(...p,...q,...(i===outer.length-1?ridgeA:ridgeB));
  }
  const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(roofPos,3));roof.computeVertexNormals();
  add(roof,surfaceMaterial('shingles',C.roof),'hultquist-main-hip');
  slab(outer,eave-.12,eave+.08,C.wall,'hultquist-soffit');
  for(let i=0;i<outer.length;i++){const a=outer[i],b=outer[(i+1)%outer.length];beam([a[0],eave,a[1]],[b[0],eave,b[1]],.18,C.trim,'hultquist-eave-trim');}
  for(const [u,v] of front)beam([u,eave-.17,13.7],[u,eave-.17,v],.11,C.trim,'hultquist-veranda-rafter',false);
  for(const [u,v] of side)beam([3.5,eave-.17,v],[u,eave-.17,v],.11,C.trim,'hultquist-veranda-rafter',false);
  // The name is painted on the fascia as it rounds the entry corner.
  const cv=document.createElement('canvas');cv.width=1024;cv.height=180;
  const ctx=cv.getContext('2d');ctx.fillStyle='#e1d3a6';ctx.fillRect(0,0,1024,180);
  ctx.strokeStyle='#85505c';ctx.lineWidth=10;ctx.strokeRect(5,5,1014,170);
  ctx.fillStyle='#294e46';ctx.textAlign='center';ctx.font='bold 78px Georgia';ctx.fillText('HULTQUIST',512,82);
  ctx.font='bold 68px Georgia';ctx.fillText('CENTER',512,151);
  const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  strip([[2.15,16.4],...corner,[6.1,13.45]],upper-.77,upper-.06,new THREE.MeshStandardMaterial({map:texture,roughness:.9,side:THREE.DoubleSide}),'hultquist-corner-sign',.105);
  const steps=[];
  // Broad curved treads only across the rounded entrance, with feet at grade.
  const toe=Math.max(...corner.map(([u,v])=>yAt(u+.8,v+.8))),rise=Math.max(.3,floor-toe),count=Math.max(2,Math.ceil(rise/.18));
  for(let i=count;i>=1;i--){
    const r=2.3+i*.29,pts=[[3.8,14.1],...Array.from({length:17},(_,j)=>{const a=Math.PI*j/32;return [3.8+r*Math.cos(a),14.1+r*Math.sin(a)];})];
    const top=floor-rise*i/count,bottom=Math.min(...pts.map(([u,v])=>yAt(u,v)))-.1;
    slab(pts,Math.min(bottom,top-.12),top,C.deck,'hultquist-entry-step');steps.push({top,radius:r});
  }
  for(const a of [0,Math.PI/2]){
    const p=[3.8+2.3*Math.cos(a),14.1+2.3*Math.sin(a)],q=[3.8+(2.3+count*.29)*Math.cos(a),14.1+(2.3+count*.29)*Math.sin(a)];
    beam([p[0],floor+.95,p[1]],[q[0],toe+.95,q[1]],.10,C.trim,'hultquist-entry-handrail');
    block(.18,1.03,.18,C.trim,q[0],toe+.515,q[1],'hultquist-entry-newel');
  }
  if(spec.bunting!==false){
    const bunting=(a,b)=>{
      const L=Math.hypot(b[0]-a[0],b[1]-a[1]),g=new THREE.Group();g.position.set((a[0]+b[0])/2,upper+.93,(a[1]+b[1])/2);g.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      for(const [lo,hi,color] of [[.0,.24,C.red],[.24,.46,C.trim],[.46,.66,C.blue],[.66,.86,C.trim],[.86,1,C.red]]){
        const geo=new THREE.RingGeometry(lo*L*.43,hi*L*.43,40,1,Math.PI,Math.PI);
        const pos=geo.attributes.position;for(let i=0;i<pos.count;i++){pos.setY(i,pos.getY(i)*.66);pos.setZ(i,.11+Math.sin(Math.atan2(pos.getY(i),pos.getX(i))*32)*.025);}
        geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,mat(color,{side:THREE.DoubleSide}));mesh.name='hultquist-bunting';mesh.castShadow=false;g.add(mesh);
      }
      root.add(g);
    };
    for(const row of [front,side])for(let i=1;i<row.length;i++)bunting(row[i-1],row[i]);
    bunting(corner[0],corner.at(-1));
    const flagCanvas=document.createElement('canvas');flagCanvas.width=380;flagCanvas.height=200;
    const fc=flagCanvas.getContext('2d');
    for(let i=0;i<13;i++){fc.fillStyle=i%2?'#f0e7ce':'#a4414a';fc.fillRect(0,i*200/13,380,200/13+1);}
    fc.fillStyle='#283f61';fc.fillRect(0,0,152,200*7/13);fc.fillStyle='#f0e7ce';
    for(let row=0;row<9;row++)for(let j=0;j<(row%2?5:6);j++){
      fc.beginPath();fc.arc(12.5+j*25+(row%2?12.5:0),10+row*11,2.5,0,Math.PI*2);fc.fill();
    }
    const flagTexture=new THREE.CanvasTexture(flagCanvas);flagTexture.colorSpace=THREE.SRGBColorSpace;
    const flagMaterial=new THREE.MeshStandardMaterial({map:flagTexture,side:THREE.DoubleSide,roughness:.9});
    for(const [p,n] of [[front[0],[0,1]],[front[2],[0,1]],[side[0],[1,0]],[side[3],[1,0]]]){
      const tip=[p[0]+n[0]*1.05,eave+.65,p[1]+n[1]*1.05];
      beam([p[0],eave-.45,p[1]],tip,.035,C.accent,'hultquist-flag-pole',false);
      const geo=new THREE.PlaneGeometry(1.1,.78,12,6),pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++)pos.setZ(i,.07*Math.sin(pos.getX(i)*8+pos.getY(i)*3));
      geo.computeVertexNormals();const flag=add(geo,flagMaterial,'hultquist-flag',false);
      flag.position.set(tip[0]+.37,tip[1]-.43,tip[2]);flag.rotation.y=n[0]?Math.PI/3:0;flag.castShadow=false;
    }
  }
  root.userData.hultquist={floor,upper,eave,front,side,corner,steps,source:'User-supplied Bestor Plaza corner Street View photograph, 2026-09-14'};
  return root;
}
