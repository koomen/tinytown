import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionSurface,isDrapedSurface} from '../../src/surface-lod.js';
function grid(w,d,step=1) {
  const positions=[],normals=[],index=[];
  for(let j=0;j<=d;j++) for(let i=0;i<=w;i++) {positions.push(i*step,i*.02+j*.01,j*step);normals.push(0,1,0);}
  for(let j=0;j<d;j++) for(let i=0;i<w;i++){const a=j*(w+1)+i,b=a+w+1;index.push(a,b,a+1,b,b+1,a+1);}
  return {attributes:{position:{array:new Float32Array(positions),itemSize:3},normal:{array:new Float32Array(normals),itemSize:3}},index:new Uint32Array(index)};
}
const point=(a,i)=>Array.from(a.slice(i*3,i*3+3)).join(',');
function boundary(record) {
  const p=record.attributes.position.array,edges=new Map();
  for(let i=0;i<record.index.length;i+=3) for(let j=0;j<3;j++) {
    const a=point(p,record.index[i+j]),b=point(p,record.index[i+(j+1)%3]),key=a<b?`${a}|${b}`:`${b}|${a}`;
    edges.set(key,(edges.get(key)||0)+1);
  }
  return [...edges].filter(([,count])=>count===1).map(([key])=>key).sort();
}
test('surface detail retains every source triangle while distant interiors shrink',()=>{
  const source=grid(200,100),tiles=partitionSurface(source.attributes,source.index,{heightAt:(x,z)=>x*.02+z*.01});
  assert.equal(tiles.reduce((n,t)=>n+t.detail.index.length,0),source.index.length);
  assert.ok(tiles.reduce((n,t)=>n+t.coarse.index.length,0)<source.index.length*.3);
  for(const tile of tiles) assert.deepEqual(boundary(tile.coarse),boundary(tile.detail));
});
test('coarse/detail tile transitions retain identical edges and preserve bridge beds',()=>{
  const source=grid(200,100),tiles=partitionSurface(source.attributes,source.index,{preserve:(x,z)=>x>90&&x<110&&z>40&&z<60});
  for(const tile of tiles) {
    const original=tile.detail.attributes.position.array,coarse=new Set();
    for(let i=0;i<tile.coarse.attributes.position.array.length/3;i++)coarse.add(point(tile.coarse.attributes.position.array,i));
    for(let i=0;i<original.length/3;i++) if(original[i*3]>90&&original[i*3]<110&&original[i*3+2]>40&&original[i*3+2]<60) assert.ok(coarse.has(point(original,i)));
    assert.deepEqual(boundary(tile.coarse),boundary(tile.detail));
  }
});


test('only named draped geometry is simplified; small 3D equipment remains intact',()=>{
  assert.equal(isDrapedSurface(''),false);
  assert.equal(isDrapedSurface('swings'),false);
  assert.equal(isDrapedSurface('railway-rail'),false);
  assert.equal(isDrapedSurface('ground-bottom'),false);
  assert.equal(isDrapedSurface('landmark-ribbon'),true);
});

test('coarse ground clearance preserves exact tile seams and bridge vertices',()=>{
  const source=grid(40,40),heightAt=(x,z)=>x*.02+z*.01;
  const [tile]=partitionSurface(source.attributes,source.index,{heightAt,interiorDrop:.2,preserve:(x,z)=>x>15&&x<25&&z>15&&z<25});
  assert.deepEqual(boundary(tile.coarse),boundary(tile.detail));
  const p=tile.coarse.attributes.position.array;
  let lowered=0;
  for(let i=0;i<p.length;i+=3) {
    const delta=heightAt(p[i],p[i+2])-p[i+1];
    if(p[i]>15&&p[i]<25&&p[i+2]>15&&p[i+2]<25) assert.ok(Math.abs(delta)<1e-6);
    if(delta>.19) lowered++;
  }
  assert.ok(lowered>50);
});


import {compactFarAttributes,farPositionKey} from '../../src/far-geometry.js';
test('final packed far compaction preserves exact detail seams and bridge samples',()=>{
  const source=grid(200,100);
  for(let i=0;i<source.attributes.position.array.length;i++) source.attributes.position.array[i]+=.0037;
  const tiles=partitionSurface(source.attributes,source.index,{interiorDrop:.2,preserve:(x,z)=>x>90&&x<110&&z>40&&z<60});
  for(const tile of tiles) {
    const p=tile.coarse.attributes.position.array,keys=new Set();
    for(let i=0;i<tile.coarse.fixed.length;i++) if(tile.coarse.fixed[i]) keys.add(farPositionKey(p[i*3],p[i*3+1],p[i*3+2]));
    const compact={...tile.coarse,attributes:compactFarAttributes(tile.coarse.attributes,{preservePosition:(x,y,z)=>keys.has(farPositionKey(x,y,z))})};
    assert.deepEqual(boundary(compact),boundary(tile.detail));
    for(let i=0;i<tile.coarse.fixed.length;i++) if(tile.coarse.fixed[i]) assert.deepEqual(compact.attributes.position.array.slice(i*3,i*3+3),p.slice(i*3,i*3+3));
  }
});


test('a pavement skirt cannot hide the visible top outline from simplification',()=>{
  const source=grid(20,80),p=[...source.attributes.position.array],n=[...source.attributes.normal.array],index=[...source.index];
  const rim=[];
  for(let i=0;i<=20;i++)rim.push(i);
  for(let j=1;j<=80;j++)rim.push(j*21+20);
  for(let i=19;i>=0;i--)rim.push(80*21+i);
  for(let j=79;j>=1;j--)rim.push(j*21);
  // Duplicate the top edge for separate vertical-side normals, as actual
  // pavementGeometry does. Its bottom edge is the only open position seam.
  for(let k=0;k<rim.length;k++) {
    const a=rim[k],b=rim[(k+1)%rim.length],at=p.length/3;
    for(const [v,drop] of [[a,0],[a,.35],[b,0],[b,.35]]) {
      p.push(p[v*3],p[v*3+1]-drop,p[v*3+2]);n.push(1,0,0);
    }
    index.push(at,at+1,at+2,at+1,at+3,at+2);
  }
  const [tile]=partitionSurface({position:{array:new Float32Array(p),itemSize:3},normal:{array:new Float32Array(n),itemSize:3}},new Uint32Array(index));
  const top=new Set(rim.map(i=>point(source.attributes.position.array,i)));
  let checked=0;
  for(let i=0;i<tile.coarse.fixed.length;i++)if(top.has(point(tile.coarse.attributes.position.array,i))) {
    assert.equal(tile.coarse.fixed[i],1,'every top rim position must remain fixed, even though joined to a skirt');checked++;
  }
  assert.ok(checked>=rim.length);
});
