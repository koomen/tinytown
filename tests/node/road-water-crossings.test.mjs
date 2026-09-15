import test from 'node:test';
import assert from 'node:assert/strict';
import {roadWaterCrossings} from '../../src/road-water-crossings.js';
import {createStreetGrade} from '../../src/street-grade.js';
const road={id:1,class:'primary',bridge:'yes',width:10,pts:[[-25,0],[25,0]]};
const stream={kind:'water',width:8,pts:[[0,-100],[0,100]]};
const grade=(x,z)=>4+x*.013+z*.009;

test('mapped bridge roads stay at their original grade while water and bed lie below them',()=>{
 const source=structuredClone(road),c=roadWaterCrossings([road],[stream],grade);
 assert.equal(c.crossings.length,1);assert.deepEqual(road,source);
 for(let x=-3;x<=3;x+=.25)for(let z=-5;z<=5;z+=.25){
  assert.ok(grade(x,z)+.04-c.water(x,z)>1.15);
  assert.ok(c.water(x,z)-c.bed(x,z)>.5);
 }
 assert.ok(Math.abs(c.water(0,80)-grade(0,80)-.12)<1e-10);
 assert.equal(c.bed(0,80),grade(0,80));
});

test('sparse rural triangles still leave the whole bridge above its water',()=>{
 const axis=Float64Array.from({length:25},(_,i)=>-144+i*12),grid={xs:axis,zs:axis,nx:24,nz:24};
 const c=roadWaterCrossings([road],[stream],grade),water=createStreetGrade(c.water,288,288,grid),bed=createStreetGrade(c.bed,288,288,grid);
 for(let x=-3;x<=3;x+=.2)for(let z=-5;z<=5;z+=.2){
  assert.ok(grade(x,z)+.04-water(x,z)>1.1);
  assert.ok(water(x,z)-bed(x,z)>.45);
 }
});

test('the channel remains wet through both transition shoulders on shifted rural grids',()=>{
 for(const shift of [0,3,6,9]){
  const axis=Float64Array.from({length:25},(_,i)=>-144+i*12+shift),grid={xs:axis,zs:axis,nx:24,nz:24};
  const c=roadWaterCrossings([road],[stream],grade),water=createStreetGrade(c.water,288,288,grid),bed=createStreetGrade(c.bed,288,288,grid);
  for(let z=-45;z<=45;z+=.2)for(let x=-3;x<=3;x+=.5)
   assert.ok(water(x,z)>bed(x,z)+.015,`dry channel at ${x},${z} with grid shift ${shift}`);
 }
});

test('ordinary roads, fixed-level lakes and the separate authored bridge system are unaffected',()=>{
 assert.equal(roadWaterCrossings([{...road,bridge:undefined}],[stream],grade).crossings.length,0);
 assert.equal(roadWaterCrossings([{...road,bridge:'no'}],[stream],grade).crossings.length,0);
 const lake={kind:'water',closed:true,level:3,pts:[[-40,-40],[40,-40],[40,40],[-40,40]]};
 assert.equal(roadWaterCrossings([road],[lake],grade).crossings.length,0);
 const c=roadWaterCrossings([road],[stream],grade);
 for(const p of [[-60,0],[60,0],[100,100]])assert.equal(c.bed(...p),grade(...p));
});
