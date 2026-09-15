import * as THREE from 'three';
import { createDioramaOutline, clipDioramaGeometry, clipDioramaObject, outlineBoundaryEdges,
  applyDioramaOutline } from '../../../src/diorama-outline.js';
import { bakeMobile } from '../../../src/bake.js';
import { packSceneJSON,unpackSceneJSON } from '../../../src/stream-format.js';
import { partitionSurface } from '../../../src/surface-lod.js';

const check=(condition,message)=>{if(!condition)throw new Error(message);};
const record={pts:[[-4,-4],[4,-4],[4,0],[0,0],[0,4],[-4,4]]};
function insideGeometry(geometry,outline) {
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++)check(outline.contains(p.getX(i),p.getZ(i)),`Geometry escapes boundary: ${p.getX(i)},${p.getZ(i)}`);
}

export async function checkDioramaOutline() {
  const outline=createDioramaOutline(record);
  check(outline.contains(-2,2) && !outline.contains(2,2),'Concave membership');
  const source=new THREE.PlaneGeometry(12,12,12,12);source.rotateX(-Math.PI/2);
  const p=source.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,.1*p.getX(i)+.2*p.getZ(i));
  source.computeVertexNormals();
  source.setAttribute('color',new THREE.Uint8BufferAttribute(Array.from({length:p.count*3},(_,i)=>i%3===0?200:100),3,true));
  const original=source.attributes.position.array.slice();
  const clipped=clipDioramaGeometry(source,outline);insideGeometry(clipped,outline);
  check(source.attributes.position.array.every((v,i)=>v===original[i]),'Clipping mutated shared source geometry');
  const c=clipped.attributes.color,n=clipped.attributes.normal,cp=clipped.attributes.position;
  for(let i=0;i<cp.count;i++) {
    check(Math.abs(cp.getY(i)-.1*cp.getX(i)-.2*cp.getZ(i))<1e-5,'Clipping changed graded height');
    check(Math.abs(c.getX(i)-200/255)<1e-6,'Normalized vertex colors did not interpolate');
    check(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'Interpolated normals not unit length');
  }
  let area=0;
  for(let i=0;i<clipped.index.count;i+=3) {
    const ids=[0,1,2].map(k=>clipped.index.getX(i+k)),a=ids.map(id=>[cp.getX(id),cp.getZ(id)]);
    area+=Math.abs((a[1][0]-a[0][0])*(a[2][1]-a[0][1])-(a[1][1]-a[0][1])*(a[2][0]-a[0][0]))/2;
  }
  check(Math.abs(area-48)<1e-5,`Concave clipped area is ${area}, expected 48`);
  const edges=outlineBoundaryEdges(clipped,outline);
  const perimeter=edges.reduce((sum,[a,b])=>sum+Math.hypot(a[0]-b[0],a[2]-b[2]),0);
  check(Math.abs(perimeter-32)<1e-5,`Ground skirt perimeter is ${perimeter}, expected 32`);
  const attributes=Object.fromEntries(Object.entries(clipped.attributes).map(([key,a])=>[key,{array:a.array,itemSize:a.itemSize,normalized:a.normalized}]));
  const tiles=partitionSurface(attributes,clipped.index.array,{cellSize:2,step:1,heightAt:(x,z)=>.1*x+.2*z});
  for(const tile of tiles)for(const level of ['detail','coarse']) {
    const a=tile[level].attributes.position.array;
    for(let i=0;i<a.length;i+=3)check(outline.contains(a[i],a[i+2]),`Stream ${level} surface escapes outline`);
  }

  // All corners inside does not imply a triangle is inside a nonconvex shape.
  const crossing=new THREE.BufferGeometry();crossing.setAttribute('position',new THREE.Float32BufferAttribute([-3,0,3,3,0,-3,-3,0,-3],3));
  const cut=clipDioramaGeometry(crossing,outline);insideGeometry(cut,outline);
  check(cut.index.count>3,'Concavity crossing was not split');
  const shared=new Map();
  for(const face of outline.triangles)for(let i=0;i<3;i++) {
    const edge=[face.pts[i],face.pts[(i+1)%3]],key=edge.map(p=>p.join(',')).sort().join(':');
    shared.set(key,{edge,count:(shared.get(key)?.count||0)+1});
  }
  const [va,vb]=[...shared.values()].find(e=>e.count===2).edge;
  const vertical=new THREE.BufferGeometry();vertical.setAttribute('position',new THREE.Float32BufferAttribute([
    va[0],0,va[1],vb[0],0,vb[1],vb[0],2,vb[1],va[0],0,va[1],vb[0],2,vb[1],va[0],2,va[1]],3));
  const wall=clipDioramaGeometry(vertical,outline),wp=wall.attributes.position;
  let wallArea=0;const v3=new THREE.Vector3(),a3=new THREE.Vector3(),b3=new THREE.Vector3();
  for(let i=0;i<wall.index.count;i+=3) {
    v3.fromBufferAttribute(wp,wall.index.getX(i));a3.fromBufferAttribute(wp,wall.index.getX(i+1)).sub(v3);b3.fromBufferAttribute(wp,wall.index.getX(i+2)).sub(v3);
    wallArea+=a3.cross(b3).length()/2;
  }
  check(Math.abs(wallArea-2*Math.hypot(vb[0]-va[0],vb[1]-va[1]))<1e-5,'Vertical face duplicated at internal outline triangulation edge');

  const root=new THREE.Group(),ground=new THREE.Mesh(source,new THREE.MeshStandardMaterial({vertexColors:true}));ground.name='ground';root.add(ground);
  for(const name of ['ground-skirt','ground-bottom']){const m=new THREE.Mesh(new THREE.BoxGeometry(12,1,12));m.name=name;root.add(m);}
  const model=new THREE.Group();model.position.set(1,0,0);
  model.add(new THREE.Mesh(new THREE.BoxGeometry(6,2,6),new THREE.MeshStandardMaterial()));root.add(model);
  const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshStandardMaterial(),3);
  [[-2,-2],[2,2],[3.99,-2]].forEach(([x,z],i)=>instances.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,1,z)));
  root.add(instances);
  const waterMaterial=new THREE.MeshStandardMaterial();waterMaterial.userData.surface='water';
  const water=new THREE.Mesh(new THREE.PlaneGeometry(10,10),waterMaterial);water.geometry.rotateX(-Math.PI/2);water.position.y=2;root.add(water);
  applyDioramaOutline(root,outline,{bottom:-5,heightAt:(x,z)=>.1*x+.2*z,topColor:new THREE.Color('tan'),bottomColor:new THREE.Color('brown'),
    skirtMaterial:new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide}),bottomMaterial:new THREE.MeshStandardMaterial()});
  check(instances.count===1,'Boundary instance was not removed whole');
  check(root.getObjectByName('diorama-water-edge'),'Lake cut edge missing');
  check(root.getObjectByName('ground-bottom').geometry.type==='ExtrudeGeometry','Rectangular base was retained');
  check(root.getObjectByName('ground-skirt').userData.streamBase,'Ground skirt must remain in streamed base');
  root.updateMatrixWorld(true);
  root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)insideGeometry(o.geometry.clone().applyMatrix4(o.matrixWorld),outline);});

  // The emitted static geometry survives the same bake and binary pack used by
  // stream export, without any shader clipping state in the loaded scene.
  const baked=await bakeMobile(root),packed=packSceneJSON(baked.toJSON());
  const restored=new THREE.ObjectLoader().parse(unpackSceneJSON(await packed.arrayBuffer()));restored.updateMatrixWorld(true);
  let meshes=0;restored.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh){insideGeometry(o.geometry.clone().applyMatrix4(o.matrixWorld),outline);meshes++;}});
  check(meshes>0,'Stream round trip is empty');
  check(clipDioramaGeometry(source,null)===source,'Sites without outline must retain original geometry');
  return {area,perimeter,boundarySegments:edges.length,streamMeshes:meshes};
}
