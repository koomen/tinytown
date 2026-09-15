import * as THREE from 'three';
import { buildRailways } from '../../../src/railways.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function checkRailways() {
  const grade = (x, z) => x * 0.04 + z * 0.02;
  const roadDistance = (x, z) => Math.abs(z) - 1.5;
  const rails = buildRailways([{ kind: 'rail', width: 4, pts: [[-8, -8], [0, 0], [8, 8]] }],
    { grade, roadDistance, W: 20, H: 20 });
  rails.updateMatrixWorld(true);
  const heads = rails.children.filter(m => m.name === 'railway-rail');
  const ballast = rails.getObjectByName('railway-ballast');
  const sleepers = rails.getObjectByName('railway-sleepers');
  assert(heads.length === 2 && sleepers.count > 10, 'Mapped centerline needs paired rails and repeated sleepers');
  const ray = new THREE.Raycaster();
  const hit = (x, z, meshes) => {
    ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObjects(meshes, false)[0];
  };
  for (const t of [-4, 0, 4]) for (const side of [-1, 1]) {
    const x = t - side * 0.7175 / Math.SQRT2, z = t + side * 0.7175 / Math.SQRT2;
    const h = hit(x, z, heads);
    assert(h, 'Rail head must face upward and stay continuous through joins and crossings');
    assert(h.point.y > grade(x, z) + 0.045, 'Rail head is buried beneath the ground or crossing');
    if (t === 0) assert(h.point.y < grade(x, z) + 0.09, 'Level-crossing rails must sit nearly flush with the road');
  }
  assert(!hit(0, 0, [ballast]), 'Ballast must leave the road crossing open');
  assert(hit(-4, -4, [ballast]), 'Ballast missing between the rails');
  rails.traverse(m => {
    if (!m.geometry) return;
    assert([...m.geometry.attributes.position.array].every(Number.isFinite), 'Invalid railway geometry');
  });
  return { railHeads: heads.length, sleepers: sleepers.count };
}
