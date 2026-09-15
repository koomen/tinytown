import test from 'node:test';
import assert from 'node:assert/strict';
import {drapeTriangles} from '../../src/landmark-drape.js';
import {createStreetGrade} from '../../src/street-grade.js';

test('water spanning a terrain ridge stays above the exact terrain triangles',()=>{
  const grid={xs:Float64Array.from([-20,-3,0,4,20]),zs:Float64Array.from([-8,-2,1,8]),nx:4,nz:3};
  const grade=createStreetGrade((x,z)=>4*Math.exp(-x*x/8)+z*.17,40,16,grid);
  const points=[[-18,-5],[-18,5],[18,-5],[18,5]],indices=[0,2,1,1,2,3];
  const draped=drapeTriangles(points,indices,grade,grid,.12);
  assert.ok(draped.indices.length>indices.length);
  for(let i=0;i<draped.indices.length;i+=3) {
    const tri=draped.indices.slice(i,i+3).map(j=>draped.positions.slice(j*3,j*3+3));
    for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]) {
      const p=[0,1,2].map(k=>tri.reduce((sum,v,j)=>sum+v[k]*weights[j],0));
      assert.ok(Math.abs(p[1]-grade(p[0],p[2])-.12)<1e-6,'each interior point must retain its lift');
    }
  }
});
test('all draped polygon fans face upward for either input winding',()=>{
  const grid={xs:Float64Array.from([0,2,4]),zs:Float64Array.from([0,2,4]),nx:2,nz:2};
  const points=[[.1,.2],[3.8,.1],[3.9,3.7],[.2,3.9]];
  for(const triangles of [[0,1,2,0,2,3],[0,2,1,0,3,2]]){
    const d=drapeTriangles(points,triangles,()=>0,grid);
    for(let i=0;i<d.indices.length;i+=3){
      const [a,b,c]=d.indices.slice(i,i+3).map(j=>d.positions.slice(j*3,j*3+3));
      const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
      assert.ok(ny>0);
    }
  }
});
