import test from 'node:test';
import assert from 'node:assert/strict';
import {swingLegPose} from '../../src/playground-frame.js';
test('both swing legs meet the beam and terrain-adjusted feet',()=>{
  for(const side of [-1,1])for(const ground of [-.2,.1,.35]){
    const p=swingLegPose(side,ground),dy=Math.cos(p.rotationX)*p.length/2,dz=Math.sin(p.rotationX)*p.length/2;
    assert.ok(Math.abs(p.y+dy-2.65)<1e-12);
    assert.ok(Math.abs(p.z+dz)<1e-12);
    assert.ok(Math.abs(p.y-dy-ground)<1e-12);
    assert.ok(Math.abs(p.z-dz-side*1.2)<1e-12);
  }
});
