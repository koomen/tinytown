import * as THREE from 'three';
import {makeRng} from './rng.js';
import {buildTree} from './kit.js';
import {bake} from './bake.js';
import {coarseCanopy,coarseConifer} from './tree-lod.js';

// Preserve compact Avon's soft crowns, pale greens and fine leaf dabs. Each
// sector instances a small set of complete trees instead of copying their
// vertices for every trunk. Distant sectors use matching crown silhouettes.
const templates=new Map();
function template(key) {
  if(templates.has(key))return templates.get(key);
  const source=buildTree(makeRng('avon-canopy:'+key),{big:true});
  source.updateMatrixWorld(true);
  const simple=new THREE.Group();
  source.traverse(o=>{
    if(!o.isMesh || (o.parent!==source && o.parent.children[0]!==o))return;
    const geometry=o.geometry.attributes.color
      ? (o.parent!==source?coarseCanopy(o.geometry):coarseConifer(o.geometry)) : o.geometry;
    const part=new THREE.Mesh(geometry,o.material);
    o.matrixWorld.decompose(part.position,part.quaternion,part.scale);
    simple.add(part);
  });
  const detail=bake(source),coarse=bake(simple);
  detail.traverse(o=>{if(o.isMesh)o.userData.instanceVegetation=true;});
  const result={detail,coarse};templates.set(key,result);return result;
}

export function buildLandscapeTree(rng,{riparian=false}={}) {
  const key=String(rng.int(0,15));
  const tree=template(key).detail.clone();
  tree.userData.landscapeVariant=key;
  tree.rotation.y=rng.range(0,Math.PI*2);
  tree.scale.set(rng.range(.92,1.08),rng.range(riparian?.9:.95,1.1),rng.range(.92,1.08));
  return tree;
}

export function landscapeTreeProxy(tree) {
  const proxy=template(tree.userData.landscapeVariant).coarse.clone();
  tree.matrixWorld.decompose(proxy.position,proxy.quaternion,proxy.scale);
  return proxy;
}

// A bounded neighbouring-cell lookup prevents overlapping area polygons and
// stream-side passes from piling duplicate trunks at the same location.
export function treeSpacing(cell=10) {
  const cells=new Map();
  return (x,z,distance=3.5)=>{
    const ix=Math.floor(x/cell),iz=Math.floor(z/cell),reach=Math.ceil(distance/cell);
    for(let j=iz-reach;j<=iz+reach;j++)for(let i=ix-reach;i<=ix+reach;i++)
      for(const p of cells.get(`${i},${j}`)||[])if(Math.hypot(x-p[0],z-p[1])<Math.max(distance,p[2]))return false;
    const key=`${ix},${iz}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([x,z,distance]);return true;
  };
}
