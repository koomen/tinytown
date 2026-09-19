// The generator suite needs a small scene for repeated software-rendered
// reloads. Derive it from the surviving Avon data; never publish or store a
// second miniature. The route/stream suites exercise the full region.
export function viewerFixture(source) {
  const site = structuredClone(source), w = 480, h = 760;
  const inside = ([x,z]) => Math.abs(x) <= w/2 && Math.abs(z) <= h/2;
  const clamp = ([x,z]) => [Math.max(-w/2,Math.min(w/2,x)),Math.max(-h/2,Math.min(h/2,z))];
  site.size = {w,h}; site.offset = {x:0,z:0};
  // Preserve the source samples around the test area without transferring
  // the entire region's elevation grid on every simulated phone startup.
  const t = site.terrain, dx=(t.x1-t.x0)/(t.cols-1), dz=(t.z1-t.z0)/(t.rows-1);
  const i0=Math.max(0,Math.floor((-w/2-t.x0)/dx)-1), i1=Math.min(t.cols-1,Math.ceil((w/2-t.x0)/dx)+1);
  const j0=Math.max(0,Math.floor((-h/2-t.z0)/dz)-1), j1=Math.min(t.rows-1,Math.ceil((h/2-t.z0)/dz)+1);
  site.terrain = {...t,x0:t.x0+i0*dx,x1:t.x0+i1*dx,z0:t.z0+j0*dz,z1:t.z0+j1*dz,
    cols:i1-i0+1,rows:j1-j0+1,
    values:Array.from({length:j1-j0+1},(_,j)=>t.values.slice((j+j0)*t.cols+i0,(j+j0)*t.cols+i1+1)).flat()};
  site.buildings = site.buildings.filter(b => inside(b.centroid));
  for (const key of ['roads','areas','landmarks','linear_features']) {
    site[key] = (site[key] || []).filter(f => f.pts?.some(inside)).map(f => ({...f,pts:f.pts.map(clamp)}));
  }
  site.pois = site.pois.filter(p => inside([p.x,p.z]));
  site.extras = site.extras.filter(p => inside([p.x,p.z]));
  return site;
}
