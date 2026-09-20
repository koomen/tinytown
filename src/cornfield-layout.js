// Conservative row bands inside a surveyed polygon. Angles run from south
// toward east in the map's x/z frame; each band stops short of the headland.
export function cornfieldRows(points, {angle = 0, spacing = 1.6, width = 1.18, headland = 1.1} = {}) {
  if (points.length < 3 || !points.flat().every(Number.isFinite)) return [];
  spacing = Math.max(.8, spacing);
  // Leaves can overlap neighboring planting rows; the full leaf band must
  // still fit inside the polygon, including its concave notches.
  width = Math.max(.3, width);
  const c = Math.cos(angle), s = Math.sin(angle);
  const ring = points.map(([x, z]) => [x * c - z * s, x * s + z * c]);
  const world = (u, v) => [u * c + v * s, -u * s + v * c];
  const intervals = u => {
    const hits = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if ((a[0] > u) !== (b[0] > u)) hits.push(a[1] + (u - a[0]) / (b[0] - a[0]) * (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    return hits.filter((_, i) => i % 2 === 0).map((v, i) => [v, hits[i * 2 + 1]]);
  };
  const min = Math.min(...ring.map(p => p[0])), max = Math.max(...ring.map(p => p[0]));
  const rows = [];
  for (let u = min + headland + width / 2; u < max - headland - width / 2; u += spacing) {
    const left = u - width / 2, right = u + width / 2;
    // A concave corner can interrupt a band between its two edges. Sample
    // both sides of every polygon vertex in the band as well as its edges.
    const samples = [left, u, right];
    for (const [v] of ring) if (v > left && v < right) samples.push(v - 1e-7, v + 1e-7);
    let spans = intervals(samples[0]);
    for (const sample of samples.slice(1)) {
      const cuts = intervals(sample);
      spans = spans.flatMap(([a, b]) => cuts.map(([x, y]) => [Math.max(a, x), Math.min(b, y)]).filter(([x, y]) => y > x));
    }
    for (const [a, b] of spans) if (b - a > headland * 2 + .8) {
      rows.push({a:world(u, a + headland), b:world(u, b - headland), across:[c, -s], width});
    }
  }
  return rows;
}
