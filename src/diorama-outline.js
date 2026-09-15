// Opt-in physical diorama boundaries. The source terrain and street grading
// remain rectangular; only emitted geometry is trimmed to this simple polygon.
import * as THREE from 'three';

const EPS = 1e-5;
const cross = (a,b,p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const bounds = pts => ({x0:Math.min(...pts.map(p=>p[0])), x1:Math.max(...pts.map(p=>p[0])),
  z0:Math.min(...pts.map(p=>p[1])), z1:Math.max(...pts.map(p=>p[1]))});
const overlap = (a,b) => a.x0<=b.x1+EPS && a.x1>=b.x0-EPS && a.z0<=b.z1+EPS && a.z1>=b.z0-EPS;
const boxOf = b => ({x0:b.min.x,x1:b.max.x,z0:b.min.z,z1:b.max.z});

function spatialIndex(records, cell=64) {
  const cells=new Map();
  const visit=(b,fn)=>{for(let z=Math.floor(b.z0/cell);z<=Math.floor(b.z1/cell);z++)
    for(let x=Math.floor(b.x0/cell);x<=Math.floor(b.x1/cell);x++)fn(`${x},${z}`);};
  for(const record of records)visit(record.bb,key=>{
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(record);
  });
  return b=>{
    const found=new Set();visit(b,key=>{for(const r of cells.get(key)||[])if(overlap(b,r.bb))found.add(r);});
    return [...found];
  };
}

export function createDioramaOutline(record) {
  if(!record?.pts)return null;
  const pts=record.pts.map(p=>[...p]);
  if(pts.length>1 && Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<EPS)pts.pop();
  if(pts.length<3 || pts.some(p=>p.length!==2 || !p.every(Number.isFinite)))throw new Error('Invalid diorama outline');
  const area=pts.reduce((sum,a,i)=>sum+cross([0,0],a,pts[(i+1)%pts.length]),0)/2;
  if(Math.abs(area)<EPS)throw new Error('Empty diorama outline');
  if(area<0)pts.reverse();
  const edges=pts.map((a,i)=>{const b=pts[(i+1)%pts.length];return {a,b,bb:bounds([a,b])};});
  const faces=THREE.ShapeUtils.triangulateShape(pts.map(p=>new THREE.Vector2(...p)),[]);
  const triangles=faces.map(ids=>{
    const p=ids.map(i=>pts[i]);if(cross(...p)<0)p.reverse();return {pts:p,bb:bounds(p)};
  });
  const queryEdges=spatialIndex(edges),queryTriangles=spatialIndex(triangles);
  function contains(x,z,margin=0) {
    let inside=false;
    for(const {a,b} of edges) {
      const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
      // Positions are ultimately Float32 metres; accept its submillimetre
      // rounding at the cut, independently of the polygon intersection epsilon.
      if(d<=1e-3)return margin<=0;
      if(margin>0 && d<margin)return false;
      if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  // A box that meets an edge needs exact clipping. This also handles a box
  // spanning a concavity even when all four corners happen to be inside.
  function classify(bb) {
    if(!overlap(bb,boundsAll))return -1;
    if(queryEdges(bb).length)return 0;
    return contains((bb.x0+bb.x1)/2,(bb.z0+bb.z1)/2)?1:-1;
  }
  const boundsAll=bounds(pts);
  return {pts,edges,triangles,queryEdges,queryTriangles,contains,classify,bounds:boundsAll};
}

// Clip a triangle against one convex piece of the outline. Barycentric weights
// interpolate every source attribute, including colours, UVs and smooth normals.
function clipTriangle(vertices, triangle) {
  let poly=vertices;
  for(let i=0;i<3 && poly.length;i++) {
    const a=triangle[i],b=triangle[(i+1)%3],out=[];
    let prev=poly.at(-1),pd=cross(a,b,prev.p);
    for(const next of poly) {
      const nd=cross(a,b,next.p),pi=pd>=-EPS,ni=nd>=-EPS;
      if(pi!==ni) {
        const t=pd/(pd-nd);
        out.push({p:prev.p.map((v,k)=>v+(next.p[k]-v)*t),w:prev.w.map((v,k)=>v+(next.w[k]-v)*t)});
      }
      if(ni)out.push(next);
      prev=next;pd=nd;
    }
    poly=out;
  }
  return poly;
}

export function clipDioramaGeometry(geometry, outline) {
  if(!outline)return geometry;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const classification=outline.classify(boxOf(geometry.boundingBox));
  if(classification===1)return geometry;
  if(classification===-1)return null;
  const source=geometry.attributes,p=source.position,idx=geometry.index;
  const attrs=Object.entries(source).map(([name,a])=>({name,a,out:[]}));
  const indices=[],groups=[],copied=new Int32Array(p.count).fill(-1);
  const normal=attrs.find(a=>a.name==='normal');
  let nextVertex=0;
  function emit(ids,vertex) {
    const original=vertex.w.findIndex(w=>Math.abs(w-1)<1e-10);
    if(original>=0 && copied[ids[original]]>=0)return copied[ids[original]];
    const result=nextVertex++;
    for(const {a,out} of attrs) {
      for(let k=0;k<a.itemSize;k++)out.push(ids.reduce((sum,id,j)=>sum+a.getComponent(id,k)*vertex.w[j],0));
    }
    if(normal) {
      const a=normal.out,n=a.length,L=Math.hypot(a[n-3],a[n-2],a[n-1])||1;
      a[n-3]/=L;a[n-2]/=L;a[n-1]/=L;
    }
    if(original>=0)copied[ids[original]]=result;
    return result;
  }
  function append(ids,poly,seen=null) {
    for(let k=1;k+1<poly.length;k++) {
      const vertices=[poly[0],poly[k],poly[k+1]];
      const xyz=vertices.map(v=>[0,1,2].map(c=>ids.reduce((sum,id,j)=>sum+p.getComponent(id,c)*v.w[j],0)));
      const a=xyz[0],u=xyz[1].map((v,i)=>v-a[i]),v=xyz[2].map((v,i)=>v-a[i]);
      // Vertical walls have zero x/z area but must remain in the clipped mesh.
      if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-10)continue;
      // A vertical face can lie exactly on an internal triangulation edge.
      // Both adjacent convex pieces then return the same face; emit it once.
      if(seen) {
        const key=xyz.map(p=>p.map(v=>Math.round(v*1e6)).join(',')).sort().join(':');
        if(seen.has(key))continue;seen.add(key);
      }
      indices.push(...vertices.map(v=>emit(ids,v)));
    }
  }
  const count=idx?.count??p.count;
  const start=Math.max(0,geometry.drawRange.start),end=Math.min(count,start+geometry.drawRange.count);
  const ranges=geometry.groups.length?geometry.groups:[{start:0,count,materialIndex:0}];
  for(const group of ranges) {
    const groupStart=indices.length;
    for(let i=Math.max(start,group.start);i+2<Math.min(end,group.start+group.count);i+=3) {
      const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
      const vs=ids.map((id,k)=>({p:[p.getX(id),p.getZ(id)],w:[+(k===0),+(k===1),+(k===2)]}));
      const bb=bounds(vs.map(v=>v.p)),kind=outline.classify(bb);
      if(kind===1)append(ids,vs);
      else if(kind===0) {
        const seen=new Set();
        for(const piece of outline.queryTriangles(bb))append(ids,clipTriangle(vs,piece.pts),seen);
      }
    }
    if(indices.length>groupStart && geometry.groups.length)groups.push({...group,start:groupStart,count:indices.length-groupStart});
  }
  if(!indices.length)return null;
  const out=new THREE.BufferGeometry();
  for(const {name,a,out:values} of attrs)out.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));
  out.setIndex(indices);out.groups=groups;out.name=geometry.name;out.userData={...geometry.userData,dioramaClipped:true};
  out.computeBoundingBox();out.computeBoundingSphere();
  return out;
}

