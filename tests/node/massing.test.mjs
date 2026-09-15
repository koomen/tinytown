import test from 'node:test';
import assert from 'node:assert/strict';
import { massingBlueprint } from '../../src/massing.js';

test('neutral massing preserves wall segmentation on raised roof carriers', () => {
  const source = { volumes: [
    {id: 'body', u: [-5, 5], v: [-4, 4], bottom: -1, height: 8,
      wall: '#333333', upperWall: '#eeeeee', split: 1},
    {id: 'roof', u: [-5, 5], v: [-4, 4], bottom: 7.5, height: 8,
      roof: {type: 'gable', ridge: 'u', pitch: 0.5}},
  ] };
  const copy = structuredClone(source);
  const neutral = massingBlueprint(source);
  assert.deepEqual(source, copy, 'preview must not mutate authored geometry');
  assert.equal(neutral.volumes[0].upperWall, neutral.wall);
  assert.equal(neutral.volumes[0].split, 1);
  assert.equal('upperWall' in neutral.volumes[1], false);
  for (const v of neutral.volumes) {
    const split = v.upperWall ? v.split ?? 3.6 : null;
    const heights = split === null ? [v.height - v.bottom] : [split - v.bottom, v.height - split];
    assert.ok(heights.every(h => h > 0), 'every rendered wall segment has positive height');
  }
});
