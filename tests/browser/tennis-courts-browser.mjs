import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const importmap=(await readFile(root+'index.html','utf8')).match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const output=root+'runs/tennis-courts';await mkdir(output,{recursive:true});
const html=`<!doctype html><html><head>${importmap}<style>body{margin:0}</style></head><body><script type="module">
import * as THREE from 'three';
import {buildLandmarks} from '/src/landmarks.js';
import {buildTennisCourt} from '/src/tennis-court.js';
import {shiftLandmark} from '/src/landmark-frame.js';
import {coarseModel} from '/tinytown/web/stream-export.js';
import {bakeMobile} from '/src/bake.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const site=await fetch('/data/avon-extended/site.json').then(r=>r.json());
const original=site.landmarks.find(f=>f.id===140641607);
check(original.tennis.courts===5,'five authored courts replace original pad');
const center=original.pts.reduce((a,p)=>a.map((v,i)=>v+p[i]/4),[0,0]);
const feature=shiftLandmark(original,...center);
const grade=(x,z)=>.012*x+.006*z;
const group=buildLandmarks([feature],{grade});
const model=group.children[0];model.updateMatrixWorld(true);
const named=(root,name)=>{const out=[];root.traverse(o=>{if(o.name===name)out.push(o);});return out;};
// The last paved section contains two basketball courts, not a sixth tennis
// court. Check the full installation, including its shared tennis divider.
const basketballIds=[140641609,'avon-school-basketball-south','avon-school-basketball-fence'];
const basketballFeatures=basketballIds.map(id=>{
 const matches=site.landmarks.filter(f=>f.id===id);
 check(matches.length===1,'basketball pad replaces the original exactly once');
 return shiftLandmark(matches[0],...center);
});
const basketball=buildLandmarks(basketballFeatures,{grade});basketball.updateMatrixWorld(true);
check(named(basketball,'basketball-court').length===2,'two adjacent compact basketball courts');
check(named(basketball,'hoop-rim').length===4,'four basketball hoops');
check(named(basketball,'basketball-boundary').length===2 && named(basketball,'basketball-key').length===4,'both basketball courts marked');
const [north,south,enclosure]=basketballFeatures;
check(JSON.stringify(north.pts.slice(2))===JSON.stringify([south.pts[1],south.pts[0]]),'basketball pads meet without a gap');
check(JSON.stringify(enclosure.pts[0])===JSON.stringify(feature.pts[1]) && JSON.stringify(enclosure.pts.at(-1))===JSON.stringify(feature.pts[2]),'outer fence meets the existing tennis divider');
check(enclosure.pts.length===4 && !enclosure.closed,'three outer fence sides avoid a duplicate divider');
for(const court of named(basketball,'basketball-court')) {
 const {center:[cx,cz],halfWidth,halfLength}=court.userData.court;
 check(halfWidth>7 && halfWidth<8 && halfLength>7 && halfLength<9,'compact court dimensions match the aerial');
 for(const rim of named(court,'hoop-rim')) {
  const hoop=rim.parent,post=hoop.getWorldPosition(new THREE.Vector3());
  const toward=new THREE.Vector3(0,0,1).transformDirection(hoop.matrixWorld);
  check(toward.dot(new THREE.Vector3(cx-post.x,0,cz-post.z).normalize())>.999,'basketball hoops face inward');
 }
}
const gate=enclosure.openings[0];
for(const panel of named(basketball,'perimeter-panel')) {
 const p=panel.geometry.attributes.position;
 const ax=p.getX(0),az=p.getZ(0),dx=p.getX(1)-ax,dz=p.getZ(1)-az;
 const t=Math.max(0,Math.min(1,((gate.point[0]-ax)*dx+(gate.point[1]-az)*dz)/(dx*dx+dz*dz)));
 check(Math.hypot(ax+dx*t-gate.point[0],az+dz*t-gate.point[1])>=gate.width/2-.002,'basketball entrance stays open');
}
const basketballFar=new THREE.Group();
for(const child of basketball.children)basketballFar.add(coarseModel(child));
check(named(basketballFar,'hoop-rim').length===4 && named(basketballFar,'basketball-boundary').length===2 && named(basketballFar,'perimeter-panel').length>20,'basketball markings, hoops and fence survive distant geometry');
const basketballBaked=await bakeMobile(basketballFar);
check(basketballBaked.children.length>0,'basketball installation serializes through bake');
group.add(basketball);
check(named(model,'tennis-net').length===5,'five nets');
check(named(model,'tennis-net-post').length===10,'ten net posts');
check(named(model,'tennis-fence').length===1,'one shared enclosure');
check(named(model,'landmark-ribbon').length===40,'complete singles, doubles, service and center markings');
model.traverse(o=>{if(o.geometry)check(o.geometry.attributes.position.array.every(Number.isFinite),'finite geometry');});
for(const net of named(model,'tennis-net')) {
 const p=net.geometry.attributes.position;
 const a=new THREE.Vector3().fromBufferAttribute(p,0),b=new THREE.Vector3().fromBufferAttribute(p,p.count-2);
 check(Math.abs(Math.hypot(a.x-b.x,a.z-b.z)-12.8)<.001,'regulation net span');
 check(Math.abs(p.getY(25)-grade(p.getX(25),p.getZ(25))-.12-.914)<.001,'sagging net center follows terrain');
}
const opening=feature.openings[0];
for(const panel of named(model,'perimeter-panel')) {
 const p=panel.geometry.attributes.position;
 const a=[p.getX(0),p.getZ(0)],b=[p.getX(1),p.getZ(1)],dx=b[0]-a[0],dz=b[1]-a[1];
 const t=Math.max(0,Math.min(1,((opening.point[0]-a[0])*dx+(opening.point[1]-a[1])*dz)/(dx*dx+dz*dz)));
 check(Math.hypot(a[0]+dx*t-opening.point[0],a[1]+dz*t-opening.point[1])>=opening.width/2-.002,'entrance stays open');
}
const far=coarseModel(model);
check(named(far,'tennis-net').length===5 && named(far,'perimeter-panel').length>50,'nets and fence survive distant geometry');
const baked=await bakeMobile(far);
check(baked.children.length>0,'coarse court serializes through bake');
// Existing chamfered Chautauqua courts retain their low sides and high ends.
const old=buildTennisCourt({id:'legacy',pts:[[-7,-17],[7,-17],[8,-16],[8,16],[7,17],[-7,17],[-8,16],[-8,-16]],tennis:{axis:'north-south',gateSide:'east'}},grade);
check(named(old,'tennis-net').length===1 && named(old,'tennis-fence').length===5,'legacy tennis geometry');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,900);renderer.setPixelRatio(1);document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce6ec');scene.add(group);
scene.add(new THREE.HemisphereLight(0xffffff,0x6b7559,2));const sun=new THREE.DirectionalLight(0xffefd9,3);sun.position.set(-50,100,50);scene.add(sun);
const camera=new THREE.PerspectiveCamera(35,1400/900,.1,1000);camera.position.set(35,80,100);camera.lookAt(0,0,0);renderer.render(scene,camera);
check(renderer.info.programs.every(p=>p.diagnostics?.runnable!==false),'shaders compile');window.ready=true;
</script></body></html>`;
await withBrowser(root,async page=>{
 const errors=[];page.events.add(e=>{if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails);});
 await page.go('/__tennis-courts.html');await waitFor(()=>page.evaluate('window.ready===true'),'tennis court checks',45000);
 const shot=await page.send('Page.captureScreenshot',{format:'png'});await writeFile(output+'/courts.png',Buffer.from(shot.data,'base64'));
 assert.deepEqual(errors,[]);console.log('PASS five tennis courts, two basketball courts, four hoops, fences, open entrances, terrain, coarse bake and legacy courts');
},{width:1400,height:900,route:async(req,res)=>{if(req.url!=='/__tennis-courts.html')return false;res.setHeader('Content-Type','text/html');res.end(html);return true;}});
