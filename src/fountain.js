// Square memorial fountain: an open basin, carved pylon, and four fish jets.
import * as THREE from 'three';
import { box, rbox, mat } from './kit.js';
import { surfaceMaterial } from './materials.js';
import { ALLEGORIES, buildAllegory, buildInscription, buildPalmette } from './fountain-relief.js';
import { buildFountainFish } from './fountain-fish.js';

// Three scooped channels across each narrow pilaster face. The carved surface
// stands just proud of its backing, so the flutes remain real shaded geometry.
function flutedPilaster(width, height, stone) {
  const positions=[],indices=[],steps=48;
  for(let i=0;i<=steps;i++) {
    const x=(i/steps-.5)*width;
    let z=.085;
    for(const center of [-.31,0,.31]) {
      const distance=(x/width-center)/.105;
      if(Math.abs(distance)<1) z-=.028*Math.sqrt(1-distance*distance);
    }
    positions.push(x,-height/2,z,x,height/2,z);
    if(i<steps) {const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,mat(stone));mesh.name='fountain-fluted-pilaster';return mesh;
}

// Compact underwater fixtures sit below the fish mouths and wash the carved
// pillar from the four corners. The lens is also a serializable light anchor:
// retaining that small mesh preserves its aim through both scenery bakes.
function fishUplight(x,z,basin,targetHeight) {
  const root=new THREE.Group();root.name='fountain-fish-uplight';
  const position=new THREE.Vector3(x*.91,basin+.19,z*.91);
  const target=new THREE.Vector3(0,targetHeight,0),direction=target.clone().sub(position).normalize();
  const housing=new THREE.Mesh(new THREE.CylinderGeometry(.108,.108,.15,12),mat('#4c5149',{roughness:.52,metalness:.45}));
  housing.name='fountain-uplight-housing';housing.position.copy(position);
  housing.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
  housing.userData.streamCoarse=true;root.add(housing);
  const material=mat('#eee1bc',{emissive:'#ffdba0',emissiveIntensity:0,roughness:.25});
  material.userData.nightEmission={day:0,night:2.6};
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.084,12),material);
  lens.name='fountain-uplight-lens';lens.position.copy(position).addScaledVector(direction,.077);
  lens.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
  lens.userData.keep=true;lens.userData.streamCoarse=true;lens.userData.castShadow=false;
  lens.userData.nightSpotlight={color:'#ffdba0',intensity:90,distance:11,angle:.46,penumbra:.65,
    target:[0,0,lens.position.distanceTo(target)]};
  root.add(lens);return root;
}

