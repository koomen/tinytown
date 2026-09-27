// `bake.mjs --check` decides from fingerprints alone, with no node_modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bake, fingerprints } from '../../tinytown/web/bake.mjs';

const sha = data => createHash('sha256').update(data).digest('hex');
const quiet = async run => {
  const { log, error } = console;
  console.log = console.error = () => {};
  try { return await run(); } finally { Object.assign(console, { log, error }); }
};

async function site() {
  const directory = await mkdtemp(join(tmpdir(), 'bake-'));
  await writeFile(join(directory, 'site.json'), '{"buildings": []}');
  return directory;
}

async function recordSurfaces(directory, payload = 'packed surfaces') {
  const digest = sha(payload), file = `surfaces-${digest.slice(0, 16)}.bin.gz`;
  await writeFile(join(directory, file), payload);
  await writeFile(join(directory, 'surfaces.json'), JSON.stringify({
    file, compressedBytes: payload.length, compressedSha256: digest, ...(await fingerprints(directory)).surfaces }));
  return file;
}

async function recordStream(directory, payload = 'chunk') {
  const file = `base-${sha(payload).slice(0, 16)}.bin.gz`;
  await mkdir(join(directory, 'stream'), { recursive: true });
  await writeFile(join(directory, 'stream', file), payload);
  await writeFile(join(directory, 'stream', 'manifest.json'), JSON.stringify({
    base: { file, sha256: sha(payload), bytes: payload.length }, tiles: [], ...(await fingerprints(directory)).stream }));
  return file;
}

test('check is current only when scene, generator and payloads all match', async () => {
  const directory = await site();
  try {
    assert.equal(await quiet(() => bake(directory, { check: true })), false, 'nothing baked yet');
    const surfaces = await recordSurfaces(directory);
    assert.equal(await quiet(() => bake(directory, { check: true, stream: false })), true);
    assert.equal(await quiet(() => bake(directory, { check: true })), false, 'a missing stream fails the whole check');
    await recordStream(directory);
    assert.equal(await quiet(() => bake(directory, { check: true })), true);
    await writeFile(join(directory, 'site.json'), '{"buildings": [{"id": 1}]}');
    assert.equal(await quiet(() => bake(directory, { check: true, stream: false })), false, 'edited scene');
    assert.equal(await quiet(() => bake(directory, { check: true, surfaces: false })), false, 'edited scene');
    await recordSurfaces(directory);
    await writeFile(join(directory, surfaces), 'corrupt');
    await recordSurfaces(directory);
    assert.equal(await quiet(() => bake(directory, { check: true, stream: false })), true);
    await writeFile(join(directory, surfaces), 'corrupt');
    assert.equal(await quiet(() => bake(directory, { check: true, stream: false })), false, 'corrupt payload');
    await unlink(join(directory, surfaces));
    assert.equal(await quiet(() => bake(directory, { check: true, stream: false })), false, 'missing payload');
    const chunk = await recordStream(directory);
    assert.equal(await quiet(() => bake(directory, { check: true, surfaces: false })), true);
    await writeFile(join(directory, 'stream', chunk), 'corrupt');
    assert.equal(await quiet(() => bake(directory, { check: true, surfaces: false })), false, 'corrupt chunk');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('fingerprints are stable, and the stream also covers its exporter', async () => {
  const directory = await site();
  try {
    const before = await fingerprints(directory);
    assert.notEqual(before.surfaces.sourceSha256, before.stream.sourceSha256, 'the stream also covers its exporter');
    assert.deepEqual(await fingerprints(directory), before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
