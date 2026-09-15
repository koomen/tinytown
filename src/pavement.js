import * as THREE from 'three';
import { polygonDistanceField } from './polygon-distance.js';

// A single triangulated surface for overlapping walks and entrance aprons.
// Every grid vertex has one height, and skirts exist only at the union's
// outside edge. Separate draped slabs can intersect even with identical yAt.
export function pavementGeometry(polygons, heightAt, colorAt, cell = 0.5, options = {}) {
  const cells = new Set();
  const key = (x,z) => `${x},${z}`;
  for (const original of polygons) {
    const pts = options.grid ? options.grid.polygon(original) : original;
    if (pts.length < 3) continue;
    const xs=pts.map(p=>p[0]), zs=pts.map(p=>p[1]);
    const bb={x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};
    // Fill occupied rows, plus the boundary cells. A long diagonal sidewalk
    // should cost its paved area, not the area of its enclosing rectangle.
    for(let j=Math.floor(bb.z0/cell);j<=Math.floor(bb.z1/cell);j++) {
      const z=(j+0.5)*cell,hits=[];
      for(let a=0,b=pts.length-1;a<pts.length;b=a++) {
        const p=pts[a],q=pts[b];
        if((p[1]>z)!==(q[1]>z)) hits.push(p[0]+(q[0]-p[0])*(z-p[1])/(q[1]-p[1]));
      }
      hits.sort((a,b)=>a-b);
      for(let a=0;a+1<hits.length;a+=2) for(let i=Math.floor(hits[a]/cell);i<=Math.floor(hits[a+1]/cell);i++) cells.add(key(i,j));
    }
    for(let a=0,b=pts.length-1;a<pts.length;b=a++) {
      const p=pts[a],q=pts[b],steps=Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/cell*2);
      for(let k=0;k<=steps;k++) {
        const t=k/(steps||1),i=Math.floor((p[0]+(q[0]-p[0])*t)/cell),j=Math.floor((p[1]+(q[1]-p[1])*t)/cell);
        for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++) cells.add(key(i+dx,j+dz));
      }
    }
  }
  // Distances beyond four cells cannot affect a clipped triangle. Keeping
  // this band finite makes empty neighbors safe to interpolate as well.
  const polygonDistance = polygonDistanceField(polygons, cell * 4 * (options.grid?.scale || 1));
  const distanceAt = (x,z) => Math.max(polygonDistance(x,z), options.clip?.(x,z) ?? -Infinity);
  const samples=new Map();
  const sample=(i,j) => {
    const k=key(i,j); if(samples.has(k)) return samples.get(k);
    const [x,z]=options.grid ? options.grid.point(i*cell,j*cell) : [i*cell,j*cell],p={x,z,d:distanceAt(x,z)}; samples.set(k,p); return p;
  };
  const vertices=[], indices=[], vertexIds=new Map(), edges=new Map();
  const vertex=p => {
    const k=key(Math.round(p.x*1e6),Math.round(p.z*1e6));
    if(vertexIds.has(k)) return vertexIds.get(k);
    const i=vertices.length/3;
    vertices.push(p.x,heightAt(p.x,p.z),p.z); vertexIds.set(k,i); return i;
  };
  const triangle=(a,b,c) => {
    // Clip this grid triangle against the sampled union boundary.
    const input=[a,b,c], poly=[];
    for(let i=0;i<3;i++) {
      const p=input[i],q=input[(i+1)%3];
      if(p.d<=0) poly.push(p);
      if((p.d<0 && q.d>0) || (p.d>0 && q.d<0)) {
        const t=p.d/(p.d-q.d); poly.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t,d:0});
      }
    }
    for(let i=1;i<poly.length-1;i++) {
      const p=poly[0],q=poly[i],r=poly[i+1];
      if(Math.abs((q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x))<1e-9) continue;
      const ids=[vertex(p),vertex(q),vertex(r)]; indices.push(...ids);
      for(let j=0;j<3;j++) {
        const a=ids[j],b=ids[(j+1)%3],k=a<b?key(a,b):key(b,a);
        const edge=edges.get(k); if(edge) edge.count++; else edges.set(k,{a,b,count:1});
      }
    }
  };
  for(const k of cells) {
    const [i,j]=k.split(',').map(Number);
    const a=sample(i,j),b=sample(i,j+1),c=sample(i+1,j+1),d=sample(i+1,j);
    triangle(a,b,d); triangle(b,c,d);
  }
  const topCount=vertices.length/3;
  const boundary=[...edges.values()].filter(e=>e.count===1),starts=new Map(),contours=[];
  for(const e of boundary) {if(!starts.has(e.a)) starts.set(e.a,[]);starts.get(e.a).push(e);}
  const used=new Set();
  for(const first of boundary) {
    if(used.has(first)) continue;
    const line=[]; let e=first;
    while(e && !used.has(e)) {
      used.add(e);line.push([vertices[e.a*3],vertices[e.a*3+2]]);
      if(e.b===first.a) {line.push([...line[0]]);break;}
      const next=(starts.get(e.b)||[]).find(n=>!used.has(n));
      if(!next) line.push([vertices[e.b*3],vertices[e.b*3+2]]);
      e=next;
    }
    contours.push(line);
  }
  for(const {a,b,count} of edges.values()) {
    if(count!==1 || options.skirt===0) continue;
    const i=vertices.length/3;
    for(const [v,drop] of [[a,0],[a,0.35],[b,0],[b,0.35]]) {
      vertices.push(vertices[v*3],vertices[v*3+1]-drop,vertices[v*3+2]);
    }
    indices.push(i,i+1,i+2,i+1,i+3,i+2);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices);
  geo.userData.topVertexCount=topCount;
  geo.userData.topIndexCount=[...edges.values()].reduce((n,e)=>n+e.count,0);
  geo.userData.contours=contours;
  geo.userData.distanceAt=distanceAt;
  return finishPavement(geo, colorAt);
}

// These linear passes are cheap; derive them from the same positions on both
// paths instead of shipping megabytes of redundant colors and normals.
export function finishPavement(geo, colorAt) {
  const pos = geo.attributes.position, top = geo.userData.topVertexCount;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = colorAt(pos.getX(i), pos.getZ(i)), shade = i < top ? 1 : 0.9;
    colors[i * 3] = c.r * shade; colors[i * 3 + 1] = c.g * shade; colors[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  for (let i = 0; i < top; i++) geo.attributes.normal.setXYZ(i, 0, 1, 0);
  return geo;
}
