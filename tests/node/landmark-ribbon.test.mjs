import test from 'node:test';
import assert from 'node:assert/strict';
import { ribbonStrip } from '../../src/landmark-ribbon.js';

function covers(point, strip) {
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<strip.indices.length;i+=3) {
    const [a,b,c]=strip.indices.slice(i,i+3).map(j=>strip.positions[j]);
    const signs=[cross(a,b,point),cross(b,c,point),cross(c,a,point)];
    if(signs.every(v=>v>=-1e-8)||signs.every(v=>v<=1e-8)) return true;
  }
  return false;
}
test('right-angle and obtuse ribbons share bend edges without an outside gap',()=>{
  for(const end of [[10,10],[15,8]]) {
    const strip=ribbonStrip([[0,0],[10,0],end],4);
    assert.equal(strip.positions.length,6);
    const first=new Set(strip.indices.slice(0,6)), second=new Set(strip.indices.slice(6));
    assert.deepEqual([...first].filter(i=>second.has(i)).sort(),[2,3]);
    assert.ok(covers([10.3,-.3],strip),'outer bend wedge must be covered');
  }
});
test('closed oval seam shares the first pair and all edges have finite coordinates',()=>{
  const pts=Array.from({length:24},(_,i)=>[40*Math.cos(i*Math.PI/12),90*Math.sin(i*Math.PI/12)]);
  const strip=ribbonStrip(pts,7,true);
  assert.equal(strip.positions.length,48);
  assert.ok(strip.positions.flat().every(Number.isFinite));
  assert.ok(strip.indices.slice(-6).includes(0));
  assert.ok(strip.indices.slice(-6).includes(1));
  for(let i=0;i<24;i++) assert.ok(covers(pts[i],strip));
});

test('ribbons face upward so water and tracks are visible from above',()=>{
  for(const points of [[[0,0],[10,0]],[[10,0],[0,0]],[[0,0],[10,0],[10,10]]]) {
    const strip=ribbonStrip(points,3);
    for(let i=0;i<strip.indices.length;i+=3) {
      const [a,b,c]=strip.indices.slice(i,i+3).map(j=>strip.positions[j]);
      const ny=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
      assert.ok(ny>0,'front side must face the sky');
    }
  }
});
