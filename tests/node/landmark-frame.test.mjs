import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftLandmark} from '../../src/landmark-frame.js';

test('recentered park geometry retains its world positions and gate widths', () => {
  const f = {id: 'park', pts: [[-1700, 620], [-1650, 650]],
    bases: [[-1680, 630]], openings: [{point: [-1690, 625], width: 5}],
    equipment: [{position: [-1683, 634], angle: .7, coordinates: [-77.7, 42.9]}],
    garden: {position:[-1681,631], angle:-.6, entry:[-2,10]},
    holes: [[[-1680,630],[-1678,630],[-1680,632]]],
    baseball: {surfaces: [{role:'infield-dirt',pts:[[-1680,630],[-1660,630],[-1660,650]],coordinates:[[-77.7,42.9]]}],
      pitcher:[-1671,639],foulLengths:[90,90],fences: [{pts: [[-1670, 640], [-1660, 650]],
      openings: [{point: [-1665, 645], width: 3}]}],
      dugouts: [{position: [-1665, 640], angle: 1.2, length: 7}]}};
  const before = structuredClone(f);
  const points = v => [...v.pts, ...v.bases, ...v.openings.map(o => o.point),
    ...v.equipment.map(e => e.position), v.garden.position, ...v.holes.flat(), ...v.baseball.fences.flatMap(f =>
      [...f.pts, ...f.openings.map(o => o.point)]), ...v.baseball.dugouts.map(d => d.position),
      ...v.baseball.surfaces.flatMap(s=>s.pts),v.baseball.pitcher];
  for (const [dx, dz] of [[-724.3, 265.9], [83.4, -48.2]]) {
    const shifted = shiftLandmark(f, dx, dz);
    points(shifted).forEach((p, i) => {
      assert.ok(Math.abs(p[0] + dx - points(f)[i][0]) < 1e-8);
      assert.ok(Math.abs(p[1] + dz - points(f)[i][1]) < 1e-8);
    });
    assert.equal(shifted.baseball.fences[0].openings[0].width, 3);
    assert.equal(shifted.baseball.dugouts[0].angle, 1.2);
    assert.deepEqual(shifted.baseball.surfaces[0].coordinates,f.baseball.surfaces[0].coordinates);
    assert.deepEqual(shifted.baseball.foulLengths,[90,90]);
    assert.deepEqual(shifted.equipment[0].coordinates, [-77.7, 42.9]);
    assert.deepEqual(shifted.garden.entry, [-2,10]);
  }
  assert.deepEqual(f, before, 'projection does not move authoring data');
});
