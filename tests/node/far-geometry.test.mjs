import test from 'node:test';
import assert from 'node:assert/strict';
import {compactFarAttributes,FAR_POSITION_STEP} from '../../src/far-geometry.js';
import {packSceneJSON,unpackSceneJSON} from '../../src/stream-format.js';

test('far geometry has bounded millimetre error and preserves source/detail buffers',async()=>{
  const attributes={
    position:{array:Float32Array.from({length:3000},(_,i)=>Math.sin(i*13.71)*2100),itemSize:3},
    normal:{array:new Int16Array([0,32767,0,-20000,25000,7000]),itemSize:3,normalized:true},
    color:{array:new Uint8Array([30,50,255,19,187,37]),itemSize:3,normalized:true},
  };
  const original=attributes.position.array.slice(),normal=attributes.normal.array.slice();
  const compact=compactFarAttributes(attributes);
  assert.deepEqual(attributes.position.array,original);
  assert.deepEqual(attributes.normal.array,normal);
  assert.equal(compact.color,attributes.color);
  assert.ok(compact.normal.array instanceof Int8Array);
  assert.equal(compact.normal.normalized,true);
  for(let i=0;i<original.length;i++) {
    assert.ok(Math.abs(compact.position.array[i]-original[i])<=FAR_POSITION_STEP/2+1e-6);
    assert.equal(compact.position.array[i]/FAR_POSITION_STEP,Math.round(compact.position.array[i]/FAR_POSITION_STEP));
  }
  for(let i=0;i<normal.length;i++)assert.ok(Math.abs(compact.normal.array[i]/127-normal[i]/32767)<=1/254+1e-6);
  const packed=packSceneJSON({attributes:compact}),restored=unpackSceneJSON(await packed.arrayBuffer());
  assert.deepEqual(restored.attributes.normal.array,compact.normal.array);
  assert.deepEqual(restored.attributes.position.array,compact.position.array);
});


import {assertStreamAssetSizes,MAX_STATIC_ASSET_BYTES} from '../../tinytown/web/stream-asset-limits.mjs';
test('stream preparation rejects an oversized base or detail asset before publication',()=>{
  assert.doesNotThrow(()=>assertStreamAssetSizes({base:{file:'base',bytes:MAX_STATIC_ASSET_BYTES},tiles:[]}));
  assert.throws(()=>assertStreamAssetSizes({base:{file:'base',bytes:MAX_STATIC_ASSET_BYTES+1},tiles:[]}),/base.*25 MiB/);
  assert.throws(()=>assertStreamAssetSizes({base:{file:'base',bytes:1},tiles:[{file:'tile',bytes:MAX_STATIC_ASSET_BYTES+1}]}),/tile.*25 MiB/);
});


import {compressedPartsStream,streamAssetRecords} from '../../src/stream-format.js';
import {gzipSync} from 'node:zlib';
test('gzip decoder consumes arbitrary part boundaries without a concatenation buffer',async()=>{
  const original=Float32Array.from({length:12000},(_,i)=>Math.sin(i*.13));
  const blob=packSceneJSON({values:original}),compressed=gzipSync(Buffer.from(await blob.arrayBuffer()));
  const parts=[new Uint8Array(compressed.subarray(0,1)),new Uint8Array(compressed.subarray(1,19)),new Uint8Array(compressed.subarray(19))];
  const decoded=await new Response(compressedPartsStream(parts).pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  assert.deepEqual(unpackSceneJSON(decoded).values,original);
  assert.ok(parts.every(p=>p===null),'consumed compressed parts should release their buffers');
});
test('host checks enumerate multipart base files rather than its oversized aggregate',()=>{
  const manifest={base:{bytes:30*1024*1024,parts:[{file:'one',bytes:20*1024*1024},{file:'two',bytes:10*1024*1024}]},tiles:[]};
  assert.doesNotThrow(()=>assertStreamAssetSizes(manifest));
  assert.deepEqual(streamAssetRecords(manifest).map(p=>p.file),['one','two']);
  assert.throws(()=>streamAssetRecords({base:{bytes:3,parts:[]},tiles:[]}),/Invalid/);
  assert.throws(()=>streamAssetRecords({base:{bytes:3,parts:[{bytes:2}]},tiles:[]}),/Invalid/);
});
