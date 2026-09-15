// Named swatches used by overrides.json / blueprints, and the color lookup
// that also accepts "#rrggbb" strings and raw numbers.

export const WALL_COLORS = {
  white: 0xf3efe6, cream: 0xefe3cc, butter: 0xf0dfa8, sage: 0xc9d3b4, slate: 0xb9c3c9, rose: 0xe7cfc1,
  grey: 0xcfcbc3, tan: 0xd9c4a3, brick: 0xa85e48, darkbrick: 0x8d4d3d, redbrick: 0xb3634c, sand: 0xdcc9a8,
  stone: 0xbfb5a6, green: 0x8fa688, blue: 0x9db4c6, yellow: 0xe9d27a, brown: 0x8a6a52, black: 0x3d3a38,
  navy: 0x3f5068, red: 0xb04a3f, teal: 0x5f8a8c, olive: 0x7d8a52, paleblue: 0xb9c9cf, darkgreen: 0x35503f,
  limestone: 0xd2c6ad, khaki: 0xb8a878, glass: 0x8fa9b4, stucco: 0xebe6da, gold: 0xc9a44a,
};

export const ROOF_COLORS = {
  auto: null, slate: 0x6f7885, grey: 0x8c9196, tar: 0x585552, black: 0x3f3e3f, terracotta: 0xc47a5c,
  brown: 0x7d5f4c, green: 0x5f7a5a, red: 0xa0503f, tan: 0xb59263, copper: 0x6f8f7c, white: 0xe6e2d8,
};

export function col(table, key, fallback) {
  if (typeof key === 'number') return key;
  if (typeof key === 'string' && key[0] === '#') return parseInt(key.slice(1), 16);
  if (typeof key === 'string' && table[key] === undefined && WALL_COLORS[key] !== undefined) return WALL_COLORS[key];
  if (typeof key === 'string' && table[key] === undefined && ROOF_COLORS[key] !== undefined && ROOF_COLORS[key] !== null) return ROOF_COLORS[key];
  const v = table[key];
  return v === undefined || v === null ? fallback : v;
}
