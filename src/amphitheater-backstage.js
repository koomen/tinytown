// Susan Hirt Hagen Center: recessed upper veranda, flared central gable,
// middle-storey windows and a separate downhill entrance/loading level.
import * as THREE from 'three';
import {box,mat} from './kit.js';
import {surfaceMaterial} from './materials.js';

let nameplateMaterial;
function nameplate() {
  if(nameplateMaterial)return nameplateMaterial;
  const c=document.createElement('canvas');c.width=1536;c.height=256;
  const ctx=c.getContext('2d');ctx.fillStyle='#eee5cd';ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='#59614d';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold 100px Georgia, serif';ctx.fillText('Susan Hirt Hagen Center',768,94,1440);
  ctx.font='bold 57px Georgia, serif';ctx.fillText('at the Chautauqua Amphitheater',768,188,1400);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  nameplateMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.9});
  nameplateMaterial.name='hagen-center-nameplate';return nameplateMaterial;
}

export function buildBackstage(layout,spec,groundAt) {
  const {rear,start,span,depth}=layout,root=new THREE.Group();root.name='amphitheater-hagen-center';
  const eave=spec.height??6.5,rise=spec.roofRise??5,wall=spec.wallColor??'#d9d0aa',trim=spec.trimColor??'#eee5ce';
  const roofColor=spec.roofColor??'#b8c0bd',width=span*.62,half=width/2;
  const porchDepth=spec.porchDepth??3.4,front=rear+.18,recess=front+porchDepth*.25,end=start-1;
  const deck=eave-4.25,porchHalf=width*.205,balconyHalf=width*.285;
  const bottom=Math.min(-depth-.35,...[-half,0,half].map(z=>groundAt(front,z)-.35));
  const siding=surfaceMaterial('shingles',wall),gable=surfaceMaterial('shingles','#626d68');
  const add=(o,name,coarse=true)=>{o.name=name;if(coarse)o.userData.streamCoarse=true;root.add(o);return o;};
  const block=(w,h,d,color,x,y,z,name,coarse=true)=>add(box(w,h,d,color,x,y,z),name,coarse);
  const beam=(a,b,w,d,color,name,coarse=true)=>{
    const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);
    const o=block(w,v.length(),d,color,...p.clone().add(q).multiplyScalar(.5).toArray(),name,coarse);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;
  };
  const triangles=(positions,material,name,coarse=true)=>{
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
    const m=material.clone();m.side=THREE.DoubleSide;return add(new THREE.Mesh(geo,m),name,coarse);
  };
  const clad=(x0,x1,y0,y1,z0,z1,name)=>{
    const o=block(x1-x0,y1-y0,z1-z0,wall,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,name);o.material=siding;return o;
  };
  const window=(x,z,y,w,h,rotation=0,door=false)=>{
    const g=new THREE.Group(),t=.12;
    g.add(box(.10,h,w,'#49666b',-.04,0,0));
    for(const zz of [-w/2-t/2,w/2+t/2])g.add(box(.16,h+2*t,t,trim,-.08,0,zz));
    for(const yy of [-h/2-t/2,h/2+t/2])g.add(box(.16,t,w,trim,-.08,yy,0));
    g.add(box(.18,h,.055,trim,-.10,0,0),box(.18,.055,w,trim,-.10,door?h*.22:0,0));
    if(door)for(const zz of [-.15,.15])g.add(box(.22,.24,.045,'#b7ab79',-.18,-.28,zz));
    g.position.set(x,y,z);g.rotation.y=rotation;add(g,door?'amphitheater-porch-door':'amphitheater-backstage-window',false);return g;
  };
  const rail=(a,b,y)=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(const dy of [.15,1.02])beam([a[0],y+dy,a[1]],[b[0],y+dy,b[1]],.085,.085,trim,'amphitheater-porch-rail');
    const n=Math.ceil(length/.24);
    for(let i=0;i<=n;i++){const t=i/n;block(.046,.83,.046,trim,a[0]+(b[0]-a[0])*t,y+.59,a[1]+(b[1]-a[1])*t,'amphitheater-porch-baluster',false);}
  };

  // The upper room is genuinely recessed. Only the two wings reach the
  // front wall; no opaque wall runs through the balcony's open space.
  clad(recess,end,bottom,eave,-half,half,'amphitheater-backstage');
  clad(front,recess,bottom,deck-.15,-half,half,'amphitheater-lower-storeys');
  for(const sign of [-1,1]){
    const bounds=sign<0?[-half,-porchHalf]:[porchHalf,half];
    clad(front,recess,deck-.15,eave,...bounds,'amphitheater-upper-wing');
    block(.20,eave-bottom,.20,trim,front-.04,(eave+bottom)/2,sign*(half-.08),'amphitheater-stage-house-corner');
    for(const z of [width*.36,width*.45])window(front-.13,sign*z,(deck+eave)/2,1.55,2.5);
    for(const y of [deck-1.65,deck+2.0])for(let i=0;i<4;i++)
      window(recess+1.7+i*(end-recess-3.4)/3,sign*(half+.1),y,1.45,y<deck?1.35:2.35,sign*Math.PI/2);
  }
  for(let i=0;i<8;i++)window(front-.13,-width*.435+i*width*.87/7,deck-1.68,1.5,1.38);
  for(const y of [deck-.18,deck-3.50])block(.18,.18,width,trim,front-.14,y,0,'amphitheater-storey-band');

  // Most of the veranda projects beyond the wall below. Its canopy extends
  // farther still, with a bowed front edge beneath the clerestory windows.
  const balconyFront=front-porchDepth*.75;
  const roofFront=z=>balconyFront-.4-.3*(1-(z/porchHalf)**2);
  block(recess-balconyFront,.25,balconyHalf*2,trim,(recess+balconyFront)/2,deck-.125,0,'amphitheater-back-porch');
  rail([balconyFront,-balconyHalf],[balconyFront,balconyHalf],deck);
  for(const sign of [-1,1])rail([balconyFront,sign*balconyHalf],[front+.02,sign*balconyHalf],deck);
  const ceiling=z=>eave-.32+.50*(1-(z/porchHalf)**2);
  const canopyPositions=[];
  for(let i=0;i<4;i++){
    const z0=-porchHalf+i*porchHalf/2,z1=z0+porchHalf/2,y0=ceiling(z0),y1=ceiling(z1);
    const x0=roofFront(z0),x1=roofFront(z1);
    canopyPositions.push(x0,y0,z0,x1,y1,z1,recess+.12,y1+.12,z1,x0,y0,z0,recess+.12,y1+.12,z1,recess+.12,y0+.12,z0);
    beam([x0,y0,z0],[x1,y1,z1],.17,.18,trim,'amphitheater-balcony-fascia');
  }
  triangles(canopyPositions,mat('#bfb196'),'amphitheater-porch-canopy');
  for(const z of [-porchHalf,-porchHalf/2,0,porchHalf/2,porchHalf]){
    for(const offset of [-.15,.15])block(.13,ceiling(z)-deck,.13,trim,balconyFront+.22,(ceiling(z)+deck)/2,z+offset,'amphitheater-porch-post');
  }
  for(let i=0;i<4;i++){
    const z=-porchHalf*.74+i*porchHalf*1.48/3;
    window(recess-.13,z,deck+1.53,porchHalf*.39,2.88,0,true);
    window(recess-.13,z,eave-.69,porchHalf*.39,.52);
  }

  // A flared gable spans the rear elevation. It joins the auditorium roof
  // through a short hip at the stage end instead of adding overlapping roofs.
  const roofHalf=half+.75,knee=porchHalf*1.34;
  const profile=[[-roofHalf,eave],[ -knee,eave+1.1],[0,eave+rise*1.25],[knee,eave+1.1],[roofHalf,eave]];
  const roofPositions=[];
  const rings=[rear-.86,end-3.0,start+.12];
  for(let r=0;r<2;r++)for(let i=0;i<4;i++){
    const [z0,y0]=profile[i],[z1,y1]=profile[i+1],next0=r===1?eave:y0,next1=r===1?eave:y1;
    roofPositions.push(rings[r],y0,z0,rings[r+1],next1,z1,rings[r+1],next0,z0,rings[r],y0,z0,rings[r],y1,z1,rings[r+1],next1,z1);
  }
  triangles(roofPositions,surfaceMaterial('shingles',roofColor),'amphitheater-backstage-roof');
  const gableX=front-.10,gablePositions=[];
  for(let i=0;i<4;i++){
    const [z0,y0]=profile[i],[z1,y1]=profile[i+1];
    gablePositions.push(gableX,eave-.05,z0,gableX,y1,z1,gableX,y0,z0,gableX,eave-.05,z0,gableX,eave-.05,z1,gableX,y1,z1);
    beam([rear-.88,y0,z0],[rear-.88,y1,z1],.22,.22,trim,'amphitheater-gable-trim');
  }
  triangles(gablePositions,gable,'amphitheater-rear-gable');
  block(.18,.20,width+1.5,trim,front-.16,eave-.06,0,'amphitheater-rear-eave-band');
  // Four trapezoid panes form the low arch over the veranda canopy.
  const glassHalf=porchHalf*.95,arch=z=>eave+.66+1.48*(1-(z/glassHalf)**2),sill=eave+.02;
  for(let i=0;i<4;i++){
    const z0=-glassHalf+i*glassHalf/2+.09,z1=-glassHalf+(i+1)*glassHalf/2-.09,x=gableX-.06;
    triangles([x,sill,z0,x,arch(z1),z1,x,arch(z0),z0,x,sill,z0,x,sill,z1,x,arch(z1),z1],mat('#49666b'),'amphitheater-clerestory-glass',false);
    for(const z of [z0,z1])beam([x-.05,sill,z],[x-.05,arch(z),z],.12,.14,trim,'amphitheater-clerestory-trim');
    beam([x-.05,arch(z0),z0],[x-.05,arch(z1),z1],.12,.15,trim,'amphitheater-clerestory-trim');
    beam([x-.07,sill+.42,z0],[x-.07,sill+.42,z1],.045,.045,trim,'amphitheater-clerestory-mullion',false);
    beam([x-.07,sill,(z0+z1)/2],[x-.07,arch((z0+z1)/2),(z0+z1)/2],.045,.045,trim,'amphitheater-clerestory-mullion',false);
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(width*.20,.85),nameplate());
  sign.rotation.y=-Math.PI/2;sign.position.set(gableX-.13,eave+rise*.70,0);add(sign,'amphitheater-hagen-center-sign',false);

  // The small lower entry has its own canopy. Sample the uphill side for
  // its landing, and give every post and stair a solid connection to grade.
  const entryZ=-width*.13,entryHalf=width*.17,entryFront=front-2.25;
  const entryY=Math.min(deck-6.4,Math.max(...[entryZ-entryHalf,entryZ,entryZ+entryHalf].map(z=>groundAt(entryFront,z)))+.12);
  const entryTop=entryY+3.1,entryRoof=[];
  for(const z of [entryZ-entryHalf-.4,entryZ+entryHalf+.4])entryRoof.push([front+.1,entryTop+.5,z],[entryFront-.4,entryTop,z]);
  triangles([...entryRoof[0],...entryRoof[1],...entryRoof[3],...entryRoof[0],...entryRoof[3],...entryRoof[2]],siding,'amphitheater-lower-entry-canopy');
  block(.16,.16,entryHalf*2+.8,trim,entryFront-.4,entryTop-.04,entryZ,'amphitheater-lower-entry-fascia');
  for(let i=0;i<4;i++){
    const z=entryZ-entryHalf+i*entryHalf*2/3;
    const floor=Math.min(entryY-.18,groundAt(entryFront,z)-.15);
    for(const offset of [-.12,.12])block(.14,entryTop-floor,.14,trim,entryFront+.18,(entryTop+floor)/2,z+offset,'amphitheater-lower-entry-post');
    beam([entryFront+.18,entryTop-.65,z],[entryFront+.85,entryTop+.1,z],.13,.13,trim,'amphitheater-lower-entry-bracket');
  }
  block(front-entryFront,.22,entryHalf*2,trim,(front+entryFront)/2,entryY-.11,entryZ,'amphitheater-lower-entry-landing');
  for(const z of [entryZ-entryHalf,entryZ+entryHalf])rail([entryFront,z],[front,z],entryY);
  for(let i=0;i<4;i++){
    const z=entryZ-entryHalf*.74+i*entryHalf*1.48/3,w=entryHalf*.37;
    const door=window(front-.13,z,entryY+1.27,w,2.42,0,true);
    door.name='amphitheater-lower-porch-door';
    window(front-.13,z,entryY+2.76,w,.40);
  }
  const n=7,stepDepth=.28,stairHalf=2.1;
  rail([entryFront,entryZ-entryHalf],[entryFront,entryZ-stairHalf-.12],entryY);
  rail([entryFront,entryZ+stairHalf+.12],[entryFront,entryZ+entryHalf],entryY);
  const toe=entryFront-n*stepDepth,foot=Math.min(entryY,groundAt(toe,entryZ)+.05);
  for(let i=0;i<n;i++){
    const x=toe+(i+.5)*stepDepth,top=foot+(entryY-foot)*(i+1)/n;
    const base=Math.min(groundAt(x,entryZ-stairHalf),groundAt(x,entryZ+stairHalf),foot)-.18;
    block(stepDepth+.015,Math.max(.12,top-base),stairHalf*2,trim,x,(top+base)/2,entryZ,'amphitheater-entry-step');
  }
  for(const z of [entryZ-stairHalf,entryZ+stairHalf]){
    beam([toe,foot+.95,z],[entryFront,entryY+.95,z],.065,.065,trim,'amphitheater-entry-handrail');
    for(const t of [0,.5,1]){const y=foot+(entryY-foot)*t;block(.065,.95,.065,trim,toe+(entryFront-toe)*t,y+.475,z,'amphitheater-entry-handrail-post');}
  }
  // Segment the foundation so the terrace follows the sloping service lane.
  for(let i=0;i<Math.ceil(entryHalf*2);i++){
    const dz=entryHalf*2/Math.ceil(entryHalf*2),z=entryZ-entryHalf+(i+.5)*dz;
    const base=groundAt(entryFront,z)-.22;
    if(base<entryY-.22)block(front-entryFront,entryY-.22-base,dz+.015,wall,(front+entryFront)/2,(entryY-.22+base)/2,z,'amphitheater-entry-foundation');
  }
  const garageZ=width*.325,garageW=width*.235,garageTop=deck-3.55;
  const garageBottom=Math.min(deck-6.4,Math.max(...[-.5,0,.5].map(t=>groundAt(front-1,garageZ+t*garageW)))+.06);
  // The loading threshold sits on a level apron, with a short transition
  // back to the sloping service lane rather than grass crossing the door.
  const apron=[];
  for(let i=0;i<12;i++){
    const z0=garageZ-garageW/2+i*garageW/12,z1=z0+garageW/12,x0=front-3.2,x1=front-.05;
    const y0=Math.min(garageBottom,groundAt(x0,z0)+.07),y1=Math.min(garageBottom,groundAt(x0,z1)+.07);
    apron.push(x0,y0,z0,x1,garageBottom,z1,x1,garageBottom,z0,x0,y0,z0,x0,y1,z1,x1,garageBottom,z1);
  }
  triangles(apron,mat('#b7b5a7'),'amphitheater-loading-apron');
  block(.16,garageTop-garageBottom,garageW,'#90948b',front-.16,(garageBottom+garageTop)/2,garageZ,'amphitheater-loading-door');
  for(const z of [garageZ-garageW/2-.11,garageZ+garageW/2+.11])block(.25,garageTop-garageBottom+.15,.22,trim,front-.18,(garageBottom+garageTop)/2,z,'amphitheater-loading-door-trim');
  for(let y=garageBottom+.6;y<garageTop;y+=.65)block(.19,.025,garageW,'#7e837a',front-.22,y,garageZ,'amphitheater-loading-door-seam',false);
  for(let i=0;i<7;i++)block(.20,.29,.65,'#4e6361',front-.25,garageTop-.75,garageZ-garageW*.38+i*garageW*.76/6,'amphitheater-loading-door-pane',false);
  block(.23,.20,garageW+.44,trim,front-.18,garageTop+.10,garageZ,'amphitheater-loading-door-lintel');
  root.userData.backstage={front,recess,deck,porchHalf,balconyHalf,balconyFront,entryY,entryTop,entryZ,entryFront,toe,stairHalf,garageBottom,garageTop};
  return {root,porchLights:{height:entryTop-.15,outline:[[entryFront-.10,entryZ-entryHalf-.3],[front-.2,entryZ-entryHalf-.3],[front-.2,entryZ+entryHalf+.3],[entryFront-.10,entryZ+entryHalf+.3]]}};
}
