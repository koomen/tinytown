// Queue-owned shell; scene data and imported generators come from the job.
const config = window.previewConfig;
const status = document.getElementById('status');
const key = `town-map-camera:${location.pathname}:${config.spec.site}`;
let camera, controls, signature, timer, building = true, pending = false;
function saveCamera() {
  if (!camera || !controls) return;
  try { sessionStorage.setItem(key, JSON.stringify({position: camera.position.toArray(), target: controls.target.toArray()})); } catch {}
}
function reload() {
  clearTimeout(timer);
  timer = setTimeout(() => { if (building) { pending = true; return; } saveCamera(); location.reload(); }, 900);
}

function changed(event) {
  let next;
  try { next = JSON.parse(event.data).fingerprint; } catch { return; }
  if (!next || next === signature) return;
  if (signature !== undefined) reload();
  signature = next;
}
const {watchJSON} = await import('/tinytown/web/live-updates.js');
const updates = new URL(config.events, location.href); updates.searchParams.set('poll', '1');
watchJSON(updates, data => changed({data: JSON.stringify(data)}));
addEventListener('pagehide', saveCamera);
document.getElementById('map-site').addEventListener('change', event => {
  saveCamera();
  const url = new URL(location.href); url.searchParams.set('site', event.target.value); location.href = url;
});
document.getElementById('map-fit').disabled = true;
document.getElementById('map-time').disabled = true;

