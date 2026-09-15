import * as THREE from 'three';

export function checkVillageCrossings(town) {
  const ids=[249549204,249549206,1097398168],{surfaces}=town.street;
  town.street.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const paint=[];
  town.street.group.traverse(o=>{if(o.name==='crosswalk')paint.push(o);});
  for(const group of paint) group.traverse(o=>{
    if(o.geometry && !o.geometry.attributes.position.array.every(Number.isFinite)) throw new Error('Non-finite crossing paint');
  });
  for(const id of ids) {
    const crossing=town.siteData.roads.find(r=>r.id===id);
    for(const end of [0,crossing.pts.length-1]) {
      const p=crossing.pts[end],q=crossing.pts[end===0?1:end-1];
      // Mapped nodes and the sampled curb differ by a few centimetres. Check
      // the walk just behind the curb, rather than the white paint itself.
      if(surfaces.roadDistance(...p)<-.15) throw new Error(`Crossing ${id} ends in the road`);
      const length=Math.hypot(p[0]-q[0],p[1]-q[1]);
      const x=p[0]+.35*(p[0]-q[0])/length,z=p[1]+.35*(p[1]-q[1])/length,y=surfaces.walkY(x,z);
      ray.set(new THREE.Vector3(x,y+1,z),new THREE.Vector3(0,-1,0));ray.far=1.05;
      const hits=ray.intersectObject(town.street.group,true);
      if(!hits.some(h=>Math.abs(h.point.y-y)<.015)) throw new Error(`Crossing ${id} does not meet its sidewalk`);
    }
    const a=crossing.pts[0],b=crossing.pts.at(-1),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    for(const t of [.35,.45,.55,.65]) for(const side of [-1,1]) {
      const offset=side*(crossing.width/2-.07),x=a[0]+t*(b[0]-a[0])-dz*offset,z=a[1]+t*(b[1]-a[1])+dx*offset;
      const y=surfaces.roadY(x,z)+.018;
      ray.set(new THREE.Vector3(x,y+.01,z),new THREE.Vector3(0,-1,0));ray.far=.02;
      if(!ray.intersectObjects(paint.length?paint:[town.street.group],true).length) throw new Error(`Missing ladder edge on crossing ${id}`);
    }
  }
  return ids.length*2;
}
