// Roofed auditorium with clipped audience corners and a genuinely sunken bowl.
import * as THREE from 'three';
import { box, mat } from './kit.js';
import { buildBackstage } from './amphitheater-backstage.js';
import { amphitheaterLayout } from './amphitheater-layout.js';
import { surfaceMaterial } from './materials.js';
import { pavementGeometry } from './pavement.js';

function mesh(positions, indices, color, name) {
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);
  const flat=geo.toNonIndexed();geo.dispose();flat.computeVertexNormals();
  const material=mat(color).clone();material.side=THREE.DoubleSide;
  const object=new THREE.Mesh(flat,material);object.name=name;return object;
}
function slab(pts, bottom, top, color, name) {
  const shape=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geo=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false});
  geo.rotateX(-Math.PI/2);geo.translate(0,bottom,0);
  const object=new THREE.Mesh(geo,mat(color));object.name=name;return object;
}
function beam(a,b,w,h,color,name,heightAt=null) {
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const length=Math.hypot(dx,dz),y=heightAt?heightAt(.5):a[2];
  const object=box(length,h,w,color,(a[0]+b[0])/2,y,(a[1]+b[1])/2);
  if(heightAt) {
    const geo=new THREE.BoxGeometry(length,h,w,Math.max(1,Math.ceil(length)),1,1),pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setY(i,pos.getY(i)+heightAt(pos.getX(i)/length+.5)-y);
    geo.computeVertexNormals();object.geometry=geo;
  }
  object.rotation.y=-Math.atan2(dz,dx);object.name=name;return object;
}

function perimeter(group,layout,groundAt,trim) {
  const {canopyEdge,seatingOutline}=layout,walk=.2,wallHeight=.64,height=1.22;
  const brick=surfaceMaterial('brick',0x895944),red='#8c3932',paving='#b7b09a';
  // Densely drape the concourse, including the wider stage-wing returns.
  // A few large triangles can cut through the curved hillside between their
  // endpoints even when every corner clears the terrain.
  const concourse=new THREE.Mesh(pavementGeometry([[...canopyEdge,...[...seatingOutline].reverse()]],
    (x,z)=>groundAt(x,z)+walk,()=>new THREE.Color(paving),.5),mat(paving));
  concourse.name='amphitheater-concourse';group.add(concourse);
  for(let edge=0;edge<canopyEdge.length-1;edge++) {
    const a=canopyEdge[edge],b=canopyEdge[edge+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const point=t=>[a[0]+t*dx,a[1]+t*dz];
    // Openings in the three long sides lead straight onto the concourse.
    const gate=length>25?1.15/length:0;
    const intervals=gate?[[0,.5-gate],[.5+gate,1]]:[[0,1]];
    for(const [lo,hi] of intervals) {
      const p=point(lo),q=point(hi),at=t=>groundAt(...point(lo+(hi-lo)*t))+walk;
      const wall=beam([...p,0],[...q,0],.36,wallHeight+.16,'#895944','amphitheater-perimeter-brick',t=>at(t)+(wallHeight-.16)/2);
      wall.material=brick;group.add(wall);
      group.add(beam([...p,0],[...q,0],.43,.08,trim,'amphitheater-perimeter-cap',t=>at(t)+wallHeight));
      for(const y of [wallHeight+.1,height-.035])
        group.add(beam([...p,0],[...q,0],.065,.07,red,'amphitheater-perimeter-rail',t=>at(t)+y));
      const posts=Math.max(1,Math.ceil(length*(hi-lo)/.23));
      for(let i=0;i<=posts;i++) {
        const t=lo+(hi-lo)*i/posts,[x,z]=point(t);
        const picket=box(.035,height-wallHeight-.08,.035,red,x,groundAt(x,z)+walk+(height+wallHeight)/2,z);
        picket.name='amphitheater-perimeter-picket';group.add(picket);
      }
      const piers=Math.max(1,Math.ceil(length*(hi-lo)/4));
      for(let i=0;i<=piers;i++) {
        const [x,z]=point(lo+(hi-lo)*i/piers),y=groundAt(x,z)+walk;
        const pier=box(.5,height+.16,.5,'#895944',x,y+(height-.16)/2,z);
        pier.material=brick;pier.name='amphitheater-perimeter-pier';group.add(pier);
        const cap=box(.58,.1,.58,trim,x,y+height,z);cap.name='amphitheater-perimeter-pier-cap';group.add(cap);
      }
    }
  }
}
function roofRidge(outline) {
  const lo=Math.min(...outline.map(p=>p[0])),hi=Math.max(...outline.map(p=>p[0]));
  const half=Math.max(...outline.map(p=>Math.abs(p[1]))),run=Math.min(half*.72,(hi-lo)*.35);
  return [lo+run,hi-run];
}
function roof(outline,eave,rise,color,name='amphitheater-roof') {
  const [ridgeMin,ridgeMax]=roofRidge(outline);
  const top=outline.map(([x,z])=>[Math.max(ridgeMin,Math.min(ridgeMax,x)),z<0?-.18:.18]);
  const positions=[...outline.map(([x,z])=>[x,eave,z]),...top.map(([x,z])=>[x,eave+rise,z])].flat();
  const n=outline.length,indices=[];
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,n+i,j,j,n+i,n+j);}
  for(let i=1;i<n-1;i++)indices.push(n,n+i,n+i+1);
  return mesh(positions,indices,color,name);
}

