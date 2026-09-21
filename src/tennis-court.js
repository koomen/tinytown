// Geographic landmarks specify each court pad and its playing direction.
// Rectangular banks share an enclosure; chamfered courts retain their own fences.
import * as THREE from 'three';
import {box,mat} from './kit.js';
import {surfaceMaterial} from './materials.js';
import {drapeTriangles} from './landmark-drape.js';
import {ribbonStrip} from './landmark-ribbon.js';
import {buildPerimeter} from './perimeter.js';

let netMaterial;
function meshNet() {
  if(netMaterial)return netMaterial;
  const c=document.createElement('canvas');c.width=c.height=32;
  const ctx=c.getContext('2d');ctx.fillStyle='#273d33';
  ctx.fillRect(0,0,3,32);ctx.fillRect(0,0,32,3);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;
  netMaterial=new THREE.MeshStandardMaterial({map:t,transparent:true,opacity:.85,alphaTest:.03,depthWrite:false,side:THREE.DoubleSide,roughness:1});return netMaterial;
}
export function buildTennisCourt(feature,grade=()=>0,grid=null) {
  const root=new THREE.Group();root.name='tennis-court';root.userData.sourceWay=feature.sourceWay;
  const rectangular=feature.pts?.length===4 && feature.tennis?.endEdge?.length===2;
  if(!rectangular && (feature.tennis?.axis!=='north-south'||feature.pts?.length!==8))return root;
  if(rectangular && feature.tennis.courts>1) {
    // Consecutive corners start at the authored end edge. Each court shares
    // the enclosure's run-off area; there are no duplicate internal fences.
    const [i,j]=feature.tennis.endEdge,step=(j-i+4)%4;
    const [a,b,c,d]=[0,1,2,3].map(k=>feature.pts[(i+k*step)%4]);
    const mix=(p,q,t)=>p.map((v,k)=>v+(q[k]-v)*t);
    const count=feature.tennis.courts;
    for(let k=0;k<count;k++) {
      root.add(buildTennisCourt({...feature,id:`${feature.id}-${k+1}`,
        pts:[mix(a,b,k/count),mix(a,b,(k+1)/count),mix(d,c,(k+1)/count),mix(d,c,k/count)],
        tennis:{endEdge:[0,1],fence:false}},grade,grid));
    }
    const fence=buildPerimeter({pts:[...feature.pts,feature.pts[0]],openings:feature.openings,
      height:feature.tennis.fenceHeight??3,color:'#3c4945',meshColor:'#52605a',style:'chain_link'},
      (x,z)=>grade(x,z)+.12);
    fence.name='tennis-fence';
    fence.traverse(o=>{if(o.isMesh)o.userData.streamCoarse=true;});root.add(fence);
    root.userData.tennis={courts:count};
    return root;
  }
  const pts=feature.pts,x0=Math.min(...pts.map(p=>p[0])),x1=Math.max(...pts.map(p=>p[0])),z0=Math.min(...pts.map(p=>p[1])),z1=Math.max(...pts.map(p=>p[1]));
  const cx=(x0+x1)/2,cz=(z0+z1)/2,lift=.12;
  let ux=1,uz=0;
  if(rectangular) {
    const [i,j]=feature.tennis.endEdge,a=pts[i],b=pts[j];
    const width=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(width<.01)return root;
    ux=(b[0]-a[0])/width;uz=(b[1]-a[1])/width;
  }
  const point=(u,v)=>[cx+ux*u-uz*v,cz+uz*u+ux*v];
  const add=(geometry,material,name,coarse=false)=>{const m=new THREE.Mesh(geometry,material);m.name=name;m.receiveShadow=true;if(coarse)m.userData.streamCoarse=true;root.add(m);return m;};
  const shape=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z))),flat=new THREE.ShapeGeometry(shape),p=flat.attributes.position;
  const vertices=Array.from({length:p.count},(_,i)=>[p.getX(i),-p.getY(i)]),data=drapeTriangles(vertices,Array.from(flat.index.array),grade,grid,lift);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setIndex(data.indices);g.computeVertexNormals();
  const pad=add(g,rectangular?mat(feature.color||'#526e61'):surfaceMaterial('gravel',feature.color||'#7a8a81'),'landmark-surface');pad.userData.tennisPad=feature.id;pad.userData.streamCoarse=true;
  flat.dispose();
  const line=points=>{const strip=ribbonStrip(points.map(([u,v])=>point(u,v)),.075,false),d=drapeTriangles(strip.positions,strip.indices,grade,grid,.15);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));g.setIndex(d.indices);g.computeVertexNormals();add(g,mat(0xf0eee0),'landmark-ribbon',true);};
  const hw=10.97/2,hl=23.77/2,sw=8.23/2,service=6.4;
  line([[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl],[-hw,-hl]]);
  for(const x of [-sw,sw])line([[x,-hl],[x,hl]]);
  for(const z of [-service,service])line([[-sw,z],[sw,z]]);
  line([[0,-service],[0,service]]);
  for(const z of [-hl,hl])line([[0,z],[0,z-Math.sign(z)*.25]]);
  const netHalf=6.4,segments=24,positions=[],uv=[],indices=[];
  const top=t=>1.07-.156*Math.sin(Math.PI*t);
  for(let i=0;i<=segments;i++){
    const t=i/segments,[x,z]=point(-netHalf+2*netHalf*t,0),y=grade(x,z)+lift;
    positions.push(x,y+.10,z,x,y+top(t),z);uv.push(t*160,0,t*160,12);
    if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+2,a+3,a+1);}
  }
  const ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));ng.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));ng.setIndex(indices);ng.computeVertexNormals();add(ng,meshNet(),'tennis-net',true);
  const poles=[];
  for(const u of [-netHalf,netHalf]){const [x,z]=point(u,0),base=grade(x,z)-.06,topY=grade(x,z)+lift+1.12;const pole=box(.11,topY-base,.11,0x375548,x,(base+topY)/2,z);pole.name='tennis-net-post';pole.userData.streamCoarse=true;root.add(pole);poles.push({x,z,base,top:topY});}
  for(let i=0;i<segments;i++){
    const t=i/segments,q=(i+1)/segments,[x,z]=point(-netHalf+2*netHalf*t,0),[xx,zz]=point(-netHalf+2*netHalf*q,0);
    const a=new THREE.Vector3(x,grade(x,z)+lift+top(t),z),b=new THREE.Vector3(xx,grade(xx,zz)+lift+top(q),zz),delta=b.clone().sub(a);
    const tape=box(.045,delta.length(),.045,0xebe8d9);tape.position.copy(a.add(b).multiplyScalar(.5));tape.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());tape.name='tennis-net-tape';tape.userData.streamCoarse=true;root.add(tape);
  }
  // End screens rise above the baseline. Sideline rails remain low, as in
  // Chautauqua's tournament photograph; inner side gates open beside the net.
  const fence=(points,height)=>{const f=buildPerimeter({pts:points,height,color:'#365548',style:'chain_link'},(x,z)=>grade(x,z)+lift);f.name='tennis-fence';f.traverse(o=>{if(o.isMesh)o.userData.streamCoarse=true;});root.add(f);};
  if(feature.tennis.fence!==false && !rectangular) {
    fence([pts[7],pts[0],pts[1],pts[2]],3.0);fence([pts[3],pts[4],pts[5],pts[6]],3.0);
    for(const [a,b,side] of [[pts[2],pts[3],'east'],[pts[6],pts[7],'west']]){
      if(feature.tennis.gateSide!==side){fence([a,b],1.15);continue;}
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),t=.5-.75/length,q=.5+.75/length;
      fence([a,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]],1.15);fence([[a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q],b],1.15);
    }
  }
  root.userData.tennis={center:[cx,cz],padBounds:[x0,z0,x1,z1],poles,netHeightCenter:.914,netHeightEnds:1.07,gateSide:feature.tennis.gateSide};
  return root;
}
