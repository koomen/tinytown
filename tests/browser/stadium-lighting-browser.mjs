import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const importmap=(await readFile(root+'index.html','utf8')).match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const output=root+'runs/stadium-lighting';await mkdir(output,{recursive:true});
const html=`<!doctype html><html><head>${importmap}<style>body{margin:0}</style></head><body><script type="module">
import * as THREE from 'three';
import {buildFootballField,buildStadiumLights} from '/src/football-field.js';
import {createNightSpotlights,applyNightEmission} from '/src/lighting.js';
import {bakeMobile} from '/src/bake.js';
import {coarseModel} from '/tinytown/web/stream-export.js';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const feature={football:{branding:'test'},pts:[[-25,55],[25,55],[25,-55],[-25,-55]]};
const grade=(x,z)=>.015*x+.008*z;
const model=buildStadiumLights(feature,grade);model.userData.streamKind='landmark';
model.position.set(13,2,-9);model.rotation.y=.47;model.updateMatrixWorld(true);
const inspect=root=>{const anchors=[];root.updateMatrixWorld(true);root.traverse(o=>{
 if(o.geometry)check(o.geometry.attributes.position.array.every(Number.isFinite),'finite geometry');
 if(o.userData.nightSpotlight)anchors.push({position:o.getWorldPosition(new THREE.Vector3()),target:o.localToWorld(new THREE.Vector3(...o.userData.nightSpotlight.target))});
});check(anchors.length===4,'four floodlight banks');return anchors;};
const before=inspect(model);
for(const anchor of before){const target=model.worldToLocal(anchor.target.clone());check(Math.abs(target.x)<1e-6&&Math.abs(Math.abs(target.z)-22)<1e-6,'aim must land inside field');}
const far=await bakeMobile(coarseModel(model)),baked=await bakeMobile(await bakeMobile(model));
const roundTrip=model=>{const clone=model.clone(true);clone.traverse(o=>{if(o.geometry)o.geometry=new THREE.BufferGeometry().copy(o.geometry);});return new THREE.ObjectLoader().parse(clone.toJSON());};
for(const restored of [baked,roundTrip(baked),roundTrip(far)])inspect(restored).forEach((a,i)=>{
 check(a.position.distanceTo(before[i].position)<1e-6&&a.target.distanceTo(before[i].target)<1e-6,'bake/stream must preserve light aim');
});
const testScene=new THREE.Scene();testScene.add(far);const slots=createNightSpotlights(testScene);slots.refresh(testScene);
slots.update(1,new THREE.Vector3());check(slots.lights.length===4&&slots.lights.every(l=>l.intensity===4125),'four night lights');
slots.update(0,new THREE.Vector3());check(slots.lights.every(l=>l.intensity===0),'off in daytime');
far.visible=false;slots.update(1,new THREE.Vector3());check(slots.lights.every(l=>l.intensity===0),'hidden sector lights off');
testScene.remove(far);slots.refresh(testScene);slots.update(1,new THREE.Vector3());check(slots.lights.every(l=>l.intensity===0),'evicted sector lights off');
check(buildStadiumLights({football:{},pts:[[0,0],[0,0],[0,0],[0,0]]}).children.length===0,'degenerate field');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#19253b');
const camera=new THREE.PerspectiveCamera(38,1200/900,.1,1000);camera.position.set(135,135,160);camera.lookAt(0,0,0);
const sun=new THREE.DirectionalLight(0x9ebaff,.72),hemi=new THREE.HemisphereLight(0x829bce,0x343953,.34);sun.position.set(-80,150,30);scene.add(sun,hemi);
const field=buildFootballField(feature);scene.add(field);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,210),new THREE.MeshStandardMaterial({color:'#657d48'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;scene.add(ground);
const lights=createNightSpotlights(scene);lights.refresh(field);
window.pose=(day,enabled=true)=>{
 sun.color.set(day?0xffecd0:0x9ebaff);sun.intensity=day?3.6:.72;hemi.intensity=day?.26:.34;scene.background.set(day?'#d7eaf5':'#19253b');
 field.traverse(o=>{if(o.material?.userData.nightEmission)applyNightEmission(o.material,day?0:1);});
 lights.update(day||!enabled?0:1,new THREE.Vector3());renderer.render(scene,camera);
 const pixels=new Uint8Array(1200*900*4),gl=renderer.getContext();gl.readPixels(0,0,1200,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const samples=[];
 for(const x of [-18,0,18])for(const z of [-48,-24,0,24,48]){
  const point=new THREE.Vector3(x,.15,z).project(camera),px=Math.round((point.x*.5+.5)*1200),py=Math.round((point.y*.5+.5)*900);
  let sum=0;for(let y=py-2;y<=py+2;y++)for(let x=px-2;x<=px+2;x++){const k=(y*1200+x)*4;sum+=pixels[k]*.2126+pixels[k+1]*.7152+pixels[k+2]*.0722;}samples.push(sum/25);
 }
 return {samples,shadersValid:renderer.info.programs.every(p=>p.diagnostics?.runnable!==false)};
};window.ready=true;
</script></body></html>`;
await withBrowser(root,async page=>{
 const errors=[];page.events.add(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 await page.go('/__stadium_lighting.html');await waitFor(()=>page.evaluate('window.ready===true'),'stadium lighting checks',45000);
 const report={};
 for(const [name,day,enabled] of [['day',true,true],['night-unlit',false,false],['night',false,true]]){
  report[name]=await page.evaluate('window.pose('+day+','+enabled+')');
  const shot=await page.send('Page.captureScreenshot',{format:'png'});await writeFile(output+'/'+name+'.png',Buffer.from(shot.data,'base64'));
 }
 assert.ok(report.night.samples.every((value,i)=>value>report['night-unlit'].samples[i]*1.5),'floodlights must illuminate entire field, including end zones and sidelines');
 assert.ok(Object.values(report).every(s=>s.shadersValid),'shaders compile');assert.deepEqual(errors,[]);
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));
 console.log('PASS stadium lights: day/night, field coverage, terrain, serialized/coarse aim, hidden/evicted sectors',report);
},{width:1200,height:900,route:async(req,res)=>{
 if(req.url!=='/__stadium_lighting.html')return false;res.setHeader('Content-Type','text/html');res.end(html);return true;
}});
