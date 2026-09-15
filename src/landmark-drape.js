// Split a mapped surface on the exact terrain-cell diagonal before assigning
// heights. Endpoint-only draping can bury long water triangles inside a ridge.
export function drapeTriangles(points, triangles, grade, grid, lift = .12) {
  const positions=[],indices=[],vertices=new Map();
  const emit=poly=>{
    if(poly.length<3)return;
    const area=poly.reduce((sum,p,i)=>sum+p[0]*poly[(i+1)%poly.length][1]-poly[(i+1)%poly.length][0]*p[1],0);
    if(Math.abs(area)<1e-9)return;
    if(area>0)poly=[...poly].reverse(); // x/z clockwise faces upward in world space
    const ids=poly.map(([x,z])=>{
      const key=`${Math.round(x*1e6)},${Math.round(z*1e6)}`;
      if(vertices.has(key))return vertices.get(key);
      const id=positions.length/3;positions.push(x,grade(x,z)+lift,z);vertices.set(key,id);return id;
    });
    for(let i=1;i<ids.length-1;i++)if(new Set([ids[0],ids[i],ids[i+1]]).size===3)indices.push(ids[0],ids[i],ids[i+1]);
  };
  if(!grid) {
    // Small standalone component previews have no terrain mesh to match.
    for(let i=0;i<triangles.length;i+=3)emit(triangles.slice(i,i+3).map(j=>points[j]));
    return {positions,indices};
  }
  const clip=(poly,distance)=>{
    const out=[];
    for(let i=0;i<poly.length;i++) {
      const p=poly[i],q=poly[(i+1)%poly.length],a=distance(p),b=distance(q);
      if(a>=-1e-9)out.push(p);
      if((a<0 && b>0)||(a>0 && b<0)) {const t=a/(a-b);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
    return out;
  };
  const cell=(axis,value)=>{let lo=0,hi=axis.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(axis[m]<=value)lo=m;else hi=m;}return Math.min(axis.length-2,lo);};
  const {xs,zs}=grid;
  for(let t=0;t<triangles.length;t+=3) {
    const tri=triangles.slice(t,t+3).map(i=>points[i]);
    const x0=Math.max(xs[0],Math.min(...tri.map(p=>p[0]))),x1=Math.min(xs.at(-1),Math.max(...tri.map(p=>p[0])));
    const z0=Math.max(zs[0],Math.min(...tri.map(p=>p[1]))),z1=Math.min(zs.at(-1),Math.max(...tri.map(p=>p[1])));
    if(x0>x1||z0>z1)continue;
    for(let j=cell(zs,z0);j<=cell(zs,z1);j++)for(let i=cell(xs,x0);i<=cell(xs,x1);i++) {
      let poly=clip(tri,p=>p[0]-xs[i]);poly=clip(poly,p=>xs[i+1]-p[0]);
      poly=clip(poly,p=>p[1]-zs[j]);poly=clip(poly,p=>zs[j+1]-p[1]);
      if(poly.length<3)continue;
      const diagonal=p=>1-(p[0]-xs[i])/(xs[i+1]-xs[i])-(p[1]-zs[j])/(zs[j+1]-zs[j]);
      emit(clip(poly,diagonal));emit(clip(poly,p=>-diagonal(p)));
    }
  }
  return {positions,indices};
}
