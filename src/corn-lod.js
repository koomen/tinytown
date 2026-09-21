import * as THREE from 'three';

// Use the nearest corner in camera space, so approaching the edge of a large
// field restores its stalks. Projection scale also accounts for camera zoom.
export function restoreCornLOD(mesh) {
  const settings=mesh.userData.cornLOD;
  if(!settings)return mesh;
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  mesh.onBeforeRender=(_renderer,_scene,camera)=>{
    matrix.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);
    let depth=Infinity;
    for(const x of [settings.min[0],settings.max[0]])
      for(const y of [settings.min[1],settings.max[1]])
        for(const z of [settings.min[2],settings.max[2]]) {
          point.set(x,y,z).applyMatrix4(matrix);depth=Math.min(depth,-point.z);
        }
    const span=settings.height*Math.abs(camera.projectionMatrix.elements[5])/2;
    const detailed=(camera.isOrthographicCamera?span:span/Math.max(.1,depth))>.02;
    if(mesh.geometry.isInstancedBufferGeometry)
      mesh.geometry.instanceCount=detailed?mesh.geometry.attributes.cornPlant.count:0;
    else mesh.geometry.setDrawRange(0,detailed?0:Infinity);
  };
  return mesh;
}

let canopyMaterial;
function material() {
  if(canopyMaterial)return canopyMaterial;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d');c.fillStyle='#789447';c.fillRect(0,0,64,64);
  for(let i=0;i<320;i++) {
    const n=(Math.sin(i*127.1+311.7)*43758.5453%1+1)%1;
    c.fillStyle=['#819c4b','#91a653','#5c8034','#9cab5a'][i%4];
    c.fillRect((i*23)%64,n*64,2,3+n*5);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  canopyMaterial=new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:1,side:THREE.DoubleSide});
  return canopyMaterial;
}

// Three strips per planting row replace tens of thousands of cutout cards.
// Short segments follow rolling terrain; the row layout retains concavities,
// headlands and planting direction. Opaque foliage avoids alpha overdraw.
export function cornCanopy(rows,height,grade,origin) {
  const positions=[],uv=[],colors=[],indices=[];
  for(const row of rows) {
    const length=Math.hypot(row.b[0]-row.a[0],row.b[1]-row.a[1]);
    const segments=Math.ceil(length/12),start=positions.length/3;
    for(let i=0;i<=segments;i++) {
      const t=i/segments,x=row.a[0]+(row.b[0]-row.a[0])*t,z=row.a[1]+(row.b[1]-row.a[1])*t;
      for(const [side,rise,tone] of [[-.5,.25,.92],[-.3,.82,1],[.3,.82,1],[.5,.25,.92]]) {
        const px=x+row.across[0]*row.width*side,pz=z+row.across[1]*row.width*side;
        positions.push(px-origin.x,grade(px,pz)+height*rise-origin.y,pz-origin.z);
        uv.push(side+.5,t*length);colors.push(tone,tone,tone);
      }
      if(i)for(let j=0;j<3;j++) {
        const a=start+(i-1)*4+j,b=a+4;
        indices.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  // Match the upward leaf normals of the close-up sprites. Lighting these as
  // solid hedges instead would turn entire rows dark when the camera orbits.
  const normals=geometry.attributes.normal;
  for(let i=0;i<normals.count;i++)normals.setXYZ(i,0,1,0);
  const mesh=new THREE.Mesh(geometry,material());mesh.position.copy(origin);
  mesh.name='corn-row-canopy';mesh.userData.keep=true;mesh.userData.castShadow=false;
  mesh.userData.streamCoarse=true;mesh.layers.set(1);
  return mesh;
}
