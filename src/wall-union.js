import * as THREE from 'three';

// Clip covered flat wall patches. Callers inset the clipping boxes past the
// covering wall's bevels. Coplanar faces belong to the later volume, so the
// shared patch cannot flicker between two slightly different tints.
export function trimCoveredWalls(mesh, boxes) {
  mesh.updateMatrix();
  const geo=mesh.geometry,p=geo.attributes.position,n=geo.attributes.normal;
  const positions=[],normals=[],point=new THREE.Vector3(),normal=new THREE.Vector3();
  const nm=new THREE.Matrix3().getNormalMatrix(mesh.matrix);
  const vertex=i => {
    point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);
    normal.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();
    return [...point.toArray(),...normal.toArray()];
  };
  const split=(poly,axis,bound,sign) => {
    const inside=[],outside=[];
    const distance=v=>Math.abs(v[axis]-bound)<1e-8?0:(v[axis]-bound)*sign;
    // A complete face on the clipping plane has one owner. For a polygon
    // crossing that plane, boundary vertices must belong to both fragments.
    if(poly.every(v=>distance(v)===0)) return {inside:poly,outside};
    for(let i=0;i<poly.length;i++) {
      const a=poly[i],b=poly[(i+1)%poly.length];
      const da=distance(a),db=distance(b);
      if(da>=0)inside.push(a);
      if(da<=0)outside.push(a);
      if((da<0 && db>0) || (da>0 && db<0)) {
        const t=da/(da-db),v=a.map((x,k)=>x+(b[k]-x)*t);
        inside.push(v);outside.push(v);
      }
    }
    return {inside,outside};
  };
  const count=geo.index?.count ?? p.count;
  for(let i=0;i<count;i+=3) {
    let pieces=[[0,1,2].map(k=>vertex(geo.index?geo.index.getX(i+k):i+k))];
    for(const {min,max} of boxes) {
      const remaining=[];
      for(const poly of pieces) {
        if([0,1,2].some(axis=>poly.every(v=>v[axis]<min[axis]) || poly.every(v=>v[axis]>max[axis]))) {
          remaining.push(poly);continue;
        }
        let inside=poly;
        for(const [axis,bound,sign] of [[0,min[0],1],[0,max[0],-1],[1,min[1],1],[1,max[1],-1],[2,min[2],1],[2,max[2],-1]]) {
          if(inside.length<3) break;
          const cut=split(inside,axis,bound,sign);
          if(cut.outside.length>=3) remaining.push(cut.outside);
          inside=cut.inside;
        }
      }
      pieces=remaining;
    }
    for(const poly of pieces) for(let j=1;j<poly.length-1;j++) {
      const tri=[poly[0],poly[j],poly[j+1]];
      const ab=new THREE.Vector3().fromArray(tri[1]).sub(new THREE.Vector3().fromArray(tri[0]));
      const ac=new THREE.Vector3().fromArray(tri[2]).sub(new THREE.Vector3().fromArray(tri[0]));
      if(ab.cross(ac).lengthSq()<1e-16) continue;
      for(const v of tri) {positions.push(...v.slice(0,3));normal.fromArray(v,3).normalize();normals.push(...normal.toArray());}
    }
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  out.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  mesh.geometry=out; mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);
  geo.dispose();
}
