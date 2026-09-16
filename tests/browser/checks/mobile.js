import * as THREE from 'three';
import { bake, bakeMobile } from '../../../src/bake.js';
import { rbox, imat, buildTree, buildLamp, scatterTufts } from '../../../src/kit.js';
import { makeRng } from '../../../src/rng.js';
import { paneUV, surfaceMaterial } from '../../../src/materials.js';

const assert = (ok, message) => { if (!ok) throw new Error(message); };
function stats(root) {
  root.updateMatrixWorld(true);
  const buffers = new Set(), bounds = new THREE.Box3(), p = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), instance = new THREE.Matrix4();
  let triangles = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry, count = o.isInstancedMesh ? o.count : 1;
    triangles += (g.index?.count ?? g.attributes.position.count) / 3 * count;
    for (const a of [...Object.values(g.attributes), g.index, o.instanceMatrix, o.instanceColor].filter(Boolean)) buffers.add(a.array.buffer);
    for (let i = 0; i < count; i++) {
      matrix.copy(o.matrixWorld);
      if (o.isInstancedMesh) { o.getMatrixAt(i, instance); matrix.multiply(instance); }
      for (let j = 0; j < g.attributes.position.count; j++) bounds.expandByPoint(p.fromBufferAttribute(g.attributes.position, j).applyMatrix4(matrix));
    }
  });
  return { triangles, bounds, bytes: [...buffers].reduce((n, b) => n + b.byteLength, 0) };
}

