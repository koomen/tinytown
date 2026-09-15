// Small native meshes for explicitly mapped docks and their moorings. Placement
// follows surveyed centerlines, never a generic marina grid or a water scatter.
import * as THREE from 'three';
import {mat, box, rbox} from './kit.js';
import {makeRng} from './rng.js';

const CREAM='#eee7d7', WOOD='#b6a084', DARK='#455963';
const COLORS=['#608e95','#536c88','#af6254','#cfb26d','#699780','#e0ded0'];
const OUTLINE=[[-.39,-.5],[.39,-.5],[.5,-.34],[.49,.11],[.35,.35],[.15,.47],[0,.5],[-.15,.47],[-.35,.35],[-.49,.11],[-.5,-.34]];

function named(mesh,name,coarse=false){mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;if(coarse)mesh.userData.streamCoarse=true;return mesh;}
function beam(a,b,width,height,color,y,name,coarse=true){
  const mesh=box(width,height,Math.hypot(b[0]-a[0],b[1]-a[1]),color,(a[0]+b[0])/2,y,(a[1]+b[1])/2);
  mesh.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);return named(mesh,name,coarse);
}

export function buildDock(feature,{grade=()=>0}={}){
  const group=new THREE.Group();group.name='mapped-dock';
  const pts=feature.pts||[],width=feature.width||2;
  const level=([x,z])=>Number.isFinite(feature.level)?feature.level:grade(x,z);
  if(feature.closed && pts.length>2){
    const geometry=new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z))));
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=-p.getY(i);p.setXYZ(i,x,level([x,z])+.1,z);}
    geometry.computeVertexNormals();group.add(named(new THREE.Mesh(geometry,mat(WOOD)),'dock-deck',true));
  }else for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.01)continue;
    const y=(level(a)+level(b))/2;
    group.add(beam(a,b,width,.19,WOOD,y+.005,'dock-deck'));
    if(!feature.dock?.planked)continue;
    const ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length,nx=-uz,nz=ux;
    // Narrow dark seams and end posts keep the docks legible close up. The
    // uninterrupted deck is the far-view model and also hides all seam ends.
    for(let t=.48;t<length;t+=.48){
      const x=a[0]+ux*t,z=a[1]+uz*t;
      group.add(beam([x-nx*width*.49,z-nz*width*.49],[x+nx*width*.49,z+nz*width*.49],.024,.015,'#948675',y+.107,'dock-plank-seam',false));
    }
    const count=Math.max(1,Math.ceil(length/7.5));
    for(let j=0;j<=count;j++)for(const side of [-1,1]){
      const t=length*j/count,x=a[0]+ux*t+nx*side*width*.44,z=a[1]+uz*t+nz*side*width*.44;
      group.add(named(box(.16,1.45,.16,'#827967',x,y-.4,z),'dock-post'));
      if(j===count)group.add(named(box(.22,.07,.22,CREAM,x,y+.355,z),'dock-post-cap'));
    }
  }
  if(!feature.dock?.planked)for(const p of pts)group.add(named(box(.18,1.3,.18,'#827860',p[0],level(p)-.35,p[1]),'dock-post'));
  return group;
}

function hull(length,width,color){
  const positions=[],indices=[],rings=[[-.25,.62],[-.02,.91],[.51,1],[.64,.98]];
  for(const [y,scale] of rings)for(const [x,z] of OUTLINE)positions.push(x*width*scale,y,z*length*scale);
  const n=OUTLINE.length;
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<n;i++){
    const a=k*n+i,b=k*n+(i+1)%n,c=b+n,d=a+n;indices.push(a,d,b,b,d,c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return named(new THREE.Mesh(geometry,mat(color)),'boat-hull',true);
}
function deck(length,width,y,color,scale=1){
  const shape=new THREE.Shape(OUTLINE.map(([x,z])=>new THREE.Vector2(x*width*scale,-z*length*scale)));
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);geometry.translate(0,y,0);
  return named(new THREE.Mesh(geometry,mat(color)),'boat-deck',true);
}
function rod(group,a,b,radius,color,name,coarse=false){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),dir=to.clone().sub(from);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,dir.length(),6),mat(color));
  mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());group.add(named(mesh,name,coarse));
}

