import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {blueprintDoorstep, buildBlueprint} from '../../src/blueprint.js';
import {buildFigure} from '../../src/figure.js';
import {makeRng} from '../../src/rng.js';

const house = (angle, faces) => ({id: 7, obb: {cx: 30, cz: -12, w: 12, d: 8, angle}, style: {kind: 'house'},
  blueprint: {volumes: [{id: 'main', u: [-6, 6], v: [-4, 4], height: 3, roof: {type: 'gable', ridge: 'u'}, faces}]}});

// Figure placed as site.js does: its pose from the doorstep, base 10 m.
function stand(b, anchor = {}, base = 10) {
  const step = blueprintDoorstep(b, anchor);
  const figure = buildFigure({character: 'master-chief'});
  figure.position.set(step.x, base + step.y, step.z);
  figure.rotation.y = step.rotation;
  figure.updateMatrixWorld(true);
  return {step, figure, box: new THREE.Box3().setFromObject(figure)};
}

// Top faces of the flagstone steps under a door: world boxes one step high.
function stepBoxes(b, base = 10) {
  const model = buildBlueprint(makeRng('figure'), b, b.blueprint, base, []);
  model.updateMatrixWorld(true);
  const boxes = [];
  model.traverse(o => { if (o.isMesh && o.geometry.parameters?.height === 0.18) boxes.push(new THREE.Box3().setFromObject(o)); });
  return boxes;
}

test('a doorstep figure stands on the top step and faces out of the wall', () => {
  for (const angle of [0, 0.594, -2.1]) {
    const b = house(angle, {'+v': {doors: [{at: 0.4, y: 0.4, w: 1, h: 2.05, steps: 3}]}});
    const {step, figure, box} = stand(b);
    const top = stepBoxes(b).sort((p, q) => q.max.y - p.max.y)[0];
    assert.ok(Math.abs(box.min.y - top.max.y) < 0.02, 'boots rest on the top step');
    assert.ok(Math.abs(step.y - 0.94) < 1e-9);
    const normal = [-Math.sin(angle), Math.cos(angle)];   // +v in world
    assert.ok(Math.abs(Math.sin(step.rotation) - normal[0]) < 1e-9 && Math.abs(Math.cos(step.rotation) - normal[1]) < 1e-9);
    // Every part of the figure stays outside the wall plane (v = 4).
    const v = new THREE.Vector3(), inv = new THREE.Matrix4().makeRotationY(angle);
    let nearest = Infinity;
    figure.traverse(o => { if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 7) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).sub(new THREE.Vector3(30, 0, -12)).applyMatrix4(inv);
        nearest = Math.min(nearest, v.z - 4);
      }
    });
    assert.ok(nearest > 0.1, `figure clears the wall and door surround (${nearest.toFixed(3)} m)`);
    const height = box.max.y - box.min.y;
    assert.ok(height > 1.8 && height < 2.2, 'human scale');
  }
});

test('the anchor skips garage doors and honours face and door selection', () => {
  const b = house(0, {'+v': {doors: [{at: 0.2, type: 'garage', w: 3, h: 2.2}, {at: 0.7, w: 1, h: 2}]},
    '-u': {doors: [{at: 0.5, w: 1, h: 2}]}});
  const front = blueprintDoorstep(b, {face: '+v'});
  assert.ok(Math.abs(front.x - (30 + 0.2 * 12)) < 1e-9, 'first non-garage door on the face');
  assert.equal(blueprintDoorstep(b, {face: '+v', door: 0}), null, 'an explicit garage door has no doorstep');
  const side = blueprintDoorstep(b);
  assert.ok(Math.abs(side.rotation + Math.PI / 2) < 1e-9 && side.y === 0, 'faces are searched +u, -u, +v, -v');
  assert.equal(blueprintDoorstep(b, {volume: 'wing'}), null);
  assert.equal(buildFigure({character: 'nobody'}), null);
});

