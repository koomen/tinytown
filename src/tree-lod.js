import * as THREE from 'three';

export function coarseCanopy(source) {
  // Sample the existing lobed canopy onto a small sphere. This retains each
  // tree's silhouette and paint without retaining thousands of leaf dabs.
  source.computeBoundingBox();
  const center=source.boundingBox.getCenter(new THREE.Vector3());
  const size=source.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const positions=source.attributes.position,colors=source.attributes.color;
  const directions=new Float32Array(positions.count*3),v=new THREE.Vector3();
  for(let i=0;i<positions.count;i++) {
    v.fromBufferAttribute(positions,i).sub(center).divide(size).normalize();v.toArray(directions,i*3);
  }
  const geo=new THREE.IcosahedronGeometry(1,0),p=geo.attributes.position;
  const color=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) {
    v.fromBufferAttribute(p,i).normalize();
    let best=-Infinity,k=0;
    for(let j=0;j<positions.count;j++) {
      const score=v.x*directions[j*3]+v.y*directions[j*3+1]+v.z*directions[j*3+2];
      if(score>best){best=score;k=j;}
    }
    p.setXYZ(i,positions.getX(k),positions.getY(k),positions.getZ(k));
    color.set([colors.getX(k),colors.getY(k),colors.getZ(k)],i*3);
    v.fromBufferAttribute(source.attributes.normal,k);
    geo.attributes.normal.setXYZ(i,v.x,v.y,v.z);
  }
  geo.setAttribute('color',new THREE.BufferAttribute(color,3));
  return geo;
}
export function coarseConifer(source) {
  const segs=source.index.array[1],rows=source.attributes.position.count/segs-1;
  const around=6,up=Math.ceil(rows/6),geo=new THREE.BufferGeometry();
  for(const name of ['position','normal','color']) {
    const sourceAttribute=source.attributes[name],array=new Float32Array((around)*(up+1)*3);
    for(let j=0;j<=up;j++)for(let i=0;i<around;i++) {
      const k=Math.round(j/up*rows)*segs+Math.floor(i/around*segs);
      array.set([sourceAttribute.getX(k),sourceAttribute.getY(k),sourceAttribute.getZ(k)],(j*around+i)*3);
    }
    geo.setAttribute(name,new THREE.BufferAttribute(array,3));
  }
  const indices=[];
  for(let j=0;j<up;j++)for(let i=0;i<around;i++){
    const a=j*around+i,b=j*around+(i+1)%around;
    indices.push(a,a+around,b,b,a+around,b+around);
  }
  geo.setIndex(indices);return geo;
}
