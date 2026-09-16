// Shared diorama building blocks: materials, rounded primitives, roofs laid
// in tile rows, windows, trees, walls, tufts and small props. Used by the site
// generator (site.js) and the blueprint renderer (blueprint.js). Visual
// direction: Tiny Glade — soft, rounded, a little wobbly.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from './palette.js';
import { fbm } from './noise.js';
import { surfaceMaterial, frameGeometry } from './materials.js';

const matCache = new Map();

export function mat(color, opts = {}) {
  const key = typeof color === 'number' && Object.keys(opts).length === 0 ? color : null;
  if (key !== null && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    ...opts,
  });
  if (key !== null) matCache.set(key, m);
  return m;
}

// Painterly grain: a faint world-space noise over every baked surface, so a
// flat vertex colour reads as plaster, asphalt or turf rather than vector fill,
// and colour interpolated across the long triangles of a draped slab (which
// showed as soft facets) is broken up. Two octaves of a cheap hash noise, no
// texture and no UVs; a function of world position alone, so it is seamless
// across every ribbon, slab and instance. GRAIN.value is the amplitude (0 off);
// `window.__town.grain` in the console.
export const GRAIN = { value: 0.025 };
export function grainy(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.grainAmount = GRAIN;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrainPos;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 gp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            gp = instanceMatrix * gp;
          #endif
          vGrainPos = (modelMatrix * gp).xyz; }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float grainAmount; varying vec3 vGrainPos;
        float gHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float gNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float g = gNoise(vGrainPos * 5.0) * 0.55 + gNoise(vGrainPos * 21.0) * 0.45;
          diffuseColor.rgb *= 1.0 + (g - 0.5) * grainAmount * 2.0; }`);
  };
  material.customProgramCacheKey = () => 'grain';
  return material;
}

// Shared material for anything carrying its own vertex / instance colors
export const vmat = grainy(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, vertexColors: true }));

export const imat = grainy(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }));

// Box geometries are shared by size: a town has thousands of boxes but only a
// few hundred distinct sizes, and RoundedBoxGeometry is slow to build (it spends
// most of its time on UVs nothing here uses). Nothing mutates these — the bake
// reads them in place and the mesh carries the transform.
const boxCache = new Map();
function cachedGeometry(key, make) {
  let g = boxCache.get(key);
  if (!g) { g = make(); boxCache.set(key, g); }
  return g;
}
const dim = (v) => Math.round(v * 1e4) / 1e4;

export function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const geo = cachedGeometry(`b|${dim(w)}|${dim(h)}|${dim(d)}`, () => new THREE.BoxGeometry(w, h, d));
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
}

export function rbox(w, h, d, color, r = 0.08, x = 0, y = 0, z = 0) {
  const rr = Math.min(r, w / 2, h / 2, d / 2);
  // RoundedBoxGeometry is non-indexed: 900 vertices at 2 segments, 324 at 1.
  // Thousands of window frames and sills use this with a 3–5 cm radius that
  // never shows a facet at diorama scale, so only a big radius gets 2 segments.
  const geo = cachedGeometry(`r|${dim(w)}|${dim(h)}|${dim(d)}|${dim(rr)}`, () => new RoundedBoxGeometry(w, h, d, rr >= 0.1 ? 2 : 1, rr));
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
}

export function jitterColor(rng, base, amount = 0.05, hue = 0.012) {
  const c = new THREE.Color(base);
  c.offsetHSL(rng.range(-hue, hue), rng.range(-amount, amount), rng.range(-amount, amount));
  return c;
}

// Handmade feel: nothing stands perfectly straight or perfectly to scale.
export function wobble(obj, rng, rot = 0.05, scale = 0.07) {
  obj.rotation.x += rng.range(-rot, rot);
  obj.rotation.z += rng.range(-rot, rot);
  obj.scale.multiplyScalar(1 + rng.range(-scale, scale));
}

export const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

// Soft 0..1 membership of (x,z) in rect r with a feathered edge
export function softRect(r, x, z, feather) {
  const dx = Math.min(x - r.x0, r.x1 - x);
  const dz = Math.min(z - r.z0, r.z1 - z);
  const d = Math.min(dx, dz);
  return THREE.MathUtils.clamp((d + feather) / (feather * 2), 0, 1);
}

// Per-vertex color helper: writes a Float32 color attribute onto a geometry
export function paintVertices(geo, fn) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (nrm) n.fromBufferAttribute(nrm, i);
    fn(v, n, c, i);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// A gable roof built as a dark soffit wedge with rows of tiles laid on both
// slopes, each row nudged and tinted a touch differently, plus a ridge cap.
export function gableRoof(rng, span, length, h, color, overhang = 0.55, opts = {}) {
  const g = new THREE.Group();
  const s = span / 2 + overhang;
  const len = length + overhang * 2;
  // The soffit wedge can be kept flush with the walls (bodyOverhang 0) so a
  // wall-coloured gable end shows while the tiles still overhang.
  const bodyLen = length + 2 * (opts.bodyOverhang ?? overhang);

  // Soffit / body
  const shape = new THREE.Shape();
  shape.moveTo(-s, -0.02);
  shape.lineTo(s, -0.02);
  shape.lineTo(0, h);
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: bodyLen, bevelEnabled: false });
  bodyGeo.translate(0, 0, -bodyLen / 2);
  bodyGeo.rotateY(Math.PI / 2); // ridge along x, slopes face ±z
  const bodyCol = new THREE.Color(color).offsetHSL(0, -0.05, -0.12);
  g.add(new THREE.Mesh(bodyGeo, mat(bodyCol.getHex())));

  // Two continuous slopes with filtered shingle courses. This replaces the
  // long raised strips and keeps roof detail out of the geometry budget.
  for (const side of [1, -1]) {
    g.add(roofPanel(len, s, 0, 0, h, side, color));
    g.add(rbox(len, 0.09, 0.13, color, 0.025, 0, 0, side * s));
  }
  const capColor = new THREE.Color(color).lerp(new THREE.Color(P.trim), 0.12).getHex();
  g.add(rbox(len + 0.08, 0.14, 0.25, capColor, 0.055, 0, h + 0.035, 0));

  return g;
}

// One outward-facing roof slope, also used by the four gambrel slopes.
export function roofPanel(length, z0, y0, z1, y1, side, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -length/2,y0,side*z0, length/2,y0,side*z0,
    length/2,y1,side*z1, -length/2,y1,side*z1,
  ],3));
  geo.setIndex(side > 0 ? [0,1,2,0,2,3] : [0,2,1,0,3,2]);
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const p = geo.attributes.position;
  for (let i=0;i<p.count;i++) p.setXYZ(i,p.getX(i)+n.getX(i)*0.045,p.getY(i)+n.getY(i)*0.045,p.getZ(i)+n.getZ(i)*0.045);
  const mesh = new THREE.Mesh(geo,surfaceMaterial('shingles',color));
  mesh.name = 'roof-shingles';
  return mesh;
}

export function pyramidRoof(rng, spanX, spanZ, h, color, overhang = 0.55) {
  const g = new THREE.Group();
  const sx = spanX / 2 + overhang;
  const sz = spanZ / 2 + overhang;
  const geo = new THREE.ConeGeometry(Math.SQRT2, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.Mesh(geo, mat(new THREE.Color(color).offsetHSL(0, -0.02, -0.03).getHex()));
  mesh.scale.set(sx, h, sz);
  g.add(mesh);
  // Horizontal tile bands: stacked, shrinking pyramid rings suggest tile rows
  const rows = Math.max(3, Math.round(Math.hypot(Math.min(sx, sz), h) / 0.5));
  for (let r = 0; r < rows; r++) {
    const u = (r + 0.35) / rows;
    const band = new THREE.Mesh(geo, mat(jitterColor(rng, color, 0.04).getHex()));
    band.scale.set(sx * (1 - u) + 0.08, 0.09, sz * (1 - u) + 0.08);
    band.position.y = h * u;
    g.add(band);
  }
  // Finial
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(P.roofRidge));
  knob.position.y = h + 0.05;
  g.add(knob);
  return g;
}

export const glowMat = surfaceMaterial('glass', P.windowGlass);

export function buildWindow(rng, w, h, withBox = false) {
  const g = new THREE.Group();
  // Local -z is the outward side. The open frame projects beyond the glass;
  // mullions and the sill catch light in front of its recessed pane.
  // Every layer gets a clear standoff (≥ 3 cm) so nothing z-fights, even
  // at the depth precision of a 400 m scene.
  const frame = new THREE.Mesh(frameGeometry([[-w/2-0.1,-h/2-0.1],[w/2+0.1,-h/2-0.1],[w/2+0.1,h/2+0.1],[-w/2-0.1,h/2+0.1]], [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]), mat(P.timber));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), glowMat);
  glass.position.z = -0.04;
  const sill = rbox(w + 0.36, 0.1, 0.2, P.trim, 0.03, 0, -h / 2 - 0.1, -0.1);
  const mullV = box(0.06, h, 0.05, P.timber, 0, 0, -0.135);
  const mullH = box(w, 0.06, 0.05, P.timber, 0, h * 0.1, -0.135);
  g.add(frame, glass, sill, mullV, mullH);
  if (withBox) {
    // Window box with a few blooms
    g.add(rbox(w + 0.1, 0.22, 0.24, P.timber, 0.05, 0, -h / 2 - 0.02, -0.14));
    for (let i = 0; i < 3; i++) {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), mat(rng.pick(P.flowers)));
      head.position.set(-w / 3 + (i * w) / 3, -h / 2 + 0.16, -0.16);
      g.add(head);
    }
  }
  return g;
}

export function buildChimney(rng, roofH, H, x, z) {
  const g = new THREE.Group();
  g.userData.keep = true; // bake: keep this group as the frame the smoke animates in
  const ch = roofH + 1.2;
  g.add(rbox(0.6, ch, 0.6, P.chimney, 0.05, x, H + ch / 2 - 0.5, z));
  g.add(rbox(0.76, 0.14, 0.76, P.roofRidge, 0.04, x, H + ch - 0.5 + 0.05, z));
  // Smoke emitter: a few soft puffs the viewer animates upward
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshStandardMaterial({ color: P.smoke, emissive: P.smoke, emissiveIntensity: 0.6, roughness: 1, transparent: true, opacity: 0.4, depthWrite: false })
    );
    m.castShadow = false;
    m.receiveShadow = false;
    m.position.set(x, H + ch - 0.4, z);
    g.add(m);
    puffs.push({ mesh: m, t: i / 4, speed: rng.range(0.16, 0.24), drift: rng.range(-0.25, 0.25) });
  }
  return { group: g, emitter: { baseY: H + ch - 0.4, x, z, puffs } };
}

// ---------------------------------------------------------------------------
// Trees
//
// Tiny Glade canopies read as one soft, fluffy mass with lobes in it, not a
// stack of spheres. Each canopy here is a single closed surface: an icosphere
// pushed outward where a dozen random leaf clumps sit, squashed into a cushion,
// with the normals eased toward the sphere's own so the clumps shade as soft
// swells rather than separate balls. One surface also means no inner seams: the
// blurred VSM shadow map painted a dark splotch across every place two puffs of
// the old canopies met. Vertex colours carry most of the light: sunny tops,
// cool undersides, crevices between clumps a shade darker, and a little colour
// drift from clump to clump.

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();

// Unit icosphere with shared vertices (smooth normals) and no UV seam. Welding
// the vertices is the slow part (a string key per vertex), so one welded sphere
// per detail level is kept and each canopy starts from a copy of it.
const icoCache = new Map();
// Clear construction lookup tables without disposing geometry/materials that
// the finished scene may still share (especially mobile instance batches).
export function clearConstructionCaches() {
  boxCache.clear();
  icoCache.clear();
  matCache.clear();
}
function icosphere(detail) {
  let g = icoCache.get(detail);
  if (!g) {
    g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g);
    icoCache.set(detail, g);
  }
  return g.clone();
}

// Legacy puff, still used by the random street's hedges and yards
export function canopyPuff(rng, r, green) {
  const geo = new THREE.SphereGeometry(r, 12, 9);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const seed = rng.range(0, 100);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + (fbm(v.x * 1.6 + seed, v.y * 1.6 + v.z * 1.6) - 0.5) * 0.28;
    pos.setXYZ(i, v.x * k, v.y * k * 0.9, v.z * k);
  }
  geo.computeVertexNormals();
  const top = new THREE.Color(green);
  const shade = new THREE.Color(P.treeShade);
  paintVertices(geo, (p, n, c) => {
    const t = THREE.MathUtils.clamp((n.y + 0.55) / 1.4, 0, 1);
    c.copy(shade).lerp(top, t);
  });
  return geo;
}

// The canopy's shape as a function: a unit direction goes in, the point on the
// lobed surface comes out (radius r, height r*squash, the underside pulled in
// to `bottom` of the radius so it is a cushion, flatter below than above).
// `lobes` gentle swells of relative depth `amp` shape it, with a crowd of small
// bumps riding on them. Kept gentle: Tiny Glade's trees are big soft eggs and
// balls, and heavy lobing made ours read as small, dark and busy.
export function lobedSurface(rng, { r, squash, lobes, amp, bottom = 0.72, bumps = true }) {
  const clump = (n, sMin, sMax, wMin, wMax) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const d = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.45, 1), rng.range(-1, 1)).normalize(); // more of them on top
      const sg = rng.range(sMin, sMax);
      // exp(-θ²/σ²) written with the dot product (1 - cos θ ≈ θ²/2): no acos in the inner loop
      out.push({ d, k2: 2 / (sg * sg), cut: Math.cos(Math.min(Math.PI, sg * 2.6)), w: rng.range(wMin, wMax), hue: rng.range(-0.014, 0.014), light: rng.range(-0.04, 0.04) });
    }
    return out;
  };
  const big = clump(lobes, 0.42, 0.65, 0.7, 1);
  const small = bumps ? clump(rng.int(40, 60), 0.2, 0.3, 0.6, 1) : [];
  const seed = rng.range(0, 100);
  // info (optional) receives bump (0 crevice .. 1 crest), fine, nearest swell
  const point = (v, out, info = null) => {
    // the surface follows the nearest swell (a sum would fill the crevices
    // between them and leave a balloon), with a little of its neighbours
    let s = 0, best = 0, nearest = 0;
    for (let k = 0; k < big.length; k++) {
      const c = big[k], dt = v.dot(c.d);
      if (dt < c.cut) continue;
      const f = c.w * Math.exp(-(1 - dt) * c.k2);
      s += f;
      if (f > best) { best = f; nearest = k; }
    }
    let sf = 0;
    for (let k = 0; k < small.length; k++) {
      const c = small[k], dt = v.dot(c.d);
      if (dt < c.cut) continue;
      sf = Math.max(sf, c.w * Math.exp(-(1 - dt) * c.k2));
    }
    const b = THREE.MathUtils.clamp(best * 0.85 + s * 0.15, 0, 1), f = THREE.MathUtils.clamp(sf, 0, 1);
    if (info) { info.bump = b; info.fine = f; info.nearest = nearest; }
    const k = 1 - amp + amp * b + f * amp * 0.25 + (fbm(v.x * 3 + seed, v.y * 3 + v.z * 2.3) - 0.5) * 0.03;
    const y = v.y < 0 ? v.y * bottom : v.y;
    return out.set(v.x * k * r, y * k * r * squash, v.z * k * r);
  };
  // shading normal: eased most of the way to the plain sphere's, so the
  // whole canopy lights like one soft volume
  const eased = (trueN, dir, out) => {
    out.copy(dir);
    out.y /= squash;
    out.normalize();
    return out.lerp(trueN, 0.4).normalize();
  };
  // the lit colour at a shading normal: high-key, the upper two thirds sunny,
  // only the underside cool, a little colour drift from swell to swell
  const top = new THREE.Color(P.treeGreens[0]), sh = new THREE.Color(P.treeShade);
  const setGreen = (green, shade = P.treeShade) => { top.set(green).offsetHSL(-0.01, 0.02, 0.06); sh.set(shade); };
  const shadeAt = (n, info, c) => {
    const t = THREE.MathUtils.clamp((n.y + 0.9) / 1.6, 0, 1);
    const cl = big[info.nearest];
    c.copy(sh).lerp(top, t);
    c.offsetHSL(cl.hue, 0, cl.light - (1 - info.bump) * 0.04 + t * 0.02);
    return t;
  };
  return { r, squash, point, eased, shadeAt, setGreen };
}

// The canopy core: an icosphere laid onto the lobed surface. `detail` is
// three's icosahedron subdivision, (detail+1)² triangles per face: 8 is ~800
// vertices, 12 ~1700. Mostly hidden under the dabs, so it is painted a shade
// deeper and reads as the shadowed inside of the foliage in the gaps.
export function canopyCore(rng, surf, detail, green) {
  const geo = icosphere(detail);
  const pos = geo.attributes.position;
  const infos = [];
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    const info = {};
    surf.point(_v, _p, info);
    infos.push(info);
    pos.setXYZ(i, _p.x, _p.y, _p.z);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    _n.fromBufferAttribute(nrm, i);
    _v.fromBufferAttribute(pos, i);
    _v.y /= surf.squash;
    surf.eased(_n, _v.normalize(), _q);
    nrm.setXYZ(i, _q.x, _q.y, _q.z);
  }
  surf.setGreen(green);
  paintVertices(geo, (p, n, c, i) => { surf.shadeAt(n, infos[i], c); c.offsetHSL(0, 0, -0.05); });
  return geo;
}

// The brushed look: `count` leaf-cluster dabs scattered over the lobed surface,
// each a small irregular disc lying almost flat on it, turned at random and
// tilted a little, lifted a hair so they layer. A dab takes its shading normal
// from the canopy (eased toward the sphere), only slightly bent toward its own
// facing, so the hundreds of dabs still light as one soft ball while each
// stroke shows a touch differently; per-dab colour jitter and a lighter centre
// give the stippled, hand-painted surface, and the dabs standing proud at the
// edge give the outline its fuzz. Opaque geometry, no alpha and no texture, so
// the ambient-occlusion and depth passes see exactly what the eye sees.
export function canopyDabs(rng, surf, { count, size, green, stride = 1 }) {
  const { r, squash } = surf;
  const RIM = 6;
  const kept = Math.ceil(count / stride);
  const pos = new Float32Array(kept * (RIM + 1) * 3), nor = new Float32Array(kept * (RIM + 1) * 3), col = new Float32Array(kept * (RIM + 1) * 3);
  const idx = new Uint32Array(kept * RIM * 3);
  const d = new THREE.Vector3(), p = new THREE.Vector3(), pu = new THREE.Vector3(), pv = new THREE.Vector3(), n = new THREE.Vector3();
  const u = new THREE.Vector3(), v = new THREE.Vector3(), q = new THREE.Vector3(), face = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), vn = new THREE.Vector3();
  const c = new THREE.Color(), info = {};
  surf.setGreen(green);
  let vo = 0, io = 0;
  for (let i = 0; i < count; i++) {
    do d.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)); while (d.lengthSq() < 0.05 || d.lengthSq() > 1);
    if (i % stride) {
      // Consume the same draws as a full dab: direction rejection above,
      // eight shape/colour draws below, and two draws per rim vertex. The
      // next tree, car, and garden must stay put when changing quality.
      for (let j = 0; j < 8 + 2 * RIM; j++) rng.next();
      continue;
    }
    d.normalize();
    surf.point(d, p, info);
    // the surface's tangent frame and true normal, by finite differences
    u.set(-d.z, 0, d.x);
    if (u.lengthSq() < 1e-4) u.set(1, 0, 0);
    u.normalize();
    v.crossVectors(d, u).normalize();
    surf.point(q.copy(d).addScaledVector(u, 0.02).normalize(), pu);
    surf.point(q.copy(d).addScaledVector(v, 0.02).normalize(), pv);
    n.crossVectors(pu.sub(p), pv.sub(p)).normalize();
    if (n.dot(d) < 0) n.negate();
    surf.eased(n, d, n);
    // the dab's own facing: the canopy normal tilted a little at random
    face.copy(n).addScaledVector(u, rng.range(-0.35, 0.35)).addScaledVector(v, rng.range(-0.35, 0.35)).normalize();
    e1.copy(u).addScaledVector(face, -u.dot(face)).normalize();
    e2.crossVectors(face, e1);
    const rot = rng.range(0, Math.PI * 2), cr = Math.cos(rot), sr = Math.sin(rot);
    const a = size * r * rng.range(0.8, 1.25), b = a * rng.range(0.6, 0.85);
    p.addScaledVector(n, r * rng.range(0, 0.06));
    vn.copy(n).lerp(face, 0.35).normalize();
    const t = surf.shadeAt(n, info, c);
    c.offsetHSL(rng.range(-0.012, 0.012), 0, rng.range(-0.07, 0.07) + t * 0.02);
    const base = vo / 3;
    // a shallow dome: the heart of the stroke stands a little proud of its rim
    q.copy(p).addScaledVector(face, a * 0.22);
    pos[vo] = q.x; pos[vo + 1] = q.y; pos[vo + 2] = q.z;
    nor[vo] = vn.x; nor[vo + 1] = vn.y; nor[vo + 2] = vn.z;
    col[vo] = Math.min(1, c.r * 1.06); col[vo + 1] = Math.min(1, c.g * 1.06); col[vo + 2] = Math.min(1, c.b * 1.06); // a lighter heart to each stroke
    vo += 3;
    for (let k = 0; k < RIM; k++) {
      const ang = (k / RIM) * Math.PI * 2 + rng.range(-0.2, 0.2), rr = rng.range(0.72, 1.25);
      const x = Math.cos(ang) * a * rr, y = Math.sin(ang) * b * rr;
      const ex = x * cr - y * sr, ey = x * sr + y * cr; // turned in the plane
      pos[vo] = p.x + e1.x * ex + e2.x * ey; pos[vo + 1] = p.y + e1.y * ex + e2.y * ey; pos[vo + 2] = p.z + e1.z * ex + e2.z * ey;
      nor[vo] = vn.x; nor[vo + 1] = vn.y; nor[vo + 2] = vn.z;
      col[vo] = c.r; col[vo + 1] = c.g; col[vo + 2] = c.b;
      vo += 3;
    }
    for (let k = 0; k < RIM; k++) { idx[io++] = base; idx[io++] = base + 1 + k; idx[io++] = base + 1 + ((k + 1) % RIM); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// A fir as one continuous skirted surface: a cone whose radius swells to a
// drooping hem at the foot of each tier and tucks in above it, lumpy around
// the rim, so the tiers read as soft boughs rather than stacked cones (and
// there is no seam for the shadow blur to catch on). Pale new growth on the
// hem tips, darker in the tuck under each bough.
export function coniferGeometry(rng, h, r0, tiers, segs = 20) {
  const rows = tiers * 8, seed = rng.range(0, 100);
  const pos = [], idx = [], info = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    for (let i = 0; i < segs; i++) {
      const th = (i / segs) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
      const ph = t * tiers + (fbm(cs * 1.3 + seed, sn * 1.3) - 0.5) * 0.5; // hems wander, so none is a level ring
      const u = ph - Math.floor(ph); // 0 at a hem .. 1 tucked in under the bough above
      const skirt = 0.66 + 0.44 * Math.pow(1 - u, 1.6);
      const lump = 1 + (fbm(cs * 2.2 + seed + 7, sn * 2.2 + t * 5) - 0.5) * 0.16;
      const r = j === rows ? 0 : r0 * Math.pow(1 - t, 0.92) * skirt * lump;
      const droop = -0.1 * r0 * Math.pow(1 - u, 3) * (1 - t);
      pos.push(cs * r, t * h + droop, sn * r);
      info.push(t, u);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * segs + i, a1 = j * segs + (i + 1) % segs, b = a + segs, b1 = a1 + segs;
      idx.push(a, b, a1, a1, b, b1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal, p = geo.attributes.position;
  const L = Math.hypot(h, r0);
  for (let i = 0; i < p.count; i++) {
    _n.fromBufferAttribute(nrm, i);
    const th = ((i % segs) / segs) * Math.PI * 2;
    _v.set(Math.cos(th) * h / L, r0 / L, Math.sin(th) * h / L); // the plain cone's normal
    _n.lerp(_v, 0.4).normalize();
    nrm.setXYZ(i, _n.x, _n.y, _n.z);
  }
  const base = new THREE.Color(P.conifer), light = new THREE.Color(P.coniferLight), tip = new THREE.Color(P.coniferTip);
  paintVertices(geo, (pp, n, c, i) => {
    const t = info[i * 2], u = info[i * 2 + 1];
    c.copy(base).lerp(light, THREE.MathUtils.clamp(t * 0.6 + (1 - u) * 0.25, 0, 1));
    c.lerp(tip, Math.pow(1 - u, 6) * 0.5);
    c.offsetHSL(0, 0, -u * 0.08 + n.y * 0.04);
  });
  return geo;
}

// A trunk that tapers and flares at the root, with a few branch stubs reaching
// up into the canopy so its underside is not an empty dome.
function buildTrunk(rng, h, r0, bark, branches, reach) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.62, r0, h, 8), mat(bark));
  trunk.position.y = h / 2;
  g.add(trunk);
  const root = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 1.02, r0 * 1.5, 0.28, 8), mat(bark));
  root.position.y = 0.14;
  g.add(root);
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  for (let i = 0; i < branches; i++) {
    const len = reach * rng.range(0.6, 0.95);
    const geo = new THREE.CylinderGeometry(r0 * 0.2, r0 * 0.45, len, 6);
    geo.translate(0, len / 2, 0);
    const br = new THREE.Mesh(geo, mat(bark));
    const ang = (i / branches) * Math.PI * 2 + rng.range(-0.5, 0.5), tilt = rng.range(0.5, 0.9);
    dir.set(Math.sin(tilt) * Math.cos(ang), Math.cos(tilt), Math.sin(tilt) * Math.sin(ang));
    br.quaternion.setFromUnitVectors(up, dir);
    br.position.y = h - 0.15;
    g.add(br);
  }
  return g;
}

// opts.big: a tree that will be scaled up (the park's shade trees) gets a
// finer canopy mesh. Species: round (maple), tall oval (elm, oak) or low
// spreading (apple, hawthorn); about a fifth are firs.
export function buildTree(rng, opts = {}) {
  const g = new THREE.Group();
  const big = !!opts.big;
  const light = !!opts.lowDetail;
  if (rng.chance(0.22)) {
    const h = rng.range(3.2, 4.6), r0 = rng.range(0.95, 1.25);
    const cone = new THREE.Mesh(coniferGeometry(rng, h, r0, rng.int(5, 7), light ? 12 : big ? 28 : 20), vmat);
    cone.position.y = 0.5;
    g.add(cone);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.9, 7), mat(rng.pick(P.barks)));
    trunk.position.y = 0.45;
    g.add(trunk);
  } else {
    // big soft volumes: an egg (taller than wide) or a ball, sitting low on a
    // slim trunk that shows for about a third of the canopy's height
    const kind = rng.pick(['egg', 'egg', 'ball', 'spreading', 'ball']);
    const r = kind === 'egg' ? rng.range(1.35, 1.7) : rng.range(1.5, 1.9);
    const squash = kind === 'egg' ? rng.range(1.15, 1.4) : kind === 'spreading' ? rng.range(0.72, 0.85) : rng.range(0.9, 1.05);
    const trunkH = kind === 'egg' ? rng.range(1.1, 1.6) : rng.range(1.3, 1.8);
    const green = jitterColor(rng, rng.pick(P.treeGreens), 0.03, 0.01).getHex();
    const surf = lobedSurface(rng, { r, squash, lobes: rng.int(8, 12), amp: rng.range(0.12, 0.18) });
    const canopy = new THREE.Group();
    canopy.add(new THREE.Mesh(canopyCore(rng, surf, light ? (big ? 5 : 3) : big ? 12 : 8, green), vmat));
    // dab size relative to the radius; enough of them to cover the surface
    // about 1.5 times over, so the core only shows in the gaps
    const size = big ? 0.11 : 0.15;
    canopy.add(new THREE.Mesh(canopyDabs(rng, surf, {
      count: Math.round((4 / (size * size * 0.7)) * 1.5), size: size * (light ? 2 : 1), green, stride: light ? 4 : 1,
    }), vmat));
    canopy.position.y = trunkH + r * squash * 0.76;
    canopy.position.x = r * (kind === 'egg' ? 0.06 : -0.08);
    canopy.scale.set(kind === 'spreading' ? 1.2 : 1.06, 1, 0.94);
    canopy.rotation.y = rng.range(0, Math.PI * 2);
    g.add(canopy);
    g.add(buildTrunk(rng, trunkH + 0.4, big ? 0.17 : 0.14, rng.pick(P.barks), rng.int(2, 4), r * 0.8));
  }
  g.rotation.y = rng.range(0, Math.PI * 2);
  g.scale.setScalar(rng.range(0.85, 1.15));
  wobble(g, rng, 0.03, 0);
  return g;
}

export function buildBush(rng) {
  const g = new THREE.Group();
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.3, 0.55);
    const col = rng.chance(0.4) ? P.hedgeLight : P.hedge;
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), mat(jitterColor(rng, col, 0.04).getHex()));
    b.position.set(rng.range(-0.35, 0.35), r * 0.7 + rng.range(-0.05, 0.1), rng.range(-0.25, 0.25));
    b.scale.y = 0.85;
    g.add(b);
  }
  return g;
}

// A hedge as a row of overlapping soft blobs
export function buildHedge(rng, a, b, z) {
  const g = new THREE.Group();
  for (let x = a + 0.3; x < b - 0.1; x += 0.55) {
    const r = rng.range(0.42, 0.55);
    const col = rng.chance(0.35) ? P.hedgeLight : P.hedge;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), mat(jitterColor(rng, col, 0.03).getHex()));
    m.position.set(x + rng.range(-0.06, 0.06), r * 0.8, z + rng.range(-0.08, 0.08));
    m.scale.set(1.15, 1, 1);
    g.add(m);
  }
  return g;
}

// Dry-stone garden wall from x=a to x=b along z, two staggered courses
export const stoneGeo = new RoundedBoxGeometry(0.56, 0.3, 0.44, 1, 0.11);

export function buildStoneWall(rng, a, b, z, courses = 2) {
  const len = b - a;
  const per = Math.max(1, Math.round(len / 0.5));
  const mesh = new THREE.InstancedMesh(stoneGeo, imat, per * courses + courses);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let i = 0;
  for (let c = 0; c < courses; c++) {
    const off = c % 2 ? 0.25 : 0;
    for (let k = 0; k <= per; k++) {
      const x = a + ((k + off) / per) * len;
      if (x < a - 0.1 || x > b + 0.1) continue;
      p.set(x + rng.range(-0.03, 0.03), 0.16 + c * 0.27 + rng.range(-0.015, 0.015), z + rng.range(-0.03, 0.03));
      e.set(rng.range(-0.06, 0.06), rng.range(-0.12, 0.12), rng.range(-0.06, 0.06));
      q.setFromEuler(e);
      sc.set(rng.range(0.8, 1.15), rng.range(0.85, 1.1), rng.range(0.85, 1.1));
      m4.compose(p, q, sc);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, jitterColor(rng, rng.pick(P.stones), 0.03, 0.006));
      i++;
    }
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Grass tufts: a little three-blade clump, instanced across a region
const tuftGeo = (() => {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.ConeGeometry(0.075, 0.5, 4);
    c.translate(0, 0.25, 0);
    const a = (i / 3) * Math.PI * 2;
    c.rotateX(Math.cos(a) * 0.35);
    c.rotateZ(Math.sin(a) * 0.35);
    parts.push(c);
  }
  return mergeGeometries(parts);
})();

export function scatterTufts(rng, count, sample, blocked, { stride = 1 } = {}) {
  const mesh = new THREE.InstancedMesh(tuftGeo, imat, Math.ceil(count / stride));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const light = new THREE.Color(P.grassLight);
  const dark = new THREE.Color(P.grass);
  let i = 0, written = 0;
  for (let tries = 0; tries < count * 3 && i < count; tries++) {
    const [x, z] = sample();
    if (blocked(x, z)) continue;
    p.set(x, 0.02, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2));
    const s = rng.range(0.7, 1.3);
    sc.set(s, s * rng.range(0.8, 1.3), s);
    m4.compose(p, q, sc);
    const color = dark.clone().lerp(light, rng.range(0.2, 1));
    if (i % stride === 0) {
      mesh.setMatrixAt(written, m4);
      mesh.setColorAt(written++, color);
    }
    i++;
  }
  mesh.count = written;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.userData.keep = true;        // bake: stays one instanced draw
  mesh.userData.castShadow = false; // thousands of tiny cones aren't worth a shadow pass
  return mesh;
}

// Wildflower heads dotted through the grass: one instanced draw of a stem
// with a small head, in meadow colours (clover white, buttercup, a little
// pink), at the spots handed in ([x, y, z, scale] each). The geometry carries
// its own colours (green stem, white head) and the instance colour tints them,
// so it draws under the shared vertex-colour material; kept as one instance
// batch like the tufts.
const flowerGeo = (() => {
  const stem = new THREE.CylinderGeometry(0.014, 0.02, 0.26, 4);
  stem.translate(0, 0.13, 0);
  const head = new THREE.SphereGeometry(0.075, 6, 4);
  head.scale(1, 0.8, 1);
  head.translate(0, 0.29, 0);
  const green = new THREE.Color(P.hedge);
  paintVertices(stem, (p, n, c) => c.copy(green));
  paintVertices(head, (p, n, c) => c.setRGB(1, 1, 1));
  return mergeGeometries([stem, head]);
})();
export function scatterFlowers(rng, spots) {
  const mesh = new THREE.InstancedMesh(flowerGeo, vmat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const meadow = [0xf6f1e4, 0xf6f1e4, 0xf1d76b, 0xf1d76b, 0xe9a3b8, 0xd8c8ee, 0xf3ede0];
  spots.forEach(([x, y, z, s], i) => {
    p.set(x, y, z);
    q.setFromAxisAngle(_v.set(0, 1, 0), rng.range(0, Math.PI * 2));
    sc.set(s, s * rng.range(0.8, 1.15), s);
    m4.compose(p, q, sc);
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, jitterColor(rng, rng.pick(meadow), 0.04, 0.01));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.userData.keep = true;
  mesh.userData.castShadow = false;
  return mesh;
}

export function buildFlowerCluster(rng, n) {
  const g = new THREE.Group();
  const colA = rng.pick(P.flowers);
  const colB = rng.pick(P.flowers);
  for (let i = 0; i < n; i++) {
    const h = rng.range(0.22, 0.38);
    const x = rng.range(-0.45, 0.45);
    const z = rng.range(-0.35, 0.35);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, h + 0.1, 4), mat(P.hedge));
    stem.position.set(x, h / 2, z);
    g.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(rng.range(0.07, 0.11), 7, 6), mat(rng.chance(0.6) ? colA : colB));
    head.position.set(x, h + 0.04, z);
    head.scale.y = 0.8;
    g.add(head);
  }
  return g;
}

export function buildPebbles(rng, n, cx, cz, spread) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.08, 0.18);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat(rng.pick(P.stones)));
    m.scale.set(1, 0.55, rng.range(0.7, 1.2));
    m.rotation.y = rng.range(0, 3);
    m.position.set(cx + rng.range(-spread, spread), r * 0.4, cz + rng.range(-spread, spread));
    g.add(m);
  }
  return g;
}

let lampPoleGeometry, lampBulbGeometry, lampBulbMaterial;
export function buildLamp(rng) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(lampPoleGeometry ||= new THREE.CylinderGeometry(0.07, 0.1, 3.4, 7), mat(P.lampPole));
  pole.position.y = 1.7;
  g.add(pole);
  g.add(rbox(0.9, 0.09, 0.09, P.lampPole, 0.04, 0.42, 3.4, 0));
  const head = new THREE.Mesh(
    lampBulbGeometry ||= new RoundedBoxGeometry(0.42, 0.22, 0.26, 2, 0.08),
    lampBulbMaterial ||= new THREE.MeshStandardMaterial({ color: P.lampGlow, emissive: P.lampGlow, emissiveIntensity: 1.6, roughness: 0.7 })
  );
  head.position.set(0.82, 3.34, 0);
  head.name = 'streetlamp-bulb';
  // The baker can instance these identical opaque emitters without changing
  // their material. Keep one bulb mesh instead of expanding it per fixture.
  head.userData.instanceSharedMaterial = true;
  g.add(head);
  g.add(rbox(0.5, 0.06, 0.34, P.lampPole, 0.02, 0.82, 3.48, 0));
  wobble(g, rng, 0.015, 0);
  return g;
}

// Slatted park bench with dark iron ends; faces -z
export function buildBench(rng) {
  const g = new THREE.Group();
  const wood = jitterColor(rng, 0x8b6a45, 0.05), iron = 0x3d4a3f;
  for (const sx of [-0.7, 0.7]) {
    g.add(box(0.08, 0.42, 0.42, iron, sx, 0.21, 0));         // leg/side
    g.add(box(0.08, 0.42, 0.07, iron, sx, 0.62, 0.2));        // back post
  }
  for (let i = 0; i < 3; i++) g.add(rbox(1.6, 0.05, 0.13, wood, 0.02, 0, 0.44, -0.15 + i * 0.15)); // seat slats
  for (let i = 0; i < 2; i++) g.add(rbox(1.6, 0.11, 0.05, wood, 0.02, 0, 0.6 + i * 0.16, 0.22));    // back slats
  return g;
}

export function buildMailbox(rng) {
  const g = new THREE.Group();
  g.add(rbox(0.1, 1.0, 0.1, P.timber, 0.03, 0, 0.5, 0));
  const bm = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.3, 0.55, 3, 0.11), mat(P.mailbox));
  bm.position.y = 1.12;
  g.add(bm);
  if (rng.chance(0.5)) g.add(box(0.05, 0.22, 0.05, P.mailFlag, 0.19, 1.25, -0.14));
  wobble(g, rng, 0.05, 0.04);
  return g;
}

export function buildCar(rng) {
  const g = new THREE.Group();
  const color = rng.pick(P.cars);
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.75, 0.62, 3.7, 3, 0.26), mat(color));
  body.position.y = 0.52;
  g.add(body);
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.62, 1.95, 3, 0.28), mat(P.carGlass));
  cabin.position.set(0, 0.95, -0.25);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.82, 1.15], [0.82, 1.15], [-0.82, -1.15], [0.82, -1.15]]) {
    const wheel = new THREE.Mesh(wheelGeo, mat(P.wheel));
    wheel.position.set(x, 0.3, z);
    g.add(wheel);
  }
  return g;
}
