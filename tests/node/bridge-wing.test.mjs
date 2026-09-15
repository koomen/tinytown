import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeWing} from '../../src/bridge-wing.js';
import {bridgeGrade} from '../../src/bridge-grade.js';
import {terrainGrid} from '../../src/terrain-grid.js';
import {createStreetGrade} from '../../src/street-grade.js';

test('a freestanding historic bridge never raises an approach to its deck',()=>{
  const b={id:1,obb:{cx:0,cz:0,w:60,d:4.5,angle:0},blueprint:{bridge:{type:'masonry-arch',height:7.5,approaches:false}}};
  const {sample}=bridgeGrade([b],()=>0);
  for(const side of [-1,1]) for(let d=0;d<80;d+=.25)
    assert.equal(sample(side*(30+d),0),0,'both bridge ends remain freestanding');
});

test('four splayed wings retain the whole open road corridor',()=>{
  const length=19.047,pier=3.2,clearance=length/2-pier;
  for(const end of [-1,1]) for(const side of [-1,1]) {
    const wing=bridgeWing(length,pier,7.2,4.78,{length:5,splay:1.6,thickness:.55,endHeight:1.3},end,side);
    assert.equal(wing.positions.length,8);
    assert.equal(wing.indices.length,36);
    assert.ok(wing.positions.flat().every(Number.isFinite));
    assert.ok(wing.positions.every(([x])=>Math.abs(x)>clearance),'no concrete enters the road opening');
    assert.ok(wing.positions.every(([,y,z])=>side*z>3.4 && y<=4.78));
    assert.equal(wing.positions[6][1],1.3);
    const a=wing.positions[4],b=wing.positions[5],c=wing.positions[6];
    const topTriangle=wing.indices.slice(6,9).map(i=>wing.positions[i]);
    const [p,q,r]=topTriangle;
    const normalY=(q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]);
    assert.ok(normalY>0,'top face must face up on all mirrored wings');
  }
});

test('retained rail banks join both bridge ends without cliffs or terrain in the road',()=>{
  const spec={type:'steel-girder',height:5.5,pierWidth:3.2,abutmentWidth:7.2,
    wingWalls:{length:5,splay:1.6,thickness:.55,endHeight:1.3},approachLength:65,approachWidth:11,approachPlateau:12};
  for(const angle of [0,1.806,3.9]) {
    const b={id:1,obb:{cx:-454.004,cz:660.473,w:19.047,d:5,angle},blueprint:{bridge:spec}};
    const c=Math.cos(angle),s=Math.sin(angle),end=b.obb.w/2;
    const world=(u,v)=>[b.obb.cx+c*u-s*v,b.obb.cz+s*u+c*v];
    const raw=bridgeGrade([b],()=>0).sample;
    const grade=createStreetGrade(raw,2000,2000,terrainGrid(2000,2000,{x:0,z:0},[b]));
    for(const sign of [-1,1]) {
      for(let v=-12;v<=12;v+=.25) {
        assert.ok(Math.abs(raw(...world(sign*(end+.00001),v))-raw(...world(sign*(end-.00001),v)))<.001,'no height jump at an outer bridge edge');
      }
      for(const v of [-2,0,2]) {
        assert.ok(Math.abs(grade(...world(sign*end,v))-spec.height)<.04,'approach rails meet the deck');
        assert.equal(grade(...world(sign*(end+1),v)),spec.height,'level approach beyond the joint');
      }
      for(const side of [-1,1]) {
        const wing=bridgeWing(b.obb.w,spec.pierWidth,spec.abutmentWidth,4.78,spec.wingWalls,sign,side);
        const [u,y,v]=wing.positions[6];
        assert.ok(grade(...world(u,v))<y-.1,'bank stays below the outer wing tip');
      }
    }
    for(let u=-6.1;u<=6.1;u+=.5) for(let v=-12;v<=12;v+=.5)
      assert.ok(Math.abs(grade(...world(u,v)))<.001,'road and sidewalk corridor stays open');
  }
});
test('broad plateau meets deck and descends continuously without closing road',()=>{
  const b={id:1,obb:{cx:0,cz:0,w:19.047,d:5,angle:0},blueprint:{bridge:{height:5.5,approachLength:65,approachWidth:11,approachPlateau:12}}};
  const {sample}=bridgeGrade([b],()=>0);
  for(const x of [-5,0,5]) assert.equal(sample(x,0),0,'bed stays open');
  for(const end of [-1,1]) {
    for(const v of [-5,0,5]) assert.equal(sample(end*16,v),5.5,'wide rail approach stays level');
    let last=5.5;
    for(let d=22;d<90;d+=2) {const y=sample(end*d,0);assert.ok(y<=last+1e-8);last=y;}
    assert.equal(sample(end*90,0),0);
  }
});
