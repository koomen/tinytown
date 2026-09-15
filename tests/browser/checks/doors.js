import * as THREE from 'three';
import { buildBlueprint } from '../../../src/blueprint.js';
import { makeRng } from '../../../src/rng.js';

// Probe the actual mesh against the intended transom/fanlight silhouette.
// A crossed outline used to leave half of rectangular transoms unfilled.
export function checkDoorHeads() {
  let samples = 0;
  const cases = [
    ['rect', 1.2, 2.5, true], ['double', 1.8, 2.7, true],
    ['arch', 1.4, 2.6, true], ['gothic', 1.2, 2.6, true],
    ['gothic', 3, 2, true], ['rect', 1.2, 2.5, 'dark'], ['arch', 1.4, 2.6, false],
  ];
  for (const [type, w, h, fanlight] of cases) {
    const root = buildBlueprint(makeRng('door-head'), {obb: {cx: 0, cz: 0, angle: 0}}, {
      volumes: [{u: [-3, 3], v: [-2, 2], height: 6, cornice: {dentils: false},
        faces: {'-v': {doors: [{type, w, h, fanlight, lamp: false, at: 0.5}]}}}],
    }, 0, []);
    const door = root.children[0].children.find(o => o.isGroup).children[0];
    const head = door.children[2];
    for (const name of ['position', 'normal']) {
      if (![...head.geometry.attributes[name].array].every(Number.isFinite)) throw new Error(`${type}: non-finite ${name}`);
    }
    const points = head.geometry.parameters.shapes.getPoints();
    for (let i = 1; i < points.length; i++) {
      if (points[i].distanceTo(points[i - 1]) < 1e-8) throw new Error(`${type}: zero-length head edge`);
    }
    const height = type === 'arch' ? w / 2 : type === 'gothic' ? Math.min(0.866 * w, h * 0.55) : 0.4;
    const springY = h / 2 - height;
    const top = x => type === 'arch' ? Math.sqrt(Math.max(0, (w / 2) ** 2 - x * x))
      : type === 'gothic' ? Math.sqrt(Math.max(0, w * w - (Math.abs(x) + w / 2) ** 2)) * height / (0.866 * w)
      : height;
    const probe = new THREE.Mesh(head.geometry, new THREE.MeshBasicMaterial());
    const ray = new THREE.Raycaster();
    for (let ix = 0; ix < 23; ix++) {
      for (let iy = 0; iy < 19; iy++) {
        const x = ((ix + 0.37) / 23 * 1.2 - 0.6) * w;
        const y = ((iy + 0.41) / 19 * 1.2 - 0.1) * height;
        // Curves are polygonal approximations; avoid their narrow boundary band.
        if (Math.abs(y - top(x)) < height * 0.02) continue;
        const inside = Math.abs(x) < w / 2 && y > 0 && y < top(x);
        ray.set(new THREE.Vector3(x, springY + y, -1), new THREE.Vector3(0, 0, 1));
        const hits = ray.intersectObject(probe);
        if (hits.length !== (inside ? 1 : 0)) {
          throw new Error(`${type} fanlight=${fanlight} at (${x}, ${y}): ${hits.length} faces, expected ${inside ? 1 : 0}`);
        }
        samples++;
      }
    }
    probe.material.dispose();
  }
  return {samples, cases: cases.length};
}