function nightMaterial(color,emissive,night,role) {
  const material=mat(color,{emissive,emissiveIntensity:night});
  material.userData.nightEmission={day:0,night};
  material.userData.amphitheaterLighting=role;
  return material;
}

function fixtures(positions,geometry,material,name) {
  const object=new THREE.InstancedMesh(geometry,material,positions.length),matrix=new THREE.Matrix4();
  positions.forEach((p,i)=>object.setMatrixAt(i,matrix.makeTranslation(...p)));
  object.instanceMatrix.needsUpdate=true;
  object.name=name;object.userData.keep=true;object.userData.castShadow=false;
  return object;
}

function stringLights(group,outline,height,spacing,bulbMaterial,name) {
  const bulbs=[],sockets=[],segments=[];
  for(let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const count=Math.max(1,Math.round(length/spacing));
    const cable=beam([...a,height],[...b,height],.027,.027,'#4b5147','amphitheater-string-cable');
    group.add(cable);segments.push({length,bulbs:count,spacing:length/count});
    for(let j=0;j<count;j++) {
      const t=j/count,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      sockets.push([x,height-.045,z]);bulbs.push([x,height-.14,z]);
    }
  }
  const lights=fixtures(bulbs,new THREE.SphereGeometry(.085,8,6),bulbMaterial,name);
  lights.userData.stringLightSegments=segments;
  group.add(lights,fixtures(sockets,new THREE.CylinderGeometry(.04,.04,.10,6),mat('#515247'),'amphitheater-string-sockets'));
}

