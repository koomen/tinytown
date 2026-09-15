// Geometry checks run in Chrome by browser.mjs, against real Three.js meshes.
import * as THREE from 'three';
import { buildBlueprint } from '../../../src/blueprint.js';
import { makeRng } from '../../../src/rng.js';

const assert = (ok, message) => { if (!ok) throw new Error(message); };
const inside = (pts, x, z) => {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
};
const edgeDistance = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
};

export async function checkPolygonBlueprint() {
  const bp = await (await fetch('/data/avon/buildings/248274499/draft.json')).json();
  assert(bp.volumes.length === 1, 'Wadsworth should have one continuous building volume');
  const vol = bp.volumes[0], pts = vol.polygon;
  const frame = { obb: { cx: 0, cz: 0, angle: 0 } };
  const root = buildBlueprint(makeRng('polygon-test'), frame, bp, 0, []);
  root.updateMatrixWorld(true);
  const roof = root.getObjectByName('roof-deck'), cornice = root.getObjectByName('cornice'), walls = root.getObjectByName('walls');
  assert(roof && cornice && walls, 'polygon wall, roof, and cornice meshes exist');
  root.traverse(o => {
    if (o.geometry) for (const name of ['position', 'normal']) {
      assert([...o.geometry.attributes[name].array].every(Number.isFinite), `finite ${name} on ${o.name}`);
    }
  });
  const ray = new THREE.Raycaster();
  let interior = 0, exterior = 0;
  for (let u = -12.35; u < 12; u += 0.7) for (let v = -13.27; v < 13; v += 0.7) {
    // Leave a margin for the intentional cornice overhang and inset roof deck.
    if (Math.min(...pts.map((a, i) => edgeDistance([u, v], a, pts[(i + 1) % pts.length]))) < 0.9) continue;
    ray.set(new THREE.Vector3(u, 30, v), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects([roof, cornice, walls])[0];
    if (inside(pts, u, v)) {
      interior++;
      assert(hit?.object === roof, `continuous roof covers ${u},${v}, without trim seams`);
      assert(Math.abs(hit.point.y - (vol.height + 0.22)) < 1e-4, 'roof deck has one level');
    } else {
      exterior++;
      assert(!hit, `roof and walls preserve the outline, including the rear notch at ${u},${v}`);
    }
  }
  assert(interior > 100 && exterior > 100, 'sample both the interior and the concave exterior');

  // A single window on each face must sit on that edge, look outward, and
  // follow the same left-to-right fraction convention as rectangular volumes.
  const faces = Object.fromEntries(pts.map((_, i) => [`edge${i}`, { storeys: [{y: 3, windows: {at: [0.25], w: 1, h: 1}}] }]));
  const probe = buildBlueprint(makeRng('facade-test'), frame, {volumes: [{polygon: pts, height: 8,
    cornice: {dentils: false}, faces}]}, 0, []);
  const windows = probe.children[0].children.filter(o => o.isGroup);
  assert(windows.length === pts.length, 'one facade window per polygon edge');
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = new THREE.Vector3((b[1] - a[1]) / L, 0, -(b[0] - a[0]) / L);
    const expected = new THREE.Vector3(0.25 * a[0] + 0.75 * b[0], 3.5, 0.25 * a[1] + 0.75 * b[1]).addScaledVector(n, 0.1);
    assert(windows[i].position.distanceTo(expected) < 1e-8, `window location on edge${i}`);
    assert(new THREE.Vector3(0, 0, -1).applyQuaternion(windows[i].quaternion).dot(n) > 0.99999, `window faces out on edge${i}`);
    ray.set(new THREE.Vector3((a[0] + b[0]) / 2, 7, (a[1] + b[1]) / 2).addScaledVector(n, 0.5), n.clone().negate());
    const hit = ray.intersectObject(walls)[0];
    assert(hit && Math.abs(hit.distance - 0.5) < 1e-4 && hit.face.normal.dot(n) > 0.9999, `wall winding on edge${i}`);
  });
  return {interior, exterior, edges: pts.length};
}
