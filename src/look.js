// The painted-toy look, layered over every lit material at compile time.
// Runtime only: it reads albedo, world normal and world position, so baked
// geometry and vertex colours never change when the look is tuned.
//
//   - shade is sky-coloured: indirect light is pulled toward a soft lavender,
//     so a lawn in shadow turns cool instead of a deeper, louder green
//   - greens live: broad meadow drifts (warm and sun-bleached here, cool and
//     deep there) and crowns that warm toward the sky and cool underneath
//   - no dead blacks: near-black albedo (asphalt shingles, trim) rises to slate
//   - grey paving gets a faint patina instead of flat vector fill
//   - water leans teal, and instanced crowns breathe in a light wind while
//     the view is awake (the render loop still sleeps when nothing moves)
//
// All live-tunable from the console: window.__town.look.<name>.value
import { NIGHT } from './lighting.js';

export const LOOK = {
  shadeCool: { value: 0.85 },     // 0 = physically neutral indirect light
  shadeTint: { value: [0.86, 0.95, 1.18] },
  meadow: { value: 1 },           // strength of the green treatments
  darkLift: { value: 0.08 },     // albedo floor for near-black surfaces
  patina: { value: 1 },           // grey paving mottling
  wind: { value: 1 },             // crown sway amplitude (0 = still)
  time: { value: 0 },             // seconds; advanced by the viewer's render loop
};

const CHUNK = /* glsl */ `
uniform float lookShadeCool, lookMeadow, lookDarkLift, lookPatina, lookNight;
uniform vec3 lookShadeTint;
float lookHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lookNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lookHash(i), lookHash(i + vec2(1, 0)), f.x),
             mix(lookHash(i + vec2(0, 1)), lookHash(i + vec2(1, 1)), f.x), f.y);
}
`;

const ALBEDO = /* glsl */ `
{
  // World-space position and normal from the view-space values every lit
  // material already carries; no extra varyings, so any material can take it.
  vec3 lookPos = cameraPosition + (vec4(-vViewPosition, 0.0) * viewMatrix).xyz;
  vec3 lookN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 c = diffuseColor.rgb;
  float hi = max(c.r, max(c.g, c.b)), lo = min(c.r, min(c.g, c.b));
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec2 p = lookPos.xz;
  float footprint = max(length(dFdx(p)), length(dFdy(p)));
  // Greens: albedo whose green channel leads both others.
  float green = smoothstep(0.004, 0.03, c.g - max(c.r, c.b)) * lookMeadow;
  if (green > 0.0) {
    float drift = lookNoise(p * 0.021 + vec2(31.0, 7.0)) * 0.45 + lookNoise(p * 0.07 + vec2(3.0, 11.0)) * 0.33
      + lookNoise(p * 0.23 + vec2(19.0, 2.0)) * 0.22;
    float up = clamp(lookN.y, -1.0, 1.0);
    // warm, sun-bleached drifts and cool, deep hollows
    vec3 warm = c * vec3(1.13, 1.08, 0.82);
    vec3 cool = c * vec3(0.84, 0.95, 1.06);
    vec3 g = mix(cool, warm, smoothstep(0.22, 0.78, drift));
    // mown and unmown: a lighter and darker patchwork a few metres across
    g *= 0.9 + 0.2 * lookNoise(p * 0.11 + vec2(drift * 2.0, 41.0));
    // crowns and slopes: warmer toward the sky, cooler underneath
    g *= mix(vec3(0.88, 0.95, 1.06), vec3(1.06, 1.04, 0.93), up * 0.5 + 0.5);
    // fine clumping where the ground is close enough to read it
    float clump = lookNoise(p * 1.9 + vec2(up * 3.0));
    g *= 1.0 + (clump - 0.5) * 0.10 * (1.0 - smoothstep(0.05, 0.5, footprint)) * step(0.6, up);
    // a little more colour than the baked lawn: fresh, not olive
    g = max(mix(vec3(dot(g, vec3(0.2126, 0.7152, 0.0722))), g, 1.05), 0.0);
    c = mix(c, g, green);
  }
  // Grey paving and flat roofs: broad patches, nudged neutral so warm asphalt
  // does not turn mauve under the honeyed sun.
  float grey = (1.0 - smoothstep(0.03, 0.09, hi - lo)) * smoothstep(0.7, 0.95, lookN.y) * lookPatina;
  if (grey > 0.0) {
    float blot = lookNoise(p * 0.09 + vec2(5.0, 17.0)) * 0.6 + lookNoise(p * 0.45) * 0.4;
    c = mix(c, c * vec3(0.97, 1.0, 1.045) * (0.96 + 0.14 * blot), grey);
  }
  // No dead blacks in a toy: lift the darkest albedo toward a soft slate.
  c += vec3(0.85, 0.92, 1.08) * lookDarkLift * (1.0 - smoothstep(0.0, 0.2, luma));
  #ifdef LOOK_WATER
    // clear river teal rather than slate
    c = mix(c, c * vec3(0.86, 1.14, 1.12) + vec3(0.0, 0.012, 0.014), 0.8);
  #endif
  diffuseColor.rgb = c;
}
`;

