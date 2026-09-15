import {polygonDistanceField} from './polygon-distance.js';

// Local coordinates retain the planted pocket's original footprint. The narrow
// entry cut reaches west toward the Amphitheater without changing its walk.
const bed=[[-4.6,-5.6],[-2.7,-6.6],[1.8,-6.6],[4.2,-4.8],[4.9,-.8],
  [4.95,3.2],[4.6,6.6],[1.9,8.9],[-2.7,8.9],[-3,7.7],[-2.8,4.2],[-4,1.8],[-4.7,-2.4]];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const lowerWalk=[[-5.7,1.4],[-4.5,2.6],[-2.3,4.3],[.25,4.55]];
function distanceToWalk(u,v) {
  let d=Infinity;
  for(let i=1;i<lowerWalk.length;i++) {
    const a=lowerWalk[i-1],b=lowerWalk[i],du=b[0]-a[0],dv=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((u-a[0])*du+(v-a[1])*dv)/(du*du+dv*dv)));
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
      if(u< -9.2||u>5||v< -6.6||v>10.4)continue;
      const pocket=smooth(-g.distance(u,v)/1.2);
      // The cut starts 1.6 m inside the public path edge, leaving enough
      // untouched ground for the town's 1 m terrain triangles at that edge.
      const entry=smooth((u+9.2)/3.3)*smooth((2.7-Math.abs(v-1.4))/1.3)
        *smooth((-1.5-u)/1.5);
      const lowerPath=smooth((1.9-distanceToWalk(u,v))/.9);
      y-=g.depth*Math.max(pocket,entry,lowerPath);
    }
    return y;
  };
}
