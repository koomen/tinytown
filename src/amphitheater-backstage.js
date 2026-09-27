// Susan Hirt Hagen Center: a swooping shingled gable over a curved two-storey
// bay. The bay carries a covered third-floor balcony and shelters a ground
// colonnade; symmetric wings, a concrete base, a loading door and a rockery.
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
  const roofColor=spec.roofColor??'#b8c0bd',width=span*(spec.houseWidth??.62),half=width/2;
  const porchDepth=spec.porchDepth??3.4,front=rear+.18,recess=front+porchDepth*.3,end=start-1;
  const concrete='#8e8b83',iron='#2c2f2d',glass='#49666b';
  // Storeys: ground colonnade/loading level, curved middle bay, balcony level.
  const deck=eave-4.3,bayBottom=deck-3.6;
  const bayHalf=width*.285,porchHalf=bayHalf*.75,balconyHalf=bayHalf;
  // The bay is a shallow circular segment projecting from the wing plane.
  const bayDepth=Math.min(2.4,porchDepth*.75),radius=(bayHalf**2+bayDepth**2)/(2*bayDepth);
  const arcX=z=>Math.abs(z)>=bayHalf?front:front-(Math.sqrt(radius**2-z*z)-(radius-bayDepth));
  const arc=(offset=0,from=-bayHalf,to=bayHalf,n=14)=>Array.from({length:n+1},(_,i)=>{
    const z=from+(to-from)*i/n;return [arcX(z)+offset,z];
  });
  const bottom=Math.min(-depth-.35,...[-half,0,half].map(z=>groundAt(front-1,z)-.35));
  const siding=surfaceMaterial('shingles',wall),gable=surfaceMaterial('shingles','#5d6863');
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
  // Horizontal plate over a plan polygon of [x,z] points.
  const plate=(points,y0,y1,color,name,coarse=true)=>{
    const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
    const geo=new THREE.ExtrudeGeometry(shape,{depth:y1-y0,bevelEnabled:false,curveSegments:1});
    geo.rotateX(-Math.PI/2);geo.translate(0,y0,0);
    return add(new THREE.Mesh(geo,typeof color==='string'?mat(color):color),name,coarse);
  };
  const clad=(x0,x1,y0,y1,z0,z1,name,material=siding)=>{
    const o=block(x1-x0,y1-y0,z1-z0,wall,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2,name);o.material=material;return o;
  };
  // Wall panel along a plan segment, its outside face on the segment.
  const panel=(a,b,y0,y1,t,material,name,coarse=true)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
    const o=block(t,y1-y0,len+.02,wall,(a[0]+b[0])/2-nx*t/2,(y0+y1)/2,(a[1]+b[1])/2-nz*t/2,name,coarse);
    o.rotation.y=Math.atan2(dx,dz);if(material)o.material=material;return o;
  };
  const window=(x,z,y,w,h,rotation=0,door=false,panes=false)=>{
    const g=new THREE.Group(),t=.12;
    g.add(box(.10,h,w,glass,-.04,0,0));
    for(const zz of [-w/2-t/2,w/2+t/2])g.add(box(.16,h+2*t,t,trim,-.08,0,zz));
    for(const yy of [-h/2-t/2,h/2+t/2])g.add(box(.16,t,w,trim,-.08,yy,0));
    g.add(box(.18,h,.055,trim,-.10,0,0),box(.18,.055,w,trim,-.10,door?h*.22:0,0));
    // Many-paned French doors and sashes: extra muntins across each leaf.
    if(panes)for(const f of [-.25,.25])g.add(box(.17,h,.035,trim,-.10,0,f*w));
    if(panes)for(const f of door?[.46,-.02]:[.25,-.25])g.add(box(.17,.035,w,trim,-.10,f*h,0));
    if(door)for(const zz of [-.15,.15])g.add(box(.22,.24,.045,'#b7ab79',-.18,-.28,zz));
    g.position.set(x,y,z);g.rotation.y=rotation;add(g,door?'amphitheater-porch-door':'amphitheater-backstage-window',false);return g;
  };
  const rail=(a,b,y,color=trim,name='amphitheater-porch-rail',spacing=.24)=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(const dy of [.15,1.02])beam([a[0],y+dy,a[1]],[b[0],y+dy,b[1]],.085,.085,color,name);
    const n=Math.ceil(length/spacing);
    for(let i=0;i<=n;i++){const t=i/n;block(.046,.83,.046,color,a[0]+(b[0]-a[0])*t,y+.59,a[1]+(b[1]-a[1])*t,name.replace(/rail$/,'baluster'),false);}
  };
  const polyline=(points,fn)=>{for(let i=1;i<points.length;i++)fn(points[i-1],points[i]);};
  const along=(points,y,w,h,color,name,coarse=true)=>polyline(points,(a,b)=>beam([a[0],y,a[1]],[b[0],y,b[1]],w,h,color,name,coarse));
  const heading=(a,b)=>Math.atan2(b[0]-a[0],b[1]-a[1]);

  // Body: a full-height stage house behind the facade, a lower block under
  // the balcony, and upper wings flanking the genuinely recessed balcony room.
  clad(recess,end,bottom,eave,-half,half,'amphitheater-backstage');
  clad(front,recess,bottom,deck-.15,-half,half,'amphitheater-lower-storeys');
  const wingZ=[.3,.72].map(f=>bayHalf+(half-bayHalf)*f);
  for(const sign of [-1,1]){
    clad(front,recess,deck-.15,eave,...(sign<0?[-half,-porchHalf]:[porchHalf,half]),'amphitheater-upper-wing');
    // Gray concrete ground storey on each wing.
    const [z0,z1]=sign<0?[-half,-bayHalf]:[bayHalf,half];
    block(.14,bayBottom-.2-bottom,z1-z0,concrete,front-.07,(bayBottom-.2+bottom)/2,(z0+z1)/2,'amphitheater-concrete-base');
    block(.22,eave-bottom,.22,trim,front-.06,(eave+bottom)/2,sign*(half-.09),'amphitheater-stage-house-corner');
    block(.22,deck-bayBottom,.2,trim,front-.06,(deck+bayBottom)/2,sign*(bayHalf+.14),'amphitheater-wing-corner-board');
    for(const z of wingZ){
      window(front-.13,sign*z,(deck+eave)/2+.1,1.3,2.2,0,false,true);
      window(front-.13,sign*z,(bayBottom+deck)/2+.3,1.3,1.25,0,false,true);
    }
    for(const y of [(bayBottom+deck)/2+.3,(deck+eave)/2+.1])for(let i=0;i<4;i++)
      window(recess+1.7+i*(end-recess-3.4)/3,sign*(half+.1),y,1.3,y<deck?1.25:2.2,sign*Math.PI/2);
  }
  // Double cream band at the top of the concrete, a storey band and eave frieze.
  for(const sign of [-1,1]){
    const [z0,z1]=sign<0?[-half,-bayHalf]:[bayHalf,half];
    block(.2,.34,z1-z0,trim,front-.14,bayBottom,(z0+z1)/2,'amphitheater-storey-band');
    block(.2,.2,z1-z0,trim,front-.14,deck-.1,(z0+z1)/2,'amphitheater-storey-band');
    block(.2,.42,half-porchHalf,trim,front-.14,eave-.28,sign*(half+porchHalf)/2,'amphitheater-eave-frieze');
  }

  // The curved bay: siding on the arc, small square windows, trim bands, and
  // a white soffit over the colonnade below.
  const bay=arc();
  polyline(bay,(a,b)=>panel(a,b,bayBottom,deck,.3,siding,'amphitheater-bay-wall'));
  plate([...bay,[front+.1,bayHalf],[front+.1,-bayHalf]],bayBottom-.32,bayBottom+.02,trim,'amphitheater-bay-soffit');
  along(arc(-.08),bayBottom-.1,.34,.26,trim,'amphitheater-bay-band');
  for(const f of [-.6,-.2,.2,.6]){
    const z=f*bayHalf,a=[arcX(z-.3),z-.3],b=[arcX(z+.3),z+.3];
    window(arcX(z)-.03,z,(bayBottom+deck)/2+.3,1.1,1.1,heading(a,b),false,true);
  }
  for(const f of [-.4,0,.4]){const z=f*bayHalf;block(.08,deck-bayBottom-.3,.16,trim,arcX(z)-.04,(deck+bayBottom)/2,z,'amphitheater-bay-pilaster',false);}

  // Third-floor balcony on the bay: its deck wraps the curve and reaches
  // back into the recessed room between the canopy columns.
  const balconyFront=front-bayDepth;
  const deckPlan=[...bay,[front,porchHalf],[recess+.1,porchHalf],[recess+.1,-porchHalf],[front,-porchHalf]];
  plate(deckPlan,deck-.25,deck,trim,'amphitheater-back-porch');
  along(arc(-.1),deck-.12,.24,.3,trim,'amphitheater-balcony-fascia');
  polyline(arc(.12,-bayHalf,bayHalf,12),(a,b)=>rail(a,b,deck));
  // Flat canopy on paired columns, projecting just past the curved railing.
  const ceiling=eave-.22,canopyEdge=arc(-.35,-porchHalf,porchHalf,10);
  plate([...canopyEdge,[recess+.1,porchHalf],[recess+.1,-porchHalf]],ceiling-.26,ceiling,'#e8dfc6','amphitheater-porch-canopy');
  along(canopyEdge,ceiling-.13,.3,.16,trim,'amphitheater-canopy-fascia');
  for(let i=0;i<5;i++){
    const z=-porchHalf*.96+i*porchHalf*.48,x=arcX(z)+.3;
    for(const offset of [-.17,.17])block(.16,ceiling-.26-deck,.16,trim,x,(ceiling-.26+deck)/2,z+offset,'amphitheater-porch-post');
  }
  for(let i=0;i<4;i++){
    const z=-porchHalf*.74+i*porchHalf*1.48/3;
    window(recess-.13,z,deck+1.4,porchHalf*.39,2.6,0,true,true);
    window(recess-.13,z,deck+3.15,porchHalf*.39,.55);
  }

  // Broad swooping gable: a low outer slope to a knee, then a steeper,
  // gently concave centre. Wide eaves project past both wings.
  const roofHalf=half+1.6,kneeT=.52,kneeH=rise*.24,apexH=rise*.95;
  const outer=kneeH/(1-kneeT),extra=apexH-kneeH-outer*kneeT;
  const roofY=z=>{const t=Math.min(1,Math.abs(z)/roofHalf);
    return eave+(t>=kneeT?outer*(1-t):kneeH+outer*(kneeT-t)+extra*(1-t/kneeT)**2);};
  const profile=[];
  for(let i=0;i<=16;i++){const z=-roofHalf+i*roofHalf/8;profile.push([z,roofY(z)]);}
  const roofPositions=[],rings=[rear-.86,end-3.0,start+.12];
  for(let r=0;r<2;r++)for(let i=0;i<profile.length-1;i++){
    const [z0,y0]=profile[i],[z1,y1]=profile[i+1],next0=r===1?eave:y0,next1=r===1?eave:y1;
    roofPositions.push(rings[r],y0,z0,rings[r+1],next1,z1,rings[r+1],next0,z0,rings[r],y0,z0,rings[r],y1,z1,rings[r+1],next1,z1);
  }
  triangles(roofPositions,surfaceMaterial('shingles',roofColor),'amphitheater-backstage-roof');
  // A pale soffit under the wide eaves, a little below the roof skin.
  const soffit=[];
  for(let i=0;i<roofPositions.length;i+=9)for(const j of [0,6,3])
    soffit.push(roofPositions[i+j],roofPositions[i+j+1]-.14,roofPositions[i+j+2]);
  triangles(soffit,mat('#e6decb'),'amphitheater-backstage-soffit',false);
  const gableX=front-.10,gablePositions=[];
  for(let i=0;i<profile.length-1;i++){
    const [z0,y0]=profile[i],[z1,y1]=profile[i+1];
    if(Math.abs(z0)>half+.01&&Math.abs(z1)>half+.01)continue;
    const a=Math.max(-half,Math.min(half,z0)),b=Math.max(-half,Math.min(half,z1));
    gablePositions.push(gableX,eave-.05,a,gableX,roofY(b),b,gableX,roofY(a),a,gableX,eave-.05,a,gableX,eave-.05,b,gableX,roofY(b),b);
  }
  triangles(gablePositions,gable,'amphitheater-rear-gable');
  polyline(profile,([z0,y0],[z1,y1])=>beam([rear-.88,y0+.04,z0],[rear-.88,y1+.04,z1],.26,.3,trim,'amphitheater-gable-trim'));
  for(const sign of [-1,1])beam([rear-.88,eave+.04,sign*roofHalf],[end-3.0,eave+.04,sign*roofHalf],.26,.3,trim,'amphitheater-side-fascia');
  block(.18,.20,width+.2,trim,front-.16,eave-.02,0,'amphitheater-rear-eave-band');
  // Four panes form the low segmental arch above the balcony canopy.
  const glassHalf=porchHalf*.9,arch=z=>eave+.6+1.2*Math.sqrt(Math.max(0,1-(z/(glassHalf+.5))**2)),sill=eave+.04;
  for(let i=0;i<4;i++){
    const z0=-glassHalf+i*glassHalf/2+.09,z1=-glassHalf+(i+1)*glassHalf/2-.09,x=gableX-.06;
    // Subdivide each pane so its head follows the segmental arch.
    const pane=[],steps=4;
    for(let j=0;j<steps;j++){
      const a=z0+(z1-z0)*j/steps,b=z0+(z1-z0)*(j+1)/steps;
      pane.push(x,sill,a,x,arch(b),b,x,arch(a),a,x,sill,a,x,sill,b,x,arch(b),b);
      beam([x-.05,arch(a),a],[x-.05,arch(b),b],.14,.17,trim,'amphitheater-clerestory-trim');
    }
    triangles(pane,mat(glass),'amphitheater-clerestory-glass',false);
    for(const z of [z0,z1])beam([x-.05,sill,z],[x-.05,arch(z),z],.14,.16,trim,'amphitheater-clerestory-trim');
    beam([x-.07,sill+.42,z0],[x-.07,sill+.42,z1],.045,.045,trim,'amphitheater-clerestory-mullion',false);
    beam([x-.07,sill,(z0+z1)/2],[x-.07,arch((z0+z1)/2),(z0+z1)/2],.045,.045,trim,'amphitheater-clerestory-mullion',false);
  }
  beam([gableX-.12,sill,-glassHalf],[gableX-.12,sill,glassHalf],.16,.2,trim,'amphitheater-clerestory-trim');
  const signW=Math.min(width*.14,4.8),signY=arch(0)+.72;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(signW,signW*.22),nameplate());
  sign.rotation.y=-Math.PI/2;sign.position.set(gableX-.13,signY,0);add(sign,'amphitheater-hagen-center-sign',false);

  // Ground colonnade under the bay. Its floor sits above the downhill lane
  // on a concrete foundation; the rear walk arrives at a central flight.
  // Keep the flight fixed in absolute terms: the mapped walk ends on it.
  const entryZ=-span*.0806,entryFront=front-2.25,stairHalf=2.1;
  const porchEdge=arc(-.55);
  const entryY=Math.min(bayBottom-3.0,Math.max(...porchEdge.map(([x,z])=>groundAt(x,z)))+.12);
  const colTop=bayBottom-.32;
  plate([...porchEdge,[front+.1,bayHalf],[front+.1,-bayHalf]],entryY-.22,entryY,'#d4cdb9','amphitheater-colonnade-floor');
  for(let i=0;i<porchEdge.length-1;i++){
    const [xa,za]=porchEdge[i],[xb,zb]=porchEdge[i+1],z=(za+zb)/2,x0=Math.min(xa,xb);
    const base=Math.min(groundAt(x0,za),groundAt(x0,zb),groundAt(front,z))-.25;
    if(base<entryY-.22)block(front-x0,entryY-.22-base,Math.abs(zb-za)+.02,concrete,(front+x0)/2,(entryY-.22+base)/2,z,'amphitheater-entry-foundation');
  }
  const colZ=Array.from({length:7},(_,i)=>(-.94+i*.94/3)*bayHalf);
  for(const z of colZ){
    const x=arcX(z)+.35;
    block(.34,colTop-entryY,.34,trim,x,(colTop+entryY)/2,z,'amphitheater-colonnade-column');
    block(.5,.16,.5,trim,x,colTop-.08,z,'amphitheater-colonnade-capital',false);
  }
  // White balustrade between the columns, open where the flight arrives.
  for(let i=0;i<colZ.length-1;i++){
    const za=colZ[i]+.2,zb=colZ[i+1]-.2;
    if(zb>entryZ-stairHalf-.2&&za<entryZ+stairHalf+.2)continue;
    rail([arcX(za)+.35,za],[arcX(zb)+.35,zb],entryY);
  }
  for(let i=0;i<4;i++){
    const z=-bayHalf*.66+i*bayHalf*1.32/3,w=bayHalf*.2;
    const door=window(front-.13,z,entryY+1.22,w,2.35,0,true,true);
    door.name='amphitheater-lower-porch-door';
    window(front-.13,z,entryY+2.72,w,.42);
  }
  block(front-entryFront,.22,stairHalf*2+.3,'#d4cdb9',(front+entryFront)/2,entryY-.11,entryZ,'amphitheater-lower-entry-landing');
  const n=7,stepDepth=.28;
  const toe=entryFront-n*stepDepth,foot=Math.min(entryY,groundAt(toe,entryZ)+.05);
  for(let i=0;i<n;i++){
    const x=toe+(i+.5)*stepDepth,top=foot+(entryY-foot)*(i+1)/n;
    const base=Math.min(groundAt(x,entryZ-stairHalf),groundAt(x,entryZ+stairHalf),foot)-.18;
    block(stepDepth+.015,Math.max(.12,top-base),stairHalf*2,'#b9b5a8',x,(top+base)/2,entryZ,'amphitheater-entry-step');
  }
  for(const z of [entryZ-stairHalf,entryZ+stairHalf]){
    beam([toe,foot+.95,z],[entryFront,entryY+.95,z],.065,.065,iron,'amphitheater-entry-handrail');
    for(const t of [0,.5,1]){const y=foot+(entryY-foot)*t;block(.065,.95,.065,iron,toe+(entryFront-toe)*t,y+.475,z,'amphitheater-entry-handrail-post');}
  }

  // Rockery: flat ledge stones retain the colonnade terrace, with boulders
  // spilling down to a black iron railing along the lane.
  const stones=['#8d8a7c','#a39d8c','#77766a','#b0a998'];
  const stone=(x,y,z,sx,sy,sz,i)=>{
    const o=add(new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),mat(stones[i%4])),'amphitheater-rockery-stone',i%3===0);
    o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(.3*i,.9*i,.15*i);return o;
  };
  const rockeryOut=2.8,gaps=[[entryZ-stairHalf-.35,entryZ+stairHalf+.35]];
  let k=0;
  for(let z=-bayHalf+.3;z<bayHalf+2.2;z+=.9){
    if(gaps.some(([a,b])=>z>a&&z<b))continue;
    const x0=Math.min(arcX(Math.min(z,bayHalf)),front)-.55;
    // Flat ledge stones stack up the retaining face to the terrace edge.
    const low=groundAt(x0-.5,z)-.1,courses=Math.max(1,Math.round((entryY-low)/.42));
    for(let c=0;c<courses;c++){
      const h=(entryY-low)/courses,o=block(.9+.15*((k+c)%3),h+.04,.95,stones[(k+c)%4],x0-.35-.12*(courses-c),low+h*(c+.5),z+.08*((k+c)%2),'amphitheater-rockery-ledge',c===0);
      o.rotation.y=.12*(((k+c)%3)-1);
    }
    for(let j=1;j<4;j++){
      const x=x0-.4-j*rockeryOut/4+(k%2)*.2,zz=z+((k*37)%9-4)*.05,g=groundAt(x,zz);
      stone(x,g+.12,zz,.42-.06*j,.3-.04*j,.38-.05*j,k++);
    }
  }
  const fence=[];
  for(let z=entryZ+stairHalf+.3;z<=bayHalf+2.5;z+=1.0){
    const x=Math.min(arcX(Math.min(z,bayHalf)),front)-.55-rockeryOut-.4;fence.push([x,z]);
  }
  for(let z=-bayHalf-.5;z<=entryZ-stairHalf-.3;z+=1.0){
    const x=Math.min(arcX(Math.max(z,-bayHalf)),front)-.55-rockeryOut-.4;fence.unshift([x,z]);
  }
  fence.sort((a,b)=>a[1]-b[1]);
  for(let i=1;i<fence.length;i++){
    const a=fence[i-1],b=fence[i];
    if(gaps.some(([lo,hi])=>(a[1]+b[1])/2>lo&&(a[1]+b[1])/2<hi))continue;
    const ga=groundAt(...a),gb=groundAt(...b);
    for(const dy of [.45,1.0])beam([a[0],ga+dy,a[1]],[b[0],gb+dy,b[1]],.045,.045,iron,'amphitheater-rockery-railing',false);
  }
  for(const [x,z] of fence){const g=groundAt(x,z);block(.06,1.05,.06,iron,x,g+.5,z,'amphitheater-rockery-post',false);}
  // A redbud in bloom beside the loading door and two young trees.
  // Open, airy crowns of small puffs so the facade still shows through.
  const tree=(x,z,h,r,color,name,puffs)=>{
    const g=groundAt(x,z);
    const trunk=add(new THREE.Mesh(new THREE.CylinderGeometry(.06,.1,h,6),mat('#5b4a3c')),name+'-trunk',false);
    trunk.position.set(x,g+h/2,z);
    for(let i=0;i<puffs;i++){
      const a=i*2.4,d=r*(.5+.5*((i*7)%5)/4),o=add(new THREE.Mesh(new THREE.IcosahedronGeometry(r*(.55+.1*(i%3)),1),mat(color)),name,false);
      o.position.set(x+Math.cos(a)*d,g+h+(((i*3)%5)/4-.35)*r*1.3,z+Math.sin(a)*d);o.scale.y=.7;
    }
  };
  tree(front-4.0,bayHalf-1.2,2.3,1.0,'#c46aa6','amphitheater-redbud',9);
  tree(front-4.2,-bayHalf*.05,4.4,.42,'#9fb46a','amphitheater-young-tree',6);
  tree(front-3.2,-bayHalf-1.4,3.9,.48,'#a8bd72','amphitheater-young-tree',6);

  // Wide gray roll-up loading door in the right wing's concrete base.
  const garageZ=bayHalf+(half-bayHalf)*.5,garageW=(half-bayHalf)*.7;
  const garageBottom=Math.min(bayBottom-3.2,Math.max(...[-.5,0,.5].map(t=>groundAt(front-1,garageZ+t*garageW)))+.06);
  const garageTop=Math.min(garageBottom+4.2,bayBottom-.5);
  // The loading threshold sits on a level apron, with a short transition
  // back to the sloping service lane rather than grass crossing the door.
  const apron=[];
  for(let i=0;i<12;i++){
    const z0=garageZ-garageW/2-.4+i*(garageW+.8)/12,z1=z0+(garageW+.8)/12,x0=front-3.6,x1=front-.05;
    const y0=Math.min(garageBottom,groundAt(x0,z0)+.07),y1=Math.min(garageBottom,groundAt(x0,z1)+.07);
    apron.push(x0,y0,z0,x1,garageBottom,z1,x1,garageBottom,z0,x0,y0,z0,x0,y1,z1,x1,garageBottom,z1);
  }
  triangles(apron,mat('#bdb6a4'),'amphitheater-loading-apron');
  block(.16,garageTop-garageBottom,garageW,'#6f716c',front-.2,(garageBottom+garageTop)/2,garageZ,'amphitheater-loading-door');
  for(const z of [garageZ-garageW/2-.12,garageZ+garageW/2+.12])block(.26,garageTop-garageBottom+.15,.24,'#9a978f',front-.2,(garageBottom+garageTop)/2,z,'amphitheater-loading-door-trim');
  for(let y=garageBottom+.55;y<garageTop;y+=.55)block(.19,.025,garageW,'#5f615c',front-.26,y,garageZ,'amphitheater-loading-door-seam',false);
  for(let i=0;i<8;i++)block(.20,.26,.5,'#39433f',front-.29,garageTop-.62,garageZ-garageW*.4+i*garageW*.8/7,'amphitheater-loading-door-pane',false);
  block(.24,.24,garageW+.48,'#9a978f',front-.2,garageTop+.12,garageZ,'amphitheater-loading-door-lintel');

  root.userData.backstage={front,recess,deck,bayBottom,bayHalf,bayDepth,porchHalf,balconyHalf,balconyFront,
    entryY,entryZ,entryFront,toe,stairHalf,garageZ,garageW,garageBottom,garageTop,roofHalf};
  // String lights trace the colonnade under the bay soffit.
  return {root,porchLights:{height:colTop-.12,outline:arc(-.2,-bayHalf*.9,bayHalf*.9,Math.max(2,Math.round(bayHalf*1.8)))}};
}
