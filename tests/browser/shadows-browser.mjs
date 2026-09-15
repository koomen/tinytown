// Real camera/frustum coverage and shadow-cache behavior on the regional scene.
import assert from 'node:assert/strict';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
await withBrowser(new URL('../../',import.meta.url).pathname,async p=>{
  await p.go('/?site=avon-extended&focus=248251389&dist=65&time=day');
  await waitFor(()=>p.evaluate('!!window.__town && !document.getElementById("loading")'),'regional viewer');
  const result=await p.evaluate(`(async()=>{
    const w=__town,T=await import('three');
    const frame=()=>new Promise(resolve=>{
      const draw=w.composer.render.bind(w.composer);
      w.composer.render=(...args)=>{draw(...args);w.composer.render=draw;resolve();};
      w.renderLoop.setVisible(true);w.renderLoop.wake();
    });
    const fullRadius=Math.max(w.street.size.w,w.street.size.d)*.62;
    const direction=w.sun.position.clone().sub(w.sun.target.position).normalize();
    const coverage=[];
    for(const [aspect,fov,distance] of [[1.5,26,65],[1.5,26,550],[.46,40,320],[3,26,550]]){
      w.camera.aspect=aspect;w.camera.fov=fov;w.camera.updateProjectionMatrix();
      w.controls.set({distance});await frame();
      const c=w.sun.shadow.camera,plane=new T.Plane(new T.Vector3(0,1,0),-w.controls.target.y);
      const rays=new T.Raycaster(),point=new T.Vector3();
      for(const x of [-1,1])for(const y of [-1,1]){
        rays.setFromCamera(new T.Vector2(x,y),w.camera);
        if(!rays.ray.intersectPlane(plane,point))throw new Error('View misses the ground');
        point.project(c);
        if(Math.max(Math.abs(point.x),Math.abs(point.y),Math.abs(point.z))>=1)
          throw new Error('Visible ground falls outside the shadow camera: '+JSON.stringify({aspect,fov,distance,point}));
      }
      if(w.sun.position.clone().sub(w.sun.target.position).normalize().distanceTo(direction)>1e-8)
        throw new Error('Refitting changed the sun direction');
      coverage.push({aspect,fov,distance,radius:c.right,bias:w.sun.shadow.normalBias});
    }
    w.controls.set({distance:65});await frame();
    const before=w.sun.target.position.clone();
    w.controls.pan(new T.Vector3(5,0,0));await frame();
    const cached=w.sun.target.position.equals(before);
    w.controls.pan(new T.Vector3(80,0,0));await frame();
    const followed=w.sun.target.position.distanceTo(before)>32;
    w.controls.set({distance:10000});await frame();
    const overview=w.sun.shadow.camera.right===fullRadius;
    return {coverage,cached,followed,overview};
  })()`);
  assert.ok(result.cached,'small pans reuse the shadow map');
  assert.ok(result.followed,'large pans refit shadow coverage');
  assert.ok(result.overview,'zooming out restores regional coverage');
  assert.ok(result.coverage[0].radius<250,'close views retain detailed shadows');
  assert.ok(result.coverage[0].bias<.5,'close views avoid large detached shadows');
  console.log('PASS regional shadow coverage, fixed sun direction, cached pans, and overview',result);
},{width:1200,height:800});
