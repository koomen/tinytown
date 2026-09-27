import * as THREE from 'three';
import { generateSite } from '../../src/site.js';
import { compactFarAttributes, farPositionKey } from '../../src/far-geometry.js';
import { partitionSurface, isDrapedSurface } from '../../src/surface-lod.js';
import { bakeMobile } from '../../src/bake.js';
import { coarseCanopy, coarseConifer } from '../../src/tree-lod.js';
import { landscapeTreeProxy } from '../../src/vegetation.js';
import { packSceneJSON, STREAM_VERSION, STREAM_PART_BYTES } from '../../src/stream-format.js';

const CELL = 100;
// Detail tiles above this estimated memory are split into quadrants; phones
// hold 40 MiB of detail, so one tile should stay well under a quarter of it.
const DETAIL_CAP = 8*1024*1024, MIN_SECTOR = 25;
// An offline export has no frame to keep responsive. bakeMobile's default
// setTimeout(0) yields nest, get clamped to 4 ms, and left the export mostly idle.
const NO_YIELD = {yieldBuild:async()=>{}};
// three.js UUIDs are random, so every export used to produce new bytes and new
// chunk names. Renumber them per chunk in order of appearance, which makes a
// chunk's bytes depend only on its contents. Geometries shared from the base's
// tree library (`shared`: live uuid -> stable id) keep one id in every chunk.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function stableIds(json, shared = new Map()) {
  const local = new Map();
  const id = uuid => shared.get(uuid) ?? local.get(uuid)
    ?? local.set(uuid,`00000000-0000-4000-8000-${local.size.toString(16).padStart(12,'0')}`).get(uuid);
  // Copies rather than edits: toJSON hands out live userData objects.
  const copy = value => {
    if (typeof value === 'string') return value.length === 36 && UUID.test(value) ? id(value) : value;
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return value;
    if (Array.isArray(value)) return value.map(copy);
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v)]));
  };
  return copy(json);
}
// Gzip and SHA-256 in the browser. The Node bake passes synchronous zlib and
// crypto instead: awaiting a stream per chunk left its exporter mostly idle.
const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
export const webCodec={
  gzip:async blob=>new Uint8Array(await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()),
  sha256:async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes)),
};
// A content-derived id (version nibble 5, so never a renumbered local id).
async function geometryId(g,codec) {
  const parts=[];
  for (const [name,a] of Object.entries(g.attributes)) parts.push(`${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name};`,a.array);
  if (g.index) parts.push('index;',g.index.array);
  parts.push(JSON.stringify(g.groups));
  const h=await codec.sha256(new Uint8Array(await new Blob(parts).arrayBuffer()));
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function sceneJSON(root, extra = {}, sharedGeometries = new Set()) {
  const meta = Object.fromEntries(['geometries','materials','textures','images','shapes','skeletons','animations','nodes'].map(k=>[k,{}]));
  root.traverse(o => {
    const g = o.geometry;
    if (!g || meta.geometries[g.uuid]) return;
    if(sharedGeometries.has(g)) {meta.geometries[g.uuid]={uuid:g.uuid,shared:true};return;}
    const attr = a => ({itemSize:a.itemSize,type:a.array.constructor.name,array:a.array,normalized:a.normalized,
      ...(a.isInstancedBufferAttribute?{isInstancedBufferAttribute:true,meshPerAttribute:a.meshPerAttribute}:{})});
    meta.geometries[g.uuid] = {uuid:g.uuid,type:g.isInstancedBufferGeometry?'InstancedBufferGeometry':'BufferGeometry',data:{
      attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,attr(a)])),
      ...(g.index ? {index:attr(g.index)} : {}), groups:g.groups,
      ...(g.isInstancedBufferGeometry?{instanceCount:g.instanceCount,
        boundingBox:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},
        boundingSphere:{center:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius}}:{}),
    }};
  });
  const {object} = root.toJSON(meta);
  // Object3D serializes instance arrays as JSON lists. Put those in the same
  // binary payload as the geometry without changing the ObjectLoader format.
  const instances = o => {
    for (const key of ['instanceMatrix','instanceColor']) if (o[key]) o[key].array = new TYPES[o[key].type](o[key].array);
    for (const child of o.children || []) instances(child);
  };
  instances(object);
  return {metadata:{version:4.7,type:'Object'}, object, ...Object.fromEntries(
    ['geometries','materials','textures','images'].map(k=>[k,Object.values(meta[k]).filter(record=>!record.shared)])), ...extra};
}
const TYPES = {Float32Array,Uint16Array,Uint32Array,Int16Array,Uint8Array};
function resources(root,sharedGeometries=new Set()) {
  const arrays = new Set(), textures = new Set();
  root.traverse(o=>{
    if(o.geometry && !sharedGeometries.has(o.geometry))
      for(const a of [...Object.values(o.geometry.attributes),o.geometry.index].filter(Boolean))arrays.add(a.array.buffer);
    for(const a of [o.instanceMatrix,o.instanceColor].filter(Boolean))arrays.add(a.array.buffer);
    for (const m of o.material ? (Array.isArray(o.material)?o.material:[o.material]) : []) {
      for (const t of Object.values(m)) if (t?.isTexture) textures.add(t);
    }
  });
  return [...arrays].reduce((n,b)=>n+b.byteLength,0)+[...textures].reduce((n,t)=>n+(t.image?.width||0)*(t.image?.height||0)*4*4/3,0);
}
export function coarseModel(root) {
  if(root.userData.landscapeVariant) return landscapeTreeProxy(root);
  const out = new THREE.Group();
  if (!root.userData.streamKind) return out;
  root.traverse(o=>{
    if (!o.isMesh || o.isInstancedMesh) return;
    if (o.userData.streamDetailOnly) return; // a dedicated proxy supplies this model's far view
    const tree=root.userData.streamKind==='tree';
    // Broadleaf canopy groups contain core first, leaf dabs second. Trunks
    // have no vertex colors; conifers are a single colored mesh at the root.
    if(tree && o.parent!==root && o.parent.children[0]!==o)return;
    // Structural shells can use plain materials (for example a metal barrel
    // roof). Keep those explicitly marked meshes as well as textured surfaces.
    const keep = !tree
      ? o.userData.streamCoarse || o.userData.streamCoarseOnly || (Array.isArray(o.material) ? o.material : [o.material]).some(m=>m?.userData?.surface && !['glass','shop'].includes(m.userData.surface))
      : true;
    if (!keep) return;
    const geometry=tree&&o.geometry.attributes.color
      ? (o.parent!==root ? coarseCanopy(o.geometry) : coarseConifer(o.geometry)) : o.geometry;
    const clone = new THREE.Mesh(geometry,o.material);
    clone.name=o.name;
    clone.userData=structuredClone(o.userData);
    // Coarse tiles have no individual stalks to switch back to. Their canopy
    // must stay visible even while a nearby detail tile is still downloading.
    if(clone.userData.cornLOD)delete clone.userData.cornLOD;
    clone.layers.mask=o.layers.mask;
    o.matrixWorld.decompose(clone.position,clone.quaternion,clone.scale);
    out.add(clone);
  });
  return out;
}

