import test from 'node:test';
import assert from 'node:assert/strict';
import { cornfieldRows } from '../../src/cornfield-layout.js';

const inside = ([x,z],points) => {
  let hit=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
};

test('corn rows and their full widths stay inside rotated concave fields',()=>{
  const boundary=[[0,0],[75,0],[75,90],[42,90],[42,25],[38,25],[38,90],[0,90]];
  for(const angle of [0,.25,1.32,-.7]) {
    const rows=cornfieldRows(boundary,{angle});
    assert.ok(rows.length>10);
    for(const {a,b,across,width} of rows) for(let n=0;n<=20;n++) for(const side of [-.5,0,.5]) {
      const p=[a[0]+(b[0]-a[0])*n/20+across[0]*width*side,a[1]+(b[1]-a[1])*n/20+across[1]*width*side];
      assert.ok(inside(p,boundary),`row enters the hedgerow notch: ${p}`);
    }
  }
});

test('rows retain their planting direction and follow geographic recentering',()=>{
  const points=[[12,20],[70,33],[56,100],[-2,86]], angle=-.25;
  const a=cornfieldRows(points,{angle}),dx=139,dz=-72;
  const b=cornfieldRows(points.map(([x,z])=>[x-dx,z-dz]),{angle});
  assert.equal(a.length,b.length);
  a.forEach((row,i)=>{
    for(const key of ['a','b']) {
      assert.ok(Math.abs(row[key][0]-b[i][key][0]-dx)<1e-7);
      assert.ok(Math.abs(row[key][1]-b[i][key][1]-dz)<1e-7);
    }
    assert.ok(Math.abs((row.b[0]-row.a[0])*Math.cos(angle)-(row.b[1]-row.a[1])*Math.sin(angle))<1e-7);
  });
});

test('empty, non-finite and too-narrow fields produce no rows',()=>{
  for(const points of [[],[[0,0],[1,0]],[[0,0],[NaN,2],[2,0]],[[0,0],[.4,0],[.4,20],[0,20]]]) assert.deepEqual(cornfieldRows(points),[]);
});
