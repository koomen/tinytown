// Bridge ways carry the roadway across the water. Keep the roadway's existing
// terrain datum and lower only its local water channel and bed below the deck.
import {polygonDistanceField} from './polygon-distance.js';

const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
export const mappedBridge=road=>road.bridge!=null&&!['','no','false','0',false,0].includes(road.bridge);

function nearest(points,x,z) {
  let distance=Infinity,point=null;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1));
    const p=[a[0]+dx*t,a[1]+dz*t],d=Math.hypot(x-p[0],z-p[1]);
    if(d<distance){distance=d;point=p;}
  }
  return {distance,point};
}

export function roadWaterCrossings(roads,features,grade,{reach=24}={}) {
  // Lakes have a surveyed fixed level and their own bed treatment. Authored
  // railroad/stone bridges are handled separately by bridgeGrade/buildBridge.
  const waters=features.filter(f=>f.kind==='water'&&!Number.isFinite(f.level)).map(f=>({
    ...f,distance:f.closed?polygonDistanceField([f.pts],reach):
      (x,z)=>nearest(f.pts,x,z).distance-(f.width||3)/2,
  }));
  const crossings=[];
  for(const road of roads.filter(mappedBridge)) {
    const samples=[];
    for(let i=1;i<road.pts.length;i++) {
      const a=road.pts[i-1],b=road.pts[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
      for(let j=0;j<=n;j++)samples.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);
    }
    const crossed=waters.filter(f=>samples.some(p=>f.distance(...p)<0));
    if(!crossed.length)continue;
    const waterSamples=samples.filter(p=>crossed.some(f=>f.distance(...p)<0));
    const lift=['footway','path','steps','cycleway'].includes(road.class)?.18:.04;
    const waterLevel=Math.min(...waterSamples.map(p=>grade(...p)+lift))-1.25;
    const xs=road.pts.map(p=>p[0]),zs=road.pts.map(p=>p[1]);
    crossings.push({road,waters:crossed,waterLevel,lift,
      x0:Math.min(...xs)-reach-road.width,x1:Math.max(...xs)+reach+road.width,
      z0:Math.min(...zs)-reach-road.width,z1:Math.max(...zs)+reach+road.width});
  }
  const influence=(crossing,x,z)=>{
    if(x<crossing.x0||x>crossing.x1||z<crossing.z0||z>crossing.z1)return 0;
    const roadDistance=nearest(crossing.road.pts,x,z).distance-crossing.road.width/2;
    // The flat part extends past the road edge, so sparse rural triangles
    // cannot interpolate high water back through the deck at the crossing.
    return smooth((reach-Math.max(0,roadDistance))/12);
  };
  const water=(x,z)=>{
    let y=grade(x,z)+.12;
    for(const crossing of crossings) {
      const weight=influence(crossing,x,z);
      if(weight)y+=(Math.min(y,crossing.waterLevel)-y)*weight;
    }
    return y;
  };
  const bed=(x,z)=>{
    let y=grade(x,z);
    for(const crossing of crossings) {
      const weight=influence(crossing,x,z);if(!weight)continue;
      const shore=Math.min(...crossing.waters.map(f=>f.distance(x,z)));
      // Broader bank shoulders cover the existing 12 m rural terrain cells.
      // Roads continue to use their original sampler above this excavation.
      const bank=smooth((18-shore)/12);if(!bank)continue;
      const target=water(x,z)-.55*weight-.02;
      // Water already includes the crossing's transition weight. Applying it
      // again to the excavation would leave strips of dry ground above the
      // falling water at the transition ends.
      y+=(Math.min(y,target)-y)*bank;
    }
    return y;
  };
  return {crossings,water,bed};
}
