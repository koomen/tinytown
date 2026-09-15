import * as THREE from 'three';
import { pavementGeometry } from '../../../src/pavement.js';
import { trimCoveredWalls } from '../../../src/wall-union.js';
import { createStreetGrade, ROAD_LEVEL, WALK_LEVEL } from '../../../src/street-grade.js';
import { buildBlueprint, blueprintFrontages } from '../../../src/blueprint.js';
import { makeRng } from '../../../src/rng.js';

export async function checkGasStation() {
  const site=await (await fetch('/data/avon/site.json')).json();
  const station=site.buildings.find(b=>b.id===248274710);
  const root=buildBlueprint(makeRng('gas-regression'),{...station,obb:{cx:0,cz:0,angle:0}},station.blueprint,0,[]);
  root.updateMatrixWorld(true);
  const cooler=root.children.find(o=>o.name==='cooler-box');
  const walls=cooler.children.find(o=>o.userData.volumeWall);
  const bounds=new THREE.Box3().setFromObject(walls);
  if(Math.abs(bounds.min.y-4.6)>1e-5) throw new Error('Rooftop equipment must not extend into the ground-floor wall');
  for(const side of [-1,1]) {
    const ray=new THREE.Raycaster(new THREE.Vector3(9.5,2,side*5.4),new THREE.Vector3(0,0,-side),0,0.7);
    if(!ray.intersectObject(root,true).length) throw new Error('Clipping a shared wall left a hole beside its rounded corner');
  }
  // The rear wall under the rooftop equipment is brick, with no dark box
  // or competing face occupying the same exterior plane.
  const ray=new THREE.Raycaster(new THREE.Vector3(6.7,1.7,5.4),new THREE.Vector3(0,0,-1),0,0.6);
  const hits=ray.intersectObject(root,true);
  if(hits.length!==1 || hits[0].object.material.userData.surface!=='brick') throw new Error('Gas station rear wall still has overlapping exterior faces');
}

export async function checkLaundromatWalls() {
  const site = await (await fetch('/data/avon/site.json')).json();
  const building = site.buildings.find(b => b.id === 248251398);
  const root = buildBlueprint(makeRng('laundromat-walls'), {...building, obb: {cx: 0, cz: 0, angle: 0}}, building.blueprint, 0, []);
  root.updateMatrixWorld(true);
  const walls = [];
  root.traverse(o => {if (o.userData.volumeWall) walls.push(o);});
  const ray = new THREE.Raycaster();
  let samples = 0;
  for (const side of [-1, 1]) for (let x = -9; x <= 7.2; x += .6) for (const y of [.3, 1.5, 3.5, 5.5, 7.1]) {
    const z = side < 0 ? -4.7 : 3.7;
    ray.set(new THREE.Vector3(x, y, z + side * .5), new THREE.Vector3(0, 0, -side)); ray.far = .7;
    if (!ray.intersectObjects(walls).length) throw new Error(`Missing laundromat side wall at ${x.toFixed(2)},${y},${z}`);
    samples++;
  }
  return samples;
}

export function checkJoinedSurfaces() {
  const grade=(x,z)=>x*0.15+z*0.08;
  const geo=pavementGeometry([
    [[0,0],[2,0],[2,2],[0,2]], [[1,0],[3,0],[3,2],[1,2]],
  ],grade,()=>new THREE.Color(0xccccbb));
  const p=geo.attributes.position,idx=geo.index;
  let area=0;
  for(let i=0;i<geo.userData.topIndexCount;i+=3) {
    const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
    area+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a)))/2;
    for(const v of [a,b,c]) if(Math.abs(p.getY(v)-grade(p.getX(v),p.getZ(v)))>1e-6) throw new Error('Pavement vertices disagree on their grade');
  }
  if(Math.abs(area-6)>1e-6) throw new Error(`Pavement union has overlaps or holes: area ${area}, expected 6`);
  const pavement=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());
  const ray=new THREE.Raycaster(new THREE.Vector3(1.23,10,0.67),new THREE.Vector3(0,-1,0));
  if(ray.intersectObject(pavement).length!==1) throw new Error('Overlapping aprons must produce one pavement surface');

  const a=new THREE.Mesh(new THREE.BoxGeometry(4,2,2),new THREE.MeshBasicMaterial());
  const b=new THREE.Mesh(new THREE.BoxGeometry(3,2,2),new THREE.MeshBasicMaterial()); b.position.x=0.5;
  trimCoveredWalls(a,[{min:[-1.002,-1.002,-1.002],max:[2.002,1.002,1.002]}]);
  trimCoveredWalls(b,[{min:[-1.998,-0.998,-0.998],max:[1.998,0.998,0.998]}]);
  for(const x of [-1.5,1.25]) {
    ray.set(new THREE.Vector3(x,0.17,5),new THREE.Vector3(0,0,-1));ray.far=4.1;
    if(ray.intersectObjects([a,b]).length!==1) throw new Error('Shared exterior wall must have exactly one visible face');
  }
  for(const mesh of [a,b,pavement]) {
    for(const attr of Object.values(mesh.geometry.attributes)) if(![...attr.array].every(Number.isFinite)) throw new Error('Non-finite surface geometry');
    mesh.geometry.dispose();mesh.material.dispose();
  }
  return area;
}


