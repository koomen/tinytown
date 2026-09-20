// Bake a finished, static diorama into as few draw calls as possible.
//
// The generators build with thousands of little meshes, most of them plain
// flat-colour MeshStandardMaterials (and, thanks to jitterColor, most of those
// colours unique). Left alone that is a draw call per prop, twice over once the
// shadow pass is counted. Here every plain-coloured surface gets its colour
// written into a vertex attribute and merged into ONE mesh under the shared
// vertex-colour material; instanced meshes (roof tiles, stones, curbs, tufts)
// are expanded into the same mesh. Remaining opaque materials — emissive glass
// and lamps, the double-sided skirt — are merged per distinct material
// signature. Transparent meshes and textured faces (shop signs) stay separate.
//
// Speed matters here: Avon has ~40k instances and thousands of props, and the
// bake runs on every page load. So nothing is cloned or merged geometry by
// geometry. Each batch is measured first, one set of typed arrays is allocated,
// and every source is transformed straight into it.
//
// userData.keep on a mesh leaves it untouched. On a Group it means "this is a
// container the viewer animates inside": the group survives (world transform
// preserved) holding whatever children can't be baked, while its bakeable
// children are merged away. Chimneys work this way — the bricks bake, the smoke
// puffs stay in the group so the viewer keeps animating them in local space.
//
// userData.castShadow === false opts a kept object out of the shadow pass.

import * as THREE from 'three';
import { vmat, imat } from './kit.js';
import { surfaceMaterial, usesPaneUV, usesSurfaceUV } from './materials.js';

// A "plain" material differs from vmat only by its colour, so it can become
// vertex colours under vmat with no visible change.
function isPlain(m) {
  return !!m.isMeshStandardMaterial
    && !m.userData.surface
    && !m.transparent && m.opacity === 1 && m.alphaTest === 0 && !m.wireframe
    && !m.map && !m.emissiveMap && !m.alphaMap && !m.normalMap && !m.bumpMap
    && !m.roughnessMap && !m.metalnessMap && !m.aoMap
    && m.emissive.getHex() === 0
    && m.roughness === vmat.roughness && m.metalness === vmat.metalness
    && m.side === THREE.FrontSide && !m.flatShading;
}

// Must stay its own mesh: blending order matters, or a texture is involved
function isStandalone(m) {
  return m.transparent || !!m.map || !!m.alphaMap || !!m.emissiveMap;
}

function signature(m) {
  return [
    m.type, m.color?.getHex(), m.emissive?.getHex(), m.emissiveIntensity, m.roughness, m.metalness,
    m.side, !!m.vertexColors, !!m.flatShading, m.opacity, m.depthWrite,
  ].join('|');
}

// Non-indexed copy of a vertex range (multi-material groups kept standalone)
function sliceNonIndexed(geo, start, count) {
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name];
    out.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
  }
  return out;
}

// One merge target: a material plus the sources that will be written into it.
// A source is a vertex range of a geometry with a world matrix and a tint.
class Batch {
  constructor(material, withColor, withUV = false, compactNormals = false) {
    this.material = material;
    this.withColor = withColor; // whether the merged geometry carries vertex colours at all
    this.withUV = withUV;
    this.compactNormals = compactNormals;
    this.sources = [];
    this.verts = 0;
    this.indices = 0;
  }

  add(geo, matrix, tint, useVertexColors, start = 0, count = -1) {
    if (!geo.attributes.normal) geo.computeVertexNormals(); // once per geometry, shared by all its instances
    const whole = count < 0;
    const n = whole ? geo.attributes.position.count : count;
    this.sources.push({ geo, matrix, tint, useVertexColors, start, count: n, whole });
    this.verts += n;
    this.indices += whole && geo.index ? geo.index.count : n;
  }

