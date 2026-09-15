import test from 'node:test';
import assert from 'node:assert/strict';
import { packSceneJSON, unpackSceneJSON } from '../../src/stream-format.js';
import { selectDetailTiles, detailVisible, groundSampler, useStreaming } from '../../src/stream-policy.js';

test('Every published miniature streams with explicit opt-out and complete authoring views',()=>{
  const mode=(query='',site='avon')=>useStreaming(new URLSearchParams(query),site);
  assert.equal(mode(),true);
  assert.equal(mode('','avon-extended'),true);
  assert.equal(mode('','chautauqua'),true);
  assert.equal(mode('stream=0','chautauqua'),false);
  assert.equal(mode('stream=0','avon-extended'),false);
  assert.equal(mode('time=night&quality=mobile'),true);
  assert.equal(mode('stream=0'),false);
  assert.equal(mode('stream=1'),true);
  assert.equal(mode('','unprepared'),false);
  assert.equal(mode('stream=1','prepared-neighbor'),true);
  for(const option of ['bp=123','isolate=123','stage=detail','procedural','notrees','nobake']) {
    assert.equal(mode(option),false,option);
    assert.equal(mode('stream=1&'+option),false,option+' keeps authoring complete');
  }
});

test('stream container roundtrips mixed typed arrays, subarrays, and empty arrays',async()=>{
  const input={text:'Avon 🌳',geometry:{positions:new Float32Array([1.25,-2,3]),
    indices:new Uint16Array([12,13,14,15]).subarray(1,3),normals:new Int16Array([-32767,0,32767]),empty:new Uint8Array()}};
  const buffer=await packSceneJSON(input).arrayBuffer();
  const result=unpackSceneJSON(buffer);
  assert.deepEqual(result,input);
  assert.equal(result.geometry.positions.buffer,buffer,'decode uses views rather than making another geometry copy');
});

test('stream container rejects truncated data and invalid array descriptors',async()=>{
  const buffer=await packSceneJSON({a:new Float32Array([1,2,3])}).arrayBuffer();
  for(const length of [0,4,9,buffer.byteLength-1]) assert.throws(()=>unpackSceneJSON(buffer.slice(0,length)));
  const bad=await packSceneJSON({a:{$array:'Float32Array',offset:-8,length:4}}).arrayBuffer();
  assert.throws(()=>unpackSceneJSON(bad),/Invalid streamed array/);
});

test('visible detail fits both memory and tile budgets, even when a nearby tile is too large',()=>{
  const tiles=[
    {id:'huge',distance:0,visible:true,memoryBytes:101},
    {id:'near',distance:1,visible:true,memoryBytes:60},
    {id:'hidden',distance:2,visible:false,memoryBytes:1},
    {id:'medium',distance:3,visible:true,memoryBytes:50},
    {id:'small',distance:4,visible:true,memoryBytes:30},
  ];
  assert.deepEqual(selectDetailTiles(tiles,{budgetBytes:100,maxTiles:2}),['near','small']);
  assert.deepEqual(selectDetailTiles(tiles,{budgetBytes:100,maxTiles:1}),['near']);
  assert.deepEqual(selectDetailTiles(tiles,{budgetBytes:0,maxTiles:6}),[]);
});

test('small boundary movements retain detail; moving to another neighborhood replaces it',()=>{
  const current={id:'old',distance:100,visible:true,resident:true,memoryBytes:60};
  const next={id:'next',distance:90,visible:true,memoryBytes:60};
  assert.deepEqual(selectDetailTiles([current,next],{budgetBytes:100,maxTiles:3}),['old']);
  assert.deepEqual(selectDetailTiles([current,{...next,distance:40}],{budgetBytes:100,maxTiles:3}),['next']);
});

test('overlapping neighbors cannot consume the mobile budget before the focused sector',()=>{
  const tiles=[
    {id:'-1_0',distance:1,visible:true,resident:true,memoryBytes:18},
    {id:'0_-1',distance:1,visible:true,resident:true,memoryBytes:15},
    {id:'0_0',distance:1,visible:true,focused:true,memoryBytes:13},
  ];
  assert.deepEqual(selectDetailTiles(tiles,{budgetBytes:40,maxTiles:6}),['0_0','-1_0']);
  assert.deepEqual(selectDetailTiles(tiles,{budgetBytes:12,maxTiles:6}),[],'focus priority cannot exceed the memory budget');
});

const projectionScale=1/Math.tan(26*Math.PI/360);
const detailAt=(distance,focusDistance=0,resident=false,scale=projectionScale)=>detailVisible({
  cameraDepth:distance,viewDistance:distance,focusDistance,resident,projectionScale:scale,
});

test('building detail survives the old zoom cutoff and remains useful much farther out',()=>{
  for(const distance of [740,750,760,1000,1500,1750]) assert.equal(detailAt(distance),true,`distance ${distance}`);
  assert.equal(detailAt(2400,0,true),false,'a full overview releases even central resident detail');
  assert.equal(detailAt(-100),false,'sectors behind the camera do not request detail');
});

test('close sectors retain visible foreground detail when their center passes behind the camera',()=>{
  const close={projectionScale,viewDistance:20,focusDistance:0,depthRadius:65};
  for(const cameraDepth of [-34,-1,0,1,20]) {
    assert.equal(detailVisible({...close,cameraDepth}),true,`sector center depth ${cameraDepth}`);
  }
  assert.equal(detailVisible({...close,cameraDepth:-66}),false,'bounds entirely behind the eye stay culled');
  assert.equal(detailVisible({...close,cameraDepth:-34,focusDistance:80}),false,'foreground exception keeps the close focus radius');
  assert.equal(detailVisible({...close,cameraDepth:2400,viewDistance:2400,resident:true}),false,'large sector bounds do not keep overview detail resident');
});

test('zooming out simplifies peripheral sectors before central sectors',()=>{
  const offsets=[0,80,160,230];
  const counts=[800,1100,1400,1750,2200].map(distance=>offsets.filter(offset=>detailAt(distance,offset)).length);
  assert.deepEqual(counts,[4,2,1,1,0]);
  assert.equal(detailAt(190,240),false,'nearby detail stays within the existing focus radius');
  assert.equal(detailAt(50,100),false,'close views keep a smaller detail radius');
});

test('zoom hysteresis retains detail through small reversals while accounting for field of view',()=>{
  assert.equal(detailAt(1900),false,'do not load tiny detail');
  assert.equal(detailAt(1900,0,true),true,'keep a resident tile through the same zoom');
  assert.equal(detailAt(2100,0,true),false,'release after passing the retention buffer');
  const wideScale=1/Math.tan(40*Math.PI/360);
  assert.equal(detailAt(1500,0,false,wideScale),false,'wider FOV makes a distant sector smaller');
  assert.equal(detailAt(1500*wideScale/projectionScale,0,false,wideScale),true,'equal projected size keeps the same detail');
});

test('ground navigation preserves triangle slopes and clamps to the map boundary',()=>{
  const sample=groundSampler({size:{w:2,d:2},offset:{x:10,z:20},ground:{nx:1,nz:1,heights:[0,2,4,10]}});
  assert.equal(sample(9.5,19.5),1.5);
  assert.equal(sample(10.5,20.5),6.5);
  assert.equal(sample(-100,-100),0);
  assert.ok(Math.abs(sample(100,100)-10)<0.0001);
});
