import * as THREE from 'three';
import {generateSite} from '../../../src/site.js';
import {buildRailways} from '../../../src/railways.js';
import {buildCroplandSurface} from '../../../src/cropland.js';
import {terrainGrid} from '../../../src/terrain-grid.js';

// These narrow diagonal strips fall between vertices of the 12 m terrain
// grid and outside the dense downtown pavement grid.
export async function checkRuralSurfaces() {
  const road = {id: 1, class: 'service', width: 4, pts: [[520,505],[585,550]]};
  const walk = {id: 2, class: 'footway', foot: 'sidewalk', width: 1.8, pts: [[520,515],[585,560]]};
  const rail = {id: 3, kind: 'rail', width: 4, pts: [[520,530],[585,575]]};
  const field={id:'soil-test',kind:'cropland',closed:true,pts:[[520,563],[523,558],[584,581],[581,587]],crop:{angle:1.2}};
  const geometries = new Map();
  await generateSite({name: 'rural-surface-test', size: {w: 1200, h: 1200},
    terrain: {x0: -600, x1: 600, z0: -600, z1: 600, cols: 2, rows: 2, values: [0,0,0,0]},
    roads: [road,walk], linear_features: [rail], landmarks:[field], buildings: [], areas: [], pois: [], extras: []},
  'rural-surfaces', {surfacesOnly: true, onSurface: (name, geo) => geometries.set(name, geo)});
  const material = new THREE.MeshBasicMaterial();
  const meshes = Object.fromEntries([...geometries].map(([name, geo]) => [name, new THREE.Mesh(geo, material)]));
  // Raycast only terrain triangles near the strips, keeping their original
  // vertices. Scanning the whole regional mesh for each probe is expensive.
  const ground = geometries.get('ground'), p = ground.attributes.position, nearby = [];
  for (let i = 0; i < ground.index.count; i += 3) {
    const ids = [0,1,2].map(j => ground.index.getX(i+j));
    const xs = ids.map(j => p.getX(j)), zs = ids.map(j => p.getZ(j));
    if (Math.max(...xs) >= 518 && Math.min(...xs) <= 587 && Math.max(...zs) >= 503 && Math.min(...zs) <= 590) nearby.push(...ids);
  }
  const groundProbe = new THREE.BufferGeometry().setAttribute('position', p).setIndex(nearby);
  meshes.ground = new THREE.Mesh(groundProbe, material);
  const railway = buildRailways([rail], {grade: () => 0,
    roadDistance: geometries.get('asphalt').userData.distanceAt, W: 1200, H: 1200});
  const ballast = railway.getObjectByName('railway-ballast');
  const soil=buildCroplandSurface(field,()=>0,terrainGrid(1200,1200));
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0,-1,0));
  const height = (mesh, x, z) => {
    ray.ray.origin.set(x, 1, z);
    return ray.intersectObject(mesh)[0]?.point.y;
  };
  let samples = 0;
  try {
    for (const [feature, mesh] of [[road,meshes.asphalt],[walk,meshes.pavement],[rail,ballast],[{kind:'cropland',pts:[[522,561],[582,584]]},soil]]) {
      const [a,b] = feature.pts, length = Math.hypot(b[0]-a[0], b[1]-a[1]);
      const dx = (b[0]-a[0])/length, dz = (b[1]-a[1])/length;
      for (let d = 2.1; d < length-2; d += 1.7) for (const side of [-0.35,0,0.35]) {
        const x = a[0]+dx*d-dz*side, z = a[1]+dz*d+dx*side;
        const surface = height(mesh,x,z), ground = height(meshes.ground,x,z);
        if (surface === undefined) throw new Error(`Rural ${feature.kind || feature.class} has a gap at ${x},${z}`);
        if (!(surface-ground > 0.025)) throw new Error(`Grass breaks through rural ${feature.kind || feature.class} at ${x},${z}`);
        samples++;
      }
    }
    return samples;
  } finally {
    for (const geo of geometries.values()) geo.dispose();
    groundProbe.dispose();
    soil.geometry.dispose();
    material.dispose();
    railway.traverse(o => {o.geometry?.dispose(); o.material?.dispose();});
  }
}
