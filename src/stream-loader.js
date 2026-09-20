import * as THREE from 'three';

// Exported scenes contain raw BufferGeometry attributes, already typed by the
// binary decoder. ObjectLoader normally allocates a second copy of every one.
export class StreamObjectLoader extends THREE.ObjectLoader {
  constructor(sharedGeometries={}) {
    super();
    this.sharedGeometries=sharedGeometries;
  }
  parseGeometries(records=[]) {
    const geometries={...this.sharedGeometries};
    for(const {uuid,type,data} of records) {
      if(!['BufferGeometry','InstancedBufferGeometry'].includes(type))throw new Error('Unsupported streamed geometry');
      const geometry=type==='InstancedBufferGeometry'?new THREE.InstancedBufferGeometry():new THREE.BufferGeometry();geometry.uuid=uuid;
      for(const [name,a] of Object.entries(data.attributes))
        geometry.setAttribute(name,a.isInstancedBufferAttribute
          ?new THREE.InstancedBufferAttribute(a.array,a.itemSize,a.normalized,a.meshPerAttribute)
          :new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));
      if(geometry.isInstancedBufferGeometry) {
        geometry.instanceCount=data.instanceCount;
        if(data.boundingBox)geometry.boundingBox=new THREE.Box3(new THREE.Vector3().fromArray(data.boundingBox.min),new THREE.Vector3().fromArray(data.boundingBox.max));
        if(data.boundingSphere)geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3().fromArray(data.boundingSphere.center),data.boundingSphere.radius);
      }
      if(data.index)geometry.setIndex(new THREE.BufferAttribute(data.index.array,1));
      for(const {start,count,materialIndex} of data.groups||[])geometry.addGroup(start,count,materialIndex);
      geometries[uuid]=geometry;
    }
    return geometries;
  }
}

export function decodeStream(bytes,rawBytes,{signal,onProgress=()=>{}}={}) {
  return new Promise((resolve,reject)=>{
    signal?.throwIfAborted();
    const workerURL=new URL('./stream-worker.js',import.meta.url);
    workerURL.search=new URL(import.meta.url).search;
    const worker=new Worker(workerURL,{type:'module'});
    let timer;
    const finish=(error,json)=>{
      clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();
      if(error)reject(error);else resolve(json);
    };
    const abort=()=>finish(signal.reason);
    const watch=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(new Error('Scenery decoding stalled. Please retry.')),30000);};
    worker.onmessage=({data})=>{
      watch();
      if(data.error)finish(new Error(data.error));
      else if(data.json)finish(null,data.json);
      else onProgress(data.progress);
    };
    worker.onerror=event=>{event.preventDefault();finish(new Error(event.message||'Could not start the scenery decoder'));};
    worker.onmessageerror=()=>finish(new Error('Could not receive the decoded scenery'));
    signal?.addEventListener('abort',abort,{once:true});watch();
    try {
      if(Array.isArray(bytes)) worker.postMessage({parts:bytes,rawBytes},[...new Set(bytes.map(p=>p.buffer))]);
      else worker.postMessage({bytes,rawBytes},[bytes.buffer]);
    }
    catch(error) { finish(error); }
  });
}
