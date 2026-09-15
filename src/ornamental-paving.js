// Mapped plaza paving stays on the same piecewise-planar terrain as streets.
// Brick joints are a shared procedural material, retained by surface exports.
import * as THREE from 'three';
import { drapeTriangles } from './landmark-drape.js';
import { ribbonStrip } from './landmark-ribbon.js';
import { surfaceMaterial } from './materials.js';
import { WALK_LEVEL } from './street-grade.js';

function drapedMesh(points, indices, grade, grid, lift, material, name) {
  const data = drapeTriangles(points, indices, grade, grid, lift);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildOrnamentalPaving(feature, grade = () => 0, grid = null) {
  const group = new THREE.Group();
  group.name = `paving-${feature.id}`;
  const lift = feature.lift ?? WALK_LEVEL + .012;
  const material = surfaceMaterial(feature.surface || 'paving-brick', feature.color || '#a76f5c');
  let points, indices;
  if (feature.closed) {
    const shape = new THREE.Shape(feature.pts.map(([x,z]) => new THREE.Vector2(x,-z)));
    for (const ring of feature.holes || []) shape.holes.push(new THREE.Path(ring.map(([x,z]) => new THREE.Vector2(x,-z))));
    const flat = new THREE.ShapeGeometry(shape);
    const positions = flat.attributes.position;
    points = Array.from({length: positions.count}, (_,i) => [positions.getX(i), -positions.getY(i)]);
    indices = Array.from(flat.index.array);
    flat.dispose();
  } else {
    const strip = ribbonStrip(feature.pts, feature.width || 3, false);
    points = strip.positions; indices = strip.indices;
  }
  // These established names opt into terrain surface sector partitioning.
  group.add(drapedMesh(points, indices, grade, grid, lift, material, 'landmark-surface'));
  if (feature.edgeWidth && feature.closed) {
    const edgeMaterial = surfaceMaterial('paving-stone', feature.edgeColor || '#b8b0a0');
    for (const ring of [feature.pts, ...(feature.holes || [])]) {
      const edge = ribbonStrip(ring, feature.edgeWidth, true);
      group.add(drapedMesh(edge.positions, edge.indices, grade, grid, lift + .008, edgeMaterial, 'landmark-ribbon'));
    }
  }
  return group;
}
