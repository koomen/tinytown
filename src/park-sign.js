// Avon Driving Park's small timber entrance sign. All artwork is drawn locally;
// the shaped boards and posts remain ordinary miniature geometry after baking.
import * as THREE from 'three';
import { box, rbox, mat } from './kit.js';

const GREEN = '#41695f', WHITE = '#eceee0', GOLD = '#d8c88c';
let artwork;

function canvasMaterial(width, height, draw, name) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  texture.name = name;
  const material = new THREE.MeshStandardMaterial({map: texture, roughness: .92});
  material.name = name; material.userData.parkSign = true;
  return material;
}

function signArtwork() {
  if (artwork) return artwork;
  const panel = canvasMaterial(768, 576, (c, w, h) => {
    c.fillStyle = GREEN; c.fillRect(0, 0, w, h);
    c.save(); c.scale(w / 1000, h / 750);
    c.strokeStyle = '#b9c3a2'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(150, 51); c.lineTo(850, 51);
    c.quadraticCurveTo(850, 94, 918, 94); c.lineTo(918, 646);
    c.quadraticCurveTo(850, 646, 850, 694); c.lineTo(150, 694);
    c.quadraticCurveTo(150, 646, 82, 646); c.lineTo(82, 94);
    c.quadraticCurveTo(150, 94, 150, 51); c.closePath(); c.stroke();
    // Four light, curling leaf ornaments echo the carved corner flourishes.
    for (const [x, y, sx, sy] of [[119, 115, 1, 1], [881, 115, -1, 1], [119, 629, 1, -1], [881, 629, -1, -1]]) {
      c.save(); c.translate(x, y); c.scale(sx, sy); c.lineWidth = 2.7;
      c.beginPath(); c.moveTo(-14, 58); c.bezierCurveTo(-8, 7, 20, -9, 50, 9);
      c.moveTo(5, 29); c.bezierCurveTo(40, 19, 49, 48, 37, 53);
      c.bezierCurveTo(18, 54, 30, 30, 49, 39);
      c.moveTo(0, 42); c.bezierCurveTo(-29, 28, -21, 9, -5, 16);
      c.moveTo(18, 9); c.bezierCurveTo(12, -18, 34, -19, 36, -8); c.stroke();
      c.restore();
    }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const [text, y, size, maxWidth] of [['AVON', 229, 174, 690], ['DRIVING', 394, 163, 803], ['PARK', 553, 169, 670]]) {
      c.font = `${size}px Georgia, 'Times New Roman', serif`;
      c.fillStyle = '#233f34'; c.fillText(text, 503, y + 3, maxWidth);
      c.fillStyle = '#f0e4b2'; c.fillText(text, 499, y - 1, maxWidth);
      c.fillStyle = GOLD; c.fillText(text, 500, y, maxWidth);
    }
    c.restore();
  }, 'avon-driving-park-lettering');

  const crest = canvasMaterial(384, 240, (c, w, h) => {
    c.fillStyle = WHITE; c.fillRect(0, 0, w, h);
    c.save(); c.scale(w / 600, h / 360);
    c.strokeStyle = '#87968a'; c.lineWidth = 5;
    c.beginPath(); c.ellipse(300, 180, 280, 157, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#88785d'; c.fillStyle = '#8e8168';
    c.lineWidth = 3; c.lineCap = c.lineJoin = 'round';
    // A horse trotting left, with a light two-wheel racing sulky behind it.
    c.beginPath(); c.moveTo(150, 115); c.lineTo(143, 92); c.lineTo(132, 111);
    c.bezierCurveTo(111, 110, 108, 124, 94, 140); c.lineTo(81, 151);
    c.quadraticCurveTo(85, 164, 100, 166); c.lineTo(125, 151);
    c.bezierCurveTo(131, 181, 144, 188, 175, 190);
    c.bezierCurveTo(198, 202, 247, 200, 272, 184);
    c.bezierCurveTo(286, 174, 285, 153, 270, 144);
    c.bezierCurveTo(246, 130, 206, 151, 179, 144);
    c.quadraticCurveTo(162, 131, 150, 115); c.closePath(); c.fill(); c.stroke();
    // Mane and tail are ink strokes, while the four jointed legs show motion.
    c.lineWidth = 5;
    for (const pts of [[[150, 125], [148, 150], [157, 165]], [[273, 147], [296, 162], [306, 187]], [[170, 186], [152, 209], [115, 218], [104, 237]], [[183, 190], [194, 222], [221, 246]], [[254, 187], [267, 214], [301, 228]], [[268, 182], [245, 216], [260, 248]]]) {
      c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
    }
    c.fillStyle = '#e4dfce'; c.beginPath(); c.ellipse(102, 151, 10, 5, -.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#463f34'; c.beginPath(); c.arc(124, 133, 3, 0, Math.PI * 2); c.fill();
    c.lineWidth = 2;
    for (const [x, y, r] of [[400, 238, 47], [452, 219, 38]]) {
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke();
      }
    }
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(164, 165); c.lineTo(378, 227); c.lineTo(409, 185);
    c.lineTo(453, 218); c.moveTo(187, 155); c.lineTo(438, 205); c.stroke();
    // Driver: cap, seated torso, knees, arms, and the reins back to the bridle.
    c.fillStyle = '#88785d'; c.beginPath(); c.arc(427, 121, 13, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(413, 112); c.lineTo(437, 109); c.lineTo(445, 115); c.lineTo(411, 117); c.closePath(); c.fill();
    c.lineWidth = 10; c.beginPath(); c.moveTo(426, 141); c.lineTo(417, 178); c.lineTo(389, 180); c.lineTo(374, 207); c.stroke();
    c.lineWidth = 6; c.beginPath(); c.moveTo(424, 145); c.lineTo(403, 160); c.lineTo(381, 154); c.stroke();
    c.lineWidth = 1.8; c.beginPath(); c.moveTo(381, 154); c.quadraticCurveTo(263, 137, 110, 154); c.stroke();
    c.strokeStyle = '#bdbaa5'; c.beginPath(); c.moveTo(85, 265); c.quadraticCurveTo(290, 258, 490, 270); c.stroke();
    c.restore();
  }, 'avon-driving-park-horse-and-sulky');

  const rule = text => canvasMaterial(768, 72, (c, w, h) => {
    c.fillStyle = WHITE; c.fillRect(0, 0, w, h);
    c.fillStyle = '#60695d'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = "45px Georgia, 'Times New Roman', serif";
    c.fillText(text, w / 2, h / 2 + 2, w - 40);
  }, `avon-driving-park-${text.startsWith('PARK') ? 'closing-time' : 'carry-out'}`);
  artwork = {panel, crest, rules: [rule('PARK CLOSES AT 10pm'), rule('CARRY IN - CARRY OUT')]};
  return artwork;
}

function panelShape() {
  const s = new THREE.Shape();
  s.moveTo(-.65, -.665); s.lineTo(.65, -.665);
  s.quadraticCurveTo(.72, -.665, .75, -.60); s.quadraticCurveTo(.90, -.59, .91, -.47);
  s.lineTo(.91, .48); s.quadraticCurveTo(.91, .60, .77, .60);
  s.quadraticCurveTo(.76, .71, .63, .71); s.lineTo(-.63, .71);
  s.quadraticCurveTo(-.76, .71, -.77, .60); s.quadraticCurveTo(-.91, .60, -.91, .48);
  s.lineTo(-.91, -.47); s.quadraticCurveTo(-.90, -.59, -.75, -.60);
  s.quadraticCurveTo(-.72, -.665, -.65, -.665); s.closePath(); return s;
}

function solidShape(shape, depth, color) {
  const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 1, curveSegments: 10, steps: 1});
  geometry.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, mat(color));
}

