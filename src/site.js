// Real-world site generator. generateSite(site, seed) turns a site.json built
// by pipeline/build_site.py (OpenStreetMap footprints and roads, USGS terrain,
// hand-written building styles) into a soft Tiny Glade-style diorama.
// Coordinates are metres: x = east, z = south, y = up.

import * as THREE from 'three';
import { makeRng } from './rng.js';
import { P } from './palette.js';
import { fbm } from './noise.js';
import {
  mat, vmat, imat, box, rbox, jitterColor, wobble, paintVertices,
  gableRoof, glowMat, buildWindow, buildChimney, buildTree, buildBush,
  scatterTufts, scatterFlowers, buildFlowerCluster, buildLamp, buildStoneWall, buildBench, grainy,
  clearConstructionCaches,
} from './kit.js';

import { WALL_COLORS, ROOF_COLORS, col } from './colors.js';
import { buildBlueprint, blueprintFrontages } from './blueprint.js';
import { foundationSupportsVolume } from './foundation-support.js';
import { facadeMaterial, surfaceMaterial, usesPaneUV } from './materials.js';
import { bakeMobile } from './bake.js';
import { pavementGeometry, finishPavement } from './pavement.js';
import { polygonDistanceField } from './polygon-distance.js';
import { unpackSurfaces } from './surface-assets.js';
import { createStreetGrade, ROAD_LEVEL, WALK_LEVEL } from './street-grade.js';
import { buildParking } from './parking.js';
import { buildMappedParking, buildParkingPaint } from './mapped-parking.js';
import { bridgeGrade } from './bridge-grade.js';
import { amphitheaterGrade } from './amphitheater-grade.js';
import { amphitheaterGardenGrade } from './amphitheater-garden-grade.js';
import { roadWaterCrossings } from './road-water-crossings.js';
import { lakeGrade } from './lake-grade.js';
import { terrainGrid, axisFraction, townDensity, pavementGrid } from './terrain-grid.js';
import { terrainPaintNoise } from './terrain-paint.js';
import { buildLandmarks } from './landmarks.js';
import { shiftLandmark } from './landmark-frame.js';
import { buildRailways } from './railways.js';
import { buildLandscapeTree, treeSpacing } from './vegetation.js';
import { smoothWatercourse } from './watercourse.js';
import { createDioramaOutline, clipDioramaObject, applyDioramaOutline } from './diorama-outline.js';
export { WALL_COLORS, ROOF_COLORS };

const FLOOR_H = { house: 3.0, garage: 2.7, commercial: 3.5, church: 5.0, civic: 3.8, pavilion: 3.2 };


// ---------------------------------------------------------------------------
// Geometry helpers on x/z polygons

function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % pts.length];
    a += x0 * z1 - x1 * z0;
  }
  return a / 2;
}

function pointInPoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function bboxOf(pts, pad = 0) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
}

function distToSegSquared(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  const x = px - (ax + t * dx), z = pz - (az + t * dz);
  return x * x + z * z;
}

function distToSeg(...args) { return Math.sqrt(distToSegSquared(...args)); }

function distToPolyline(pts, x, z) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, distToSegSquared(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return Math.sqrt(d);
}

// Distance from a point to a polygon's boundary (positive outside, negative inside)
function signedDistToPoly(pts, x, z) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    d = Math.min(d, distToSegSquared(x, z, a[0], a[1], b[0], b[1]));
  }
  return (pointInPoly(pts, x, z) ? -1 : 1) * Math.sqrt(d);
}

// Shrink/grow a polygon about its centroid (good enough for parapets/insets)
function scalePoly(pts, cx, cz, k) {
  return pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
}

function shapeFrom(pts) {
  // THREE.Shape lives in XY; we map x→x, z→y and later rotate so the
  // extrusion runs along world -y (see extrudeFootprint).
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

// Extrude a footprint downward from y=top by `height`. Returns geometry with
// material groups [caps, sides].
function extrudeFootprint(pts, top, height) {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: height, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // (x, y=z, e) → (x, -e, z)
  geo.translate(0, top, 0);
  return geo;
}

// ---------------------------------------------------------------------------
// Terrain

class Terrain {
  constructor(t) {
    this.t = t;
    this.cols = t.cols;
    this.rows = t.rows;
  }

  // Bilinear sample of the raw heightmap
  raw(x, z) {
    const { x0, z0, x1, z1, cols, rows, values } = this.t;
    const u = THREE.MathUtils.clamp(((x - x0) / (x1 - x0)) * (cols - 1), 0, cols - 1.001);
    const v = THREE.MathUtils.clamp(((z - z0) / (z1 - z0)) * (rows - 1), 0, rows - 1.001);
    const i = Math.floor(u), j = Math.floor(v);
    const fu = u - i, fv = v - j;
    const h00 = values[j * cols + i], h10 = values[j * cols + i + 1];
    const h01 = values[(j + 1) * cols + i], h11 = values[(j + 1) * cols + i + 1];
    return (h00 * (1 - fu) + h10 * fu) * (1 - fv) + (h01 * (1 - fu) + h11 * fu) * fv;
  }
}

// Build the shared terrain grade, painted by land cover, on a dirt slab.
function groundGeometry(site, terrain, coverAt, bumpScale) {
  const { w: W, h: H } = site.size;
  const {xs,zs,nx,nz} = terrainGrid(W,H,site.townCenter,site.buildings);
  const geo = new THREE.PlaneGeometry(W, H, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const covers = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const col = i % (nx+1), row = Math.floor(i / (nx+1));
    const x = xs[col], z = zs[row];
    pos.setX(i,x); pos.setZ(i,z);
    let y = terrain.raw(x, z);
    const cover = coverAt(x, z);
    covers[i] = cover === 'wood' ? 1 : cover === 'park' ? 2 : cover === 'dirt' ? 3 : cover === 'field' ? 4 : 0;
    // A vertex affects every adjacent triangle. On the sparse rural grid a
    // whole driveway or track can pass between vertices, so clear bumps over
    // that full reach rather than only checking the vertex's ground cover.
    const reach = Math.hypot(Math.max(x - xs[Math.max(0,col-1)], xs[Math.min(nx,col+1)] - x),
      Math.max(z - zs[Math.max(0,row-1)], zs[Math.min(nz,row+1)] - z));
    if (cover === 'grass' || cover === 'park') y += fbm(x * 0.3, z * 0.3) * (reach <= 1.5 ? 0.12 : 0.02) * bumpScale(x, z, reach);
    pos.setY(i, y);
  }
  geo.computeVertexNormals();
  paintGround(geo, covers, site);
  geo.userData.coverCodes = covers;
  return geo;
}

function paintGround(geo, covers, site) {
  const grassL = new THREE.Color(P.grassLight), grassD = new THREE.Color(P.grassDark);
  const parkC = new THREE.Color(0x849c62);
  const dirt = new THREE.Color(P.dirt), wood = new THREE.Color(0x5f8a45);
  // Roads, sidewalks, lots and plazas are all meshes with their own crisp
  // edges, so the ground under and around them is simply grass: no painted
  // gray halo blurring the boundary at the 1 m grid.
  paintVertices(geo, (v, n, c, i) => {
    const cover = covers[i];
    const noise = terrainPaintNoise(v.x, v.z, site), t = noise.texture;
    if (cover === 1) c.copy(wood).lerp(grassD, t);
    else if (cover === 2) c.copy(parkC).lerp(grassL, t * 0.8);
    else if (cover === 3) c.copy(dirt);
    else if (cover === 4) c.copy(grassD).lerp(grassL, t * 0.7);
    else c.copy(grassD).lerp(grassL, THREE.MathUtils.clamp(t * 0.85 + 0.075, 0, 1));
    c.offsetHSL(0, 0, noise.grain);
    // meadow drifts: broad patches a touch yellower and lighter here, bluer and
    // deeper there, so a lawn is not one green
    const m = noise.meadow;
    c.offsetHSL(-m * 0.03, m * 0.06, m * 0.06);
  });
}

function makeGround(site, terrain, coverAt, bumpScale, prepared) {
  const { w: W, h: H } = site.size;
  const g = new THREE.Group();
  const geo = prepared ?? groundGeometry(site, terrain, coverAt, bumpScale);
  if (prepared) {
    geo.computeVertexNormals();
    paintGround(geo, geo.userData.coverCodes, site);
  }
  const pos = geo.attributes.position;
  let minY = Infinity;
  for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
  const groundMesh = new THREE.Mesh(geo, vmat); groundMesh.name = 'ground'; g.add(groundMesh);

  // Skirt + slab: drop from the terrain edge down to a flat bottom
  const bottom = minY - 4;
  const edge = [];
  const {nx,nz,xs,zs} = terrainGrid(W,H,site.townCenter,site.buildings);
  const idx = (i, j) => j * (nx + 1) + i;
  for (let i = 0; i <= nx; i++) edge.push(idx(i, 0));
  for (let j = 1; j <= nz; j++) edge.push(idx(nx, j));
  for (let i = nx - 1; i >= 0; i--) edge.push(idx(i, nz));
  for (let j = nz - 1; j >= 1; j--) edge.push(idx(0, j));
  const sv = [], sc = [], si = [];
  const dirtC = new THREE.Color(P.dirt), dark = new THREE.Color(P.dirtDark);
  for (let k = 0; k < edge.length; k++) {
    const e = edge[k];
    const y = pos.getY(e);
    // 2 cm proud of the border, so a slab or sidewalk skirt that ends exactly on
    // the border (everything paved is clamped there) sits just behind the dirt
    // face instead of z-fighting with it
    const x = pos.getX(e) + (Math.abs(Math.abs(pos.getX(e)) - W / 2) < 1e-3 ? Math.sign(pos.getX(e)) * 0.02 : 0);
    const z = pos.getZ(e) + (Math.abs(Math.abs(pos.getZ(e)) - H / 2) < 1e-3 ? Math.sign(pos.getZ(e)) * 0.02 : 0);
    sv.push(x, y, z, x, bottom, z);
    const cTop = dirtC.clone().offsetHSL(0, 0, (fbm(x * 0.4, z * 0.4) - 0.5) * 0.1);
    sc.push(cTop.r, cTop.g, cTop.b, dark.r, dark.g, dark.b);
  }
  for (let k = 0; k < edge.length; k++) {
    const a = k * 2, b = ((k + 1) % edge.length) * 2;
    si.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
  skirt.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  skirt.setIndex(si);
  skirt.computeVertexNormals();
  const skirtMat = grainy(vmat.clone());
  skirtMat.side = THREE.DoubleSide;
  const skirtMesh=new THREE.Mesh(skirt,skirtMat);skirtMesh.name='ground-skirt';g.add(skirtMesh);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, H), mat(P.dirtDark));
  base.name='ground-bottom';
  base.position.y = bottom - 0.3;
  g.add(base);

  return { group: g, bottom, geo, nx, nz, xs, zs };
}

// ---------------------------------------------------------------------------
// Roads: ribbons that follow the terrain (level across their width)

function ribbonOutline(pts,width) {
  const closed=isClosed(pts),n=pts.length,m=closed?n-1:n;
  const sides=pts.map(([x,z],i)=>{
    const a=closed?pts[(i-1+m)%m]:pts[Math.max(0,i-1)];
    const b=closed?pts[(i+1)%m]:pts[Math.min(n-1,i+1)];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    const dx=-(b[1]-a[1])/length*width/2,dz=(b[0]-a[0])/length*width/2;
    return [[x+dx,z+dz],[x-dx,z-dz]];
  });
  return [...sides.map(s=>s[0]),...sides.map(s=>s[1]).reverse()];
}

function roadRibbon(pts, width, yAt, lift, colorA, colorB, seedShift, colorAt = null, skirt = 0, across = 2) {
  const n = pts.length;
  // stations across the ribbon, +1 (left) .. -1 (right): a plain count spaces
  // them evenly; an array puts vertices where the colour needs them (a gutter
  // a metre or two in from each edge, then the crown)
  const st = Array.isArray(across) ? across : Array.from({ length: across }, (_, a) => 1 - (2 * a) / (across - 1));
  const A = st.length;
  const verts = [], cols = [], idx = [];
  const ca = new THREE.Color(colorA), cb = new THREE.Color(colorB), c = new THREE.Color();
  // A closed loop (the ring road) takes its end tangents from across the seam
  // so the two ends butt together instead of leaving a wedge
  const closed = isClosed(pts);
  let along = 0;
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i];
    if (i > 0) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const p = closed ? pts[(i - 1 + n - 1) % (n - 1)] : pts[Math.max(0, i - 1)];
    const q = closed ? pts[(i + 1) % (n - 1)] : pts[Math.min(n - 1, i + 1)];
    let dx = q[0] - p[0], dz = q[1] - p[1];
    const L = Math.hypot(dx, dz) || 1;
    dx /= L; dz /= L;
    const nx = -dz, nz = dx;
    for (const s of st) {
      const px = x + nx * s * width / 2, pz = z + nz * s * width / 2;
      verts.push(px, yAt(px,pz)+lift, pz);
      // colour is a function of where the vertex is, never of which ribbon it
      // belongs to, so two ribbons overlapping at a junction paint alike there
      const t = colorAt ? colorAt(along, px, pz) : fbm(px * 0.25 + seedShift, pz * 0.25) * 0.7 + fbm(px * 1.2, pz * 1.2 + seedShift) * 0.3;
      c.copy(ca).lerp(cb, THREE.MathUtils.clamp(t, 0, 1));
      cols.push(c.r, c.g, c.b);
    }
    if (i > 0) {
      for (let a = 0; a < A - 1; a++) {
        const p0 = (i - 1) * A + a, q0 = i * A + a;
        idx.push(p0, q0, p0 + 1, p0 + 1, q0, q0 + 1);
      }
    }
  }
  const topCount = verts.length / 3;
  if (skirt > 0) {
    // Side walls hanging `skirt` below the edges, so a raised walk never shows
    // a gap to the ground. Own vertices so the top keeps its flat shading.
    const dark = new THREE.Color(colorB).multiplyScalar(0.82);
    for (let i = 0; i < n; i++) {
      for (const vi of [i * A, i * A + A - 1]) { // the two edge vertices
        const t = vi * 3;
        verts.push(verts[t], verts[t + 1], verts[t + 2]);                 // top copy
        verts.push(verts[t], verts[t + 1] - skirt, verts[t + 2]);         // bottom
        cols.push(cols[t], cols[t + 1], cols[t + 2], dark.r, dark.g, dark.b);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const A = topCount + i * 4, B = topCount + (i + 1) * 4; // per i: [+top, +bottom, -top, -bottom]
      idx.push(A, A + 1, B + 1, A, B + 1, B);           // + side, seen from outside
      idx.push(A + 2, B + 2, B + 3, A + 2, B + 3, A + 3); // - side
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // A road is flat across its width and nearly flat along it: straight-up
  // normals keep the surface from showing the terrain's facets as shading seams
  const nrm = geo.attributes.normal;
  for (let i = 0; i < topCount; i++) nrm.setXYZ(i, 0, 1, 0);
  const m = new THREE.Mesh(geo, vmat); m.name = 'ribbon';
  m.receiveShadow = true;
  return m;
}

const isClosed = (pts) => pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.35;

// Replace each corner of a polyline with an arc (radius up to `rMax`, never
// eating more than 45 % of either neighbouring segment). OSM traces service
// lanes with 90° corners; a ribbon mitred round one pokes almost a metre past
// the true offset curve, and the curb outline is the true offset curve.
function roundCorners(pts, rMax) {
  const closed = isClosed(pts);
  const ring = closed ? pts.slice(0, -1) : pts;
  const n = ring.length, out = [];
  for (let i = 0; i < n; i++) {
    const b = ring[i];
    if (!closed && (i === 0 || i === n - 1)) { out.push(b); continue; }
    const a = ring[(i - 1 + n) % n], c = ring[(i + 1) % n];
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let turn = a2 - a1;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    const th = Math.abs(turn);
    if (th < 0.12) { out.push(b); continue; }
    const La = Math.hypot(b[0] - a[0], b[1] - a[1]), Lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const t = Math.min(rMax * Math.tan(th / 2), 0.45 * La, 0.45 * Lc); // tangent length back from the corner
    const r = t / Math.tan(th / 2);
    const steps = Math.max(2, Math.ceil(th / 0.17)); // a point every ~10° of turn
    // arc centre: t along the incoming segment from b, then r to the inside of the turn
    const p0 = [b[0] - Math.cos(a1) * t, b[1] - Math.sin(a1) * t];
    const side = turn > 0 ? 1 : -1;
    const cx = p0[0] - Math.sin(a1) * r * side, cz = p0[1] + Math.cos(a1) * r * side;
    const start = Math.atan2(p0[1] - cz, p0[0] - cx);
    for (let k = 0; k <= steps; k++) {
      const ang = start + turn * (k / steps);
      out.push([cx + Math.cos(ang) * r, cz + Math.sin(ang) * r]);
    }
  }
  if (closed) out.push([...out[0]]);
  return out;
}

// Drop the points of a polyline that stray less than `tol` from the line
// between their neighbours (Douglas–Peucker); the ends always stay.
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSeg(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Points every `spacing` metres along a polyline (the last point kept)
function resample(pts, spacing) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0);
    let s = spacing - carry;
    while (s < L) { out.push([x0 + ((x1 - x0) * s) / L, z0 + ((z1 - z0) * s) / L]); s += spacing; }
    carry = L - (s - spacing);
  }
  const last = pts[pts.length - 1], prev = out[out.length - 1];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > spacing * 0.3) out.push(last); else out[out.length - 1] = last;
  return out;
}

