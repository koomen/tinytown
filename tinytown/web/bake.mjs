// node tinytown/web/bake.mjs data/<site> [--check] [--force] [--surfaces-only|--stream-only]
//
// Bakes a site's runtime assets in plain Node, no browser. `town bake <site>`
// drives this. Two products, each keyed by a fingerprint of its inputs so a
// re-run with the same inputs does no work:
//
// * surfaces - terrain, asphalt and sidewalks: data/<site>/surfaces-<hash>.bin.gz + surfaces.json
// * stream   - camera-sector geometry chunks: data/<site>/stream/manifest.json + chunks
//
// When both are stale, one generator run makes both: the stream export's
// generateSite hands its surfaces to onSurface on the way. When only the stream
// is stale, the current surfaces are unpacked into it instead of regenerated.
//
// --check needs only Node's standard library (no node_modules): it reports
// whether both products are current and exits 1 if not.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { readFile, writeFile, readdir, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { promisify } from 'node:util';
import { gunzipSync, gzip as gzipAsync, gzipSync } from 'node:zlib';
import { streamAssetRecords } from '../../src/stream-format.js';
import { assertStreamAssetSizes } from './stream-asset-limits.mjs';

const web = dirname(fileURLToPath(import.meta.url));
const root = resolve(web, '../..');
const digest = data => createHash('sha256').update(data).digest('hex');
const posix = path => relative(root, path).split(sep).join('/');
const CHUNK = /^(base(?:-part-\d+)?|(?:detail|region)--?\d+_-?\d+(?:q[0-3]+)?)-[a-f0-9]{16}\.bin\.gz$/;

// --- fingerprints -------------------------------------------------------------

// Viewer and renderer modules; editing them does not change baked geometry.
const VIEWER_ONLY = new Set(['main.js', 'site-data.js', 'streaming.js', 'stream-policy.js', 'stream-debug.js',
  'stream-loader.js', 'stream-worker.js', 'bootstrap.js', 'isocontrols.js', 'quality.js', 'context-recovery.js',
  'render-loop.js', 'loading-progress.js', 'lighting.js', 'look.js', 'camera-depth.js']);

function hashFiles(paths) {
  const hash = createHash('sha256');
  for (const path of [...paths].sort((a, b) => posix(a) < posix(b) ? -1 : 1)) {
    hash.update(posix(path) + '\0'); hash.update(readFileSync(path));
  }
  return hash.digest('hex');
}

// The generator (src/ minus the viewer), this baker and its Node environment,
// and the exact three.js and canvas versions; the stream adds its exporter and
// the bundled sign fonts that shape its textures.
export async function fingerprints(directory) {
  const src = (await readdir(join(root, 'src'))).filter(f => f.endsWith('.js') && !VIEWER_ONLY.has(f)).map(f => join(root, 'src', f));
  const baker = [join(web, 'bake.mjs'), join(web, 'node-dom.mjs'), join(root, 'package-lock.json')];
  const fonts = (await readdir(join(web, 'fonts'))).filter(f => f.endsWith('.woff2')).map(f => join(web, 'fonts', f));
  const inputSha256 = digest(await readFile(join(directory, 'site.json')));
  return {
    surfaces: { inputSha256, sourceSha256: hashFiles([...src, ...baker]) },
    stream: { inputSha256, sourceSha256: hashFiles([...src, ...baker, join(web, 'stream-export.js'), join(web, 'stream-asset-limits.mjs'), ...fonts]) },
  };
}
const same = (a, b) => a.inputSha256 === b.inputSha256 && a.sourceSha256 === b.sourceSha256;

// --- status -------------------------------------------------------------------

