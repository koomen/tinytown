// Continuous x/z strips for mapped tracks and water centerlines. Shared vertex
// pairs close every bend; a bounded miter prevents long spikes at acute turns.
export function ribbonStrip(points, width, closed = false) {
  const pts = points.filter((p,i) => !i || Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1]) > 1e-6);
  if (closed && pts.length > 1 && Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1]) < 1e-6) pts.pop();
  if (pts.length < 2) return { positions: [], indices: [] };
  const normals = [];
  const count = closed ? pts.length : pts.length-1;
  for (let i=0;i<count;i++) {
    const a=pts[i], b=pts[(i+1)%pts.length], dx=b[0]-a[0], dz=b[1]-a[1], length=Math.hypot(dx,dz);
    normals.push([-dz/length,dx/length]);
  }
  const positions=[], indices=[];
  for(let i=0;i<pts.length;i++) {
    const half=(typeof width==='function'?width(pts[i]):width)/2;
    const before=normals[(i-1+normals.length)%normals.length], after=normals[i%normals.length];
    let nx, nz, scale=half;
    if(!closed && i===0) [nx,nz]=after;
    else if(!closed && i===pts.length-1) [nx,nz]=before;
    else {
      nx=before[0]+after[0];nz=before[1]+after[1];
      const length=Math.hypot(nx,nz);
      if(length<1e-6) [nx,nz]=after;
      else {nx/=length;nz/=length;scale=Math.min(half*2,half/Math.max(.001,nx*after[0]+nz*after[1]));}
    }
    const [x,z]=pts[i];positions.push([x-nx*scale,z-nz*scale],[x+nx*scale,z+nz*scale]);
  }
  for(let i=0;i<count;i++) {
    const a=i*2,b=((i+1)%pts.length)*2;
    indices.push(a,a+1,b,a+1,b+1,b);
  }
  return {positions,indices};
}
