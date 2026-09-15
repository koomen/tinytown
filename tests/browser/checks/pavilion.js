import * as THREE from 'three';
import { buildBlueprint } from '../../../src/blueprint.js';
import { makeRng } from '../../../src/rng.js';
import { buildPavilion } from '../../../src/pavilion.js';

export function checkPavilionStairs() {
  for (const axis of ['u', 'v']) for (const entranceEnd of ['positive', 'negative']) {
    const sign = entranceEnd === 'positive' ? 1 : -1, coordinate = axis === 'u' ? 'x' : 'z';
    const spec = {axis, entranceEnd, floorH:2, railing:true, railingStyle:'ornamental',
      entranceStairs:{length:8.4,width:5,bottomY:-2.24,foundationDepth:.55}};
    const model = buildPavilion({w:28,d:19}, spec, '#51412f', '#555b53');
    model.updateMatrixWorld(true);
    const steps = [], posts = [];
    model.traverse(o => {
      if (o.geometry && !o.geometry.attributes.position.array.every(Number.isFinite)) throw Error('Non-finite pavilion stairs');
      if (o.name === 'pavilion-entrance-step') steps.push(new THREE.Box3().setFromObject(o));
      if (o.name === 'pavilion-stair-newel') posts.push(o);
    });
    if (steps.length !== 24 || posts.length !== 6) throw Error('Missing stair treads or capped newels');
    const end = (axis === 'u' ? 28 : 19) / 2 + .15;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i], inner = sign === 1 ? step.min[coordinate] : -step.max[coordinate];
      if (Math.abs(inner - end - i*.35) > .0001) throw Error('Pavilion stairs do not follow the entrance axis');
      if (Math.abs(step.max.y - (2-i*4.24/24)) > .0001 || Math.abs(step.min.y+2.79) > .0001)
        throw Error('Stair treads lost their independent lower elevation or foundations');
    }
    // Above every tread, the middle of the approach must remain unobstructed.
    for (let i = 0; i < steps.length; i++) {
      const p = new THREE.Vector3(); p[coordinate] = sign*(end+(i+.5)*.35); p.y=steps[i].max.y+.4;
      const ray = new THREE.Raycaster(p,new THREE.Vector3(0,1,0),0,.6);
      if (ray.intersectObject(model,true).length) throw Error('Pavilion stair aisle is blocked');
    }
  }
  return {orientations:4,steps:24,newels:6};
}

export function checkOpenPavilion() {
  const root = buildBlueprint(makeRng('open-pavilion'), {obb: {cx: 0, cz: 0, angle: 0, w: 11.75, d: 9.92}}, {
    pavilion: {height: 3.1, pitch: .43, bents: 3, furniture: true}, volumes: [],
  }, 0, []);
  root.updateMatrixWorld(true);
  const posts = [], slopes = [];
  root.traverse(o => {
    if (o.name === 'pavilion-post') posts.push(o);
    if (o.name === 'pavilion-roof-slope') slopes.push(o);
    if (o.geometry && ![...o.geometry.attributes.position.array].every(Number.isFinite)) throw new Error('Non-finite pavilion geometry');
  });
  if (posts.length !== 6 || slopes.length !== 2) throw new Error('Pavilion needs six supports and two roof slopes');
  const ray = new THREE.Raycaster();
  // Look through the entrance and each gable opening, above the low fence
  // and away from the posts/king post. A filled roof wedge or wall fails here.
  for (const side of [-1, 1]) for (const [y, z] of [[2, 2], [3.9, 1.6], [3.9, -1.6]]) {
    ray.set(new THREE.Vector3(side * 6.7, y, z), new THREE.Vector3(-side, 0, 0)); ray.far = 1.5;
    if (ray.intersectObject(root, true).length) throw new Error('Pavilion entrance or gable is enclosed');
  }
  for (const side of [-1, 1]) {
    ray.set(new THREE.Vector3(1, 8, side * 2), new THREE.Vector3(0, -1, 0)); ray.far = 8;
    if (!ray.intersectObjects(slopes).length) throw new Error('Missing pavilion roof slope');
  }
  checkPavilionStairs();
  return posts.length;
}
