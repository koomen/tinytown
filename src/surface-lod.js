export const isDrapedSurface = name => ['ground','slab','railway-ballast','curb','ribbon','landmark-surface','landmark-ribbon'].includes(name);

// Exact surface triangles are assigned to the same cells as buildings. The
// distant substitute clusters only interior vertices; every exposed edge is
// retained verbatim, including the boundary shared with a neighbouring tile.
export function partitionSurface(attributes, index, {cellSize=100,step=3,heightAt=()=>0,preserve=()=>false,interiorDrop=0}={}) {
  const p=attributes.position.array,triangles=new Map(),count=index?.length??p.length/3;
  for(let i=0;i<count;i+=3) {
    const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
    const x=(p[a*3]+p[b*3]+p[c*3])/3,z=(p[a*3+2]+p[b*3+2]+p[c*3+2])/3;
    const id=`${Math.floor(x/cellSize)}_${Math.floor(z/cellSize)}`;
    if(!triangles.has(id)) triangles.set(id,[]);
    triangles.get(id).push(a,b,c);
  }
  return [...triangles].map(([id,indices])=>{
    const ids=[],local=new Map(),ix=indices.map(i=>{
      if(!local.has(i)){local.set(i,ids.length);ids.push(i);}return local.get(i);
    });
    const detailAttributes=Object.fromEntries(Object.entries(attributes).map(([key,a])=>{
      const array=new a.array.constructor(ids.length*a.itemSize);
      ids.forEach((source,i)=>array.set(a.array.subarray(source*a.itemSize,(source+1)*a.itemSize),i*a.itemSize));
      return [key,{...a,array}];
    }));
    const detail={attributes:detailAttributes,index:new Uint32Array(ix)};
    const positions=detailAttributes.position.array,normals=detailAttributes.normal;
    const normalScale=!normals?.normalized?1:normals.array instanceof Int16Array?1/32767:normals.array instanceof Int8Array?1/127:normals.array instanceof Uint16Array?1/65535:1/255;
    // A draped slab duplicates its top rim for the vertical skirt. Welding
    // those vertices by position alone hides the visible top boundary and
    // lets simplification pull it into sawteeth. Keep normal creases distinct.
    const vertexKeys=ids.map((_,i)=>{
      const position=[positions[i*3],positions[i*3+1],positions[i*3+2]].map(v=>Math.round(v*1e5)).join(',');
      const normal=normals ? Array.from(normals.array.subarray(i*3,i*3+3),v=>Math.round(v*normalScale*1000)).join(',') : '';
      return `${position}:${normal}`;
    });
    const edges=new Map();
    for(let i=0;i<ix.length;i+=3) for(let j=0;j<3;j++) {
      const a=vertexKeys[ix[i+j]],b=vertexKeys[ix[i+(j+1)%3]],key=a<b?`${a}|${b}`:`${b}|${a}`;
      edges.set(key,(edges.get(key)||0)+1);
    }
    const boundary=new Set();
    for(const [key,n] of edges) if(n===1) for(const point of key.split('|')) boundary.add(point);
    const clusters=new Map(),representatives=[],coarsePositions=[],fixedFlags=[],remap=[];
    for(let i=0;i<ids.length;i++) {
      const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
      const fixed=boundary.has(vertexKeys[i])||preserve(x,z);
      const qx=Math.round(x/step)*step,qz=Math.round(z/step)*step;
      const lift=Math.round((y-heightAt(x,z))/.25)*.25;
      const normal=detailAttributes.normal;
      const vertical=normal ? Math.abs(normal.array[i*normal.itemSize+1])<(normal.normalized?16000:.5) : false;
      const key=fixed?`edge:${i}`:`${qx},${qz},${lift},${vertical}`;
      if(!clusters.has(key)) {
        clusters.set(key,representatives.length);representatives.push(i);
        coarsePositions.push(x,y-(fixed?0:interiorDrop),z);fixedFlags.push(fixed?1:0);
      }
      remap[i]=clusters.get(key);
    }
    const coarseIndex=[];
    for(let i=0;i<ix.length;i+=3) {
      const a=remap[ix[i]],b=remap[ix[i+1]],c=remap[ix[i+2]];
      if(a!==b && b!==c && a!==c) coarseIndex.push(a,b,c);
    }
    const coarseAttributes=Object.fromEntries(Object.entries(detailAttributes).map(([key,a])=>{
      const array=key==='position'?new Float32Array(coarsePositions):new a.array.constructor(representatives.length*a.itemSize);
      if(key!=='position') representatives.forEach((source,i)=>array.set(a.array.subarray(source*a.itemSize,(source+1)*a.itemSize),i*a.itemSize));
      return [key,{...a,array}];
    }));
    return {id,detail,coarse:{attributes:coarseAttributes,index:new Uint32Array(coarseIndex),fixed:new Uint8Array(fixedFlags)}};
  });
}
