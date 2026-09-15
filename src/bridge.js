// Integrated bridge forms: real open spans, never overlapping facade panels.
import * as THREE from 'three';
import { box } from './kit.js';
import { surfaceMaterial } from './materials.js';
import { bridgeWing } from './bridge-wing.js';
import { bridgeStonework } from './bridge-stonework.js';

export function buildBridge(obb, spec, wall = '#a5987d', trim = '#c4b99e') {
  const g = new THREE.Group(), alongV = spec.axis === 'v';
  const length = alongV ? obb.d : obb.w, width = alongV ? obb.w : obb.d;
  const h = spec.height ?? 6, deck = spec.deckThickness ?? 0.65;
  const stone = surfaceMaterial('stone', wall);
  if (spec.type === 'masonry-arch') {
    const count = spec.arches ?? 3, pier = spec.pierWidth ?? Math.min(2, length / (count * 5));
    const opening = (length - (count + 1) * pier) / count;
    const rise = spec.archRise ?? Math.min(opening * 0.4, (h - deck) * 0.7);
    const spring = h - deck - rise;
    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, h); shape.lineTo(-length / 2, -1);
    for (let i = 0; i < count; i++) {
      const left = -length / 2 + pier + i * (opening + pier), center = left + opening / 2;
      shape.lineTo(left, -1); shape.lineTo(left, spring);
      for (let j = 1; j <= 16; j++) {
        const a = Math.PI * (1 - j / 16);
        shape.lineTo(center + Math.cos(a) * opening / 2, spring + Math.sin(a) * rise);
      }
      shape.lineTo(left + opening, -1);
    }
    shape.lineTo(length / 2, -1); shape.lineTo(length / 2, h); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: width, bevelEnabled: false, steps: 1});
    geometry.translate(0, 0, -width / 2);
    const mesh = new THREE.Mesh(geometry, stone); mesh.name='bridge-masonry';mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
    g.add(bridgeStonework(length,width,h,count,pier,rise,deck,wall,trim));
    if (spec.railing !== false) for (const sign of [-1, 1]) {
      g.add(box(length, .7, .3, wall, 0, h + .35, sign * (width / 2 - .15)));
      g.add(box(length + .08, .16, .38, trim, 0, h + .78, sign * (width / 2 - .15)));
    }
  } else {
    const deckMesh=box(length, deck, width, trim, 0, h - deck / 2, 0);
    deckMesh.name='bridge-deck';g.add(deckMesh);
    const pier = spec.pierWidth ?? Math.min(1.6, length * .08);
    const supportWidth = spec.abutmentWidth ?? width;
    for (const sign of [-1, 1]) {
      // The bearing sits below the deck surface, not in its top plane.
      const support = new THREE.Mesh(new THREE.BoxGeometry(pier, h + .92, supportWidth), stone);
      support.position.set(sign * (length / 2 - pier / 2), (h - 1.08) / 2, 0);
      support.name = 'bridge-abutment'; support.castShadow = support.receiveShadow = true; g.add(support);
      if (spec.wingWalls) {
        // Broad horizontal courses on the road-facing masonry surface.
        for(let y=.5;y<h-deck;y+=.6) {
          const course=box(.045,.035,supportWidth,'#c0b9a7',sign*(length/2-pier-.015),y,0);
          course.name='bridge-stone-course';g.add(course);
        }
        for(const side of [-1,1]) {
          const data=bridgeWing(length,pier,supportWidth,h-deck+.18,spec.wingWalls,sign,side);
          const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions.flat(),3));geometry.setIndex(data.indices);geometry.computeVertexNormals();
          const wing=new THREE.Mesh(geometry,surfaceMaterial('plaster',spec.wingWalls.color || '#c7c6b9'));
          wing.name='bridge-concrete-wing';wing.castShadow=wing.receiveShadow=true;g.add(wing);
        }
      }
      const z=sign*(spec.girderHeight ? width/2+.11 : width/2-.18);
      if(spec.girderHeight) {
        const bottom=h-deck,top=bottom+spec.girderHeight;
        const web=box(length,spec.girderHeight-.22,.22,trim,0,(bottom+top)/2,z);
        web.name='bridge-girder-web';g.add(web);
        for(const y of [bottom+.055,top-.055]) {
          const flange=box(length+.06,.11,.44,trim,0,y,z);
          flange.name='bridge-girder-flange';g.add(flange);
        }
        const bays=Math.ceil(length/1.3);
        for(let i=0;i<=bays;i++) {
          const rib=box(.10,spec.girderHeight-.22,.36,trim,(length-.16)*(i/bays-.5),(bottom+top)/2,z);
          rib.name='bridge-girder-stiffener';g.add(rib);
        }
      } else {
        g.add(box(length, Math.max(.95,deck), .22, trim, 0, h - deck*.35, z));
        if (spec.railing !== false) for (let x = -length / 2 + .3; x < length / 2; x += 1.7)
          g.add(box(.12, .88, .28, trim, x, h + .12, z));
      }
    }
  }
  if (spec.tracks) {
    // Match the gauge and rail-head elevation used by the approach tracks.
    for (let x = -length / 2 + .4; x < length / 2; x += .8) {
      const sleeper=box(.23,.11,Math.min(width-.3,2.5),'#51483d',x,h+.1,0);
      sleeper.name='bridge-track-sleeper';g.add(sleeper);
    }
    for (const z of [-.7175, .7175]) {
      const rail=box(length,.09,.1,'#555655',0,h+.16,z);
      rail.name='bridge-track-rail';g.add(rail);
    }
  }
  if (alongV) g.rotation.y = -Math.PI / 2;
  return g;
}