// Resample a polyline at roughly `spacing` metres so ribbons follow terrain smoothly
function densify(pts, spacing) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(L / spacing));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n]);
  }
  return out;
}

// Grow (or shrink) a simple polygon by moving each vertex along the average of
// its two edge normals. Good enough for lot outlines; not a true buffer.
function offsetPolygon(pts, d) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % n]; area += x0 * z1 - x1 * z0; }
  const sgn = area > 0 ? 1 : -1; // outward normal depends on winding
  return pts.map(([x, z], i) => {
    const [px, pz] = pts[(i + n - 1) % n], [qx, qz] = pts[(i + 1) % n];
    const n1 = [(z - pz), -(x - px)], n2 = [(qz - z), -(qx - x)];
    const L1 = Math.hypot(...n1) || 1, L2 = Math.hypot(...n2) || 1;
    let nx = n1[0] / L1 + n2[0] / L2, nz = n1[1] / L1 + n2[1] / L2;
    const L = Math.hypot(nx, nz) || 1;
    nx /= L; nz /= L;
    return [x + nx * d * sgn, z + nz * d * sgn];
  });
}

// Clip a polygon to an axis-aligned rectangle (Sutherland-Hodgman), so a lot
// that OSM draws past the site frame doesn't hang in the air beyond the ground
function clipPolygonToRect(pts, x0, z0, x1, z1) {
  let out = pts;
  const edges = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= z0, (a, b) => [a[0] + (b[0] - a[0]) * (z0 - a[1]) / (b[1] - a[1]), z0]],
    [(p) => p[1] <= z1, (a, b) => [a[0] + (b[0] - a[0]) * (z1 - a[1]) / (b[1] - a[1]), z1]],
  ];
  for (const [inside, cross] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[(i + inp.length - 1) % inp.length], b = inp[i];
      if (inside(b)) { if (!inside(a)) out.push(cross(a, b)); out.push(b); }
      else if (inside(a)) out.push(cross(a, b));
    }
    if (out.length < 3) return [];
  }
  return out;
}

// Paved slab: a parking lot (or any paved polygon) as its own mesh. The
// polygon is triangulated, subdivided until no edge is longer than ~2 m, and
// draped on the ground, so the surface follows the terrain and the outline is
// the exact polygon rather than a smear of painted 1 m ground vertices.
function pavedSlab(pts, yAt, lift, colorA, colorB, skirt = 0.35, colorAt = null, onRibbon = () => false, maxEdge = 2.5) {
  const ring = pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : pts;
  if (ring.length < 3) return null;
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
  let tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const v = ring.map(([x, z]) => [x, z]);
  for (let pass = 0; pass < 6; pass++) {
    let longest = 0;
    for (const [a, b, c] of tris) for (const [i, j] of [[a, b], [b, c], [c, a]]) longest = Math.max(longest, Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1]));
    if (longest < maxEdge) break; // smaller facets at entrance aprons keep sloping grass from piercing the paving
    const mid = new Map();
    const m = (i, j) => {
      const k = i < j ? `${i}|${j}` : `${j}|${i}`;
      if (!mid.has(k)) { mid.set(k, v.length); v.push([(v[i][0] + v[j][0]) / 2, (v[i][1] + v[j][1]) / 2]); }
      return mid.get(k);
    };
    const next = [];
    for (const [a, b, c] of tris) {
      const ab = m(a, b), bc = m(b, c), ca = m(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
  }
  const verts = [], cols = [], idx = [];
  const ca = new THREE.Color(colorA), cb = new THREE.Color(colorB), c = new THREE.Color();
  for (const [x, z] of v) {
    verts.push(x, yAt(x, z) + lift, z);
    c.copy(ca).lerp(cb, THREE.MathUtils.clamp(colorAt ? colorAt(0, x, z) : fbm(x * 0.2 + 7, z * 0.2) * 0.9, 0, 1));
    cols.push(c.r, c.g, c.b);
  }
  for (const [a, b, cc] of tris) idx.push(a, b, cc);
  const top = verts.length / 3;
  // Skirt down the outline so no ground shows under the edge of the slab
  const dense = densify([...ring, ring[0]], 1.0);
  const dark = cb.clone().multiplyScalar(0.82);
  for (const [x, z] of dense) {
    const y = yAt(x, z) + lift;
    verts.push(x, y, z, x, y - skirt, z);
    cols.push(cb.r, cb.g, cb.b, dark.r, dark.g, dark.b);
  }
  // Wound to face outward (the outline's direction decides which way): drawing
  // both windings averaged every skirt normal to nothing and lit it black, which
  // showed wherever the skirt is exposed, like along the edge of the diorama.
  // No skirt where the edge lies over a road ribbon: on-street parking bays
  // (mapped as parking areas) overlap the street, and a skirt there hangs
  // through the asphalt as a dark hairline
  const outwardFirst = polyArea(ring) > 0;
  for (let i = 0; i < dense.length - 1; i++) {
    if (onRibbon(dense[i][0], dense[i][1]) && onRibbon(dense[i + 1][0], dense[i + 1][1])) continue;
    const A = top + i * 2, B = top + (i + 1) * 2;
    if (outwardFirst) idx.push(A, B, A + 1, A + 1, B, B + 1);
    else idx.push(A, A + 1, B, A + 1, B + 1, B);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < top; i++) nrm.setXYZ(i, 0, 1, 0); // flat-lit like the roads
  // ShapeUtils' winding depends on the polygon's; make the top face up
  let up = 0;
  for (const [a, b, cc] of tris) up += (v[b][0] - v[a][0]) * (v[cc][1] - v[a][1]) - (v[b][1] - v[a][1]) * (v[cc][0] - v[a][0]);
  if (up > 0) for (let i = 0; i < tris.length * 3; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, vmat); m.name = 'slab';
  m.receiveShadow = true;
  return m;
}

// Signed distance from (x, z) to a road strip: the centreline `dense` swept by
// half-width `hw`. Segments are joined round (so bends are smooth) but the two
// ends are square, like the ribbon; a closed loop has no ends. Negative inside.
function stripSDF(dense, hw, closed, x, z) {
  let best = Infinity;
  const last = dense.length - 2;
  for (let i = 0; i <= last; i++) {
    const [ax, az] = dense[i], [bx, bz] = dense[i + 1];
    // cheap reject: the segment's box is already farther than the best so far
    const ex = Math.max(Math.min(ax, bx) - x, x - Math.max(ax, bx), 0), ez = Math.max(Math.min(az, bz) - z, z - Math.max(az, bz), 0);
    if (best + hw > 0 && ex * ex + ez * ez >= (best + hw) * (best + hw)) continue;
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz || 1e-9;
    const t = ((x - ax) * dx + (z - az) * dz) / L2;
    let d;
    if (!closed && ((i === 0 && t < 0) || (i === last && t > 1))) {
      // past a square end: distance to the end rectangle
      const L = Math.sqrt(L2);
      const over = (t < 0 ? -t : t - 1) * L;
      const perp = Math.abs((x - ax) * -dz + (z - az) * dx) / L - hw;
      d = perp > 0 ? Math.hypot(over, perp) : over;
    } else {
      const tc = Math.max(0, Math.min(1, t));
      d = Math.hypot(x - (ax + tc * dx), z - (az + tc * dz)) - hw;
    }
    if (d < best) best = d;
  }
  return best;
}

