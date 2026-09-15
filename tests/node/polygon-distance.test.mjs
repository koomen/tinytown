import assert from 'node:assert/strict';
import test from 'node:test';
import { polygonDistanceField } from '../../src/polygon-distance.js';

function reference(polygons, x, z, band) {
  let best = band;
  for (const p of polygons) {
    let inside = false, d = Infinity;
    for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
      const [ax, az] = p[a], [bx, bz] = p[b], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz || 1)));
      d = Math.min(d, Math.hypot(x-ax-t*dx, z-az-t*dz));
      if ((az > z) !== (bz > z) && x < dx*(z-az)/dz+ax) inside = !inside;
    }
    best = Math.min(best, inside ? -d : d);
  }
  return Math.max(-band, best);
}

test('indexed distance matches exhaustive polygon unions at edges, corners, and overlaps', () => {
  const shapes = [
    [[-15,-8],[0,-8],[0,4],[-5,4],[-5,-2],[-15,-2]],
    [[-8,-4],[9,-4],[8,7],[-8,7]],
    [[2,10],[24,14],[24,16],[2,12],[2,10]],
    // A ring with a doubled connecting edge, like the circular road outline.
    [[-16,10],[-6,10],[-6,20],[-16,20],[-16,10],[-14,12],[-14,18],[-8,18],[-8,12],[-14,12]],
  ];
  for (const polygons of [shapes, ...shapes.map(s => [s]), []]) {
    const distance = polygonDistanceField(polygons, 2);
    for (let z=-12; z<=24; z+=0.25) for (let x=-20; x<=28; x+=0.25) {
      assert.ok(Math.abs(distance(x,z)-reference(polygons,x,z,2))<1e-10, `${x},${z}`);
    }
  }
});

test('regional diagonal and concave road bands preserve exact signed distances',()=>{
  const shapes=[
    [[-1600,-1700],[-1590,-1700],[1600,1700],[1590,1700]],
    [[-1400,1500],[-1400,1450],[1300,-1500],[1350,-1500]],
    [[-1200,-1000],[1200,-1000],[1200,1000],[1180,1000],[1180,-980],[-1180,-980],[-1180,1000],[-1200,1000]],
  ];
  const field=polygonDistanceField(shapes,8);
  for(let i=0;i<3000;i++) {
    const x=Math.sin(i*13.17)*1700,z=Math.cos(i*7.33)*1800;
    assert.ok(Math.abs(field(x,z)-reference(shapes,x,z,8))<1e-8);
  }
});
