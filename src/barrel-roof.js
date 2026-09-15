import * as THREE from 'three';
import { mat } from './kit.js';

// Circular-segment roof, canonical ridge along x. A shallow barrel has a
// continuous curved silhouette rather than a gable hidden behind curved trim.
export function buildBarrelRoof(length, span, rise, color, endColor, trimColor) {
  const g=new THREE.Group(), half=span/2, radius=(half*half+rise*rise)/(2*rise), count=32;
  const profile=Array.from({length:count+1},(_,i)=>{
    const z=-half+span*i/count;
    return [z,Math.sqrt(Math.max(0,radius*radius-z*z))-(radius-rise)];
  });
  const positions=[],indices=[];
  for(const [z,y] of profile) positions.push(-length/2,y,z,length/2,y,z);
  for(let i=0;i<count;i++) {const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const roof=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.65,side:THREE.DoubleSide}));roof.name='barrel-roof';roof.userData.streamCoarse=true;g.add(roof);
  const shape=new THREE.Shape(profile.map(([z,y])=>new THREE.Vector2(z,y)));shape.closePath();
  for(const x of [-length/2,length/2]) {
    const end=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat(endColor));end.rotation.y=x<0?-Math.PI/2:Math.PI/2;end.position.x=x;end.name='barrel-roof-end';end.userData.streamCoarse=true;g.add(end);
  }
  const seams=Math.max(2,Math.ceil(length/.8));
  for(let i=0;i<=seams;i++) {
    const x=-length/2+length*i/seams, points=profile.map(([z,y])=>new THREE.Vector3(x,y+.025,z));
    const curve=new THREE.CatmullRomCurve3(points);
    const edge=i===0 || i===seams;
    const seam=new THREE.Mesh(new THREE.TubeGeometry(curve,32,edge ? .065 : .018,4,false),mat(edge ? trimColor : color));
    seam.name='barrel-roof-seam';g.add(seam);
  }
  return g;
}