export function checkStreetGrade(town) {
  // A sharp change in slope used to make independently triangulated slabs
  // intersect. All pavement samples must use the ground grid's triangles.
  const sample=(x,z)=>Math.sin(x)*0.3+Math.cos(z)*0.2;
  const grade=createStreetGrade(sample,8,8);
  const ground=new THREE.PlaneGeometry(8,8,8,8);ground.rotateX(-Math.PI/2);
  const pos=ground.attributes.position;
  for(let i=0;i<pos.count;i++) pos.setY(i,sample(pos.getX(i),pos.getZ(i)));
  const mesh=new THREE.Mesh(ground,new THREE.MeshBasicMaterial());
  const ray=new THREE.Raycaster();
  for(const [x,z] of [[-2.7,1.15],[0.12,0.34],[1.61,-0.74]]) {
    ray.set(new THREE.Vector3(x,5,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(mesh)[0];
    if(Math.abs(hit.point.y-grade(x,z))>1e-6) throw new Error('Street grade diverges from the terrain triangles');
  }
  ground.dispose();mesh.material.dispose();

  const color=()=>new THREE.Color(0xffffff);
  const road=pavementGeometry([[[1,-1],[2,-1],[2,3],[1,3]]],grade,color);
  const walk=pavementGeometry([[[0,0],[3,0],[3,2],[0,2]]],grade,color,0.5,
    {clip:(x,z)=>-road.userData.distanceAt(x,z)});
  let area=0;
  const p=walk.attributes.position,ix=walk.index;
  for(let i=0;i<walk.userData.topIndexCount;i+=3) {
    const [a,b,c]=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];
    area+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a)))/2;
  }
  if(Math.abs(area-4)>1e-6) throw new Error('Crossing approach overlaps asphalt or leaves a gap');
  for(const geo of [road,walk]) {
    if(!geo.userData.contours.every(line=>line.length>3 && Math.hypot(line[0][0]-line.at(-1)[0],line[0][1]-line.at(-1)[1])<1e-6)) throw new Error('Pavement boundary has an open curb seam');
    if(![...geo.attributes.position.array].every(Number.isFinite)) throw new Error('Non-finite street geometry');
    geo.dispose();
  }

  const {surfaces}=town.street;
  town.street.group.updateMatrixWorld(true);
  for(const id of [1090362844,1090362845]) {
    const building=town.siteData.buildings.find(b=>b.id===id);
    const floor=surfaces.floors.find(b=>b.id===id).base;
    const front=blueprintFrontages(building).find(f=>f.doors.length===2);
    if(!front) throw new Error('Missing storefront frontage');
    for(const t of [0.3,0.7]) {
      const [x,z]=front.point(t,1.6),g=surfaces.grade(x,z),y=surfaces.walkY(x,z);
      if(y-g>WALK_LEVEL+1e-6 || y-g<ROAD_LEVEL-1e-6 || y>floor+0.2) throw new Error('Pub/spa sidewalk rises above its frontage');
      ray.set(new THREE.Vector3(x,y+2,z),new THREE.Vector3(0,-1,0));ray.far=2.3;
      const hits=ray.intersectObject(town.street.group,true).filter(h=>h.point.y>y-0.025);
      if(hits.length!==1 || Math.abs(hits[0].point.y-y)>0.025) throw new Error(`Storefront ${id} has broken or overlapping pavement: ${JSON.stringify({x,z,y,g,hits:hits.map(h=>({y:h.point.y,name:h.object.name}))})}`);
    }
  }
  // These three street-facing shops share one footprint. Its downhill rear
  // service door must not set the floor and bury the whole public frontage.
  const theater=town.siteData.buildings.find(b=>b.id===1090362840);
  if(theater) {
    const floor=surfaces.floors.find(b=>b.id===theater.id).base;
    const shops=blueprintFrontages(theater).filter(f=>f.storefront);
    if(shops.length!==3) throw new Error('Expected theater, neighboring shop and florist frontages');
    for(const fr of shops) for(const at of fr.doors) {
      const pavement=surfaces.walkY(...fr.point(at));
      if(pavement>floor+0.03 || floor-pavement>0.8) throw new Error('Theater block floor does not meet its public sidewalk');
    }
  }
}