export function buildBoat({type='runabout',length=5.8,width=2.25,color=COLORS[0]}={}){
  const group=new THREE.Group();group.name=`boat-${type}`;
  group.add(hull(length,width,color),deck(length,width,.635,CREAM,.98));
  // Gunwales are actual geometry; no transparent textures or thin blended glass.
  for(let i=0;i<OUTLINE.length;i++){
    const a=OUTLINE[i],b=OUTLINE[(i+1)%OUTLINE.length];
    group.add(beam([a[0]*width*.97,a[1]*length*.97],[b[0]*width*.97,b[1]*length*.97],.09,.10,CREAM,.68,'boat-gunwale',true));
  }
  if(type==='pontoon'){
    for(const side of [-1,1]){
      const tube=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,length*.85,8),mat('#9ca5a3'));
      tube.rotation.x=Math.PI/2;tube.position.set(side*width*.36,.05,-.15);group.add(named(tube,'boat-pontoon',true));
      group.add(named(rbox(.3,.5,length*.59,CREAM,.08,side*width*.34,.98,-.22),'boat-seat',true));
      for(const z of [-length*.3,length*.13])rod(group,[side*width*.37,.78,z],[side*width*.37,2.13,z],.045,DARK,'boat-canopy-support');
    }
    group.add(named(rbox(width*.92,.18,length*.51,color,.09,0,2.16,-length*.075),'boat-bimini',true));
    group.add(named(box(width*.7,.31,.24,CREAM,0,.92,-length*.35),'boat-rear-bench',true));
    group.add(named(box(.38,.64,.42,DARK,width*.25,1.03,length*.22),'boat-console'));
  }else if(type==='sailboat'){
    group.add(named(rbox(width*.63,.37,length*.38,WOOD,.09,0,.84,.16),'boat-cabin',true));
    group.add(named(rbox(width*.42,.18,length*.25,CREAM,.07,0,1.09,.2),'boat-cabin-top',true));
    group.add(named(box(width*.54,.075,length*.21,DARK,0,.69,-length*.28),'boat-cockpit',true));
    const mastZ=length*.09,mastH=length*.91;
    rod(group,[0,.75,mastZ],[0,mastH,mastZ],.052,CREAM,'boat-mast',true);
    rod(group,[0,1.4,mastZ],[.05,1.4,-length*.31],.085,CREAM,'boat-furled-sail',true);
    rod(group,[0,mastH,mastZ],[0,.74,length*.46],.015,'#b4beb7','boat-stay');
    group.add(named(box(.48,.19,.035,color,.24,mastH-.3,mastZ),'boat-burgee',true));
  }else{
    group.add(named(rbox(width*.69,.10,length*.48,DARK,.1,0,.67,-length*.12),'boat-cockpit',true));
    for(const z of [-length*.27,length*.03]){
      group.add(named(rbox(width*.57,.16,.54,CREAM,.07,0,.79,z),'boat-seat',true));
      group.add(named(rbox(width*.58,.33,.18,CREAM,.06,0,.97,z-.22),'boat-seat-back',true));
    }
    const windscreen=box(width*.71,.44,.13,'#789ca3',0,1.1,length*.13);windscreen.rotation.x=.25;
    group.add(named(windscreen,'boat-windscreen',true));
    group.add(named(box(width*.74,.055,.15,CREAM,0,1.32,length*.14),'boat-windscreen-frame',true));
  }
  if(type!=='sailboat')group.add(named(rbox(.42,.66,.43,DARK,.08,0,.51,-length*.5-.07),'boat-outboard',true));
  for(const side of [-1,1])for(const z of [-length*.22,length*.14]){
    const fender=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.23,2,5),mat(CREAM));
    fender.position.set(side*width*.51,.37,z);group.add(named(fender,'boat-fender'));
  }
  group.userData.boat={type,length,width};return group;
}

