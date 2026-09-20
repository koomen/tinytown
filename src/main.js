// Viewer: renderer, camera, lights, post-processing, controls, and the loading
// bar. Shows a real place (data/<site>/site.json).
//
// The look is built in layers: a soft gradient sky that also lights the scene
// (via PMREM), warm sunlight with defined VSM shadows, ambient occlusion
// (GTAO) for contact darkening in the corners, a gentle tilt-shift depth of
// field so the street reads as a miniature, a whisper of bloom on the lamps
// and windows, and a warm vignette on top.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { IsoControls } from './isocontrols.js';
import { createRenderLoop } from './render-loop.js';
import { viewNearPlane } from './camera-depth.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { takeSurfaceAsset } from './site-data.js';
import { loadingProgress } from './loading-progress.js';
import { P } from './palette.js';
import { GRAIN } from './kit.js';
import { params, siteName, siteRequest, streamEnabled, streamDirectory } from './site-data.js';
import { renderQuality } from './quality.js';
import { installContextRecovery } from './context-recovery.js';
import { createLighting, DAY, NIGHT_SCENE } from './lighting.js';

const T0 = performance.now(); // module start (after imports resolved)
const timing = { moduleStart: Math.round(T0) };
const container = document.getElementById('app');

const MOBILE = window.matchMedia('(hover: none) and (pointer: coarse)').matches || Math.min(screen.width, screen.height) < 500;
const quality = renderQuality({ mobile: MOBILE, devicePixelRatio: window.devicePixelRatio,
  override: params.get('quality'), resolution: params.get('resolution') });
const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: quality.memoryOptimized ? 'default' : 'high-performance' });
const pixelRatio = quality.pixelRatio;
if (MOBILE) { // the caption assumes a mouse and keyboard otherwise
  const how = document.querySelector('#place .how');
  if (how) how.innerHTML = '<b>drag</b> to pull the ground · <b>pinch</b> to zoom · <b>twist</b> to turn';
}
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
// Keep low-resolution samples crisp when the canvas is enlarged by CSS.
if (quality.pixelated) renderer.domElement.style.imageRendering = 'pixelated';
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
// Cache shadows between changes to geometry, lighting, or the covered region.
// Each frame renders the scene several times (main, GTAO normals, bokeh depth);
// those passes can all reuse the same shadow map.
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.5, 900);
camera.layers.enable(1); // lamplight and upright crop sprites use the color pass

// Fixed isometric-style view: the tilt never changes. Wheel zooms, horizontal
// scroll rotates around the point you're looking at, dragging pulls the
// camera over the ground (down = forward). ?free=1 swaps in a free
// orbit camera for debugging (shooting a render from a photo's viewpoint).
const FREE_CAMERA = params.has('free');
// Open on each town's gathering place, framed from the selected reference views.
// Both Avon maps share the same world origin and circle.
const AVON_OPENING_VIEW = { target: [-25, 25], lift: 3, azimuth: 2, distance: 320, aspect: 1752 / 1408 };
const OPENING_VIEW = !FREE_CAMERA && !params.has('focus') ? {
  'avon-extended': AVON_OPENING_VIEW,
  chautauqua: { target: [35, 37], lift: 6, azimuth: -2.2, distance: 280, aspect: 1440 / 1726 },
}[siteName] : null;
const VIEW_AZIMUTH = OPENING_VIEW?.azimuth ?? Math.PI / 4;
const VIEW_ELEVATION = THREE.MathUtils.degToRad(35.264);
let controls;
let renderLoop = null;
let graphicsLost = false;
if (FREE_CAMERA) {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.499;
  controls.minDistance = 10;
} else {
  controls = new IsoControls(camera, renderer.domElement, { azimuth: VIEW_AZIMUTH, elevation: VIEW_ELEVATION });
  controls.minDistance = 10;
}
// Controls emit changes while easing as well as during a drag. Wheel input
// must also wake IsoControls before its next update can move the camera.
const wakeRendering = () => { if (!graphicsLost) renderLoop?.wake(); };
for (const event of ['start', 'change', 'end']) controls.addEventListener(event, wakeRendering);
renderer.domElement.addEventListener('wheel', wakeRendering, { passive: true });

