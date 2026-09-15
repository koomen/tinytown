// Shared terrain topology, dense around the geographic town center and sparse
// across farmland. Roads and navigation sample these same triangles.
export function terrainAxis(length, center = 0, core = 400) {
  const lo = -length / 2, hi = length / 2;
  if (length <= 900) return Float64Array.from({length: Math.round(length) + 1}, (_, i) => lo + i * length / Math.round(length));
  const values = [lo];
  for (let x = lo; x < hi;) {
    const distance = Math.abs(x - center);
    const step = distance <= core ? 1 : distance <= core + 250 ? 4 : 12;
    const boundaries = [center - core - 250, center - core, center + core, center + core + 250, hi];
    let next = Math.min(hi, x + step);
    for (const edge of boundaries) if (edge > x + 1e-8 && edge < next) next = edge;
    values.push(next); x = next;
  }
  return new Float64Array(values);
}

export function terrainGrid(width, depth, center = {x: 0, z: 0}, buildings = []) {
  const bridges=buildings.filter(b=>b.blueprint?.bridge);
  const refine=(axis,dimension)=>{
    if(!bridges.length) return axis;
    const points=[...axis];
    for(const b of bridges) {
      const o=b.obb,spec=b.blueprint.bridge,c=Math.abs(Math.cos(o.angle)),s=Math.abs(Math.sin(o.angle));
      const across=spec.wingWalls ? (spec.abutmentWidth??(spec.axis==='v'?o.w:o.d))+2*(spec.wingWalls.length??5) : 0;
      const w=spec.axis==='v'?Math.max(o.w,across):o.w,d=spec.axis==='v'?o.d:Math.max(o.d,across);
      const mid=dimension==='x'?o.cx:o.cz;
      const radius=(dimension==='x'?c*w+s*d:s*w+c*d)/2+2;
      const lo=Math.max(axis[0],mid-radius),hi=Math.min(axis.at(-1),mid+radius);
      const n=Math.ceil((hi-lo)/0.5);
      for(let i=0;i<=n;i++) points.push(lo+(hi-lo)*i/Math.max(1,n));
    }
    points.sort((a,b)=>a-b);
    return Float64Array.from(points.filter((p,i)=>!i || p-points[i-1]>1e-8));
  };
  const xs = refine(terrainAxis(width, center.x, 260),'x'), zs = refine(terrainAxis(depth, center.z, 400),'z');
  return {xs, zs, nx: xs.length - 1, nz: zs.length - 1};
}

export function axisFraction(axis, value) {
  if (value <= axis[0]) return 0;
  const last = axis.length - 1;
  if (value >= axis[last]) return last - 1e-9;
  let lo = 0, hi = last;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (axis[mid] <= value) lo = mid; else hi = mid; }
  return lo + (value - axis[lo]) / (axis[hi] - axis[lo]);
}

// Central density is unchanged; synthetic rural lighting falls to 6%.
export function townDensity(x, z, center = {x: 0, z: 0}, rural = 0.06) {
  const t = Math.max(0, Math.min(1, (Math.hypot(x - center.x, z - center.z) - 400) / 750));
  return 1 - (1 - rural) * t * t * (3 - 2 * t);
}

// Continuous piecewise-affine coordinates for pavement's occupancy grid.
// Split polygon edges at each bend so straight road boundaries stay straight.
export function pavementGrid(center = {x:0,z:0}, scale = 4) {
  const forward=(v,c)=>v<c-400?c-400+(v-c+400)/scale:v>c+400?c+400+(v-c-400)/scale:v;
  const inverse=(v,c)=>v<c-400?c-400+(v-c+400)*scale:v>c+400?c+400+(v-c-400)*scale:v;
  return {
    scale,
    point:(x,z)=>[inverse(x,center.x),inverse(z,center.z)],
    polygon(pts) {
      const out=[];
      for(let i=0;i<pts.length;i++) {
        const a=pts[i],b=pts[(i+1)%pts.length],ts=[0];
        for(const [axis,c] of [[0,center.x],[1,center.z]]) for(const boundary of [c-400,c+400]) {
          const t=(boundary-a[axis])/(b[axis]-a[axis]);
          if(t>0 && t<1) ts.push(t);
        }
        ts.sort((a,b)=>a-b);
        for(const t of ts) out.push([forward(a[0]+(b[0]-a[0])*t,center.x),forward(a[1]+(b[1]-a[1])*t,center.z)]);
      }
      return out;
    },
  };
}