// Curb: one pale stone lip along a paved-edge line — a narrow top a few cm
// above the surface and a chamfer sloping out to the grass. `line` is the
// edge itself; `surf` gives the paved surface height beside it and `outward`
// (+1/-1) says which side of the line's direction the grass is on. Runs break
// at the world edge; `topAt` lowers the lip at crossing ramps.
function curbAlong(line, closed, surf, outward, covered = () => false, topAt = () => 0.06) {
  const verts = [], cols = [], nors = [], idx = [];
  const base = new THREE.Color(P.curbStone), c = new THREE.Color();
  const IN = -0.015, OUT = 0.18, FOOT = 0.26;
  const BOT = -0.08;
  const k = Math.SQRT1_2;
  const n = line.length, m = closed ? n - 1 : n;
  let run = 0, up = true;
  for (let i = 0; i < n; i++) {
    const [x, z] = line[i];
    const a = closed ? line[(i - 1 + m) % m] : line[Math.max(0, i - 1)], b = closed ? line[(i + 1) % m] : line[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    const nx = (-tz / L) * outward, nz = (tx / L) * outward;
    // triangle (prev, cur, prev-outer) has normal tangent × normal = (0, tz·nx − tx·nz, 0): wind so it faces up
    if (i === 0) up = tz * nx - tx * nz > 0;
    if (covered(x, z)) { run = 0; continue; }
    const y = surf(x, z);
    const TOP = topAt(x,z);
    c.copy(base).offsetHSL(0, 0, fbm(x * 0.7 + 11, z * 0.7) * 0.06 - 0.03);
    const v0 = verts.length / 3;
    verts.push(x + nx * IN, y + TOP, z + nz * IN, x + nx * OUT, y + TOP, z + nz * OUT, x + nx * FOOT, y + BOT, z + nz * FOOT);
    nors.push(0, 1, 0, nx * 0.35, 0.94, nz * 0.35, nx * k, k, nz * k);
    cols.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b);
    if (run > 0) {
      const p = v0 - 3;
      if (up) idx.push(p, v0, p + 1, p + 1, v0, v0 + 1, p + 1, v0 + 1, p + 2, p + 2, v0 + 1, v0 + 2);
      else idx.push(p, p + 1, v0, p + 1, v0 + 1, v0, p + 1, p + 2, v0 + 1, p + 2, v0 + 2, v0 + 1);
    }
    run++;
  }
  if (!verts.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nors, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  const m3 = new THREE.Mesh(geo, vmat); m3.name = 'curb';
  m3.receiveShadow = true;
  return m3;
}

// Join ways that meet end-to-end (and nowhere else) into single polylines, so
// a sidewalk mapped as a dozen short pieces becomes one continuous ribbon with
// clean joints instead of a square-ended stub at every node.
function chainWays(ways, compatible = () => true) {
  const key = ([x, z]) => `${Math.round(x * 3)},${Math.round(z * 3)}`;
  const ends = new Map(); // node key -> ways touching it
  for (const w of ways) for (const p of [w.pts[0], w.pts[w.pts.length - 1]]) {
    const k = key(p);
    if (!ends.has(k)) ends.set(k, []);
    ends.get(k).push(w);
  }
  const used = new Set(), out = [];
  const extend = (pts, w, forward) => {
    // walk from the current end while exactly one other unused, compatible way continues it
    for (;;) {
      const end = forward ? pts[pts.length - 1] : pts[0];
      const cands = (ends.get(key(end)) || []).filter((o) => !used.has(o) && compatible(w, o));
      if (cands.length !== 1) return;
      const o = cands[0];
      used.add(o);
      w = o;
      let seg = o.pts;
      if (key(seg[seg.length - 1]) === key(end)) seg = [...seg].reverse();
      else if (key(seg[0]) !== key(end)) return;
      if (forward) pts.push(...seg.slice(1)); else pts.unshift(...seg.slice(1).reverse());
    }
  };
  for (const w of ways) {
    if (used.has(w)) continue;
    used.add(w);
    const pts = w.pts.map((p) => [...p]);
    extend(pts, w, true);
    extend(pts, w, false);
    out.push({ ...w, pts });
  }
  return out;
}

// Painted crosswalk: bars across the walking direction, spanning `width`
function zebra(run, width, yAt, lift, marking = 'zebra') {
  const g = new THREE.Group();g.name='crosswalk';
  const [x0,z0]=run[0],[x1,z1]=run[run.length-1];
  const L=Math.hypot(x1-x0,z1-z0);
  if(L<1) return g;
  const dx=(x1-x0)/L,dz=(z1-z0)/L,bar=0.55,pitch=1.15;
  const n=Math.max(1,Math.floor((L-bar)/pitch)+1);
  const start=(L-((n-1)*pitch+bar))/2+bar/2;
  // Paint keeps its exact rectangular outline and samples the road across
  // each bar, so even the steep crossings cannot swallow a flat box.
  for(let i=0;i<n;i++) {
    const along=start+i*pitch;
    const pts=[along-bar/2,along+bar/2].map(t=>[x0+dx*t,z0+dz*t]);
    const barWidth=marking==='ladder'?width-.28:width;
    g.add(roadRibbon(densify(pts,0.15),barWidth,yAt,lift,P.crosswalk,P.crosswalk,0,null,0,Math.ceil(width/0.2)));
  }
  if(marking==='ladder') for(const side of [-1,1]) {
    const offset=side*(width/2-.07);
    const pts=run.map(([x,z])=>[x-dz*offset,z+dx*offset]);
    g.add(roadRibbon(densify(pts,.15),.14,yAt,lift,P.crosswalk,P.crosswalk,0,null,0,2));
  }
  g.userData.crossingRun=run;
  return g;
}

// A small granite memorial tablet on a slab, flowers at its foot; faces -z
function buildMarker(rng) {
  const g = new THREE.Group();
  g.add(rbox(1.4, 0.14, 0.9, P.stones[0], 0.03, 0, 0.07, 0));
  g.add(rbox(0.95, 0.72, 0.22, P.stones[2], 0.04, 0, 0.14 + 0.36, 0.1));
  for (const sx of [-0.55, 0.55]) {
    const f = buildFlowerCluster(rng, 6);
    f.position.set(sx, 0, -0.55);
    f.scale.setScalar(0.8);
    g.add(f);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Buildings

function makeSign(text, wallColor) {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#2f2a26';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#f2e9d8';
  ctx.font = 'bold 54px Nunito, "SF Pro Rounded", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let t = text;
  while (ctx.measureText(t).width > cv.width - 40 && t.length > 4) t = t.slice(0, -2).trimEnd() + '…';
  ctx.fillText(t, cv.width / 2, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
}

function buildBuilding(rng, b, baseY, smokes, wallBottom = -1.2) {
  if (b.blueprint) {
    const o=b.obb,c=Math.cos(o.angle),s=Math.sin(o.angle);
    const footprint=b.footingPts.map(([x,z])=>[(x-o.cx)*c+(z-o.cz)*s,-(x-o.cx)*s+(z-o.cz)*c]);
    return buildBlueprint(rng,b,b.blueprint,baseY,smokes,
      vol=>foundationSupportsVolume(footprint,vol)?wallBottom:-1.2);
  }
  const g = new THREE.Group();
  const st = b.style;
  const kind = st.kind || 'house';
  const floors = st.floors || (kind === 'garage' ? 1 : 2);
  const floorH = st.floorH || FLOOR_H[kind] || 3;
  const H = floors * floorH;
  const pts = b.pts;
  const [cx, cz] = b.centroid;
  const wallColor = jitterColor(rng, col(WALL_COLORS, st.wall, WALL_COLORS.cream), 0.02, 0.006);
  const roofKey = st.roofColor && st.roofColor !== 'auto' ? st.roofColor : (kind === 'commercial' ? 'tar' : rng.pick(['slate', 'grey', 'brown', 'black', 'slate', 'green']));
  const roofColor = jitterColor(rng, col(ROOF_COLORS, roofKey, ROOF_COLORS.slate), 0.03);
  const trimColor = col(WALL_COLORS, st.trim, P.trim);
  const roof = st.roof || (kind === 'commercial' ? 'flat' : 'gable');

  // Walls meet the supporting foundation without overlapping its exterior
  // faces. Without a separate foundation, extend the walls below grade.
  // An optional upperWall color splits the facade at the first floor line.
  const wallH = roof === 'flat' ? H + 0.6 : H;
  if (kind === 'pavilion') {
    // Open-sided shelter: posts at the corners + along long edges, roof only
    for (const [x, z] of pts) g.add(box(0.3, H, 0.3, P.timber, x, baseY + H / 2, z));
    g.add(new THREE.Mesh(extrudeFootprint(pts, baseY + 0.25, 0.3), [mat(P.flagstone), mat(P.flagstone)]));
  } else if (st.upperWall) {
    const upper = jitterColor(rng, col(WALL_COLORS, st.upperWall, WALL_COLORS.white), 0.02, 0.006);
    g.add(new THREE.Mesh(extrudeFootprint(pts, baseY + floorH, floorH - wallBottom), [facadeMaterial(wallColor.getHex(),kind,st.wall), facadeMaterial(wallColor.getHex(),kind,st.wall)]));
    g.add(new THREE.Mesh(extrudeFootprint(pts, baseY + wallH, wallH - floorH), [surfaceMaterial('membrane',roofColor.getHex()), facadeMaterial(upper.getHex(),kind,st.upperWall)]));
  } else {
    const wallsGeo = extrudeFootprint(pts, baseY + wallH, wallH - wallBottom);
    g.add(new THREE.Mesh(wallsGeo, [surfaceMaterial('membrane',roofColor.getHex()), facadeMaterial(wallColor.getHex(),kind,st.wall)]));
  }

  // Outward normal per edge (footprint is counter-clockwise in x/z as seen from above)
  const ccw = polyArea(pts) > 0;
  const edges = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const L = Math.hypot(dx, dz) || 1;
    let nx = dz / L, nz = -dx / L;
    if (ccw) { nx = -nx; nz = -nz; }
    // sanity: normal must point away from centroid
    const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
    if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
    return { p, q, L, nx, nz, mx, mz, tx: dx / L, tz: dz / L };
  });
  // Front edge: outward normal best aligned with the direction to the road
  let front = edges[0];
  if (b.front) {
    const fx = Math.cos(b.front.dir), fz = Math.sin(b.front.dir);
    let best = -Infinity;
    for (const e of edges) {
      if (e.L < 3) continue;
      const s = (e.nx * fx + e.nz * fz) * Math.min(1, e.L / 6);
      if (s > best) { best = s; front = e; }
    }
  }

  const facing = (nx, nz) => Math.atan2(-nx, -nz); // rotation.y so local -z → (nx, nz)

  // Windows and doors along every edge
  const winW = kind === 'commercial' ? 1.1 : 0.95;
  const spacing = kind === 'church' ? 3.4 : kind === 'commercial' ? 3.3 : 2.7;
  for (const e of edges) {
    if (e.L < 2.2 || kind === 'pavilion') continue;
    const isFront = e === front;
    if (isFront && st.bays) {
      // Vehicle bays (fire station, garage): big pale doors across the front
      const n = st.bays;
      const bw = Math.min(4.2, (e.L - 1.5) / n - 0.5);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const d = rbox(bw, 3.6, 0.16, col(WALL_COLORS, st.bayColor, 0xeeeae0), 0.06);
        d.position.set(e.p[0] + e.tx * e.L * t + e.nx * 0.06, baseY + 1.9, e.p[1] + e.tz * e.L * t + e.nz * 0.06);
        d.rotation.y = facing(e.nx, e.nz);
        g.add(d);
        for (let k = 0; k < 3; k++) { const b = box(bw - 0.3, 0.04, 0.03, 0xc9c4b8, 0, 0, 0); b.position.set(d.position.x + e.nx * 0.1, baseY + 0.9 + k * 0.9, d.position.z + e.nz * 0.1); b.rotation.y = d.rotation.y; g.add(b); }
      }
      if (b.name || st.sign) {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(e.L - 1, 6), 0.9, 0.12), [imat, imat, imat, imat, imat, makeSign(st.sign || b.name, wallColor)]);
        sign.position.set(e.mx + e.nx * 0.12, baseY + H - 0.7, e.mz + e.nz * 0.12);
        sign.rotation.y = facing(e.nx, e.nz);
        g.add(sign);
      }
      continue;
    }
    const n = Math.max(1, Math.floor((e.L - 0.8) / spacing));
    const rotY = facing(e.nx, e.nz);
    const storefront = isFront && kind === 'commercial' && st.storefront !== false;
    for (let f = 0; f < floors; f++) {
      const y = baseY + f * floorH + (f === 0 && kind === 'commercial' ? 1.7 : 1.55) + (kind === 'church' ? 1.2 : 0);
      const doorSlot = isFront ? Math.floor(n / 2) : -1;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = e.p[0] + e.tx * e.L * t, z = e.p[1] + e.tz * e.L * t;
        if (f === 0 && i === doorSlot) {
          // Door
          const door = new THREE.Group();
          door.add(rbox(1.3, 2.4, 0.14, trimColor, 0.05, 0, 1.2, -0.05));
          door.add(rbox(1.0, 2.2, 0.16, col(WALL_COLORS, st.door, rng.pick(P.doors)), 0.05, 0, 1.1, -0.1));
          door.add(rbox(1.7, 0.18, 0.9, P.flagstone, 0.06, 0, 0.09, -0.5));
          if (kind !== 'garage') {
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: P.lampGlow, emissive: P.lampGlow, emissiveIntensity: 1.4 }));
            lamp.position.set(0.9, 2.2, -0.15);
            door.add(lamp);
          }
          door.position.set(x + e.nx * 0.06, baseY, z + e.nz * 0.06);
          door.rotation.y = rotY;
          g.add(door);
          continue;
        }
        if (f === 0 && storefront) {
          // Big shop window
          const sw = Math.min(2.0, e.L / n - 0.5);
          const win = new THREE.Group();
          win.add(rbox(sw + 0.2, 2.5, 0.12, P.timberDark, 0.04));
          const glass = new THREE.Mesh(new THREE.BoxGeometry(sw, 2.3, 0.1), glowMat);
          glass.position.z = -0.04;
          win.add(glass);
          win.add(box(0.05, 2.3, 0.05, P.timberDark, 0, 0, -0.135));
          win.add(rbox(sw + 0.5, 0.35, 0.5, P.timberDark, 0.04, 0, -1.0, -0.3)); // kick panel below the glass
          win.position.set(x + e.nx * 0.1, baseY + 1.75, z + e.nz * 0.1);
          win.rotation.y = rotY;
          g.add(win);
          continue;
        }
        if (kind === 'garage') continue;
        const win = buildWindow(rng, winW, kind === 'church' ? 2.2 : 1.2, kind === 'house' && f === 0 && rng.chance(0.25));
        win.position.set(x + e.nx * 0.1, y, z + e.nz * 0.1);
        win.rotation.y = rotY;
        g.add(win);
      }
    }
    if (isFront && !storefront && kind !== 'house' && kind !== 'garage' && (st.sign || (b.name && st.signless !== true))) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(e.L - 1, 6), 0.95, 0.14), [imat, imat, imat, imat, imat, makeSign(st.sign || b.name, wallColor)]);
      sign.position.set(e.mx + e.nx * 0.15, baseY + Math.min(H - 0.7, floorH + 0.6), e.mz + e.nz * 0.15);
      sign.rotation.y = rotY;
      g.add(sign);
    }
    // Storefront awning + sign board along the front of shops
    if (storefront) {
      const aw = e.L - 0.6;
      const awn = rbox(aw, 0.12, 1.4, col(WALL_COLORS, st.awning, rng.pick([0xb04a3f, 0x3f5068, 0x5f7a5a, 0x7d5f4c])), 0.04, 0, 0, -0.75);
      awn.rotation.x = -0.35;
      const ag = new THREE.Group();
      ag.add(awn);
      ag.position.set(e.mx + e.nx * 0.1, baseY + floorH - 0.2, e.mz + e.nz * 0.1);
      ag.rotation.y = rotY;
      g.add(ag);
      if (b.name || st.sign) {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(aw, 6), 0.95, 0.14), [imat, imat, imat, imat, imat, makeSign(st.sign || b.name, wallColor)]);
        sign.position.set(e.mx + e.nx * 0.15, baseY + floorH + 0.75, e.mz + e.nz * 0.15);
        sign.rotation.y = rotY;
        g.add(sign);
      }
    }
  }

  // Roof
  const obb = b.obb;
  const roofY = baseY + H;
  // Cupola at the ridge (gable or hip roofs)
  const addCupola = (ridgeH) => {
    if (!st.cupola) return;
    const cw = st.cupola.width || 2.4;
    const cg = new THREE.Group();
    cg.add(rbox(cw, cw * 1.1, cw, col(WALL_COLORS, st.cupola.color, WALL_COLORS.white), 0.06, 0, cw * 0.55, 0));
    const cr = new THREE.Mesh(new THREE.ConeGeometry(cw * 0.8, cw * 0.55, 4), mat(roofColor.getHex()));
    cr.rotation.y = Math.PI / 4;
    cr.position.y = cw * 1.1 + cw * 0.27;
    cg.add(cr);
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; const w = box(cw * 0.35, cw * 0.5, 0.06, P.timberDark, Math.sin(a) * cw / 2, cw * 0.55, Math.cos(a) * cw / 2); w.rotation.y = a; cg.add(w); }
    cg.position.set(obb.cx, roofY + ridgeH - 0.3, obb.cz);
    g.add(cg);
  };
  if (roof === 'flat') {
    // Cornice band just under the parapet line
    const cornice = new THREE.Mesh(extrudeFootprint(scalePoly(pts, cx, cz, 1 + 0.35 / Math.sqrt(b.area / Math.PI)), baseY + H + 0.3, 0.35), [mat(trimColor), mat(trimColor)]);
    g.add(cornice);
    // A little rooftop clutter
    if (rng.chance(0.5)) g.add(rbox(1.2, 0.8, 1.0, P.chimney, 0.05, cx + rng.range(-2, 2), baseY + H + 0.9, cz + rng.range(-2, 2)));
  } else if (roof === 'hip') {
    // Hipped roof over the oriented bounding box
    const span = obb.d + 1.0, length = obb.w + 1.0;
    const h = Math.min(span * (st.pitch || 0.4), st.maxRoofH || 5);
    const ridge = Math.max(0.5, length - span);
    const v = [
      -length / 2, 0, -span / 2,  length / 2, 0, -span / 2,  length / 2, 0, span / 2,  -length / 2, 0, span / 2,
      -ridge / 2, h, 0,  ridge / 2, h, 0,
    ];
    const idx = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0, 0, 2, 1, 0, 3, 2];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex(idx);
    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();
    const rm = new THREE.Mesh(flat, surfaceMaterial('shingles',roofColor.getHex()));
    rm.position.set(obb.cx, roofY - 0.05, obb.cz);
    rm.rotation.y = -obb.angle;
    g.add(rm);
    g.add(new THREE.Mesh(extrudeFootprint(scalePoly(pts, cx, cz, 1 + 0.3 / Math.sqrt(b.area / Math.PI)), baseY + H + 0.1, 0.3), [mat(trimColor), mat(trimColor)]));
    addCupola(h);
  } else {
    // Gable over the oriented bounding box, ridge along the long axis
    const span = obb.d, length = obb.w;
    const pitch = st.pitch || (kind === 'church' ? 0.75 : kind === 'garage' ? 0.45 : rng.range(0.5, 0.62));
    const h = Math.min(span * pitch, st.maxRoofH || (kind === 'church' ? 9 : 6.5));
    const rg = new THREE.Group();
    rg.add(gableRoof(rng, span, length, h, roofColor.getHex(), kind === 'garage' ? 0.35 : 0.5));
    // Wall-colored gable ends poking out under the tiles
    const s = span / 2 + 0.38, hh = h - 0.12;
    const tri = new THREE.Shape();
    tri.moveTo(-s, 0); tri.lineTo(s, 0); tri.lineTo(0, hh); tri.closePath();
    const endLen = length + 0.5 * 2 + 0.06;
    const endGeo = new THREE.ExtrudeGeometry(tri, { depth: endLen, bevelEnabled: false });
    endGeo.translate(0, 0, -endLen / 2);
    endGeo.rotateY(Math.PI / 2);
    const gableColor = st.upperWall ? jitterColor(rng, col(WALL_COLORS, st.upperWall, WALL_COLORS.white), 0.02, 0.006) : wallColor;
    rg.add(new THREE.Mesh(endGeo, mat(gableColor.getHex())));
    rg.position.set(obb.cx, roofY, obb.cz);
    rg.rotation.y = -obb.angle;
    g.add(rg);
    addCupola(h);
    if (kind === 'house' && rng.chance(0.7)) {
      const ch = buildChimney(rng, h, 0, rng.range(-length * 0.3, length * 0.3), rng.range(-0.4, 0.4));
      ch.group.position.set(obb.cx, roofY, obb.cz);
      ch.group.rotation.y = -obb.angle;
      g.add(ch.group);
      smokes.push(ch.emitter); // bake reparents the puffs; the original group must be collectible
    }
  }

  // Tower: church steeple by default, or anything square and tall (a bank's
  // clock tower) via style.tower = { width, height, spire, color, clock, offset }
  const towerSpec = st.tower ?? ((kind === 'church' && st.steeple !== false) ? { spire: true } : null);
  if (towerSpec) {
    const tw = towerSpec.width || 4.2;
    const th = towerSpec.height || H + 7;
    const off = towerSpec.offset || 0; // slide along the front edge (metres from centre)
    const tx = front.mx + front.tx * off - front.nx * (tw / 2 - 0.3);
    const tz = front.mz + front.tz * off - front.nz * (tw / 2 - 0.3);
    const tcol = col(WALL_COLORS, towerSpec.color, wallColor.getHex());
    const tower = new THREE.Group();
    tower.add(rbox(tw, th + 1, tw, tcol, 0.1, 0, (th + 1) / 2 - 1, 0));
    tower.add(rbox(tw + 0.3, 0.3, tw + 0.3, trimColor, 0.05, 0, th, 0));
    if (towerSpec.spire !== false) {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.62, tw * 1.8, 4), mat(roofColor.getHex()));
      spire.rotation.y = Math.PI / 4;
      spire.position.y = th + tw * 0.9;
      tower.add(spire);
    }
    if (towerSpec.clock) {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 16), mat(0xf4efe4));
      face.rotation.x = Math.PI / 2;
      face.position.set(0, th - 1.6, -tw / 2 - 0.05);
      tower.add(face);
      tower.add(box(0.08, 0.6, 0.06, 0x333333, 0, th - 1.35, -tw / 2 - 0.12));
      tower.add(box(0.5, 0.08, 0.06, 0x333333, 0.2, th - 1.6, -tw / 2 - 0.12));
    }
    for (let i = 0; i < 4; i++) {
      if (towerSpec.windows === false) break;
      const a = (i * Math.PI) / 2;
      const w = buildWindow(rng, 0.8, towerSpec.glass ? th * 0.6 : 2.4, false);
      w.position.set(Math.sin(a) * (tw / 2 + 0.06), towerSpec.glass ? th * 0.45 : th - 3, Math.cos(a) * (tw / 2 + 0.06));
      w.rotation.y = a + Math.PI;
      tower.add(w);
    }
    tower.position.set(tx, baseY, tz);
    tower.rotation.y = facing(front.nx, front.nz);
    g.add(tower);
  }

  // Porch on houses: small roof on posts over the front door
  if (kind === 'house' && st.porch !== false && front.L > 5) {
    const pw = Math.min(front.L - 1, st.porchWidth || 4.5), pd = 2.0;
    const pg = new THREE.Group();
    pg.add(rbox(pw, 0.16, pd, P.flagstone, 0.05, 0, 0.3, -pd / 2)); // deck
    for (const sx of [-1, 1]) pg.add(box(0.18, 2.5, 0.18, trimColor, sx * (pw / 2 - 0.3), 1.55, -pd + 0.25));
    pg.add(rbox(pw + 0.4, 0.14, pd + 0.4, trimColor, 0.04, 0, 2.85, -pd / 2));
    const pr = gableRoof(rng, pd + 0.4, pw + 0.4, 0.9, roofColor.getHex(), 0.2);
    pr.position.set(0, 2.9, -pd / 2);
    pg.add(pr);
    pg.position.set(front.mx + front.nx * 0.05, baseY, front.mz + front.nz * 0.05);
    pg.rotation.y = facing(front.nx, front.nz);
    g.add(pg);
  }

  // Foundation planting
  if (kind === 'house' || kind === 'church') {
    for (let i = 0; i < 2; i++) {
      const t = rng.range(0.15, 0.85);
      const bsh = buildBush(rng);
      bsh.position.set(front.p[0] + front.tx * front.L * t + front.nx * 0.9, baseY, front.p[1] + front.tz * front.L * t + front.nz * 0.9);
      g.add(bsh);
    }
  }

  return g;
}

