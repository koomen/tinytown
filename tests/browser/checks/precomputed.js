import { generateSite } from '../../../src/site.js';
import { packSurfaces } from '../../../src/surface-assets.js';

// Compare the complete output, including seeded props and shifted coordinates,
// so skipping construction cannot silently change gardens, curbs or buildings.
export async function checkPrecomputedSurfaces() {
  const site = {
    size: { w: 80, h: 90 }, offset: { x: 17, z: -11 },
    terrain: { x0: -30, x1: 65, z0: -65, z1: 45, cols: 2, rows: 2, values: [1, 4, -2, 2] },
    roads: [
      { id: 1, class: 'primary', width: 7, pts: [[-30, -5], [17, -5], [45, 16]] },
      { id: 2, class: 'footway', foot: 'sidewalk', width: 2, pts: [[-30, 1], [15, 1], [42, 22]] },
      { id: 3, class: 'footway', foot: 'crossing', width: 3, pts: [[2, -14], [2, 6]] },
    ],
    areas: [{ kind: 'parking', pts: [[22, -23], [38, -23], [38, -5], [22, -5]] }],
    buildings: [{ id: 10, centroid: [-3, -30], pts: [[-8, -34], [2, -34], [2, -26], [-8, -26]],
      obb: { cx: -3, cz: -30, w: 10, d: 8, angle: 0 }, style: { kind: 'house', roof: 'gable' } }],
    pois: [], extras: [],
  };
  const geometry = new Map();
  await generateSite(site, 'precomputed-regression', { surfacesOnly: true, onSurface: (name, geo) => geometry.set(name, geo) });
  const asset = await packSurfaces(geometry).arrayBuffer();
  const fingerprint = async street => {
    const rows = [], arrays = [];
    street.group.updateMatrixWorld(true);
    street.group.traverse(o => {
      if (!o.geometry) return;
      rows.push([o.matrixWorld.elements, o.geometry.index?.count, o.count,
        o.material.userData.surface, o.material.color?.getHex()]);
      for (const a of [...Object.values(o.geometry.attributes), o.geometry.index, o.instanceMatrix, o.instanceColor].filter(Boolean)) {
        arrays.push(a.array);
        rows.push([a.itemSize, a.normalized]);
      }
    });
    for (const array of arrays) {
      const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
      rows.push(Array.from(new Uint8Array(hash)));
    }
    for (let i = 0; i < 300; i++) {
      const x = Math.sin(i * 4.17) * 39 + 17, z = Math.cos(i * 7.33) * 44 - 11;
      rows.push(['grade', 'roadY', 'walkY', 'roadDistance'].map(k => street.surfaces[k](x, z)));
    }
    street.group.traverse(o => o.geometry?.dispose());
    return JSON.stringify(rows);
  };
  for (const memoryOptimized of [false, true]) {
    const plain = await generateSite(site, 'precomputed-regression', { memoryOptimized });
    const expected = await fingerprint(plain);
    const prepared = await generateSite(site, 'precomputed-regression', { memoryOptimized, surfaceAsset: asset });
    if (!prepared.precomputedSurfaces || await fingerprint(prepared) !== expected) throw new Error('Precomputed scene differs from generated scene');
  }
  return { profiles: 2, surfaceSamples: 600 };
}
