import * as THREE from 'three';
import { mat } from './kit.js';
import { perimeterPanels } from './perimeter-layout.js';

// Broad flat-topped vinyl boards, framed by rails and capped square posts.
// Each board samples grade separately; short rails follow the slope between
// posts. The normal site bake can merge these shared low-poly box instances.
export function buildVinylFence(feature, grade) {
  const root = new THREE.Group(); root.name = 'vinyl-perimeter';
  const height = feature.height ?? 1.3;
  const points = feature.closed ? [...feature.pts, feature.pts[0]] : feature.pts;
  const panels = perimeterPanels(points, feature.openings, 2.5);
  const parts = { slats: [], rails: [], posts: [], caps: [] };
  const postKeys = new Set(), pose = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  function add(kind, x, y, z, w, h, d, rotation = null) {
    pose.position.set(x, y, z); pose.scale.set(w, h, d);
    pose.quaternion.identity();
    if (rotation) pose.quaternion.copy(rotation);
    pose.updateMatrix(); parts[kind].push(pose.matrix.clone());
  }
  for (const [a, b] of panels) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const heading = new THREE.Quaternion().setFromAxisAngle(up, -Math.atan2(dz, dx));
    const count = Math.ceil(length / .172), spacing = length / count;
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count, x = a[0] + dx * t, z = a[1] + dz * t;
      add('slats', x, grade(x, z) + height / 2 + .025, z,
        spacing * .93, height - .05, .055, heading);
    }
    for (const rise of [.18, height - .025]) {
      const start = new THREE.Vector3(a[0], grade(...a) + rise, a[1]);
      const end = new THREE.Vector3(b[0], grade(...b) + rise, b[1]);
      const direction = end.clone().sub(start), center = start.clone().add(end).multiplyScalar(.5);
      const rotation = new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize());
      add('rails', center.x, center.y, center.z, .085, direction.length(), .085, rotation);
    }
    for (const [x, z] of [a, b]) {
      const key = `${x.toFixed(3)},${z.toFixed(3)}`;
      if (postKeys.has(key)) continue;
      postKeys.add(key);
      const y = grade(x, z);
      add('posts', x, y + (height + .08) / 2, z, .15, height + .24, .15, heading);
      add('caps', x, y + height + .17, z, .205, .065, .205, heading);
    }
  }
  const geometry = new THREE.BoxGeometry(1, 1, 1), material = mat(feature.color ?? '#f1f0e8');
  for (const [kind, matrices] of Object.entries(parts)) {
    if (!matrices.length) continue;
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = `vinyl-fence-${kind}`;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
