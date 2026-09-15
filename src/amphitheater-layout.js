// Canonical auditorium coordinates: audience at +x, stage house at -x.
export function amphitheaterLayout(obb, spec = {}) {
  const length=spec.axis==='v'?obb.d:obb.w, span=spec.axis==='v'?obb.w:obb.d;
  const backstage=spec.backstageDepth??length*.22, depth=spec.bowlDepth??5.2;
  const rear=-length/2, front=length/2, start=rear+backstage;
  const half=span/2, chamfer=spec.audienceChamfer??Math.min(12,span*.2);
  const outline=[[start,-half],[front-chamfer,-half],[front,-half+chamfer],
    [front,half-chamfer],[front-chamfer,half],[start,half]];
  // Keep the seating datum independent of the smaller canopy corner cuts.
  const rearWingChamfer=Math.max(0,Math.min(spec.rearWingChamfer??0,span*.15,(length-backstage)*.15));
  const roofOutline=rearWingChamfer>0
    ? [[start,-half+rearWingChamfer],[start+rearWingChamfer,-half],...outline.slice(1,5),
      [start+rearWingChamfer,half],[start,half-rearWingChamfer]]
    : outline;
  const angle=(obb.angle||0)+(spec.axis==='v'?Math.PI/2:0)+(spec.stageEnd==='positive'?Math.PI:0);
  const houseHalf=span*.31+1,houseRear=rear+(spec.porchDepth??3.4);
  const canopyEdge=[[start,-houseHalf],...roofOutline,[start,houseHalf]];
  // The stage-house join is internal: cutting only the auditorium polygon
  // leaves a ridge of ground through the stage at that join. Use the exposed
  // building envelope, keeping the excavation inside its perimeter walkway.
  const enclosure=[[houseRear,-houseHalf],...canopyEdge,[houseRear,houseHalf]];
  const inset=2;
  const seatingOutline=outline.map(([x,z],i)=>[x-(i===0||i===5?-inset:inset),z-Math.sign(z)*inset]);
  seatingOutline[0][0]+=rearWingChamfer;seatingOutline[5][0]+=rearWingChamfer;
  return {length,span,backstage,depth,rear,front,start,half,chamfer,outline,roofOutline,rearWingChamfer,angle,
    houseHalf,houseRear,canopyEdge,enclosure,seatingOutline};
}

export function auditoriumPoint(obb, layout, x, z) {
  const c=Math.cos(layout.angle),s=Math.sin(layout.angle);
  return [(obb.cx||0)+c*x-s*z,(obb.cz||0)+s*x+c*z];
}
