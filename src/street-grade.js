import {terrainGrid, axisFraction} from './terrain-grid.js';
// One continuous, piecewise-planar grade for terrain and every street surface.
// Road and walking meshes subdivide this same grid; sampling a nearby road's
// centreline or taking the maximum of competing heights creates false terraces.
export const ROAD_LEVEL = 0.04;
export const WALK_LEVEL = 0.18;

export function createStreetGrade(sample, width, depth, grid = terrainGrid(width, depth)) {
  const {nx,nz,xs,zs}=grid,heights=new Float32Array((nx+1)*(nz+1));
  for(let j=0;j<=nz;j++) for(let i=0;i<=nx;i++) heights[j*(nx+1)+i]=sample(xs[i],zs[j]);
  return (x,z) => {
    const fx=axisFraction(xs,x),fz=axisFraction(zs,z);
    const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,k=j*(nx+1)+i;
    const a=heights[k],b=heights[k+nx+1],c=heights[k+nx+2],d=heights[k+1];
    return u+v<=1 ? a+(d-a)*u+(b-a)*v : c+(b-c)*(1-u)+(d-c)*(1-v);
  };
}