const SHADE = /* glsl */ `
{
  // Part desaturate, then tint: shade keeps its hue family but drifts teal
  // and lavender, the way skylight colours a painted toy.
  vec3 id = reflectedLight.indirectDiffuse;
  vec3 cooled = mix(id, vec3(dot(id, vec3(0.2126, 0.7152, 0.0722))), 0.3) * lookShadeTint;
  reflectedLight.indirectDiffuse = mix(id, cooled, lookShadeCool * (1.0 - lookNight));
}
`;

// Instanced, vertex-coloured meshes are the trees, bushes and tufts. Sway
// grows with height above the instance base, so trunks stay planted and a
// crown drifts a few centimetres; each instance keeps its own phase.
const SWAY = /* glsl */ `
#if defined(USE_INSTANCING) && defined(USE_COLOR)
{
  float rise = smoothstep(0.6, 4.5, transformed.y);
  vec2 root = instanceMatrix[3].xz;
  float phase = dot(root, vec2(0.37, 0.23));
  float gust = 0.6 + 0.4 * sin(lookTime * 0.35 + root.x * 0.013 + root.y * 0.009);
  vec2 lean = vec2(sin(lookTime * 1.25 + phase), cos(lookTime * 0.95 + phase * 1.3)) * vec2(0.075, 0.05);
  transformed.xz += lean * gust * rise * rise * lookWind;
}
#endif
`;

function patch(shader, water) {
  if (!shader.fragmentShader.includes('#include <lights_physical_fragment>')) return;
  Object.assign(shader.uniforms, {
    lookShadeCool: LOOK.shadeCool, lookShadeTint: LOOK.shadeTint, lookMeadow: LOOK.meadow,
    lookDarkLift: LOOK.darkLift, lookPatina: LOOK.patina, lookNight: NIGHT,
    lookWind: LOOK.wind, lookTime: LOOK.time,
  });
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float lookWind, lookTime;')
    .replace('#include <project_vertex>', `${SWAY}\n#include <project_vertex>`);
  shader.fragmentShader = (water ? '#define LOOK_WATER\n' : '') + shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${CHUNK}`)
    .replace('#include <lights_physical_fragment>', `${ALBEDO}\n#include <lights_physical_fragment>`)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${SHADE}`);
}

// Chain onto whatever the material already does at compile time (surface
// treatments, grain). Idempotent; call before the material first renders.
export function withLook(material) {
  if (!material?.isMeshStandardMaterial || material.userData.look || material.userData.cornSprite) return material;
  material.userData.look = true;
  const before = material.onBeforeCompile, key = material.customProgramCacheKey;
  const water = material.userData.surface === 'water';
  material.onBeforeCompile = (shader, renderer) => { before.call(material, shader, renderer); patch(shader, water); };
  material.customProgramCacheKey = () => key.call(material) + '|look';
  material.needsUpdate = true;
  return material;
}

export function applyLook(root) {
  root.traverse(o => {
    for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) withLook(m);
  });
}
