// Ready-to-use adapters around the same generators used by the town scene.
// Load each generator on demand so editing one asset cannot break another.
export async function tree() {
  const [{buildTree}, {makeRng}] = await Promise.all([
    import('../../src/kit.js'), import('../../src/rng.js'),
  ]);
  const group = buildTree(makeRng('preview-tree'), {big: true});
  group.name = 'preview-tree';
  return group;
}

export async function bench() {
  const [{buildBench}, {makeRng}] = await Promise.all([
    import('../../src/kit.js'), import('../../src/rng.js'),
  ]);
  const group = buildBench(makeRng('preview-bench'));
  group.name = 'preview-bench';
  return group;
}

export async function playground() {
  const {buildPlaygroundEquipment} = await import('../../src/playground.js');
  const group = buildPlaygroundEquipment([
    {type: 'wooden-playset', position: [0, 0]},
    {type: 'swings', position: [9, 0]},
  ]);
  group.name = 'preview-playground';
  return group;
}

export async function fountain() {
  const {buildFountain} = await import('../../src/fountain.js');
  const group = buildFountain({w: 6, d: 6});
  group.name = 'preview-fountain';
  return group;
}
