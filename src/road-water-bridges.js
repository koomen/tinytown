import * as THREE from 'three';
import {box,mat} from './kit.js';
import {ribbonStrip} from './landmark-ribbon.js';
import {drapeTriangles} from './landmark-drape.js';

export function buildRoadWaterBridges(crossings,grade,grid) {
  return crossings.map(({road,lift,waterLevel})=>{
    const group=new THREE.Group();group.name='road-water-bridge-'+road.id;
    group.userData={streamKind:'landmark',roadId:road.id,waterLevel};
    const add=(mesh,name,coarse=true)=>{mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
      if(coarse)mesh.userData.streamCoarse=true;group.add(mesh);return mesh;};
    const strip=ribbonStrip(road.pts,road.width+.14);
    const top=drapeTriangles(strip.positions,strip.indices,(x,z)=>grade(x,z)+lift-.04,grid,0);
    const positions=[...top.positions],indices=[...top.indices],offset=positions.length/3;
    for(let i=0;i<top.positions.length;i+=3)positions.push(top.positions[i],top.positions[i+1]-.4,top.positions[i+2]);
    for(let i=0;i<top.indices.length;i+=3)indices.push(top.indices[i]+offset,top.indices[i+2]+offset,top.indices[i+1]+offset);
    // Close every exposed deck edge, including its ends at the embankments.
    const edges=new Map();for(let i=0;i<top.indices.length;i+=3)for(let j=0;j<3;j++){
      const a=top.indices[i+j],b=top.indices[i+(j+1)%3],key=a<b?a+','+b:b+','+a;
      if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
    }
    for(const[a,b]of edges.values())indices.push(a,b,a+offset,b,b+offset,a+offset);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    add(new THREE.Mesh(geo,mat('#aaa89d')),'road-water-bridge-deck');
    const beam=(a,b)=>{
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),axis=end.clone().sub(start);
      const mesh=box(axis.length(),.12,.09,'#a4a7a1');mesh.position.copy(start.add(end).multiplyScalar(.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),axis.normalize());return mesh;
    };
    for(let i=1;i<road.pts.length;i++){
      const a=road.pts[i-1],b=road.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(!length)continue;
      const n=Math.max(1,Math.ceil(length/2.4));
      for(const side of [-1,1]){
        let previous=null;
        for(let j=0;j<=n;j++){
          const t=j/n,x=a[0]+dx*t-dz/length*side*(road.width/2-.08),z=a[1]+dz*t+dx/length*side*(road.width/2-.08),y=grade(x,z)+lift;
          add(box(.085,.83,.085,'#929890',x,y+.415,z),'road-water-bridge-post',false);
          const point=[x,y+.76,z];if(previous)add(beam(previous,point),'road-water-bridge-rail');previous=point;
        }
      }
    }
    return group;
  });
}