  build() {
    const V = this.verts, I = this.indices;
    const pos = new Float32Array(V * 3);
    const nor = this.compactNormals ? new Int16Array(V * 3) : new Float32Array(V * 3);
    const col = this.withColor ? new Uint16Array(V * 3) : null; // normalised: half the bytes of floats, no visible banding
    const uv = this.withUV ? new Float32Array(V * 2) : null;
    const idx = V > 65535 ? new Uint32Array(I) : new Uint16Array(I);
    const nm = new THREE.Matrix3();
    let vo = 0, io = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    // Plain xyz Float32 attributes (everything three's geometries produce) are
    // read straight from their arrays; anything else goes through the accessors.
    const raw = (a) => (a && a.itemSize === 3 && !a.normalized && a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) ? a.array : null;
    for (const s of this.sources) {
      const p = s.geo.attributes.position, nrm = s.geo.attributes.normal, c = s.useVertexColors ? s.geo.attributes.color : null;
      const pa = raw(p), na = raw(nrm), ca = c ? raw(c) : null;
      const e = s.matrix.elements;
      // Pack a stable per-pane ID into the unused integer part of U. This
      // survives merging without another attribute buffer or material.
      const paneId = 1 + Math.floor((Math.sin(e[12]*12.9898 + e[13]*37.719 + e[14]*78.233)*43758.5453 % 1 + 1) % 1 * 4096);
      nm.getNormalMatrix(s.matrix);
      const m = nm.elements;
      const tr = s.tint ? s.tint[0] : 1, tg = s.tint ? s.tint[1] : 1, tb = s.tint ? s.tint[2] : 1;
      for (let i = 0; i < s.count; i++) {
        const si = s.start + i, o = (vo + i) * 3, s3 = si * 3;
        const x = pa ? pa[s3] : p.getX(si), y = pa ? pa[s3 + 1] : p.getY(si), z = pa ? pa[s3 + 2] : p.getZ(si);
        const px = e[0] * x + e[4] * y + e[8] * z + e[12], py = e[1] * x + e[5] * y + e[9] * z + e[13], pz = e[2] * x + e[6] * y + e[10] * z + e[14];
        pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz;
        if (uv && s.geo.attributes.uv) {
          uv[(vo+i)*2] = s.geo.attributes.uv.getX(si) + (usesPaneUV(this.material.userData.surface) ? paneId*2 : 0);
          uv[(vo+i)*2+1] = s.geo.attributes.uv.getY(si);
        }
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
        if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
        const nx = na ? na[s3] : nrm.getX(si), ny = na ? na[s3 + 1] : nrm.getY(si), nz = na ? na[s3 + 2] : nrm.getZ(si);
        const tx = m[0] * nx + m[3] * ny + m[6] * nz, ty = m[1] * nx + m[4] * ny + m[7] * nz, tz = m[2] * nx + m[5] * ny + m[8] * nz;
        const L = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        if (this.compactNormals) {
          nor[o] = Math.round(tx / L * 32767); nor[o + 1] = Math.round(ty / L * 32767); nor[o + 2] = Math.round(tz / L * 32767);
        } else {
          nor[o] = tx / L; nor[o + 1] = ty / L; nor[o + 2] = tz / L;
        }
        if (col) {
          let r = tr, g = tg, b = tb;
          if (c) {
            if (ca) { r *= ca[s3]; g *= ca[s3 + 1]; b *= ca[s3 + 2]; }
            else { r *= c.getX(si); g *= c.getY(si); b *= c.getZ(si); }
          }
          col[o] = r <= 0 ? 0 : r >= 1 ? 65535 : (r * 65535 + 0.5) | 0;
          col[o + 1] = g <= 0 ? 0 : g >= 1 ? 65535 : (g * 65535 + 0.5) | 0;
          col[o + 2] = b <= 0 ? 0 : b >= 1 ? 65535 : (b * 65535 + 0.5) | 0;
        }
      }
      if (s.whole && s.geo.index) {
        const ia = s.geo.index.array;
        if (vo === 0) idx.set(ia, io);
        else for (let k = 0; k < ia.length; k++) idx[io + k] = ia[k] + vo;
        io += ia.length;
      } else {
        for (let k = 0; k < s.count; k++) idx[io + k] = vo + k;
        io += s.count;
      }
      vo += s.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3, this.compactNormals));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    // Bounds are known from the pass above; saves three a walk over millions of vertices at first render
    if (V) {
      geo.boundingBox = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      geo.boundingSphere = new THREE.Sphere(c, c.distanceTo(geo.boundingBox.max));
    }
    return geo;
  }
}

