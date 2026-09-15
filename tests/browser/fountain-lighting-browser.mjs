import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const importmap=(await readFile(root+'index.html','utf8')).match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const output=root+'runs/bestor-fish-lighting';await mkdir(output,{recursive:true});
const html=`<!doctype html><html><head>${importmap}<meta name="theme-color" content="#fff"><style>body{margin:0}button{display:none}</style></head><body>
<button id="time-toggle"><span></span></button><script type="module">
import * as THREE from 'three';
import {buildFountain} from '/src/fountain.js';
import {createLighting,DAY} from '/src/lighting.js';
import {checkFountain,checkFountainLighting} from '/tests/browser/checks/fountain.js';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1200,900);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#19253b');scene.fog=new THREE.Fog('#19253b',50,300);
const camera=new THREE.PerspectiveCamera(32,1200/900,.1,300);camera.position.set(14,10,18);camera.lookAt(0,1.5,0);
const sun=new THREE.DirectionalLight(),hemi=new THREE.HemisphereLight();sun.position.set(-20,40,30);scene.add(sun,hemi);
const skyUniforms=Object.fromEntries(['zenith','horizon','ground'].map(k=>[k,{value:new THREE.Color(DAY[k])}]));skyUniforms.nightAmount={value:0};
const vignette={uniforms:Object.fromEntries(['saturation','contrast','lift','warmth','strength'].map(k=>[k,{value:0}]))};
const lighting=createLighting({scene,renderer,sun,hemi,skyUniforms,environments:{day:null,night:null},vignette,bloom:null,quality:{memoryOptimized:true},wake:()=>{}});
const model=buildFountain({w:11,d:11},{height:4.9,pylonWidth:1.5});scene.add(model);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#9cac7b',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.2;scene.add(ground);
lighting.refreshMaterials({group:model});
window.pose=(time,enabled=true)=>{
 lighting.setMode(time,{persist:false});lighting.update(2,camera,new THREE.Vector3());
 scene.traverse(o=>{if(o.isSpotLight&&!enabled)o.intensity=0;});renderer.render(scene,camera);
 const pixels=new Uint8Array(1200*900*4),gl=renderer.getContext();gl.readPixels(0,0,1200,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const point=new THREE.Vector3(0,2.8,0).project(camera),cx=Math.round((point.x*.5+.5)*1200),cy=Math.round((point.y*.5+.5)*900);
 const sums=[0,0,0];let count=0;
 for(let y=cy-75;y<cy+75;y++)for(let x=cx-24;x<cx+24;x++){for(let c=0;c<3;c++)sums[c]+=pixels[(y*1200+x)*4+c];count++;}
 return {rgb:sums.map(s=>s/count),luminance:(sums[0]*.2126+sums[1]*.7152+sums[2]*.0722)/count,
   shadersValid:renderer.info.programs.every(p=>p.diagnostics?.runnable!==false)};
};
window.checks={geometry:checkFountain(),lighting:await checkFountainLighting()};window.ready=true;
</script></body></html>`;
await withBrowser(root,async page=>{
 const errors=[];page.events.add(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 await page.go('/__fountain_lighting.html');await waitFor(()=>page.evaluate('window.ready===true'),'fountain lighting checks');
 console.log('PASS fountain geometry, baked/serialized fixture aims, night/day, sector visibility and eviction',await page.evaluate('window.checks.lighting'));
 const report={};
 for(const [name,time,enabled] of [['day','day',true],['night-unlit','night',false],['night','night',true]]) {
   report[name]=await page.evaluate('window.pose('+JSON.stringify(time)+','+enabled+')');
   const shot=await page.send('Page.captureScreenshot',{format:'png'});await writeFile(output+'/'+name+'.png',Buffer.from(shot.data,'base64'));
 }
 assert.ok(report.night.luminance>report['night-unlit'].luminance*1.7,'uplights must visibly illuminate the pillar');
 assert.ok(report.night.rgb[0]>report.night.rgb[2],'pillar light must be warm');
 assert.ok(Object.values(report).every(s=>s.shadersValid),'day and night shaders must compile');assert.deepEqual(errors,[]);
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log('PASS rendered pillar illumination',report);
},{width:1200,height:900,route:async(req,res)=>{
 if(req.url!=='/__fountain_lighting.html')return false;res.setHeader('Content-Type','text/html');res.end(html);return true;
}});