async function readJSON(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

// The manifest when its fingerprints match and the file it names verifies.
async function currentSurfaces(directory, inputs) {
  const manifest = await readJSON(join(directory, 'surfaces.json'));
  if (!manifest || !same(manifest, inputs) || !/^surfaces-[a-f0-9]{16}\.bin\.gz$/.test(manifest.file)) return null;
  try { if (digest(await readFile(join(directory, manifest.file))) !== manifest.compressedSha256) return null; }
  catch { return null; }
  return manifest;
}

async function currentStream(directory, inputs) {
  const manifest = await readJSON(join(directory, 'stream', 'manifest.json'));
  if (!manifest || !same(manifest, inputs)) return null;
  try {
    for (const record of streamAssetRecords(manifest)) {
      const bytes = await readFile(join(directory, 'stream', record.file));
      if (digest(bytes) !== record.sha256 || bytes.length !== record.bytes) return null;
    }
    assertStreamAssetSizes(manifest);
  } catch { return null; }
  return manifest;
}

// --- writing ------------------------------------------------------------------

async function atomicWrite(path, data) {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  try { await writeFile(temporary, data); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}

function gzip(bytes) {
  const compressed = gzipSync(bytes);
  compressed[9] = 255; // gzip OS byte: identical output on any builder
  return compressed;
}

// generateSite's onSurface geometry is still being finished and clipped after
// the hand-off; keep a copy of exactly what packSurfaces reads.
function snapshotSurface(geo) {
  const copy = a => a && { array: a.array.slice(), itemSize: a.itemSize, normalized: a.normalized };
  const { coverCodes, contours, topIndexCount, topVertexCount } = geo.userData;
  return { attributes: { position: copy(geo.attributes.position) }, index: copy(geo.index),
    userData: { coverCodes: coverCodes?.slice(), contours: contours && structuredClone(contours), topIndexCount, topVertexCount } };
}

async function packedSurfaces(geometries, site, seed) {
  const { packSurfaces, surfaceKey, SURFACE_VERSION } = await import('../../src/surface-assets.js');
  const raw = Buffer.from(await packSurfaces(geometries).arrayBuffer());
  return { raw, compressed: gzip(raw), version: SURFACE_VERSION, key: await surfaceKey(site, seed) };
}

// Surfaces alone (the generator stops after the pavement): the manifest fields
// and gzipped bytes. The viewer browser test uses this for its fixture.
export async function precomputeSurfaces(site, seed) {
  await import('./node-dom.mjs');
  const { generateSite } = await import('../../src/site.js');
  const geometries = new Map(), start = performance.now();
  seed = site.seed ?? seed;
  await generateSite(site, seed, { surfacesOnly: true, onSurface: (name, geo) => geometries.set(name, geo) });
  const { raw, compressed, version, key } = await packedSurfaces(geometries, site, seed);
  return [{ version, key, sha256: digest(raw), rawBytes: raw.length, compressedBytes: compressed.length,
    buildMs: Math.round(performance.now() - start) }, compressed];
}

async function writeSurfaces(directory, inputs, result, compressed) {
  if (!same((await fingerprints(directory)).surfaces, inputs)) throw new Error('Map or generator changed during the surface bake; rerun');
  const compressedSha256 = digest(compressed);
  const manifest = { ...result, file: `surfaces-${compressedSha256.slice(0, 16)}.bin.gz`, ...inputs, compressedSha256 };
  await atomicWrite(join(directory, manifest.file), compressed);
  await atomicWrite(join(directory, 'surfaces.json'), JSON.stringify(manifest, null, 2) + '\n');
  // Only one asset revision per site; no accumulation in the deployed app.
  for (const file of await readdir(directory)) {
    if (/^surfaces-[a-f0-9]{16}\.bin\.gz$/.test(file) && file !== manifest.file) await rm(join(directory, file));
  }
  const mb = n => (n / 1e6).toFixed(2) + ' MB';
  console.log(`Surfaces: ${mb(manifest.compressedBytes)} (${mb(manifest.rawBytes)} raw) in ${(manifest.buildMs / 1000).toFixed(1)} s`);
}

// --- the stream export --------------------------------------------------------

// Exports the stream; with surfaces (a surfaces fingerprint), also collects and
// writes the surfaces from the same generator run. With surfaceAsset (packed
// current surfaces), the generator reuses them instead.
async function exportStream(directory, site, seed, inputs, { surfaces, surfaceAsset } = {}) {
  // The exporter collects every 25 tiles when it can; left alone, V8 lets
  // finished tiles pile up toward its heap limit.
  if (!globalThis.gc) { setFlagsFromString('--expose-gc'); globalThis.gc = runInNewContext('gc'); }
  await import('./node-dom.mjs');
  const { exportStream } = await import('./stream-export.js');
  const output = join(directory, 'stream');
  await mkdir(output, { recursive: true });
  const staging = await mkdtemp(join(output, '.prepare-'));
  try {
    const start = performance.now(), geometries = new Map();
    let surfacesWritten = Promise.resolve();
    const onSurface = surfaces && ((name, geo) => {
      geometries.set(name, snapshotSurface(geo));
      if (geometries.size < 3) return;
      const buildMs = Math.round(performance.now() - start);
      surfacesWritten = packedSurfaces(geometries, site, site.seed ?? seed).then(({ raw, compressed, version, key }) =>
        writeSurfaces(directory, surfaces, { version, key, sha256: digest(raw), rawBytes: raw.length,
          compressedBytes: compressed.length, buildMs }, compressed));
    });
    // zlib on libuv's thread pool, so chunks compress while the next tiles bake.
    const deflate = promisify(gzipAsync);
    const codec = { gzip: async blob => deflate(new Uint8Array(await blob.arrayBuffer())), sha256: digest };
    const manifest = await exportStream(site, seed, (file, bytes) => {
      if (!CHUNK.test(file)) throw new Error(`Unexpected stream asset name ${file}`);
      writeFileSync(join(staging, file), bytes);
    }, { codec, ...(onSurface ? { onSurface } : {}), ...(surfaceAsset ? { surfaceAsset } : {}) });
    await surfacesWritten;
    if (surfaces && geometries.size < 3) throw new Error('The stream export produced no surfaces');
    const mb = n => (n / 1048576).toFixed(1) + ' MiB';
    console.log(`Base: ${mb(manifest.base.bytes)} download, ${mb(manifest.base.memoryBytes)} geometry/textures`);
    console.log(`${manifest.tiles.length} detail tiles: ${mb(manifest.tiles.reduce((n, t) => n + t.bytes, 0))} total download`);
    if (manifest.regions) console.log(`${manifest.regions.length} landscape regions: ${mb(manifest.regions.reduce((n, t) => n + t.bytes, 0))} loaded as needed`);
    assertStreamAssetSizes(manifest);
    if (!same((await fingerprints(directory)).stream, inputs)) throw new Error('Source changed during the stream bake; rerun');
    Object.assign(manifest, inputs);
    for (const record of streamAssetRecords(manifest)) await rename(join(staging, record.file), join(output, record.file));
    await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await rename(join(staging, 'manifest.json'), join(output, 'manifest.json'));
    // Only one asset revision per site; chunks the new manifest no longer names go.
    const current = new Set(streamAssetRecords(manifest).map(record => record.file));
    for (const file of await readdir(output)) if (CHUNK.test(file) && !current.has(file)) await rm(join(output, file));
    console.log(`Stream: ${((performance.now() - start) / 1000).toFixed(1)} s`);
  } finally { await rm(staging, { recursive: true, force: true }); }
}

// --- the command --------------------------------------------------------------

export async function bake(directory, { check = false, force = false, surfaces = true, stream = true } = {}) {
  const name = basename(directory), inputs = await fingerprints(directory);
  const haveSurfaces = surfaces && await currentSurfaces(directory, inputs.surfaces);
  const haveStream = stream && !force && await currentStream(directory, inputs.stream);
  if (haveSurfaces) console.log(`${name}: surfaces are current (${(haveSurfaces.compressedBytes / 1e6).toFixed(2)} MB)`);
  if (haveStream) console.log(`${name}: stream is current (${haveStream.tiles.length} tiles${check ? '' : '; --force re-exports'})`);
  const needSurfaces = surfaces && !haveSurfaces, needStream = stream && !haveStream;
  if (check) {
    if (needSurfaces) console.error(`${name}: surfaces are stale; run town bake ${name}`);
    if (needStream) console.error(`${name}: stream is stale; run town bake ${name}`);
    return !needSurfaces && !needStream;
  }
  if (!needSurfaces && !needStream) return true;
  const site = JSON.parse(await readFile(join(directory, 'site.json'), 'utf8'));
  if (!needStream) {
    const [result, compressed] = await precomputeSurfaces(site, name);
    await writeSurfaces(directory, inputs.surfaces, result, compressed);
    return true;
  }
  const current = !needSurfaces && await currentSurfaces(directory, inputs.surfaces);
  const surfaceAsset = current ? new Uint8Array(gunzipSync(await readFile(join(directory, current.file)))).buffer : null;
  await exportStream(directory, site, name, inputs.stream, needSurfaces ? { surfaces: inputs.surfaces } : { surfaceAsset });
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), argument = args.find(a => !a.startsWith('--'));
  if (!argument) throw new Error('Usage: bake.mjs data/<site> [--check] [--force] [--surfaces-only|--stream-only]');
  const directory = resolve(root, argument);
  if (!directory.startsWith(join(root, 'data') + sep)) throw new Error('Expected a site under data/');
  const ok = await bake(directory, { check: args.includes('--check'), force: args.includes('--force'),
    surfaces: !args.includes('--stream-only'), stream: !args.includes('--surfaces-only') });
  process.exitCode = ok ? 0 : 1;
}