function inside(pts,x,z){let hit=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const a=pts[i],b=pts[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
}return hit;}
function distance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;
  const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
}
function cross(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function crossing(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
function ringsOverlap(a,b){return a.some(p=>inside(b,...p))||b.some(p=>inside(a,...p))||a.some((p,i)=>b.some((q,j)=>crossing(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));}
function footprint(x,z,ux,uz,length,width,pad=.22){return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>[x+ux*s*(length/2+pad)-uz*t*(width/2+pad),z+uz*s*(length/2+pad)+ux*t*(width/2+pad)]);}

// Exported independently of geometry for deterministic placement and geographic
// validation. Finite-level water is required, and every padded hull edge must
// remain inside the same water polygon and clear of every mapped dock.
export function planMoorings(features=[]){
  const waters=features.filter(f=>f.kind==='water'&&f.closed&&Number.isFinite(f.level));
  const piers=features.filter(f=>f.kind==='pier'&&f.pts?.length>1),segments=[];
  for(const f of piers)for(let i=0;i<f.pts.length-(f.closed?0:1);i++)segments.push({a:f.pts[i],b:f.pts[(i+1)%f.pts.length],width:f.width||2});
  const accepted=[];
  for(const f of piers.filter(p=>p.mooring).sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
    const m=f.mooring,rng=makeRng(`mooring:${f.id}`),parts=[];let total=0,count=0;
    for(let i=1;i<f.pts.length;i++){const a=f.pts[i-1],b=f.pts[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length>.1){parts.push({a,b,length,start:total});total+=length;}}
    const spacing=m.spacing||7.8,start=Math.max(2,total*(m.minFraction??.5));
    for(let t=start;t<total-1&&count<(m.maxBoats??8);t+=spacing){
      const part=parts.find(p=>t<=p.start+p.length);if(!part)continue;
      const ux=(part.b[0]-part.a[0])/part.length,uz=(part.b[1]-part.a[1])/part.length;
      for(const side of [-1,1]){
        const sample=rng.next(),type=sample<.19?'sailboat':sample<.43?'pontoon':'runabout';
        const length=type==='sailboat'?rng.range(6.2,7.2):type==='pontoon'?rng.range(5.8,6.7):rng.range(4.8,6.0);
        const width=type==='pontoon'?2.55:type==='sailboat'?2.25:2.18,color=rng.pick(COLORS);
        if(!rng.chance(m.occupancy??.7)||count>=(m.maxBoats??8))continue;
        const perpendicular=m.layout==='perpendicular',ax=perpendicular?-uz*side:ux,az=perpendicular?ux*side:uz;
        const offset=(f.width||2)/2+(perpendicular?length:width)/2+.58;
        const x=part.a[0]+ux*(t-part.start)-uz*side*offset,z=part.a[1]+uz*(t-part.start)+ux*side*offset;
        const ring=footprint(x,z,ax,az,length+.25,width),lake=waters.find(w=>ring.every((p,i)=>{
          const q=ring[(i+1)%ring.length];for(let k=0;k<=6;k++)if(!inside(w.pts,p[0]+(q[0]-p[0])*k/6,p[1]+(q[1]-p[1])*k/6))return false;return true;
        }));
        if(!lake)continue;
        const touchesDock=segments.some(s=>inside(ring,...s.a)||inside(ring,...s.b)||ring.some((p,i)=>{
          const q=ring[(i+1)%ring.length];return crossing(p,q,s.a,s.b)||Math.min(distance(p,s.a,s.b),distance(q,s.a,s.b),distance(s.a,p,q),distance(s.b,p,q))<s.width/2+.13;
        }));
        if(touchesDock||accepted.some(b=>ringsOverlap(ring,b.footprint)))continue;
        accepted.push({id:`${f.id}-${count}`,dockId:f.id,x,z,y:lake.level+.12,angle:Math.atan2(ax,az),length,width,type,color,footprint:ring});count++;
      }
    }
  }
  return accepted;
}

export function buildMooredBoats(features=[]){
  const group=new THREE.Group();group.name='mapped-moored-boats';
  for(const placement of planMoorings(features)){
    const boat=buildBoat(placement);boat.position.set(placement.x,placement.y,placement.z);boat.rotation.y=placement.angle;
    boat.name=`moored-${placement.id}`;boat.userData.streamKind='landmark';boat.userData.mooring=placement;group.add(boat);
  }
  return group;
}
