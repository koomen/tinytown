// Diorama palette — fresh greens, warm plaster and clay
// tile in clear sunshine. Tuned for ACES tone mapping and cool sky fill.

export const P = {
  // Sky dome / haze (also used for fog so the slab edges melt into the air)
  skyZenith: 0x86bee9,
  skyHorizon: 0xc5e1f5,
  skyGround: 0xabcfe6,
  haze: 0xc6e0f2,

  // Ground
  grass: 0x80a557,
  grassLight: 0xafd17b,   // sunlit tufts / vertex-noise highs
  grassDark: 0x598345,    // shaded vertex-noise lows
  lawns: [0x8aaf60, 0x80a557, 0x99b96d, 0x759d50],
  dirt: 0x9a7452,
  dirtDark: 0x7d5c40,

  // Paving
  lane: 0x9f9488,         // packed gravel / worn cobble
  laneLight: 0xb3a899,
  laneDark: 0x8a7f73,
  gutter: 0x7c7268,       // asphalt darkens toward the curb where the water runs
  paint: 0xd9b45a,        // faded centre-line yellow
  manhole: 0x76706a,
  curb: 0xbcb2a3,
  curbStone: 0xd9d1c3,    // pale kerb lip along the roads, light enough to read against the asphalt
  flagstone: 0xcbbfab,
  foundation: 0x7b746b,  // stone footing where a floor sits above the ground behind
  sidewalk: 0xd3cbbd,     // poured concrete slabs
  sidewalkAlt: 0xc7bfb0,
  crosswalk: 0xefe9dc,    // painted bars
  flagstoneAlt: 0xbdb09b,
  driveway: 0xbfb3a0,

  // Buildings
  walls: [0xefe3cc, 0xe9d6b8, 0xe7d0c1, 0xd8dcc4, 0xd3dadc, 0xf0e3d9, 0xe5d9c0, 0xdcd3c9],
  roofs: [0xc77a5b, 0xb86a4e, 0xa95c47, 0x7f8894, 0xb59263, 0x8e6f5b, 0xc4826a],
  roofRidge: 0x6f5646,
  trim: 0xf6efe2,
  timber: 0x7c5c43,
  timberDark: 0x5e4432,
  doors: [0xb35a4c, 0x5a8386, 0x6e8752, 0xc49a45, 0x785a7d],
  windowGlass: 0x819a9d,
  windowGlow: 0xffd39a,
  chimney: 0xa9998a,
  garageDoor: 0xe3d9c6,

  // Stone (garden walls, pebbles)
  stones: [0xb9afa2, 0xa89d90, 0xc7bdaf, 0x9f958a, 0xb3a89b],

  // Vegetation: soft sage greens a shade paler and bluer than the lawn (Tiny
  // Glade's trees read as pale eggs against the grass), one yellower for
  // variety; shade is a mid cool green, never dark, so undersides stay airy
  treeGreens: [0x82b565, 0x8bbc6c, 0x78ad60, 0x96c577, 0x7bb16b, 0xa0c87a, 0x73a963, 0x91bd67],
  treeShade: 0x5c8a5e,
  conifer: 0x4f7f55,
  coniferLight: 0x6a9a68,
  coniferTip: 0x9dbb82,   // pale new growth on the hem of each bough
  trunk: 0x7d5e43,
  barks: [0x7a5f48, 0x6e5a4a, 0x857058, 0x74604c],
  hedge: 0x628f45,
  hedgeLight: 0x7ea65a,
  flowers: [0xe88aa6, 0xeec96a, 0xf3ede0, 0xe58a68, 0xa98ad0, 0xf1b7c6],
  ivy: 0x5a8a42,

  // Props
  lampPole: 0x4f5652,
  lampGlow: 0xffe1a8,
  mailbox: 0x5d666c,
  mailFlag: 0xc9584a,
  smoke: 0xf2ece4,

  cars: [0xc96a5c, 0x6d95c2, 0x8fb06a, 0xdcbd6c, 0xe2ddd3, 0x8c88b2],
  carGlass: 0xc9dde3,
  wheel: 0x3a3a3f,
};
