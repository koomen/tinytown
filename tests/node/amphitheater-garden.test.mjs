import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAmphitheaterGarden} from '../../src/amphitheater-garden.js';
import {GARDEN_BRIDGE as bridge,GARDEN_LOOP as loop,GARDEN_LOOP_WIDTH as width,
  distanceToPolyline} from '../../src/amphitheater-garden-grade.js';

// Unrotated at the origin on a gentle slope, so local garden coordinates are world x/z.
const grade=(x,z)=>.02*x-.015*z;
const garden=buildAmphitheaterGarden({garden:{type:'carnahan-jackson',position:[0,0],angle:0}},grade);
garden.updateMatrixWorld(true);
const named=name=>garden.children.filter(o=>o.name===name);
const vertices=mesh=>{
  const p=mesh.geometry.attributes.position,out=[];
  for(let i=0;i<p.count;i++)out.push([p.getX(i),p.getY(i),p.getZ(i)].map((v,k)=>v+[mesh.position.x,mesh.position.y,mesh.position.z][k]));
  return out;
};
const flags=named('garden-flagstone'),flagPoints=flags.flatMap(vertices);
const [north,south]=[bridge.v-bridge.length/2,bridge.v+bridge.length/2];

test('the upper pool has no spout, cascade or running water; three still pools remain',()=>{
  for(const name of ['garden-running-water','garden-water-highlight','garden-splash',
    'garden-cascade-head','garden-cascade-stone'])assert.equal(named(name).length,0,name);
  assert.equal(named('garden-splash-pool').length,3);
  assert.equal(garden.userData.garden.sourceDrop,undefined);
  assert.equal(named('garden-memorial-plaque').length,1);
});

test('the walk is one loop closed by the bridge deck',()=>{
  const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-9;
  assert.ok(near(loop[0],[bridge.u,north]),'starts at the north plank end');
  assert.ok(near(loop.at(-1),[bridge.u,south]),'ends at the south plank end');
  for(let i=1;i<loop.length;i++)
    assert.ok(Math.hypot(loop[i][0]-loop[i-1][0],loop[i][1]-loop[i-1][1])<.25,'no break in the loop');
  // Both ends leave along the bridge axis, in line with the deck.
  for(const [a,b] of [[loop[0],loop[1]],[loop.at(-1),loop.at(-2)]])assert.ok(Math.abs(b[0]-a[0])<.01);
  // The loop encloses all three pools (winding number around each centre).
  const circuit=[...loop,loop[0]];
  for(const pool of garden.userData.garden.pools) {
    let turn=0;
    for(let i=1;i<circuit.length;i++) {
      const a=Math.atan2(circuit[i-1][1]-pool.v,circuit[i-1][0]-pool.u),b=Math.atan2(circuit[i][1]-pool.v,circuit[i][0]-pool.u);
      turn+=Math.atan2(Math.sin(b-a),Math.cos(b-a));
    }
    assert.ok(Math.abs(Math.abs(turn)-2*Math.PI)<1e-6,`loop goes round the pool at v=${pool.v}`);
  }
});

test('flagstones follow the loop continuously without floating, overlapping or bridge pieces',()=>{
  for(const [x,,z] of flagPoints)assert.ok(distanceToPolyline(loop,x,z)<width/2+.01,'no stray flag');
  for(const [u,v] of loop)
    assert.ok(flags.some(f=>vertices(f).some(([x,,z])=>Math.hypot(x-u,z-v)<.7)),`loop covered at ${u},${v}`);
  for(const [x,,z] of flagPoints)
    assert.ok(!(Math.abs(x-bridge.u)<bridge.width/2&&z>north+.005&&z<south-.005),'no flags on the deck');
});

test('flagstones clear the pools and plantings and meet the plank ends',()=>{
  for(const wall of named('garden-pool-wall')) {
    const r=wall.geometry.parameters.radiusBottom;
    for(const [x,,z] of flagPoints)assert.ok(Math.hypot(x-wall.position.x,z-wall.position.z)>r+.1);
  }
  for(const shrub of named('garden-shrub')) {
    const r=Math.max(shrub.scale.x,shrub.scale.z);
    for(const [x,,z] of flagPoints)assert.ok(Math.hypot(x-shrub.position.x,z-shrub.position.z)>r,'path clear of shrub');
  }
  const deck=garden.userData.garden.bridge.deck;
  for(const end of [north,south]) {
    const tops=flagPoints.filter(([x,,z])=>Math.abs(x-bridge.u)<.4&&Math.abs(z-end)<.05).map(p=>p[1]);
    assert.ok(tops.length,'flags reach the bridge end');
    assert.ok(Math.abs(Math.max(...tops)-(deck+.03))<.02,'walk is level with the deck end');
  }
});

test('the lower stair landing runs on to join the loop',()=>{
  const {path,stairs}=garden.userData.garden;
  assert.ok(path.join,'the flight direction meets the loop');
  assert.ok(distanceToPolyline(loop,...path.landingEnd)<width/2,'landing tucks under the loop flags');
  const landing=named('garden-lower-landing')[0];
  const ys=vertices(landing).map(p=>p[1]);
  assert.ok(Math.abs(Math.max(...ys)-stairs.lower)<.03,'landing starts level with the stair foot');
});
