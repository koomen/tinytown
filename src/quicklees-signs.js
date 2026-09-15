// The two channel-letter signs on the photographed Quicklee's storefront.
// Ordinary CanvasTextures survive the same bake/stream path as other signs.
import * as THREE from 'three';

export function quickleesSignMaterial(brand, aspect = 3) {
  if (!['quicklees', 'dunkin-donuts'].includes(brand)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(2048, Math.max(512, Math.round(512 * aspect)));
  canvas.height = 512;
  const c = canvas.getContext('2d');
  c.scale(canvas.width / 1200, canvas.height / 450);
  if (brand === 'quicklees') {
    // White capsule with a raised speedometer crown, as on the front gable.
    c.fillStyle = '#f6f4e9'; c.strokeStyle = '#c1c4bf'; c.lineWidth = 9;
    c.beginPath(); c.moveTo(152,198); c.lineTo(340,198);
    c.bezierCurveTo(365,-26,700,-24,711,198); c.lineTo(1052,198);
    c.bezierCurveTo(1217,198,1217,412,1052,412); c.lineTo(152,412);
    c.bezierCurveTo(-17,412,-17,198,152,198); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#76b94b'; c.lineWidth = 27;
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + i * Math.PI / 15;
      c.beginPath(); c.moveTo(525 + 155*Math.cos(a),230 + 155*Math.sin(a));
      c.lineTo(525 + 190*Math.cos(a),230 + 190*Math.sin(a)); c.stroke();
    }
    // The tapered red needle leans right; its white bevel stays distinct.
    c.fillStyle = '#b9bab3'; c.beginPath(); c.moveTo(493,221);
    c.lineTo(637,108); c.lineTo(512,250); c.closePath(); c.fill();
    c.fillStyle = '#d64a32'; c.beginPath(); c.moveTo(503,233);
    c.lineTo(485,194); c.lineTo(516,215); c.lineTo(646,112); c.closePath(); c.fill();
    c.fillStyle = '#097fc8'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.font = 'italic 900 206px Arial, sans-serif';
    c.fillText('QUICKLEE’S',605,365,1100);
  } else {
    // Stacked orange/pink letters with the older tilted DD coffee cup logo.
    c.lineJoin = 'round'; c.lineWidth = 19; c.strokeStyle = '#f8ecd6';
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.font = '900 183px Arial, sans-serif';
    for (const [word,y,color] of [["DUNKIN’",212,'#f57920'],['DONUTS',391,'#d82b71']]) {
      c.strokeText(word,749,y,852); c.fillStyle = color; c.fillText(word,749,y,852);
    }
    c.save(); c.translate(167,256); c.rotate(-.25);
    c.fillStyle = '#d92b72'; c.beginPath(); c.roundRect(-127,-115,249,288,36); c.fill(); c.stroke();
    c.fillStyle = '#f1e6cf'; c.strokeStyle = '#53423a'; c.lineWidth = 8;
    c.beginPath(); c.moveTo(-89,-110); c.lineTo(91,-110); c.lineTo(64,137);
    c.quadraticCurveTo(0,158,-63,137); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f8efd9'; c.beginPath(); c.ellipse(0,-112,98,28,0,0,Math.PI*2); c.fill(); c.stroke();
    c.strokeStyle = '#f7ead0'; c.lineWidth = 19;
    for (const [x,y,r] of [[-45,-175,19],[22,-202,21]]) {
      c.beginPath(); c.arc(x,y,r,.7,Math.PI*2.35); c.stroke();
    }
    c.fillStyle = '#ee7629'; c.font = '900 64px Arial, sans-serif'; c.fillText('D',-24,39);
    c.fillStyle = '#d62b70'; c.fillText('D',26,39); c.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({map:texture, roughness:.75, alphaTest:.45, side:THREE.DoubleSide});
  material.userData.landmarkBrand = brand;
  return material;
}