// --- Sky -----------------------------------------------------------------
// One gradient shader serves both the visible dome and the environment map.

const skyUniforms = {
  zenith: { value: new THREE.Color(P.skyZenith) },
  horizon: { value: new THREE.Color(P.skyHorizon) },
  ground: { value: new THREE.Color(P.skyGround) },
  sunDir: { value: new THREE.Vector3(0.6, 0.5, 0.3).normalize() },
  nightAmount: { value: 0 },
};
const skyShader = {
  uniforms: skyUniforms,
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 zenith, horizon, ground, sunDir;
    uniform float nightAmount;
    varying vec3 vDir;
    void main() {
      float y = vDir.y;
      vec3 c;
      if (y >= 0.0) {
        float t = pow(clamp(y, 0.0, 1.0), 0.4);
        c = mix(horizon, zenith, t);
      } else {
        float t = pow(clamp(-y, 0.0, 1.0), 0.6);
        c = mix(horizon, ground, t);
      }
      // a warm glow around the sun, and a soft haze band at the horizon
      float s = max(dot(normalize(vDir), sunDir), 0.0);
      c += mix(vec3(1.0, 0.85, 0.6), vec3(0.22, 0.31, 0.5), nightAmount) * pow(s, 24.0) * mix(0.35, 0.06, nightAmount);
      c = mix(c, horizon * 1.03, exp(-abs(y) * 9.0) * 0.3);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(800, 32, 16),
  new THREE.ShaderMaterial({ ...skyShader, side: THREE.BackSide, depthWrite: false, fog: false })
);
scene.add(sky);

// Environment light from the same gradient
const environments = {};
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(
    new THREE.SphereGeometry(50, 24, 12),
    new THREE.ShaderMaterial({ ...skyShader, side: THREE.BackSide })
  ));
  const pmrem = new THREE.PMREMGenerator(renderer);
  environments.day = pmrem.fromScene(envScene, 0.02).texture;
  for (const key of ['zenith', 'horizon', 'ground']) skyUniforms[key].value.set(NIGHT_SCENE[key]);
  skyUniforms.nightAmount.value = 1;
  environments.night = pmrem.fromScene(envScene, 0.02).texture;
  skyUniforms.zenith.value.set(P.skyZenith);
  skyUniforms.horizon.value.set(P.skyHorizon);
  skyUniforms.ground.value.set(P.skyGround);
  skyUniforms.nightAmount.value = 0;
  scene.environment = environments.day;
  scene.environmentIntensity = DAY.environment;
  envScene.children[0].geometry.dispose();
  envScene.children[0].material.dispose();
  pmrem.dispose();
}

scene.fog = new THREE.Fog(P.haze, 120, 320);

// --- Lights ---------------------------------------------------------------

// Cool sky fill and warm ground bounce: shadows drift blue, the sun is gold
const hemi = new THREE.HemisphereLight(DAY.sky, DAY.bounce, DAY.fill);
scene.add(hemi);

const sun = new THREE.DirectionalLight(DAY.key, DAY.keyIntensity);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = 0;        // VSM wants zero bias — negative bias kills the shadows entirely
sun.shadow.normalBias = 0.1; // scaled to the shadow texel size when the view is fitted
// A lower-resolution map needs a smaller blur in texels to keep tree and
// porch shadows legible instead of spreading them across several metres.
sun.shadow.radius = quality.memoryOptimized ? DAY.shadowRadiusMobile : DAY.shadowRadius;
sun.shadow.blurSamples = quality.memoryOptimized ? 6 : 16;
scene.add(sun);
scene.add(sun.target);

let shadowRegion = null;
function fitSunShadow(radius, center) {
  sun.target.position.copy(center);
  sun.position.copy(center).addScaledVector(new THREE.Vector3(0.9, 0.62, 0.55), radius);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -radius;
  cam.right = cam.top = radius;
  cam.near = 1;
  cam.far = radius * 4;
  cam.updateProjectionMatrix();
  // Roughly one and a half shadow texels clears self-shadowing at each scale,
  // without the metre-scale offset a regional map would need on a close facade.
  sun.shadow.normalBias = Math.max(0.1, 3 * radius / sun.shadow.mapSize.x);
  shadowRegion = { radius, center: center.clone() };
  renderer.shadowMap.needsUpdate = true;
}

