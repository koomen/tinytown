import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreetGrade} from '../../src/street-grade.js';
import {bridgeGrade} from '../../src/bridge-grade.js';

test('one-metre street grade reproduces a plane across triangle seams',()=>{
  const w=472,d=760;
  const plane=(x,z)=>x*.035+z*.017,grade=createStreetGrade(plane,w,d);
  for(let i=0;i<1000;i++) {
    const x=Math.sin(i*12.4)*w*.49,z=Math.cos(i*8.9)*d*.49;
    assert.ok(Math.abs(grade(x,z)-plane(x,z))<.00002);
  }
});

test('one-metre terrain retains small features on the expanded neighborhood',()=>{
  const w=472,d=760,source=(x,z)=>Math.abs(x)<.1&&Math.abs(z)<.1?2:0;
  const grade=createStreetGrade(source,w,d);
  assert.equal(grade(0,0),2);
  assert.equal(grade(1,0),0);
  assert.equal(grade(0,1),0);
});

test('bridge beds expose every span and approaches meet the deck',()=>{
  const b={id:1,obb:{cx:0,cz:0,w:60,d:4,angle:0},blueprint:{bridge:{type:'masonry-arch',height:8}}};
  const source=(x,z)=>x*.28+z*.03,{sample,floors}=bridgeGrade([b],source);
  assert.equal(floors.get('1'),0);
  for(let x=-28;x<=28;x+=2)assert.equal(sample(x,0),0);
  assert.ok(Math.abs(sample(30,0)-8)<1e-8);
  assert.equal(sample(200,0),source(200,0));
  assert.equal(sample(0,100),source(0,100));
  const plain=bridgeGrade([],source);assert.equal(plain.sample(7,4),source(7,4));
});


import {terrainGrid, axisFraction, townDensity, pavementGrid} from '../../src/terrain-grid.js';
import {groundSampler} from '../../src/stream-policy.js';

test('regional terrain bounds memory and preserves the geographic center resolution',()=>{
  const center={x:318,z:-170},g=terrainGrid(3286,3557,center);
  assert.ok((g.nx+1)*(g.nz+1)<1_000_000);
  for(const [axis,c,range] of [[g.xs,center.x,235],[g.zs,center.z,379]]) {
    assert.ok([...axis].every(Number.isFinite));
    for(let i=1;i<axis.length;i++) {
      assert.ok(axis[i]>axis[i-1]);
      if(axis[i-1]>=c-range && axis[i]<=c+range) assert.ok(axis[i]-axis[i-1]<=1.000001);
    }
  }
});

test('exported regional navigation uses identical offset terrain triangles',()=>{
  const size={w:3286,d:3557},offset={x:-318,z:170};
  const grid=terrainGrid(size.w,size.d,{x:-offset.x,z:-offset.z});
  const source=(x,z)=>Math.sin(x/40)*3+Math.cos(z/31),grade=createStreetGrade(source,size.w,size.d,grid);
  const values=new Float32Array((grid.nx+1)*(grid.nz+1));
  for(let j=0;j<=grid.nz;j++) for(let i=0;i<=grid.nx;i++) values[j*(grid.nx+1)+i]=source(grid.xs[i],grid.zs[j]);
  const navigation=groundSampler({size,offset,ground:{...grid,heights:values}});
  for(let i=0;i<1000;i++) {
    const x=Math.sin(i*7.3)*size.w*.55,z=Math.cos(i*5.1)*size.d*.55;
    assert.ok(Math.abs(navigation(x+offset.x,z+offset.z)-grade(x,z))<1e-9);
  }
});

test('rural lamps remain sparse in the geographic rather than slab center',()=>{
  const center={x:450,z:-120};
  assert.equal(townDensity(center.x,center.z,center),1);
  assert.equal(townDensity(center.x+200,center.z,center),1);
  assert.ok(townDensity(center.x+1400,center.z,center)<0.061);
  assert.ok(townDensity(center.x+800,center.z,center)<townDensity(center.x+500,center.z,center));
});

test('pavement warp splits transition crossings and preserves polygon edges',()=>{
  const grid=pavementGrid({x:20,z:-80}),source=[[-1000,-900],[900,800],[900,-900]];
  const mapped=grid.polygon(source);
  assert.ok(mapped.length>source.length);
  for(const [u,v] of mapped) {
    const [x,z]=grid.point(u,v);
    const onEdge=source.some((a,i)=>{
      const b=source[(i+1)%source.length],cross=(x-a[0])*(b[1]-a[1])-(z-a[1])*(b[0]-a[0]);
      return Math.abs(cross)<1e-6 && x>=Math.min(a[0],b[0])-1e-8 && x<=Math.max(a[0],b[0])+1e-8 && z>=Math.min(a[1],b[1])-1e-8 && z<=Math.max(a[1],b[1])+1e-8;
    });
    assert.ok(onEdge);
  }
  assert.deepEqual(grid.point(20,-80),[20,-80]);
  assert.equal(axisFraction(new Float64Array([0,1,5]),3),1.5);
});

test('regional terrain resolves narrow rotated bridge openings',()=>{
  const b={id:9,obb:{cx:-1200,cz:1000,w:80,d:4.5,angle:.63},blueprint:{bridge:{height:8}}};
  const source=(x,z)=>15+x*.018+Math.sin(z/19)*2;
  const bridge=bridgeGrade([b],source),grid=terrainGrid(3286,3557,{x:350,z:-393},[b]);
  const grade=createStreetGrade(bridge.sample,3286,3557,grid),base=bridge.floors.get('9');
  const c=Math.cos(b.obb.angle),s=Math.sin(b.obb.angle);
  for(let u=-38;u<=38;u+=.71) for(let v=-2;v<=2;v+=.43) {
    const x=b.obb.cx+c*u-s*v,z=b.obb.cz+s*u+c*v;
    assert.ok(Math.abs(grade(x,z)-base)<.02,`bridge bed at ${u},${v}`);
  }
});
