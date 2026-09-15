// Static railway beds, sleepers and paired rails from mapped centerlines.
// They share the street grade, and bake into the existing geometry batches.
import * as THREE from 'three';
import { mat, vmat } from './kit.js';
import { fbm } from './noise.js';
import { pavementGeometry } from './pavement.js';

function sampleLine(pts, spacing) {
  const samples = [];
  let along = 0, next = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-6) continue;
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    while (next < along + length) {
      const t = next - along;
      samples.push({ x: a[0] + dx * t, z: a[1] + dz * t, dx, dz });
      next += spacing;
    }
    along += length;
    // Keep centerline junctions so a curve's connected strips have no gaps.
    if (spacing === 1) samples.push({ x: b[0], z: b[1], dx, dz });
  }
  return samples;
}

function outline(samples, width) {
  const side = sign => samples.map(p => [p.x - p.dz * width / 2 * sign, p.z + p.dx * width / 2 * sign]);
  return [...side(1), ...side(-1).reverse()];
}

function railGeometry(samples, side, grade, roadDistance, W, H) {
  const vertices = [], indices = [];
  for (const p of samples) {
    // Standard gauge, with slightly broad rail heads for the miniature scale.
    for (const offset of [side * 0.7175 - 0.05, side * 0.7175 + 0.05]) {
      const x = THREE.MathUtils.clamp(p.x - p.dz * offset, -W / 2, W / 2);
      const z = THREE.MathUtils.clamp(p.z + p.dx * offset, -H / 2, H / 2);
      // At a level crossing the rail head sits almost flush with the asphalt.
      const lift = THREE.MathUtils.smoothstep(roadDistance(x, z), 0, 1.2);
      const top = grade(x, z) + 0.065 + lift * 0.14;
      vertices.push(x, top, z, x, top - 0.09, z);
    }
  }
  for (let i = 1; i < samples.length; i++) {
    const a = (i - 1) * 4, b = i * 4;
    indices.push(a, a + 2, b, a + 2, b + 2, b,
      a + 1, a, b + 1, a, b, b + 1,
      a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildRailways(features, { grade, roadDistance, W, H }) {
  const group = new THREE.Group(); group.name = 'railways';
  const lines = features.filter(r => r.kind === 'rail' && r.pts.length > 1)
    .map(r => ({ ...r, samples: sampleLine(r.pts, 1) })).filter(r => r.samples.length > 1);
  if (!lines.length) return group;
  const gravelA = new THREE.Color('#817e70'), gravelB = new THREE.Color('#686d62');
  // One union prevents overlapping ballast ribbons from flickering at switches.
  const bed = pavementGeometry(lines.map(r => outline(r.samples, r.width || 4)),
    (x, z) => grade(x, z) + 0.045,
    (x, z) => gravelA.clone().lerp(gravelB, fbm(x * 1.7, z * 1.7)), 0.5,
    { skirt: 0, clip: (x, z) => Math.max(-roadDistance(x, z), Math.abs(x) - W / 2, Math.abs(z) - H / 2) });
  const ballast = new THREE.Mesh(bed, vmat); ballast.name = 'railway-ballast'; group.add(ballast);
  const sleeperPositions = [];
  for (const r of lines) {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeometry(r.samples, side, grade, roadDistance, W, H), mat('#98988d'));
      rail.name = 'railway-rail'; group.add(rail);
    }
    for (const p of sampleLine(r.pts, 0.8)) {
      if (Math.abs(p.x) > W / 2 - 1.4 || Math.abs(p.z) > H / 2 - 1.4 || roadDistance(p.x, p.z) < 1.4) continue;
      sleeperPositions.push(p);
    }
  }
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.11, 0.23), mat('#64594c'), sleeperPositions.length);
  sleepers.name = 'railway-sleepers';
  const transform = new THREE.Object3D();
  for (let i = 0; i < sleeperPositions.length; i++) {
    const p = sleeperPositions[i];
    transform.position.set(p.x, grade(p.x, p.z) + 0.1, p.z);
    transform.rotation.set(0, -Math.atan2(p.dz, p.dx) - Math.PI / 2, 0);
    transform.updateMatrix(); sleepers.setMatrixAt(i, transform.matrix);
  }
  group.add(sleepers);
  group.userData.length = lines.reduce((n, r) => n + r.pts.slice(1).reduce((m, p, i) =>
    m + Math.hypot(p[0] - r.pts[i][0], p[1] - r.pts[i][1]), 0), 0);
  return group;
}
