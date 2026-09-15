import test from 'node:test';
import assert from 'node:assert/strict';
import {amphitheaterGardenGrade} from '../../src/amphitheater-garden-grade.js';
import {createStreetGrade} from '../../src/street-grade.js';
import {terrainGrid} from '../../src/terrain-grid.js';
import {shiftLandmark} from '../../src/landmark-frame.js';

const feature={pts:[],garden:{type:'carnahan-jackson',position:[.3,-.2],angle:-.6,depth:1.05}};
const world=([u,v])=>{const {position:[x,z],angle:a}=feature.garden;return[x+Math.cos(a)*u+Math.sin(a)*v,z-Math.sin(a)*u+Math.cos(a)*v];};
const original=(x,z)=>3+x*.013+z*.021;

test('the garden cut leaves the amphitheatre-side public path unchanged after terrain triangulation',()=>{
  const grid=terrainGrid(80,80),before=createStreetGrade(original,80,80,grid);
  const after=createStreetGrade(amphitheaterGardenGrade([feature],original),80,80,grid);
  for(let u=-30;u<=-10.65;u+=.15)for(let v=-10;v<=10;v+=.2){
    const p=world([u,v]);assert.equal(after(...p),before(...p));
  }
  for(const p of [[-.5,0],[-5.7,1.4],[-4.5,2.6],[-2.3,4.3],[.25,4.55]]){
    const q=world(p);assert.ok(before(...q)-after(...q)>.95,'the entire lower walk lies in the sunken garden');
  }
});

test('recentring the site preserves the garden excavation and leaves distant buildings untouched',()=>{
  const grade=amphitheaterGardenGrade([feature],original),dx=123.4,dz=-45.6;
  const shifted=amphitheaterGardenGrade([shiftLandmark(feature,dx,dz)],(x,z)=>original(x+dx,z+dz));
  for(let x=-20;x<=20;x+=.37)for(let z=-15;z<=15;z+=.41){
    assert.ok(Math.abs(grade(x,z)-shifted(x-dx,z-dz))<1e-10);
    if(Math.hypot(x,z)>15)assert.equal(grade(x,z),original(x,z));
  }
  assert.equal(amphitheaterGardenGrade([],original)(10,20),original(10,20));
  assert.equal(amphitheaterGardenGrade([{garden:{type:'carnahan-jackson'}}],original)(10,20),original(10,20));
});
