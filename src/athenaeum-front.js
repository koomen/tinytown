// Athenaeum's lake facade: tall decorated veranda columns and splayed stairs.
// Dimensions follow the supplied front photograph; ground heights are sampled
// from the scene so the stair feet and open veranda supports meet its terrain.
import * as THREE from 'three';
import {box,mat} from './kit.js';
import {frameGeometry,paneUV,surfaceMaterial} from './materials.js';

const UP=new THREE.Vector3(0,1,0);
const C={trim:0xeee4ce,accent:0xa67f6d,column:0xe2d0b9,floor:0xb9b6a6,roof:0x66666a,glass:0x496577};
export function buildAthenaeumFront(spec={},ground={}) {
  const root=new THREE.Group();root.name='athenaeum-front';
  const yAt=ground.heightAt||(()=>-.2),floorH=spec.floorH??1.4;
  const add=(geometry,material,name,coarse=true)=>{
    const mesh=new THREE.Mesh(geometry,typeof material==='number'?mat(material):material);
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
    if(coarse)mesh.userData.streamCoarse=true;root.add(mesh);return mesh;
  };
  const block=(w,h,d,color,u,y,v,name,coarse=true)=>{
    const mesh=box(w,h,d,color,u,y,v);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
    if(coarse)mesh.userData.streamCoarse=true;root.add(mesh);return mesh;
  };
  const beam=(a,b,w,color,name,coarse=true)=>{
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p);
    const mesh=add(new THREE.BoxGeometry(w,delta.length(),w),color,name,coarse);
    mesh.position.copy(p.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(UP,delta.normalize());return mesh;
  };
  const rail=(a,b,baseA,baseB,height=.91)=>{
    beam([a[0],baseA+height,a[1]],[b[0],baseB+height,b[1]],.105,C.trim,'athenaeum-handrail');
    beam([a[0],baseA+.13,a[1]],[b[0],baseB+.13,b[1]],.07,C.trim,'athenaeum-lower-rail');
    const n=Math.max(2,Math.round(Math.hypot(a[0]-b[0],a[1]-b[1])/.28));
    for(let i=1;i<n;i++){
      const t=i/n,x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t),base=THREE.MathUtils.lerp(baseA,baseB,t);
      block(.06,.61,.06,C.trim,x,base+.46,z,'athenaeum-baluster',false);
      const belly=add(new THREE.CylinderGeometry(.057,.057,.20,6),C.trim,'athenaeum-turned-baluster',false);belly.position.set(x,base+.46,z);
    }
  };
  const support=(u,v,width=.48)=>{
    const bottom=Math.min(yAt(u-width/2,v-width/2),yAt(u+width/2,v+width/2))-.06;
    const top=floorH-.13;
    if(top>bottom)block(width,top-bottom,width,C.trim,u,(top+bottom)/2,v,'athenaeum-veranda-footing');
  };
  const column=(u,v,eave)=>{
    support(u,v,.64);
    block(.65,.21,.65,C.trim,u,floorH+.105,v,'athenaeum-column-base');
    block(.48,.57,.48,C.column,u,floorH+.48,v,'athenaeum-column-plinth');
    block(.58,.11,.58,C.trim,u,floorH+.82,v,'athenaeum-column-base-cap');
    const low=floorH+.88,top=eave-.66;
    // Four-sided tapered shaft retains the square timber form in the photo.
    const shaft=add(new THREE.CylinderGeometry(.21*Math.SQRT2,.235*Math.SQRT2,top-low,4),C.column,'athenaeum-column-shaft');
    shaft.rotation.y=Math.PI/4;shaft.position.set(u,(low+top)/2,v);
    block(.52,.16,.52,C.trim,u,top+.08,v,'athenaeum-column-capital-neck');
    block(.64,.22,.64,C.trim,u,top+.25,v,'athenaeum-column-capital');
    block(.75,.10,.72,C.accent,u,eave-.15,v,'athenaeum-capital-abacus');
    // Broad curved brackets beneath the horizontal entablature, rather than
    // leaving a hair-thin undecorated post against the long roof.
    for(const sign of [-1,1]){
      const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(sign*1.0,0);shape.lineTo(sign*1.0,-.16);
      shape.bezierCurveTo(sign*.64,-.16,sign*.58,-.38,sign*.50,-.64);
      shape.lineTo(sign*.28,-.70);shape.lineTo(0,-.18);shape.closePath();
      const g=new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:false});
      const m=add(g,C.trim,'athenaeum-column-bracket');m.position.set(u,eave-.06,v-.07);
      const boss=add(new THREE.TorusGeometry(.105,.032,5,16),C.accent,'athenaeum-bracket-rosette',false);boss.position.set(u+sign*.43,eave-.26,v+.085);
    }
  };
  const veranda=(u0,u1,wall,posts,main=false)=>{
    const front=wall+3.3,eave=floorH+10.3,w=u1-u0,mid=(u0+u1)/2;
    block(w,.22,3.35,C.floor,mid,floorH-.11,wall+1.65,'athenaeum-veranda-deck');
    const roofMat=surfaceMaterial('shingles',C.roof);
    const roof=add(new THREE.BoxGeometry(w+.6,.12,3.65),roofMat,'athenaeum-veranda-roof');
    roof.position.set(mid,eave+.21,wall+1.64);roof.rotation.x=.065;
    block(w+.58,.27,.25,C.trim,mid,eave+.025,front+.09,'athenaeum-entablature');
    block(w+.69,.09,.34,C.accent,mid,eave+.19,front+.09,'athenaeum-entablature-cap');
    const xs=Array.from({length:posts},(_,i)=>u0+.23+i*(w-.46)/(posts-1));
    xs.forEach(x=>column(x,front-.15,eave));
    for(let i=1;i<xs.length;i++){
      const a=xs[i-1]+.34,b=xs[i]-.34;
      if(main&&a<1&&b>1){rail([a,front-.15],[-.6,front-.15],floorH,floorH);rail([2.6,front-.15],[b,front-.15],floorH,floorH);}
      else rail([a,front-.15],[b,front-.15],floorH,floorH);
      // Lattice below the open floor; vertical support posts carry the deck
      // down to the varying ground instead of a hanging solid foundation box.
      const low=Math.min(yAt(a,front),yAt(b,front))+.12,high=floorH-.25;
      if(high>low+.3){
        beam([a,high,front],[b,high,front],.12,C.trim,'athenaeum-lattice-rail');
        beam([a,low,front],[b,low,front],.12,C.trim,'athenaeum-lattice-rail');
        const n=Math.max(1,Math.round((b-a)/.65)),h=Math.min(high-low,.82);
        for(let k=0;k<n;k++){
          const x0=a+(b-a)*k/n,x1=a+(b-a)*(k+1)/n;
          for(let y=low;y<high-.1;y+=h){const yt=Math.min(high,y+h);
            beam([x0,y,front],[x1,yt,front],.05,C.trim,'athenaeum-lattice',false);
            beam([x0,yt,front],[x1,y,front],.05,C.trim,'athenaeum-lattice',false);
          }
        }
      }
    }
    // Upper galleries on the flanking wings frame the uninterrupted tall
    // central porch. Their rail is visible across the second-floor windows.
    if(!main){
      const y=6.02;block(w,.18,3.3,C.floor,mid,y-.09,wall+1.65,'athenaeum-upper-gallery');
      rail([u0+.22,front-.12],[u1-.22,front-.12],y,y,.8);
    }
  };
  veranda(-18,20,25.7,8,true);
  veranda(-28,-18,24.5,4);
  veranda(20,32.1,19.3,4);

  // Retain the existing door leaf and its frontage definition. The tall
  // grouped glazing sits wholly above its head and uses actual arched pieces.
  const entranceU=1,wall=25.7;
  const arch=(cx,bottom,w,h,name,glass=true)=>{
    const r=w/2,spring=bottom+h-r,pts=[[-r,bottom],[r,bottom]];
    for(let i=0;i<=24;i++){const a=i*Math.PI/24;pts.push([Math.cos(a)*r,spring+Math.sin(a)*r]);}
    const outer=pts.map(([x,y])=>[x*(w+.17)/w,y<spring?y+(y===bottom?-.09:0):spring+(y-spring)*(r+.09)/r]);
    const frame=add(frameGeometry(outer,pts),C.trim,name+'-frame');frame.position.set(cx,0,wall+.34);
    if(glass){const g=new THREE.ShapeGeometry(new THREE.Shape(pts.map(p=>new THREE.Vector2(...p))));paneUV(g);const pane=add(g,surfaceMaterial('shop',C.glass),name+'-glass');pane.position.set(cx,0,wall+.27);pane.material.side=THREE.DoubleSide;}
  };
  arch(entranceU,4.15,3.22,6.17,'athenaeum-entry-outer');
  arch(entranceU-.65,4.26,1.11,4.86,'athenaeum-entry-paired',false);
  arch(entranceU+.65,4.26,1.11,4.86,'athenaeum-entry-paired',false);
  for(const [dx,r,y] of [[0,.50,9.65],[-1.03,.27,9.35],[1.03,.27,9.35]]){
    const ring=add(new THREE.TorusGeometry(r,.075,6,32),C.trim,'athenaeum-entry-roundel');ring.position.set(entranceU+dx,y,wall+.41);
  }
  for(const dx of [-1.54,0,1.54])block(.11,4.58,.10,C.trim,entranceU+dx,6.54,wall+.39,'athenaeum-entry-mullion');
  block(3.40,.16,.20,C.trim,entranceU,4.14,wall+.35,'athenaeum-entry-transom-sill');
  for(const dx of [-1.72,1.72]){
    block(.18,7.3,.22,C.trim,entranceU+dx,5.05,wall+.32,'athenaeum-entry-jamb');
    block(.32,.32,.30,C.accent,entranceU+dx,1.57,wall+.16,'athenaeum-entry-jamb-base');
  }

  // A central flight leads from the veranda to a shared landing. Two curved
  // lower flights leave its sides and frame the fountain on the entrance axis.
  // All treads share their edge vertices with their neighbours; each solid
  // foundation continues below the sampled terrain, including the landings.
  const landingBack=31.7,landingFront=33.5,halfLanding=2.4,stairWidth=1.8;
  const toeV=37,feet=[entranceU-6,entranceU+6];
  const toeGrade=Math.max(...feet.map(u=>yAt(u,toeV)));
  const centralDrop=Math.max(.54,(floorH-toeGrade-.2)*.34);
  const middleH=floorH-centralDrop,reports=[];
  const solid=(corners,top,name)=>{
    const shape=new THREE.Shape(corners.map(([u,v])=>new THREE.Vector2(u,-v)));
    const geo=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const u=pos.getX(i),v=pos.getZ(i);
      pos.setY(i,pos.getY(i)<.1?Math.min(yAt(u,v)-.08,top-.16):top);
    }
    geo.computeVertexNormals();return add(geo,C.floor,name);
  };
  const newel=(p,y)=>{
    block(.20,1.08,.20,C.trim,p[0],y+.54,p[1],'athenaeum-stair-newel');
    block(.30,.13,.30,C.trim,p[0],y+1.14,p[1],'athenaeum-newel-cap');
  };
  const halfEntry=1.6,startV=29,centralSteps=Math.ceil(centralDrop/.18);
  for(let i=0;i<centralSteps;i++){
    const a=startV+(landingBack-startV)*i/centralSteps,b=startV+(landingBack-startV)*(i+1)/centralSteps;
    solid([[entranceU-halfEntry,a],[entranceU+halfEntry,a],[entranceU+halfEntry,b],[entranceU-halfEntry,b]],floorH-centralDrop*(i+1)/centralSteps,'athenaeum-stair-tread');
  }
  solid([[entranceU-halfLanding,landingBack],[entranceU+halfLanding,landingBack],[entranceU+halfLanding,landingFront],[entranceU-halfLanding,landingFront]],middleH,'athenaeum-stair-shared-landing');
  for(const side of [-1,1]){
    const a=[entranceU+side*halfEntry,startV],b=[a[0],landingBack];
    rail(a,b,floorH,middleH);newel(a,floorH);
    rail(b,[entranceU+side*halfLanding,landingBack],middleH,middleH);
  }
  rail([entranceU-halfLanding,landingFront],[entranceU+halfLanding,landingFront],middleH,middleH);
  reports.push({kind:'central',start:[entranceU,startV],end:[entranceU,landingBack],steps:centralSteps,top:floorH,toe:middleH,width:halfEntry*2});
  for(const side of [-1,1]){
    const curve=new THREE.CubicBezierCurve3(
      new THREE.Vector3(entranceU+side*halfLanding,0,32.6),
      new THREE.Vector3(entranceU+side*4.5,0,32.6),
      new THREE.Vector3(entranceU+side*6,0,34.8),
      new THREE.Vector3(entranceU+side*6,0,toeV));
    const toeU=entranceU+side*6;
    const footCorners=[[toeU-stairWidth/2,toeV],[toeU+stairWidth/2,toeV],[toeU+stairWidth/2,toeV+.85],[toeU-stairWidth/2,toeV+.85]];
    const toe=Math.max(...footCorners.map(p=>yAt(...p)))+.20;
    const drop=middleH-toe,steps=Math.max(3,Math.ceil(drop/.18));
    const stations=Array.from({length:steps+1},(_,i)=>{
      const t=i/steps,p=curve.getPointAt(t),d=curve.getTangentAt(t),n=new THREE.Vector3(-d.z,0,d.x).multiplyScalar(stairWidth/2);
      return {left:[p.x+n.x,p.z+n.z],right:[p.x-n.x,p.z-n.z],y:middleH-drop*t,center:[p.x,p.z]};
    });
    for(let i=0;i<steps;i++){
      const a=stations[i],b=stations[i+1];
      solid([a.left,a.right,b.right,b.left],b.y,'athenaeum-stair-tread');
      rail(a.left,b.left,a.y,b.y);rail(a.right,b.right,a.y,b.y);
    }
    solid(footCorners,toe,'athenaeum-stair-foot');
    for(const edge of ['left','right']){
      const a=stations[0][edge],b=stations[steps][edge],end=[b[0],toeV+.85];
      newel(a,middleH);rail(b,end,toe,toe);newel(end,toe);
    }
    reports.push({kind:'curved',side,start:stations[0].center,end:[toeU,toeV+.85],steps,top:middleH,toe,width:stairWidth,stations});
  }
  if(spec.fountain){
    const {u=entranceU,v=35.25,radius:r=1.15}=spec.fountain;
    const samples=Array.from({length:32},(_,i)=>yAt(u+(r+.2)*Math.cos(i*Math.PI/16),v+(r+.2)*Math.sin(i*Math.PI/16)));
    const low=Math.min(...samples)-.08,lip=Math.max(...samples)+.45;
    const basin=add(new THREE.CylinderGeometry(r+.12,r+.20,lip-low,48),0xc4c0ad,'athenaeum-forecourt-basin');basin.position.set(u,(low+lip)/2,v);
    const water=add(new THREE.CircleGeometry(r,48),surfaceMaterial('water',0x54a9af),'athenaeum-forecourt-water');water.rotation.x=-Math.PI/2;water.position.set(u,lip+.006,v);water.castShadow=false;
    const rim=add(new THREE.TorusGeometry(r+.07,.10,8,48),0xe2ddca,'athenaeum-forecourt-rim');rim.rotation.x=Math.PI/2;rim.position.set(u,lip+.065,v);
    // Dark tiered metal fountain, as in the supplied lakefront photographs.
    const metal=0x343e39;
    for(const [rt,rb,h,y,name] of [[.26,.34,.15,.08,'base'],[.075,.16,.77,.48,'stem'],[.40,.12,.13,.83,'lower-bowl'],[.055,.085,.46,1.12,'upper-stem'],[.25,.08,.10,1.34,'upper-bowl'],[.025,.055,.25,1.50,'finial']]){
      const part=add(new THREE.CylinderGeometry(rt,rb,h,24),metal,'athenaeum-fountain-'+name);part.position.set(u,lip+y,v);
    }
  }
  root.userData.athenaeumFront={stairs:reports,landing:{u:entranceU,back:landingBack,front:landingFront,width:halfLanding*2,y:middleH},fountain:spec.fountain,columnWidth:.47,columnCount:16,floorH,source:'User-supplied front and oblique lakefront photographs, 2026-09-14'};
  return root;
}