export async function checkMobileGeometry() {
  const source = () => {
    const root = new THREE.Group(), parent = new THREE.Group();
    root.position.set(12, 3, -8); root.rotation.y = 0.27;
    parent.position.set(4, 0, 2); parent.rotation.y = -0.41; root.add(parent);
    for (let i = 0; i < 16; i++) parent.add(rbox(0.7, 2, 0.3, i % 2 ? 0x804020 : 0x20a070, 0.05, i, 1, 0));
    const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.4, 0.5), imat, 24);
    const m = new THREE.Matrix4();
    for (let i = 0; i < stones.count; i++) {
      stones.setMatrixAt(i, m.makeTranslation(i * 0.4, 0, 5));
      stones.setColorAt(i, new THREE.Color(i % 2 ? 0xaaaaaa : 0x777777));
    }
    parent.add(stones);
    for (const x of [0, 3]) {
      const pane = new THREE.Mesh(paneUV(new THREE.BoxGeometry(1, 2, 0.1)), surfaceMaterial('glass', 0x668899));
      pane.position.set(x, 2, 3); parent.add(pane);
    }
    return root;
  };
  const original = bake(source()), input = source();
  const mobile = await bakeMobile(input, { chunkVertices: 1000, yieldBuild: async () => {} });
  const a = stats(original), b = stats(mobile);
  assert(a.triangles === b.triangles, 'Mobile baking changed building triangles');
  assert(a.bounds.min.distanceTo(b.bounds.min) < 1e-4 && a.bounds.max.distanceTo(b.bounds.max) < 1e-4, 'Mobile baking moved geometry');
  assert(b.bytes < a.bytes * 0.5, 'Repeated parts must share buffers, including instance storage');
  assert(input.children.length === 0, 'Mobile bake must release its staging graph');
  const parts = mobile.children.find(o => o.isInstancedMesh && o.count === 16);
  assert(parts, 'Repeated building parts were expanded');
  const color = new THREE.Color();
  parts.getColorAt(0, color);
  const expectedColor = new THREE.Color(0x20a070);
  assert(['r', 'g', 'b'].every(k => Math.abs(color[k] - expectedColor[k]) < 1e-6), 'Instance tint was lost');
  assert(mobile.children.some(o => o.isInstancedMesh && o.count === 24), 'Existing instances were expanded');
  const glass = mobile.children.filter(o => o.material.userData.surface === 'glass');
  const paneIds = new Set(glass.flatMap(o => Array.from(o.geometry.attributes.uv.array).filter((_, i) => i % 2 === 0).map(u => Math.floor(u / 2))));
  assert(paneIds.size === 2, 'Mobile batching lost per-window interior variation');
  for (const o of glass) {
    const n = o.geometry.attributes.normal;
    assert(n.normalized && n.array instanceof Int16Array, 'Mobile normals must use compact storage');
    for (let i = 0; i < n.count; i++) assert(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-4, 'Packed normal lost precision');
  }

  const lamps = () => {
    const group = new THREE.Group(), rng = makeRng('shared-lamps');
    group.position.set(-15, 2, 8); group.rotation.y = .3;
    let alternate;
    for (let i = 0; i < 24; i++) {
      const lamp = buildLamp(rng);
      lamp.position.set(i * 3, i * .2, i % 3);
      lamp.scale.setScalar(1.7);
      const bulb = lamp.getObjectByName('streetlamp-bulb');
      if (i % 2) {
        alternate ||= bulb.material.clone();
        alternate.emissiveIntensity = .8;
        bulb.material = alternate;
      }
      group.add(lamp);
    }
    return group;
  };
  const sourceLamps = lamps(), sourceEmissions = new Set();
  sourceLamps.traverse(o => { if (o.name === 'streetlamp-bulb') sourceEmissions.add(o.material.emissiveIntensity); });
  const lampsBefore = stats(bake(sourceLamps)), sharedLamps = await bakeMobile(lamps());
  const lampsAfter = stats(sharedLamps);
  assert(lampsBefore.triangles === lampsAfter.triangles, 'Lamp instancing changed geometry');
  assert(lampsBefore.bounds.min.distanceTo(lampsAfter.bounds.min) < 1e-4
    && lampsBefore.bounds.max.distanceTo(lampsAfter.bounds.max) < 1e-4, 'Lamp instancing moved fixtures');
  assert(lampsAfter.bytes < lampsBefore.bytes / 4, 'Lamp bulbs must share geometry');
  const bulbs = sharedLamps.children.filter(o => o.isInstancedMesh && o.material.emissive?.getHex());
  assert(bulbs.length === 2 && bulbs.every(o => o.count === 12), 'Distinct bulb materials were combined');
  assert(bulbs.every(o => !o.instanceColor), 'Shared emissive materials must not receive a second color tint');
  assert(bulbs.map(o => o.material.emissiveIntensity).sort().join(',') === [...sourceEmissions].sort().join(','), 'Bulb emission changed');
  // Streaming stores addon geometries as raw buffers, not constructor names.
  const json = sharedLamps.toJSON(), geometries = new Map();
  sharedLamps.traverse(o => {
    if (!o.geometry || geometries.has(o.geometry.uuid)) return;
    const geometry = new THREE.BufferGeometry().copy(o.geometry);
    geometry.uuid = o.geometry.uuid;
    geometries.set(geometry.uuid, geometry.toJSON());
  });
  json.geometries = [...geometries.values()];
  const restored = await new THREE.ObjectLoader().parseAsync(json);
  assert(stats(restored).triangles === lampsBefore.triangles, 'Stream serialization lost lamp instances');

  for (let i = 0; i < 24; i++) {
    const fullRng = makeRng(i), lightRng = makeRng(i);
    const full = buildTree(fullRng, { big: !!(i % 2) });
    const light = buildTree(lightRng, { big: !!(i % 2), lowDetail: true });
    assert(fullRng.next() === lightRng.next(), 'Tree detail shifted subsequent scene random choices');
    assert(full.scale.equals(light.scale) && full.rotation.equals(light.rotation), 'Tree transform changed with quality');
    assert(stats(light).triangles < stats(full).triangles * 0.7, 'Mobile tree has too much geometry');
  }
  const makeTufts = stride => {
    const rng = makeRng('mobile-grass');
    const mesh = scatterTufts(rng, 80, () => [rng.range(-5, 5), rng.range(-5, 5)], (x, z) => x + z > 4, { stride });
    return { mesh, next: rng.next() };
  };
  const full = makeTufts(1), light = makeTufts(4);
  assert(full.next === light.next, 'Sparse grass shifted subsequent flowers');
  const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4();
  for (let i = 0; i < light.mesh.count; i++) {
    full.mesh.getMatrixAt(i * 4, m1); light.mesh.getMatrixAt(i, m2);
    assert(m1.equals(m2), 'Sparse grass moved surviving tufts');
  }
  return { beforeBytes: a.bytes, afterBytes: b.bytes, treeSeeds: 24 };
}

export function checkMobileScene(w) {
  assert(w.quality.name === 'mobile', 'Phone did not select mobile quality');
  assert(w.gtao === null && w.bokeh === null && w.bloom === null, 'Phone allocated expensive effect passes');
  assert(w.renderer.getPixelRatio() <= 1 && w.sun.shadow.mapSize.x === 1024, 'Phone buffer budget exceeded');
  assert(w.composer.passes.length === 3, 'Unexpected phone rendering passes');
  const result = stats(w.street.group);
  assert(result.bytes < 190000000, `Phone geometry budget exceeded: ${result.bytes}`);
  assert(w.street.group.userData.mobileBake.sharedParts > 1000, 'Live building parts were not shared');
  const inScene = o => { for (; o; o = o.parent) if (o === w.street.group) return true; return false; };
  assert(w.street.smokes.every(e => e.puffs.every(p => inScene(p.mesh))), 'Mobile bake detached animated smoke');
  assert(w.renderer.info.programs.every(p => p.diagnostics?.runnable !== false), 'Mobile shader failed');
  return { geometryBytes: result.bytes, trianglesIncludingInstances: result.triangles };
}
