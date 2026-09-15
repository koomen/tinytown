import test from 'node:test';
import assert from 'node:assert/strict';
import { dugoutFooting } from '../../src/baseball-layout.js';

test('rotated dugout floor clears terrain and its foundation reaches every corner', () => {
  const grade = (x, z) => .16 * x - .08 * z;
  for (const angle of [0, Math.PI / 2, -.73, 2.32]) {
    const d = { position: [-1618, 635], angle, length: 7.2, depth: 2.3 };
    const f = dugoutFooting(d, grade);
    for (const p of f.corners) {
      assert.ok(f.floor > grade(...p));
      assert.ok(f.bottom < grade(...p));
    }
    assert.ok(Math.abs(Math.hypot(f.corners[2][0] - f.corners[0][0], f.corners[2][1] - f.corners[0][1]) - d.length) < 1e-10);
    const front = f.world(0, -d.depth / 2), back = f.world(0, d.depth / 2);
    assert.ok(Math.abs((back[0] - front[0]) - Math.sin(angle) * d.depth) < 1e-10);
    assert.ok(Math.abs((back[1] - front[1]) - Math.cos(angle) * d.depth) < 1e-10);
  }
});

test('foundation sampling catches an interior ridge and preserves the source record', () => {
  const d = { position: [20, -40], angle: 0, length: 8, depth: 2 };
  const before = structuredClone(d);
  const grade = (x, z) => Math.max(0, 1.6 - Math.abs(x - 20) - Math.abs(z + 40));
  const f = dugoutFooting(d, grade);
  assert.ok(Math.abs(f.floor - 1.72) < 1e-12);
  assert.equal(f.bottom, -.12);
  assert.deepEqual(d, before);
});