export function bake(root, { preserveInstances = false, compactNormals = false } = {}) {
  root.updateMatrixWorld(true);
  const out = new THREE.Group();
  const plain = new Batch(vmat, true, false, compactNormals);   // -> one mesh under vmat
  const byMat = new Map();               // signature -> Batch
  const kept = [];                       // objects that survive as themselves
  const standalone = [];                 // [material, geometry] pairs made into fresh meshes
  const nonIndexed = new Map();          // geometry -> non-indexed copy (multi-material groups)

  const route = (material, geo, matrix, tint, start = 0, count = -1) => {
    if (material.userData.surface) {
      const {surface:kind,nightWindows} = material.userData, key = `surface:${kind}:${nightWindows || 'varied'}`;
      if (!byMat.has(key)) byMat.set(key, new Batch(surfaceMaterial(kind, 0xffffff, true, {nightWindows}), true, usesSurfaceUV(kind), compactNormals));
      byMat.get(key).add(geo, matrix, tint, !!material.vertexColors, start, count);
    } else if (isPlain(material)) {
      plain.add(geo, matrix, tint, !!material.vertexColors, start, count);
    } else {
      const key = signature(material);
      if (!byMat.has(key)) byMat.set(key, new Batch(material, !!material.vertexColors, false, compactNormals));
      byMat.get(key).add(geo, matrix, null, !!material.vertexColors, start, count);
    }
  };
  const rgb = (c) => [c.r, c.g, c.b];

  const bakeMesh = (o) => {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.length === 1) {
      if (isStandalone(mats[0])) kept.push(o); // keep the very object: smoke puffs are animated by reference
      else route(mats[0], o.geometry, o.matrixWorld, rgb(mats[0].color));
      return;
    }
    let geo = o.geometry;
    if (geo.index) {
      if (!nonIndexed.has(geo)) nonIndexed.set(geo, geo.toNonIndexed());
      geo = nonIndexed.get(geo);
    }
    const n = geo.attributes.position.count;
    for (const grp of geo.groups) {
      const count = grp.count === Infinity ? n - grp.start : grp.count;
      if (count <= 0) continue;
      const m = mats[grp.materialIndex];
      if (isStandalone(m)) standalone.push([m, sliceNonIndexed(geo, grp.start, count).applyMatrix4(o.matrixWorld)]);
      else route(m, geo, o.matrixWorld, rgb(m.color), grp.start, count);
    }
  };

  const expandInstanced = (o) => {
    const material = o.material, base = rgb(material.color), col = new THREE.Color();
    for (let i = 0; i < o.count; i++) {
      const m4 = new THREE.Matrix4();
      o.getMatrixAt(i, m4);
      m4.premultiply(o.matrixWorld);
      let tint = base;
      if (o.instanceColor) { o.getColorAt(i, col); tint = [base[0] * col.r, base[1] * col.g, base[2] * col.b]; }
      route(material, o.geometry, m4, tint);
    }
  };

  const visit = (o) => {
    if (o.visible === false) return;
    if (o.isMesh || o.isInstancedMesh) {
      if (o.userData.keep || (preserveInstances && o.isInstancedMesh)) kept.push(o);
      else if (o.isInstancedMesh) expandInstanced(o);
      else bakeMesh(o);
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);

  if (plain.verts) out.add(new THREE.Mesh(plain.build(), vmat));
  for (const b of byMat.values()) out.add(new THREE.Mesh(b.build(), b.material));
  for (const [material, geo] of standalone) out.add(new THREE.Mesh(geo, material));

  // Kept objects: inside a kept group they stay children of a stand-in for that
  // group (same world transform), so local-space animation keeps working.
  const containers = new Map();
  for (const o of kept) {
    const p = o.parent;
    if (p && p !== root && p.userData.keep && !p.isMesh) {
      let c = containers.get(p);
      if (!c) {
        c = new THREE.Group();
        c.userData.keep = true;
        p.matrixWorld.decompose(c.position, c.quaternion, c.scale);
        out.add(c);
        containers.set(p, c);
      }
      c.add(o); // o.position etc. are already relative to p
    } else {
      o.matrixWorld.decompose(o.position, o.quaternion, o.scale);
      out.add(o);
    }
  }

  // Shadows: everything opaque casts and receives unless it opted out
  out.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m.transparent) { o.castShadow = false; o.receiveShadow = false; return; }
    o.castShadow = o.userData.castShadow !== false;
    o.receiveShadow = true;
  });

  return out;
}

