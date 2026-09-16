// Dense miniature startup must load only the visible landscape, with complete
// coverage as visitors pan, zoom out, or open a landmark link.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

const root=new URL('../../',import.meta.url).pathname;
const manifest=JSON.parse(await readFile(root+'data/chautauqua/stream/manifest.json'));
const scene=JSON.parse(await readFile(root+'data/chautauqua/site.json'));
const MiB=1024*1024;
assert.ok(manifest.regions?.length>0,'dense miniatures must split their coarse landscape');
assert.ok(manifest.base.bytes<8*MiB,'shared base must stay small');
const sectors=manifest.regions.flatMap(r=>r.sectors);
assert.deepEqual([...sectors].sort(),manifest.tiles.map(t=>t.id).sort(),'each sector belongs to exactly one region');
await mkdir(root+'runs/chautauqua-load-speed',{recursive:true});

for(const mobile of [false,true]) {
  const requests=[],errors=[];
  await withBrowser(root,async page=>{
    if(mobile) await page.send('Emulation.setDeviceMetricsOverride',{
      width:390,height:844,screenWidth:390,screenHeight:844,deviceScaleFactor:1,mobile:true,
    });
    page.events.add(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
    const stats=()=>page.evaluate('__town.streaming.stats');
    const ready=()=>waitFor(()=>page.evaluate(`!!window.__town && !document.getElementById('loading')
      && !__town.streaming.stats.loading
      && __town.streaming.stats.desiredRegions.every(id=>__town.streaming.stats.loadedRegions.includes(id))
      && __town.streaming.stats.desired.every(id=>__town.streaming.stats.resident.includes(id))`),'complete visible scenery');
    const covered=()=>page.evaluate(`(()=>{
      const s=__town.streaming.stats,c=__town.street.group.getObjectByName('stream-coarse');
      return s.visibleSectors.every(id=>{
        const group=c.getObjectByName(id);
        return group && group.visible===!s.resident.includes(id);
      });
    })()`);
    const check=async()=>{
      assert.ok(await covered(),'visible sectors retain terrain and building silhouettes');
      const s=await stats();
      assert.deepEqual(s.failures,[]);
      assert.ok(s.residentBytes<=s.budgetBytes);
      assert.ok(s.cacheBytes<=s.cacheBudgetBytes);
      assert.equal(await page.evaluate('__town.renderer.getContext().isContextLost()'),false);
      return s;
    };
    await page.go('/chautauqua');await ready();
    const opening=await check();
    assert.equal(await page.evaluate('__town.siteData.buildings.length'),scene.buildings.length);
    assert.ok(opening.loadedRegions.length<manifest.regions.length/2,'opening does not fetch most of the grounds');
    const startupBytes=manifest.base.bytes+manifest.regions.filter(r=>opening.loadedRegions.includes(r.id)).reduce((n,r)=>n+r.bytes,0);
    assert.ok(startupBytes<16*MiB,'opening stays well below the old 28.5 MiB base');
    assert.ok(!requests.some(p=>/\/(site\.json|surfaces\.json|site\.js|blueprint\.js)$/.test(p)),
      'streaming does not fetch original scene data or generator modules');
    const shot=await page.send('Page.captureScreenshot',{format:'png'});
    await writeFile(root+`runs/chautauqua-load-speed/opening-${mobile?'mobile':'desktop'}.png`,Buffer.from(shot.data,'base64'));
    console.log('PASS Chautauqua opening',JSON.stringify({mobile,startupBytes,regions:opening.loadedRegions.length,totalRegions:manifest.regions.length}));

    for(const [x,z] of [[400,600],[-300,-400],[35,37]]) {
      await page.evaluate(`(()=>{
        const w=__town,target=w.controls.target.clone().set(${x},w.street.surfaces.grade(${x},${z})+6,${z});
        w.controls.set({target,theta:-2.2,distance:280});w.streaming.update(w.camera,target);w.renderLoop.wake();
      })()`);
      await ready();const s=await check();
      for(const id of opening.loadedRegions)assert.ok(s.loadedRegions.includes(id),'visited regions remain available');
    }
    await page.evaluate(`(()=>{
      const w=__town;w.frameCamera();
      w.controls.set({target:w.controls.target,theta:w.controls.theta,distance:w.camera.position.distanceTo(w.controls.target)*1.5});
      w.streaming.update(w.camera,w.controls.target);w.renderLoop.wake();
    })()`);await ready();
    const overview=await check();
    assert.equal(overview.loadedRegions.length,manifest.regions.length,'overview loads the whole miniature');
    assert.ok(overview.evictions>0,'panning releases detail outside the view');
    console.log('PASS Chautauqua exploration and full overview',JSON.stringify({mobile}));

    await page.go('/chautauqua?focus=619932539&dist=180&time=night');await ready();await check();
    assert.ok((await stats()).resident.includes('1_1'),'Amphitheater focus link loads its detail');
    if(mobile) {
      await page.evaluate("__town.lighting.setMode('day',{persist:false})");
      await waitFor(()=>page.evaluate('__town.lighting.fixtures.lights.every(l=>l.intensity===0)'),'day lighting');
      await waitFor(()=>page.evaluate('__town.renderLoop.sleeping'),'sleep before slow lighting frame');
      await page.evaluate(`(()=>{
        const w=__town,render=w.composer.render;
        w.composer.render=function(...args) {
          w.composer.render=render;
          const end=performance.now()+5500;
          while(performance.now()<end) {} // shader work longer than the idle window
          return render.apply(this,args);
        };
        w.lighting.setMode('night',{persist:false});
      })()`);
      await waitFor(()=>page.evaluate('__town.lighting.fixtures.lights.some(l=>l.intensity===42)'),
        'night transition survives slow compilation',30000);
      console.log('PASS slow shader work does not strand the day/night transition');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS Chautauqua landmark link at night',JSON.stringify({mobile}));
  },{width:1440,height:1000,route:async(req)=>{
    requests.push(new URL(req.url,'http://localhost').pathname);return false;
  }});
}
