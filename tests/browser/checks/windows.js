import * as THREE from 'three';
import { buildBlueprint } from '../../../src/blueprint.js';
import { makeRng } from '../../../src/rng.js';

// Measure the generated frame along normals to the glass boundary. Tall
// arched windows used to taper dramatically at the bottom of their jambs.
export function checkWindowFrames() {
  let samples = 0;
  for (const [type, w, h] of [['arch', 0.8, 2.9], ['arch', 1, 2.7], ['rect', 1.1, 2.4],
    ['round', 1.2, 1.2], ['gothic', 1.2, 2.6], ['shop', 3, 2.4], ['basement', 1.2, 0.7]]) {
    const frameW = 0.14;
    const root = buildBlueprint(makeRng('window-frame'), {obb: {cx: 0, cz: 0, angle: 0}}, {
      volumes: [{u: [-3, 3], v: [-2, 2], height: 6, cornice: {dentils: false},
        faces: {'-v': {storeys: [{y: 2, windows: {type, w, h, frameW, at: [0.5], mullions: false, sill: false}}]}}}],
    }, 0, []);
    const window = root.children[0].children.find(o => o.isGroup);
    const [frame, glass] = window.children;
    for (const mesh of [frame, glass]) {
      for (const name of ['position', 'normal']) {
        if (![...mesh.geometry.attributes[name].array].every(Number.isFinite)) throw new Error(`${type}: non-finite ${name}`);
      }
    }
    // Probe the real extruded silhouette in its local coordinates, without
    // depending on its placement in the facade or the camera's viewpoint.
    const probe = new THREE.Mesh(frame.geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
    const points = glass.geometry.parameters.shapes.getPoints();
    const ray = new THREE.Raycaster();
    ray.set(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,1));
    if(ray.intersectObject(probe).length) throw new Error(`${type}: frame blocks its glass opening`);
    frame.geometry.computeBoundingBox(); glass.geometry.computeBoundingBox();
    if(frame.geometry.boundingBox.min.z >= glass.geometry.boundingBox.min.z + glass.position.z) {
      throw new Error(`${type}: glass must be recessed behind the frame`);
    }
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (length < 1e-8) continue; // duplicate gothic apex
      const normal = new THREE.Vector3(dy / length, -dx / length, 0);
      const middle = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      ray.set(middle.addScaledVector(normal, frameW + 0.2), normal.clone().negate());
      const hit = ray.intersectObject(probe)[0];
      const thickness = frameW + 0.2 - (hit?.distance ?? Infinity);
      if (Math.abs(thickness - frameW) > 1e-5) {
        throw new Error(`${type} edge ${i}: frame width ${thickness}, expected ${frameW}`);
      }
      samples++;
    }
    probe.material.dispose();
  }
  return samples;
}

export function checkOrnamentalWindows() {
  let openings = 0;
  for (const [type, tracery, w, h, count] of [['round', 'rose', 4, 4, 7], ['gothic', 'quatrefoil', 1.45, 1.8, 1]]) {
    const root = buildBlueprint(makeRng('tracery'), {obb: {cx: 0, cz: 0, angle: 0}}, {
      volumes: [{u: [-3, 3], v: [-2, 2], height: 6,
        faces: {'-v': {storeys: [{y: 1, windows: {type, tracery, w, h, at: [0.5], sill: false}}]}}}],
    }, 0, []);
    let plate, pane;
    root.traverse(o => {
      if (o.name === 'window-tracery') plate = o;
      if (o.material?.userData.surface === 'shop') pane = o;
    });
    if (!plate || !pane) throw new Error('Ornamental windows need stone tracery and unobstructed glass');
    const holes = plate.geometry.parameters.shapes.holes;
    if (holes.length !== count) throw new Error(`${tracery}: expected ${count} glass openings`);
    const material = new THREE.MeshBasicMaterial({side: THREE.DoubleSide});
    const probe = new THREE.Mesh(plate.geometry, material), ray = new THREE.Raycaster();
    for (const hole of holes) {
      const pts = hole.getPoints().slice(0, -1);
      const center = pts.reduce((s, p) => s.add(p), new THREE.Vector2()).multiplyScalar(1 / pts.length);
      // Check a disk inside every lobe, not only the center of each opening.
      for (const p of [center, ...pts.map(p => p.clone().lerp(center, 0.15))]) {
        ray.set(new THREE.Vector3(p.x, p.y, -1), new THREE.Vector3(0, 0, 1));
        if (ray.intersectObject(probe).length) throw new Error(`${tracery}: stone obstructs a glass opening`);
      }
      openings++;
    }
    ray.set(new THREE.Vector3(0, h / 2 - 0.08, -1), new THREE.Vector3(0, 0, 1));
    if (!ray.intersectObject(probe).length) throw new Error(`${tracery}: missing stone around the openings`);
    if (![...plate.geometry.attributes.position.array].every(Number.isFinite)) throw new Error('Non-finite tracery');
    material.dispose();
  }
  return openings;
}
