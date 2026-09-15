// Painted field details are authored in the measured pitch's own frame. The
// opaque CanvasTexture remains an ordinary textured mesh through bake/stream.
import * as THREE from 'three';
import { mat } from './kit.js';
import { drapeTriangles } from './landmark-drape.js';
import { ribbonStrip } from './landmark-ribbon.js';
import { loadAvonEmblem, AVON_EMBLEM_IMAGE } from './avon-emblem.js';

const WHITE = '#ececda', INK = '#14221d';
const emblemCutouts = new WeakMap();

// The supplied sign graphic has a solid green panel. On turf, retain every
// interior logo pixel and remove only green connected to the image border.
function midfieldEmblem(image) {
  if (emblemCutouts.has(image)) return emblemCutouts.get(image);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const c = canvas.getContext('2d'); c.drawImage(image, 0, 0);
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height), data = pixels.data;
  // The screenshot has a one-pixel pale row above and below the actual
  // graphic. Clear those uniform margins and sample inside the green panel.
  for (const y of [0, canvas.height - 1]) {
    const start = y * canvas.width * 4;
    let pale = true;
    for (let x = 0; x < canvas.width; x++) {
      const i = start + x * 4;
      pale &&= data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
    }
    if (pale) for (let x = 0; x < canvas.width; x++) data[start + x * 4 + 3] = 0;
  }
  const keyAt = (canvas.width * 2 + canvas.width - 3) * 4;
  const key = Array.from(data.slice(keyAt, keyAt + 3)), count = canvas.width * canvas.height;
  const seen = new Uint8Array(count), queue = new Uint32Array(count);
  let head = 0, tail = 0;
  const add = p => {
    if (seen[p]) return;
    seen[p] = 1;
    const i = p * 4;
    if (Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]) > 32) return;
    data[i + 3] = 0; queue[tail++] = p;
  };
  for (let x = 0; x < canvas.width; x++) { add(x); add(count - canvas.width + x); }
  for (let y = 0; y < canvas.height; y++) { add(y * canvas.width); add((y + 1) * canvas.width - 1); }
  while (head < tail) {
    const p = queue[head++], x = p % canvas.width;
    if (x) add(p - 1);
    if (x < canvas.width - 1) add(p + 1);
    if (p >= canvas.width) add(p - canvas.width);
    if (p < count - canvas.width) add(p + canvas.width);
  }
  c.putImageData(pixels, 0, 0); emblemCutouts.set(image, canvas);
  return canvas;
}

function avonA(c) {
  const p = new Path2D('M -38 29 L -38 17 L -29 17 L -11 -30 L 10 -30 L 29 17 L 38 17 L 38 29 L 8 29 L 8 17 L 14 17 L 10 6 L -11 6 L -15 17 L -8 17 L -8 29 Z M -6 -6 L 5 -6 L -1 -22 Z');
  c.lineJoin = 'miter'; c.strokeStyle = INK; c.lineWidth = 3.2; c.stroke(p);
  c.fillStyle = WHITE; c.fill(p, 'evenodd');
}

