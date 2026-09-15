// Fences and shelters follow independently mapped baseball details. A pitch
// polygon is never used to guess home plate, a backstop, or dugout orientation.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { perimeterPanels } from './perimeter-layout.js';
import { dugoutFooting } from './baseball-layout.js';

const colors = { steel: 0x78867c, green: 0x345346, cream: 0xded8b5,
  roof: 0x3d4945, concrete: 0x999b8b, bench: 0x9f9980, ball: 0xf0efe3, seam: 0xa46053 };
const materials = new Map();
function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .92 }));
  return materials.get(color);
}

let wireMaterial;
function chainLinkMaterial() {
  if (wireMaterial) return wireMaterial;
  // A tiny serializable RGBA texture avoids one mesh per wire and survives the
  // normal ObjectLoader/stream path without a canvas or custom shader.
  const n = 32, pixels = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4;
    const a = (x + y) % n, b = (x - y + n) % n;
    pixels.set([139, 151, 142, Math.min(Math.abs(a - n / 2), Math.abs(b - n / 2)) < 1.2 ? 255 : 0], i);
  }
  const texture = new THREE.DataTexture(pixels, n, n, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  wireMaterial = new THREE.MeshStandardMaterial({ map: texture, alphaTest: .34, side: THREE.DoubleSide, roughness: .88 });
  return wireMaterial;
}

function batching() {
  const groups = new Map(), cube = new THREE.BoxGeometry(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  function add(geometry, color, transform = null) {
    if (transform) geometry.applyMatrix4(transform);
    // All ordinary geometry uses position/normal/uv, so merged batches are
    // small and compatible with the existing static scene bake.
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color).push(geometry);
  }
  function box(w, h, d, color, point, rotation = new THREE.Quaternion()) {
    if (Math.min(w, h, d) <= 0) return;
    add(cube.clone(), color, new THREE.Matrix4().compose(new THREE.Vector3(...point), rotation, new THREE.Vector3(w, h, d)));
  }
  function beam(a, b, size, color) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    box(size, direction.length(), size, color, start.add(end).multiplyScalar(.5).toArray(), new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
  }
  function finish(root) {
    for (const [color, geometries] of groups) {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geometry, material(color));
      mesh.name = color === colors.roof ? 'baseball-dugout-roofs' : 'baseball-structure';
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.streamCoarse = true;
      root.add(mesh);
    }
    cube.dispose();
  }
  return { add, box, beam, finish };
}

function triangle(points) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 1, 2]); geometry.computeVertexNormals();
  return geometry;
}

function dugoutGeometry(dugout, grade, batch, addFence) {
  const footing = dugoutFooting(dugout, grade), { length: L, depth: D, floor, bottom, world } = footing;
  const angle = dugout.angle || 0, rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  const point = (u, y, v) => { const [x, z] = world(u, v); return [x, floor + y, z]; };
  const box = (w, h, d, color, u, y, v) => batch.box(w, h, d, color, point(u, y, v), rotation);
  const beam = (a, b, size, color) => batch.beam(point(...a), point(...b), size, color);
  const eave = dugout.height ?? 2.08, rise = .52, green = colors.green, cream = colors.cream;
  box(L + .25, floor - bottom, D + .25, colors.concrete, 0, -(floor - bottom) / 2, 0);
  // The field side (-z) stays open, with a bench against the solid outer wall.
  box(L, .66, .12, green, 0, .33, D / 2);
  box(L, eave - .66, .12, cream, 0, (.66 + eave) / 2, D / 2);
  for (const u of [-L / 2, L / 2]) {
    box(.12, .66, D, green, u, .33, 0);
    box(.12, eave - .66, D, cream, u, (.66 + eave) / 2, 0);
    const points = [point(u, eave, -D / 2), point(u, eave, D / 2), point(u, eave + rise, 0)];
    if (u > 0) points.reverse();
    batch.add(triangle(points), cream);
    for (const v of [-D / 2, D / 2]) box(.13, eave + .05, .13, green, u, eave / 2, v);
  }
  box(L, .16, .13, green, 0, eave, -D / 2);
  box(L - .55, .11, .44, colors.bench, 0, .49, D / 2 - .44);
  box(L - .55, .4, .075, colors.bench, 0, .9, D / 2 - .17);
  for (const u of [-L / 2 + .65, 0, L / 2 - .65]) box(.07, .45, .32, green, u, .225, D / 2 - .44);
  // Low front mesh retains a clear 1.25 m entrance at the right end.
  addFence({ pts: [world(-L / 2 + .1, -D / 2), world(L / 2 - 1.25, -D / 2)], height: .96 }, () => floor);
  const entranceU = L / 2 - .625, entranceGround = grade(...world(entranceU, -D / 2 - .2));
  const entranceRise = floor - entranceGround;
  if (entranceRise > .24) {
    const steps = Math.ceil(entranceRise / .2) - 1;
    for (let i = 0; i < steps; i++) {
      const v = -D / 2 - (steps - i) * .3 + .15;
      const top = floor - entranceRise * (steps - i) / (steps + 1);
      const base = Math.min(...[-.56,.56].map(u => grade(...world(entranceU + u, v)))) - .08;
      box(1.12, top - base, .32, colors.concrete, entranceU, (top + base) / 2 - floor, v);
    }
  }
  const roofAngle = Math.atan2(rise, D / 2 + .2), slopeLength = Math.hypot(D / 2 + .2, rise);
  for (const side of [-1, 1]) {
    const roofRotation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), side * roofAngle));
    batch.box(L + .48, .11, slopeLength, colors.roof, point(0, eave + rise / 2 + .06, side * (D / 2 + .2) / 2), roofRotation);
    beam([-L / 2 - .24, eave + .04, side * (D / 2 + .2)], [L / 2 + .24, eave + .04, side * (D / 2 + .2)], .12, green);
  }
  beam([-L / 2 - .24, eave + rise + .1, 0], [L / 2 + .24, eave + rise + .1, 0], .095, colors.roof);
  // The cream-and-green Driving Park shelters carry the photographed baseball
  // emblems. They are ordinary mesh faces, including two red curved seams.
  if (dugout.style === 'driving-park') {
    const radius = .38, y = 1.32, v = D / 2 + .067;
    const disk = new THREE.CircleGeometry(radius, 32);
    batch.add(disk, colors.ball, new THREE.Matrix4().compose(new THREE.Vector3(...point(0, y, v)), rotation, new THREE.Vector3(1, 1, 1)));
    for (const side of [-1, 1]) {
      const curve = Array.from({ length: 13 }, (_, i) => {
        const h = -.32 + i * .64 / 12;
        return [side * (.105 + .16 * (h / .32) ** 2), y + h, v + .012];
      });
      for (let i = 1; i < curve.length; i++) beam(curve[i - 1], curve[i], .014, colors.seam);
      for (let i = 1; i < curve.length; i += 2) {
        const [u, h, z] = curve[i]; beam([u - .026, h - .012, z], [u + .026, h + .012, z], .014, colors.seam);
      }
    }
  }
  return { position: dugout.position, floor, bottom, corners: footing.corners, entranceWidth: 1.25 };
}

