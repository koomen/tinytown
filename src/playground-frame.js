// A swing A-frame leg joins the beam exactly, with its foot on the local pad.
export function swingLegPose(side, ground = .1, beam = 2.65, spread = 1.2) {
  const rise=beam-ground;
  return {length:Math.hypot(rise,spread),y:(beam+ground)/2,z:side*spread/2,
    rotationX:-side*Math.atan2(spread,rise)};
}
