import * as THREE from 'three';
import { surfaceMaterial, paneUV } from '../../../src/materials.js';
import { bake } from '../../../src/bake.js';
import { blueprintFrontages } from '../../../src/blueprint.js';

export function checkSurfaceBaking() {
  const root = new THREE.Group();
  for (const [kind,color,x] of [['glass',0x668899,0],['glass',0xaa9977,4],['brick',0xbb6655,8]]) {
    const geo=paneUV(new THREE.BoxGeometry(2,3,0.1));
    const mesh=new THREE.Mesh(geo,surfaceMaterial(kind,color));
    mesh.position.x=x; root.add(mesh);
  }
  const baked=bake(root);
  const glass=baked.children.find(m => m.material.userData.surface==='glass');
  if(baked.children.length!==2) throw new Error('Different pane tints must share one draw call');
  const uv=glass.geometry.attributes.uv, color=glass.geometry.attributes.color;
  if(uv.count!==48) throw new Error('Baked panes lost their UVs');
  for(let i=0;i<24;i++) {
    if(uv.getX(i)%2!==uv.getX(i+24)%2 || uv.getY(i)!==uv.getY(i+24)) throw new Error('Pane UVs changed during baking');
    if(Math.floor(uv.getX(i)/2)===Math.floor(uv.getX(i+24)/2)) throw new Error('Separate windows need separate interior variants');
    if(color.getX(i)===color.getX(i+24)) throw new Error('Baking lost individual pane tint');
  }
  glass.geometry.computeBoundingBox();
  if(glass.geometry.boundingBox.min.x!==-1 || glass.geometry.boundingBox.max.x!==5) throw new Error('Baking lost pane transforms');
  for(const m of baked.children) for(const a of Object.values(m.geometry.attributes)) {
    if(![...a.array].every(Number.isFinite)) throw new Error('Non-finite baked surface attribute');
  }
  return baked.children.length;
}

export function checkEntranceFrames() {
  const obb={cx:10,cz:20,angle:Math.PI/2};
  const make=vol => blueprintFrontages({obb,blueprint:{volumes:[{...vol,faces:{
    [vol.polygon?'edge0':'-v']:{doors:[{at:0.25}],porches:[{d:2,steps:3,stepsAt:0.6}]},
  }}]}})[0];
  for(const vol of [{u:[-3,3],v:[-2,2]},{polygon:[[-3,-2],[3,-2],[3,2],[-3,2]]}]) {
    const fr=make(vol), a=fr.point(0.6), b=fr.point(0.6,1);
    if(Math.abs(fr.n[0]-1)>1e-8 || Math.abs(fr.n[1])>1e-8) throw new Error('Entrance normal does not follow building rotation');
    if(Math.abs(a[0]-12)>1e-8 || Math.abs(b[0]-a[0]-1)>1e-8) throw new Error('Entrance paving starts on the wrong wall');
    if(fr.pathAt!==0.6 || Math.abs(fr.depth-3.02)>1e-8) throw new Error('Path must meet the porch steps');
  }
  const hillside={obb,blueprint:{volumes:[{u:[-3,3],v:[-2,2],faces:{
    '-v':{doors:[{at:.5}]},
    '+v':{doors:[{at:.25,y:3.7,groundEntrance:true},{at:.75,y:3.7}]},
    '+u':{doors:[{at:.5,y:3.7,groundEntrance:true,type:'garage'}]},
  }}]}};
  const paths=blueprintFrontages(hillside),datum=blueprintFrontages(hillside,{floorDatumOnly:true});
  const uphill=paths.find(f=>f.doors.includes(.25)),low=paths.find(f=>f.doors.includes(.5));
  if(paths.length!==2 || !uphill || uphill.doors.length!==1)
    throw new Error('Only explicit uphill ground entrances join the pedestrian paths');
  if(datum.length!==1 || datum[0].point(.5).some((x,i)=>Math.abs(x-low.point(.5)[i])>1e-8))
    throw new Error('Uphill path entrances must not change the shared building floor datum');
}