function paintedFace(shape, material, bounds) {
  const geometry = new THREE.ShapeGeometry(shape, 20), p = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - bounds[0]) / bounds[2], (p.getY(i) - bounds[1]) / bounds[3]);
  return new THREE.Mesh(geometry, material);
}

export function buildParkSign(feature, grade = () => 0) {
  const root = new THREE.Group(); root.name = 'avon-driving-park-entrance-sign';
  const [x, z] = feature.pts[0], angle = feature.angle ?? 0, ground = grade(x, z);
  root.position.set(x, ground, z); root.rotation.y = angle;
  const art = signArtwork(), shape = panelShape(), panelY = 2.28;
  const panel = solidShape(shape, .095, '#c6cbb0'); panel.position.y = panelY; panel.name = 'park-sign-shaped-rim'; root.add(panel);
  const front = paintedFace(shape, art.panel, [-.91, -.665, 1.82, 1.375]);
  front.scale.set(.953, .945, 1); front.position.set(0, panelY, .057); front.name = 'park-sign-lettered-front'; root.add(front);
  const back = paintedFace(shape, mat(GREEN), [-.91, -.665, 1.82, 1.375]);
  back.scale.set(.953, .945, 1); back.rotation.y = Math.PI; back.position.set(0, panelY, -.057); back.name = 'park-sign-unlettered-back'; root.add(back);
  for (const u of [-1.015, 1.015]) {
    // Each post penetrates the local terrain by 8 cm while its cap stays level.
    const foot = grade(x + Math.cos(angle) * u, z - Math.sin(angle) * u) - ground - .08, top = 3.04;
    const post = rbox(.145, top - foot, .145, WHITE, .012, u, (top + foot) / 2, 0);
    post.name = 'park-sign-white-post'; root.add(post);
    const cap = rbox(.169, .045, .169, '#f3f1e4', .008, u, top + .01, 0); cap.name = 'park-sign-post-cap'; root.add(cap);
    for (const y of [1.66, 2.85]) root.add(box(.24, .09, .07, WHITE, u * .91, y, -.018));
  }
  const oval = new THREE.Shape(); oval.absellipse(0, 0, .421, .256, 0, Math.PI * 2, false, 0);
  const emblem = solidShape(oval, .082, '#bec8b5'); emblem.position.set(0, 3.045, .053); emblem.name = 'park-sign-oval-emblem'; root.add(emblem);
  const horse = paintedFace(oval, art.crest, [-.421, -.256, .842, .512]);
  horse.scale.set(.956, .944, 1); horse.position.set(0, 3.045, .103); horse.name = 'park-sign-horse-and-sulky'; root.add(horse);
  for (const [i, y] of [1.435, 1.17].entries()) {
    const board = rbox(1.95, .175, .069, WHITE, .008, 0, y, .002); board.name = 'park-sign-rule-board'; root.add(board);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.88, .172), art.rules[i]);
    label.position.set(0, y, .04); label.name = 'park-sign-rule-lettering'; root.add(label);
    for (const u of [-.91, .91]) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(.012, 6, 4), mat('#999e8c'));
      bolt.scale.z = .35; bolt.position.set(u, y, .043); root.add(bolt);
    }
  }
  for (const y of [1.76, 2.73]) {
    const brace = box(1.77, .09, .046, '#839384', 0, y, -.084); brace.name = 'park-sign-rear-brace'; root.add(brace);
  }
  root.traverse(o => {if (o.isMesh) {o.castShadow = true; o.receiveShadow = true;}});
  return root;
}
