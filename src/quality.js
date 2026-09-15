// Choose budgets before allocating the renderer or its offscreen buffers.
// Query overrides allow the phone profile to be inspected on a desktop.
export function renderQuality({ mobile = false, devicePixelRatio = 1, override, resolution } = {}) {
  const light = override === 'mobile' || (mobile && override !== 'desktop');
  let pixelRatio = Math.min(devicePixelRatio, 1.75);
  if (resolution === 'desktop') pixelRatio = Math.min(devicePixelRatio, 1.75);
  else if (resolution === 'mobile') pixelRatio = Math.min(devicePixelRatio, 1);
  else if (resolution != null && String(resolution).trim() !== '') {
    const requested = Number(resolution);
    if (Number.isFinite(requested) && requested > 0) pixelRatio = Math.max(0.25, Math.min(2, requested));
  }
  const pixelated = pixelRatio < 1;
  return Object.freeze({
    name: light ? 'mobile' : 'desktop',
    pixelRatio,
    pixelated,
    antialias: !light && !pixelated,
    postprocessing: !light,
    shadowSize: light ? 1024 : 4096,
    memoryOptimized: light,
  });
}