// ---------------------------------------------------------------------------
// Extras: named props placed via overrides.json

function buildMonument(rng, ex) {
  const g = new THREE.Group();
  const h = ex.height || 9;
  g.add(rbox(3.2, 0.6, 3.2, P.stones[0], 0.08, 0, 0.3, 0));
  g.add(rbox(2.4, 0.6, 2.4, P.stones[2], 0.08, 0, 0.9, 0));
  g.add(rbox(1.5, 1.6, 1.5, P.stones[1], 0.08, 0, 2.0, 0));
  g.add(rbox(1.0, h - 4, 1.0, P.stones[2], 0.1, 0, 2.8 + (h - 4) / 2, 0));
  g.add(rbox(1.3, 0.3, 1.3, P.stones[1], 0.06, 0, h - 1.05, 0));
  // Figure on top
  const fig = new THREE.Group();
  fig.add(rbox(0.7, 1.9, 0.5, 0x6f7a72, 0.15, 0, 0.95, 0));
  fig.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat(0x6f7a72)));
  fig.children[1].position.y = 2.05;
  fig.position.y = h - 0.9;
  g.add(fig);
  return g;
}

// Paved square with a low stone rim, flush with the paths that meet it
// Memorial pad: the small granite monuments dotted around Circle Park — a
// light stone pad about 2.4 m square with a dark upright tablet on a plinth.
function buildMemorial(rng, ex) {
  const g = new THREE.Group();
  const S = ex.size || 2.4;
  g.add(rbox(S, 0.14, S, P.flagstone, 0.03, 0, 0.07, 0));
  g.add(rbox(1.3, 0.3, 0.7, P.stones[0], 0.03, 0, 0.14 + 0.15, 0));
  g.add(rbox(1.0, 0.9, 0.3, 0x4a4b4f, 0.04, 0, 0.44 + 0.45, 0));
  for (const sx of [-0.8, 0.8]) {
    const f = buildFlowerCluster(rng, 5);
    f.position.set(sx, 0.14, 0.3);
    f.scale.setScalar(0.7);
    g.add(f);
  }
  return g;
}

function buildPlaza(rng, ex) {
  const g = new THREE.Group();
  const S = ex.size || 10;
  g.add(rbox(S, 0.16, S, P.flagstone, 0.04, 0, 0.03, 0)); // low plinth around the monument
  const rim = 0.3;
  for (const [x, z, w, d] of [[0, -S / 2 + rim / 2, S, rim], [0, S / 2 - rim / 2, S, rim], [-S / 2 + rim / 2, 0, rim, S - 2 * rim], [S / 2 - rim / 2, 0, rim, S - 2 * rim]]) {
    g.add(rbox(w, 0.2, d, P.curb, 0.05, x, 0.1, z));
  }
  return g;
}

// Victorian post clock, like the one on the island at the top of Genesee Street
function buildStreetClock(rng, ex) {
  const g = new THREE.Group();
  const h = ex.height || 4.5;
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.5, 10), mat(0x2b2b2e)));
  g.children[0].position.y = 0.25;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, h - 1.4, 10), mat(0x2b2b2e));
  post.position.y = 0.5 + (h - 1.4) / 2;
  g.add(post);
  const head = rbox(1.1, 1.1, 0.5, 0x2b2b2e, 0.18, 0, h - 0.3, 0);
  g.add(head);
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16), mat(0xf6f1e6));
    face.rotation.x = Math.PI / 2;
    face.position.set(0, h - 0.3, s * 0.28);
    g.add(face);
  }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0x2b2b2e));
  finial.position.y = h + 0.35;
  g.add(finial);
  return g;
}

// Gas-station style canopy on posts
export function buildCanopy(rng, ex, grade = () => 0) {
  const g = new THREE.Group();
  const w = ex.w || 14, d = ex.d || 9, h = ex.height || 5;
  const c = Math.cos(ex.rotation || 0), s = Math.sin(ex.rotation || 0);
  const base = grade(ex.x, ex.z);
  const floor = (u, v) => grade(ex.x + c*u + s*v, ex.z - s*u + c*v) - base + 0.08;
  g.add(rbox(w, 0.5, d, col(WALL_COLORS, ex.color, WALL_COLORS.white), 0.1, 0, h, 0));
  g.add(rbox(w + 0.1, 0.5, d + 0.1, col(WALL_COLORS, ex.trim, WALL_COLORS.navy), 0.08, 0, h - 0.3, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const u = sx * (w / 2 - 2), v = sz * (d / 2 - 2), bottom = floor(u, v) - 0.05;
    const post = box(0.4, h - bottom, 0.4, 0xd9d5cc, u, (h + bottom) / 2, v);
    post.name = 'canopy-post';
    g.add(post);
  }
  const color = new THREE.Color(P.laneLight);
  const pad = new THREE.Mesh(pavementGeometry([
    [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],
  ], floor, () => color, 0.25), vmat);
  pad.name = 'canopy-pavement';
  g.add(pad);
  return g;
}

function buildGazebo(rng, ex) {
  const g = new THREE.Group();
  const r = ex.radius || 3;
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.3, r + 0.3, 0.4, 8), mat(P.flagstone)));
  g.children[0].position.y = 0.2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.2, 2.8, 0.2, P.trim, Math.cos(a) * r, 1.8, Math.sin(a) * r));
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r + 0.6, 1.8, 8), mat(ROOF_COLORS.slate));
  roof.position.y = 3.2 + 0.9;
  g.add(roof);
  return g;
}

// ---------------------------------------------------------------------------
// Baking: merge every static mesh into one geometry per material, so a whole
// town costs a few hundred draw calls instead of tens of thousands. Instanced
// meshes, transparent things (smoke) and textured signs are kept as they are,
// re-parented with their world transform.

// ---------------------------------------------------------------------------

