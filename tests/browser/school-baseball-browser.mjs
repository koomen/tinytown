import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const importmap=(await readFile(root+'index.html','utf8')).match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const output=root+'runs/school-baseball';await mkdir(output,{recursive:true});
const html=`<!doctype html><html><head>${importmap}<style>body{margin:0}</style></head><body><script type="module">
import * as THREE from 'three';
import {buildLandmarks} from '/src/landmarks.js';
import {shiftLandmark} from '/src/landmark-frame.js';
import {coarseModel} from '/tinytown/web/stream-export.js';
import {bakeMobile} from '/src/bake.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const named=(root,name)=>{const a=[];root.traverse(o=>{if(o.name===name)a.push(o);});return a;};
const inside=([x,z],ring)=>{
 let hit=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
  const [a,b]=ring[i],[c,d]=ring[j];
  if((b>z)!==(d>z) && x<(c-a)*(z-b)/(d-b)+a)hit=!hit;
 }
 return hit;
};
const site=await fetch('/data/avon-extended/site.json').then(r=>r.json());
const ids=[133759508,133759501,'avon-school-south-softball'];
const features=ids.map(id=>{
 const matches=site.landmarks.filter(f=>f.id===id);check(matches.length===1,'each field occurs exactly once');
 return shiftLandmark(matches[0],520,864);
});
const grade=(x,z)=>2*Math.sin(x/30)+Math.cos(z/25);
const grid={xs:Array.from({length:101},(_,i)=>-200+i*4),zs:Array.from({length:101},(_,i)=>-200+i*4)};
// The sample follows the same triangular grid interpolation as town terrain.
const sample=(x,z)=>{
 const i=Math.floor((x+200)/4),j=Math.floor((z+200)/4),a=-200+i*4,b=-200+j*4,u=(x-a)/4,v=(z-b)/4;
 return u+v<=1 ? grade(a,b)*(1-u-v)+grade(a+4,b)*u+grade(a,b+4)*v
 : grade(a+4,b+4)*(u+v-1)+grade(a,b+4)*(1-u)+grade(a+4,b)*(1-v);
};
const group=buildLandmarks(features,{grade:sample,grid});group.updateMatrixWorld(true);
for(const [i,f] of features.entries()) {
 const boundaries=[f.pts,...f.baseball.surfaces.map(s=>s.pts)];
 const meshes=[group.children[i].children[0],...f.baseball.surfaces.map(s=>named(group.children[i],'baseball-'+s.role)[0])];
 for(let layer=0;layer<boundaries.length-1;layer++) {
  check(boundaries[layer+1].every(p=>inside(p,boundaries[layer])),'nested infield patches stay inside the field');
  const p=meshes[layer].geometry.attributes.position,idx=meshes[layer].geometry.index;
  for(let t=0;t<idx.count;t+=3) {
   const tri=[0,1,2].map(j=>idx.getX(t+j));
   const center=[tri.reduce((s,j)=>s+p.getX(j)/3,0),tri.reduce((s,j)=>s+p.getZ(j)/3,0)];
   check(!inside(center,boundaries[layer+1]),'adjoining grass and dirt do not overlap and flicker');
  }
 }
}
check(named(group,'baseball-infield-dirt').length===3,'three traced dirt infields');
check(named(group,'baseball-infield-grass').length===3,'all school diamonds have grass islands');
check(named(group,'baseball-pitching-mound').length===3,'all school diamonds have small dirt pitching areas');
check(named(group,'baseball-base').length===12,'four bases per diamond');
check(named(group,'baseball-pitching-rubber').length===3,'three pitching rubbers');
check(named(group,'baseball-foul-lines').length===3,'continuous first and third base foul lines');
for(const model of group.children) {
 model.traverse(o=>{if(o.geometry)check(o.geometry.attributes.position.array.every(Number.isFinite),'finite field geometry');});
 for(const name of ['baseball-infield-dirt','baseball-infield-grass','baseball-pitching-mound','baseball-foul-lines']) {
  for(const mesh of named(model,name)) {
   const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;
   for(let i=0;i<idx.count;i+=3) {
    const tri=[0,1,2].map(j=>idx.getX(i+j));
    const x=tri.reduce((s,j)=>s+p.getX(j)/3,0),z=tri.reduce((s,j)=>s+p.getZ(j)/3,0),y=tri.reduce((s,j)=>s+p.getY(j)/3,0);
    check(y-sample(x,z)>.12 && y-sample(x,z)<.24,'playing surfaces follow terrain without sinking or floating');
   }
  }
 }
 const far=coarseModel(model);
 check(named(far,'baseball-base').length===4 && named(far,'baseball-infield-dirt').length===1,'bases and infield survive distant rendering');
 check((await bakeMobile(far)).children.length>0,'field survives stream serialization');
}
for(const f of features) {
 const lengths=f.bases.map((p,i)=>Math.hypot(p[0]-f.bases[(i+1)%4][0],p[1]-f.bases[(i+1)%4][1]));
 check(lengths.every(d=>d>17 && d<29),'aerial base spacing is plausible for baseball/softball');
}
check(!site.landmarks.find(f=>f.id===134399651).bases,'remaining practice enclosure has no invented diamond');
check(!site.landmarks.some(f=>f.id===140641618),'unwanted square beside the smallest field is removed');
check(features[1].baseball.fences.length===0,'smallest field has no perimeter fence or backstop');
const smallDetails=named(group,'baseball-details-133759501')[0];
check(smallDetails.userData.baseballPanels.every(p=>p.height<1),'smallest field renders only dugout front screens');
const medium=features[2], mediumFences=medium.baseball.fences;
check(mediumFences.length===3 && mediumFences.filter(f=>f.height<2).every(f=>f.pts.length===2),'middle field has a backstop and two straight baseline fences');
const outfield=medium.pts.slice(0,10);
const mediumDetails=named(group,'baseball-details-avon-school-south-softball')[0];
check(mediumDetails.userData.baseballPanels.every(panel=>{
 const center=panel.a.map((v,i)=>(v+panel.b[i])/2);
 return outfield.slice(1).every((b,i)=>{
  const a=outfield[i],dx=b[0]-a[0],dz=b[1]-a[1],t=((center[0]-a[0])*dx+(center[1]-a[1])*dz)/(dx*dx+dz*dz);
  return t<0 || t>1 || Math.hypot(center[0]-a[0]-t*dx,center[1]-a[1]-t*dz)>.1;
 });
}),'middle field renders no panels around the outfield');
// Legacy fields still receive their original grass patches.
const legacy=buildLandmarks([shiftLandmark(site.landmarks.find(f=>f.id===134399645),0,0)]);
check(named(legacy,'baseball-base').length===4,'Driving Park field still renders');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,1100);document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce6ec');scene.add(group);
scene.add(new THREE.HemisphereLight(0xffffff,0x6b7559,2));const sun=new THREE.DirectionalLight(0xffefd9,3);sun.position.set(-50,100,50);scene.add(sun);
const camera=new THREE.PerspectiveCamera(35,1400/1100,.1,2000);camera.position.set(70,460,355);camera.lookAt(0,0,55);renderer.render(scene,camera);
check(renderer.info.programs.every(p=>p.diagnostics?.runnable!==false),'shaders compile');window.ready=true;
</script></body></html>`;
await withBrowser(root,async page=>{
 const errors=[];page.events.add(e=>{if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails);});
 await page.go('/__school-baseball.html');
 await waitFor(async()=>{if(errors.length)throw Error(JSON.stringify(errors));return page.evaluate('window.ready===true');},'school baseball checks',60000);
 const shot=await page.send('Page.captureScreenshot',{format:'png'});await writeFile(output+'/fields.png',Buffer.from(shot.data,'base64'));
 assert.deepEqual(errors,[]);console.log('PASS three school diamonds: terrain, bases, pitching areas, foul lines, coarse geometry, stream serialization and legacy fields');
},{width:1400,height:1100,route:async(req,res)=>{if(req.url!=='/__school-baseball.html')return false;res.setHeader('Content-Type','text/html');res.end(html);return true;}});
