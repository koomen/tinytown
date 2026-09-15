import test from 'node:test';
import assert from 'node:assert/strict';
import { perimeterPanels } from '../../src/perimeter-layout.js';

test('mapped gate opening removes every panel across its lane',()=>{
  const panels=perimeterPanels([[-12,0],[0,0],[12,0]],[{point:[0,0],width:8}]);
  assert.ok(panels.length);
  assert.equal(panels.reduce((sum,[a,b])=>sum+Math.hypot(b[0]-a[0],b[1]-a[1]),0),16);
  for(const [a,b] of panels) assert.ok(Math.max(a[0],b[0])<=-4 || Math.min(a[0],b[0])>=4);
});
test('sloping and bent fence panels stay on mapped segments and retain disconnected ends',()=>{
  const panels=perimeterPanels([[0,0],[7,0],[7,5]],[]);
  assert.deepEqual(panels[0][0],[0,0]);assert.deepEqual(panels.at(-1)[1],[7,5]);
  for(const [a,b] of panels) assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])<=3.000001);
  assert.deepEqual(perimeterPanels([[0,0],[1,0]],[{point:[0,0],width:8}]),[]);
});
