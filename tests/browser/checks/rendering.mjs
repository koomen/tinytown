import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

export async function checkRendering(p, waitFor, { free = false } = {}) {
  const label = free ? 'orbit camera' : 'iso camera';
  await p.evaluate(`(() => {
    const w = window.__town, original = w.composer.render;
    window.__renderProbe = {count: 0, firstTime: null};
    w.composer.render = function (...args) {
      const p = window.__renderProbe;
      p.count++;
      p.firstTime ??= w.vignette.uniforms.time.value;
      return original.apply(this, args);
    };
  })()`);
  const sleeping = () => waitFor(() => p.evaluate('window.__town.renderLoop.sleeping'), `${label} sleeps`, 20000);
  const snapshot = () => p.evaluate(`(() => {
    const w = window.__town;
    return {count: window.__renderProbe.count, time: w.vignette.uniforms.time.value,
      smoke: w.street.smokes[0].puffs[0].t, position: w.camera.position.toArray()};
  })()`);
  async function wakeWith(action, reason) {
    await sleeping();
    const before = await snapshot();
    await p.evaluate('window.__renderProbe.firstTime = null');
    await action();
    await waitFor(() => p.evaluate(`window.__renderProbe.count > ${before.count}`), `${label} wakes for ${reason}`, 10000);
    const firstTime = await p.evaluate('window.__renderProbe.firstTime');
    assert.equal(firstTime, before.time, 'animation must resume from its paused time');
    return before;
  }

  await sleeping();
  const paused = await snapshot();
  await delay(500);
  assert.deepEqual(await snapshot(), paused, 'idle view must draw no frames and freeze smoke/grain');
  console.log(`PASS ${label} stops rendering and freezes animation when idle`);

  const beforeWheel = await wakeWith(() => p.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel', x: 150, y: 250, deltaX: 0, deltaY: -100,
  }), 'wheel input');
  await waitFor(async () => JSON.stringify((await snapshot()).position) !== JSON.stringify(beforeWheel.position), 'wheel moves camera');
  console.log(`PASS ${label} wakes for scrolling without an animation jump`);
  if (free) return;

  const beforeKeys = await wakeWith(() => p.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39,
  }), 'arrow keys');
  await waitFor(async () => JSON.stringify((await snapshot()).position) !== JSON.stringify(beforeKeys.position), 'arrow key moves camera');
  await p.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39});

  const beforeDrag = await wakeWith(async () => {
    await p.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: 120, y: 250, button: 'left', buttons: 1, clickCount: 1});
    await p.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: 170, y: 280, buttons: 1});
    await p.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 170, y: 280, button: 'left', clickCount: 1});
  }, 'dragging');
  assert.notDeepEqual((await snapshot()).position, beforeDrag.position);

  await p.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 2});
  const beforeTouch = await wakeWith(async () => {
    await p.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 100, y: 250, id: 0}, {x: 200, y: 250, id: 1}]});
    await p.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 80, y: 240, id: 0}, {x: 220, y: 260, id: 1}]});
    await p.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }, 'pinch/twist');
  assert.notDeepEqual((await snapshot()).position, beforeTouch.position);
  await p.send('Emulation.setTouchEmulationEnabled', {enabled: false});
  console.log('PASS arrow keys, dragging, and touch gestures wake the idle viewer');

  await wakeWith(() => p.send('Emulation.setDeviceMetricsOverride', {
    width: 340, height: 900, deviceScaleFactor: 1, mobile: false,
  }), 'resize');
  assert.equal(await p.evaluate('window.__town.renderer.domElement.width'), 340);
  await wakeWith(() => p.evaluate('window.__town.lookAtBuilding(248274499)'), 'programmatic camera changes');
  console.log('PASS resizing and programmatic camera changes redraw the idle viewer');

  // Exercise the visibility handler even in headless Chrome, where switching
  // targets does not consistently background the previous page.
  await p.evaluate(`Object.defineProperty(document, 'hidden', {configurable: true, value: true});
    document.dispatchEvent(new Event('visibilitychange'));`);
  assert.equal(await p.evaluate('window.__town.renderLoop.sleeping'), true);
  const hidden = await snapshot();
  await p.evaluate('window.__town.renderLoop.wake()');
  await delay(300);
  assert.deepEqual(await snapshot(), hidden);
  await p.evaluate(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));`);
  await waitFor(() => p.evaluate(`window.__renderProbe.count > ${hidden.count}`), 'tab becomes visible');
  console.log('PASS hidden tabs stop rendering and visible tabs resume');
}
