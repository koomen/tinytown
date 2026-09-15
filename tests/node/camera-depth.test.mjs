import test from 'node:test';
import assert from 'node:assert/strict';
import {viewNearPlane} from '../../src/camera-depth.js';

const legacyNear = d => Math.max(0.5, Math.min(8, d / 120));
// Project two surfaces through an ordinary 24-bit perspective depth buffer.
const depth = (z, near, far = 200000) => far / (far - near) * (1 - near / z);
const separation = (z, gap, near) => (depth(z, near) - depth(z - gap, near)) * 2 ** 24;

test('distant pavement and roof decks remain separate in the depth buffer', () => {
  const verticalGap = 0.015, elevation = 35.264 * Math.PI / 180;
  const gap = verticalGap * Math.sin(elevation);
  for (const distance of [960, 1500, 2300, 4000, 7000, 10000, 15000]) {
    assert.ok(separation(distance, gap, viewNearPlane(distance)) > 2,
      `15 mm surface separation remains visible at ${distance} m`);
  }
  assert.ok(separation(4000, gap, legacyNear(4000)) < 1,
    'the former overview camera cannot distinguish those same surfaces');
});

test('close views and the Avon opening keep their original projection', () => {
  for (const distance of [10, 30, 60, 120, Math.hypot(175, 145, 95), 275]) {
    assert.equal(viewNearPlane(distance), legacyNear(distance));
  }
});

test('near plane stays ahead of visible ground and leaves free authoring views alone', () => {
  let previous = 0;
  for (let distance = 10; distance <= 25000; distance += 10) {
    const near = viewNearPlane(distance);
    assert.ok(near >= previous && near <= distance / 4);
    assert.equal(viewNearPlane(distance, false), legacyNear(distance));
    previous = near;
  }
});
