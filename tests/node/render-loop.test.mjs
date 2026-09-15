import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderLoop } from '../../src/render-loop.js';

function display(hz, onRender = () => {}) {
  let time = 0, id = 0;
  const pending = new Map(), frames = [];
  const loop = createRenderLoop(dt => { frames.push({time, dt}); onRender(loop); }, {
    now: () => time,
    requestFrame: cb => { pending.set(++id, cb); return id; },
    cancelFrame: id => pending.delete(id),
  });
  function advance(ms, interact = false) {
    const count = Math.round(ms * hz / 1000);
    for (let i = 0; i < count; i++) {
      time += 1000 / hz;
      if (interact) loop.wake();
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach(cb => cb(time));
      assert.ok(pending.size <= 1, 'never queue duplicate frames');
    }
  }
  return {loop, frames, advance, pending};
}

for (const hz of [60, 120, 144]) {
  test(`caps active rendering at 60 fps and idle rendering at 30 fps on a ${hz} Hz display`, () => {
    const d = display(hz);
    d.advance(2000, true);
    assert.ok(d.frames.length >= 119 && d.frames.length <= 121, `${d.frames.length} active frames`);
    d.advance(500); // let the last input's active period expire
    const start = d.frames.length;
    d.advance(2000);
    assert.ok(d.frames.length - start >= 59 && d.frames.length - start <= 61, `${d.frames.length - start} idle frames`);
  });
}

test('idle rendering stops scheduling work and wakes without advancing across the pause', () => {
  const d = display(120);
  d.loop.wake();
  d.advance(5100);
  assert.equal(d.loop.sleeping, true);
  assert.equal(d.pending.size, 0);
  const count = d.frames.length;
  d.advance(20000);
  assert.equal(d.frames.length, count);
  d.loop.wake();
  d.advance(100);
  assert.equal(d.frames[count].dt, 0);
  assert.equal(d.loop.sleeping, false);
});

test('hidden pages cancel pending frames and ignore input until visible again', () => {
  const d = display(60);
  d.loop.wake();
  d.advance(1000);
  d.loop.setVisible(false);
  assert.equal(d.pending.size, 0);
  const count = d.frames.length;
  d.advance(10000, true);
  assert.equal(d.frames.length, count);
  d.loop.setVisible(true);
  d.advance(100);
  assert.equal(d.frames[count].dt, 0);
});

test('camera changes during rendering keep it active without duplicate requests', () => {
  const d = display(120, loop => loop.wake());
  d.loop.wake();
  d.advance(10000);
  assert.equal(d.loop.sleeping, false);
  assert.ok(d.frames.length >= 599 && d.frames.length <= 601);
});
