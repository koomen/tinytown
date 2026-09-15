// Photo-grounded Avon High School entrance furniture. The sign lettering is
// drawn locally and survives the same CanvasTexture bake as blueprint signs.
import * as THREE from 'three';
import {box, mat, buildBush, buildTree} from './kit.js';
import {makeRng} from './rng.js';
import {surfaceMaterial} from './materials.js';
import {buildOrnamentalPaving} from './ornamental-paving.js';
import {AVON_EMBLEM_IMAGE,loadAvonEmblem} from './avon-emblem.js';

const schoolSignMaterials=new Map();
function lettering(image=AVON_EMBLEM_IMAGE) {
  if (schoolSignMaterials.has(image)) return schoolSignMaterials.get(image);
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = 768;
  const c = canvas.getContext('2d');
  c.fillStyle = '#dedfd0'; c.fillRect(0, 0, 1536, 768);
  c.strokeStyle = '#a9b5a0'; c.lineWidth = 9; c.strokeRect(28, 26, 1480, 716);
  c.fillStyle = '#41604b'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'bold 117px Georgia, serif'; c.fillText('AVON HIGH SCHOOL', 768, 141, 1415);
  c.font = 'bold 88px Georgia, serif'; c.fillText('HOME OF THE', 952, 351, 900);
  c.font = 'bold 139px Georgia, serif'; c.fillText('BRAVES', 952, 492, 915);
  c.strokeStyle = '#98a68f'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(95,645); c.lineTo(1441,645); c.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'avon-high-school-home-of-the-braves';
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const schoolSignMaterial = new THREE.MeshStandardMaterial({map:texture, roughness:.94});
  schoolSignMaterial.name = 'avon-high-school-sign-lettering';
  schoolSignMaterial.userData.emblemImage=image;
  loadAvonEmblem(emblem=>{c.drawImage(emblem,95,262,330,330*emblem.height/emblem.width);texture.needsUpdate=true;},image);
  schoolSignMaterials.set(image,schoolSignMaterial);
  return schoolSignMaterial;
}

function frame(feature, grade) {
  const [x,z] = feature.pts[0], angle = feature.angle || 0;
  const world = (u,v) => [x + Math.cos(angle)*u + Math.sin(angle)*v,
    z - Math.sin(angle)*u + Math.cos(angle)*v];
  return {x,z,angle,world,height:(u,v)=>grade(...world(u,v))};
}

export function buildSchoolSign(feature, grade = () => 0) {
  const root = new THREE.Group(); root.name = 'avon-high-school-monument-sign';
  const f = frame(feature,grade), base = grade(f.x,f.z);
  root.position.set(f.x,base,f.z); root.rotation.y = f.angle;
  for (const u of [-1.98,1.98]) {
    const bottom = f.height(u,0)-base-.12;
    const pier = box(.90,2.75-bottom,.80,'#955e4d',u,(2.75+bottom)/2,0);
    pier.material = surfaceMaterial('brick','#955e4d');
    pier.name = 'school-sign-brick-pier'; root.add(pier);
    const cap = box(1.01,.13,.91,'#b8b9a7',u,2.80,0);
    cap.name = 'school-sign-stone-cap'; root.add(cap);
  }
  root.add(box(3.09,1.89,.18,'#dedfd0',0,1.71,0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.06,1.86),lettering(feature.image));
  face.position.set(0,1.71,.096); face.name = 'school-sign-lettered-front'; root.add(face);
  const rng = makeRng('avon-high-school-sign-shrubs');
  for (const u of [-3.1,-1.45,0,1.45,3.1]) {
    const bush = buildBush(rng); bush.scale.set(1.25,.75,.9);
    bush.position.set(u,f.height(u,-.35)-base,-.35); root.add(bush);
  }
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return root;
}