export function buildAmphitheater(obb,spec={},ground=null) {
  const root=new THREE.Group(),g=new THREE.Group();root.add(g);
  const L=amphitheaterLayout(obb,spec),{length,span,depth,rear,front,start,half,outline,roofOutline,canopyEdge}=L;
  const groundAt=ground?.sample??(()=>0);
  const eave=spec.height??6.5,rise=spec.roofRise??5;
  const wall=spec.wallColor??'#d9d0aa',trim=spec.trimColor??'#eee5ce';
  const roofColor=spec.roofColor??'#b8c0bd',seat=spec.seatColor??'#d8d2b7';
  const add=(o,name)=>{if(name)o.name=name;g.add(o);return o;};
  const floor=-depth,rows=spec.rows??18;
  add(slab(outline,floor-.55,floor-.28,'#b7b09a','amphitheater-floor'));
  perimeter(g,L,groundAt,trim);
  const stageX=start+length*.07,stageW=span*.4,stageD=length*.135;
  add(box(stageD,.65,stageW,'#bca782',stageX,floor+.325,0),'amphitheater-stage');
  // Three-sided, faceted horseshoe contours follow the chamfered outside walls.
  // Inner seats begin beside the stage; each outward row rises toward ground.
  const outer=L.seatingOutline;
  const inner=[[start+2,-stageW*.62],[stageX+6,-stageW*.62],[stageX+14,-stageW*.3],
    [stageX+14,stageW*.3],[stageX+6,stageW*.62],[start+2,stageW*.62]];
  const contour=t=>inner.map((p,i)=>[p[0]+(outer[i][0]-p[0])*t,p[1]+(outer[i][1]-p[1])*t]);
  for(let row=0;row<rows;row++) {
    const t0=row/rows,t1=(row+1)/rows,a=contour(t0),b=contour(t1);
    for(let side=0;side<5;side++) {
      const j=side+1;
      const along=(points,f)=>[points[side][0]+(points[j][0]-points[side][0])*f,points[side][1]+(points[j][1]-points[side][1])*f];
      const elevation=(t,f)=>floor+.25+t*(depth-.05+groundAt(...along(outer,f)));
      const count=Math.max(1,Math.ceil(Math.hypot(outer[j][0]-outer[side][0],outer[j][1]-outer[side][1])));
      const tiers=[],risers=[],indices=[];
      for(let i=0;i<count;i++) {
        const f0=i/count,f1=(i+1)/count,pa=along(a,f0),qa=along(a,f1),pb=along(b,f0),qb=along(b,f1),k=i*4;
        for(const [p,f] of [[pa,f0],[qa,f1],[qb,f1],[pb,f0]])tiers.push(p[0],elevation(t1,f),p[1]);
        for(const [p,t,f] of [[pa,t0,f0],[qa,t0,f1],[qa,t1,f1],[pa,t1,f0]])risers.push(p[0],elevation(t,f),p[1]);
        indices.push(k,k+1,k+2,k,k+2,k+3);
      }
      add(mesh(tiers,indices,'#c6c0aa','amphitheater-tier'));
      add(mesh(risers,indices,wall,'amphitheater-riser'));
      // Split each bank with a radial aisle; keep the steps visible between it.
      const mid=contour((t0+t1)/2),p=mid[side],q=mid[j];
      for(const [f0,f1] of [[.035,.455],[.545,.965]]) {
        const at=f=>[p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f,elevation(t1,f)+.45];
        add(beam(at(f0),at(f1),.52,.13,seat,'amphitheater-bench',t=>elevation(t1,f0+(f1-f0)*t)+.45));
        const a0=at(f0),a1=at(f1),dx=a1[0]-a0[0],dz=a1[1]-a0[1],len=Math.hypot(dx,dz);
        const nx=dz/len*.2,nz=-dx/len*.2;
        add(beam([a0[0]+nx,a0[1]+nz,0],[a1[0]+nx,a1[1]+nz,0],.1,.52,seat,'amphitheater-seat-back',t=>elevation(t1,f0+(f1-f0)*t)+.73));
      }
    }
  }
  // Rear choir balcony, stage wall and an abstract organ screen behind it.
  const houseWidth=span*.62,houseEnd=start-1;
  const backstage=buildBackstage(L,spec,groundAt);g.add(backstage.root);
  add(box(5,.4,houseWidth*.86,trim,start+1,floor+3.4,0),'amphitheater-choir-balcony');
  for(let r=0;r<3;r++)add(box(.5,.15,houseWidth*.8,seat,start-r*1.15,floor+3.8+r*.3,0),'amphitheater-choir-bench');
  for(let i=0;i<13;i++) {
    const h=2.1+1.1*(1-Math.abs(i-6)/6);
    add(box(.35,h,.32,'#c0b084',houseEnd+.25,floor+4+h/2,(i-6)*.72),'amphitheater-organ');
  }
  // Posts and fascia follow both sets of clipped corners. The short rear
  // returns stop at the stage-house roof instead of crossing the interior.
  const houseHalf=houseWidth/2+1;
  for(let i=0;i<canopyEdge.length-1;i++) {
    const a=canopyEdge[i],b=canopyEdge[i+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6));
    for(let j=0;j<n;j++) {
      const t=j/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      const bottom=groundAt(x,z);
      add(box(.34,eave-bottom,.34,trim,x,(eave+bottom)/2,z),'amphitheater-post');
    }
    add(beam([...a,eave-.12],[...b,eave-.12],.35,.3,trim,'amphitheater-fascia'));
  }
  const canopy=add(roof(roofOutline,eave,rise,roofColor));
  if(spec.monitor!==false) {
    // Include the cap's end overhangs in the ridge length so neither end
    // extends above the sloping hips, where the monitor would float.
    const [ridgeMin,ridgeMax]=roofRidge(roofOutline),overhang=.4;
    const cx=(ridgeMin+ridgeMax)/2,ml=ridgeMax-ridgeMin-2*overhang;
    add(box(ml,1.1,2.4,trim,cx,eave+rise+.45,0),'amphitheater-monitor');
    const monitor=[[ridgeMin,-1.6],[ridgeMax,-1.6],[ridgeMax,1.6],[ridgeMin,1.6]];
    add(roof(monitor,eave+rise+1,.55,roofColor,'amphitheater-monitor-roof'));
    for(const side of [-1,1])for(let i=0;i<9;i++)
      add(box(ml/12,.5,.05,'#59625b',cx+(-.44+i*.88/8)*ml,eave+rise+.5,side*1.22),'amphitheater-monitor-louver');
  }
  const bulbMaterial=nightMaterial('#fff0cf','#ffdc9d',7.5,'bulb');
  if(spec.stringLightSpacing) {
    // Trace the exposed roof union, including the rear wing cuts and stage
    // house, without laying a string across the covered stage-house join.
    const perimeter=[[rear,-houseHalf],...canopyEdge,[rear,houseHalf]];
    stringLights(g,perimeter,eave-.32,spec.stringLightSpacing,bulbMaterial,'amphitheater-string-bulbs');
    // The downhill entrance has its own narrow canopy and string lights.
    stringLights(g,backstage.porchLights.outline,backstage.porchLights.height,spec.stringLightSpacing,bulbMaterial,'amphitheater-porch-string-bulbs');
  }
  if(spec.interiorLighting) {
    // Baked warm bounce on the actual seating surfaces: horizontal benches,
    // upright backs and risers have different levels, preserving depth and
    // readable rows without adding hundreds of GPU lights. These ordinary
    // materials and their day/night profiles survive both bake and streaming.
    const roles={
      'amphitheater-bench':[seat,.60], 'amphitheater-seat-back':[seat,.36],
      'amphitheater-choir-bench':[seat,.60], 'amphitheater-tier':['#c6c0aa',.24],
      'amphitheater-riser':[wall,.12], 'amphitheater-floor':['#b7b09a',.14],
      'amphitheater-stage':['#bca782',.35], 'amphitheater-choir-balcony':[trim,.23],
      'amphitheater-organ':['#c0b084',.20],
    };
    const materials=new Map();
    g.traverse(o=>{
      const role=roles[o.name];if(!role)return;
      const key=`${role[0]}:${role[1]}:${o.material.side}`;
      if(!materials.has(key)) {
        const material=nightMaterial(role[0],'#eac992',role[1],'interior');
        material.side=o.material.side;materials.set(key,material);
      }
      o.material=materials.get(key);
    });
    // Warm soffit below the silver roof, sharing geometry; its back-facing
    // material cannot wash the exterior roof orange at night.
    canopy.material.side=THREE.FrontSide;
    const soffitMaterial=nightMaterial(trim,'#eac992',.13,'interior');
    soffitMaterial.side=THREE.BackSide;
    add(new THREE.Mesh(canopy.geometry,soffitMaterial),'amphitheater-soffit');
    const downlights=[];
    for(let i=0;i<5;i++)for(const z of [-half*.62,0,half*.62])
      downlights.push([start+10+i*(front-start-20)/4,eave-.38,z]);
    add(fixtures(downlights,new THREE.CylinderGeometry(.16,.18,.09,10),bulbMaterial,'amphitheater-downlights'));
  }
  if(spec.stageEnd==='positive')g.rotation.y=Math.PI;
  if(spec.axis==='v')root.rotation.y=-Math.PI/2;
  // These structural surfaces use plain materials. Explicitly retain them in
  // distant scenery, where the generic exporter otherwise keeps only brick.
  const structure=new Set(['amphitheater-roof','amphitheater-backstage',
    'amphitheater-backstage-roof','amphitheater-post','amphitheater-fascia',
    'amphitheater-monitor','amphitheater-monitor-roof','amphitheater-back-porch',
    'amphitheater-porch-canopy','amphitheater-porch-post','amphitheater-concourse',
    'amphitheater-perimeter-cap','amphitheater-perimeter-pier-cap',
    'amphitheater-floor','amphitheater-tier','amphitheater-riser',
    'amphitheater-stage','amphitheater-soffit']);
  root.traverse(o=>{if(o.isMesh){
    o.castShadow=o.userData.castShadow!==false;o.receiveShadow=true;
    if(structure.has(o.name))o.userData.streamCoarse=true;
  }});
  return root;
}
