// Open timber shelters: one roof, exposed trusses, and clear space underneath.
import * as THREE from 'three';
import { box, rbox, mat, roofPanel } from './kit.js';

function beam(a, b, width, depth, color, name) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const mesh = box(width, direction.length(), depth, color);
  mesh.position.copy(start.add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.name = name;
  return mesh;
}

// Decorative timber rail panels follow either a level terrace or a stair slope.
// The panel centres and crossing braces stay in the same vertical plane.
function ornamentalRail(g, a, b, color) {
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const at = (t, y) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + y, a[2] + (b[2] - a[2]) * t];
  for (const y of [.14, 1.04]) g.add(beam(at(0, y), at(1, y), .18, .18, color, 'pavilion-ornamental-rail'));
  const count = Math.max(1, Math.ceil(length / 1.15));
  for (let i = 0; i <= count; i++)
    g.add(beam(at(i / count, .15), at(i / count, 1.04), .13, .17, color, 'pavilion-ornamental-mullion'));
  for (let i = 0; i < count; i++) {
    const left = (i + .13) / count, right = (i + .87) / count, mid = (i + .5) / count;
    for (const [y0, y1] of [[.26, .91], [.91, .26]])
      g.add(beam(at(left, y0), at(right, y1), .075, .10, color, 'pavilion-ornamental-brace'));
    g.add(beam(at(mid, .24), at(mid, .94), .065, .10, color, 'pavilion-ornamental-brace'));
    g.add(beam(at(left, .585), at(right, .585), .065, .10, color, 'pavilion-ornamental-brace'));
  }
}

function cappedNewel(g, x, y, z, color) {
  for (const [width, height, centre, name] of [
    [.68, 1.48, .39, 'pavilion-stair-newel'],
    [.78, .16, -.12, 'pavilion-stair-newel-plinth'],
    [.76, .12, 1.08, 'pavilion-stair-newel-collar'],
    [.91, .13, 1.205, 'pavilion-stair-newel-cap'],
    [.79, .07, 1.305, 'pavilion-stair-newel-cap'],
  ]) {
    const block = box(width, height, width, color, x, y + centre, z);
    block.name = name; g.add(block);
  }
}

function cafeSet(x, z, floor, color) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.58, .58, .07, 16), mat(color));
  top.position.y = 1.05; g.add(top);
  g.add(box(.09, 1.05, .09, color, 0, .525, 0));
  g.add(box(.65, .06, .08, color, 0, .04, 0), box(.08, .06, .65, color, 0, .04, 0));
  for (const side of [-1, 1]) {
    const chair = new THREE.Group();
    chair.add(box(.48, .055, .47, color, 0, .60, side * .9));
    for (const dx of [-.20, .20]) for (const dz of [-.19, .19])
      chair.add(box(.045, .6, .045, color, dx, .30, side * .9 + dz));
    for (const dx of [-.22, .22]) chair.add(box(.045, .52, .045, color, dx, .86, side * 1.11));
    for (const y of [.82, 1.09]) chair.add(box(.48, .055, .05, color, 0, y, side * 1.11));
    g.add(chair);
  }
  g.position.set(x, floor, z);
  return g;
}

