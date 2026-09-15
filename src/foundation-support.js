// Only shorten a blueprint wall when the footprint supports its whole volume.
// Authored rectangles can extend beyond a concave OSM footprint; those still
// need their below-grade walls. Ignore the small rounded wall-edge overhang.
export function foundationSupportsVolume(footprint, volume) {
  if (volume.polygon || !volume.u || !volume.v) return false;
  const inset = .12;
  const x0 = volume.u[0] + inset, x1 = volume.u[1] - inset;
  const z0 = volume.v[0] + inset, z1 = volume.v[1] - inset;
  if (x1 <= x0 || z1 <= z0) return false;
  const inside = (x,z) => {
    let hit = false;
    for (let i = 0, j = footprint.length-1; i < footprint.length; j=i++) {
      const a=footprint[i], b=footprint[j];
      if ((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) hit=!hit;
    }
    return hit;
  };
  if (![[x0,z0],[x1,z0],[x1,z1],[x0,z1]].every(([x,z])=>inside(x,z))) return false;
  // Even with all four corners inside, a re-entrant footprint edge can cross
  // the rectangle. Intersect every edge with its open interior to catch that.
  for (let i=0; i<footprint.length; i++) {
    const a=footprint[i], b=footprint[(i+1)%footprint.length];
    let lo=0, hi=1;
    for (const [axis,min,max] of [[0,x0,x1],[1,z0,z1]]) {
      const delta=b[axis]-a[axis];
      if (Math.abs(delta)<1e-10) {
        if (a[axis]<=min || a[axis]>=max) {hi=-1;break;}
      } else {
        const p=(min-a[axis])/delta, q=(max-a[axis])/delta;
        lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));
      }
    }
    if (hi-lo>1e-8) return false;
  }
  return true;
}
