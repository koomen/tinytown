// This shell survives failed imports/builds so the next edit can repair a preview.
const config = window.previewConfig;
const status = document.getElementById('status');
const key = `town-preview-camera:${location.pathname}`;
let camera, controls, timer, signature;
function saveCamera() {
  if (!camera || !controls) return;
  try { sessionStorage.setItem(key, JSON.stringify({position: camera.position.toArray(), target: controls.target.toArray()})); } catch {}
}

function changed(event) {
  let next;
  try { next = JSON.parse(event.data).fingerprint; } catch { return; }
  if (!next || next === signature) return;
  if (signature === undefined) { signature = next; return; }
  signature = next;
  clearTimeout(timer);
  timer = setTimeout(() => { saveCamera(); location.reload(); }, 450);
}
const {watchJSON} = await import('/tinytown/web/live-updates.js');
const updates = new URL(config.events, location.href); updates.searchParams.set('poll', '1');
let connectionMessage;
watchJSON(updates, data => changed({data: JSON.stringify(data)}), {
  connected: () => { if (connectionMessage !== undefined) { status.textContent = connectionMessage; connectionMessage = undefined; } },
  disconnected: () => { connectionMessage ??= status.textContent; status.textContent = 'Reconnecting…'; },
});
window.addEventListener('pagehide', saveCamera);

try {
  const response = await fetch(config.scene, {cache: 'no-store'});
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `Scene request failed (${response.status})`);
  const THREE = await import('three');
  const {OrbitControls} = await import('three/addons/controls/OrbitControls.js');
  const {createNightSpotlights, applyNightEmission, NIGHT, DAY, NIGHT_SCENE} = await import('../../src/lighting.js');
  const world = new THREE.Scene();
  world.background = new THREE.Color('#d7eaf5');
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.append(renderer.domElement);
  camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.2, 5000);
  camera.layers.enable(1); // color-pass foliage and lamplight, as in the viewer
  controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI * 0.48;
  const hemi = new THREE.HemisphereLight(0xe7f2ff, 0x6f8060, 2);
  world.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe1b3, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0001;
  world.add(sun, sun.target);
  let group;
  if (data.asset) {
    const module = await import(new URL(data.asset.module, document.baseURI).href);
    const factory = module[data.asset.export];
    if (typeof factory !== 'function') throw new Error(`No exported ${data.asset.export}({THREE}) factory in ${data.asset.module}`);
    const value = await factory({THREE});
    group = value?.group || value;
    if (!group?.isObject3D) throw new Error('Asset preview factory must return a Three.js Object3D or {group}');
  } else {
    const {generateSite} = await import('../../src/site.js');
    const street = await generateSite(data, data.seed || data.name, {trees: config.spec.trees !== false});
    group = street.group;
  }
  world.add(group);
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  sun.position.copy(center).add(new THREE.Vector3(radius, radius*1.8, radius*.7));
  sun.target.position.copy(center);
  Object.assign(sun.shadow.camera, {left:-radius,right:radius,top:radius,bottom:-radius,near:.1,far:radius*5});
  sun.shadow.camera.updateProjectionMatrix();
  camera.far = Math.max(5000, radius*10);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(radius*1.2,radius*1.4,radius*1.5));
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (saved?.position?.length === 3 && saved?.target?.length === 3) {
      camera.position.fromArray(saved.position); controls.target.fromArray(saved.target);
    }
  } catch {}
  controls.update();
  controls.addEventListener('end', saveCamera);
  const spotlights = createNightSpotlights(world);
  spotlights.refresh(group);
  const emitters = new Set();
  group.traverse(object => {
    for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
      if (!material.userData.surface && material.emissive?.getHex() && (material.userData.nightEmission || material.emissiveIntensity > 0)) emitters.add(material);
    }
  });
  const timeButton = document.createElement('button');
  timeButton.id = 'preview-time-toggle';
  timeButton.style.cssText = 'position:fixed;right:12px;bottom:12px;padding:10px 16px;border:0;border-radius:8px;background:#fffffff0;cursor:pointer;font:14px system-ui';
  document.body.append(timeButton);
  let night = new URL(location.href).searchParams.get('time') === 'night';
  const render = () => { spotlights.update(night ? 1 : 0, controls.target); renderer.render(world, camera); };
  const setTime = value => {
    night = value; NIGHT.value = night ? 1 : 0;
    const profile = night ? NIGHT_SCENE : DAY;
    world.background.set(profile.haze);
    sun.color.set(profile.key); sun.intensity = profile.keyIntensity;
    hemi.color.set(profile.sky); hemi.groundColor.set(profile.bounce); hemi.intensity = profile.fill;
    renderer.toneMappingExposure = profile.exposure;
    for (const material of emitters) applyNightEmission(material, NIGHT.value);
    timeButton.textContent = night ? 'Night · Switch to day' : 'Day · Switch to night';
    timeButton.setAttribute('aria-pressed', String(night));
    const url = new URL(location.href); url.searchParams.set('time', night ? 'night' : 'day'); history.replaceState(null, '', url);
    render();
  };
  timeButton.addEventListener('click', () => setTime(!night));
  controls.addEventListener('change', render);
  addEventListener('resize', () => {
    camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight); render();
  });
  setTime(night);
  document.title = `${data.title || 'Asset'} · TinyTown preview`;
  status.textContent = `${config.spec.target || data.title || 'Area'} · Live preview`;
  window.__townPreview = {scene: world, camera, controls, renderer, data};
} catch (error) {
  status.classList.add('error');
  status.textContent = `Preview could not build:\n${error.message}\n\nWatching for the next edit…`;
  console.error(error);
}
