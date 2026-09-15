// Narrow-band signed distance to a union of polygons. Index edges, not only
// polygon bounds: a long road may contain thousands of segments, but only a
// few can affect a nearby pavement vertex. Row buckets answer the separate
// inside/outside test without walking the whole outline.
export function polygonDistanceField(polygons, band, binSize = 4) {
  const bins = new Map();
  const key = (x, z) => `${x},${z}`;
  for (const pts of polygons) {
    if (pts.length < 3) continue;
    const shape = { rows: new Map(), nearby: new Map() };
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [ax, az] = pts[a], [bx, bz] = pts[b];
      x0 = Math.min(x0, ax); x1 = Math.max(x1, ax);
      z0 = Math.min(z0, az); z1 = Math.max(z1, az);
      const dx = bx - ax, dz = bz - az;
      const e = { ax, az, bx, bz, dx, dz, inv: 1 / (dx * dx + dz * dz || 1) };
      for (let j = Math.floor(Math.min(az, bz) / binSize); j <= Math.floor(Math.max(az, bz) / binSize); j++) {
        if (!shape.rows.has(j)) shape.rows.set(j, []);
        shape.rows.get(j).push(e);
      }
      for (let j = Math.floor((Math.min(az, bz) - band) / binSize); j <= Math.floor((Math.max(az, bz) + band) / binSize); j++) {
        const at=z=>ax+dx*Math.max(0,Math.min(1,(z-az)/dz));
        const xa=dz?at(j*binSize-band):ax,xb=dz?at((j+1)*binSize+band):bx;
        for (let i = Math.floor((Math.min(xa, xb) - band) / binSize); i <= Math.floor((Math.max(xa, xb) + band) / binSize); i++) {
          const k = key(i, j);
          if (!shape.nearby.has(k)) shape.nearby.set(k, []);
          shape.nearby.get(k).push(e);
        }
      }
    }
    Object.assign(shape, { x0, x1, z0, z1 });
    // Index the polygon's occupied row spans plus its edge band. A diagonal
    // kilometre-long road must cost its width, not its enormous bounding box.
    const occupied = new Set(shape.nearby.keys());
    for (const [j, edges] of shape.rows) {
      let left=Infinity,right=-Infinity;
      for (const e of edges) {
        for (const z of [j*binSize,(j+1)*binSize]) {
          const t=e.dz ? Math.max(0,Math.min(1,(z-e.az)/e.dz)) : 0;
          const x=e.ax+t*e.dx;
          left=Math.min(left,x);right=Math.max(right,x);
        }
        if(!e.dz) {left=Math.min(left,e.bx);right=Math.max(right,e.bx);}
      }
      for(let i=Math.floor(left/binSize);i<=Math.floor(right/binSize);i++) occupied.add(key(i,j));
    }
    for(const k of occupied) {
      if(!bins.has(k)) bins.set(k,[]);
      bins.get(k).push(shape);
    }
  }
  return (x, z) => {
    const row = Math.floor(z / binSize), k = key(Math.floor(x / binSize), row);
    let distance = band;
    for (const s of bins.get(k) || []) {
      if (x < s.x0 - band || x > s.x1 + band || z < s.z0 - band || z > s.z1 + band) continue;
      let inside = false;
      for (const e of s.rows.get(row) || []) {
        if ((e.az > z) !== (e.bz > z) && x < e.dx * (z - e.az) / e.dz + e.ax) inside = !inside;
      }
      let d2 = band * band;
      for (const e of s.nearby.get(k) || []) {
        const t = Math.max(0, Math.min(1, ((x - e.ax) * e.dx + (z - e.az) * e.dz) * e.inv));
        const dx = x - e.ax - t * e.dx, dz = z - e.az - t * e.dz;
        d2 = Math.min(d2, dx * dx + dz * dz);
      }
      const d = Math.sqrt(d2);
      distance = Math.min(distance, inside ? -d : d);
      if (distance === -band) break;
    }
    return distance;
  };
}
