// Tiny deterministic 2D value noise for painterly vertex tinting and ground
// bumps. Not fancy — just enough soft variation to kill the flat-color look.

function hash(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

// Two octaves, returns 0..1
export function fbm(x, z) {
  return valueNoise(x, z) * 0.65 + valueNoise(x * 2.7 + 13.1, z * 2.7 + 7.3) * 0.35;
}