// Called only by the offline bake (tinytown/web/bake.mjs). No model calls or
// new research. `source` is a site.json object or its URL; `codec` replaces
// webCodec; any other options go to generateSite (the bake collects surfaces
// with onSurface, or hands over current ones as surfaceAsset).
export async function exportStream(source, seed, write, {codec = webCodec, ...generate} = {}) {
  let site = source;
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) throw new Error('Missing source map');
    site = await response.json();
  }
  // Every image the scene started must be in before tiles are sized: a
  // texture still loading counts as 0 bytes. onLoad alone is not enough; it
  // fires whenever the manager drains, and a later image can start after that.
  // onStart and onProgress always carry the manager's current counts.
  let imagesLoaded=0,imagesTotal=0,imagesDone=null;
  const imageErrors=[];
  const manager=THREE.DefaultLoadingManager;
  manager.onStart=(url,loaded,total)=>{imagesLoaded=loaded;imagesTotal=total;};
  manager.onProgress=(url,loaded,total)=>{imagesLoaded=loaded;imagesTotal=total;if(loaded===total)imagesDone?.();};
  manager.onError=url=>imageErrors.push(url);
  let staging;
  const preparedCoarse = new WeakMap();
  const street = await generateSite(site,site.seed??seed,{
    ...generate,
    async onModel(model) {
      model.updateMatrixWorld(true);
      const simple=await bakeMobile(coarseModel(model),NO_YIELD);
      const kind=model.userData.streamKind;
      const compact=await bakeMobile(model,NO_YIELD);
      compact.userData.streamKind=kind;
      preparedCoarse.set(compact,simple);
      return compact;
    },
    onScene(root){staging=root;return new THREE.Group();},
  });
  while(imagesLoaded<imagesTotal)await new Promise(resolve=>{imagesDone=resolve;});
  if(imageErrors.length)throw new Error('Missing scene images: '+imageErrors.join(', '));
  staging.position.copy(street.group.position);
  staging.updateMatrixWorld(true);
  // Items are first collected per 100 m cell. A cell whose estimated detail
  // memory exceeds DETAIL_CAP is split into quadrants (down to MIN_SECTOR), so
  // one dense block cannot take most of a phone's detail budget. Quadrant ids
  // append q0-q3 per level ('-1_0q2', '-1_0q21'); `area` records each tile's
  // nominal square, since bounds grow with whatever crosses the square's edge.
  const base = new THREE.Group(), cells = new Map(), fixedFarPositions = new Set();
  function cellAt(x,z) {
    const i=Math.floor(x/CELL),j=Math.floor(z/CELL),id=`${i}_${j}`;
    if (!cells.has(id)) cells.set(id,{id,i,j,items:[]});
    return cells.get(id);
  }
  const bounds = new THREE.Box3(), center = new THREE.Vector3(), extent = new THREE.Vector3(), matrix = new THREE.Matrix4(), color = new THREE.Color();
  const bridgeBounds=site.buildings.filter(b=>b.blueprint?.bridge).map(b=>{
    const o=b.obb,c=Math.abs(Math.cos(o.angle)),s=Math.abs(Math.sin(o.angle));
    return {x:o.cx,z:o.cz,w:(c*o.w+s*o.d)/2+3,d:(s*o.w+c*o.d)/2+3};
  });
  const geometryFrom=record=>{
    const g=new THREE.BufferGeometry();
    for(const [name,a] of Object.entries(record.attributes)) g.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));
    g.setIndex(new THREE.BufferAttribute(record.index,1));return g;
  };
  // Items carry [resource, bytes] pairs; a tile's estimate counts each shared
  // array or texture once, however many of its models use it.
  const surfaceRefs=record=>[...Object.values(record.attributes).map(a=>a.array),record.index].map(a=>[a,a.byteLength]);
  const estimate=items=>{const seen=new Map();for(const item of items)for(const [key,bytes] of item.refs)seen.set(key,bytes);return [...seen.values()].reduce((n,b)=>n+b,0);};
  function splitSurface(root) {
    for(const o of [...root.children]) splitSurface(o);
    if(!root.isMesh) return;
    if(root.isInstancedMesh || Array.isArray(root.material) || !isDrapedSurface(root.name)) {base.attach(root);return;}
    const world=root.geometry.clone().applyMatrix4(root.matrixWorld);
    const attributes=Object.fromEntries(Object.entries(world.attributes).map(([key,a])=>[key,{array:a.array,itemSize:a.itemSize,normalized:a.normalized}]));
    const options={
      heightAt:street.surfaces.grade, interiorDrop:root.name==='ground'?.2:0,
      preserve:(x,z)=>root.name==='landmark-ribbon' || bridgeBounds.some(b=>Math.abs(x-b.x)<b.w && Math.abs(z-b.z)<b.d),
    };
    for(const tile of partitionSurface(attributes,world.index?.array,options)) {
      const [i,j]=tile.id.split('_').map(Number);
      cellAt((i+.5)*CELL,(j+.5)*CELL).items.push({kind:'surface',root,options,tile,x:(i+.5)*CELL,z:(j+.5)*CELL,refs:surfaceRefs(tile.detail)});
    }
    world.dispose();
  }
  // Pre-bake memory resources, with textures at the size save() will resize them to.
  function modelRefs(root) {
    const refs=new Map();
    root.traverse(o=>{
      if(o.geometry) for(const a of [...Object.values(o.geometry.attributes),o.geometry.index].filter(Boolean))refs.set(a.array,a.array.byteLength);
      for(const m of o.material ? [o.material].flat() : []) for(const t of Object.values(m)) if(t?.isTexture) {
        const w=t.image?.width||0,h=t.image?.height||0,scale=Math.min(1,1024/Math.max(w,h,1));
        refs.set(t,Math.round(w*scale)*Math.round(h*scale)*16/3);
      }
    });
    return [...refs];
  }
  const queue=[...staging.children];
  while (queue.length) {
    const child=queue.shift();
    if (child.userData.streamSurface) {splitSurface(child);staging.remove(child);continue;}
    if (child.userData.streamBase) { base.attach(child); continue; }
    if (child.isInstancedMesh) {
      for (let i=0;i<child.count;i++) {
        child.getMatrixAt(i,matrix); matrix.premultiply(child.matrixWorld);
        center.setFromMatrixPosition(matrix);
        const item={kind:'instance',child,index:i,x:center.x,z:center.z};
        item.refs=[[item,child.instanceColor?76:64]];
        cellAt(center.x,center.z).items.push(item);
      }
    } else {
      bounds.setFromObject(child).getCenter(center);
      if (!Number.isFinite(center.x)) continue;
      const simple=preparedCoarse.get(child);
      bounds.getSize(extent);
      if (!simple && !child.isMesh && child.children.length && Math.max(extent.x,extent.z)>CELL*1.5) {
        // A loose group of props spread over several sectors: file each part
        // under its own sector instead of stretching one tile's bounds across the map.
        for (const part of [...child.children]) {staging.attach(part);queue.push(part);}
        staging.remove(child);continue;
      }
      // Models were compacted before the staging group's geographic shift.
      if(simple) simple.applyMatrix4(staging.matrixWorld);
      cellAt(center.x,center.z).items.push({kind:'model',object:child,coarse:simple||coarseModel(child),x:center.x,z:center.z,refs:modelRefs(child)});
    }
  }
  const leaves=[];
  function place(cell,items,x0,z0,size,id) {
    if(size<=MIN_SECTOR || estimate(items)<=DETAIL_CAP) {leaves.push({id,cell,area:[x0,z0,size],items});return;}
    const half=size/2,quadrants=[[],[],[],[]];
    for(const item of items) quadrants[(item.z>=z0+half?2:0)+(item.x>=x0+half?1:0)].push(item);
    quadrants.forEach((part,k)=>{if(part.length)place(cell,part,x0+(k&1)*half,z0+(k>>1)*half,half,`${id}${size===CELL?'q':''}${k}`);});
  }
  for (const cell of cells.values()) {
    let items=cell.items;
    if(estimate(items)>DETAIL_CAP) {
      // Re-cut this cell's surfaces at the finest sector size. Every exposed
      // edge stays exact, so the outer boundary still matches the neighbours.
      items=items.flatMap(item=>item.kind!=='surface' ? [item] :
        partitionSurface(item.tile.detail.attributes,item.tile.detail.index,{...item.options,cellSize:MIN_SECTOR}).map(tile=>{
          const [i,j]=tile.id.split('_').map(Number);
          return {...item,tile,x:(i+.5)*MIN_SECTOR,z:(j+.5)*MIN_SECTOR,refs:surfaceRefs(tile.detail)};
        }));
    }
    place(cell,items,cell.i*CELL,cell.j*CELL,CELL,cell.id);
    // Leaves own the items now. Holding the full list here would keep every
    // source model and its geometry alive until the whole export finishes.
    cell.items=null;
  }
  function assemble(leaf) {
    const detail=new THREE.Group(),coarse=new THREE.Group(),instances=new Map();
    for(const item of leaf.items) {
      if(item.kind==='model') {coarse.add(item.coarse);detail.attach(item.object);}
      else if(item.kind==='instance') {
        if(!instances.has(item.child))instances.set(item.child,[]);
        instances.get(item.child).push(item.index);
      } else {
        const {root,tile}=item;
        detail.add(new THREE.Mesh(geometryFrom(tile.detail),root.material));
        // The road surface supplies its distant outline. Millimetre curb and
        // paint strips remain exact in the nearby tile without resident copies.
        if(!['curb','ribbon'].includes(root.name)) {
          const p=tile.coarse.attributes.position.array;
          for(let i=0;i<tile.coarse.fixed.length;i++) if(tile.coarse.fixed[i]) fixedFarPositions.add(farPositionKey(p[i*3],p[i*3+1],p[i*3+2]));
          coarse.add(new THREE.Mesh(geometryFrom(tile.coarse),root.material));
        }
      }
    }
    for (const [child,indices] of instances) {
      const part=new THREE.InstancedMesh(child.geometry,child.material,indices.length);
      indices.forEach((i,k)=>{
        child.getMatrixAt(i,matrix);part.setMatrixAt(k,matrix.premultiply(child.matrixWorld));
        if (child.instanceColor) {child.getColorAt(i,color);part.setColorAt(k,color);}
      });
      detail.add(part);
    }
    leaf.items=null;
    return {detail,coarse};
  }
  const records=[];
  const coarse = new THREE.Group();
  const treeLibrary=new THREE.Group(),sharedTrees=new Set(),sharedIds=new Map();
  treeLibrary.name='stream-tree-library';treeLibrary.visible=false;
  const resizedTextures=new WeakSet();
  async function save(name,root,extra={},sharedGeometries=new Set()) {
    root.traverse(o=>{
      const color=o.geometry?.attributes.color;
      if(color && !(color.array instanceof Uint8Array)) {
        const bytes=new Uint8Array(color.count*color.itemSize);
        const divisor=color.normalized && color.array instanceof Uint16Array ? 65535 : 1;
        for(let i=0;i<bytes.length;i++)bytes[i]=Math.round(Math.max(0,Math.min(1,color.array[i]/divisor))*255);
        o.geometry.setAttribute('color',new THREE.BufferAttribute(bytes,color.itemSize,true));
      }
      for(const m of o.material ? (Array.isArray(o.material)?o.material:[o.material]) : []) for(const texture of Object.values(m)) {
        if(!texture?.isTexture || resizedTextures.has(texture))continue;
        resizedTextures.add(texture);
        const image=texture.image,scale=Math.min(1,1024/Math.max(image?.width||1,image?.height||1));
        if(scale<1) {
          const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
          canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);texture.image=canvas;
        }
      }
    });
    // Everything that reads the scene happens before the first await: the tile
    // loop moves on (and grows sharedGeometries) while this chunk compresses.
    const blob=packSceneJSON(stableIds(sceneJSON(root,extra,sharedGeometries),sharedIds));
    const memoryBytes=Math.ceil(resources(root,sharedGeometries));
    const compressed=await codec.gzip(blob);
    // The gzip header's OS byte is the host's (3 on Linux, 19 on macOS); use
    // 255 (unknown) so the same inputs give the same bytes on any builder.
    compressed[9]=255;
    const sha=await codec.sha256(compressed);
    const record={sha256:sha,bytes:compressed.length,rawBytes:blob.size,memoryBytes};
    if(name==='base' && compressed.length>STREAM_PART_BYTES) {
      const parts=[];
      for(let offset=0;offset<compressed.length;offset+=STREAM_PART_BYTES) {
        const bytes=compressed.subarray(offset,Math.min(offset+STREAM_PART_BYTES,compressed.length));
        const sha256=await codec.sha256(bytes);
        const file=`base-part-${parts.length}-${sha256.slice(0,16)}.bin.gz`;
        await write(file,bytes);parts.push({file,sha256,bytes:bytes.length});
      }
      return {...record,parts};
    }
    const file=`${name}-${sha.slice(0,16)}.bin.gz`;
    await write(file,compressed);
    return {...record,file};
  }
  const sectorCells=new Map();
  // Up to SAVING tiles compress while the next ones bake (off the main thread
  // where the codec allows it); records keep leaf order either way.
  const SAVING=8,saving=[];
  for (const leaf of leaves) {
    const cell={id:leaf.id,...assemble(leaf)};
    sectorCells.set(leaf.id,[leaf.cell.i,leaf.cell.j]);
    const model = await bakeMobile(cell.detail,NO_YIELD);
    const added=[];
    model.traverse(o=>{
      if(!o.userData.instanceVegetation || sharedTrees.has(o.geometry))return;
      sharedTrees.add(o.geometry);added.push(o.geometry);
      treeLibrary.add(new THREE.Mesh(o.geometry,o.material));
    });
    for(const g of added) sharedIds.set(g.uuid,await geometryId(g,codec));
    const simple = await bakeMobile(cell.coarse,NO_YIELD);
    simple.name=cell.id; coarse.add(simple);
    const b=new THREE.Box3().setFromObject(model);
    const uuids=new Set();model.traverse(o=>uuids.add(o.uuid));
    const smokes=street.smokes.filter(e=>e.puffs.every(p=>uuids.has(p.mesh.uuid))).map(e=>({
      x:e.x,z:e.z,baseY:e.baseY,puffs:e.puffs.map(p=>({uuid:p.mesh.uuid,t:p.t,speed:p.speed,drift:p.drift})),
    }));
    const record={id:cell.id,area:leaf.area,bounds:[b.min.toArray(),b.max.toArray()]};
    records.push(record);
    saving.push(save(`detail-${cell.id}`,model,{smokes},sharedTrees).then(saved=>Object.assign(record,saved)));
    if(saving.length>=SAVING)await saving.shift();
    console.log(`Prepared ${cell.id} (${records.length}/${leaves.length})`);
    model.traverse(o=>{if(o.geometry&&!sharedTrees.has(o.geometry))o.geometry.dispose();});
    // Collect finished tiles regularly (the harness exposes gc). Left to itself,
    // V8 grows toward the host's RAM and Cloudflare's 8 GB builder runs out.
    if(records.length%25===0)globalThis.gc?.();
  }
  await Promise.all(saving);
  const bakedBase=await bakeMobile(base,NO_YIELD);
  bakedBase.add(treeLibrary);
  bakedBase.add(coarse);
  coarse.name='stream-coarse';
  coarse.traverse(o=>{
    if(!o.geometry) return;
    for(const [name,a] of Object.entries(compactFarAttributes(o.geometry.attributes,{
      preservePosition:(x,y,z)=>fixedFarPositions.has(farPositionKey(x,y,z)) || bridgeBounds.some(b=>Math.abs(x-b.x)<b.w && Math.abs(z-b.z)<b.d),
    }))) {
      const old=o.geometry.getAttribute(name);
      o.geometry.setAttribute(name,old.isInstancedBufferAttribute
        ?new THREE.InstancedBufferAttribute(a.array,a.itemSize,a.normalized,old.meshPerAttribute)
        :new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));
    }
  });
  fixedFarPositions.clear();
  const {nx,nz,xs,zs}=street.terrainGrid,offset=street.offset||{x:0,z:0};
  const heights=new Float32Array((nx+1)*(nz+1));
  for (let j=0;j<=nz;j++) for(let i=0;i<=nx;i++) heights[j*(nx+1)+i]=street.surfaces.grade(offset.x+xs[i],offset.z+zs[j]);
  const lampPoolHeights=[];
  for (const lamp of street.lamps) for(let j=0;j<=12;j++) for(let i=0;i<=12;i++) {
    const x=Math.max(offset.x-street.size.w/2,Math.min(offset.x+street.size.w/2,lamp.x+(i/12*2-1)*7));
    const z=Math.max(offset.z-street.size.d/2,Math.min(offset.z+street.size.d/2,lamp.z+(j/12*2-1)*7));
    lampPoolHeights.push(street.surfaces.roadDistance(x,z)<0?street.surfaces.roadY(x,z):street.surfaces.walkY(x,z));
  }
  const info={size:street.size,offset,bottom:street.bottom,landscape:street.landscape,lamps:street.lamps.map(p=>p.toArray()),
    ground:{nx,nz,xs,zs,heights},lampPoolHeights:new Float32Array(lampPoolHeights)};
  // Dense miniatures can have a large startup payload despite covering fewer
  // sectors than a regional map. Split by geometry cost as well as extent,
  // retaining the exact meshes. Use smaller regions on compact maps so an
  // opening view does not also download several dense nearby neighborhoods.
  const regions=[];
  if(cells.size>256 || resources(coarse)>32*1024*1024) {
    const span=cells.size>256?4:2;
    const groups=new Map();
    for(const sector of [...coarse.children]) {
      const [x,z]=sectorCells.get(sector.name),id=`${Math.floor(x/span)}_${Math.floor(z/span)}`;
      if(!groups.has(id))groups.set(id,new THREE.Group());
      groups.get(id).add(sector);
    }
    for(const [id,group] of groups) {
      const b=new THREE.Box3().setFromObject(group);
      const sectors=group.children.map(c=>c.name);
      regions.push({id,sectors,bounds:[b.min.toArray(),b.max.toArray()],...(await save(`region-${id}`,group))});
    }
  }
  const baseRecord=await save('base',bakedBase,{info});
  // Camera metadata stays small; authoring blueprints and dense terrain are
  // absent from the startup manifest. Exact navigation heights are in base.
  const map={name:site.name,title:site.title,center:site.center,bounds:site.bounds,size:site.size,offset,
    buildings:site.buildings.map(({id,obb,front})=>({id,obb,front}))};
  return {version:STREAM_VERSION,cellSize:CELL,map,base:baseRecord,...(regions.length?{regions}:{}),tiles:records};
}
