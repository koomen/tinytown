import * as THREE from 'three';
import { STREAM_VERSION } from './stream-format.js';
import { decodeStream, StreamObjectLoader } from './stream-loader.js';
import { selectDetailTiles, detailVisible, groundSampler } from './stream-policy.js';
import { surfaceMaterial } from './materials.js';
import { grainy } from './kit.js';
import { restoreCornSpriteMaterial } from './corn-sprites.js';

const MiB = 1024*1024;
// Tiles own their instance buffers, materials, textures and ordinary geometry.
// The base owns shared tree geometry, which survives individual tile eviction.
export function disposeStreamScene(root,sharedGeometries=new Set()) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{
    if(o.geometry) geometries.add(o.geometry);
    if(o.isInstancedMesh) o.dispose(); // frees renderer-owned instance buffers
    for(const m of o.material ? (Array.isArray(o.material)?o.material:[o.material]) : []) materials.add(m);
  });
  for(const m of materials) for(const t of Object.values(m)) if(t?.isTexture) textures.add(t);
  for(const g of geometries) if(!sharedGeometries.has(g))g.dispose();
  for(const m of materials) m.dispose();
  for(const t of textures) { t.dispose(); t.image?.close?.(); }
  root.removeFromParent(); root.clear();
}

async function decode(bytes,rawBytes,options,sharedGeometries={}) {
  const json=await decodeStream(bytes,rawBytes,options);
  const group=await new StreamObjectLoader(sharedGeometries).parseAsync(json);
  const seen=new Set();
  group.traverse(o=>{
    for(const m of o.material ? (Array.isArray(o.material)?o.material:[o.material]) : []) {
      if(seen.has(m)) continue; seen.add(m);
      if(m.userData.cornSprite) restoreCornSpriteMaterial(m);
      else if(m.userData.surface) {
        const template=surfaceMaterial(m.userData.surface,m.color.getHex(),m.vertexColors,{nightWindows:m.userData.nightWindows});
        m.onBeforeCompile=template.onBeforeCompile; m.customProgramCacheKey=template.customProgramCacheKey;
      } else if(m.vertexColors || o.isInstancedMesh) grainy(m);
    }
  });
  const byId=new Map();group.traverse(o=>byId.set(o.uuid,o));
  const smokes=(json.smokes||[]).map(e=>({...e,puffs:e.puffs.map(p=>({...p,mesh:byId.get(p.uuid)}))}));
  return {group,info:json.info,smokes};
}

async function download(directory,record,{signal,onProgress=()=>{}}={}) {
  if(record.parts) {
    if(!Array.isArray(record.parts) || !record.parts.length || record.parts.length>64
      || !Number.isSafeInteger(record.bytes) || record.bytes<1 || record.bytes>256*MiB
      || record.parts.some(p=>p.parts) || record.parts.reduce((n,p)=>n+p.bytes,0)!==record.bytes) throw new Error('Invalid stream asset parts');
    const parts=[];let received=0;
    for(const part of record.parts) {
      const bytes=await download(directory,part,{signal,onProgress:p=>onProgress((received+p*part.bytes)/record.bytes)});
      parts.push(bytes);received+=bytes.length;
    }
    return parts;
  }
  if(!/^[\w-]+\.bin\.gz$/.test(record.file)) throw new Error('Invalid stream asset name');
  if(!Number.isSafeInteger(record.bytes)||record.bytes<1||record.bytes>256*MiB)throw new Error('Invalid stream download size');
  signal?.throwIfAborted();
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);
  let timer,reader;
  const watch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(new DOMException('Scenery download stalled. Please retry.','TimeoutError')),30000);};
  signal?.addEventListener('abort',abort,{once:true});watch();
  try {
    const response=await fetch(`${directory}/${record.file}`,{signal:controller.signal});
    if(!response.ok) throw new Error(`Could not load ${record.file}: ${response.status}`);
    const bytes=new Uint8Array(record.bytes);let received=0;
    reader=response.body.getReader();
    for(;;) {
      const {done,value}=await reader.read();if(done)break;
      if(received+value.length>bytes.length)throw new Error(`Oversized stream asset ${record.file}`);
      bytes.set(value,received);received+=value.length;watch();onProgress(received/bytes.length);
    }
    clearTimeout(timer);
    if(received!==bytes.length) throw new Error(`Incomplete stream asset ${record.file}`);
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    const sha=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(sha!==record.sha256) throw new Error(`Damaged stream asset ${record.file}`);
    return bytes;
  } catch(error) {
    // A body reader can replace the signal's TimeoutError with a generic
    // AbortError. Preserve the reason so timeouts are reported and retried;
    // only an intentional stale-tile cancellation should be ignored.
    throw controller.signal.aborted ? controller.signal.reason : error;
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);
    await reader?.cancel().catch(()=>{});
  }
}

