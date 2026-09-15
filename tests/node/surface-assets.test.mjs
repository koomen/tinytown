import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { packSurfaces, unpackSurfaces, surfaceKey, loadSurfaceAsset, SURFACE_VERSION } from '../../src/surface-assets.js';
import { loadingProgress } from '../../src/loading-progress.js';

const attr = (array, itemSize) => ({ array, itemSize, normalized: false });
function fixture() {
  return new Map(['ground', 'asphalt', 'pavement'].map(name => [name, {
    attributes: { position: attr(new Float32Array([-0, -2.375, 100.125, 0, 1e-8, -100.125, 1, 0, 0]), 3) },
    index: attr(new Uint16Array([0, 1, 2]), 1),
    userData: { coverCodes: new Uint8Array([0, 2, 1]), topVertexCount: 3, topIndexCount: 3,
      contours: [[[Math.PI, -0], [1 / 3, 1e-12], [Math.PI, -0]], [[1, 2], [3, 4]]] },
  }]));
}
const sha = data => createHash('sha256').update(data).digest('hex');

test('surface asset preserves every position/index bit and double-precision curb boundary', async () => {
  const original = fixture(), packed = await packSurfaces(original).arrayBuffer();
  const restored = unpackSurfaces(packed);
  for (const [name, geo] of original) {
    for (const key of ['position', 'index']) {
      const before = key === 'index' ? geo.index : geo.attributes[key];
      assert.deepEqual(new Uint8Array(restored.get(name).attributes[key].array.buffer), new Uint8Array(before.array.buffer));
    }
  }
  assert.deepEqual(restored.get('asphalt').userData.contours, original.get('asphalt').userData.contours);
  assert.deepEqual(restored.get('ground').userData.coverCodes, new Uint8Array([0, 2, 1]));
  assert.throws(() => unpackSurfaces(packed.slice(0, packed.byteLength - 1)), /Invalid surface buffer/);
});

test('missing, stale, corrupt and valid assets choose the correct load path', async t => {
  const raw = await packSurfaces(fixture()).arrayBuffer(), gz = gzipSync(new Uint8Array(raw));
  const site = { terrain: { values: [0, 1, 2, 3] }, buildings: [] }, key = await surfaceKey(site, 'seed');
  const manifest = { version: SURFACE_VERSION, key, sha256: sha(new Uint8Array(raw)), file: 'surfaces-0123456789abcdef.bin.gz' };
  let mode, downloads;
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async url => {
    downloads.push(url);
    if (url.endsWith('.json')) {
      if (mode === 'missing') return new Response('', { status: 404 });
      return Response.json({ ...manifest, ...(mode === 'stale' ? { key: 'old' } : {}), ...(mode === 'corrupt' ? { sha256: 'bad' } : {}) });
    }
    return new Response(gz);
  });
  for (mode of ['missing', 'stale', 'corrupt', 'valid']) {
    downloads = [];
    const result = await loadSurfaceAsset(site, 'seed', '/data/test');
    if (mode === 'valid') assert.deepEqual(new Uint8Array(result.buffer), new Uint8Array(raw));
    else assert.equal(result, null);
    assert.equal(downloads.length, ['missing', 'stale'].includes(mode) ? 1 : 2);
  }
  downloads = [];
  assert.equal(await loadSurfaceAsset({ ...site, buildings: [{ id: 1 }] }, 'seed', '/data/test'), null);
  assert.equal(downloads.length, 1, 'changed building inputs must never download old paving');
  assert.notEqual(await surfaceKey(site, 'other seed'), key);
});

test('a stalled surface request is aborted so ordinary generation can proceed', async t => {
  let aborted = false;
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); });
  }));
  assert.equal(await loadSurfaceAsset({}, 'seed', '/data/test', { timeoutMs: 20 }), null);
  assert.equal(aborted, true);
});

test('overall loading progress cannot reset between phases, even with stale timings', () => {
  const updates = [], bar = { style: { width: '14%' }, parentElement: { setAttribute: (_, value) => updates.push(Number(value)) } };
  const caption = {}, progress = loadingProgress(bar, caption);
  for (const [target, label] of [[.22, 'map'], [.4, 'ground'], [.7, 'roads'], [.5, 'sidewalks'], [NaN, 'buildings'], [1, 'ready']]) progress(target, label);
  assert.deepEqual(updates, [22, 40, 70, 70, 70, 100]);
  assert.equal(caption.textContent, 'ready');
  assert.equal(bar.style.width, '100%');
});