export function footballFieldMaterial(branding = 'avon-braves', image = AVON_EMBLEM_IMAGE) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 2048;
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  // The whole pitch is painted so transparent mipmaps cannot erase the fine
  // field lines or bleed black into the turf at town overview distances.
  c.fillStyle = '#315b49'; c.fillRect(0, 0, W, H);
  const left = 27, right = W - left, top = 23, bottom = H - top;
  const fieldW = right - left, fieldH = bottom - top, yard = fieldH / 120;
  const y = n => top + n * yard;
  for (let n = 10; n < 110; n += 10) {
    c.fillStyle = (n / 10) % 2 ? '#365f4b' : '#315b49';
    c.fillRect(left, y(n), fieldW, 10 * yard);
  }
  c.strokeStyle = WHITE; c.lineWidth = 3.6;
  c.strokeRect(left, top, fieldW, fieldH);
  const line = (x0, y0, x1, y1, width = 2.4) => {
    c.lineWidth = width; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  };
  for (let n = 10; n <= 110; n += 5) line(left, y(n), right, y(n), n === 10 || n === 110 ? 3.8 : 2.4);
  for (let n = 11; n < 110; n++) {
    if (n % 5 === 0) continue;
    for (const x of [left, left + fieldW / 3, left + fieldW * 2 / 3, right - 13]) line(x, y(n), x + 13, y(n), 2.1);
  }
  c.fillStyle = WHITE; c.font = '900 58px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let n = 20; n <= 100; n += 10) {
    const number = Math.min(n - 10, 110 - n);
    for (const side of [-1, 1]) {
      c.save(); c.translate(side < 0 ? left + fieldW * .135 : right - fieldW * .135, y(n));
      c.rotate(side < 0 ? Math.PI / 2 : -Math.PI / 2); c.fillText(String(number), 0, 0, 90);
      if (number !== 50) {
        const direction = (n < 60 ? 1 : -1) * side;
        c.beginPath(); c.moveTo(direction * 72, 0); c.lineTo(direction * 56, -6); c.lineTo(direction * 56, 6); c.closePath(); c.fill();
      }
      c.restore();
    }
  }
  // The same surface is a soccer pitch: subdued lines keep both sports legible.
  c.strokeStyle = '#a6ad77'; c.lineWidth = 2.6;
  const soccerLeft = 9, soccerRight = W - 9, soccerTop = top + yard * 2, soccerBottom = bottom - yard * 2;
  c.strokeRect(soccerLeft, soccerTop, soccerRight - soccerLeft, soccerBottom - soccerTop);
  line(soccerLeft, H / 2, soccerRight, H / 2, 2.6);
  const px = fieldW / 48.8, py = fieldH / 109.7;
  c.beginPath(); c.ellipse(W / 2, H / 2, 9.15 * px, 9.15 * py, 0, 0, Math.PI * 2); c.stroke();
  for (const end of [-1, 1]) {
    const edge = end < 0 ? soccerTop : soccerBottom;
    for (const [width, depth] of [[40.3, 16.5], [18.3, 5.5]]) c.strokeRect(W / 2 - width * px / 2, edge, width * px, -end * depth * py);
    c.beginPath(); c.ellipse(W / 2, edge - end * 11 * py, 9.15 * px, 9.15 * py, 0, end < 0 ? .65 : Math.PI + .65, end < 0 ? Math.PI - .65 : Math.PI * 2 - .65); c.stroke();
  }
  if (branding === 'avon-braves') {
    for (const end of [-1, 1]) {
      c.save(); c.translate(W / 2, end < 0 ? y(5) : y(115)); c.rotate(end < 0 ? 0 : Math.PI); c.scale(.95, .95); avonA(c); c.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.name = `football-${branding}`;
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  if (branding === 'avon-braves') loadAvonEmblem(emblem => {
    const cutout = midfieldEmblem(emblem), height = 310, width = height * cutout.width / cutout.height;
    c.save(); c.translate(W / 2, H / 2); c.rotate(-Math.PI / 2);
    c.drawImage(cutout, -width / 2, -height / 2, width, height); c.restore();
    texture.needsUpdate = true;
  }, image);
  const material = new THREE.MeshStandardMaterial({map:texture, roughness:.95});
  material.name = `football-${branding}`; material.userData.footballBranding = branding;
  return material;
}

export function buildFootballField(feature, grade = () => 0, grid = null) {
  const root = new THREE.Group(); root.name = 'football-field-graphics';
  if (!feature.football || feature.pts?.length !== 4) return root;
  // Authoring order is SW, SE, NE, NW. Reject a degenerate map before UVs can
  // introduce non-finite attributes into a serialized town.
  const [sw, se, ne, nw] = feature.pts;
  const ux = ne[0] - nw[0], uz = ne[1] - nw[1], vx = sw[0] - nw[0], vz = sw[1] - nw[1];
  const det = ux * vz - uz * vx;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-6) return root;
  const data = drapeTriangles([nw, ne, se, sw], [0, 1, 2, 0, 2, 3], grade, grid, .145);
  const uv = [];
  for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i] - nw[0], z = data.positions[i + 2] - nw[1];
    uv.push((x * vz - z * vx) / det, 1 - (ux * z - uz * x) / det);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(data.indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, footballFieldMaterial(feature.football.branding, feature.image));
  mesh.name = 'football-field-paint'; mesh.receiveShadow = true; root.add(mesh);
  const crossAxis = new THREE.Vector3(ux, 0, uz).normalize();
  const longAxis = new THREE.Vector3(vx, 0, vz).normalize();
  const tube = (a,b,r,name) => {
    const axis = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,axis.length(),10), mat('#efc52d'));
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
    m.name=name; m.castShadow=true; m.receiveShadow=true; root.add(m);
  };
  for (const end of [0,1]) {
    const t=end ? 1-23/2048 : 23/2048;
    const x=nw[0]+ux*.5+vx*t,z=nw[1]+uz*.5+vz*t;
    const y=grade(x,z)+.145, bar=new THREE.Vector3(x,y+3.05,z);
    const support=bar.clone().addScaledVector(longAxis,end ? 1.5 : -1.5);
    tube(new THREE.Vector3(support.x,grade(support.x,support.z)-.12,support.z),support,.13,'football-goalpost-support');
    tube(support,bar,.12,'football-goalpost-arm');
    const left=bar.clone().addScaledVector(crossAxis,-3.55),right=bar.clone().addScaledVector(crossAxis,3.55);
    tube(left,right,.095,'football-goalpost-crossbar');
    for(const p of [left,right])tube(p,p.clone().add(new THREE.Vector3(0,4.6,0)),.075,'football-goalpost-upright');
  }
  root.userData.football = {branding:feature.football.branding, yardNumbers:[10,20,30,40,50,40,30,20,10], sidelines:2, endzoneMarks:2};
  return root;
}

export function buildRunningTrack(feature, grade = () => 0, grid = null) {
  const root = new THREE.Group(); root.name = 'school-running-track';
  const pts = feature.pts, width = feature.width || 9.6, lanes = feature.athletics?.lanes || 8;
  if (!pts?.length) return root;
  const addStrip = (points, breadth, color, lift, name) => {
    const strip = ribbonStrip(points, breadth, true), data = drapeTriangles(strip.positions, strip.indices, grade, grid, lift);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, mat(color)); mesh.name = name; mesh.receiveShadow = true; root.add(mesh);
  };
  addStrip(pts, width, feature.color || '#af6556', .12, 'running-track-surface');
  const edges = ribbonStrip(pts, width - .24, true).positions;
  for (let lane = 0; lane <= lanes; lane++) {
    const t = lane / lanes, line = pts.map((p, i) => [edges[i * 2][0] * (1 - t) + edges[i * 2 + 1][0] * t, edges[i * 2][1] * (1 - t) + edges[i * 2 + 1][1] * t]);
    addStrip(line, .085, '#d9b8a3', .15, 'running-track-lane');
  }
  return root;
}
