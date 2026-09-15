import { amphitheaterLayout, auditoriumPoint } from './amphitheater-layout.js';
import { polygonDistanceField } from './polygon-distance.js';

// Keep the excavation under the building. The 1.5 m uncut margin contains
// even the diagonal of the town's 1 m grade triangles; interpolating across
// a deep cut at the wall used to drag the public walkway down into a moat.
export function amphitheaterGrade(buildings, sample) {
  const halls=buildings.filter(b=>b.blueprint?.amphitheater).map(b=>{
    const layout=amphitheaterLayout(b.obb,b.blueprint.amphitheater);
    const pts=layout.outline.map(([x,z])=>auditoriumPoint(b.obb,layout,x,z));
    const heights=pts.map(([x,z])=>sample(x,z)).sort((a,b)=>a-b);
    const base=(heights[2]+heights[3])/2;
    const enclosure=layout.enclosure.map(([x,z])=>auditoriumPoint(b.obb,layout,x,z));
    const profile={sample:(x,z)=>sample(...auditoriumPoint(b.obb,layout,x,z))-base};
    return {id:String(b.id),base,profile,depth:layout.depth,distance:polygonDistanceField([enclosure],2.5),
      minX:Math.min(...enclosure.map(p=>p[0])),maxX:Math.max(...enclosure.map(p=>p[0])),
      minZ:Math.min(...enclosure.map(p=>p[1])),maxZ:Math.max(...enclosure.map(p=>p[1]))};
  });
  const floors=new Map(halls.map(h=>[h.id,h.base]));
  const profiles=new Map(halls.map(h=>[h.id,h.profile]));
  return {floors,profiles,sample(x,z) {
    let y=sample(x,z);
    for(const h of halls) {
      if(x<h.minX||x>h.maxX||z<h.minZ||z>h.maxZ) continue;
      const distance=h.distance(x,z);
      if(distance>=-1.5) continue;
      const t=Math.min(1,-distance-1.5),blend=t*t*(3-2*t);
      y+=(Math.min(y,h.base-h.depth-.8)-y)*blend;
    }
    return y;
  }};
}
