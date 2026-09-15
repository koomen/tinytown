import { polygonDistanceField } from './polygon-distance.js';

// A lake has one water level; lower the raster beneath it instead of draping
// blue geometry over land-height noise. The two-metre outer bank blends gently.
export function lakeGrade(features, sample) {
  const lakes=features.filter(f=>f.kind==='water'&&f.closed&&Number.isFinite(f.level))
    .map(f=>({...f,distance:polygonDistanceField([f.pts],8)}));
  return (x,z)=>{
    let y=sample(x,z);
    for(const lake of lakes) {
      const d=lake.distance(x,z);if(d>=2)continue;
      const t=Math.max(0,Math.min(1,-d/6));
      const bed=lake.level-.35-(lake.bedDepth??2.5)*t*t*(3-2*t);
      const edge=Math.max(0,d/2),blend=1-edge*edge*(3-2*edge);
      y+=(Math.min(y,bed)-y)*blend;
    }
    return y;
  };
}