try {
  const response = await fetch(config.scene, {cache: 'no-store'});
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `Scene request failed (${response.status})`);
  const THREE = await import('three');
  const {OrbitControls} = await import('three/addons/controls/OrbitControls.js');
  const {generateSite} = await import('../../src/site.js');
  const {bakeMobile} = await import('../../src/bake.js');
  const {coarseModel} = await import('./stream-export.js');
  const {NIGHT, applyNightEmission, createNightSpotlights} = await import('../../src/lighting.js');
  const world = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.append(renderer.domElement);
  camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .2, 20000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI * .48;
  const hemi = new THREE.HemisphereLight(0xe7f2ff, 0x6f8060, 2);
  const sun = new THREE.DirectionalLight(0xffe1b3, 3);
  world.add(hemi, sun, sun.target);
  // Keep detail near the camera, using the same distant models as the town
  // viewer. Everything is built in memory; no stream files are written.
  const coarse = new WeakMap();
  const street = await generateSite(data, data.seed || data.name, {
    trees: config.spec.trees !== false, memoryOptimized: true,
    onModel: async model => {
      model.updateMatrixWorld(true);
      const simple = await bakeMobile(coarseModel(model));
      const compact = await bakeMobile(model);
      coarse.set(compact, simple);
      return compact;
    },
    onScene: async root => {
      root.updateMatrixWorld(true);
      const base = new THREE.Group(), cells = new Map();
      const bounds = new THREE.Box3(), center = new THREE.Vector3();
      const matrix = new THREE.Matrix4(), color = new THREE.Color();
      const cellAt = (x, z) => {
        const i = Math.floor(x / 100), j = Math.floor(z / 100), id = `${i},${j}`;
        if (!cells.has(id)) cells.set(id, {detail: new THREE.Group(), far: new THREE.Group(), center: new THREE.Vector3((i+.5)*100, 0, (j+.5)*100)});
        return cells.get(id);
      };
      for (const child of [...root.children]) {
        if (child.userData.streamBase) { base.attach(child); continue; }
        if (child.isInstancedMesh) {
          const partitions = new Map();
          for (let i = 0; i < child.count; i++) {
            child.getMatrixAt(i, matrix); matrix.premultiply(child.matrixWorld);
            center.setFromMatrixPosition(matrix);
            const cell = cellAt(center.x, center.z);
            if (!partitions.has(cell)) partitions.set(cell, []);
            partitions.get(cell).push(i);
          }
          for (const [cell, indices] of partitions) {
            const part = new THREE.InstancedMesh(child.geometry, child.material, indices.length);
            indices.forEach((i, k) => {
              child.getMatrixAt(i, matrix); part.setMatrixAt(k, matrix.premultiply(child.matrixWorld));
              if (child.instanceColor) { child.getColorAt(i, color); part.setColorAt(k, color); }
            });
            cell.detail.add(part);
          }
        } else {
          bounds.setFromObject(child).getCenter(center);
          if (!Number.isFinite(center.x)) continue;
          const cell = cellAt(center.x, center.z);
          cell.far.add(coarse.get(child) || coarseModel(child));
          cell.detail.attach(child);
        }
      }
      const out = await bakeMobile(base);
      let done = 0;
      for (const cell of cells.values()) {
        const lod = new THREE.LOD();
        const detail = await bakeMobile(cell.detail), far = await bakeMobile(cell.far);
        detail.position.sub(cell.center); far.position.sub(cell.center);
        lod.position.copy(cell.center);
        lod.addLevel(detail, 0); lod.addLevel(far, 350, .1);
        out.add(lod);
        if (++done % 40 === 0) status.textContent = `Loading map: ${Math.round(done / cells.size * 100)}%`;
      }
      return out;
    },
    onStage: async stage => {
      status.textContent = `Loading map: ${stage}…`;
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    },
  });
  world.add(street.group);
  const box = new THREE.Box3().setFromObject(street.group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  camera.far = Math.max(5000, radius * 10);
  camera.updateProjectionMatrix();
  sun.position.copy(center).add(new THREE.Vector3(radius, radius * 1.8, radius * .7));
  sun.target.position.copy(center);
  function fit() {
    controls.target.copy(center);
    const distance = radius * Math.max(1, 1 / camera.aspect);
    camera.position.copy(center).add(new THREE.Vector3(distance * .8, distance * 1.2, distance));
    controls.update();
  }
  fit();
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (saved?.position?.length === 3 && saved?.target?.length === 3) {
      camera.position.fromArray(saved.position); controls.target.fromArray(saved.target);
    }
  } catch {}
  controls.update();
  const spotlights = createNightSpotlights(world);
  spotlights.refresh(street.group);
  const emitters = new Set();
  street.group.traverse(object => {
    for (const material of object.material ? [].concat(object.material) : []) {
      if (!material.userData.surface && material.emissive?.getHex() && (material.userData.nightEmission || material.emissiveIntensity > 0)) emitters.add(material);
    }
  });
  let night = new URL(location.href).searchParams.get('time') === 'night';
  const render = () => { spotlights.update(night ? 1 : 0, controls.target); renderer.render(world, camera); };
  function lighting() {
    NIGHT.value = night ? 1 : 0;
    world.background = new THREE.Color(night ? '#19253b' : '#d7eaf5');
    sun.color.set(night ? 0x9ebaff : 0xffe1b3); sun.intensity = night ? .72 : 3;
    hemi.color.set(night ? 0x829bce : 0xe7f2ff); hemi.intensity = night ? .34 : 2;
    for (const material of emitters) applyNightEmission(material, NIGHT.value);
    document.getElementById('map-time').textContent = night ? 'Day' : 'Night';
    render();
  }
  document.getElementById('map-time').disabled = false;
  document.getElementById('map-time').onclick = () => {
    night = !night;
    const url = new URL(location.href); url.searchParams.set('time', night ? 'night' : 'day'); history.replaceState(null, '', url);
    lighting();
  };
  document.getElementById('map-fit').disabled = false;
  document.getElementById('map-fit').onclick = () => { fit(); saveCamera(); render(); };
  controls.addEventListener('change', render);
  controls.addEventListener('end', saveCamera);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); render();
  });
  lighting();
  document.title = `${data.title || config.spec.site} · Whole map`;
  status.textContent = `${data.title || config.spec.site} · Live`;
  window.__townPreview = {scene: world, camera, controls, renderer, data};
} catch (error) {
  status.classList.add('error');
  status.textContent = `Map could not build:\n${error.message}\n\nWatching for the next edit…`;
  console.error(error);
} finally {
  building = false;
  if (pending) reload();
}
