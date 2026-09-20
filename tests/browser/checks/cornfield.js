import * as THREE from 'three';
import { buildCornfield } from '../../../src/cornfield.js';
import { restoreCornSpriteMaterial } from '../../../src/corn-sprites.js';
import { coarseModel, sceneJSON } from '../../../tinytown/web/stream-export.js';
import { bakeMobile } from '../../../src/bake.js';
import { StreamObjectLoader } from '../../../src/stream-loader.js';
import { packSceneJSON, unpackSceneJSON } from '../../../src/stream-format.js';
import { buildCroplandSurface } from '../../../src/cropland.js';
import { surfaceMaterial } from '../../../src/materials.js';

export async function checkCornfield() {
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const feature={id:'test',pts:[[0,0],[80,0],[80,90],[55,90],[55,50],[0,50]],crop:{angle:-.25,height:1.9,rowSpacing:.8}};
  const grade=(x,z)=>x*.03+z*.06;
  const inside=(x,z)=>{
    let hit=false;
    for(let i=0,j=feature.pts.length-1;i<feature.pts.length;j=i++) {
      const a=feature.pts[i],b=feature.pts[j];
      if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }
    return hit;
  };
  const field=buildCornfield(feature,grade),plants=field.getObjectByName('corn-individual-stalks');
  const soil=buildCroplandSurface(feature,grade,{xs:[0,20,40,60,80],zs:[0,30,60,90]});
  const soilPosition=soil.geometry.attributes.position,soilUv=soil.geometry.attributes.uv;
  let area=0;
  for(let i=0;i<soil.geometry.index.count;i+=3) {
    const ids=[0,1,2].map(j=>soil.geometry.index.getX(i+j));
    const p=ids.map(j=>[soilPosition.getX(j),soilPosition.getZ(j)]);
    assert(inside(p.reduce((n,v)=>n+v[0],0)/3,p.reduce((n,v)=>n+v[1],0)/3),'soil must respect the concave cultivated boundary');
    area+=Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[2][0]-p[0][0])*(p[1][1]-p[0][1]))/2;
  }
  assert(Math.abs(area-5000)<.001,'soil must cover the entire field, including the headland');
  for(let i=0;i<soilPosition.count;i++)assert(Math.abs(soilPosition.getY(i)-grade(soilPosition.getX(i),soilPosition.getZ(i))-.065)<.0001,'plowed soil must follow the terrain');
  const soilGroup=new THREE.Group();soilGroup.add(soil);
  const bakedSoil=await bakeMobile(soilGroup),bakedUv=bakedSoil.children[0].geometry.attributes.uv;
  assert(bakedUv.count===soilUv.count && bakedUv.array.every((v,i)=>v===soilUv.array[i]),'field furrow coordinates must survive baking without window IDs');
  const streamedSoil=await new StreamObjectLoader().parseAsync(unpackSceneJSON(await packSceneJSON(sceneJSON(bakedSoil)).arrayBuffer()));
  const soilMesh=streamedSoil.children[0],template=surfaceMaterial(soilMesh.material.userData.surface,0xffffff,true);
  soilMesh.material.onBeforeCompile=template.onBeforeCompile;soilMesh.material.customProgramCacheKey=template.customProgramCacheKey;
  assert(soilMesh.material.userData.surface==='plowed' && soilMesh.geometry.attributes.uv.count===soilUv.count,'soil treatment must survive binary streaming');
  const g=plants.geometry,a=g.attributes.cornPlant;
  assert(g.isInstancedBufferGeometry && a.isInstancedBufferAttribute,'compact plant attributes must remain instanced');
  assert(g.instanceCount>20000 && g.instanceCount<24000,'dense individual stalk count');
  assert(g.index.count===6 && g.attributes.position.count===4,'exactly one quad per stalk, without crossing or horizontal cards');
  assert(a.array instanceof Uint16Array && a.array.byteLength===g.instanceCount*8,'eight-byte plant budget');
  assert(plants.material.alphaTest>0 && !plants.material.transparent && plants.material.depthWrite,'cutouts write depth without blending');
  for(let i=0;i<a.count;i++) {
    const x=plants.position.x+a.getX(i)*.01,y=plants.position.y+a.getY(i)*.01,z=plants.position.z+a.getZ(i)*.01,r=a.getW(i)*.01*.43/2;
    assert(Math.abs(y-grade(x,z))<.04,'each stalk must be planted at terrain height');
    for(let n=0;n<8;n++)assert(inside(x+Math.cos(n*Math.PI/4)*r,z+Math.sin(n*Math.PI/4)*r),'billboard must remain inside the field as the camera orbits');
  }
  field.updateMatrixWorld(true);
  const coarse=coarseModel(field);
  assert(coarse.children.length===1 && coarse.children[0].visible,'distant field uses one visible mesh');
  assert(coarse.children[0].geometry.isInstancedBufferGeometry,'distant corn must remain individual upright sprites');
  assert(coarse.children[0].geometry.instanceCount===Math.ceil(g.instanceCount/3),'distant plants use reduced density');
  assert(coarse.children[0].layers.mask===plants.layers.mask,'far plants must retain the color-pass layer');
  const detail=await bakeMobile(field);
  assert(!detail.getObjectByName('corn-distant-stalks'),'far stalks must not overlap nearby stalks');
  const blob=packSceneJSON(sceneJSON(detail)),json=unpackSceneJSON(await blob.arrayBuffer());
  const restored=await new StreamObjectLoader().parseAsync(json);
  const sprites=restored.getObjectByName('corn-individual-stalks');
  assert(sprites.geometry.instanceCount===g.instanceCount && sprites.geometry.attributes.cornPlant.isInstancedBufferAttribute,'binary streaming must retain compact instancing');
  assert(sprites.geometry.boundingSphere.radius===g.boundingSphere.radius,'shader-positioned field bounds must survive streaming');
  assert(sprites.material.map.image.width===512 && sprites.material.userData.cornSprite,'atlas and shader identity must survive streaming');
  assert(sprites.material.map.premultiplyAlpha,'leaf colors must retain their coverage filtering after streaming');
  restoreCornSpriteMaterial(sprites.material);
  const renderer=new THREE.WebGLRenderer({antialias:false}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,300);
  renderer.setSize(128,128);camera.layers.enable(1);scene.add(restored,new THREE.HemisphereLight(0xffffff,0x555544,2));
  for(const theta of [0,Math.PI/2,Math.PI]) {
    camera.position.set(40+Math.sin(theta)*60,40,40+Math.cos(theta)*60);camera.lookAt(40,3,40);renderer.render(scene,camera);
    assert(renderer.info.render.triangles===g.instanceCount*2,'all individual plants must render after streaming');
  }
  assert(renderer.info.programs.every(p=>p.diagnostics?.runnable!==false),'billboard shader must compile');
  scene.add(streamedSoil);renderer.render(scene,camera);
  assert(renderer.info.programs.every(p=>p.diagnostics?.runnable!==false),'streamed plowed soil shader must compile');
  renderer.dispose();
  restored.traverse(o=>{if(o.isMesh)assert(!o.castShadow,'corn should not add shadow draws');});
  return {stalks:g.instanceCount,triangles:g.instanceCount*2,instanceBytes:a.array.byteLength};
}