// Share repeated rounded frames, pillars, and other plain kit parts on phones.
// Explicitly marked opaque parts may also share their original material (lamp
// bulbs retain emission). Surface shaders, signs and animated objects follow
// the normal bake path. Keep small groups merged to avoid excessive draw calls.
function instanceRepeatedParts(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const visit = o => {
    if (!o.visible || o.userData.keep) return;
    if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material)
        && (isPlain(o.material) || (o.userData.instanceSharedMaterial && !isStandalone(o.material)))
        && o.matrixWorld.determinant() > 0) {
      const materialKey = isPlain(o.material) ? `plain:${!!o.material.vertexColors}` : o.material.uuid;
      const key = `${o.geometry.uuid}:${materialKey}:${o.userData.castShadow !== false}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    for (const child of o.children) visit(child);
  };
  visit(root);
  const inverseRoot = root.matrixWorld.clone().invert(), matrix = new THREE.Matrix4();
  let sharedParts = 0;
  for (const objects of groups.values()) {
    const first = objects[0], geometry = first.geometry;
    const savedBytes = geometry.attributes.position.count * 30 * (objects.length - 1);
    if (!first.userData.instanceVegetation && (objects.length < 6 || savedBytes < 65536)) continue;
    const plain = isPlain(first.material);
    const mesh = new THREE.InstancedMesh(geometry, plain ? (first.material.vertexColors ? vmat : imat) : first.material, objects.length);
    if(first.userData.instanceVegetation)mesh.userData.instanceVegetation=true;
    mesh.userData.castShadow = first.userData.castShadow !== false;
    objects.forEach((o, i) => {
      mesh.setMatrixAt(i, matrix.multiplyMatrices(inverseRoot, o.matrixWorld));
      if (plain) mesh.setColorAt(i, o.material.color);
      o.removeFromParent();
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    root.add(mesh);
    sharedParts += objects.length;
  }
  return sharedParts;
}

// Merge a bounded portion of the staging scene at a time, releasing its source
// object graph before allocating the next portion. Existing instanced meshes
// stay instanced. Geometry/detail on the buildings is unchanged.
export async function bakeMobile(root, { chunkVertices = 200000, yieldBuild = () => new Promise(r => setTimeout(r, 0)) } = {}) {
  const sharedParts = instanceRepeatedParts(root);
  const out = new THREE.Group();
  let chunks = 0;
  const vertexCount = o => {
    if (!o.visible || o.userData.keep || o.isInstancedMesh) return 0;
    let n = o.isMesh ? o.geometry.attributes.position.count : 0;
    for (const child of o.children) n += vertexCount(child);
    return n;
  };
  const flush = chunk => {
    const baked = bake(chunk, { preserveInstances: true, compactNormals: true });
    for (const child of [...baked.children]) out.add(child);
    // Live geometries are owned by out; construction geometries were never
    // uploaded to WebGL. Drop references instead of disposing shared assets.
    chunk.clear();
  };
  while (root.children.length) {
    let chunk = new THREE.Group(), vertices = 0;
    chunk.matrix.copy(root.matrixWorld);
    chunk.matrixAutoUpdate = false;
    while (root.children.length) {
      const child = root.children[0], count = vertexCount(child);
      if (chunk.children.length && vertices + count > chunkVertices) break;
      chunk.add(child);
      vertices += count;
    }
    flush(chunk);
    chunk = null;
    chunks++;
    await yieldBuild();
  }
  out.userData.mobileBake = { sharedParts, chunks };
  return out;
}
