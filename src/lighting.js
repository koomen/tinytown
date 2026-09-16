import * as THREE from 'three';
import { P } from './palette.js';

// Shared by the batched glass shaders, lamp halos, and pools of lamplight.
// Changing time of day never rebuilds geometry or recompiles a material.
export const NIGHT = { value: 0 };

// Authored fixtures and baked interior bounce retain their individual levels
// through ObjectLoader/sector serialization. Ordinary town lamps keep the
// existing default profile. A zero day value must still be discoverable when
// a sector arrives or time switches back to night.
export function applyNightEmission(material, amount) {
  const profile=material.userData.nightEmission;
  material.emissiveIntensity=profile
    ? THREE.MathUtils.lerp(profile.day,profile.night,amount)
    : 0.08+amount*2.8;
}

// Authored uplights are reconstructed from kept fixture meshes, since native
// Light nodes are not part of the geometry bake. Four shared slots bound the
// lighting cost and follow the visible coarse/detail anchors as sectors swap.
export function createNightSpotlights(scene,limit=4) {
  const group=new THREE.Group();group.name='night-authored-spotlights';scene.add(group);
  const lights=[],position=new THREE.Vector3(),target=new THREE.Vector3();
  let anchors=[];
  const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
  return {
    group,lights,
    refresh(root) {
      anchors=[];root.traverse(o=>{if(o.userData.nightSpotlight)anchors.push(o);});
      while(lights.length<Math.min(limit,anchors.length)) {
        const light=new THREE.SpotLight(0xffffff,0);light.name='authored-night-spotlight';
        group.add(light,light.target);lights.push(light);
      }
    },
    update(amount,focus) {
      const active=amount>0 ? anchors.filter(visible).map(anchor=>({anchor,
        distance:anchor.getWorldPosition(position).distanceToSquared(focus)})).sort((a,b)=>a.distance-b.distance) : [];
      lights.forEach((light,i)=>{
        const anchor=active[i]?.anchor;
        if(!anchor){light.intensity=0;return;}
        const profile=anchor.userData.nightSpotlight;
        light.position.copy(anchor.getWorldPosition(position));
        light.target.position.copy(anchor.localToWorld(target.fromArray(profile.target)));
        light.color.set(profile.color);light.intensity=amount*profile.intensity;
        light.distance=profile.distance;light.angle=profile.angle;light.penumbra=profile.penumbra;
      });
    },
    clear() {anchors=[];for(const light of lights)light.intensity=0;},
  };
}

export const DAY = {
  zenith: P.skyZenith, horizon: P.skyHorizon, ground: P.skyGround, haze: P.haze,
  // Clear daylight: direct sun carries the scene, with cool sky light in shade.
  // Keep whites bright without washing the shaded faces and lawns in bloom.
  key: 0xffecd0, keyIntensity: 3.6, sky: 0xb2cff4, bounce: 0xb59a78,
  fill: 0.26, environment: 0.30, exposure: 1.0,
  bloom: 0.08, threshold: 1.0, saturation: 1.09, contrast: 1.07, lift: 0.008,
  shadowRadius: 2.5, shadowRadiusMobile: 1,
};
export const NIGHT_SCENE = {
  zenith: 0x111b38, horizon: 0x374461, ground: 0x19253b, haze: 0x202f4b,
  key: 0x9ebaff, keyIntensity: 0.72, sky: 0x829bce, bounce: 0x343953,
  fill: 0.34, environment: 0.22, exposure: 0.94,
  bloom: 0.44, threshold: 0.85, saturation: 1.05, contrast: 1.04, lift: 0.016,
  shadowRadius: 7, shadowRadiusMobile: 2,
};