export async function generateSite(site, seed = 'site', opts = {}) {
  // Build a centered slab, then put it back into the stable geographic frame.
  // Blueprint u/v coordinates and the externally exposed focus positions stay intact.
  if(site.offset && (site.offset.x || site.offset.z)) {
    const {x:dx,z:dz}=site.offset,shift=pts=>pts.map(([x,z])=>[x-dx,z-dz]);
    const centered={...site,offset:null,townCenter:{x:(site.townCenter?.x||0)-dx,z:(site.townCenter?.z||0)-dz},
      terrain:{...site.terrain,x0:site.terrain.x0-dx,x1:site.terrain.x1-dx,z0:site.terrain.z0-dz,z1:site.terrain.z1-dz},
      roads:site.roads.map(r=>({...r,pts:shift(r.pts)})),areas:site.areas.map(a=>({...a,pts:shift(a.pts)})),
      landmarks:(site.landmarks||[]).map(f=>shiftLandmark(f,dx,dz)),
      outline:site.outline ? {...site.outline,pts:shift(site.outline.pts)} : undefined,
      linear_features:(site.linear_features||[]).map(r=>({...r,pts:shift(r.pts)})),
      buildings:site.buildings.map(b=>({...b,pts:shift(b.pts),centroid:shift([b.centroid])[0],obb:{...b.obb,cx:b.obb.cx-dx,cz:b.obb.cz-dz}})),
      pois:site.pois.map(p=>({...p,x:p.x-dx,z:p.z-dz})),
      extras:(site.extras||[]).map(e=>({...e,x:(e.x||0)-dx,z:(e.z||0)-dz}))};
    const out=await generateSite(centered,seed,opts);
    if (opts.surfacesOnly) return out;
    out.group.position.set(dx,0,dz);out.offset={x:dx,z:dz};
    for (const lamp of out.lamps) { lamp.x += dx; lamp.z += dz; }
    for(const name of ['grade','roadY','walkY','roadDistance']) {
      const fn=out.surfaces[name];out.surfaces[name]=(x,z)=>fn(x-dx,z-dz);
    }
    return out;
  }
  // Keep the survey data unchanged; use the same rounded course for drawing,
  // planting exclusions and bank placement within this build.
  site={...site,landmarks:(site.landmarks||[]).map(f=>f.kind==='water'&&!f.closed
    ? {...f,pts:smoothWatercourse(f.pts,f.width||3)} : f)};
  const dioramaOutline=createDioramaOutline(site.outline);
  const emitModel=async model=>{
    if(dioramaOutline)clipDioramaObject(model,dioramaOutline);
    const emitted=opts.onModel ? await opts.onModel(model) : model;
    if(dioramaOutline)emitted.userData.dioramaClipped=true;
    return emitted;
  };
  // Section timings, handy when a change makes the build crawl: out.prof.
  // Each mark also hands the section's name to opts.onStage and waits for it,
  // so the caller can move a loading bar and let the browser paint in between.
  const t0 = performance.now(), prof = [];
  const mark = async (name) => {
    prof.push([name, Math.round(performance.now() - t0)]);
    if (opts.onStage) await opts.onStage(name);
  };
  let prepared = null;
  if (opts.surfaceAsset) {
    try { prepared = unpackSurfaces(opts.surfaceAsset); }
    catch (error) { console.warn('Invalid surface asset; generating locally.', error); }
  }
  const usedSurfaces = !!prepared;
  opts = { ...opts, surfaceAsset: null }; // do not retain the packed 33 MB in surface-query closures
  const takeSurface = name => {
    const record = prepared?.get(name);
    if (!record) return null;
    prepared.delete(name); // consumed arrays belong to the scene, not a second retained cache
    const geo = new THREE.BufferGeometry();
    for (const [key, a] of Object.entries(record.attributes)) {
      const attr = new THREE.BufferAttribute(a.array, a.itemSize, a.normalized);
      if (key === 'index') geo.setIndex(attr); else geo.setAttribute(key, attr);
    }
    geo.userData = record.userData;
    return geo;
  };
  const rng = makeRng(seed);
  const centralDensity = (x,z,rural=0.06) => townDensity(x,z,site.townCenter,rural);
  const lightingRng = makeRng(`${seed}:rural-lights`);
  const g = new THREE.Group(); // staging; everything gets baked at the end
  const smokes = [];
  const { w: W, h: H } = site.size;
  const sourceTerrain = new Terrain(site.terrain);
  const shoreline=lakeGrade(site.landmarks||[],(x,z)=>sourceTerrain.raw(x,z));
  const bridgeTerrain=bridgeGrade(site.buildings,shoreline);
  const grid = terrainGrid(W,H,site.townCenter,site.buildings);
  const auditoriums=amphitheaterGrade(site.buildings,bridgeTerrain.sample);
  const gardenTerrain=amphitheaterGardenGrade(site.landmarks,auditoriums.sample);
  const grade = createStreetGrade(gardenTerrain,W,H,grid);
  const roadCrossings=roadWaterCrossings(site.roads,site.landmarks||[],grade);
  const terrain = {raw:roadCrossings.crossings.length?createStreetGrade(roadCrossings.bed,W,H,grid):grade};
  const crossingWater=roadCrossings.crossings.length?createStreetGrade(roadCrossings.water,W,H,grid):null;

  // --- classify cover and join road geometry --------------------
  const roads = site.roads.map((r) => ({ ...r, bb: bboxOf(r.pts, r.width / 2 + 3) }));
  const pavingFeatures=(site.landmarks||[]).filter(f=>f.kind==='paving');
  const pavingRoadIds=new Set((site.landmarks||[]).flatMap(f=>f.replacesRoadIds||[]).map(String));
  const genericRoad=r=>r.surface!=='grass' && !pavingRoadIds.has(String(r.id));
  const polygonFeatureDistance=(f,x,z)=>Math.max(signedDistToPoly(f.pts,x,z),
    ...(f.holes||[]).map(hole=>-signedDistToPoly(hole,x,z)));
  const railways = (site.linear_features || []).filter(r => r.kind === 'rail' && r.pts.length > 1)
    .map(r => ({ ...r, bb: bboxOf(r.pts, (r.width || 4) / 2 + 3) }));
  const onRailway = (x, z, pad = 0) => railways.some(r =>
    x >= r.bb.x0 - pad && x <= r.bb.x1 + pad && z >= r.bb.z0 - pad && z <= r.bb.z1 + pad
    && distToPolyline(r.pts, x, z) < (r.width || 4) / 2 + pad);
  const isFoot = (r) => ['footway', 'path', 'steps', 'cycleway'].includes(r.class);
  // OSM splits a street into a way per stretch (the ring road is seven). Chain
  // the pieces of one street back into a single polyline so it gets one ribbon
  // and one continuous curb; round the corners so the ribbon's mitre and the
  // curb's true offset agree; keep the densified centreline for both.
  const drivingWays=roads.filter(r=>!isFoot(r));
  // Pair the straightest matching ends at each junction. Street names and
  // one-way tags may change there; they must not change the physical curve.
  const ends=new Map(),joins=new Set();
  const pairKey=(a,b)=>[a.id,b.id].sort((a,b)=>a-b).join(':');
  for(const r of drivingWays) for(const end of [0,r.pts.length-1]) {
    const p=r.pts[end],q=r.pts[end===0?1:end-1];
    const key=p.map(v=>Math.round(v*3)).join(','),L=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(!ends.has(key)) ends.set(key,[]);
    ends.get(key).push({r,dx:(q[0]-p[0])/L,dz:(q[1]-p[1])/L});
  }
  for(const entries of ends.values()) {
    const pairs=[];
    for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) {
      const a=entries[i],b=entries[j],dot=a.dx*b.dx+a.dz*b.dz;
      if(a.r.width===b.r.width && dot<-0.5) pairs.push({a,b,dot});
    }
    pairs.sort((a,b)=>a.dot-b.dot);
    const used=new Set();
    for(const {a,b} of pairs) if(!used.has(a) && !used.has(b)) {
      joins.add(pairKey(a.r,b.r));used.add(a);used.add(b);
    }
  }
  const roundedRoad = (r) => {
    const pts = roundCorners(r.pts, Math.max(3, r.width));
    return { ...r, pts, bb: bboxOf(pts, r.width / 2 + 3), dense: densify(pts, 1.5), closed: isClosed(pts) };
  };
  // Retain mapped alignment for building floors while authored plaza surfaces
  // replace the generic asphalt ribbons drawn for those same OSM ways.
  const alignmentRoads=chainWays(drivingWays,(a,b)=>joins.has(pairKey(a,b))).map(roundedRoad);
  const vehicular=pavingRoadIds.size ? chainWays(drivingWays.filter(genericRoad),(a,b)=>joins.has(pairKey(a,b))).map(roundedRoad) : alignmentRoads;
  const footways = roads.filter(r=>isFoot(r)&&genericRoad(r));
  const inBB = (bb, x, z) => x >= bb.x0 && x <= bb.x1 && z >= bb.z0 && z <= bb.z1;

  // Nearest road geometry is used only to align frontages and parking lots.
  let rhX = NaN, rhZ = NaN, rhR = null;
  const nearestRoadCached = (x, z) => {
    if (x === rhX && z === rhZ) return rhR;
    rhX = x; rhZ = z;
    rhR = nearestRoad(x, z);
    return rhR;
  };
  const nearestRoad = (x, z) => {
    let best = null;
    for (const r of alignmentRoads) {
      if (x < r.bb.x0 || x > r.bb.x1 || z < r.bb.z0 || z > r.bb.z1) continue;
      let d = Infinity, hx = 0, hz = 0;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
        const dx = bx - ax, dz = bz - az;
        const L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        const px = ax + t * dx, pz = az + t * dz;
        const dd = Math.hypot(x - px, z - pz);
        if (dd < d) { d = dd; hx = px; hz = pz; }
      }
      if (!best || d - r.width / 2 < best.d - best.w) best = { d, w: r.width / 2, hx, hz, road: r };
    }
    return best;
  };

  // Parking lots are drawn 0.7 m larger than OSM traces them, and any part of
  // the outline that comes within 2.5 m of a road is pulled onto its ribbon, so
  // lot and road are one paved surface: a lot traced to the property line used
  // to leave a hair of ground between slab and asphalt, and the curb outlined
  // it. Everything that tests "inside the lot" uses the grown outline (pts)
  // and keeps the original for reference (osmPts).
  const areas = site.areas.map((a) => {
    if (a.kind === 'parking' && a.pts.length >= 3) {
      const grown = offsetPolygon(a.pts, 0.7);
      const snapped = densify([...grown, grown[0]], 2).map(([x, z]) => {
        const r = nearestRoad(x, z);
        const e = r ? r.d - r.w : Infinity;
        if (!(e > 0 && e < 2.5)) return [x, z];
        const k = (e + 0.3) / (r.d || 1e-9); // toward the nearest centreline point, 0.3 m past the edge
        return [x + (r.hx - x) * k, z + (r.hz - z) * k];
      });
      // back to a lean outline: the slab is triangulated and refined from it,
      // and a long skinny fan off forty vertices is a hundred thousand triangles
      const pts = simplify(snapped, 0.12).slice(0, -1);
      // clipped a hair past the site (the edge pass pulls it back onto the
      // border): a lot cut by the border runs to the border, and the paved
      // field's border samples fall inside it, so no curb gets traced along
      // the edge of the world
      const clipped = clipPolygonToRect(pts, -W / 2 - 0.1, -H / 2 - 0.1, W / 2 + 0.1, H / 2 + 0.1);
      return { ...a, osmPts: a.pts, pts: clipped, bb: bboxOf(clipped) };
    }
    return { ...a, bb: bboxOf(a.pts) };
  });


  // A building's floor sits at street level: the terrain along its frontage
  // (the footprint corners nearest a road). On a sloped lot the back is carried
  // on a foundation. The old rule, "lowest point under the footprint", sank
  // every Genesee Street storefront two metres into the sidewalk.
  const buildings = site.buildings.map((b) => {
    // Integrated halls occupy their whole oriented rectangle, including areas
    // outside a concave source polygon. Support the entire visible terrace.
    const o=b.obb, c=Math.cos(o.angle), sn=Math.sin(o.angle);
    const footingPts=b.blueprint?.pavilion ? [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>
      [o.cx+u*o.w/2*c-v*o.d/2*sn,o.cz+u*o.w/2*sn+v*o.d/2*c]) : b.pts;
    const hs = footingPts.map(([x, z]) => terrain.raw(x, z));
    const ds = footingPts.map(([x, z]) => { const r = nearestRoadCached(x, z); return r ? r.d - r.w : Infinity; });
    const dmin = Math.min(...ds);
    const front = hs.filter((_, i) => ds[i] <= dmin + 3);
    const fronts=blueprintFrontages(b,{floorDatumOnly:true}).map(fr=>({fr,d:Math.min(...[0.1,0.5,0.9].map(t=>{
      const r=nearestRoadCached(...fr.point(t));return r?r.d-r.w:Infinity;
    }))}));
    // Shop entrances establish the public floor. A service alley can be
    // closer to the rear door while sitting metres below the storefronts.
    const shops=b.style?.kind==='commercial' ? fronts.filter(f=>f.fr.storefront) : [];
    // Keep every modeled storefront, including those set back beyond the
    // road lookup's local search box. Other buildings retain their entry rule.
    const nearest=Math.min(...fronts.map(f=>f.d));
    const entrances=shops.length ? shops : fronts.filter(f=>f.d<nearest+3);
    const entranceHeights=entrances.flatMap(({fr})=>
      (fr.doors.length?fr.doors:[0.15,0.85]).map(at=>grade(...fr.point(at))));
    // Open halls expose their whole floor. Put the terrace above the uphill
    // corner; averaging the frontage lets terrain emerge through the slab.
    const base=b.blueprint?.pavilion ? Math.max(...hs)+WALK_LEVEL : b.blueprint?.amphitheater ? auditoriums.floors.get(String(b.id)) : b.blueprint?.bridge ? bridgeTerrain.floors.get(String(b.id)) : (entranceHeights.length ? Math.max(...entranceHeights) : front.length ? front.reduce((a,v)=>a+v,0)/front.length : hs.reduce((a,v)=>a+v,0)/hs.length)+WALK_LEVEL;
    return { ...b, footingPts, base, minT: Math.min(...hs), bb: bboxOf(b.pts, 2.5),
      amphitheaterGround: auditoriums.profiles?.get(String(b.id)),
      lennaGround: b.blueprint?.lennaHall ? {heightAt:(u,v)=>grade(o.cx+u*c-v*sn,o.cz+u*sn+v*c)-base} : undefined,
      hultquistGround: b.blueprint?.hultquistCenter ? {heightAt:(u,v)=>grade(o.cx+u*c-v*sn,o.cz+u*sn+v*c)-base} : undefined,
      athenaeumGround: b.blueprint?.athenaeumFront ? {heightAt:(u,v)=>grade(o.cx+u*c-v*sn,o.cz+u*sn+v*c)-base} : undefined };
  });

  // Inside (or within `pad` of) any vehicular road. nearestRoadCached picks the
  // single nearest road by (distance - half width), so beside a wide road it
  // can miss the narrow lane you are actually standing on — and tufts sprouted
  // through the lane's ribbon as little green teeth.
  const onRoad = (x, z, pad = 0) => {
    for (const r of vehicular) {
      const m = r.width / 2 + pad;
      if (x < r.bb.x0 - m || x > r.bb.x1 + m || z < r.bb.z0 - m || z > r.bb.z1 + m) continue;
      if (distToPolyline(r.pts, x, z) < m) return true;
    }
    return false;
  };
  const coverAt = (x, z) => {
    if(pavingFeatures.some(f=>polygonFeatureDistance(f,x,z)<0)) return 'paved';
    if (onRoad(x, z, -0.6)) return 'road'; // inside the ribbon
    if (onRailway(x, z)) return 'rail';
    for (const f of footways) {
      if (!inBB(f.bb, x, z)) continue;
      if (distToPolyline(f.pts, x, z) < f.width / 2 + 0.3) return 'paved';
    }
    for (const ex of site.extras || []) {
      if (ex.type === 'plaza' && Math.max(Math.abs(x - ex.x), Math.abs(z - ex.z)) < (ex.size || 10) / 2 + 0.5) return 'paved';
    }
    for (const a of areas) {
      if (x < a.bb.x0 || x > a.bb.x1 || z < a.bb.z0 || z > a.bb.z1) continue;
      if (['parking', 'park', 'wood', 'grass', 'cemetery', 'field', 'pitch'].includes(a.kind) && pointInPoly(a.pts, x, z)) return a.kind;
    }
    return 'grass';
  };

  // Mapped horizontal features sit only a few centimetres above the grade;
  // their clearance must also remove grass bumps under sand, water and courts.
  const landmarkPatches=(site.landmarks||[]).filter(f=>['track','gravel','water','pitch','playground','beach','pier','garden','paving','bleachers','cropland'].includes(f.kind)).map(f=>{
    const line=f.kind==='track'||(['water','pier'].includes(f.kind)&&!f.closed),width=(f.width||4)/2;
    const pts=line&&f.closed&&f.pts.length?[...f.pts,f.pts[0]]:f.pts;
    return {pts,holes:f.holes,line,width,bb:bboxOf(pts,(line?width:0)+1.2)};
  });
  // Canopy pavement also needs the grass relief removed across every terrain
  // triangle it touches, just like the mapped paving above.
  for (const ex of site.extras || []) if (ex.type === 'canopy') {
    const c=Math.cos(ex.rotation||0),s=Math.sin(ex.rotation||0);
    const w=(ex.w||14)/2,d=(ex.d||9)/2;
    const pts=[[-w,-d],[w,-d],[w,d],[-w,d]].map(([u,v])=>
      [ex.x+c*u+s*v,ex.z-s*u+c*v]);
    landmarkPatches.push({pts,line:false,width:0,bb:bboxOf(pts,1.2)});
  }
  // Grass bumps fade out within a metre of sidewalks, paths and lots, whose
  // slabs sit close to the ground
  const bumpScale = (x, z, reach = 0) => {
    if (onRoad(x,z,1.2 + reach)) return 0;
    if (onRailway(x,z,0.5 + reach)) return 0;
    let s = 1;
    for(const patch of landmarkPatches) {
      if(x < patch.bb.x0-reach || x > patch.bb.x1+reach || z < patch.bb.z0-reach || z > patch.bb.z1+reach) continue;
      const d=patch.line?distToPolyline(patch.pts,x,z)-patch.width:polygonFeatureDistance(patch,x,z);
      if(d<1.2+reach) s=Math.min(s,Math.max(0,(d-reach)/1.2));
    }
    for (const f of footways) {
      if (x < f.bb.x0-reach || x > f.bb.x1+reach || z < f.bb.z0-reach || z > f.bb.z1+reach) continue;
      const d = distToPolyline(f.pts, x, z) - f.width / 2;
      if (d < 1.2+reach) s = Math.min(s, Math.max(0, (d-reach) / 1.2));
    }
    for (const a of areas) {
      if (a.kind !== 'parking' || x < a.bb.x0 - 2-reach || x > a.bb.x1 + 2+reach || z < a.bb.z0 - 2-reach || z > a.bb.z1 + 2+reach) continue;
      const d = signedDistToPoly(a.pts, x, z);
      if (d < 2+reach) s = Math.min(s, Math.max(0, (d-reach) / 2)); // the slab is only 4 cm up; no bump may reach it
    }
    return s;
  };
  const ground = makeGround(site, terrain, coverAt, bumpScale, takeSurface('ground'));
  opts.onSurface?.('ground', ground.geo);
  g.add(ground.group);
  await mark('ground');
  const yAt = grade;
  const roadY = (x,z) => grade(x,z)+ROAD_LEVEL;
  const slabY = roadY;
  const roadEdge = (x,z) => Math.min(...vehicular.map(r=>stripSDF(r.pts,r.width/2,r.closed,x,z)),
    ...lots.map(a=>signedDistToPoly(a.pts,x,z)));
  const BAR_LIFT = 0.018;
  const sidewalks = chainWays(roads.filter((r) => r.foot === 'sidewalk'&&genericRoad(r)));
  const crossings = roads.filter((r) => r.foot === 'crossing'&&genericRoad(r));
  const paths = chainWays(footways.filter((r) => r.foot !== 'sidewalk' && r.foot !== 'crossing'));
  const lots = areas.filter(a => a.kind === 'parking' && a.pts.length >= 3);
  const roadPolygons=vehicular.map(r => ribbonOutline(r.dense,r.width));
  roadPolygons.push(...lots.map(a=>a.pts));
  const asphaltA=new THREE.Color(P.laneLight),asphaltB=new THREE.Color(P.lane);
  const asphaltColor=(x,z)=>asphaltA.clone().lerp(asphaltB,0.35+fbm(x*0.2,z*0.2)*0.25);
  const pavingGrid=Math.max(W,H)>900 ? pavementGrid(site.townCenter) : null;
  const savedAsphalt=takeSurface('asphalt');
  const asphalt=savedAsphalt ? finishPavement(savedAsphalt,asphaltColor) : pavementGeometry(roadPolygons,roadY,asphaltColor,0.5,{grid:pavingGrid});
  asphalt.userData.distanceAt ??= polygonDistanceField(roadPolygons, pavingGrid ? 8 : 2);
  opts.onSurface?.('asphalt', asphalt);
  const roadDistance=asphalt.userData.distanceAt;
  const asphaltMesh=new THREE.Mesh(asphalt,vmat);asphaltMesh.name='slab';g.add(asphaltMesh);
  const contours=asphalt.userData.contours;
  const nearCrossing=(x,z,pad=0) => crossings.some(c =>
    distToPolyline(c.pts,x,z)<c.width/2+pad);
  const walkY=(x,z) => {
    const t=nearCrossing(x,z,0.4) ? THREE.MathUtils.smoothstep(Math.max(0,roadDistance(x,z)),0,1.2) : 1;
    return grade(x,z)+ROAD_LEVEL+(WALK_LEVEL-ROAD_LEVEL)*t;
  };
  const gardenEntries=(site.landmarks||[]).filter(f=>f.garden?.type==='carnahan-jackson').map(f=>{
    const {position,angle=0,entry=[-10.8,1.4]}=f.garden,c=Math.cos(angle),s=Math.sin(angle);
    return [position[0]+c*entry[0]+s*entry[1],position[1]-s*entry[0]+c*entry[1]];
  });
  // Curbs use the asphalt mesh's actual boundary, not a second tracing of
  // a different road shape. A crossing lowers the curb into the same ramp.
  for(const line of contours) {
    if(line.length<3) continue;
    const curb=curbAlong(line,isClosed(line),roadY,1,
      (x,z)=>Math.abs(x)>W/2-0.5 || Math.abs(z)>H/2-0.5
        || pavingFeatures.some(f=>polygonFeatureDistance(f,x,z)<.15)
        || gardenEntries.some(p=>Math.hypot(x-p[0],z-p[1])<.95),
      (x,z)=>nearCrossing(x,z,0.35)?0.012:WALK_LEVEL-ROAD_LEVEL);
    if(curb) g.add(curb);
  }
  await mark('streets and curbs');
  // A faded double-yellow centre line down the two-way through streets, broken
  // where another road's ribbon covers it (a junction) and worn thin by the
  // same mottle as the asphalt. One-way streets and service lanes go unmarked.
  const offsetLine = (pts, d) => pts.map(([x, z], i) => {
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [x - ((q[1] - p[1]) / L) * d, z + ((q[0] - p[0]) / L) * d];
  });
  const worn = (along, x, z) => 0.1 + fbm(x * 1.1 + 3, z * 1.1) * 0.75; // toward the asphalt's own mid tone, so a worn patch fades rather than darkens
  // a parking bay slab lying over the street (Genesee's on-street parking is
  // mapped as parking areas) would otherwise bury the paint
  for (const original of drivingWays) {
    if(!genericRoad(original)) continue;
    const pts=roundCorners(original.pts,Math.max(3,original.width));
    const r={...original,pts,dense:densify(pts,1.5)};
    if (r.oneway || (!['trunk', 'primary', 'secondary', 'tertiary'].includes(r.class) && !(r.lanes >= 2 && r.class !== 'service'))) continue;
    const lineY = roadY;
    const dense = densify(r.pts, 0.3), others = drivingWays.filter(o=>o.id!==r.id);
    const open = dense.map(([x, z]) => others.every(o=>stripSDF(o.pts,o.width/2,o.closed,x,z)>1.2) && Math.abs(x) < W / 2 - 0.5 && Math.abs(z) < H / 2 - 0.5);
    let i = 0;
    while (i < dense.length) {
      let j = i;
      while (j + 1 < dense.length && open[j + 1] === open[i]) j++;
      if (open[i] && j - i >= 2) {
        const run = dense.slice(i, j + 1);
        for (const side of [-1, 1]) g.add(roadRibbon(offsetLine(run, side * 0.14), 0.12, lineY, 0.012, P.paint, P.lane, 0, worn));
      }
      i = j + 1;
    }
  }
  await mark('centre lines');
  const walkPolygons = [];
  const addWalk=(pts,width) => walkPolygons.push(ribbonOutline(pts,width));
  sidewalks.forEach(r => addWalk(densify(roundCorners(r.pts,0.65),0.75),r.width));

  // Find an actual sidewalk along an entrance's outward normal. Connecting
  // to mapped walks avoids inventing diagonal paths through roads or yards.
  const walkReach = (p, n, limit = 7) => {
    let reach = Infinity;
    for (const f of sidewalks) for (let i=1;i<f.pts.length;i++) {
      const a=f.pts[i-1], b=f.pts[i], dx=b[0]-a[0], dz=b[1]-a[1];
      const det=n[0]*dz-n[1]*dx;
      if (Math.abs(det)<1e-6) continue;
      const ax=a[0]-p[0], az=a[1]-p[1];
      const d=(ax*dz-az*dx)/det, t=(ax*n[1]-az*n[0])/det;
      if (d>0 && d<limit && t>=-0.02 && t<=1.02) reach=Math.min(reach,d);
    }
    if (!Number.isFinite(reach)) return null;
    // Stop at the first road, even when the chosen walk is on its far side.
    for(let d=0.4;d<reach;d+=0.4) if(onRoad(p[0]+n[0]*d,p[1]+n[1]*d,0.15)) return null;
    return reach;
  };
  const entrancePaving = [], gardenFronts = [], shopFronts = [], apronEnds = [];
  // Stairs and open porches extend beyond the enclosed building footprint.
  // Reserve their approaches even where no mapped sidewalk reaches the door.
  const entranceApproaches = buildings.flatMap(b => blueprintFrontages(b)
    .filter(fr => fr.depth > 0)
    .map(fr => [fr.point(0, -0.5), fr.point(1, -0.5),
      fr.point(1, fr.depth), fr.point(0, fr.depth)]))
    .map(pts => ({pts, bb: bboxOf(pts)}));
  const onEntranceApproach = (x, z, pad) => entranceApproaches.some(({pts, bb}) =>
    x >= bb.x0-pad && x <= bb.x1+pad && z >= bb.z0-pad && z <= bb.z1+pad
    && signedDistToPoly(pts,x,z)<pad);
  const pavedFront = (b, fr, fa, fb, start, reachA, reachB) => {
    const a=fr.point(fa,start), z=fr.point(fb,start), c=fr.point(fb,reachB), d=fr.point(fa,reachA);
    const pts=clipPolygonToRect([a,z,c,d],-W/2,-H/2,W/2,H/2);
    if(pts.length<3 || Math.abs(polyArea(pts))<0.1) return;
    walkPolygons.push(pts); entrancePaving.push(pts);
    return {ends:[[fr.point(fa),d],[fr.point(fb),c]]};
  };
  for(const b of buildings) {
    if(b.style?.pavedApproach===false) continue;
    const fronts=blueprintFrontages(b);
    for(const fr of fronts) {
      const mid=walkReach(fr.point(0.5),fr.n,b.style?.kind==='house'?14:7);
      if(mid===null) continue;
      if(b.style?.kind==='commercial') {
        const da=walkReach(fr.point(0.01),fr.n)??mid, db=walkReach(fr.point(0.99),fr.n)??mid;
        if(Math.abs(da-db)>4) continue;
        const apron=pavedFront(b,fr,0,1,-0.12,da,db);
        if(apron) for(const [wall,end] of apron.ends) apronEnds.push({wall,end,n:fr.n,source:apron});
        if(mid>1.6) shopFronts.push({b,fr});
      } else if(b.style?.kind==='house' && fr.doors.length && fr.length>4) {
        const at=fr.pathAt, reach=walkReach(fr.point(at),fr.n,14);
        if(reach===null || reach<fr.depth+0.5) continue;
        const half=0.65/fr.length;
        pavedFront(b,fr,at-half,at+half,fr.depth,reach,reach);
        gardenFronts.push({b,fr,at,reach});
        break; // one composed entrance garden per house
      }
    }
  }
  // Adjacent facade normals fan apart at corners. Close that wedge so the
  // paved frontage remains continuous around a clipped building corner.
  for(let i=0;i<apronEnds.length;i++) for(let j=i+1;j<apronEnds.length;j++) {
    const a=apronEnds[i], b=apronEnds[j];
    if(a.source===b.source || Math.hypot(a.wall[0]-b.wall[0],a.wall[1]-b.wall[1])>3) continue;
    if(a.n[0]*b.n[0]+a.n[1]*b.n[1]<-0.25) continue;
    const pts=[a.wall,a.end,b.end,b.wall];
    if(Math.abs(polyArea(pts))<0.05) continue;
    if(pts.some(([x,z]) => onRoad(x,z,0.05))) continue;
    walkPolygons.push(pts); entrancePaving.push(pts);
  }
  await mark('sidewalks');

  for (const c of crossings) {
    addWalk(densify(c.pts,0.5),c.width);
    const dense=densify(c.pts,0.25);
    let run=[];
    const flush=()=>{if(run.length>1 && c.marked!==false) {const paint=zebra(run,c.width,roadY,BAR_LIFT,c.marking);paint.userData.crossingId=c.id;g.add(paint);}run=[];};
    for(const p of dense) {if(roadDistance(...p)<-0.05) run.push(p);else flush();}
    flush();
  }
  // Park paths share the pedestrian surface. Carry short gaps to the curb.
  // Path endpoints alone are not evidence of memorials or street furniture.
  // Retain the original Avon decoration; Chautauqua uses authored landmarks.
  const decoratePathEnds = !String(site.name).toLowerCase().includes('chautauqua');
  const nodeKey = ([x, z]) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
  const nodeCount = new Map();
  for (const r of roads) for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) nodeCount.set(nodeKey(p), (nodeCount.get(nodeKey(p)) || 0) + 1);
  for (const r of paths) {
    const pts = r.pts.map((p) => [...p]);
    if (pts.length < 2) continue;
    for (const end of [0, pts.length - 1]) {
      const p = pts[end], q = pts[end === 0 ? 1 : end - 1];
      if (nodeCount.get(nodeKey(p)) > 1) continue; // meets another way
      // A plaza path ending at a fountain already has its destination. Do
      // not put a procedural memorial stone or bench inside the water basin.
      if (buildings.some(b => b.tags?.amenity === 'fountain' && signedDistToPoly(b.pts, p[0], p[1]) < 2)) continue;
      const atEntrance = onEntranceApproach(p[0], p[1], 3.8);
      if (Math.abs(p[0]) > W / 2 - 1 || Math.abs(p[1]) > H / 2 - 1) continue; // runs off the diorama: no marker out there
      const L = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
      const dx = (p[0] - q[0]) / L, dz = (p[1] - q[1]) / L;
      const gap = roadEdge(p[0], p[1]);
      if (gap > 0 && gap < 6) { p[0] += dx * (gap + 0.3); p[1] += dz * (gap + 0.3); continue; }
      if (gap < 6) continue;
      const ang = Math.atan2(dz, dx);
      const marker = buildMarker(rng);
      marker.position.set(p[0] + dx * 1.1, yAt(p[0] + dx * 1.1, p[1] + dz * 1.1), p[1] + dz * 1.1);
      marker.rotation.y = -ang - Math.PI / 2; // tablet faces back down the path
      if (decoratePathEnds && !atEntrance) g.add(marker);
      const side = rng.chance(0.5) ? 1 : -1;
      const bx = p[0] - dx * 2.6 - dz * side * 1.7, bz = p[1] - dz * 2.6 + dx * side * 1.7;
      const bench = buildBench(rng);
      bench.position.set(bx, yAt(bx, bz), bz);
      bench.rotation.y = -ang + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI; // faces the path
      if (decoratePathEnds && !atEntrance) g.add(bench);
    }
    addWalk(densify(pts,0.75),r.width);
  }

  const concreteA=new THREE.Color(P.sidewalk),concreteB=new THREE.Color(P.sidewalkAlt);
  const pavementColor=(x,z)=>concreteA.clone().lerp(concreteB,fbm(x*0.2+7,z*0.2)*0.6);
  // Rural asphalt uses 2 m cells; a 1.8 m sidewalk can disappear between
  // those samples. Keep walking surfaces at 1 m outside the town center.
  const walkingGrid = pavingGrid ? pavementGrid(site.townCenter, 2) : null;
  const savedPavement=takeSurface('pavement');
  const pavement=savedPavement ? finishPavement(savedPavement,pavementColor) : pavementGeometry(walkPolygons,walkY,
    pavementColor,0.5,
    {grid:walkingGrid,clip:(x,z)=>-roadDistance(x,z)});
  opts.onSurface?.('pavement', pavement);
  const pavementMesh=new THREE.Mesh(pavement,vmat);pavementMesh.name='slab';g.add(pavementMesh);
  g.add(buildRailways(railways, { grade, roadDistance, W, H }));
  const mappedLandmarks=buildLandmarks(site.landmarks||[],{grade,grid,
    waterGrade:crossingWater,roadCrossings:roadCrossings.crossings});
  const parkingRows=(site.landmarks||[]).filter(f=>f.kind==='parking-row');
  // Surveyed paint defines the internal aisles. Coarse OSM service centerlines
  // sometimes cross the photographed bays; retain the public-road exclusion.
  const publicParkingRoads=vehicular.filter(r=>r.class!=='service');
  const parkingRoadEdge=(x,z,row)=>Math.min(...(row?.paint?publicParkingRoads:vehicular)
    .map(r=>stripSDF(r.pts,r.width/2,r.closed,x,z)));
  g.add(buildParkingPaint(parkingRows,{lots,surfaceY:slabY,grid,roadEdge:parkingRoadEdge}));
  const landmarkModels=mappedLandmarks.children.filter(model=>model.userData.streamKind);
  for(const model of landmarkModels) model.removeFromParent();
  g.add(mappedLandmarks);
  await mark('paths');
  if (opts.surfacesOnly) return { prof }; // deterministic asset build: no buildings or vegetation
  if (opts.onScene) for (const child of g.children) {child.userData.streamBase = true;child.userData.streamSurface = true;}
  // Detailed gardens use the same sector lifecycle as building models; their
  // structural fallback remains available when foliage and small details unload.
  for(const model of landmarkModels) g.add(await emitModel(model));
  // --- buildings ---------------------------------------------------------
  for (const b of buildings) {
    // The footprint includes open porches/carports. Keep its supporting
    // foundation below floor level, never coplanar with their visible slabs.
    const foundationTop = b.base - 0.08;
    // An explicitly associated draped apron supports open pump canopies on
    // sloping ground without a flat foundation intersecting the terrain.
    const pavedSupport = pavingFeatures.some(f => String(f.supportsBuildingId) === String(b.id)
      && b.footingPts.every(([x,z]) => polygonFeatureDistance(f,x,z) < 0));
    const hasFoundation = !pavedSupport && !b.tags?.['miniature:open_lane'] && !b.blueprint?.bridge && !b.blueprint?.fountain && !b.blueprint?.amphitheater && b.base - b.minT > 0.05;
    if (hasFoundation) g.add(new THREE.Mesh(extrudeFootprint(b.footingPts, foundationTop, foundationTop - b.minT + 0.6), surfaceMaterial('stone',P.foundation)));
    // Explicitly seeded comparison scenes keep each building's random choices
    // independent, so one model's extra windows don't shift later vegetation.
    const buildingRng = site.seed !== undefined ? makeRng(`${seed}:building:${b.id}`) : rng;
    const model = buildBuilding(buildingRng, b, b.base, smokes, hasFoundation ? foundationTop - b.base : -1.2);
    if (b.style.nightWindows === 'all') model.traverse(o => {
      if (!o.material) return;
      // Replace shared glass with a cached variant; neighbouring buildings
      // retain their own occupancy pattern, including after batching.
      const lit = m => usesPaneUV(m.userData.surface)
        ? surfaceMaterial(m.userData.surface, m.color.getHex(), m.vertexColors, {nightWindows:'all'}) : m;
      o.material = Array.isArray(o.material) ? o.material.map(lit) : lit(o.material);
    });
    if (opts.onScene) model.userData.streamKind = 'building';
    // The offline stream exporter compacts one building at a time, so the
    // regional build never retains every window/frame construction object.
    g.add(await emitModel(model));
  }

  // --- blocked test for scattering things -----------------------------------
  const blocked = (x, z, pad = 1.5) => {
    if(dioramaOutline && !dioramaOutline.contains(x,z,pad+2))return true;
    if (Math.abs(x) > W / 2 - 1.5 || Math.abs(z) > H / 2 - 1.5) return true;
    if (onRoad(x, z, pad)) return true;
    if (onRailway(x, z, pad)) return true;
    if ((site.landmarks||[]).some(f => {
      if (f.kind==='track' && f.closed && f.clearInterior && signedDistToPoly(f.pts,x,z)<pad) return true;
      if (f.kind==='park-sign') return Math.hypot(x-f.pts[0][0],z-f.pts[0][1])<1.4+pad;
      if (f.kind==='school-sign') return Math.hypot(x-f.pts[0][0],z-f.pts[0][1])<3.7+pad;
      if (f.kind==='andriaccios-ground' && f.exclusion) {
        const dx=x-f.pts[0][0], dz=z-f.pts[0][1], a=f.angle||0;
        const u=Math.cos(a)*dx-Math.sin(a)*dz, v=Math.sin(a)*dx+Math.cos(a)*dz;
        return u>=f.exclusion.u[0]-pad && u<=f.exclusion.u[1]+pad
          && v>=f.exclusion.v[0]-pad && v<=f.exclusion.v[1]+pad;
      }
      if (f.kind==='school-forecourt') {
        const dx=x-f.pts[0][0], dz=z-f.pts[0][1], a=f.angle||0;
        const u=Math.cos(a)*dx-Math.sin(a)*dz, v=Math.sin(a)*dx+Math.cos(a)*dz;
        return u>=-13-pad && u<=13+pad && v>=-pad && v<=36+pad;
      }
      if (f.kind==='barrier' || f.kind==='track' || (['water','pier'].includes(f.kind) && !f.closed)) {
        const pts=f.closed && f.pts.length ? [...f.pts,f.pts[0]] : f.pts;
        return distToPolyline(pts,x,z)<(f.width||4)/2+pad;
      }
      return ['gravel','pitch','playground','water','beach','pier','garden','paving','bleachers','cropland'].includes(f.kind) && polygonFeatureDistance(f,x,z)<pad;
    })) return true;
    if (entrancePaving.some(p => signedDistToPoly(p,x,z)<pad)) return true;
    if (onEntranceApproach(x,z,pad)) return true;
    for (const f of footways) {
      if (!inBB(f.bb, x, z)) continue;
      if (distToPolyline(f.pts, x, z) < f.width / 2 + pad) return true;
    }
    for (const ex of site.extras || []) {
      if (ex.type === 'canopy') {
        const c = Math.cos(ex.rotation || 0), s = Math.sin(ex.rotation || 0), dx = x-ex.x, dz = z-ex.z;
        if (Math.abs(c*dx-s*dz) < (ex.w || 14)/2+pad && Math.abs(s*dx+c*dz) < (ex.d || 9)/2+pad) return true;
      }
      if (ex.type === 'plaza' && Math.max(Math.abs(x - ex.x), Math.abs(z - ex.z)) < (ex.size || 10) / 2 + pad + 1) return true;
      if (ex.type === 'memorial' && Math.hypot(x - ex.x, z - ex.z) < (ex.size || 2.4) / 2 + pad + 0.5) return true;
    }
    for (const b of buildings) {
      const bpad = b.blueprint ? Math.max(pad, 7) : pad; // keep hand-drawn facades unobstructed
      if (x < b.bb.x0 - 7 || x > b.bb.x1 + 7 || z < b.bb.z0 - 7 || z > b.bb.z1 + 7) continue;
      if (signedDistToPoly(b.pts, x, z) < bpad) return true;
    }
    for (const a of areas) {
      if (a.kind !== 'parking') continue;
      if (x < a.bb.x0 || x > a.bb.x1 || z < a.bb.z0 || z > a.bb.z1) continue;
      if (pointInPoly(a.pts, x, z)) return true;
    }
    return false;
  };

  await mark('buildings');
  // Small composed gardens beside the entrance, with room for the porch
  // steps and the walk. A separate seed keeps these additions independent
  // of the larger tree/car scatter. Flowers join the existing shared batch.
  const gardenFlowers = [];
  const gardenClear = (x,z) => Math.abs(x)<W/2-1 && Math.abs(z)<H/2-1
    && !onRoad(x,z,0.5)
    && !onRailway(x,z,0.5)
    && !footways.some(f => distToPolyline(f.pts,x,z)<f.width/2+0.3)
    && !entrancePaving.some(p => signedDistToPoly(p,x,z)<0.35)
    && !onEntranceApproach(x,z,0.35)
    && !buildings.some(b => signedDistToPoly(b.pts,x,z)<0.4)
    && !lots.some(a => pointInPoly(a.pts,x,z));
  for(const {b,fr,at,reach} of gardenFronts) {
    const gardenRng=makeRng(`${seed}:garden:${b.id}`);
    for(const f of [0.16,0.84]) {
      if(Math.abs(f-at)*fr.length<2 || reach-fr.depth<2.2) continue;
      const out=fr.depth+1.0, rx=Math.min(1.5,fr.length*0.14), rz=0.65;
      const pts=Array.from({length:12},(_,i) => {
        const a=i*Math.PI/6;
        return fr.point(f+Math.cos(a)*rx/fr.length,out+Math.sin(a)*rz);
      });
      if(!pts.every(([x,z]) => gardenClear(x,z))) continue;
      const bed=pavedSlab(pts,yAt,0.14,0x645847,0x74624f,0.1);
      if(bed) g.add(bed);
      const [bx,bz]=fr.point(f-0.35/fr.length,out);
      const bush=buildBush(gardenRng);
      bush.scale.set(1.05,0.85,0.9); bush.position.set(bx,yAt(bx,bz)+0.14,bz); g.add(bush);
      for(let i=0;i<7;i++) {
        const [x,z]=fr.point(f+gardenRng.range(0.0,rx*0.7)/fr.length,out+gardenRng.range(-0.4,0.4));
        gardenFlowers.push([x,yAt(x,z)+0.14,z,gardenRng.range(0.7,1.0)]);
      }
      // A few half-buried stones suggest an old garden edge, not a fence.
      for(const i of [1,3,5,7,9,11]) {
        const [x,z]=pts[i];
        const stone=rbox(0.3,0.14,0.22,P.flagstone,0.04,x,yAt(x,z)+0.07,z);
        stone.rotation.y=gardenRng.range(0,Math.PI); g.add(stone);
      }
    }
  }
  // Occasional terracotta pots tucked beside a shop window. Leave doors,
  // steps and the full public sidewalk unobstructed.
  for(const {b,fr} of shopFronts) {
    if(fr.length<5) continue;
    const f=0.12, [x,z]=fr.point(f,0.65);
    if(fr.doors.some(at => Math.abs(at-f)*fr.length<1.4)
      || footways.some(w => distToPolyline(w.pts,x,z)<w.width/2+0.55)
      || onRoad(x,z,0.6)) continue;
    const potRng=makeRng(`${seed}:pot:${b.id}:${x}`);
    const y=Math.max(b.base+0.12,yAt(x,z)+0.12);
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.25,0.52,10),mat(0x9b7056));
    pot.position.set(x,y+0.26,z); g.add(pot);
    const plant=buildBush(potRng); plant.scale.setScalar(0.6);
    plant.position.set(x,y+0.5,z); g.add(plant);
  }
  // --- trees -------------------------------------------------------------
  const density = { park: 1 / 190, grass: 1 / 90, wood: 1 / 25, cemetery: 1 / 120, residential: 1 / 700, commercial: 1 / 900, religious: 1 / 250, school: 1 / 400 };
  const vegetationRng=makeRng(`${seed}:landscape`), admitTree=treeSpacing();
  for(const e of site.extras||[])if(e.type==='tree')admitTree(e.x,e.z,4);
  const treeSpots = []; // [x, z, canopy radius]: the grass round each tree is shaded and tufted below
  const treeCounts={riparian:0,woodland:0,yards:0,mapped:0,scattered:0};
  const treeCandidates=[],treeOrder=makeRng(`${seed}:tree-order`);
  const placeTree = (x,z,scale,riparian=false,woodland=false,priority=2) => {
    treeCandidates.push({x,z,scale,riparian,woodland,priority:riparian?0:priority,order:treeOrder.next()});
  };
  const plantTree = ({x,z,scale,riparian,woodland,priority}) => {
    if(dioramaOutline && !dioramaOutline.contains(x,z,scale*3))return;
    if (opts.trees === false || !admitTree(x,z,woodland?2:2.5)) return;
    const t = buildLandscapeTree(vegetationRng, {riparian});
    t.scale.multiplyScalar(scale);
    t.position.set(x, yAt(x, z), z);
    if (opts.onScene) t.userData.streamKind = 'tree';
    g.add(t);
    treeSpots.push([x, z, 1.7 * scale]);
    treeCounts[riparian?'riparian':woodland?'woodland':priority===1?'yards':priority===3?'scattered':'mapped']++;
  };
  function* vegetationSamples(bb, dens, random = rng, rural = 0.01) {
    const cell=100;
    for(let z0=Math.max(-H/2,bb.z0);z0<Math.min(H/2,bb.z1);z0+=cell) {
      const z1=Math.min(z0+cell,H/2,bb.z1);
      for(let x0=Math.max(-W/2,bb.x0);x0<Math.min(W/2,bb.x1);x0+=cell) {
        const x1=Math.min(x0+cell,W/2,bb.x1);
        const expected=(x1-x0)*(z1-z0)*dens*centralDensity((x0+x1)/2,(z0+z1)/2,rural);
        const n=Math.floor(expected)+(random.next()<expected%1?1:0);
        for(let i=0;i<n;i++) yield [random.range(x0,x1),random.range(z0,z1)];
      }
    }
  }
  const wholeSite={x0:-W/2,x1:W/2,z0:-H/2,z1:H/2};
  for (const a of areas) {
    const dens = density[a.kind];
    if (!dens) continue;
    for (const [x,z] of vegetationSamples(a.bb,dens,vegetationRng,a.kind==='wood'?.85:.5)) {
      if (!pointInPoly(a.pts,x,z) || blocked(x,z,2)) continue;
      // Irregular thickets and clearings instead of uniform random dots.
      if(a.kind==='wood' && fbm(x*.045,z*.045)<.3)continue;
      placeTree(x,z,(a.kind==='park'?vegetationRng.range(2.6,3.6):vegetationRng.range(1,1.6)),false,a.kind==='wood',a.kind==='wood'?1:2);
    }
  }
  for (const [x,z] of vegetationSamples(wholeSite,1/750,vegetationRng,.5)) {
    if (!blocked(x,z,2.5) && !areas.some(a=>['field','pitch','industrial'].includes(a.kind)&&inBB(a.bb,x,z)&&pointInPoly(a.pts,x,z)))
      placeTree(x,z,vegetationRng.range(1,1.7),false,false,3);
  }
  const understory=[];
  for(const water of site.landmarks||[]) {
    if(water.kind!=='water')continue;
    const points=water.closed?[...water.pts,water.pts[0]]:water.pts;
    const samples=resample(points,11),half=water.closed?0:(water.width||3)/2;
    for(let i=1;i<samples.length-1;i++) {
      const a=samples[i-1],p=samples[i],b=samples[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
      const nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L;
      for(const side of [-1,1]) {
        const reach=half+vegetationRng.range(3.5,18),along=vegetationRng.range(-4,4);
        const x=p[0]+nx*side*reach+nz*along,z=p[1]+nz*side*reach-nx*along;
        if(!blocked(x,z,2) && !areas.some(a=>['pitch','parking'].includes(a.kind)&&inBB(a.bb,x,z)&&pointInPoly(a.pts,x,z)))
          placeTree(x,z,vegetationRng.range(1.15,1.9),true,true);
        const shrubReach=half+vegetationRng.range(1.7,4.2);
        const sx=p[0]+nx*side*shrubReach,sz=p[1]+nz*side*shrubReach;
        if(!blocked(sx,sz,.6))understory.push([sx,sz]);
      }
    }
  }
  // Residential tree cover is not completely mapped as land-use polygons.
  // Add small, irregular yard groups, keeping actual paving and buildings clear.
  for(const b of buildings.filter(b=>b.style.kind==='house')) {
    const yard=makeRng(`${seed}:yard:${b.id}`),o=b.obb,c=Math.cos(o.angle),s=Math.sin(o.angle);
    for(let i=0;i<6;i++) {
      const a=yard.range(0,Math.PI*2),u=Math.cos(a)*(o.w/2+yard.range(8,17)),v=Math.sin(a)*(o.d/2+yard.range(8,17));
      const x=o.cx+c*u-s*v,z=o.cz+s*u+c*v;
      if(!blocked(x,z,2.5) && !areas.some(a=>['field','pitch','parking'].includes(a.kind)&&inBB(a.bb,x,z)&&pointInPoly(a.pts,x,z)))
        placeTree(x,z,yard.range(1.05,1.7),false,false,1);
    }
  }
  for(const a of areas.filter(a=>a.kind==='wood'))for(const [x,z] of vegetationSamples(a.bb,1/200,vegetationRng,.6)) {
    if(pointInPoly(a.pts,x,z)&&!blocked(x,z,.8))understory.push([x,z]);
  }
  for(const [x,z] of understory.slice(0,3500)) {
    const bush=buildBush(vegetationRng);bush.scale.setScalar(vegetationRng.range(1.5,2.7));
    bush.traverse(o=>{if(o.isMesh)o.material=mat(vegetationRng.pick([0x5d7441,0x687b43,0x506b3f]));});
    bush.position.set(x,yAt(x,z),z);g.add(bush);
    if(vegetationRng.chance(.23) && !blocked(x+.8,z,.7)) {
      const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.4,0),mat(vegetationRng.pick([0x8a8779,0x77796d,0x9a9585])));
      rock.scale.set(1.5,.5,1);rock.position.set(x+.8,yAt(x+.8,z)+.07,z);g.add(rock);
    }
  }
  // Keep waterway and yard trees when habitat passes overlap. There is no
  // map-wide tree cap: sector streaming bounds resident detail, so expanding
  // the map cannot take trees away from the village.
  treeCandidates.sort((a,b)=>a.priority-b.priority||a.order-b.order);
  for(const candidate of treeCandidates)plantTree(candidate);
  // Each tree stands in its own pool of shade: the lawn under the canopy is
  // tinted down a little (on top of the sun shadow it throws to one side), so
  // the tree is grounded instead of hovering over bright grass.
  {
    const col = ground.geo.attributes.color, pos = ground.geo.attributes.position, nx = ground.nx, nz = ground.nz;
    for (const [tx, tz, tr] of treeSpots) {
      const R = tr * 1.1;
      const i0 = Math.max(0, Math.floor(axisFraction(ground.xs,tx-R))), i1 = Math.min(nx, Math.ceil(axisFraction(ground.xs,tx+R)));
      const j0 = Math.max(0, Math.floor(axisFraction(ground.zs,tz-R))), j1 = Math.min(nz, Math.ceil(axisFraction(ground.zs,tz+R)));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * (nx + 1) + i;
          const d = Math.hypot(pos.getX(k) - tx, pos.getZ(k) - tz) / R;
          if (d >= 1) continue;
          const f = 1 - (1 - d * d) * (1 - d * d) * 0.12;
          col.setXYZ(k, col.getX(k) * f, col.getY(k) * f, col.getZ(k) * f);
        }
      }
    }
  }

  // --- street furniture -----------------------------------------------------
  const lamps = [], lampBases = [];
  const addLamp = (x, z, angle, side, random) => {
    const lamp = buildLamp(random);
    if (opts.onScene) lamp.userData.streamBase = true;
    lamp.scale.multiplyScalar(1.7); // real street lights are ~6 m
    lamp.position.set(x, walkY(x, z), z);
    lamp.rotation.y = -angle + (side > 0 ? Math.PI : 0);
    g.add(lamp);
    lamps.push(lamp.getObjectByName('streetlamp-bulb').getWorldPosition(new THREE.Vector3()));
    lampBases.push([x,z]);
  };
  for (const p of site.pois.filter(p=>['street_lamp','streetlight'].includes(p.kind))) {
    if (Math.abs(p.x)<W/2-1 && Math.abs(p.z)<H/2-1) addLamp(p.x,p.z,0,1,lightingRng);
  }
  const mainStreets = vehicular.filter((r) => ['trunk', 'primary', 'tertiary'].includes(r.class));
  const manholeGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.02, 14);
  for (const r of mainStreets) {
    // a manhole cover every 45 m or so, a little off the centre line, none in a junction
    const dm = resample(r.pts, 45), others = vehicular.filter((o) => o !== r);
    for (let i = 1; i < dm.length - 1; i++) {
      const [x, z] = dm[i], a = dm[i - 1], b = dm[i + 1];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s = (i % 2 ? 1 : -1) * Math.min(1.6, r.width * 0.2);
      const mx = x - Math.sin(ang) * s, mz = z + Math.cos(ang) * s;
      if (Math.abs(mx) > W / 2 - 2 || Math.abs(mz) > H / 2 - 2 || others.some(o=>stripSDF(o.pts,o.width/2,o.closed,mx,mz)<2.5)) continue;
      const cover = new THREE.Mesh(manholeGeo, mat(P.manhole));
      cover.position.set(mx, roadY(mx, mz) + 0.018, mz);
      g.add(cover);
    }
    const dense = densify(r.pts, 22);
    for (let i = 1; i < dense.length - 1; i += 2) {
      const [x, z] = dense[i];
      const a = dense[i - 1], b = dense[i + 1];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const s = i % 4 === 1 ? 1 : -1;
      const lx = x - Math.sin(ang) * s * (r.width / 2 + 1.0), lz = z + Math.cos(ang) * s * (r.width / 2 + 1.0);
      if (lightingRng.next() > centralDensity(lx,lz) || blocked(lx, lz, 0.5)
        || lampBases.some(([x,z])=>Math.hypot(x-lx,z-lz)<18/centralDensity(lx,lz))) continue;
      addLamp(lx, lz, ang, s, rng);
    }
  }

  // Keep the established main-street lights, then sample each driving street,
  // including residential roads and service lanes. Sample physical distance
  // so short OSM segments neither crowd poles together nor leave long gaps.
  // A slim pole can stand at a sidewalk's edge, closer to a facade than a tree.
  const lampClear = (x,z) => Math.abs(x)<W/2-1.5 && Math.abs(z)<H/2-1.5
    && !onRoad(x,z,0.35) && !onRailway(x,z,0.6)
    && !nearCrossing(x,z,1)
    && !entrancePaving.some(p=>signedDistToPoly(p,x,z)<0.4)
    && !footways.some(f=>distToPolyline(f.pts,x,z)<Math.max(0.6,f.width/2-0.45))
    && !buildings.some(b=>signedDistToPoly(b.pts,x,z)<0.8)
    && !lots.some(a=>signedDistToPoly(a.pts,x,z)<0.3)
    && !treeSpots.some(([tx,tz])=>Math.hypot(tx-x,tz-z)<1.1)
    && !lampBases.some(([lx,lz])=>Math.hypot(lx-x,lz-z)<18/centralDensity(x,z));
  const lampRng = makeRng(`${seed}:streetlights`);
  for (const r of vehicular) {
    const samples = resample(r.pts, r.class === 'service' ? 36 : 26);
    for (let i=0;i<samples.length-1;i++) {
      const a=samples[i], b=samples[i+1];
      const angle=Math.atan2(b[1]-a[1],b[0]-a[0]), side=i%2 ? -1 : 1;
      // One decision for the whole interval: placement retries cannot backfill
      // the intentionally dark stretches outside the town center.
      if (lightingRng.next() > centralDensity((a[0]+b[0])/2,(a[1]+b[1])/2)) continue;
      let placed=false;
      // If an entrance occupies the preferred spot, try along the same curb
      // or across the street instead of leaving that entire stretch unlit.
      for (const t of [0.5,0.3,0.7]) {
        for (const s of [side,-side]) {
          for (const inset of [0.75,1.25,2]) {
            const x=a[0]+(b[0]-a[0])*t-Math.sin(angle)*s*(r.width/2+inset);
            const z=a[1]+(b[1]-a[1])*t+Math.cos(angle)*s*(r.width/2+inset);
            if (!lampClear(x,z)) continue;
            addLamp(x,z,angle,s,lampRng);
            placed=true; break;
          }
          if (placed) break;
        }
        if (placed) break;
      }
    }
  }

  // --- parked cars, in rows in the lots and along the on-street bays (parking.js) ----
  const mappedParkingLotIds=new Set(parkingRows.map(f=>String(f.parkingLotId)));
  const genericParking=buildParking(rng,{lots,surfaceY:slabY,roadEdge,W,H});
  const mappedLots=lots.filter(l=>mappedParkingLotIds.has(String(l.id)));
  for(const car of [...genericParking.children]) {
    if(mappedLots.some(l=>pointInPoly(l.pts,car.position.x,car.position.z))) car.removeFromParent();
  }
  g.add(genericParking);
  const mappedCars=buildMappedParking(parkingRows,{lots,surfaceY:slabY,
    roadEdge:parkingRoadEdge,W,H});
  for(const car of [...mappedCars.children]) g.add(await emitModel(car));

  await mark('trees, lamps, cars');
  // --- extras from overrides -----------------------------------------------
  for (const ex of site.extras || []) {
    if (ex.type === 'tree' && opts.trees === false) continue;
    let m = null;
    if (ex.type === 'monument') m = buildMonument(rng, ex);
    else if (ex.type === 'gazebo') m = buildGazebo(rng, ex);
    else if (ex.type === 'tree') { m = buildTree(rng, { lowDetail: opts.memoryOptimized }); m.scale.multiplyScalar(ex.scale || 1.5); if (opts.onScene) m.userData.streamKind = 'tree'; }
    else if (ex.type === 'wall') { m = buildStoneWall(rng, -ex.length / 2, ex.length / 2, 0); m.rotation.y = ex.angle || 0; }
    else if (ex.type === 'flowers') m = buildFlowerCluster(rng, ex.count || 12);
    else if (ex.type === 'clock') m = buildStreetClock(rng, ex);
    else if (ex.type === 'canopy') m = buildCanopy(rng, ex, yAt);
    else if (ex.type === 'plaza') m = buildPlaza(rng, ex);
    else if (ex.type === 'memorial') m = buildMemorial(rng, ex);
    if (opts.onScene && m && ['monument','gazebo','clock','memorial'].includes(ex.type)) m.userData.streamBase = true;
    if (!m) continue;
    m.position.set(ex.x, yAt(ex.x, ex.z), ex.z);
    if (ex.rotation) m.rotation.y = ex.rotation;
    g.add(m);
  }

  // --- grass tufts and flowers ------------------------------------------------
  // Twice the tufts, a third of them clumped in rings round the tree trunks
  // where the grass grows long; the rest scattered
  const tuftCandidates = [...vegetationSamples(wholeSite,0.11)];
  const tuftCount = tuftCandidates.length;
  let tuftCursor=0;
  const unpaved = (x, z) => !blocked(x, z, 0.6) && !['road', 'paved', 'parking'].includes(coverAt(x, z));
  const sampleTuft = () => {
    if (treeSpots.length && rng.chance(0.3)) {
      const [tx, tz, tr] = rng.pick(treeSpots);
      const a = rng.range(0, Math.PI * 2), d = tr * rng.range(0.12, 0.45);
      return [tx + Math.cos(a) * d, tz + Math.sin(a) * d];
    }
    return tuftCandidates[tuftCursor++ % Math.max(1,tuftCandidates.length)] || [0,0];
  };
  const tufts = scatterTufts(rng, tuftCount, sampleTuft, (x, z) => !unpaved(x, z), { stride: opts.memoryOptimized ? 4 : 1 });
  g.add(tufts);
  // Wildflowers in loose drifts through the lawns and the park
  const flowerSpots = [...gardenFlowers];
  for (const [cx,cz] of vegetationSamples(wholeSite,1/1400)) {
    if (!unpaved(cx, cz)) continue;
    const n = rng.int(6, 16), R = rng.range(1.2, 3);
    for (let k = 0; k < n; k++) {
      const x = cx + rng.range(-R, R), z = cz + rng.range(-R, R);
      if (unpaved(x, z)) flowerSpots.push([x, yAt(x, z), z, rng.range(0.7, 1.2)]);
    }
  }
  if (flowerSpots.length) g.add(scatterFlowers(rng, flowerSpots));
  // Tufts are placed at y=0.02 in their own frame; lift each to the terrain
  {
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < tufts.count; i++) {
      tufts.getMatrixAt(i, m4);
      m4.decompose(p, q, s);
      p.y = yAt(p.x, p.z) + 0.02;
      m4.compose(p, q, s);
      tufts.setMatrixAt(i, m4);
    }
    tufts.instanceMatrix.needsUpdate = true;
  }
  for (const [x,z] of vegetationSamples(wholeSite,1/2500)) {
    if (blocked(x, z, 1)) continue;
    const f = buildFlowerCluster(rng, rng.int(5, 10));
    f.position.set(x, yAt(x, z), z);
    g.add(f);
  }

  await mark('extras, tufts');
  // The edge of the diorama is the edge. The data carries roads and footways
  // 12 m past it so the terrain flattens right up to the border, but no ribbon,
  // curb or slab may hang over the void: every vertex outside the site is
  // pulled onto the border, so each surface ends in a straight line exactly
  // there and the overshoot collapses to nothing. Props are placed inside only.
  const HW = W / 2, HH = H / 2;
  for (const o of g.children) {
    if (o.name !== 'ribbon' && o.name !== 'curb' && o.name !== 'slab') continue;
    const p = o.geometry.attributes.position;
    let touched = false;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      if (x < -HW || x > HW) { p.setX(i, Math.max(-HW, Math.min(HW, x))); touched = true; }
      if (z < -HH || z > HH) { p.setZ(i, Math.max(-HH, Math.min(HH, z))); touched = true; }
    }
    if (touched) { p.needsUpdate = true; o.geometry.computeBoundingSphere(); }
  }
  if(dioramaOutline) {
    const skirtMaterial=grainy(vmat.clone());skirtMaterial.side=THREE.DoubleSide;
    applyDioramaOutline(g,dioramaOutline,{bottom:ground.bottom,heightAt:grade,
      topColor:new THREE.Color(P.dirt),bottomColor:new THREE.Color(P.dirtDark),
      skirtMaterial,bottomMaterial:mat(P.dirtDark)});
    for(let i=lamps.length-1;i>=0;i--)if(!dioramaOutline.contains(lamps[i].x,lamps[i].z,2))lamps.splice(i,1);
  }
  await mark('edge');
  // Bake into a handful of draw calls (shadow flags are set in there too)
  // ?nobake=1 keeps every generator's mesh separate (slow) so a raycast can say what a pixel is
  const out = opts.onScene ? await opts.onScene(g)
    : new URLSearchParams(location.search).has('nobake') ? g
    // Geometry sharing also applies to desktop authoring and fallback views;
    // expanding every repeated tree would undo the sector export's savings.
    : await bakeMobile(g);
  if (opts.memoryOptimized) clearConstructionCaches();
  await mark('bake');

  return { group: out, size: { w: W, d: H }, smokes, lamps, bottom: ground.bottom, prof,
    landscape:{trees:treeSpots.length,byHabitat:treeCounts,understory:Math.min(3500,understory.length)},
    precomputedSurfaces: usedSurfaces, terrainGrid:grid,
    surfaces:{grade,roadY,walkY,roadDistance,floors:buildings.map(b=>({id:b.id,base:b.base}))} };
}
