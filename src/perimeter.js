import * as THREE from 'three';
import { box, mat } from './kit.js';
import { perimeterPanels } from './perimeter-layout.js';
import { buildVinylFence } from './vinyl-fence.js';

let meshMaterial;
function chainLink() {
  if (meshMaterial) return meshMaterial;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d');c.strokeStyle='#788179';c.lineWidth=5;
  c.beginPath();c.moveTo(0,32);c.lineTo(32,0);c.lineTo(64,32);c.lineTo(32,64);c.closePath();c.stroke();
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(10,7);
  meshMaterial=new THREE.MeshStandardMaterial({map:texture,alphaTest:.35,side:THREE.DoubleSide,roughness:.9});
  return meshMaterial;
}
export function buildPerimeter(feature, grade) {
  if (feature.style === 'vinyl') return buildVinylFence(feature, grade);
  const root=new THREE.Group();root.name='institution-perimeter';
  const h=feature.height ?? 2.15, color=feature.color ?? '#555e54', posts=new Set();
  const panels=perimeterPanels(feature.pts,feature.openings);
  for(const [a,b] of panels) {
    const ya=grade(...a),yb=grade(...b),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([a[0],ya+.08,a[1],b[0],yb+.08,b[1],b[0],yb+h,b[1],a[0],ya+h,a[1]],3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,length/3,0,length/3,1,0,1],2));
    geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
    if(feature.style==='pickets') {
      const count=Math.ceil(length/.3);
      for(let i=1;i<count;i++) {
        const t=i/count,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        root.add(box(.045,h,.045,color,x,grade(x,z)+h/2,z));
      }
      geometry.dispose();
    } else {
      const panel=new THREE.Mesh(geometry,feature.style==='wall'?mat(feature.color ?? '#b8ad91'):chainLink());
      panel.name='perimeter-panel';root.add(panel);
    }
    for(const p of [a,b]) {
      const key=p.map(v=>v.toFixed(3)).join(',');if(posts.has(key))continue;posts.add(key);
      const post=box(.12,h+.2,.12,color,p[0],grade(...p)+h/2,p[1]);post.name='perimeter-post';root.add(post);
    }
    if(feature.style!=='wall') {
      for(const rise of feature.style==='pickets'?[.15,h]:[h]) {
        const start=new THREE.Vector3(a[0],ya+rise,a[1]),end=new THREE.Vector3(b[0],yb+rise,b[1]),dir=end.clone().sub(start);
        const rail=box(.06,dir.length(),.06,color);rail.position.copy(start.add(end).multiplyScalar(.5));
        rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());root.add(rail);
      }
    }
  }
  return root;
}