// All lamps get a terrain-following pool and a soft halo in two draw calls.
// A fixed handful of real lights also illuminate nearby walls and tree trunks.
function streetLighting(street, count) {
  const group = new THREE.Group();
  group.name = 'night-streetlights';
  const positions = [], uv = [], indices = [], bulbs = [];
  const { roadDistance, roadY, walkY } = street.surfaces;
  const hw = street.size.w / 2, hd = street.size.d / 2, offset = street.offset || { x: 0, z: 0 };
  const steps = 12, radius = 7;
  for (const lamp of street.lamps) {
    bulbs.push(lamp.x, lamp.y, lamp.z);
    const base = positions.length / 3;
    for (let j = 0; j <= steps; j++) for (let i = 0; i <= steps; i++) {
      const x = Math.max(offset.x-hw, Math.min(offset.x+hw, lamp.x + (i/steps*2-1)*radius));
      const z = Math.max(offset.z-hd, Math.min(offset.z+hd, lamp.z + (j/steps*2-1)*radius));
      const y = street.lampPoolHeights?.[positions.length/3]
        ?? (roadDistance(x,z) < 0 ? roadY(x,z) : walkY(x,z));
      positions.push(x, y + 0.045, z);
      uv.push(i/steps, j/steps);
      if (i < steps && j < steps) {
        const k = base+j*(steps+1)+i;
        indices.push(k,k+steps+1,k+1,k+1,k+steps+1,k+steps+2);
      }
    }
  }
  const poolGeo = new THREE.BufferGeometry();
  poolGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  poolGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  poolGeo.setIndex(indices);
  const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    toneMapped: false, uniforms: { nightAmount: NIGHT } };
  const pools = new THREE.Mesh(poolGeo, new THREE.ShaderMaterial({ ...common,
    vertexShader: `varying vec2 vUv; void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float nightAmount; varying vec2 vUv;
      void main() { float r=length((vUv-0.5)*2.0);
        float glow=exp(-r*r*3.8)*(1.0-smoothstep(0.65,1.0,r));
        gl_FragColor=vec4(1.0,0.51,0.17,glow*0.34*nightAmount); }`,
  }));
  pools.name = 'lamplight-pools';
  pools.layers.set(1); // light only: excluded from AO normals and bokeh depth
  group.add(pools);
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(bulbs,3));
  const haloScale = { value: 1 };
  const halos = new THREE.Points(haloGeo, new THREE.ShaderMaterial({ ...common,
    uniforms: { nightAmount: NIGHT, haloScale },
    vertexShader: `uniform float haloScale;
      void main() { vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(haloScale/max(1.0,-p.z),2.0,96.0); }`,
    fragmentShader: `uniform float nightAmount;
      void main() { float r=length((gl_PointCoord-0.5)*2.0);
        float glow=exp(-r*r*5.0)*(1.0-smoothstep(0.65,1.0,r));
        gl_FragColor=vec4(1.0,0.57,0.22,glow*0.32*nightAmount); }`,
  }));
  halos.name = 'streetlamp-halos';
  halos.layers.set(1);
  group.add(halos);
  const lights = Array.from({ length: Math.min(count, street.lamps.length) }, () => {
    const light = new THREE.PointLight(0xffc078, 0, 17, 2);
    group.add(light);
    return light;
  });
  return { group, pools, halos, lights, haloScale,
    dispose() { poolGeo.dispose(); haloGeo.dispose(); pools.material.dispose(); halos.material.dispose(); },
  };
}