export function checkFacadeJoins(town) {
  const building=town.siteData.buildings.find(b=>b.id===248274499);
  const columns=buildBlueprint(makeRng('capital-joins'),{...building,obb:{cx:0,cz:0,angle:0}},building.blueprint,0,[]);
  columns.updateMatrixWorld(true);
  let capitals=0;
  columns.traverse(o=>{
    if(o.name!=='pilaster-cap') return;
    capitals++;
    const bounds=new THREE.Box3().setFromObject(o);
    const beltTop=4.75;
    if(bounds.max.y-beltTop<0.02) throw new Error('Gold capital is coplanar with its green belt course');
    if(bounds.min.y>=4.5) throw new Error('Raised capital no longer meets its column');
  });
  if(capitals!==13) throw new Error(`Expected all 13 Wadsworth capitals, got ${capitals}`);

  const house=town.siteData.buildings.find(b=>b.id===248252358);
  const base=town.street.surfaces.floors.find(b=>b.id===house.id).base;
  const model=buildBlueprint(makeRng('porch-join'),house,house.blueprint,base,[]);
  model.updateMatrixWorld(true);
  let floor;
  model.traverse(o=>{if(o.name==='porch-floor')floor=o;});
  if(!floor) throw new Error('Missing house porch floor');
  const bounds=new THREE.Box3().setFromObject(floor),center=bounds.getCenter(new THREE.Vector3());
  // Cast through the actual baked scene, below the porch roof. Two nearly
  // coincident hits mean the footprint foundation is competing with the deck.
  const ray=new THREE.Raycaster(new THREE.Vector3(center.x,bounds.max.y+0.5,center.z),new THREE.Vector3(0,-1,0),0,0.7);
  const hits=ray.intersectObject(town.street.group,true).filter(h=>{
    // Raycaster also intersects hidden distant proxies. Only surfaces that
    // can actually be drawn may count as a visible porch overlap.
    for(let o=h.object;o;o=o.parent)if(!o.visible)return false;
    return Math.abs(h.point.y-bounds.max.y)<0.015;
  });
  if(hits.length!==1) throw new Error(`Porch deck and foundation overlap (${hits.length} surfaces)`);
  checkBuildingRoofAndFoundation(town);
  return capitals;
}

export function checkBuildingRoofAndFoundation(town) {
  const school = town.siteData.buildings.find(b => b.id === 248273904);
  const model = buildBlueprint(makeRng('portico-join'), {...school, obb: {cx: 0, cz: 0, angle: 0}}, school.blueprint, 0, []);
  model.updateMatrixWorld(true);
  const main = model.children.find(o => o.name === 'main');
  const cornice = main.children.find(o => o.name === 'hip-cornice');
  const roof = main.children.find(o => o.name === 'hip-roof');
  if (!cornice || !roof) throw new Error('Missing Saint Agnes main roof or entablature');
  const underside = new THREE.Box3().setFromObject(cornice).min.y;
  const posts = [];
  main.traverse(o => { if (o.name === 'porch-post') posts.push(o); });
  if (posts.length !== 4) throw new Error('Saint Agnes portico must retain four columns');
  for (const post of posts) {
    const bounds = new THREE.Box3().setFromObject(post), center = bounds.getCenter(new THREE.Vector3());
    if (Math.abs(bounds.max.y - underside) > 0.001) throw new Error('Portico column does not meet the main entablature');
    if (new THREE.Box3().setFromObject(post.parent).max.y > underside + 0.001) throw new Error('Portico still has a separate canopy above its columns');
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, 15, center.z), new THREE.Vector3(0, -1, 0));
    if (!ray.intersectObject(roof).length || !ray.intersectObject(cornice).length) throw new Error('Main roof does not cover a portico column');
  }

  const shed = town.siteData.buildings.find(b => b.id === 249567063);
  const base = town.street.surfaces.floors.find(b => b.id === shed.id).base;
  town.street.group.updateMatrixWorld(true);
  let samples = 0;
  for (let i = 0; i < shed.pts.length; i++) {
    const p = shed.pts[i], q = shed.pts[(i + 1) % shed.pts.length];
    const normal = new THREE.Vector3(q[1] - p[1], 0, p[0] - q[0]).normalize();
    if (normal.x * ((p[0] + q[0]) / 2 - shed.centroid[0]) + normal.z * ((p[1] + q[1]) / 2 - shed.centroid[1]) < 0) normal.negate();
    for (const t of [0.2, 0.5, 0.8]) for (const height of [-0.3, -0.13, -0.04]) {
      const x = p[0] + t * (q[0] - p[0]), z = p[1] + t * (q[1] - p[1]), y = base + height;
      if (y <= town.street.surfaces.grade(x, z) + 0.04) continue;
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, z).addScaledVector(normal, 0.3), normal.clone().negate(), 0, 0.6);
      const hits = ray.intersectObject(town.street.group, true).filter(hit => {
        for (let o = hit.object; o; o = o.parent) if (!o.visible) return false;
        return Math.abs(hit.distance - 0.3) < 0.015;
      });
      if (hits.length !== 1) throw new Error(`Shed wall/foundation join has ${hits.length} surfaces at edge ${i}, height ${height}`);
      samples++;
    }
  }
  if (samples < 3) throw new Error('Shed check did not sample its exposed foundation');
  return {columns: posts.length, foundationSamples: samples};
}