export function buildSchoolForecourt(feature, grade = () => 0, grid = null) {
  const root = new THREE.Group(); root.name = 'avon-high-school-entrance-garden';
  const f = frame(feature,grade), rng = makeRng('avon-high-school-entry-garden');
  const patch = (id,points,color,surface='paving-stone',lift=.195,sample=grade) => {
    const result = buildOrnamentalPaving({id,pts:points.map(p=>f.world(...p)),closed:true,
      surface,color,lift},sample,grid);
    result.traverse(m=>{if(m.isMesh)m.userData.schoolGroundLift=lift;});
    root.add(result); return result;
  };
  // The porch floor is level while the surrounding terrain rises away from
  // the doors. Meet the threshold across the full landing, then grade the
  // approach down to the terrain-following walk so the slab cannot hide it.
  const threshold=f.height(0,0)+(feature.thresholdLift??.24);
  patch('school-entry-landing',[[-3.6,-.10],[3.95,-.10],[3.95,6.45],[-3.6,6.45]],'#c5c5b4','paving-stone',0,()=>threshold);
  const approachGrade=(x,z)=>{
    const v=Math.sin(f.angle)*(x-f.x)+Math.cos(f.angle)*(z-f.z);
    const t=THREE.MathUtils.clamp((v-6.45)/(8.3-6.45),0,1);
    return THREE.MathUtils.lerp(threshold,grade(x,z)+.195,t);
  };
  patch('school-entry-transition',[[-2.1,6.45],[2.1,6.45],[2.1,8.3],[-2.1,8.3]],'#c5c5b4','paving-stone',0,approachGrade);
  patch('school-central-walk',[[-2.1,8.3],[2.1,8.3],[2.1,35.9],[-2.1,35.9]],'#c5c5b4');
  for(const side of [-1,1]) {
    patch('school-side-court',[[side*2.1,7.75],[side*12.2,7.75],[side*12.2,17.2],[side*2.1,17.2]],'#b6a791','paving-brick');
    patch('school-front-bed',[[side*2.4,17.3],[side*5,17.3],[side*7,26.3],[side*2.4,26.3]],'#594b3c','gravel');
    patch('school-raised-bed',[[side*6.4,9.5],[side*12.2,9.5],[side*12.2,14.5],[side*6.4,14.5]],'#65533e','gravel',.23);
    // Three sides of low pale masonry form the planted outdoor seating bays.
    const walls = [[[side*6.4,9.5],[side*12.2,9.5]],[[side*12.2,9.5],[side*12.2,14.5]],
      [[side*12.2,14.5],[side*8.5,14.5]]];
    for (const [p,q] of walls) {
      const a=f.world(...p),b=f.world(...q),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      const floor=Math.min(grade(...a),grade(...b))-.16, top=Math.max(grade(...a),grade(...b))+.62;
      const wall=box(Math.hypot(b[0]-a[0],b[1]-a[1]),top-floor,.28,'#c1c4b6',mid[0],(top+floor)/2,mid[1]);
      wall.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);wall.name='school-raised-planter-wall';root.add(wall);
    }
    for(const [u,v] of [[3.5,18.5],[4.0,21.3],[4.5,24.3],[8.1,10.6],[10.6,10.7],[10.8,12.9]]) {
      const pos=f.world(side*u,v),bush=buildBush(rng);bush.scale.set(.78,.68,.8);
      bush.position.set(pos[0],grade(...pos)+.21,pos[1]);bush.name='school-entrance-shrub';root.add(bush);
    }
    // These two fixed seeds select young broadleaf trees in the shared kit.
    const p=f.world(side*10.8,18.9),tree=buildTree(makeRng('avon-high-school-deciduous:'+side),{big:false});tree.scale.set(.6,.95,.6);
    tree.position.set(p[0],grade(...p),p[1]);tree.name='school-young-entry-tree';root.add(tree);
    for(const offset of [-.62,.62]) {
      const q=f.world(side*10.8+offset,18.9),stake=box(.06,1.55,.06,'#a2956b',q[0],grade(...q)+.775,q[1]);
      stake.name='school-young-tree-stake';root.add(stake);
    }
    for(const v of [17.1,24.7]) {
      const p=f.world(side*3.3,v),y=grade(...p);
      const post=box(.12,1.15,.12,'#444b42',p[0],y+.575,p[1]);post.name='school-path-bollard';root.add(post);
      root.add(box(.19,.12,.19,'#dedac2',p[0],y+1.1,p[1]));
    }
  }
  // The blueprint flagpole is set into the continuous left paved court.
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return root;
}