export function createLighting({ scene, renderer, sun, hemi, skyUniforms, environments, vignette, bloom, quality, wake }) {
  let mode = document.documentElement.dataset.time === 'night' ? 'night' : 'day';
  let target = mode === 'night' ? 1 : 0;
  let lastUpdate = performance.now();
  NIGHT.value = target;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const button = document.getElementById('time-toggle');
  const colors = {};
  for (const key of ['zenith','horizon','ground','haze','key','sky','bounce']) {
    colors[key] = [new THREE.Color(DAY[key]), new THREE.Color(NIGHT_SCENE[key])];
  }
  let fixtures = null, lamps = [], emitters = [];
  const spotlights=createNightSpotlights(scene);
  const mix = key => THREE.MathUtils.lerp(DAY[key], NIGHT_SCENE[key], NIGHT.value);
  const tint = (color, key) => color.copy(colors[key][0]).lerp(colors[key][1], NIGHT.value);
  function syncButton() {
    document.documentElement.dataset.time = mode;
    document.querySelector('meta[name="theme-color"]').content = mode === 'night' ? '#19253b' : '#d7eaf5';
    button.setAttribute('aria-pressed', String(mode === 'night'));
    button.title = mode === 'night' ? 'Switch to daytime' : 'Switch to nighttime';
    button.querySelector('span').textContent = mode === 'night' ? 'Night' : 'Day';
  }
  function setMode(next, { persist = true } = {}) {
    if (next !== 'day' && next !== 'night') return;
    mode = next;
    target = mode === 'night' ? 1 : 0;
    lastUpdate = performance.now();
    if (reducedMotion.matches) NIGHT.value = target;
    if (persist) {
      try { localStorage.setItem('town-time', mode); } catch { /* storage unavailable */ }
      const url = new URL(location.href);
      url.searchParams.set('time', mode);
      history.replaceState(null, '', url);
    }
    syncButton();
    wake();
  }
  button.addEventListener('click', () => setMode(mode === 'day' ? 'night' : 'day'));
  syncButton();
  function refreshMaterials(street) {
    const materials = new Set();
    street.group.traverse(o => {
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
        if (!m.userData.surface && m.emissive?.getHex() && (m.userData.nightEmission || m.emissiveIntensity > 0)) materials.add(m);
      }
    });
    emitters = [...materials];
    for(const m of emitters)applyNightEmission(m,NIGHT.value);
    spotlights.refresh(street.group);
  }
  return {
    get mode() { return mode; }, setMode,
    get fixtures() { return fixtures; },
    refreshMaterials,
    attach(street) {
      if (fixtures) { scene.remove(fixtures.group); fixtures.dispose(); }
      spotlights.clear();
      lamps = street.lamps;
      fixtures = streetLighting(street, quality.memoryOptimized ? 3 : 6);
      scene.add(fixtures.group);
      refreshMaterials(street);
      button.hidden = false;
    },
    update(dt, camera, focus) {
      // Camera/smoke motion uses a capped frame delta. A UI fade should still
      // finish in 1.15 seconds when shader compilation or a slow GPU delays a
      // frame, rather than stretching across dozens of expensive frames.
      const now = performance.now();
      const step = Math.max(dt, (now - lastUpdate) / 1000) / 1.15;
      lastUpdate = now;
      NIGHT.value += Math.sign(target-NIGHT.value)*Math.min(Math.abs(target-NIGHT.value),step);
      // Request the next transition frame after this render's shader work.
      // A long compile must not consume the idle window before that request.
      if(NIGHT.value!==target)queueMicrotask(wake);
      const n = NIGHT.value;
      for (const key of ['zenith','horizon','ground']) tint(skyUniforms[key].value,key);
      skyUniforms.nightAmount.value = n;
      tint(scene.fog.color,'haze');
      tint(sun.color,'key'); sun.intensity = mix('keyIntensity');
      // Re-blur the cached shadow map once when crossing between day/night,
      // rather than redrawing the entire town on every transition frame.
      const shadowProfile = n < 0.5 ? DAY : NIGHT_SCENE;
      const shadowRadius = shadowProfile[quality.memoryOptimized ? 'shadowRadiusMobile' : 'shadowRadius'];
      if (sun.shadow.radius !== shadowRadius) {
        sun.shadow.radius = shadowRadius;
        renderer.shadowMap.needsUpdate = true;
      }
      tint(hemi.color,'sky'); tint(hemi.groundColor,'bounce'); hemi.intensity = mix('fill');
      scene.environment = n < 0.5 ? environments.day : environments.night;
      scene.environmentIntensity = mix('environment');
      renderer.toneMappingExposure = mix('exposure');
      for (const key of ['saturation','contrast','lift']) vignette.uniforms[key].value = mix(key);
      vignette.uniforms.warmth.value = 0.03*(1-n);
      vignette.uniforms.strength.value = 0.22+0.08*n;
      if (bloom) { bloom.strength = mix('bloom'); bloom.threshold = mix('threshold'); }
      for (const m of emitters) applyNightEmission(m,n);
      spotlights.update(n,focus);
      if (fixtures) {
        fixtures.pools.visible = fixtures.halos.visible = n > 0;
        fixtures.haloScale.value = renderer.domElement.height*camera.projectionMatrix.elements[5]*1.6;
        const nearest = [...lamps].sort((a,b) => a.distanceToSquared(focus)-b.distanceToSquared(focus));
        fixtures.lights.forEach((light,i) => { light.position.copy(nearest[i]); light.intensity = n*42; });
      }
    },
  };
}
