import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ribbonStrip} from '../../src/landmark-ribbon.js';

const scene=JSON.parse(readFileSync(new URL('../../data/avon-extended/site.json',import.meta.url)));
const authored=JSON.parse(readFileSync(new URL('../../sites/avon-extended/landmarks.json',import.meta.url)));
const scale=111320*Math.cos(scene.center.lat*Math.PI/180);
const project=([lon,lat])=>[(lon-scene.center.lon)*scale,-(lat-scene.center.lat)*111320];
const feature=id=>authored.features.find(f=>f.id===id);
const track=feature('avon-school-running-track');
const pts=track.coordinates.map(project);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);
const segmentDistance=(p,a,b)=>{
 const d=b.map((v,i)=>v-a[i]),t=Math.max(0,Math.min(1,d.reduce((s,v,i)=>s+v*(p[i]-a[i]),0)/d.reduce((s,v)=>s+v*v,0)));
 return distance(p,a.map((v,i)=>v+t*d[i]));
};
const edgeDistance=(p,ring)=>Math.min(...ring.map((a,i)=>segmentDistance(p,a,ring[(i+1)%ring.length])));

test('school track has two equal semicircles and parallel tangent straights',()=>{
 const joins=pts.map((p,i)=>({i,length:distance(p,pts[(i+1)%pts.length])})).filter(e=>e.length>10);
 assert.equal(joins.length,2);
 assert.ok(Math.abs(joins[0].length-joins[1].length)<.001);
 assert.ok(Math.abs(joins[0].length-81.3257)<.01,'preserve surveyed size');
 const [j,k]=joins.map(e=>e.i);
 const arcs=[pts.slice(0,j+1),pts.slice(j+1,k+1)];
 assert.equal(arcs[0].length,arcs[1].length);
 const centers=arcs.map(arc=>midpoint(arc[0],arc.at(-1)));
 const radii=arcs.map(arc=>distance(arc[0],arc.at(-1))/2);
 assert.ok(Math.abs(radii[0]-radii[1])<.001);
 assert.ok(Math.abs(radii[0]-41.0144)<.01);
 arcs.forEach((arc,end)=>{
  for(const p of arc) assert.ok(Math.abs(distance(p,centers[end])-radii[end])<.001,'circular turn');
  const diameter=arc[0].map((v,i)=>v-centers[end][i]);
  const axis=centers[1].map((v,i)=>v-centers[0][i]);
  assert.ok(Math.abs(diameter.reduce((sum,v,i)=>sum+v*axis[i],0))<.02,'turn tangent to straight');
 });
 const center=midpoint(...centers);
 for(let i=0;i<arcs[0].length;i++)assert.ok(distance(midpoint(arcs[0][i],arcs[1][i]),center)<.001,'rotational symmetry');
 assert.ok(distance(center,[411.1457,565.4764])<.01,'preserve location');
});

const northCenter=midpoint(pts[0],pts[96]),southCenter=midpoint(pts[97],pts[193]);
const center=midpoint(northCenter,southCenter);
const along=southCenter.map((v,i)=>(v-northCenter[i])/distance(northCenter,southCenter));
const across=[along[1],-along[0]];
const local=p=>[across,along].map(axis=>axis.reduce((sum,v,i)=>sum+v*(p[i]-center[i]),0));
const field=feature(140641617).coordinates.map(project);

test('football field is centered and aligned with the oval, retaining its dimensions',()=>{
 const corners=field.map(local);
 const expected=[[-1,1],[1,1],[1,-1],[-1,-1]];
 corners.forEach((p,i)=>{
  assert.ok(Math.abs(p[0]-expected[i][0]*51.46337/2)<.001,'equal sideline clearance');
  assert.ok(Math.abs(p[1]-expected[i][1]*108.24574/2)<.001,'equal end-zone clearance');
 });
});

test('matching red aprons follow the inner edge with equal clearance from the centered field',()=>{
 // Match the renderer's millimetre projection; a 5 cm underlap seals rounding seams.
 const rendered=pts.map(p=>p.map(v=>Math.round(v*1000)/1000));
 const inner=ribbonStrip(rendered,track.width-.1,true).positions.filter((p,i)=>i%2===1);
 const fieldHalfLength=distance(field[1],field[2])/2;
 const aprons=[];
 for(const [end,sign] of [['north',-1],['south',1]]){
  const apron=feature(`avon-school-track-${end}-apron`).coordinates.map(project);
  aprons.push(apron);
  const side=p=>sign*local(p)[1]-(fieldHalfLength+3);
  let chordEnds=0;
  for(const p of apron){
   assert.ok(side(p)>-.002,'apron stays beyond the field-facing chord');
   if(Math.abs(side(p))<.002)chordEnds++;
   else assert.ok(edgeDistance(p,inner)<.002,'curved boundary follows rendered inner edge');
  }
  assert.equal(chordEnds,2,'one straight field-facing boundary');
  for(const p of inner)if(side(p)>.002)assert.ok(edgeDistance(p,apron)<.002,'entire end curve is filled');
 }
 assert.equal(aprons[0].length,aprons[1].length);
 for(const p of aprons[0]){
  const opposite=p.map((v,i)=>2*center[i]-v);
  assert.ok(Math.min(...aprons[1].map(q=>distance(opposite,q)))<.003,'matching rotated end caps');
 }
 const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
 assert.ok(Math.abs(area(aprons[0])-area(aprons[1]))<.03,'equal apron areas within projection rounding');
});

test('built school track and aprons reproduce the authored geometry',()=>{
 for(const id of ['avon-school-running-track','avon-school-track-north-apron','avon-school-track-south-apron',140641617]){
  const built=scene.landmarks.find(f=>f.id===id),source=feature(id);
  assert.equal(built.pts.length,source.coordinates.length);
  source.coordinates.map(project).forEach((p,i)=>assert.ok(distance(p,built.pts[i])<.001));
 }
});
