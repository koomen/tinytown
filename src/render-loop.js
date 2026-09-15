// Cap GPU work while awake, then stop requesting frames entirely when idle.
// Animation time advances only for rendered frames, never across a pause.
export function createRenderLoop(render, {
  now = () => performance.now(),
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
} = {}) {
  const ACTIVE_INTERVAL = 1000 / 60, IDLE_INTERVAL = 1000 / 30;
  const ACTIVE_MS = 250, SLEEP_MS = 5000;
  let visible = true, running = false, frame = null;
  let lastActivity = 0, lastSlot = null, lastRender = null;

  function tick(time) {
    frame = null;
    if (time - lastActivity >= SLEEP_MS) {
      running = false;
      return;
    }
    const interval = time - lastActivity < ACTIVE_MS ? ACTIVE_INTERVAL : IDLE_INTERVAL;
    // Keep the cadence aligned across display refreshes (including 120 Hz).
    // Half a millisecond of tolerance absorbs timestamp rounding at 60 Hz.
    if (lastSlot === null || time - lastSlot >= interval - 0.5) {
      lastSlot = lastSlot === null ? time
        : lastSlot + Math.floor((time - lastSlot + 0.5) / interval) * interval;
      const dt = lastRender === null ? 0 : Math.min((time - lastRender) / 1000, 0.05);
      lastRender = time;
      render(dt);
    }
    if (running) frame = requestFrame(tick);
  }

  function wake() {
    lastActivity = now();
    if (!visible || running) return;
    running = true;
    lastSlot = lastRender = null;
    frame = requestFrame(tick);
  }

  function setVisible(value) {
    visible = value;
    if (visible) wake();
    else {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      running = false;
    }
  }

  return { wake, setVisible, get sleeping() { return !running; } };
}