function updateSunShadow(distance) {
  if (FREE_CAMERA || !street) return;
  const fullRadius = Math.max(street.size.w, street.size.d) * 0.62;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const elevation = controls.elevation;
  // Enclose the furthest ground-plane corner of the visible view, plus room
  // for tall buildings and nearby offscreen trees to cast into it.
  const farDepth = distance * Math.sin(elevation)
    / Math.max(0.05, Math.sin(elevation) - Math.tan(halfFov) * Math.cos(elevation));
  const forward = distance * Math.sin(elevation) / Math.tan(elevation - halfFov)
    - distance * Math.cos(elevation);
  const across = farDepth * Math.tan(halfFov) * camera.aspect;
  const radius = Math.min(fullRadius, Math.max(160, Math.ceil((Math.hypot(forward, across) + 100) / 64) * 64));
  const center = radius === fullRadius
    ? new THREE.Vector3(street.offset?.x || 0, 0, street.offset?.z || 0)
    : controls.target;
  // Keep the map stationary through small pans, and change coverage in steps.
  // The padding above leaves a margin even at the edge of this cached region.
  if (shadowRegion?.radius === radius && shadowRegion.center.distanceToSquared(center) < 32 * 32) return;
  fitSunShadow(radius, center);
}

// --- Post-processing --------------------------------------------------------

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth, window.innerHeight);

composer.addPass(new RenderPass(scene, camera));

// Do not construct disabled passes: their constructors allocate render targets.
let gtao = null, bokeh = null, bloom = null;
if (quality.postprocessing) {
  gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({
    radius: 0.9,
    distanceExponent: 1,
    thickness: 1,
    scale: 1.1,
    samples: 16,
    distanceFallOff: 1,
    screenSpaceRadius: false,
  });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
  composer.addPass(gtao);

  // Tilt-shift: focus follows the orbit target; things nearer/farther soften
  bokeh = new BokehPass(scene, camera, { focus: 60, aperture: 0.00022, maxblur: 0.006 });
  composer.addPass(bokeh);

  bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.7, 0.85);
  composer.addPass(bloom);

  // Light pools and shader-positioned crop sprites cannot use the plain
  // override materials. Keep their underlying ground's AO and focus depth.
  for (const pass of [gtao, bokeh]) {
    const render = pass.render.bind(pass);
    pass.render = (...args) => {
      const mask = camera.layers.mask;
      camera.layers.disable(1);
      try { return render(...args); } finally { camera.layers.mask = mask; }
    };
  }
}

composer.addPass(new OutputPass());

