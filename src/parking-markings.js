// Paint is opt-in on surveyed parking rows; the same spacing locates the cars.
// Keep this planner independent of Three.js so containment can be checked offline.
function inside(ring, x, z) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) hit = !hit;
  }
  return hit;
}

export function planParkingMarkings(rows = [], {lots = [], roadEdge = () => Infinity} = {}) {
  const byId = new Map(lots.map(lot => [String(lot.id), lot])), lines = [];
  for (const row of rows) {
    if (row.kind !== 'parking-row' || !row.paint) continue;
    const lot = byId.get(String(row.parkingLotId));
    if (!lot || !row.pts?.length) continue;
    const outline = lot.osmPts || lot.pts, spacing = row.spacing || 3.1;
    const depth = row.depth || 5.6, width = row.lineWidth || .12;
    const add = (a, b) => {
      const length = Math.hypot(b[0]-a[0], b[1]-a[1]);
      const nx = -(b[1]-a[1])/length*width/2, nz = (b[0]-a[0])/length*width/2;
      // Test both edges along the whole stripe, including concave lot boundaries.
      for (let i = 0, n = Math.max(1, Math.ceil(length/.2)); i <= n; i++) {
        for (const side of [-1, 1]) {
          const x = a[0]+(b[0]-a[0])*i/n+side*nx, z = a[1]+(b[1]-a[1])*i/n+side*nz;
          if (!inside(outline, x, z) || (lot.holes || []).some(hole => inside(hole, x, z)) || roadEdge(x,z,row) < .2) return;
        }
      }
      lines.push({rowId: row.id, parkingLotId: row.parkingLotId, pts: [a,b], width, color: row.paintColor || '#eee9d6'});
    };
    for (let segment = 1; segment < row.pts.length; segment++) {
      const a = row.pts[segment-1], b = row.pts[segment], length = Math.hypot(b[0]-a[0], b[1]-a[1]);
      const count = Math.floor((length+1e-6)/spacing);
      if (!count) continue;
      const ux = (b[0]-a[0])/length, uz = (b[1]-a[1])/length;
      const angle = Math.atan2(-uz,ux)+(row.yawOffset || 0);
      const fx = Math.sin(angle)*depth/2, fz = Math.cos(angle)*depth/2;
      for (let i = 0; i <= count; i++) {
        const x = a[0]+ux*i*spacing, z = a[1]+uz*i*spacing;
        add([x-fx,z-fz], [x+fx,z+fz]);
      }
      if (row.backLine) {
        const face = row.face ?? 1;
        add([a[0]+fx*face,a[1]+fz*face], [a[0]+ux*count*spacing+fx*face,a[1]+uz*count*spacing+fz*face]);
      }
    }
  }
  return lines;
}
