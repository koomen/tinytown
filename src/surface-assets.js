// Lossless, build-time assets for the three expensive terrain/pavement meshes.
// No Three.js dependency: download and decompress alongside the viewer modules.
// Bump when ground/pavement generation or their inputs change incompatibly.
export const SURFACE_VERSION = 6;
const MAGIC = 0x31465354; // TSF1, little endian
const TYPES = { Float32Array, Float64Array, Uint32Array, Uint16Array, Int16Array, Uint8Array };
const NAMES = ['ground', 'asphalt', 'pavement'];

export async function surfaceKey(site, seed) {
  const input = JSON.stringify([SURFACE_VERSION, seed, site]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// XOR adjacent vertices, then group each component's bytes. Repeated grid
// coordinates/indices compress well without rounding positions, normals or colors.
function shuffle(array, itemSize) {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  const stride = array.BYTES_PER_ELEMENT * itemSize, count = bytes.length / stride;
  const out = new Uint8Array(bytes.length);
  for (let lane = 0; lane < stride; lane++) {
    let previous = 0;
    for (let v = 0; v < count; v++) {
      const b = bytes[v * stride + lane];
      out[lane * count + v] = b ^ previous; previous = b;
    }
  }
  return out;
}

export function packSurfaces(geometries) {
  const records = [], chunks = [];
  let offset = 0;
  for (const name of NAMES) {
    const geo = geometries.get(name);
    if (!geo) throw new Error(`Missing surface: ${name}`);
    const attributes = {};
    const sources = { position: geo.attributes.position, index: geo.index };
    if (name === 'ground') sources._cover = { array: geo.userData.coverCodes, itemSize: 1 };
    if (name === 'asphalt') {
      sources._contourLengths = { array: new Uint32Array(geo.userData.contours.map(c => c.length)), itemSize: 1 };
      sources._contourPoints = { array: new Float64Array(geo.userData.contours.flat(2)), itemSize: 2 };
    }
    for (const [key, attr] of Object.entries(sources)) {
      if (!attr) continue;
      if (attr.isInterleavedBufferAttribute || !TYPES[attr.array.constructor.name]) throw new Error('Unsupported surface attribute');
      const data = shuffle(attr.array, attr.itemSize);
      attributes[key] = { type: attr.array.constructor.name, itemSize: attr.itemSize,
        normalized: attr.normalized, length: attr.array.length, offset };
      chunks.push(data); offset += data.byteLength;
    }
    records.push({ name, attributes, userData: {
      ...(geo.userData.topIndexCount !== undefined ? { topIndexCount: geo.userData.topIndexCount } : {}),
      ...(geo.userData.topVertexCount !== undefined ? { topVertexCount: geo.userData.topVertexCount } : {}),
    } });
  }
  const header = new TextEncoder().encode(JSON.stringify(records));
  const prefix = new Uint8Array(8), view = new DataView(prefix.buffer);
  view.setUint32(0, MAGIC, true); view.setUint32(4, header.length, true);
  return new Blob([prefix, header, ...chunks]);
}

export function unpackSurfaces(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 8 || view.getUint32(0, true) !== MAGIC) throw new Error('Invalid surface asset');
  const headerLength = view.getUint32(4, true), start = 8 + headerLength;
  if (start > buffer.byteLength) throw new Error('Truncated surface asset');
  const records = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength)));
  const result = new Map();
  for (const record of records) {
    if (!NAMES.includes(record.name) || result.has(record.name)) throw new Error('Invalid surface name');
    const attributes = {};
    for (const [name, a] of Object.entries(record.attributes)) {
      const Type = TYPES[a.type];
      if (!Type || !Number.isSafeInteger(a.length) || a.length < 0 ||
          !Number.isInteger(a.itemSize) || a.itemSize < 1 || a.itemSize > 4 || a.length % a.itemSize ||
          !Number.isSafeInteger(a.offset) || a.offset < 0 || start + a.offset + a.length * Type.BYTES_PER_ELEMENT > buffer.byteLength) {
        throw new Error('Invalid surface buffer');
      }
      const array = new Type(a.length), bytes = new Uint8Array(array.buffer);
      const encoded = new Uint8Array(buffer, start + a.offset, bytes.length);
      const stride = Type.BYTES_PER_ELEMENT * a.itemSize, count = a.length / a.itemSize;
      for (let lane = 0; lane < stride; lane++) {
        let previous = 0;
        for (let v = 0; v < count; v++) {
          previous ^= encoded[lane * count + v]; bytes[v * stride + lane] = previous;
        }
      }
      attributes[name] = { array, itemSize: a.itemSize, normalized: !!a.normalized };
    }
    if (!attributes.position || !attributes.index) throw new Error('Incomplete surface');
    if (record.name === 'ground') {
      if (attributes._cover?.array.length !== attributes.position.array.length / 3) throw new Error('Incomplete ground cover');
      record.userData.coverCodes = attributes._cover.array;
      delete attributes._cover;
    } else if (!Number.isInteger(record.userData.topVertexCount) || record.userData.topVertexCount < 0 ||
               record.userData.topVertexCount > attributes.position.array.length / 3) throw new Error('Invalid pavement');
    if (record.name === 'asphalt') {
      if (!attributes._contourLengths || !attributes._contourPoints) throw new Error('Incomplete curb boundaries');
      const lengths = attributes._contourLengths.array, points = attributes._contourPoints.array;
      if (lengths.reduce((n, v) => n + v, 0) * 2 !== points.length) throw new Error('Invalid curb boundary');
      let cursor = 0;
      record.userData.contours = Array.from(lengths, length => Array.from({ length }, () => [points[cursor++], points[cursor++]]));
      delete attributes._contourLengths; delete attributes._contourPoints;
    }
    result.set(record.name, { attributes, userData: record.userData });
  }
  if (result.size !== NAMES.length) throw new Error('Incomplete surface asset');
  return result;
}

export async function loadSurfaceAsset(site, seed, directory, { timeoutMs = 1200 } = {}) {
  if (!globalThis.DecompressionStream || !globalThis.crypto?.subtle) return null;
  if (globalThis.navigator?.connection?.saveData || /^(slow-)?2g$/.test(globalThis.navigator?.connection?.effectiveType)) return null;
  // Never turn a CPU saving into an unbounded wait on a slow first download.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const key = await surfaceKey(site, seed);
    const response = await fetch(`${directory}/surfaces.json`, { signal: controller.signal });
    if (!response.ok) return null; // unprepared scenes retain the procedural path
    const manifest = await response.json();
    if (manifest.version !== SURFACE_VERSION || manifest.key !== key ||
        !/^surfaces-[a-f0-9]{16}\.bin\.gz$/.test(manifest.file)) return null;
    const data = await fetch(`${directory}/${manifest.file}`, { signal: controller.signal });
    if (!data.ok) return null;
    const buffer = await new Response(data.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    // A deployment or interrupted download must never leave half a sidewalk.
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    const digest = [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('');
    if (digest !== manifest.sha256) throw new Error('Surface asset checksum mismatch');
    if (controller.signal.aborted) return null;
    return { key, buffer };
  } catch (error) {
    if (!controller.signal.aborted) console.warn('Precomputed surfaces unavailable; generating locally.', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
