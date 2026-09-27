import {polygonDistanceField} from './polygon-distance.js';

// Local coordinates retain the planted pocket's original footprint. The narrow
// entry cut reaches west toward the Amphitheater without changing its walk.
const bed=[[-4.6,-5.6],[-2.7,-6.6],[1.8,-6.6],[4.2,-4.8],[4.9,-.8],
  [4.95,3.2],[4.6,6.6],[1.9,8.9],[-2.7,8.9],[-3,7.7],[-2.8,4.2],[-4,1.8],[-4.7,-2.4]];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// The red footbridge spans the rill along local v. The garden walk is one
// loop: it leaves the bridge's north end, rounds all three pools and returns
// to the south end, so the bridge deck carries the loop across the water.
export const GARDEN_BRIDGE=Object.freeze({u:.25,v:1.35,length:3.5,width:1.24});
export const GARDEN_LOOP_WIDTH=1.2;
const loopControls=[[.25,-.4],[.25,-1.4],[.3,-2.6],[.15,-3.7],[-.45,-4.8],[-1.45,-5.45],
  [-2.5,-5.3],[-3.2,-4.45],[-3.4,-3.2],[-3.4,-1.0],[-3.3,1.4],[-3.05,2.9],[-2.45,4.2],
  [-1.3,5.0],[-.3,4.85],[.2,4.2],[.25,3.45],[.25,3.1]];

// Centripetal Catmull-Rom; mirrored end points keep both ends on the bridge axis.
function catmullRom(points,spacing) {
  const n=points.length,ext=[points[0].map((v,i)=>2*v-points[1][i]),...points,
    points[n-1].map((v,i)=>2*v-points[n-2][i])];
  const knot=(a,b)=>Math.sqrt(Math.hypot(b[0]-a[0],b[1]-a[1]))||1e-6;
  const out=[points[0]];
  for(let i=1;i<n;i++) {
    const [p0,p1,p2,p3]=ext.slice(i-1,i+3);
    const t1=knot(p0,p1),t2=t1+knot(p1,p2),t3=t2+knot(p2,p3);
    const lerp=(a,b,ta,tb,t)=>a.map((v,k)=>(tb-t)/(tb-ta)*v+(t-ta)/(tb-ta)*b[k]);
    const steps=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/spacing));
    for(let j=1;j<=steps;j++) {
      const t=t1+(t2-t1)*j/steps;
      const a1=lerp(p0,p1,0,t1,t),a2=lerp(p1,p2,t1,t2,t),a3=lerp(p2,p3,t2,t3,t);
      out.push(lerp(lerp(a1,a2,0,t2,t),lerp(a2,a3,t1,t3,t),t1,t2,t));
    }
  }
  out[out.length-1]=points[n-1];return out;
}
export const GARDEN_LOOP=Object.freeze(catmullRom(loopControls,.2).map(p=>Object.freeze(p)));
// The full walking circuit, bridge span included, for distance queries.
const circuit=[...GARDEN_LOOP,GARDEN_LOOP[0]];

export function distanceToPolyline(points,u,v) {
  let d=Infinity;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],du=b[0]-a[0],dv=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((u-a[0])*du+(v-a[1])*dv)/(du*du+dv*dv||1)));
    d=Math.min(d,Math.hypot(u-a[0]-t*du,v-a[1]-t*dv));
  }
  return d;
}

export function amphitheaterGardenGrade(features,sample) {
  const gardens=(features||[]).filter(f=>f.garden?.type==='carnahan-jackson'
    &&f.garden.position?.length===2&&f.garden.position.every(Number.isFinite)).map(f=>{
    const spec=f.garden,[x,z]=spec.position,c=Math.cos(spec.angle||0),s=Math.sin(spec.angle||0);
    return {x,z,c,s,depth:spec.depth??1.05,distance:polygonDistanceField([bed],1.2)};
  });
  return (x,z)=>{
    let y=sample(x,z);
    for(const g of gardens) {
      const dx=x-g.x,dz=z-g.z,u=g.c*dx-g.s*dz,v=g.s*dx+g.c*dz;
      if(u< -9.2||u>5||v< -7.2||v>10.4)continue;
      const pocket=smooth(-g.distance(u,v)/1.2);
      // The cut starts 1.6 m inside the public path edge, leaving enough
      // untouched ground for the town's 1 m terrain triangles at that edge.
      const entry=smooth((u+9.2)/3.3)*smooth((2.7-Math.abs(v-1.4))/1.3)
        *smooth((-1.5-u)/1.5);
      // The whole loop lies on the lowered floor, with a short batter beyond it.
      const walk=smooth((1.5-distanceToPolyline(circuit,u,v))/.7);
      y-=g.depth*Math.max(pocket,entry,walk);
    }
    return y;
  };
}
