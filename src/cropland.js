// Surveyed field soil shares the terrain triangulation and streams independently
// of the corn, so both nearby row gaps and distant fields stay brown.
import * as THREE from 'three';
import { drapeTriangles } from './landmark-drape.js';
import { surfaceMaterial } from './materials.js';

export function buildCroplandSurface(feature,grade=()=>0,grid=null) {
  const shape=new THREE.Shape(feature.pts.map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const hole of feature.holes||[])shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));
  const outline=new THREE.ShapeGeometry(shape),p=outline.attributes.position;
  const data=drapeTriangles(Array.from({length:p.count},(_,i)=>[p.getX(i),-p.getY(i)]),Array.from(outline.index.array),grade,grid,.065);
  outline.dispose();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  geometry.setIndex(data.indices);geometry.computeVertexNormals();
  // Field coordinates keep furrows aligned with each plot's planting direction
  // even after differently rotated plots are merged into a shared draw call.
  const {angle=0,rowSpacing=.8}=feature.crop||{},c=Math.cos(angle),s=Math.sin(angle),uv=[];
  for(let i=0;i<data.positions.length;i+=3) {
    const x=data.positions[i],z=data.positions[i+2];
    uv.push((x*c-z*s)/Math.max(.8,rowSpacing),x*s+z*c);
  }
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const mesh=new THREE.Mesh(geometry,surfaceMaterial('plowed',feature.soilColor||'#79573c'));
  mesh.name='landmark-surface';mesh.userData.source=feature.source;
  return mesh;
}
