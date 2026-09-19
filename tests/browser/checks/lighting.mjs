import assert from 'node:assert/strict';

// Exercise the rendered result as well as the controls: a CSS-only dark theme
// or a switch that fails to wake an idle renderer must not pass this check.
export async function checkLighting(page, waitFor, { mobile = false } = {}) {
  const coverage = await page.evaluate(`(() => {
    const {street,siteData} = window.__town;
    const roads = siteData.roads.filter(r=>r.name && !['footway','path','steps','cycleway'].includes(r.class));
    // Rural stretches intentionally have sparse lighting; require full street
    // coverage in the village center, where the original compact scene lived.
    const center = siteData.townCenter || {x:0,z:0};
    const central = roads.filter(r=>r.pts.some(([x,z])=>Math.hypot(x-center.x,z-center.z)<400));
    const names = [...new Set(central.map(r=>r.name))];
    const near = (p,a,b,width) => {
      const dx=b[0]-a[0], dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz||1)));
      return Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz)<width/2+5;
    };
    return {total:street.lamps.length, missing:names.filter(name=>
      !roads.filter(r=>r.name===name).some(r=>street.lamps.some(lamp=>
        r.pts.slice(1).some((b,i)=>near(lamp,r.pts[i],b,r.width))))) };
  })()`);
  assert.deepEqual(coverage.missing, [], 'Every central named street needs streetlights, including residential streets');
  const snapshot = () => page.evaluate(`(() => {
    const w = window.__town, r = w.renderer;
    w.composer.render();
    const gl = r.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let luminance = 0;
    for (let i=0;i<pixels.length;i+=4) luminance += pixels[i]*0.2126+pixels[i+1]*0.7152+pixels[i+2]*0.0722;
    return {mode:w.lighting.mode, luminance:luminance/(pixels.length/4),
      camera:w.camera.position.toArray(), target:w.controls.target.toArray(),
      geometry:w.street.group.children.filter(o=>o.geometry).map(o=>o.geometry.uuid),
      lights:w.lighting.fixtures.lights.length, lightPower:w.lighting.fixtures.lights.reduce((n,l)=>n+l.intensity,0),
      pressed:document.getElementById('time-toggle').getAttribute('aria-pressed'),
      programsValid:w.renderer.info.programs.every(p=>p.diagnostics?.runnable!==false)};
  })()`);
  await page.evaluate("window.__town.lighting.setMode('day', {persist:false})");
  await waitFor(() => page.evaluate('window.__town.lighting.fixtures.lights.every(l=>l.intensity===0)'), 'day lighting settles');
  const day = await snapshot();
  assert.ok(day.luminance > 0, 'day must actually render');
  await waitFor(() => page.evaluate('window.__town.renderLoop.sleeping'), 'viewer sleeps before switching time');
  await page.evaluate('document.getElementById("time-toggle").click()');
  await waitFor(() => page.evaluate('window.__town.lighting.fixtures.lights.some(l=>l.intensity===42)'), 'night transition finishes after waking');
  const night = await snapshot();
  assert.equal(night.mode, 'night');
  assert.equal(night.pressed, 'true');
  assert.ok(night.programsValid, 'night shaders compile');
  assert.ok(night.luminance < day.luminance*0.8, `night must change scene pixels (${day.luminance} → ${night.luminance})`);
  assert.ok(night.lights > 0 && night.lights <= (mobile ? 3 : 6), 'bounded real lights on both profiles');
  assert.ok(night.lightPower > 0, 'streetlights illuminate their surroundings');
  assert.deepEqual(night.camera, day.camera, 'switching time must preserve the camera');
  assert.deepEqual(night.target, day.target);
  assert.deepEqual(night.geometry, day.geometry, 'switching time must preserve geometry');
  assert.equal(await page.evaluate('localStorage.getItem("town-time")'), 'night');
  assert.equal(await page.evaluate('new URL(location.href).searchParams.get("time")'), 'night');
  await page.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await page.evaluate('document.getElementById("time-toggle").click()');
  await waitFor(() => page.evaluate('window.__town.lighting.fixtures.lights.every(l=>l.intensity===0)'), 'reduced-motion day switch');
  const restored = await snapshot();
  assert.ok(Math.abs(restored.luminance-day.luminance) < 2, 'switching back restores daylight');
  assert.equal(restored.pressed, 'false');
  await page.send('Emulation.setEmulatedMedia', {features:[]});
  console.log(`PASS ${mobile ? 'mobile' : 'desktop'} day/night pixels, ${coverage.total} lamps covering every named street, idle wake, camera preservation and reduced motion`);
}
