// Pure local-frame geometry shared by the renderer and terrain checks.
export function dugoutFooting(dugout, grade) {
  const [x, z] = dugout.position, a = dugout.angle || 0;
  const length = dugout.length ?? 6.8, depth = dugout.depth ?? 2.35;
  const world = (u, v) => [x + Math.cos(a) * u + Math.sin(a) * v, z - Math.sin(a) * u + Math.cos(a) * v];
  const corners = [-1, 1].flatMap(u => [-1, 1].map(v => world(u * length / 2, v * depth / 2)));
  // Sample the full floor as well as its corners: a small terrain ridge must
  // not poke through a level slab between the four supports.
  const heights = [], nx = Math.ceil(length), nz = Math.ceil(depth);
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    heights.push(grade(...world(length * (i / nx - .5), depth * (j / nz - .5))));
  }
  return { length, depth, corners, floor: Math.max(...heights) + .12, bottom: Math.min(...heights) - .12, world };
}
