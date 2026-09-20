// One upright, camera-facing sprite per stalk, densely spaced in planted rows.
import * as THREE from 'three';
import { cornSpriteGeometry, cornSpriteMaterial } from './corn-sprites.js';
import { cornfieldRows } from './cornfield-layout.js';

const noise=n=>(Math.sin(n*127.1+311.7)*43758.5453%1+1)%1;

export function buildCornfield(feature,grade=()=>0) {
  const root=new THREE.Group();root.name=`cornfield-${feature.id}`;root.userData.streamKind='landmark';
  const crop=feature.crop||{},height=crop.height||1.9,spacing=crop.rowSpacing||.8;
  let rows=cornfieldRows(feature.pts,{angle:crop.angle,spacing,width:height*.48,headland:.55});
  if(!rows.length)rows=cornfieldRows(feature.pts,{angle:crop.angle,spacing:.8,width:.45,headland:.25});
  if(!rows.length)return root;
  const stalks=[];
  for(const [r,row] of rows.entries()) {
    const length=Math.hypot(row.b[0]-row.a[0],row.b[1]-row.a[1]);
    const count=Math.max(1,Math.floor(length/.28));
    for(let i=0;i<count;i++) {
      const seed=r*7919+i,t=(i+.2+noise(seed)*.6)/count;
      const x=row.a[0]+(row.b[0]-row.a[0])*t,z=row.a[1]+(row.b[1]-row.a[1])*t;
      // Quantized height variation keeps the instance stream small.
      const h=Math.min(height*(.9+Math.floor(noise(seed+37)*7)/30),row.width/.43);
      stalks.push([x,grade(x,z)-.02,z,h]);
    }
  }
  const origin=new THREE.Vector3(
    Math.floor(Math.min(...rows.flatMap(r=>[r.a[0],r.b[0]]))),
    Math.floor(stalks.reduce((min,p)=>Math.min(min,p[1]),Infinity)),
    Math.floor(Math.min(...rows.flatMap(r=>[r.a[1],r.b[1]]))),
  );
  const make=(stride,name)=>{
    const values=[];
    for(let i=0;i<stalks.length;i+=stride) {
      const [x,y,z,h]=stalks[i];values.push(Math.round((x-origin.x)*100),Math.round((y-origin.y)*100),Math.round((z-origin.z)*100),Math.round(h*100));
    }
    // Four compact numbers per plant instead of a sixteen-number matrix.
    const Type=values.some(v=>v>65535)?Float32Array:Uint16Array;
    const mesh=new THREE.Mesh(cornSpriteGeometry(new Type(values)),cornSpriteMaterial());
    mesh.name=name;mesh.position.copy(origin);mesh.userData.keep=true;mesh.userData.castShadow=false;
    // Billboard silhouettes use the ground's AO/focus depth, avoiding the
    // rectangular cards produced by the postprocessing override materials.
    mesh.layers.set(1);root.add(mesh);return mesh;
  };
  const near=make(1,'corn-individual-stalks');near.userData.streamDetailOnly=true;
  // Distant fields keep individual upright plants, at a lower sampling density.
  const far=make(3,'corn-distant-stalks');far.visible=false;far.userData.streamCoarseOnly=true;
  root.userData.corn={rows:rows.length,stalks:stalks.length,triangles:stalks.length*2};
  return root;
}
