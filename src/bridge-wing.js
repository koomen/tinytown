// A retaining wing flares away from the open road and slopes down toward its
// outer end. Pure geometry data keeps clearance checks independent of WebGL.
export function bridgeWing(length, pier, width, height, spec, endSign, sideSign) {
  const run=spec.length??5, splay=spec.splay??1.6, thickness=spec.thickness??.55;
  const x0=endSign*(length/2-pier+thickness/2), z0=sideSign*(width/2-.08);
  const x1=x0+endSign*splay,z1=z0+sideSign*run;
  // Thickness grows outward from the road-side face, never into the span.
  const corners=[[x0,z0],[x0+endSign*thickness,z0],[x1+endSign*thickness,z1],[x1,z1]];
  const top=[height,height,spec.endHeight??1.3,spec.endHeight??1.3];
  const positions=[...corners.map(([x,z])=>[x,-.7,z]),...corners.map(([x,z],i)=>[x,top[i],z])];
  const indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
  // Footprint winding flips between mirrored corners; retain outward normals.
  const area=corners.reduce((sum,p,i)=>sum+p[0]*corners[(i+1)%4][1]-corners[(i+1)%4][0]*p[1],0);
  if(area>0) for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  return {positions,indices};
}