// Final grade: a touch more saturation and contrast; a split tone (shadows
// lifted and cooled a little, no dead blacks in a toy; highlights warmed); a
// fine animated grain so flat colour reads as paper rather than pixels; then a
// warm vignette. All live-tunable: window.__town.vignette.uniforms
const vignette = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.22 }, warmth: { value: 0.03 }, saturation: { value: 1.04 }, contrast: { value: 1.025 }, lift: { value: 0.05 }, grain: { value: 0.012 }, time: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float strength; uniform float warmth; uniform float saturation; uniform float contrast;
    uniform float lift; uniform float grain; uniform float time;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(luma), c.rgb, saturation);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      float sh = pow(1.0 - clamp(luma, 0.0, 1.0), 2.0);
      c.rgb += vec3(0.55, 0.7, 1.0) * sh * lift;                 // shadows: lifted, cool
      float hi = smoothstep(0.55, 1.0, luma);
      c.rgb += vec3(1.0, 0.72, 0.42) * hi * lift * 0.5;          // highlights: warm
      float n = fract(sin(dot(gl_FragCoord.xy + vec2(time * 37.0, time * 91.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      c.rgb += n * grain;
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.85);
      float v = 1.0 - smoothstep(0.35, 1.05, length(d) * 1.35) * strength;
      c.rgb *= v;
      c.rgb += vec3(warmth, warmth * 0.5, 0.0) * (1.0 - v); // edges drift warm, not black
      gl_FragColor = c;
    }
  `,
});
composer.addPass(vignette);
const lighting = createLighting({ scene, renderer, sun, hemi, skyUniforms, environments,
  vignette, bloom, quality, wake: wakeRendering });
if (quality.memoryOptimized) installContextRecovery(renderer.domElement, {
  pause() { graphicsLost = true; renderLoop?.setVisible(false); },
  resume() {
    graphicsLost = false;
    renderer.shadowMap.needsUpdate = true;
    renderLoop?.setVisible(!document.hidden);
  },
});

// --- Loading bar ------------------------------------------------------------
// Each milestone advances one overall bar. A short, fixed width transition
// avoids restarting compositor transform animations between phases on Safari.

const loading = document.getElementById('loading');
const loadingBar = loading.querySelector('.bar');
const loadingWhat = loading.querySelector('.what');
const progress = loadingProgress(loadingBar, loadingWhat);
// A frame's grace so a new target is painted, and its transition under way,
// before the main thread goes away for a while (the timer covers background
// tabs, where frames never come)
const nextFrame = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 100); });

// The build owns the middle of the bar, split between generateSite's sections
// in proportion to how long each took the last time on this device (a first
// visit uses a profile measured on Avon). Only the bar reads this, so a stale
// profile just makes it uneven.
const BUILD_FROM = 0.22, BUILD_TO = 0.92;
const PROF_KEY = `town-build-prof-v3:${quality.name}`;
let expectedProf = [['ground', 193], ['streets and curbs', 640], ['centre lines', 656], ['sidewalks', 658], ['paths', 914], ['buildings', 1125], ['trees, lamps, cars', 1640], ['extras, tufts', 1802], ['edge', 1825], ['bake', 2009]];
try {
  const saved = JSON.parse(localStorage.getItem(PROF_KEY));
  if (Array.isArray(saved) && saved.length === expectedProf.length && saved.every(([name, ms], i) =>
    name === expectedProf[i][0] && Number.isFinite(ms) && ms > 0 && (i === 0 || ms >= saved[i - 1][1]))) expectedProf = saved;
} catch { /* storage unavailable or stale */ }
const STAGE_WHAT = { ground: 'shaping the ground', 'streets and curbs': 'laying the roads', paths: 'joining the sidewalks', buildings: 'raising the buildings', 'trees, lamps, cars': 'planting the trees', 'extras, tufts': 'the finishing touches', bake: 'setting the diorama' };

// Aim at the end of section i, captioned for the sections long enough to read
function aimAtStage(i) {
  const total = expectedProf[expectedProf.length - 1][1];
  const at = i < expectedProf.length ? expectedProf[i][1] / total : 1;
  progress(BUILD_FROM + (BUILD_TO - BUILD_FROM) * at, STAGE_WHAT[expectedProf[i]?.[0]]);
}
// generateSite awaits this after each section: aim at the next one, then yield
// so the browser can paint if a frame is due (a short section between two
// frames costs nothing)
async function stageDone(name) {
  const i = expectedProf.findIndex(([n]) => n === name);
  if (i >= 0) aimAtStage(i + 1);
  await new Promise((r) => setTimeout(r, 0));
}
// The opening scenery has finished: fade the progress panel away.
function loadingDone() {
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 600);
}

// --- Diorama ----------------------------------------------------------------

let street = null;
let streaming = null;
let streamDebug = null;
let siteData = null; // the place's site.json, loaded before the first build

async function build() {
  streamDebug?.dispose();streamDebug=null;
  if (street) {
    scene.remove(street.group);
    if (streaming) { streaming.dispose(); streaming = null; }
    else street.group.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) o.geometry.dispose();
    });
  }
  progress(BUILD_FROM, 'loading the landscape');
  const ts = performance.now();
  const surfaceAsset = await takeSurfaceAsset(siteData);
  timing.surfaceLoad = Math.round(performance.now() - ts);
  if (!streamEnabled) aimAtStage(0);
  await nextFrame(); // paint that before the main thread disappears into the build
  const tb = performance.now();
  // A place always builds from its own name, so trees and jitter never move between visits
  if (streamEnabled) {
    const {loadStreamedSite} = await import('./streaming.js');
    ({street,streaming} = await loadStreamedSite(siteResult.manifest,streamDirectory,{
      mobile:quality.memoryOptimized,
      onProgress(p,label) { progress(BUILD_FROM+(BUILD_TO-BUILD_FROM)*p,label); },
      changed() { lighting.refreshMaterials(street); renderer.shadowMap.needsUpdate=true; wakeRendering(); },
    }));
    if (params.get('stream')==='1' || params.get('tiles')==='1') {
      const {createStreamDebug}=await import('./stream-debug.js');
      streamDebug=createStreamDebug({scene,street,streaming,manifest:siteResult.manifest,wake:wakeRendering});
    }
  } else {
    // Prepared scenes do not need the building/terrain generators and their
    // many dependencies. Load them only for authoring or the original loader.
    const {generateSite} = await import('./site.js');
    street = await generateSite(siteData, siteData.seed ?? siteName, {
      trees: !params.has('notrees'), onStage: stageDone, memoryOptimized: quality.memoryOptimized, surfaceAsset,
    });
  }
  timing.build = Math.round(performance.now() - tb);
  console.log("build profile (ms):", street.prof.map(([n, t]) => `${n} ${t}`).join(" · "));
  if (!streamEnabled) try { localStorage.setItem(PROF_KEY, JSON.stringify(street.prof)); } catch { /* storage unavailable */ } // paces the next visit's bar
  scene.add(street.group);
  lighting.attach(street);

  // Start with the whole diorama; the fixed-tilt viewer fits local coverage
  // before its first frame and keeps it cached until the view moves far enough.
  const R = Math.max(street.size.w, street.size.d) * 0.62;
  const offset=street.offset||{x:0,z:0};

  const L = Math.max(street.size.w, street.size.d);
  // Haze is set per frame from the camera distance (see render); nothing here.
  // Depth precision: keep near/far as tight as the scene allows (z-fighting
  // on facades otherwise) — the sky dome is huge, so far just needs to clear it
  camera.near = 0.5; // adjusted to the current viewing distance in render()
  const skyR = Math.max(800, L * 10);
  sky.scale.setScalar(skyR / 800);
  camera.far = skyR * 3; // far barely affects depth precision; near does
  camera.updateProjectionMatrix();
  controls.minDistance = 10;
  if (!FREE_CAMERA) controls.groundHeight = groundAt;
  const shadowRes = Math.min(quality.shadowSize, L > 150 ? 4096 : 2048);
  sun.shadow.mapSize.set(shadowRes, shadowRes);
  fitSunShadow(R, new THREE.Vector3(offset.x, 0, offset.z));
  skyUniforms.sunDir.value.copy(sun.position).sub(sun.target.position).normalize();
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  renderer.shadowMap.needsUpdate = true; // one shadow render for this build
  // Depth of field follows the view scale in render(), so expanding the town
  // no longer washes out the miniature effect at the same camera position.
  gtao?.updateGtaoMaterial({ radius: 0.9 * Math.max(1, L / 160) });

  controls.maxDistance = Math.max(R * 4, fittedCameraDistance());
  wakeRendering();
}

// Sites without a chosen opening and explicit authoring views retain their camera across refreshes.
const CAM_KEY = 'town-camera';
const cameraFrame = () => JSON.stringify([siteData.center, siteData.bounds, siteData.size]);

function saveCamera() {
  if (OPENING_VIEW) return;
  try {
    sessionStorage.setItem(CAM_KEY, JSON.stringify({
      site: siteName,
      frame: cameraFrame(),
      pos: camera.position.toArray(),
      target: controls.target.toArray(),
      groundFollowing: !FREE_CAMERA,
    }));
  } catch { /* storage unavailable — nothing to do */ }
}

function restoreCamera() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CAM_KEY));
    if (!s || s.site !== siteName || s.frame !== cameraFrame()) return false;
    camera.position.fromArray(s.pos);
    controls.target.fromArray(s.target);
    if (!FREE_CAMERA && !s.groundFollowing) {
      const lift = groundAt(controls.target.x, controls.target.z) + 4 - controls.target.y;
      controls.target.y += lift;
      camera.position.y += lift;
    }
    if (controls.setFromCamera) controls.setFromCamera();
    controls.update();
    return true;
  } catch {
    return false;
  }
}

window.addEventListener('pagehide', saveCamera);
controls.addEventListener('end', saveCamera);

function openingFieldOfView(aspect) {
  // Widen narrow screens while preserving the viewing direction and zoom.
  return Math.min(40, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(26) / 2)
    * Math.max(1, OPENING_VIEW.aspect / aspect))));
}

function frameOpeningView() {
  const [x, z] = OPENING_VIEW.target;
  const target = new THREE.Vector3(x, groundAt(x, z) + OPENING_VIEW.lift, z);
  camera.fov = openingFieldOfView(camera.aspect);
  camera.updateProjectionMatrix();
  controls.set({ target, theta: VIEW_AZIMUTH, distance: OPENING_VIEW.distance });
  wakeRendering();
}

function fittedCameraDistance() {
  const L = Math.max(street.size.w, street.size.d);
  const k = Math.max(1, 1.15 / camera.aspect); // narrow windows need more distance
  return L * 1.65 * k;
}

// Place the camera on the view axis at a distance that fits the slab
function frameCamera() {
  const dist = fittedCameraDistance();
  controls.maxDistance = Math.max(controls.maxDistance, dist);
  const target = new THREE.Vector3(street.offset?.x||0, street.bottom !== undefined ? 0 : 1, street.offset?.z||0);
  if (controls.set) {
    controls.set({ target, theta: VIEW_AZIMUTH, distance: dist });
  } else {
    controls.target.copy(target);
    camera.position.set(
      target.x + Math.sin(VIEW_AZIMUTH) * Math.cos(VIEW_ELEVATION) * dist,
      target.y + Math.sin(VIEW_ELEVATION) * dist,
      target.z + Math.cos(VIEW_AZIMUTH) * Math.cos(VIEW_ELEVATION) * dist
    );
    controls.update();
  }
  wakeRendering();
}

// --- Chimney smoke ----------------------------------------------------------

function animateSmoke(dt, time) {
  if (!street) return;
  for (const e of street.smokes) {
    for (const p of e.puffs) {
      p.t += dt * p.speed;
      if (p.t > 1) p.t -= 1;
      const t = p.t;
      const rise = t * 2.6;
      p.mesh.position.set(
        e.x + p.drift * rise * 0.5 + Math.sin(time * 0.7 + p.drift * 20) * 0.12 * t,
        e.baseY + rise,
        e.z + Math.cos(time * 0.5 + p.drift * 13) * 0.1 * t
      );
      const s = 0.55 + t * 1.9;
      p.mesh.scale.setScalar(s);
      p.mesh.material.opacity = 0.42 * Math.sin(t * Math.PI) * (1 - t * 0.4);
    }
  }
}

// --- Keyboard ---------------------------------------------------------

const held = new Set();
window.addEventListener('keydown', (e) => {
  if (e.key.startsWith('Arrow')) { held.add(e.key); e.preventDefault(); wakeRendering(); }
});
window.addEventListener('keyup', (e) => {
  if (held.delete(e.key)) wakeRendering();
});
window.addEventListener('blur', () => held.clear());

// Up/down arrows glide the camera along the view direction (speed scales
// with how far out you are); left/right arrows turn around the look-at point,
// in the same sense as a sideways trackpad swipe.
const TURN_SPEED = 1.1; // radians per second
const _fwd = new THREE.Vector3(), _move = new THREE.Vector3();
function panWithKeys(dt) {
  if (held.size === 0) return;
  const turn = (held.has('ArrowRight') ? -1 : 0) + (held.has('ArrowLeft') ? 1 : 0);
  if (turn !== 0) {
    if (controls.rotate) controls.rotate(turn * TURN_SPEED * dt);
  }
  const glide = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
  if (glide === 0) return;
  const dist = camera.position.distanceTo(controls.target);
  const speed = dist * 0.35 * dt; // about a third of the orbit distance per second
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _move.copy(_fwd.normalize()).multiplyScalar(glide * speed);
  if (controls.pan) controls.pan(_move);
  else { camera.position.add(_move); controls.target.add(_move); }
}

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  if (OPENING_VIEW) camera.fov = openingFieldOfView(camera.aspect);
  camera.updateProjectionMatrix();
  // Allow a full view after rotating a phone, preserving the user's current zoom.
  if (street) controls.maxDistance = Math.max(controls.maxDistance, fittedCameraDistance());
  renderer.setSize(w, h);
  composer.setSize(w, h);
  wakeRendering();
});

// --- Go ----------------------------------------------------------------

// The naked URL shows the home town; ?site=<name> shows another place under data/.
progress(BUILD_FROM, 'reading the map', 1);
const siteResult = await siteRequest;
if (siteResult.error) throw siteResult.error;
siteData = siteResult.data;
// ?bp=<id>[,<id>] previews draft blueprints from
// data/<site>/buildings/<id>/draft.json without touching overrides.json
for (const id of (params.get('bp') || '').split(',').filter(Boolean)) {
  const r = await fetch(`./data/${encodeURIComponent(siteName)}/buildings/${encodeURIComponent(id)}/draft.json`);
  if (!r.ok) { console.warn(`?bp: no buildings/${id}/draft.json`); continue; }
  const b = siteData.buildings.find((x) => String(x.id) === id);
  if (b) b.blueprint = await r.json(); else console.warn(`?bp: no building ${id} in site`);
}
// Isolate reference elevations without changing the ordinary miniature.
if(params.has('isolate'))siteData.buildings=siteData.buildings.filter(b=>String(b.id)===params.get('isolate'));
if (params.get('stage') === 'massing') {
  const {massingBlueprint} = await import('./massing.js');
  for (const b of siteData.buildings) if (b.blueprint) b.blueprint = massingBlueprint(b.blueprint);
}
// The place gets a quiet caption in the corner: "Avon" big, "New York" under
// it (split on the last comma of the title).
const title = siteData.title || siteData.name || siteName;
document.title = title;
const comma = title.lastIndexOf(',');
const place = document.getElementById('place');
place.querySelector('.name').textContent = comma > 0 ? title.slice(0, comma).trim() : title;
place.querySelector('.region').textContent = comma > 0 ? title.slice(comma + 1).trim() : '';
place.hidden = false;
await build();
if (OPENING_VIEW) frameOpeningView();
else if (!restoreCamera()) frameCamera();

// Photo matching: look at building `id` from outside one of its faces ('+u',
// '-u', '+v', '-v' in the blueprint frame; 'front' = its road side; or a
// compass bearing in degrees to stand at), `dist` metres away. Works with the
// iso camera (which keeps its tilt) and with ?free=1 (eye `height` metres up).
// Also reachable as ?focus=<id>&side=<face>&dist=<m>&height=<m>.
// Terrain height (bilinear on site.json's grid) so the camera target follows
// the ground: Genesee Street lies ~15 m below the circle, and a fixed y = 4
// framed sky above those buildings.
function groundAt(x, z) {
  if(street?.surfaces?.grade)return street.surfaces.grade(x,z);
  const t = siteData?.terrain;
  if (!t) return 0;
  const fx = ((x - t.x0) / (t.x1 - t.x0)) * (t.cols - 1), fz = ((z - t.z0) / (t.z1 - t.z0)) * (t.rows - 1);
  const i = Math.max(0, Math.min(t.cols - 2, Math.floor(fx))), j = Math.max(0, Math.min(t.rows - 2, Math.floor(fz)));
  const a = fx - i, c = fz - j, v = t.values, g = (ii, jj) => v[jj * t.cols + ii];
  return (g(i, j) * (1 - a) + g(i + 1, j) * a) * (1 - c) + (g(i, j + 1) * (1 - a) + g(i + 1, j + 1) * a) * c;
}
function lookAtBuilding(id, side = 'front', dist = 45, height = 8) {
  const b = siteData?.buildings.find((x) => String(x.id) === String(id));
  if (!b) { console.warn('lookAtBuilding: no building', id); return; }
  const o = b.obb, c = Math.cos(o.angle), sn = Math.sin(o.angle);
  let n;
  if (typeof side === 'number' || /^-?\d+(\.\d+)?$/.test(side)) { const r = THREE.MathUtils.degToRad(+side); n = [Math.sin(r), -Math.cos(r)]; }
  else if (side === 'front' && b.front) n = [Math.cos(b.front.dir), Math.sin(b.front.dir)];
  else n = { '+u': [c, sn], '-u': [-c, -sn], '+v': [-sn, c], '-v': [sn, -c] }[side] || [0, 1];
  const target = new THREE.Vector3(o.cx, groundAt(o.cx, o.cz) + 4, o.cz);
  if (controls.set) {
    controls.set({ target, theta: Math.atan2(n[0], n[1]), distance: dist });
  } else {
    controls.target.copy(target);
    camera.position.set(o.cx + n[0] * dist, target.y + height, o.cz + n[1] * dist);
    controls.update();
  }
  wakeRendering();
}
if (params.has('focus')) lookAtBuilding(params.get('focus'), params.get('side') || 'front', +params.get('dist') || 45, +params.get('height') || 8);

let animationTime = 0;
function render(dt = 0) {
  if (graphicsLost) return;
  animationTime += dt;
  panWithKeys(dt);
  controls.update();
  const dist = camera.position.distanceTo(controls.target);
  updateSunShadow(dist);
  if (bokeh) {
    bokeh.uniforms.focus.value = dist;
    bokeh.uniforms.aperture.value = 0.0068 / Math.max(12, dist * 0.25);
    bokeh.uniforms.maxblur.value = 0.0068;
  }
  lighting.update(dt, camera, controls.target);
  // Preserve centimetre-separated surfaces even at regional overview scale.
  const near = viewNearPlane(dist, !FREE_CAMERA);
  if (Math.abs(camera.near - near) > 0.001) {
    camera.near = near;
    camera.updateProjectionMatrix();
  }
  // Sector culling must use this frame's depth range, especially when a
  // saved view or focus link jumps from the regional overview to a building.
  streaming?.update(camera,controls.target);
  streamDebug?.update();
  // Haze relative to what you're looking at: clear up to the target, then
  // softening into the distance, whatever the window or diorama size
  scene.fog.near = Math.max(dist * 1.1, dist + 35);
  scene.fog.far = Math.max(dist * 2.6, dist + 150);
  animateSmoke(dt, animationTime);
  vignette.uniforms.time.value = animationTime % 60;
  composer.render();
}
// Draw the base immediately and repaint as opening regions arrive, so the
// miniature takes shape behind the progress panel during preparation.
renderLoop = createRenderLoop(render);
const syncRenderVisibility = () => {
  if (document.hidden) held.clear();
  renderLoop.setVisible(!document.hidden && !graphicsLost);
};
document.addEventListener('visibilitychange', syncRenderVisibility);
syncRenderVisibility();
// Shader compilation can take several seconds on a phone. Reserve completion
// for the rendered frame so a full bar never precedes another apparent wait.
try {
  await streaming?.prepare(camera,controls.target,p=>progress(0.92+p*0.03,'loading the opening view'));
} catch(error) {
  renderLoop.setVisible(false);
  document.removeEventListener('visibilitychange', syncRenderVisibility);
  streaming?.dispose(); // stop pending region retries while the startup error UI is open
  throw error;
}
progress(0.96, 'lighting the scene');
await nextFrame();
{ const tr = performance.now(); render(); timing.firstRender = Math.round(performance.now() - tr); timing.total = Math.round(performance.now()); }
progress(1);
loadingDone();

// Handy for poking at the scene from the console
window.__town = { scene, camera, renderer, composer, controls, sun, hemi, gtao, bokeh, bloom, vignette, lighting, grain: GRAIN, quality, renderLoop, build, frameCamera, lookAtBuilding, get siteData() { return siteData; }, get street() { return street; }, get streaming() { return streaming; }, timing };