export function buildPavilion(obb, spec, timber, roofColor) {
  const g = new THREE.Group(), alongV = spec.axis === 'v';
  const length = alongV ? obb.d : obb.w, span = alongV ? obb.w : obb.d;
  const floor = spec.floorH ?? .10, height = spec.height ?? 3.1, pitch = spec.pitch ?? .43;
  const post = spec.postWidth ?? .26, xEnd = length / 2 - .25, zEnd = span / 2 - .25;
  const flat = spec.roofType === 'flat';
  const eave = floor + height, rise = flat ? 0 : span / 2 * pitch, ridge = eave + rise;
  const slab = rbox(length + .3, floor + .22, span + .3, spec.floorColor ?? '#b9b6aa', .04, 0, (floor - .22) / 2, 0);
  slab.name = 'pavilion-floor'; g.add(slab);
  const bents = spec.bents ?? 3;
  const columnColor = spec.columnColor ?? timber;
  function column(x, z) {
    if (spec.columns === 'classical') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(post * .42, post * .5, height - .38, 20), mat(columnColor));
      shaft.name = 'pavilion-column'; shaft.position.set(x, floor + height / 2, z); g.add(shaft);
      for (const y of [floor + .09, eave - .09]) g.add(box(post * 1.3, .18, post * 1.3, columnColor, x, y, z));
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(post * .63, post * .45, .14, 20), mat(columnColor));
      capital.position.set(x, eave - .24, z); g.add(capital);
    } else g.add(beam([x, floor, z], [x, eave, z], post, post, columnColor, 'pavilion-post'));
  }
  for (let i = 0; i < bents; i++) {
    const x = -xEnd + i * 2 * xEnd / (bents - 1);
    for (const z of [-zEnd, zEnd]) {
      column(x, z);
      if (!flat && spec.columns !== 'classical') g.add(beam([x, eave - .72, z], [x, eave - .08, z - Math.sign(z) * .75], .15, .15, timber, 'pavilion-knee-brace'));
    }
    g.add(beam([x, eave, -span / 2], [x, eave, span / 2], .24, .28, timber, 'pavilion-tie-beam'));
    if (!flat) g.add(beam([x, eave, 0], [x, ridge - .07, 0], .22, .22, timber, 'pavilion-king-post'));
  }
  for (const x of [-xEnd, xEnd]) for (let i = 1; i <= (spec.endPosts ?? 0); i++)
    column(x, -zEnd + 2 * zEnd * i / (spec.endPosts + 1));
  for (const z of [-zEnd, zEnd]) g.add(beam([-length / 2, eave, z], [length / 2, eave, z], .25, .25, timber, 'pavilion-eave-beam'));
  if (!flat) {
  g.add(beam([-length / 2, ridge - .1, 0], [length / 2, ridge - .1, 0], .18, .20, timber, 'pavilion-ridge-beam'));
  const rafters = Math.max(3, Math.ceil(length / .95));
  for (let i = 0; i <= rafters; i++) {
    const x = -length / 2 + length * i / rafters;
    for (const side of [-1, 1]) g.add(beam([x, eave - .15, side * span / 2], [x, ridge - .15, 0], .13, .15, timber, 'pavilion-rafter'));
  }
  for (const side of [-1, 1]) {
    const half = span / 2 + .4, low = eave - .4 * pitch;
    const underside = box(length + .8, .10, Math.hypot(half, ridge - low), timber, 0, (low + ridge) / 2 - .075, side * half / 2);
    underside.rotation.x = side * Math.atan(pitch); underside.name = 'pavilion-roof-underside'; g.add(underside);
    const roof = roofPanel(length + .8, half, low, 0, ridge, side, roofColor);
    roof.name = 'pavilion-roof-slope'; g.add(roof);
    for (const x of [-length / 2 - .38, length / 2 + .38])
      g.add(beam([x, low, side * half], [x, ridge, 0], .16, .16, timber, 'pavilion-bargeboard'));
  }
  const ridgeCap=rbox(length + .86, .12, .18, roofColor, .03, 0, ridge + .045, 0);
  ridgeCap.name='pavilion-ridge-cap';g.add(ridgeCap);
  } else {
    const roof=box(length + .6, .24, span + .6, roofColor, 0, eave + .12, 0);
    roof.name='pavilion-flat-roof';g.add(roof);
    const trim = spec.trimColor ?? '#eee9da';
    for (const z of [-span / 2, span / 2]) {
      const fascia=box(length + .55, .65, .3, trim, 0, eave + .05, z),cap=box(length + .8, .12, .55, trim, 0, eave + .43, z);
      fascia.name='pavilion-fascia';cap.name='pavilion-coping';g.add(fascia,cap);
    }
    for (const x of [-length / 2, length / 2]) {
      const fascia=box(.3, .65, span + .55, trim, x, eave + .05, 0),cap=box(.55, .12, span + .8, trim, x, eave + .43, 0);
      fascia.name='pavilion-fascia';cap.name='pavilion-coping';g.add(fascia,cap);
    }
  }
  // Hall seating has a central aisle and an open stage at one end.
  const rows = spec.seatingRows ?? 0, entry = spec.entranceEnd === 'negative' ? -1 : 1;
  for (let row = 0; row < rows; row++) for (const side of [-1, 1]) {
    const x = entry * (length * .32 - row * length * .64 / Math.max(rows - 1, 1));
    const width = Math.max(.5, span / 2 - 2), z = side * (width / 2 + .65);
    const bench = new THREE.Group(); bench.name = 'pavilion-audience-bench';
    bench.add(box(.42, .08, width, '#755d43', x, floor + .48, z));
    bench.add(box(.06, .42, width, '#755d43', x + entry * .19, floor + .69, z));
    for (const dz of [-width * .4, width * .4]) bench.add(box(.3, .44, .08, '#494c43', x, floor + .22, z + dz));
    g.add(bench);
  }
  const stairs = spec.entranceStairs;
  const gap = stairs?.width ?? Math.min(5, span * .28), wallH = spec.wallH ?? 0;
  function balustrade(x0, z0, x1, z1) {
    if (wallH) {
      const wall = box(Math.hypot(x1-x0,z1-z0),wallH,.22,columnColor,(x0+x1)/2,floor+wallH/2,(z0+z1)/2);
      wall.rotation.y=-Math.atan2(z1-z0,x1-x0);wall.name='pavilion-low-wall';g.add(wall);
    }
    if (!spec.railing) return;
    if (spec.railingStyle === 'ornamental') {
      ornamentalRail(g, [x0, floor, z0], [x1, floor, z1], columnColor);
      return;
    }
    const n = Math.ceil(Math.hypot(x1-x0, z1-z0) / .45);
    for (const y of [.1, 1.05]) g.add(beam([x0, floor+y, z0], [x1, floor+y, z1], .14, .14, columnColor, 'pavilion-balustrade-rail'));
    for (let i=0;i<=n;i++) g.add(box(.12,.9,.12,columnColor,x0+(x1-x0)*i/n,floor+.55,z0+(z1-z0)*i/n));
  }
  for (const z of [-zEnd,zEnd]) balustrade(-xEnd,z,xEnd,z);
  for (const x of [-xEnd,xEnd]) {
    balustrade(x,-zEnd,x,-gap/2); balustrade(x,gap/2,x,zEnd);
  }
  if (stairs || floor > .35) {
    const bottom = stairs?.bottomY ?? 0, drop = floor - bottom;
    const steps = Math.ceil(drop/.18), tread = stairs ? stairs.length / steps : .34;
    const start = length / 2 + (stairs ? .15 : 0);
    const footing = stairs ? bottom - (stairs.foundationDepth ?? .4) : 0;
    for (let i=0;i<steps;i++) {
      const top = bottom + drop*(steps-i)/steps;
      const step = box(tread + (stairs ? 0 : .03), top-footing, gap, spec.floorColor ?? '#b9b6aa', entry*(start+tread*(i+.5)), (top+footing)/2, 0);
      step.name='pavilion-entrance-step';g.add(step);
    }
    if (stairs && spec.railing && stairs.railing !== false) {
      for (const side of [-1, 1]) {
        const z = side * (gap / 2 + .13);
        const a = [entry * start, floor, z], b = [entry * (start + stairs.length), bottom, z];
        if (spec.railingStyle === 'ornamental') {
          ornamentalRail(g, a, b, columnColor);
          // Join the stair rails to the terrace; the columns are inset .25 m.
          ornamentalRail(g, [entry*xEnd, floor, z], a, columnColor);
          for (const t of [0, .5, 1]) cappedNewel(g, a[0]+(b[0]-a[0])*t, floor-drop*t, z, columnColor);
        } else {
          for (const y of [.12, 1.05]) g.add(beam([a[0], a[1]+y, z], [b[0], b[1]+y, z], .10, .10, columnColor, 'pavilion-stair-rail'));
          const count = Math.ceil(stairs.length / .45);
          for (let i=0;i<=count;i++) {
            const t=i/count, x=a[0]+(b[0]-a[0])*t, y=floor-drop*t;
            g.add(beam([x,y+.12,z],[x,y+1.05,z],.10,.10,columnColor,'pavilion-stair-baluster'));
          }
        }
      }
    }
  }
  if (spec.furniture) {
    const metal = '#303933';
    for (const [x, z] of [[-length * .22, -span * .18], [0, span * .18], [length * .22, -span * .18]])
      g.add(cafeSet(x, z, floor, metal));
    const x = length / 2 + .65;
    for (const [a, b] of [[-span / 2, -.9], [.9, span / 2]]) {
      for (const y of [.18, 1.05]) g.add(box(.065, .055, b - a, metal, x, floor + y, (a + b) / 2));
      const n = Math.ceil((b - a) / .27);
      for (let i = 0; i <= n; i++) g.add(box(.045, 1.13, .045, metal, x, floor + .565, a + (b - a) * i / n));
    }
  }
  if (alongV) g.rotation.y = -Math.PI / 2;
  // Open halls and flat pavilion roofs use plain materials, so their shell
  // needs explicit retention when distant scenery replaces the detailed model.
  const structure=new Set(['pavilion-floor','pavilion-column','pavilion-post',
    'pavilion-tie-beam','pavilion-eave-beam','pavilion-ridge-beam','pavilion-king-post',
    'pavilion-roof-underside','pavilion-roof-slope','pavilion-ridge-cap',
    'pavilion-flat-roof','pavilion-fascia','pavilion-coping','pavilion-low-wall',
    'pavilion-entrance-step']);
  g.traverse(o=>{if(o.isMesh&&structure.has(o.name))o.userData.streamCoarse=true;});
  return g;
}