function bleacherGeometry(spec, grade, batch) {
  const {length:L,depth:D,floor,world}=dugoutFooting({...spec,depth:2.1},grade);
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),spec.angle||0);
  const point=(u,y,v)=>{const [x,z]=world(u,v);return[x,y,z];};
  const aluminum=0xbfc4bf;
  for(let row=0;row<3;row++) {
    const v=-.7+row*.7,top=floor+.44+row*.3;
    batch.box(L,.075,.32,aluminum,point(0,top,v),rotation);
    batch.box(L,.055,.3,aluminum,point(0,top-.34,v-.3),rotation);
    for(const u of [-L/2+.45,0,L/2-.45]) {
      const [x,z]=world(u,v),bottom=grade(x,z)-.06;
      batch.box(.07,top-bottom,.07,colors.steel,point(u,(top+bottom)/2,v),rotation);
    }
  }
  for(const u of [-L/2+.45,L/2-.45]) {
    batch.beam(point(u,floor+.1,-D/2),point(u,floor+1.02,D/2),.075,colors.steel);
    const [x,z]=world(u,D/2),bottom=grade(x,z)-.06;
    batch.beam(point(u,bottom,D/2),point(u,floor+1.65,D/2),.055,colors.steel);
  }
  batch.beam(point(-L/2+.45,floor+1.65,D/2),point(L/2-.45,floor+1.65,D/2),.055,colors.steel);
}

export function buildBaseball(feature, grade = () => 0) {
  const root = new THREE.Group(); root.name = `baseball-details-${feature.id}`;
  const detail = feature.baseball;
  if (!detail) return root;
  const batch = batching(), positions = [], uv = [], indices = [], posts = new Map();
  const footings = [], panelRecords = [];
  function addFence(fence, ground = grade) {
    const h = fence.height ?? 1.8;
    for (const [a, b] of perimeterPanels(fence.pts, fence.openings, 2.5)) {
      const ya = ground(...a), yb = ground(...b), length = Math.hypot(b[0] - a[0], b[1] - a[1]), start = positions.length / 3;
      positions.push(a[0], ya + .055, a[1], b[0], yb + .055, b[1], b[0], yb + h, b[1], a[0], ya + h, a[1]);
      uv.push(0, 0, length / .2, 0, length / .2, h / .2, 0, h / .2);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      panelRecords.push({ a, b, height: h });
      for (const p of [a, b]) {
        const y = ground(...p), key = [...p, y].map(v => v.toFixed(4)).join(',');
        const old = posts.get(key);
        if (!old || old.height < h) posts.set(key, { point: p, ground: y, height: h });
      }
      batch.beam([a[0], ya + h, a[1]], [b[0], yb + h, b[1]], fence.railColor ? .085 : .055, fence.railColor || colors.steel);
      if (h > 3) batch.beam([a[0], ya + h * .5, a[1]], [b[0], yb + h * .5, b[1]], .045, colors.steel);
    }
  }
  for (const fence of detail.fences || []) addFence(fence);
  for (const dugout of detail.dugouts || []) footings.push(dugoutGeometry(dugout, grade, batch, addFence));
  for (const bleacher of detail.bleachers || []) bleacherGeometry(bleacher, grade, batch);
  for (const post of posts.values()) {
    const [x, z] = post.point, h = post.height;
    batch.box(.082, h + .23, .082, colors.steel, [x, post.ground + h / 2 - .065, z]);
  }
  batch.finish(root);
  if (positions.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, chainLinkMaterial()); mesh.name = 'baseball-chain-link';
    root.add(mesh);
  }
  root.userData.baseball = { source: detail.source, fences: detail.fences?.length || 0, dugouts: footings.length, bleachers:detail.bleachers?.length||0 };
  // Kept in the unbaked model for meaningful terrain and access validation.
  root.userData.baseballFootings = footings;
  root.userData.baseballPanels = panelRecords;
  return root;
}