test('along/out stand a figure on the ground beside the door, clear of its steps', () => {
  for (const angle of [0, 0.594, -2.1]) {
    const door = {at: 0.4, w: 1, h: 2.05, steps: 3};
    const b = house(angle, {'+v': {doors: [door]}});
    const top = blueprintDoorstep(b);
    const c = Math.cos(angle), s = Math.sin(angle);
    const local = p => [c * (p.x - 30) + s * (p.z + 12), -s * (p.x - 30) + c * (p.z + 12)];   // world -> u, v
    for (const along of [-2, 2]) {
      const step = blueprintDoorstep(b, {along, out: 1.5});
      assert.equal(step.y, null, 'the caller drops it onto the terrain');
      assert.equal(step.rotation, top.rotation, 'faces out like the doorstep figure');
      const [u, v] = local(step), [du] = local(top);
      assert.ok(Math.abs(u - du - along) < 1e-9 && Math.abs(v - 5.5) < 1e-9, `${along} m along, 1.5 m out`);
      // Stood on the ground (base 10), no part of the figure enters the flight of steps.
      const figure = buildFigure({character: 'master-chief', mirror: along < 0});
      figure.position.set(step.x, 10, step.z); figure.rotation.y = step.rotation; figure.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(figure);
      for (const stone of stepBoxes(b)) assert.ok(!box.intersectsBox(stone.clone().expandByScalar(-0.02)), 'clear of the steps');
    }
  }
  // Seen from outside (+v, looking -z) "right" is +x.
  const b = house(0, {'+v': {doors: [{at: 0.5, w: 1, h: 2}]}});
  assert.ok(blueprintDoorstep(b, {along: 2}).x > blueprintDoorstep(b, {along: -2}).x);
  // The mirror image is flattened into geometry (no negative scale for bake.js
  // to turn inside out) and is the reflection of the original's bounds.
  const plain = buildFigure({character: 'master-chief'}), mirror = buildFigure({character: 'master-chief', mirror: true});
  mirror.updateMatrixWorld(true);
  mirror.traverse(o => assert.ok(o.matrixWorld.determinant() > 0));
  const pb = new THREE.Box3().setFromObject(plain, true), mb = new THREE.Box3().setFromObject(mirror, true);
  for (const k of ['y', 'z']) assert.ok(Math.abs(pb.min[k] - mb.min[k]) < 1e-6 && Math.abs(pb.max[k] - mb.max[k]) < 1e-6);
  assert.ok(Math.abs(pb.min.x + mb.max.x) < 1e-6 && Math.abs(pb.max.x + mb.min.x) < 1e-6);
});

test('the Avon Master Chiefs guard the front steps of 275 Linden Street', () => {
  const site = JSON.parse(fs.readFileSync(new URL('../../data/avon-extended/site.json', import.meta.url)));
  const guards = site.extras.filter(e => e.type === 'figure' && e.character === 'master-chief');
  assert.equal(guards.length, 2, 'one either side of the steps');
  const sides = [];
  for (const ex of guards) {
    const b = site.buildings.find(b => String(b.id) === String(ex.building));
    assert.equal(b.addr, '275 Linden Street');
    const step = blueprintDoorstep(b, ex);
    assert.ok(step && step.y === null, 'stands on the ground beside the anchored door');
    assert.ok(Math.hypot(step.x - ex.x, step.z - ex.z) < 0.1, 'x/z (preview crop, fallback) match the spot');
    assert.ok(ex.out >= 1.2, 'a few feet in front of the house');
    sides.push(Math.sign(ex.along));
    // The front door they guard fits under the eaves (y + steps + h + surround).
    const vol = b.blueprint.volumes.find(v => v.id === ex.volume), d = vol.faces[ex.face].doors[ex.door];
    assert.ok((d.y || 0) + d.steps * 0.18 + d.h + (d.surroundW ?? 0.22) < vol.height, 'the door stays below the roof');
  }
  assert.deepEqual(sides.sort(), [-1, 1]);
});
