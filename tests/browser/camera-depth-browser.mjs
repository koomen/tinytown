// Real streamed geometry: roof-cap stripes and grass breaking through pavement.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
const output=new URL('../../runs/model-edits-20260913/kraft-roof/',import.meta.url);
await mkdir(output,{recursive:true});
await withBrowser(new URL('../../',import.meta.url).pathname,async page=>{
  const errors=[];page.events.add(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
  await page.go('/?site=avon-extended&focus=248275311&side=15&dist=10000&quality=mobile&time=day');
  await waitFor(()=>page.evaluate('!!window.__town'),'extended scene',300000);
  await page.evaluate('__town.streaming.setDetailEnabled(false)');
  await waitFor(()=>page.evaluate('__town.renderLoop.sleeping'),'idle scene');
  await page.evaluate(`(async()=>{
    const t=__town,THREE=await import('three');t.renderLoop.setVisible(false);
    const d=t.camera.position.distanceTo(t.controls.target),scale=d/1500;
    t.camera.setViewOffset(1440*scale,900*scale,720*(scale-1),450*(scale-1),1440,900);
    const b=t.siteData.buildings.find(b=>b.id===248275311),o=b.obb,c=Math.cos(o.angle),s=Math.sin(o.angle);
    const roof=new Set(),parking=new Set(),ground=t.street.surfaces.grade;
    const add=(set,x,y,z)=>{
      const p=new THREE.Vector3(x,y,z).project(t.camera),px=Math.round((p.x+1)*720),py=Math.round((p.y+1)*450);
      if(px>0&&px<1440&&py>0&&py<900)set.add((py*1440+px)*4);
    };
    for(let u=53;u<=133;u+=.7)for(let v=-75;v<=57;v+=.7){
      if(u>78&&u<114&&v>-21&&v<20||u<72&&v<-36)continue;
      add(roof,o.cx+c*u-s*v,ground(o.cx,o.cz)+12.42,o.cz+s*u+c*v);
    }
    // Interior of the large parking area west of the factory.
    const a=[-846,941],b2=[-804,975],c2=[-704,862],d2=[-743,846];
    for(let i=.12;i<.88;i+=.01)for(let j=.12;j<.88;j+=.01){
      const x=(a[0]*(1-i)+b2[0]*i)*(1-j)+(d2[0]*(1-i)+c2[0]*i)*j;
      const z=(a[1]*(1-i)+b2[1]*i)*(1-j)+(d2[1]*(1-i)+c2[1]*i)*j;
      add(parking,x,ground(x,z)+.02,z);
    }
    window.depthProbe={d,near:t.camera.near,roof:[...roof],parking:[...parking],frames:{},
      capture(label,near){t.camera.near=near;t.camera.updateProjectionMatrix();t.composer.render();
        const gl=t.renderer.getContext(),pixels=new Uint8Array(1440*900*4);
        gl.readPixels(0,0,1440,900,gl.RGBA,gl.UNSIGNED_BYTE,pixels);this.frames[label]=pixels;},
      compare(label){const frame=this.frames[label],reference=this.frames.reference;
        const differences=indices=>indices.filter(i=>Math.max(...[0,1,2].map(c=>Math.abs(frame[i+c]-reference[i+c])))>25).length;
        return{roof:differences(this.roof),parking:differences(this.parking)};}
    };
  })()`);
  for(const [label,near] of [['before','8'],['precision-control','1'],['after','depthProbe.near'],['reference','depthProbe.d*.4']]){
    await page.evaluate(`depthProbe.capture('${label}',${near})`);
    if(label!=='reference'){
      const shot=await page.send('Page.captureScreenshot',{format:'png'});
      await writeFile(new URL(`regression-${label}.png`,output),Buffer.from(shot.data,'base64'));
    }
  }
  const report=await page.evaluate(`({distance:depthProbe.d,near:depthProbe.near,
    roofSamples:depthProbe.roof.length,parkingSamples:depthProbe.parking.length,
    before:depthProbe.compare('before'),control:depthProbe.compare('precision-control'),after:depthProbe.compare('after'),
    memory:{resident:__town.streaming.stats.residentBytes,budget:__town.streaming.stats.budgetBytes},
    failures:__town.streaming.stats.failures})`);
  console.log(JSON.stringify(report));
  await writeFile(new URL('regression.json',output),JSON.stringify(report,null,2)+'\n');
  assert.ok(report.before.parking>20,'old camera reproduces pavement breakup');
  assert.ok(report.control.roof>20,'reduced depth precision reproduces the roof stripes');
  assert.ok(report.after.roof<Math.max(5,report.control.roof*.05),'roof remains clean with adaptive near plane');
  assert.ok(report.after.parking<report.before.parking*.05,'pavement remains above the grass');
  assert.ok(report.memory.resident<=report.memory.budget);assert.deepEqual(report.failures,[]);
  assert.deepEqual(errors,[]);
  console.log('PASS distant streamed roof and pavement depth precision');
},{width:1440,height:900});
