import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothWatercourse} from '../../src/watercourse.js';
import {ribbonStrip} from '../../src/landmark-ribbon.js';

test('rounded watercourses retain shared endpoints and stay near the mapped bend',()=>{
  const input=[[0,0],[30,0],[30,40]],out=smoothWatercourse(input,8);
  assert.deepEqual(out[0],input[0]);assert.deepEqual(out.at(-1),input.at(-1));
  assert.ok(out.length>input.length);
  for(const [x,z] of out) {
    assert.ok(Number.isFinite(x)&&Number.isFinite(z));
    assert.ok(x>=0&&x<=30&&z>=0&&z<=40);
    assert.ok(Math.min(Math.abs(z),Math.abs(x-30))<=6.4);
  }
  assert.deepEqual(input,[[0,0],[30,0],[30,40]]);
});

test('variable river widths retain shared banks and valid triangles',()=>{
  const pts=smoothWatercourse([[0,0],[30,0],[30,40]],8);
  const result=ribbonStrip(pts,([x,z])=>8+Math.sin(x*.1+z*.2));
  assert.equal(result.positions.length,pts.length*2);
  assert.equal(result.indices.length,(pts.length-1)*6);
  assert.ok(result.positions.flat().every(Number.isFinite));
  for(let i=0;i<pts.length;i++) {
    const a=result.positions[i*2],b=result.positions[i*2+1];
    const separation=Math.hypot(a[0]-b[0],a[1]-b[1]);
    assert.ok(separation>=7-1e-6&&separation<=18);
    assert.ok(Math.abs((a[0]+b[0])/2-pts[i][0])<1e-6);
    assert.ok(Math.abs((a[1]+b[1])/2-pts[i][1])<1e-6);
  }
});

test('zero-length segments cannot create NaN river banks',()=>{
  for(const input of [[],[[1,2]],[[1,2],[1,2]],[[0,0],[0,0],[10,0],[10,0],[10,10]]]) {
    const out=smoothWatercourse(input);
    assert.ok(out.flat().every(Number.isFinite));
    for(let i=1;i<out.length;i++)assert.ok(Math.hypot(out[i][0]-out[i-1][0],out[i][1]-out[i-1][1])>0);
  }
});