// Return only mesh edges on the physical outline, never earcut's internal
// diagonals. The clipped terrain contributes its actual interpolated heights.
export function outlineBoundaryEdges(geometry,outline) {
  const p=geometry.attributes.position,idx=geometry.index,count=idx?.count??p.count,result=[],seen=new Set();
  const point=id=>[p.getX(id),p.getY(id),p.getZ(id)];
  for(let i=0;i+2<count;i+=3) {
    const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
    for(let k=0;k<3;k++) {
      const a=point(ids[k]),b=point(ids[(k+1)%3]),aa=[a[0],a[2]],bb=[b[0],b[2]];
      if(Math.hypot(a[0]-b[0],a[2]-b[2])<EPS)continue;
      for(const e of outline.queryEdges(bounds([aa,bb]))) {
        const L=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]);
        if(Math.abs(cross(e.a,e.b,aa))/L>2e-3 || Math.abs(cross(e.a,e.b,bb))/L>2e-3)continue;
        const along=p=>((p[0]-e.a[0])*(e.b[0]-e.a[0])+(p[1]-e.a[1])*(e.b[1]-e.a[1]))/L;
        if([along(aa),along(bb)].some(t=>t<-.002 || t>L+.002))continue;
        const key=[a,b].map(p=>p.map(v=>Math.round(v*1e4)).join(',')).sort().join(':');
        if(!seen.has(key)){seen.add(key);result.push([a,b]);}break;
      }
    }
  }
  return result;
}

