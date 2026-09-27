// Small standing figures authored as `figure` extras in overrides.json.
// Human scale (about 2 m), feet at y = 0, facing local +z; the extra's pose
// (or the doorstep it is anchored to) turns +z toward the street.

import * as THREE from 'three';
import { mat, rbox } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function add(parent, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

// Rounded box (kit.js) with its own material.
const box = (parent, w, h, d, material, x, y, z, r = 0.02, rx = 0, ry = 0, rz = 0) =>
  add(parent, rbox(w, h, d, 0, r).geometry, material, x, y, z, rx, ry, rz);

// Faceted plate that narrows from bottom to top (w/d at y = -h/2 and +h/2);
// `lean` pushes the top face forward (+z). Armour plates are cut like this.
function plateGeo(wBot, wTop, h, dBot, dTop, lean = 0) {
  const geo = new THREE.BoxGeometry(1, h, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0;
    p.setX(i, p.getX(i) * (top ? wTop : wBot));
    p.setZ(i, p.getZ(i) * (top ? dTop : dBot) + (top ? lean : 0));
  }
  geo.computeVertexNormals();
  return geo;
}
const plate = (parent, dims, material, x, y, z, rx = 0, ry = 0, rz = 0) =>
  add(parent, plateGeo(...dims), material, x, y, z, rx, ry, rz);

// A limb segment from A to B: a group at A whose +y runs to B and whose +z
// leans toward `front`, so plates can be placed in limb-local coordinates.
function bone(parent, A, B, front) {
  const y = B.clone().sub(A);
  const length = y.length();
  y.normalize();
  const z = front.clone().sub(y.clone().multiplyScalar(front.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const g = new THREE.Group();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  g.position.copy(A);
  parent.add(g);
  return { g, length };
}

// Two-bone reach: the elbow for shoulder S, hand H, bending toward `pole`.
function elbow(S, H, upper, lower, pole) {
  const u = H.clone().sub(S);
  const d = Math.min(u.length(), (upper + lower) * 0.995);
  u.normalize();
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const lift = Math.sqrt(Math.max(0, upper * upper - along * along));
  const p = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
  return S.clone().add(u.multiplyScalar(along)).add(p.multiplyScalar(lift));
}

// MA5 assault rifle along local +z (muzzle forward), grip below.
function rifle(gun, dark) {
  const g = new THREE.Group();
  box(g, 0.075, 0.11, 0.36, gun, 0, 0, 0, 0.015);                            // receiver
  box(g, 0.08, 0.07, 0.2, gun, 0, 0.005, 0.26, 0.015);                       // shroud
  add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.1, 6), dark, 0, 0.01, 0.4, Math.PI / 2);   // muzzle
  box(g, 0.05, 0.035, 0.14, dark, 0, 0.07, 0.02, 0.01);                      // carry rail
  box(g, 0.035, 0.03, 0.04, dark, 0, 0.065, -0.1, 0.008);                    // ammo counter
  box(g, 0.05, 0.16, 0.08, dark, 0, -0.12, 0.09, 0.012, -0.25);              // magazine
  box(g, 0.04, 0.1, 0.045, dark, 0, -0.09, -0.07, 0.01, 0.3);                // pistol grip
  box(g, 0.06, 0.1, 0.2, gun, 0, -0.02, -0.25, 0.015);                       // stock
  return g;
}

// Master Chief (Halo): olive MJOLNIR plates over a dark undersuit, heavy
// pauldrons, greaves and boots, the MA5 rifle held low across the body, and
// the helmet with its gold reflective visor under a sloped brow.
function masterChief() {
  const g = new THREE.Group();
  g.name = 'figure-master-chief';
  const armor = mat(0x5f6b45, { roughness: 0.42, metalness: 0.2 });
  const trim = mat(0x6e7a52, { roughness: 0.46, metalness: 0.18 });
  const suit = mat(0x2c2e2b, { roughness: 0.72, metalness: 0.1 });
  const steel = mat(0x4a4d4c, { roughness: 0.45, metalness: 0.5 });
  const gun = mat(0x3a3e42, { roughness: 0.4, metalness: 0.55 });
  // The visor is mirror-gold: it catches the sky by day and keeps a steady
  // amber glint under the porch lamp at night (lighting.js nightEmission).
  const visor = mat(0xe0a235, { roughness: 0.16, metalness: 0.85, emissive: 0x7a4406, emissiveIntensity: 0.35 });
  visor.userData.nightEmission = { day: 0.35, night: 0.75 };

  for (const s of [-1, 1]) {                                                // s = +1 is his left
    // Leg: hip, knee, ankle in a slight A stance.
    const hip = V(s * 0.1, 0.96, 0), knee = V(s * 0.125, 0.53, 0.025), ankle = V(s * 0.14, 0.13, 0);
    const thigh = bone(g, hip, knee, V(0, 0, 1)).g;
    add(thigh, new THREE.CylinderGeometry(0.08, 0.098, 0.46, 8), suit, 0, 0.22, 0);
    plate(thigh, [0.15, 0.13, 0.3, 0.06, 0.05, 0.01], armor, 0, 0.2, 0.07);    // front thigh plate
    plate(thigh, [0.06, 0.05, 0.26, 0.15, 0.13], armor, s * 0.075, 0.2, 0);  // outer thigh plate
    const shin = bone(g, knee, ankle, V(0, 0, 1)).g;
    plate(shin, [0.14, 0.12, 0.13, 0.12, 0.08, 0.02], trim, 0, 0.02, 0.06);      // knee pad
    plate(shin, [0.14, 0.17, 0.36, 0.16, 0.2, -0.015], armor, 0, 0.21, -0.005); // greave
    plate(shin, [0.07, 0.09, 0.22, 0.03, 0.03], trim, 0, 0.22, 0.1);            // shin ridge
    // Boot: armoured upper and toe cap on a dark sole.
    box(g, 0.15, 0.05, 0.3, suit, s * 0.145, 0.025, 0.045, 0.015);
    plate(g, [0.15, 0.13, 0.1, 0.25, 0.16, -0.03], armor, s * 0.145, 0.1, 0.035);
    plate(g, [0.13, 0.1, 0.05, 0.1, 0.07], trim, s * 0.145, 0.075, 0.15);

    // Hip plates hang beside the thigh.
    plate(g, [0.07, 0.06, 0.16, 0.2, 0.18], armor, s * 0.2, 0.9, 0, 0, 0, s * 0.08);

    // Pauldron: two stacked plates tipped down over the arm.
    box(g, 0.2, 0.2, 0.28, armor, s * 0.305, 1.45, -0.01, 0.05, 0, 0, -s * 0.2);
    box(g, 0.06, 0.1, 0.2, trim, s * 0.39, 1.42, -0.01, 0.02, 0, 0, -s * 0.2);     // pauldron rim
  }

  // Waist and torso.
  box(g, 0.34, 0.16, 0.22, suit, 0, 0.97, 0, 0.04);                          // pelvis
  plate(g, [0.1, 0.18, 0.17, 0.06, 0.07], armor, 0, 0.93, 0.11);             // cod plate
  box(g, 0.36, 0.05, 0.24, steel, 0, 1.06, 0, 0.015);                        // belt
  box(g, 0.08, 0.07, 0.05, suit, 0.13, 1.04, 0.12, 0.01);                    // belt pouch
  box(g, 0.08, 0.07, 0.05, suit, -0.13, 1.04, 0.12, 0.01);
  plate(g, [0.26, 0.34, 0.15, 0.19, 0.23], suit, 0, 1.15, 0);                // abdomen
  box(g, 0.2, 0.025, 0.03, steel, 0, 1.13, 0.11, 0.008);                     // ab ribbing
  box(g, 0.2, 0.025, 0.03, steel, 0, 1.18, 0.12, 0.008);
  plate(g, [0.4, 0.56, 0.3, 0.27, 0.3, 0.015], armor, 0, 1.37, 0.005);       // chest
  plate(g, [0.16, 0.22, 0.2, 0.05, 0.05, 0.01], trim, 0.11, 1.38, 0.155, -0.08, 0, 0);   // pectoral plates
  plate(g, [0.16, 0.22, 0.2, 0.05, 0.05, 0.01], trim, -0.11, 1.38, 0.155, -0.08, 0, 0);
  box(g, 0.035, 0.18, 0.04, suit, 0, 1.37, 0.17, 0.01);                      // sternum seam
  plate(g, [0.38, 0.4, 0.34, 0.1, 0.1], armor, 0, 1.33, -0.19);              // back pack
  plate(g, [0.32, 0.24, 0.1, 0.22, 0.2], suit, 0, 1.56, -0.02);              // collar
  plate(g, [0.34, 0.3, 0.12, 0.06, 0.05], armor, 0, 1.6, -0.12, 0.3, 0, 0);   // raised back collar
  add(g, new THREE.CylinderGeometry(0.065, 0.075, 0.12, 8), suit, 0, 1.6, 0);   // neck

  // MA5 held low across the body: stock by his right ribs, muzzle down to
  // the left of his hips.
  const gunGroup = rifle(gun, suit);
  gunGroup.position.set(-0.01, 1.12, 0.26);
  gunGroup.lookAt(V(0.3, 0.92, 0.42));
  g.add(gunGroup);
  gunGroup.updateMatrix();
  const onGun = (x, y, z) => V(x, y, z).applyMatrix4(gunGroup.matrix);
  const hands = { [-1]: onGun(0, -0.1, -0.07), [1]: onGun(-0.02, -0.035, 0.2) };

  // Arms reach the rifle from the shoulders, elbows out and back.
  for (const s of [-1, 1]) {
    const S = V(s * 0.27, 1.43, -0.01), H = hands[s];
    const E = elbow(S, H, 0.31, 0.3, V(s * 0.7, -0.2, -0.6));
    const upper = bone(g, S, E, V(s * 1, 0, 0));
    add(upper.g, new THREE.CylinderGeometry(0.07, 0.064, upper.length, 8), suit, 0, upper.length / 2, 0);
    plate(upper.g, [0.11, 0.13, 0.2, 0.05, 0.05], armor, 0, upper.length * 0.55, 0.06);    // outer bicep plate
    const fore = bone(g, E, H, V(s * 1, 0, 0));
    plate(fore.g, [0.13, 0.11, fore.length * 0.8, 0.13, 0.11], armor, 0, fore.length * 0.42, 0);  // gauntlet
    box(fore.g, 0.05, fore.length * 0.5, 0.03, steel, 0, fore.length * 0.45, 0.065, 0.01);
    add(fore.g, new THREE.SphereGeometry(0.06, 8, 6), suit, 0, 0, 0);                    // elbow joint
    box(fore.g, 0.085, 0.11, 0.1, steel, 0, fore.length + 0.02, 0, 0.025);               // gloved hand
  }

  // Helmet: a faceted dome with the visor wrapped around its front, a sloped
  // brow over the visor, the angled mouth guard, and the side ear pieces.
  const head = new THREE.Group();
  head.position.set(0, 1.74, 0.015);
  g.add(head);
  const dome = add(head, new THREE.SphereGeometry(0.14, 10, 8), armor, 0, 0.005, -0.01);
  dome.scale.set(0.98, 1.02, 1.12);
  const shell = add(head, new THREE.SphereGeometry(0.148, 14, 6, Math.PI / 2 - 0.95, 1.9, 1.38, 0.56), visor, 0, 0.005, -0.004);
  shell.scale.set(0.98, 1.02, 1.12);
  plate(head, [0.22, 0.17, 0.04, 0.09, 0.06], armor, 0, 0.07, 0.1, -0.5, 0, 0);   // brow
  box(head, 0.04, 0.02, 0.15, trim, 0, 0.142, -0.035, 0.008);            // crown ridge
  plate(head, [0.12, 0.22, 0.09, 0.08, 0.12, 0.035], armor, 0, -0.1, 0.075, -0.12, 0, 0); // mouth guard
  box(head, 0.1, 0.022, 0.02, suit, 0, -0.1, 0.15, 0.006);                            // breather vent
  for (const s of [-1, 1]) {
    plate(head, [0.04, 0.05, 0.13, 0.14, 0.12], armor, s * 0.11, -0.06, 0.02, 0, 0, -s * 0.12);     // cheek
    add(head, new THREE.CylinderGeometry(0.032, 0.036, 0.03, 8), steel, s * 0.133, -0.005, -0.02, 0, 0, Math.PI / 2);  // ear piece
  }
  return g;
}

const CHARACTERS = { 'master-chief': masterChief };

// Left-right mirror image of a figure, flattened into its geometry. A
// negative scale would turn the faces inside out once bake.js merges meshes
// by their world matrices, so each mesh is re-expressed in the root's frame,
// reflected in x, and its triangle winding reversed to keep it front-facing.
function mirrored(g) {
  g.updateMatrixWorld(true);
  const flip = new THREE.Matrix4().makeScale(-1, 1, 1), meshes = [];
  g.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) {
    const geo = mesh.geometry.clone().applyMatrix4(flip.clone().multiply(mesh.matrixWorld));
    if (geo.index) {
      const idx = geo.index.array;
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    } else {
      for (const attr of Object.values(geo.attributes)) {
        for (let i = 0; i < attr.count; i += 3) for (let k = 0; k < attr.itemSize; k++) {
          const a = attr.getComponent(i + 1, k);
          attr.setComponent(i + 1, k, attr.getComponent(i + 2, k)); attr.setComponent(i + 2, k, a);
        }
      }
    }
    const copy = new THREE.Mesh(geo, mesh.material);
    mesh.removeFromParent();
    g.add(copy);
  }
  for (const child of [...g.children]) if (!child.isMesh) child.removeFromParent();   // emptied limb groups
  return g;
}

export function buildFigure(ex = {}) {
  const make = CHARACTERS[ex.character];
  if (!make) return null;
  const g = ex.mirror ? mirrored(make()) : make();   // mirror: e.g. the left of a flanking pair
  g.scale.setScalar(ex.scale ?? 1.05);
  return g;
}
