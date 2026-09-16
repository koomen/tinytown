import * as THREE from 'three';
import { buildAmphitheater } from '../../../src/amphitheater.js';
import { amphitheaterGrade } from '../../../src/amphitheater-grade.js';
import { amphitheaterLayout, auditoriumPoint } from '../../../src/amphitheater-layout.js';
import { applyNightEmission } from '../../../src/lighting.js';

export function checkAmphitheater() {
  for (const axis of ['u','v']) for (const stageEnd of ['negative','positive']) {
    const obb={cx:150,cz:-80,angle:.37,w:64,d:90},spec={axis,stageEnd,rearWingChamfer:5.5,stringLightSpacing:1.05,interiorLighting:true};
    const root=buildAmphitheater(obb,spec);root.updateMatrixWorld(true);
    const named={};
    root.traverse(o=>{
      (named[o.name]??=[]).push(o);
      if(o.geometry&&!o.geometry.attributes.position.array.every(Number.isFinite))throw new Error('Non-finite auditorium geometry');
    });
    if(named['amphitheater-bench'].length!==180)throw new Error('Missing bowl seating banks');
    const levels=new Set(named['amphitheater-bench'].map(o=>o.position.y.toFixed(3)));
    if(levels.size!==18||Math.min(...levels)>-4||Math.max(...levels)<.5)throw new Error('Seats do not descend into a bowl');
    const stage=new THREE.Box3().setFromObject(named['amphitheater-stage'][0]);
    if(stage.max.y>-4)throw new Error('Stage is not well below exterior grade');
    if(named['amphitheater-backstage-window'].length<20||!named['amphitheater-back-porch'])throw new Error('Rear porch/windows missing');
    const house=named['amphitheater-hagen-center'][0],rear=house.userData.backstage;
    if(rear.balconyHalf*2>=obb[axis==='v'?'w':'d']*.62)throw new Error('Rear balcony is wider than the stage house');
    // A ray through an upper porch bay must reach the recessed doors, not
    // hit a full-width wall where the open veranda should be.
    const origin=house.localToWorld(new THREE.Vector3(rear.front-3,rear.deck+2,rear.porchHalf*.24));
    const direction=new THREE.Vector3(1,0,0).transformDirection(house.matrixWorld);
    const hitPorch=new THREE.Raycaster(origin,direction).intersectObject(house,true)[0];
    if(!hitPorch||house.worldToLocal(hitPorch.point.clone()).x<rear.recess-.4)throw new Error('Upper veranda is not recessed');
    for(const post of named['amphitheater-porch-post'])
      if(Math.abs(new THREE.Box3().setFromObject(post).min.y-rear.deck)>.001)throw new Error('Upper porch posts do not meet the deck');
    const landing=named['amphitheater-lower-entry-landing'][0],steps=named['amphitheater-entry-step'];
    if(Math.abs(new THREE.Box3().setFromObject(steps.at(-1)).max.y-new THREE.Box3().setFromObject(landing).max.y)>.001)throw new Error('Rear entrance stairs miss the landing');
    const canopy=named['amphitheater-porch-canopy'][0];canopy.geometry.computeBoundingBox();
    if(rear.front-rear.balconyFront<1||canopy.geometry.boundingBox.min.x>rear.balconyFront-.25)throw new Error('Balcony canopy does not project beyond the facade and railing');
    const lowerDoors=named['amphitheater-lower-porch-door']||[];
    if(lowerDoors.length!==4||Math.min(...lowerDoors.map(d=>d.position.z))>rear.entryZ-landing.geometry.parameters.depth*.25||Math.max(...lowerDoors.map(d=>d.position.z))<rear.entryZ+landing.geometry.parameters.depth*.25)throw new Error('Glazed doors do not extend across the lower porch');
    for(const door of lowerDoors){
      const sill=new THREE.Box3().setFromObject(door).min.y;
      if(sill<rear.entryY-.1||sill>rear.entryY+.2)throw new Error('Lower porch doors miss the landing');
    }
    if(named['amphitheater-clerestory-glass'].length!==4||!named['amphitheater-loading-door']||!named['amphitheater-hagen-center-sign'])throw new Error('Hagen Center reference features are missing');
    // The complete nameplate must fit below the roof, including its corners.
    const sign=named['amphitheater-hagen-center-sign'][0],stageRoof=named['amphitheater-backstage-roof'][0];
    for(const z of [-.5,0,.5]){
      const p=sign.localToWorld(new THREE.Vector3(sign.geometry.parameters.width*z,sign.geometry.parameters.height/2,0));
      const roofHit=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,30,0)),new THREE.Vector3(0,-1,0)).intersectObject(stageRoof)[0];
      if(!roofHit||roofHit.point.y<p.y)throw new Error('Nameplate protrudes through the gable roof');
    }
    if(!named['amphitheater-concourse']||!named['amphitheater-perimeter-brick']||!named['amphitheater-perimeter-rail'])throw new Error('Perimeter concourse and barrier missing');
    if(named['amphitheater-perimeter-brick'].some(o=>o.material.userData.surface!=='brick'))throw new Error('Perimeter has lost its brick material');
    const position=named['amphitheater-backstage'][0].getWorldPosition(new THREE.Vector3());
    if(Math.sign(axis==='u'?position.x:position.z)!==(stageEnd==='positive'?1:-1))throw new Error('Stage house is on the wrong end');
    // Probe the actual roof in canonical coordinates, with its parent transforms.
    const roof=named['amphitheater-roof'][0],L=amphitheaterLayout(obb,spec);
    // Measure the built apex rather than repeating its construction formula.
    // The entire monitor cap must fit that ridge, including both overhangs.
    roof.geometry.computeBoundingBox();
    const vertices=roof.geometry.attributes.position,apex=roof.geometry.boundingBox.max.y,ridge=[];
    for(let i=0;i<vertices.count;i++)if(Math.abs(vertices.getY(i)-apex)<1e-5)ridge.push(vertices.getX(i));
    const cap=named['amphitheater-monitor-roof'][0];cap.geometry.computeBoundingBox();
    const bounds=cap.geometry.boundingBox;
    if(Math.abs(bounds.min.x-Math.min(...ridge))>1e-5||Math.abs(bounds.max.x-Math.max(...ridge))>1e-5)
      throw new Error('Roof monitor cap extends beyond the canopy apex');
    const monitor=named['amphitheater-monitor'][0];monitor.geometry.computeBoundingBox();
    if(monitor.position.x+monitor.geometry.boundingBox.min.x<bounds.min.x||monitor.position.x+monitor.geometry.boundingBox.max.x>bounds.max.x)
      throw new Error('Roof monitor body extends beyond its cap');
    const hit=(x,z)=>{
      const point=roof.localToWorld(new THREE.Vector3(x,30,z));
      return new THREE.Raycaster(point,new THREE.Vector3(0,-1,0)).intersectObject(roof).length>0;
    };
    if(hit(L.front-1,L.half-1)||hit(L.front-1,-L.half+1))throw new Error('Audience corners remain rectangular');
    if(hit(L.start+1,L.half-1)||hit(L.start+1,-L.half+1))throw new Error('Back-porch wing corners remain rectangular');
    if(!hit(L.start+7,L.half-1)||!hit(L.start+7,-L.half+1))throw new Error('Wing clip removes too much canopy');
    if(!hit(L.front-2,0))throw new Error('Audience canopy missing');
    for(const seat of named['amphitheater-bench'])
      if(!hit(seat.position.x,seat.position.z))throw new Error('Seats sit outside the clipped canopy');
    const bulbs=[...named['amphitheater-string-bulbs'],...named['amphitheater-porch-string-bulbs']];
    for(const bulb of bulbs) {
      if(!bulb.isInstancedMesh||bulb.castShadow)throw new Error('String lights must use shared unshadowed instances');
      if(bulb.userData.stringLightSegments.some(s=>s.spacing<.9||s.spacing>1.2))throw new Error('String-light spacing differs from3–4 feet');
    }
    if(Object.values(named).flat().some(o=>o.isLight))throw new Error('Auditorium lighting adds real lights');
    const litSeat=named['amphitheater-bench'][0].material;
    if(!litSeat.userData.nightEmission||!litSeat.emissive.getHex())throw new Error('Seating has no night illumination');
    const copied=new THREE.MaterialLoader().parse(litSeat.toJSON());
    applyNightEmission(copied,0);
    if(copied.emissiveIntensity!==0)throw new Error('Interior stays lit in daytime');
    applyNightEmission(copied,1);
    if(copied.emissiveIntensity!==litSeat.userData.nightEmission.night)throw new Error('Serialized interior loses its night level');
    const grade=amphitheaterGrade([{id:1,obb,blueprint:{amphitheater:spec}}],()=>10);
    const p=auditoriumPoint(obb,L,(L.start+L.front)/2,0);
    if(grade.sample(...p)>4.01||grade.floors.get('1')!==10)throw new Error('Terrain fills the sunken bowl');
    if(grade.sample(...auditoriumPoint(obb,L,L.front+8,0))!==10)throw new Error('Excavation changes unrelated ground');
    // Public ground must remain at grade right up to every exposed edge;
    // the old 2 m exterior blend made a six-metre-deep trench here.
    for(let i=0;i<L.canopyEdge.length-1;i++) {
      const a=L.canopyEdge[i],b=L.canopyEdge[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      for(const t of [.1,.5,.9])for(const offset of [0,.1,.5,1,2]) {
        const p=auditoriumPoint(obb,L,a[0]+dx*t+dz/len*offset,a[1]+dz*t-dx/len*offset);
        if(Math.abs(grade.sample(...p)-10)>1e-8)throw new Error('Excavation reaches the public perimeter');
      }
    }
    if(grade.profiles.get('1').sample(L.front,0)!==0)throw new Error('Exterior profile includes the excavation');
  }
  return true;
}

export function checkAmphitheaterAccess(site) {
  const b=site.buildings.find(b=>String(b.id)==='619932539'),model=new THREE.Group();
  model.position.set(b.obb.cx,0,b.obb.cz);model.rotation.y=-b.obb.angle;
  model.add(buildAmphitheater(b.obb,b.blueprint.amphitheater));model.updateMatrixWorld(true);
  const first=model.getObjectByName('amphitheater-entry-step');
  const tread=first.localToWorld(new THREE.Vector3(-first.geometry.parameters.width/2+.12,0,0));
  const walk=site.roads.find(r=>String(r.id)==='1396729347'),end=walk.pts.at(-1);
  if(Math.hypot(end[0]-tread.x,end[1]-tread.z)>.08)throw new Error('Rear walk misses the center of the first stair tread');
  const spur=site.roads.find(r=>String(r.id)==='1427596778');
  if(spur&&spur.surface!=='grass')throw new Error('Dead-end sidewalk still crosses the loading approach');
  return true;
}
