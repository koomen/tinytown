import * as THREE from 'three';
import { box, mat } from './kit.js';

// Code-drawn miniature of the photographed oval hotel engraving and ribbon.
// No facade photograph or remote texture is needed for the crest.
function athenaeumCrest() {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 1024;
  const c = canvas.getContext('2d'); c.scale(.768, 1024 / 1200);
  c.strokeStyle = c.fillStyle = '#fff4de'; c.lineWidth = 12; c.lineJoin = c.lineCap = 'round';
  const line = pts => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); };
  for (const [rx, ry] of [[266, 365], [245, 347]]) {
    c.beginPath(); c.ellipse(500, 435, rx, ry, 0, 0, Math.PI * 2); c.stroke();
  }
  c.save(); c.beginPath(); c.ellipse(500, 435, 230, 328, 0, 0, Math.PI * 2); c.clip();
  // Perspective colonnade and the central mansard tower.
  for (const y of [445, 478, 682, 710]) line([[242, y + 98], [735, y - 60]]);
  for (let i = 0; i < 9; i++) {
    const x = 280 + i * 51, y = 528 - i * 16.5;
    c.fillRect(x - 9, y, 15, 160);
    line([[x - 14, y + 5], [x + 13, y - 4]]); line([[x - 15, y + 162], [x + 12, y + 153]]);
  }
  line([[440, 442], [440, 277], [632, 216], [632, 380]]);
  line([[422, 282], [459, 181], [590, 139], [653, 213], [422, 282]]);
  c.lineWidth = 9;
  for (const x of [480, 525, 570]) {
    const y = 287 - (x - 480) * .32;
    line([[x, y + 94], [x, y + 13]]);
    c.beginPath(); c.arc(x + 9, y + 13, 9, Math.PI, 0); c.stroke();
    line([[x + 18, y + 13], [x + 18, y + 89]]);
  }
  line([[323, 468], [340, 204], [299, 113]]);
  line([[334, 299], [260, 233]]); line([[338, 242], [408, 184]]);
  for (const [x, y] of [[277, 209], [296, 161], [347, 128], [397, 166]]) {
    c.beginPath(); c.ellipse(x, y, 52, 36, -.4, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
  for (const side of [-1, 1]) {
    c.save(); c.translate(500, 0); c.scale(side, 1);
    c.beginPath(); c.moveTo(253, 310); c.bezierCurveTo(325, 145, 232, 59, 210, 134);
    c.bezierCurveTo(286, 101, 316, 236, 273, 272); c.stroke();
    c.beginPath(); c.moveTo(302, 236); c.bezierCurveTo(407, 154, 342, 101, 308, 171); c.stroke(); c.restore();
  }
  c.beginPath(); c.moveTo(107, 792); c.lineTo(171, 761); c.lineTo(171, 932);
  c.lineTo(112, 968); c.lineTo(130, 883); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(893, 792); c.lineTo(829, 761); c.lineTo(829, 932);
  c.lineTo(888, 968); c.lineTo(870, 883); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(160, 801); c.quadraticCurveTo(500, 715, 840, 801);
  c.lineTo(840, 948); c.quadraticCurveTo(500, 858, 160, 948); c.closePath(); c.fill();
  c.fillStyle = '#782b3c'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'italic 76px Georgia, serif'; c.fillText('Athenaeum Hotel', 500, 850, 640);
  c.fillStyle = '#fff4de'; c.font = 'bold 34px Georgia, serif';
  c.fillText('CHAUTAUQUA INSTITUTION', 500, 1020, 745);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({map: texture, roughness: .95, alphaTest: .4, side: THREE.DoubleSide});
  material.userData.landmarkBrand = 'athenaeum-hotel'; return material;
}

// Facade-local -z points outward; y=0 is the canopy springline. The underside
// is open: only a curved fabric shell and a scalloped front valance enclose it.
export function buildBarrelAwning(width, spec, color, trimColor) {
  const depth = spec.depth ?? 1.5, rise = spec.rise ?? width / 2;
  const r = width / 2, segments = 32, drop = .16;
  const g = new THREE.Group(); g.name = 'barrel-awning';
  const cloth = new THREE.MeshStandardMaterial({color, roughness: .95, side: THREE.DoubleSide});
  const positions = [], indices = [];
  for (const z of [0, -depth]) for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI; positions.push(Math.cos(a) * r, Math.sin(a) * rise, z);
  }
  for (let i = 0; i < segments; i++) {
    const j = i + segments + 1; indices.push(i, j, i + 1, i + 1, j, j + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const shell = new THREE.Mesh(geo, cloth); shell.name = 'awning-fabric-shell'; g.add(shell);
  const piping = points => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(32, points.length * 2), .022, 5, false), mat(trimColor));
    pipe.name = 'awning-piping'; g.add(pipe);
  };
  const arc = Array.from({length: segments + 1}, (_, i) => {
    const a = i / segments * Math.PI; return [Math.cos(a) * r, Math.sin(a) * rise];
  });
  const scallops = Math.max(5, Math.round(width / .42));
  const hem = Array.from({length: scallops * 8 + 1}, (_, i) => {
    const f = i / (scallops * 8); return [-r + width * f, -drop + .09 * Math.cos(f * scallops * Math.PI * 2)];
  });
  const frontShape = new THREE.Shape([...arc, ...hem].map(p => new THREE.Vector2(...p)));
  const front = new THREE.Mesh(new THREE.ShapeGeometry(frontShape), cloth);
  front.position.z = -depth; front.name = 'awning-front-valance'; g.add(front);
  piping(arc.map(([x, y]) => [x, y, -depth - .012]));
  piping(hem.map(([x, y]) => [x, y, -depth - .014]));
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(depth, drop), cloth);
    skirt.rotation.y = Math.PI / 2; skirt.position.set(side * r, -drop / 2, -depth / 2);
    skirt.name = 'awning-side-valance'; g.add(skirt);
    piping([[side * r, -drop, 0], [side * r, -drop, -depth]]);
    if (spec.posts) {
      const post = box(.07, spec.y ?? 3.3, .07, 0x343a38, side * (r - .04), -(spec.y ?? 3.3) / 2, -depth + .04);
      post.name = 'awning-support-post'; g.add(post);
    }
  }
  if (spec.brand === 'athenaeum-hotel') {
    const h = rise * .90, w = h * .75;
    const crest = new THREE.Mesh(new THREE.PlaneGeometry(w, h), athenaeumCrest());
    crest.rotation.y = Math.PI; crest.position.set(0, rise * .50, -depth - .025);
    crest.name = 'awning-hotel-crest'; g.add(crest);
  }
  return g;
}
