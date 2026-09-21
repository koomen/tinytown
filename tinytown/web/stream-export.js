import * as THREE from 'three';
import { generateSite } from '../../src/site.js';
import { compactFarAttributes, farPositionKey } from '../../src/far-geometry.js';
import { partitionSurface, isDrapedSurface } from '../../src/surface-lod.js';
import { bakeMobile } from '../../src/bake.js';
import { coarseCanopy, coarseConifer } from '../../src/tree-lod.js';
import { landscapeTreeProxy } from '../../src/vegetation.js';
import { packSceneJSON, STREAM_VERSION, STREAM_PART_BYTES } from '../../src/stream-format.js';

const CELL = 100;
const tick = () => new Promise(resolve=>setTimeout(resolve,0));
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

// Called only by the offline preparation page. No model calls or new research.
export async function exportStream(url, seed, write) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Missing source map');
  const site = await response.json();
  let imagesLoading=false,imagesDone;
  const imageErrors=[];
  const ready=new Promise(resolve=>{imagesDone=resolve;});
  THREE.DefaultLoadingManager.onStart=()=>{imagesLoading=true;};
  THREE.DefaultLoadingManager.onLoad=imagesDone;
  THREE.DefaultLoadingManager.onError=url=>imageErrors.push(url);
  let staging;
  const preparedCoarse = new WeakMap();
  const street = await generateSite(site,site.seed??seed,{
    async onModel(model) {
      model.updateMatrixWorld(true);
      const simple=await bakeMobile(coarseModel(model));
      const kind=model.userData.streamKind;
      const compact=await bakeMobile(model);
      compact.userData.streamKind=kind;
      preparedCoarse.set(compact,simple);
      return compact;
    },
    onScene(root){staging=root;return new THREE.Group();},
  });
  if(imagesLoading)await ready;
  if(imageErrors.length)throw new Error('Missing scene images: '+imageErrors.join(', '));
  staging.position.copy(street.group.position);
  staging.updateMatrixWorld(true);
  const base = new THREE.Group(), cells = new Map(), fixedFarPositions = new Set();
  function cellAt(x,z) {
    const id=`${Math.floor(x/CELL)}_${Math.floor(z/CELL)}`;
    if (!cells.has(id)) cells.set(id,{id,detail:new THREE.Group(),coarse:new THREE.Group()});
    return cells.get(id);
  }
  const bounds = new THREE.Box3(), center = new THREE.Vector3(), matrix = new THREE.Matrix4(), color = new THREE.Color();
  const bridgeBounds=site.buildings.filter(b=>b.blueprint?.bridge).map(b=>{
    const o=b.obb,c=Math.abs(Math.cos(o.angle)),s=Math.abs(Math.sin(o.angle));
    return {x:o.cx,z:o.cz,w:(c*o.w+s*o.d)/2+3,d:(s*o.w+c*o.d)/2+3};
  });
  const geometryFrom=record=>{
    const g=new THREE.BufferGeometry();
    for(const [name,a] of Object.entries(record.attributes)) g.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));
    g.setIndex(new THREE.BufferAttribute(record.index,1));return g;
  };
  function splitSurface(root) {
    for(const o of [...root.children]) splitSurface(o);
    if(!root.isMesh) return;
    if(root.isInstancedMesh || Array.isArray(root.material) || !isDrapedSurface(root.name)) {base.attach(root);return;}
    const world=root.geometry.clone().applyMatrix4(root.matrixWorld);
    const attributes=Object.fromEntries(Object.entries(world.attributes).map(([key,a])=>[key,{array:a.array,itemSize:a.itemSize,normalized:a.normalized}]));
    for(const tile of partitionSurface(attributes,world.index?.array,{
      heightAt:street.surfaces.grade, interiorDrop:root.name==='ground'?.2:0,
      preserve:(x,z)=>root.name==='landmark-ribbon' || bridgeBounds.some(b=>Math.abs(x-b.x)<b.w && Math.abs(z-b.z)<b.d),
    })) {
      const [i,j]=tile.id.split('_').map(Number),cell=cellAt((i+.5)*CELL,(j+.5)*CELL);
      const detail=new THREE.Mesh(geometryFrom(tile.detail),root.material);
      const coarse=new THREE.Mesh(geometryFrom(tile.coarse),root.material);
      cell.detail.add(detail);
      // The road surface supplies its distant outline. Millimetre curb and
      // paint strips remain exact in the nearby tile without resident copies.
      if(!['curb','ribbon'].includes(root.name)) {
        const p=tile.coarse.attributes.position.array;
        for(let i=0;i<tile.coarse.fixed.length;i++) if(tile.coarse.fixed[i]) fixedFarPositions.add(farPositionKey(p[i*3],p[i*3+1],p[i*3+2]));
        cell.coarse.add(coarse);
      }
      else coarse.geometry.dispose();
    }
    world.dispose();
  }
  for (const child of [...staging.children]) {
    if (child.userData.streamSurface) {splitSurface(child);staging.remove(child);continue;}
    if (child.userData.streamBase) { base.attach(child); continue; }
    if (child.isInstancedMesh) {
      const partitions = new Map();
      for (let i=0;i<child.count;i++) {
        child.getMatrixAt(i,matrix); matrix.premultiply(child.matrixWorld);
        center.setFromMatrixPosition(matrix);
        const cell=cellAt(center.x,center.z);
        if (!partitions.has(cell)) partitions.set(cell,[]);
        partitions.get(cell).push(i);
      }
      for (const [cell,indices] of partitions) {
        const part=new THREE.InstancedMesh(child.geometry,child.material,indices.length);
        indices.forEach((i,k)=>{
          child.getMatrixAt(i,matrix);part.setMatrixAt(k,matrix.premultiply(child.matrixWorld));
          if (child.instanceColor) {child.getColorAt(i,color);part.setColorAt(k,color);}
        });
        cell.detail.add(part);
      }
    } else {
      bounds.setFromObject(child).getCenter(center);
      if (!Number.isFinite(center.x)) continue;
      const cell=cellAt(center.x,center.z);
      const simple=preparedCoarse.get(child);
      if(simple) {
        // Models were compacted before the staging group's geographic shift.
        simple.applyMatrix4(staging.matrixWorld);
        cell.coarse.add(simple);
      } else cell.coarse.add(coarseModel(child));
      cell.detail.attach(child);
    }
  }
  const records=[];
  const coarse = new THREE.Group();
  const treeLibrary=new THREE.Group(),sharedTrees=new Set();
  treeLibrary.name='stream-tree-library';treeLibrary.visible=false;
  const resizedTextures=new Set();
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
    const blob=packSceneJSON(sceneJSON(root,extra,sharedGeometries));
    const compressed=new Uint8Array(await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const hash=await crypto.subtle.digest('SHA-256',compressed);
    const sha=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
    const record={sha256:sha,bytes:compressed.length,rawBytes:blob.size,memoryBytes:Math.ceil(resources(root,sharedGeometries))};
    if(name==='base' && compressed.length>STREAM_PART_BYTES) {
      const parts=[];
      for(let offset=0;offset<compressed.length;offset+=STREAM_PART_BYTES) {
        const bytes=compressed.subarray(offset,Math.min(offset+STREAM_PART_BYTES,compressed.length));
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const sha256=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
        const file=`base-part-${parts.length}-${sha256.slice(0,16)}.bin.gz`;
        await write(file,bytes);parts.push({file,sha256,bytes:bytes.length});
      }
      return {...record,parts};
    }
    const file=`${name}-${sha.slice(0,16)}.bin.gz`;
    await write(file,compressed);
    return {...record,file};
  }
  for (const cell of cells.values()) {
    const model = await bakeMobile(cell.detail);
    model.traverse(o=>{
      if(!o.userData.instanceVegetation || sharedTrees.has(o.geometry))return;
      sharedTrees.add(o.geometry);
      treeLibrary.add(new THREE.Mesh(o.geometry,o.material));
    });
    const simple = await bakeMobile(cell.coarse);
    simple.name=cell.id; coarse.add(simple);
    const b=new THREE.Box3().setFromObject(model);
    const uuids=new Set();model.traverse(o=>uuids.add(o.uuid));
    const smokes=street.smokes.filter(e=>e.puffs.every(p=>uuids.has(p.mesh.uuid))).map(e=>({
      x:e.x,z:e.z,baseY:e.baseY,puffs:e.puffs.map(p=>({uuid:p.mesh.uuid,t:p.t,speed:p.speed,drift:p.drift})),
    }));
    records.push({id:cell.id,bounds:[b.min.toArray(),b.max.toArray()],...(await save(`detail-${cell.id}`,model,{smokes},sharedTrees))});
    console.log(`Prepared ${cell.id} (${records.length}/${cells.size})`);
    model.traverse(o=>{if(o.geometry&&!sharedTrees.has(o.geometry))o.geometry.dispose();});
    await tick();
  }
  const bakedBase=await bakeMobile(base);
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
      const [x,z]=sector.name.split('_').map(Number),id=`${Math.floor(x/span)}_${Math.floor(z/span)}`;
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
