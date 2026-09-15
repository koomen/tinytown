import test from 'node:test';
import assert from 'node:assert/strict';
import {fbm} from '../../src/noise.js';
import {terrainPaintNoise} from '../../src/terrain-paint.js';

const town={size:{w:472.47040567512147,h:760.1682117961303}};
const regional={size:{w:3285.6908209074863,h:3556.6740000002137},townCenter:{x:352.213011075,z:-393.5162000003}};
const original=(x,z)=>({texture:fbm(x*.2+3,z*.2+5),grain:(fbm(x*1.3,z*1.3)-.5)*.025,meadow:fbm(x*.045+21,z*.045+9)-.5});

test('small Avon keeps its original grass color noise exactly',()=>{
  for(let x=-town.size.w/2;x<=town.size.w/2;x+=7.71)for(let z=-town.size.h/2;z<=town.size.h/2;z+=9.83)
    assert.deepEqual(terrainPaintNoise(x,z,town),original(x,z));
});

test('regional town core keeps full grass detail in the geographic frame',()=>{
  for(let x=-250;x<=250;x+=11.3)for(let z=-390;z<=390;z+=13.9){
    const px=x+regional.townCenter.x,pz=z+regional.townCenter.z;
    assert.deepEqual(terrainPaintNoise(px,pz,regional),original(px,pz));
  }
});

// Sample the actual triangle interpolation used by terrain cells. A distant
// bridge can refine either axis from 12 m to 0.5 m. The same rural meadow must
// retain its appearance as those strips meet, instead of revealing new noise.
function triangles(sample,x,z,sx,sz){
  const i=Math.floor(x/sx)*sx,j=Math.floor(z/sz)*sz,u=(x-i)/sx,v=(z-j)/sz;
  const a=sample(i,j),b=sample(i+sx,j),c=sample(i,j+sz),d=sample(i+sx,j+sz);
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}

test('bridge refinement cannot introduce a grass cross beside Spring Street',()=>{
  const sample=(x,z)=>terrainPaintNoise(x,z,regional).texture;
  let max=0,sum=0,n=0;
  // Local centered coordinates cover the hill and the two bridge strips.
  for(let x=-1270;x<-1020;x+=3.37)for(let z=50;z<350;z+=3.19){
    const coarse=triangles(sample,x,z,12,12);
    for(const [sx,sz] of [[.5,12],[12,.5],[.5,.5]]){
      const error=Math.abs(coarse-triangles(sample,x,z,sx,sz));
      max=Math.max(max,error);sum+=error;n++;
    }
  }
  assert.ok(max<.025,`maximum tint change from refinement: ${max}`);
  assert.ok(sum/n<.004,`mean tint change from refinement: ${sum/n}`);
});

test('grass detail blends continuously into rural terrain at all four boundaries',()=>{
  const eps=1e-5;
  for(const [axis,core] of [['x',260],['z',400]])for(const sign of [-1,1])for(const offset of [0,250]){
    const p={...regional.townCenter};p[axis]+=sign*(core+offset);
    const a=terrainPaintNoise(p.x-(axis==='x'?eps:0),p.z-(axis==='z'?eps:0),regional);
    const b=terrainPaintNoise(p.x+(axis==='x'?eps:0),p.z+(axis==='z'?eps:0),regional);
    for(const key of ['texture','grain','meadow'])assert.ok(Math.abs(a[key]-b[key])<1e-5,`${axis} ${sign} ${offset} ${key}`);
  }
});
