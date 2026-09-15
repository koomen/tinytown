// A perspective depth buffer loses precision with the square of the distance.
// Keep roughly 2 mm of depth resolution at the orbit target instead of capping
// the near plane at 8 m: that cap lets distant roof caps and grass win the depth
// test against the surfaces a few centimetres above them.
const DEPTH_LEVELS = 2 ** 24;
const TARGET_DEPTH_STEP = 0.002;

export function viewNearPlane(distance, fixedElevation = true) {
  const nearby = Math.max(0.5, Math.min(8, distance / 120));
  // The free authoring camera may sit beside geometry while looking far away.
  // Only the elevated diorama camera guarantees foreground clearance on zoom.
  if (!fixedElevation) return nearby;
  const precise = distance * distance / (DEPTH_LEVELS * TARGET_DEPTH_STEP);
  return Math.max(nearby, Math.min(distance / 4, precise));
}
