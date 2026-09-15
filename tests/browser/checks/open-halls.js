import * as THREE from 'three';
import { buildPavilion } from '../../../src/pavilion.js';
import { buildPerimeter } from '../../../src/perimeter.js';
import { buildBarrelRoof } from '../../../src/barrel-roof.js';
import { facadeMaterial } from '../../../src/materials.js';

export function checkOpenHallsAndPerimeter() {
  if(facadeMaterial('#89604e','house','#89604e','siding').customProgramCacheKey()!=='surface-siding')throw Error('Brown siding was turned into brick');
  const roof=buildBarrelRoof(25,12,1.4,'#aab3b0','#c9977d','#eee9dc');roof.updateMatrixWorld(true);
  const top=roof.getObjectByName('barrel-roof'),p=top.geometry.attributes.position;
  if(!p.array.every(Number.isFinite))throw Error('Non-finite barrel roof');
  if(Math.abs(p.getY(32)-1.4)>.00001 || Math.abs(p.getY(0))>.00001)throw Error('Incorrect barrel roof rise');
  // A circular arc remains above a triangular gable at the quarter span.
  if(p.getY(16)<1.4*.6)throw Error('Barrel roof is faceted like a gable');
  const specs=[
    {columns:'classical',postWidth:.8,bents:9,endPosts:4,floorH:1.5,seatingRows:18,railing:true},
    {roofType:'flat',height:4.5,wallH:1.1,bents:5,endPosts:3}
  ];
  for(const spec of specs) {
    const g=buildPavilion({w:28,d:19},spec,'#765e45','#65715d');g.updateMatrixWorld(true);
    let benches=0,columns=0;
    g.traverse(o=>{
      if(o.geometry && !o.geometry.attributes.position.array.every(Number.isFinite)) throw Error('Non-finite open hall geometry');
      if(o.name==='pavilion-audience-bench') benches++;
      if(o.name==='pavilion-column') columns++;
    });
    if(spec.seatingRows && (benches!==36 || columns!==26)) throw Error('Missing audience rows or classical columns');
    const ray=new THREE.Raycaster(new THREE.Vector3(1,3,-30),new THREE.Vector3(0,0,1));
    if(ray.intersectObject(g,true).length) throw Error('Open hall is enclosed');
  }
  const fence=buildPerimeter({pts:[[-12,0],[12,0]],openings:[{point:[0,0],width:8}],height:2},x=>x*.2);
  fence.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(0,1,-10),new THREE.Vector3(0,0,1));
  if(ray.intersectObject(fence,true).length) throw Error('Fence blocks gate opening');
  fence.traverse(o=>{
    if(o.name!=='perimeter-panel')return;
    const p=o.geometry.attributes.position;
    for(let i=0;i<2;i++) if(Math.abs(p.getY(i)-p.getX(i)*.2-.08)>.00001) throw Error('Fence does not follow terrain');
  });
  return {halls:'open',columns:26,benches:36,perimeter:'terrain-following with clear gate'};
}

export function checkHallFoundations(town) {
  town.street.group.updateMatrixWorld(true);
  for(const id of [820057908,820060447]) {
    const b=town.siteData.buildings.find(b=>b.id===id),o=b.obb;
    const base=town.street.surfaces.floors.find(f=>f.id===id).base;
    for(const [u,v] of [[-.9,-.9],[.9,-.9],[.9,.9],[-.9,.9]]) {
      const x=o.cx+u*o.w/2*Math.cos(o.angle)-v*o.d/2*Math.sin(o.angle);
      const z=o.cz+u*o.w/2*Math.sin(o.angle)+v*o.d/2*Math.cos(o.angle);
      const ray=new THREE.Raycaster(new THREE.Vector3(x,base-.03,z),new THREE.Vector3(0,-1,0),0,.3);
      if(!ray.intersectObject(town.street.group,true).length)throw Error('Unsupported open-hall terrace: '+id);
    }
  }
  return 'Both open terraces are supported across their full rectangles';
}