export function outlineSkirt(edges,bottomAt,{topColor=null,bottomColor=null}={}) {
  const pos=[],colors=[];
  for(const [a,b] of edges) {
    const c=[a[0],bottomAt(a[0],a[2]),a[2]],d=[b[0],bottomAt(b[0],b[2]),b[2]];
    for(const [p,lower] of [[a,false],[c,true],[b,false],[c,true],[d,true],[b,false]]) {
      pos.push(...p);if(topColor)colors.push(...(lower?bottomColor:topColor).toArray());
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  if(topColor)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}

export function clipDioramaObject(root,outline,{waterBottomAt=null}={}) {
  if(!outline || root.userData.dioramaClipped)return root;
  root.updateMatrixWorld(true);
  const meshes=[];
  const collect=o=>{
    if(o!==root && o.userData.dioramaClipped)return;
    if(o.isMesh)meshes.push(o);
    for(const child of o.children)collect(child);
  };
  collect(root);
  const box=new THREE.Box3(),matrix=new THREE.Matrix4();
  for(const mesh of meshes) {
    if(mesh.userData.dioramaClipped)continue;
    if(mesh.isInstancedMesh) {
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      let count=0;const color=new THREE.Color();
      for(let i=0;i<mesh.count;i++) {
        mesh.getMatrixAt(i,matrix);
        box.copy(mesh.geometry.boundingBox).applyMatrix4(matrix.clone().premultiply(mesh.matrixWorld));
        // Small repeated props are kept whole so foliage is never sliced off
        // along the display edge. Geometry shared by other instances is intact.
        if(outline.classify(boxOf(box))!==1)continue;
        mesh.setMatrixAt(count,matrix);
        if(mesh.instanceColor){mesh.getColorAt(i,color);mesh.setColorAt(count,color);}count++;
      }
      mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.boundingBox=null;mesh.boundingSphere=null;continue;
    }
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    const kind=outline.classify(boxOf(box));
    if(kind===1)continue;
    if(kind===-1){mesh.removeFromParent();continue;}
    const world=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),clipped=clipDioramaGeometry(world,outline);
    if(!clipped){world.dispose();mesh.removeFromParent();continue;}
    const material=Array.isArray(mesh.material)?null:mesh.material;
    if(waterBottomAt && material?.userData.surface==='water') {
      const edges=outlineBoundaryEdges(clipped,outline);
      if(edges.length) {
        const skirt=outlineSkirt(edges,waterBottomAt),side=material.clone();side.side=THREE.DoubleSide;
        const wall=new THREE.Mesh(skirt,side);wall.name='diorama-water-edge';wall.userData.dioramaClipped=true;
        // world coordinates are converted into the same parent frame.
        wall.applyMatrix4(mesh.parent.matrixWorld.clone().invert());mesh.parent.add(wall);
      }
    }
    mesh.geometry=clipped.applyMatrix4(mesh.matrixWorld.clone().invert());
    if(clipped!==world)world.dispose();
  }
  root.userData.dioramaClipped=true;
  return root;
}

export function applyDioramaOutline(root,outline,{bottom,heightAt,topColor,bottomColor,skirtMaterial,bottomMaterial}) {
  if(!outline)return;
  // These are the original rectangular slab parts. Terrain caches and grid
  // indexing have already been consumed, so their display meshes can now change.
  const remove=[];root.traverse(o=>{if(['ground-skirt','ground-bottom'].includes(o.name))remove.push(o);});
  for(const o of remove){o.removeFromParent();o.geometry.dispose();}
  clipDioramaObject(root,outline,{waterBottomAt:heightAt});
  const ground=root.getObjectByName('ground');
  if(!ground)throw new Error('Diorama outline does not intersect the ground');
  const edges=outlineBoundaryEdges(ground.geometry,outline);
  const skirt=new THREE.Mesh(outlineSkirt(edges,()=>bottom,{topColor,bottomColor}),skirtMaterial);
  skirt.name='ground-skirt';skirt.userData.streamBase=true;root.add(skirt);
  const shape=new THREE.Shape(outline.pts.map(([x,z])=>new THREE.Vector2(x,-z)));
  const slab=new THREE.ExtrudeGeometry(shape,{depth:.6,bevelEnabled:false});
  slab.rotateX(-Math.PI/2);slab.translate(0,bottom-.6,0);
  const base=new THREE.Mesh(slab,bottomMaterial);base.name='ground-bottom';base.userData.streamBase=true;root.add(base);
  return {edges:edges.length,groundVertices:ground.geometry.attributes.position.count};
}