export async function loadStreamedSite(manifest,directory,{mobile=false,changed,onProgress=()=>{}}) {
  // Version 2 includes compact Avon's unchanged original baked scenery.
  if(![2,3,STREAM_VERSION].includes(manifest.version)) throw new Error('Unsupported streaming map version');
  onProgress(0,'downloading the landscape');
  const bytes=await download(directory,manifest.base,{onProgress:p=>onProgress(p*0.7,`downloading the landscape · ${Math.round(p*100)}%`)});
  onProgress(0.7,'unpacking the landscape');
  const base=await decode(bytes,manifest.base.rawBytes,{onProgress:p=>onProgress(0.7+p*0.2,'unpacking the landscape')});
  onProgress(1,'setting the diorama');
  const info=base.info;
  const sharedGeometries={};
  base.group.getObjectByName('stream-tree-library')?.traverse(o=>{
    if(o.geometry)sharedGeometries[o.geometry.uuid]=o.geometry;
  });
  const sharedGeometrySet=new Set(Object.values(sharedGeometries));
  // Navigation metadata can outlive a scene (for example while rebuilding).
  // Keep it independent of the shared geometry buffer.
  info.ground.heights=info.ground.heights.slice();
  if(info.ground.xs) info.ground.xs=info.ground.xs.slice();
  if(info.ground.zs) info.ground.zs=info.ground.zs.slice();
  info.lampPoolHeights=info.lampPoolHeights.slice();
  const street={...info,group:base.group,lamps:info.lamps.map(p=>new THREE.Vector3().fromArray(p)),
    surfaces:{grade:groundSampler(info)},smokes:[],prof:[]};
  const coarse=base.group.getObjectByName('stream-coarse');
  const coarseById=new Map(coarse.children.map(group=>[group.name,group]));
  const tiles=manifest.tiles.map(t=>({...t,box:new THREE.Box3(new THREE.Vector3().fromArray(t.bounds[0]),new THREE.Vector3().fromArray(t.bounds[1]))}));
  const byId=new Map(tiles.map(t=>[t.id,t]));
  const regions=manifest.regions||[],regionBySector=new Map(),loadedRegions=new Set();
  for(const region of regions)for(const id of region.sectors)regionBySector.set(id,region);
  const resident=new Map(),cache=new Map(),failures=new Map();
  const budgetBytes=(mobile?40:80)*MiB,cacheBudgetBytes=(mobile?4:8)*MiB,maxTiles=mobile?6:12;
  let desired=[],visibleSectors=[],inflight=null,disposed=false,detailEnabled=true,cacheBytes=0,loads=0,evictions=0,downloadBytes=manifest.base.bytes,cacheHits=0;
  let desiredRegions=[],preparing=false;
  let retryTimer;
  const residentBytes=()=>[...resident.keys()].reduce((n,id)=>n+byId.get(id).memoryBytes,0);
  function refreshed() {
    street.smokes=[...resident.values()].flatMap(t=>t.smokes);
    changed();
  }
  function evict(id) {
    const tile=resident.get(id); if(!tile)return;
    resident.delete(id);disposeStreamScene(tile.group,sharedGeometrySet);
    const fallback=coarseById.get(id);if(fallback)fallback.visible=visibleSectors.includes(id);
    evictions++;
  }
  function remember(id,bytes) {
    if(bytes.length>cacheBudgetBytes)return;
    if(cache.has(id)){cacheBytes-=cache.get(id).length;cache.delete(id);}
    cache.set(id,bytes);cacheBytes+=bytes.length;
    while(cacheBytes>cacheBudgetBytes){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).length;cache.delete(oldest);}
  }
  async function pump() {
    if(disposed||inflight||document.hidden)return;
    const retryable=id=>!failures.has(id)||(failures.get(id).attempts<3 && failures.get(id).retryAt<=Date.now());
    const region=desiredRegions.find(r=>!loadedRegions.has(r.id)&&retryable(`region:${r.id}`));
    const id=region?`region:${region.id}`:!preparing&&desired.find(id=>!resident.has(id)&&retryable(id));
    if(!id)return;
    const record=region||byId.get(id);
    // There is at most one fetch/decode in flight, so staging memory cannot
    // accumulate while the user pans faster than the network can respond.
    const request={id,record,region:!!region,controller:new AbortController()};inflight=request;
    let tile;
    try {
      let bytes=region?null:cache.get(id);
      if(bytes){cacheHits++;remember(id,bytes);}
      else {bytes=await download(directory,record,{signal:request.controller.signal});downloadBytes+=bytes.length;if(!region)remember(id,bytes);}
      request.controller.signal.throwIfAborted();
      // The worker takes ownership. Only retain an additional compressed
      // copy when this tile fits the small revisit cache.
      tile=await decode(cache.has(id)?bytes.slice():bytes,record.rawBytes,{signal:request.controller.signal},sharedGeometries);
      request.controller.signal.throwIfAborted();
      if(disposed)return;
      if(region) {
        if(!desiredRegions.includes(region))return;
        for(const sector of tile.group.children) {
          coarseById.set(sector.name,sector);
          sector.visible=visibleSectors.includes(sector.name)&&!resident.has(sector.name);
        }
        coarse.add(tile.group);loadedRegions.add(region.id);tile=null;
      } else {
        if(!desired.includes(id))return;
        street.group.add(tile.group);resident.set(id,tile);tile=null;
        const fallback=coarseById.get(id);if(fallback)fallback.visible=false;
        loads++;
      }
      failures.delete(id);refreshed();
    } catch(error) {
      if(error.name!=='AbortError'&&!disposed){
        const attempts=(failures.get(id)?.attempts||0)+1;
        const message=error.message||'Could not decode scene textures';
        failures.set(id,{attempts,retryAt:Date.now()+attempts*3000,message});
        console.warn(`Streaming ${id}: ${message}; retrying scenery.`);
        clearTimeout(retryTimer);retryTimer=setTimeout(()=>{changed();pump();},attempts*3000+50);
      }
    } finally {
      if(tile)disposeStreamScene(tile.group,sharedGeometrySet);
      inflight=null;
      if(!disposed){changed();pump();}
    }
  }
  const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),box=new THREE.Box3(),point=new THREE.Vector3(),extent=new THREE.Vector3();
  const streaming={
    // Wait only for the opening camera's landscape. Regions stay resident once
    // visited, so revisiting or zooming out cannot evict a landmark's silhouette.
    // Their combined memory is bounded by the former always-resident base.
    async prepare(camera,focus,onProgress=()=>{}) {
      if(!regions.length)return;
      preparing=true;
      try {
        streaming.update(camera,focus);
        const total=desiredRegions.reduce((n,r)=>n+r.bytes,0);
        while(desiredRegions.some(r=>!loadedRegions.has(r.id))) {
          if(disposed)throw new DOMException('Scene disposed','AbortError');
          const failed=desiredRegions.map(r=>failures.get(`region:${r.id}`)).find(Boolean);
          if(failed)throw new Error(failed.message);
          onProgress(total?desiredRegions.reduce((n,r)=>n+(loadedRegions.has(r.id)?r.bytes:0),0)/total:1);
          pump(); // resume a background-tab startup when it becomes visible
          await new Promise(resolve=>setTimeout(resolve,25));
        }
        onProgress(1);
      } finally {preparing=false;}
    },
    setDetailEnabled(enabled) { detailEnabled=!!enabled; changed(); },
    update(camera,focus) {
      if(disposed)return;
      const distance=camera.position.distanceTo(focus);
      const focusTileId=`${Math.floor(focus.x/100)}_${Math.floor(focus.z/100)}`;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      visibleSectors=[];
      let visibilityChanged=false;
      const candidates=tiles.map(t=>{
        // Cull a whole sector before traversing its buildings, trees and
        // surface batches, including during shadow passes. The margin keeps
        // nearby offscreen canopies available to cast shadows into the view.
        const inView=frustum.intersectsBox(box.copy(t.box).expandByScalar(40));
        if(inView)visibleSectors.push(t.id);
        const fallback=coarseById.get(t.id);
        if(fallback) {
          const visible=inView && !resident.has(t.id);
          if(fallback.visible!==visible)visibilityChanged=true;
          fallback.visible=visible;
        }
        t.box.clampPoint(focus,point);
        const near=Math.hypot(point.x-focus.x,point.z-focus.z);
        t.box.getCenter(point).applyMatrix4(camera.matrixWorldInverse);
        t.box.getSize(extent).multiplyScalar(.5);
        const view=camera.matrixWorldInverse.elements;
        const depthRadius=Math.abs(view[2])*extent.x+Math.abs(view[6])*extent.y+Math.abs(view[10])*extent.z;
        const visible=detailEnabled && inView && detailVisible({
          cameraDepth:-point.z,depthRadius,projectionScale:camera.projectionMatrix.elements[5],
          focusDistance:near,viewDistance:distance,resident:resident.has(t.id),
        });
        return {...t,visible,distance:near+1,focused:t.id===focusTileId,resident:resident.has(t.id)};
      });
      desired=selectDetailTiles(candidates,{budgetBytes,maxTiles});
      desiredRegions=[...new Set(candidates.filter(t=>visibleSectors.includes(t.id)).sort((a,b)=>a.distance-b.distance)
        .map(t=>regionBySector.get(t.id)).filter(Boolean))];
      if(inflight && !(inflight.region?desiredRegions.includes(inflight.record):desired.includes(inflight.id)))inflight.controller.abort();
      let removed=false;
      for(const id of resident.keys())if(!desired.includes(id)){evict(id);removed=true;}
      if(removed)refreshed();else if(visibilityChanged)changed();
      pump();
    },
    get stats() {return {
      detailEnabled,totalTiles:tiles.length,visibleSectors:[...visibleSectors],resident:[...resident.keys()],desired:[...desired],loading:inflight?.id??null,
      baseBytes:manifest.base.memoryBytes+regions.filter(r=>loadedRegions.has(r.id)).reduce((n,r)=>n+r.memoryBytes,0),residentBytes:residentBytes(),budgetBytes,cacheBytes,cacheBudgetBytes,
      loadedRegions:[...loadedRegions],desiredRegions:desiredRegions.map(r=>r.id),totalRegions:regions.length,
      sharedTreeGeometries:sharedGeometrySet.size,
      stagingRawBytes:inflight?.record.rawBytes??0,downloadBytes,loads,evictions,cacheHits,
      failures:[...failures].map(([id,f])=>({id,...f})),
    };},
    dispose() {
      disposed=true;inflight?.controller.abort();clearTimeout(retryTimer);
      for(const id of resident.keys())evict(id);
      cache.clear();cacheBytes=0;street.smokes=[];
      disposeStreamScene(street.group);
    },
  };
  return {street,streaming};
}