export function buildFountain(obb, spec = {}) {
  const root = new THREE.Group(); root.name = 'memorial-fountain';
  const w = obb.w, d = obb.d, rim = spec.rimWidth ?? .42;
  const basin = spec.basinHeight ?? .68, height = spec.height ?? 4;
  const stone = spec.stoneColor ?? '#d7d1bd', brick = spec.brickColor ?? '#995f4b';
  const water = spec.waterColor ?? '#84b9b5', tower = spec.pylonWidth ?? 1.65;
  const masonry = surfaceMaterial('brick', brick);
  const add = (mesh, name) => { mesh.name = name; root.add(mesh); return mesh; };
  add(rbox(w, .22, d, stone, .06, 0, -.08, 0), 'fountain-footing');
  // Four separate walls leave the pool open. Coping overhangs the brickwork.
  for (const side of [-1, 1]) {
    add(box(w, basin, rim, brick, 0, basin / 2, side * (d - rim) / 2), 'fountain-basin-wall').material = masonry;
    add(box(rim, basin, d - 2 * rim, brick, side * (w - rim) / 2, basin / 2, 0), 'fountain-basin-wall').material = masonry;
    add(rbox(w + .12, .14, rim + .16, stone, .04, 0, basin, side * (d - rim) / 2), 'fountain-coping');
    add(rbox(rim + .16, .14, d - 2 * rim, stone, .04, side * (w - rim) / 2, basin, 0), 'fountain-coping');
  }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(w - 2 * rim, d - 2 * rim), mat(water, {roughness: .24, metalness: .12}));
  pool.rotation.x = -Math.PI / 2; pool.position.y = basin - .16;
  add(pool, 'fountain-water');
  add(rbox(tower + .65, .35, tower + .65, stone, .06, 0, basin + .015, 0), 'fountain-pedestal');
  const bottom = basin + .19, top = height - .5, shaft = top - bottom;
  add(rbox(tower, shaft, tower, stone, .05, 0, bottom + shaft / 2, 0), 'fountain-pylon');
  const shoulder=new THREE.Mesh(new THREE.CylinderGeometry(tower/Math.SQRT2,(tower+.5)/Math.SQRT2,.2,4),mat(stone));
  shoulder.rotation.y=Math.PI/4;shoulder.position.y=bottom+.07;add(shoulder,'fountain-pedestal-shoulder');
  add(rbox(tower+.18,.24,tower+.18,stone,.025,0,top-.035,0),'fountain-carved-frieze');
  for (let i = 0; i < 3; i++) {
    const span = tower + .22 - i * .16;
    add(rbox(span, .17, span, stone, .035, 0, top + .085 + i * .16, 0), 'fountain-stepped-cap');
  }
  // Face order keeps Art adjacent to Religion as in the supplied corner view.
  // Each allegory has a separate pose, attribute, and inscription on its base.
  for (let side = 0; side < 4; side++) {
    const face = new THREE.Group();face.name='fountain-carved-face';face.userData.allegory=ALLEGORIES[side];
    face.add(buildAllegory(ALLEGORIES[side],stone,tower,shaft,bottom));
    const inscription=buildInscription(ALLEGORIES[side],tower+.26,.155,new THREE.Color(stone).multiplyScalar(.43));
    inscription.position.set(0,basin+.005,(tower+.65)/2+.004);face.add(inscription);
    for(const sign of [-1,1]) {
      const x=sign*(tower/2-.072),h=shaft-.25,y=bottom+.09+h/2;
      const backing=rbox(tower*.145,h,.075,stone,.018,x,y,tower/2+.012);
      backing.name='fountain-corner-pilaster';face.add(backing);
      const flutes=flutedPilaster(tower*.145,h-.04,stone);flutes.position.set(x,y,tower/2);face.add(flutes);
    }
    for(let i=-3;i<=3;i++) {
      const palmette=buildPalmette(stone);palmette.position.set(i*tower*.132,top-.035,(tower+.18)/2+.006);face.add(palmette);
    }
    face.rotation.y=side*Math.PI/2;root.add(face);
  }
  if (spec.jets !== false) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - rim - .65), z = sz * (d / 2 - rim - .65);
    add(rbox(.9, .22, .9, stone, .05, x, basin + .06, z), 'fountain-fish-plinth');
    const fish = buildFountainFish(stone,Math.hypot(x,z)*.09);
    fish.position.set(x, basin + .17, z); fish.rotation.y = Math.atan2(-x, -z); root.add(fish);
    root.add(fishUplight(x,z,basin,bottom+shaft*.57));
    const a = new THREE.Vector3(x * .91, basin + .5, z * .91);
    const b = new THREE.Vector3(x * .68, basin + .95, z * .68);
    const c = new THREE.Vector3(x * .39, basin - .13, z * .39);
    const jet = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, b, c), 16, .028, 5, false), mat('#bbd9d4', {roughness: .25}));
    add(jet, 'fountain-jet');
  }
  const structural=new Set(['fountain-footing','fountain-basin-wall','fountain-coping','fountain-water',
    'fountain-pedestal','fountain-pylon','fountain-pedestal-shoulder','fountain-carved-frieze',
    'fountain-stepped-cap','fountain-fish-plinth']);
  root.traverse(o => { if (o.isMesh) {
    // Coarse scenery must remain a complete fountain while detail is absent.
    // Reuse the structural meshes; the sector switch shows only one version.
    if(structural.has(o.name))o.userData.streamCoarse=true;
    o.castShadow = o.name !== 'fountain-water' && o.name !== 'fountain-jet' && o.userData.castShadow !== false; o.receiveShadow = true;
  } });
  return root;
}
