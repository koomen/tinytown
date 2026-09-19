// Blueprint renderer: turns a hand-authored (or agent-authored) description of
// a specific real building into a cute, recognizable caricature.
//
// A blueprint describes a building as VOLUMES laid out in the footprint's own
// frame (u along the long side of its oriented bounding box, v across; metres
// from the box centre), each with a roof, and per-FACE facades: storeys of
// windows of a given shape (rect / arch / gothic / round / shop / basement),
// doors, storefronts, awnings, parapets (pediment / mission / arch / stepped),
// cornices with dentils, belt courses, plinths, buttresses, porches, towers,
// cupolas, chimneys, crosses and styled signs. See docs/BLUEPRINT_SCHEMA.md.
//
// The look is deliberately a caricature: chunky trim, rounded masses, a few
// well-chosen windows rather than every real one.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P } from './palette.js';
import { WALL_COLORS, ROOF_COLORS, col } from './colors.js';
import { mat, box, rbox, jitterColor, glowMat, gableRoof, buildBush, buildChimney, imat, roofPanel } from './kit.js';
import { surfaceMaterial, facadeMaterial, frameGeometry, paneUV, usesPaneUV } from './materials.js';
import { trimCoveredWalls } from './wall-union.js';
import { joinFlatRoofs } from './roof-union.js';
import { buildBridge } from './bridge.js';
import { brandSignMaterial, signBrand } from './landmarks.js';
import { buildPavilion } from './pavilion.js';
import { buildBarrelRoof } from './barrel-roof.js';
import { buildAmphitheater } from './amphitheater.js';
import { buildFountain } from './fountain.js';
import { buildBarrelAwning } from './awning.js';
import { buildAthenaeumFront } from './athenaeum-front.js';
import { buildAlumniHallBalcony } from './alumni-hall-balcony.js';
import { buildLennaHall } from './lenna-hall.js';
import { buildHultquistCenter } from './hultquist-center.js';

// Big shop panes: a gentler glow than house windows, so they read as glass with
// a lit room behind rather than white slabs
const shopGlass = surfaceMaterial('shop', 0x829494);

const wall = (k, fb = WALL_COLORS.cream) => col(WALL_COLORS, k, fb);
const roofc = (k, fb = ROOF_COLORS.slate) => col(ROOF_COLORS, k, fb);

// ---------------------------------------------------------------------------
// Outlines in the facade plane (x across, y up), returned as point arrays

function outline(type, w, h) {
  const r = w / 2;
  const pts = [];
  if (type === 'rect' || type === 'shop' || type === 'basement') {
    return [[-r, -h / 2], [r, -h / 2], [r, h / 2], [-r, h / 2]];
  }
  if (type === 'round') {
    for (let i = 0; i < 24; i++) pts.push([Math.cos((i / 24) * Math.PI * 2) * r, Math.sin((i / 24) * Math.PI * 2) * r]);
    return pts;
  }
  if (type === 'arch') {
    // rectangle with a semicircular head
    const y0 = h / 2 - r;
    pts.push([-r, -h / 2], [r, -h / 2]);
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      pts.push([Math.cos(a) * r, y0 + Math.sin(a) * r]);
    }
    return pts;
  }
  if (type === 'gothic') {
    // equilateral pointed arch: two arcs of radius w centred on the opposite springers
    const rise = Math.min(0.866 * w, h * 0.55);
    const k = rise / (0.866 * w); // squash factor if the rise had to be clamped
    const y0 = h / 2 - rise;
    pts.push([-r, -h / 2], [r, -h / 2]);
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * (Math.PI / 3); pts.push([-r + Math.cos(a) * w, y0 + Math.sin(a) * w * k]); }   // right arc → apex
    for (let i = 8; i >= 0; i--) { const a = (i / 8) * (Math.PI / 3); pts.push([r - Math.cos(a) * w, y0 + Math.sin(a) * w * k]); }    // apex → left springer
    return pts;
  }
  return [[-r, -h / 2], [r, -h / 2], [r, h / 2], [-r, h / 2]];
}

function shapeOf(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

// Slab of the given outline, `depth` thick along z, centred at z = zc
function slab(pts, depth, color, zc = 0, material = null) {
  const geo = new THREE.ExtrudeGeometry(shapeOf(pts), { depth, bevelEnabled: false });
  geo.translate(0, 0, zc - depth / 2);
  if (material && usesPaneUV(material.userData.surface)) paneUV(geo);
  return new THREE.Mesh(geo, material || mat(color));
}

// Grow an outline outward by `d` (about its centroid — fine for these convex shapes)
function grow(pts, d) {
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= pts.length; cy /= pts.length;
  return pts.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const L = Math.hypot(dx, dy) || 1;
    return [x + (dx / L) * d, y + (dy / L) * d];
  });
}

// Four overlapping circular lobes form a single closed glass opening. Taking
// their outer radial envelope keeps the outline simple and avoids seams where
// separate panes would overlap.
function quatrefoilOutline(radius, x = 0, y = 0) {
  const offset = radius * 0.49, lobe = radius * 0.51;
  return Array.from({length: 64}, (_, i) => {
    const angle = i * Math.PI / 32;
    let r = 0;
    for (let k = 0; k < 4; k++) {
      const projection = offset * Math.cos(angle - k * Math.PI / 2);
      r = Math.max(r, projection + Math.sqrt(lobe * lobe - offset * offset + projection * projection));
    }
    return [x + r * Math.cos(angle), y + r * Math.sin(angle)];
  });
}

function traceryEl(type, outlinePoints, w, h, color) {
  const shape = shapeOf(outlinePoints);
  const holes = type === 'rose'
    ? [quatrefoilOutline(w * 0.15), ...Array.from({length: 6}, (_, i) => {
      const a = Math.PI / 2 + i * Math.PI / 3;
      return quatrefoilOutline(w * 0.15, Math.cos(a) * w * 0.315, Math.sin(a) * w * 0.315);
    })]
    : [quatrefoilOutline(Math.min(w * 0.33, h * 0.25), 0, -h * 0.12)];
  for (const points of holes) shape.holes.push(new THREE.Path([...points].reverse().map(p => new THREE.Vector2(...p))));
  const geo = new THREE.ExtrudeGeometry(shape, {depth: 0.06, bevelEnabled: false});
  geo.translate(0, 0, -0.15);
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.name = 'window-tracery';
  return mesh;
}

// ---------------------------------------------------------------------------
// Facade elements. All are built with local -z pointing OUT of the wall and
// the origin on the wall plane.

function windowEl(spec) {
  const type = spec.type || 'rect';
  const w = spec.w || 1.1, h = spec.h || (type === 'basement' ? 0.7 : type === 'shop' ? 2.4 : 1.8);
  const g = new THREE.Group();
  const ornamental = spec.tracery === 'rose' || spec.tracery === 'quatrefoil';
  const trim = wall(spec.trim, P.trim);
  if(type==='clock') {
    // Open metal dial: the building's masonry shows between the numerals.
    const r=w/2, ring=new THREE.Mesh(new THREE.TorusGeometry(r,w*.016,6,64),mat(trim));
    ring.position.z=-.15;g.add(ring);g.name='facade-clock';
    const cv=document.createElement('canvas');cv.width=cv.height=512;
    const c=cv.getContext('2d');c.fillStyle='#'+new THREE.Color(trim).getHexString();
    c.font='bold 47px Georgia';c.textAlign='center';c.textBaseline='middle';
    const roman=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
    for(let i=0;i<12;i++){const a=i*Math.PI/6;c.fillText(roman[i],256+196*Math.sin(a),256-196*Math.cos(a));}
    const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;
    const face=new THREE.Mesh(new THREE.PlaneGeometry(w,w),new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.2,side:THREE.DoubleSide}));
    face.rotation.y=Math.PI;face.position.z=-.16;g.add(face);
    for(const [angle,length] of [[Math.PI*.5,r*.79],[-Math.PI*.65,r*.55]]) {
      const hand=box(w*.035,length,.06,trim,-Math.sin(angle)*length/2,Math.cos(angle)*length/2,-.22);
      hand.rotation.z=angle;g.add(hand);
    }
    return g;
  }
  const tint = new THREE.Color(spec.glass ? wall(spec.glass) : P.windowGlass);
  if (spec.glass) tint.lerp(new THREE.Color(P.windowGlass), 0.35);
  const variation = Math.abs(Math.sin((spec._variant ?? 1) * 13.7));
  tint.multiplyScalar(0.92 + 0.12 * variation);
  if (variation > 0.96) tint.lerp(new THREE.Color(0xb3a17c),0.35);
  // Decorative glazing can share the clear shop treatment without house blinds
  // and curtains, while retaining the same subtle reflections and pane batching.
  const glass = surfaceMaterial(type === 'shop' || spec.interior === false || ornamental ? 'shop' : 'glass', tint.getHex());
  const o = outline(type, w, h);
  const frameW = spec.frameW || 0.14;
  g.add(new THREE.Mesh(frameGeometry(offsetOutline(o, frameW), o), mat(trim)));       // equal trim width perpendicular to every edge, including the arch
  g.add(slab(o, 0.1, null, -0.04, glass));                    // glass recessed behind the open frame
  if (ornamental) {
    g.add(traceryEl(spec.tracery, o, w, h, wall(spec.traceryColor, trim)));
  } else if (spec.divisions) {
    const mc = wall(spec.mullionColor, trim), bw = spec.divisions.width ?? 0.06;
    // Clip every custom bar to the actual pane outline, including arch tops.
    for (const [axis, fractions] of [['x', spec.divisions.vertical || []], ['y', spec.divisions.horizontal || []]]) {
      for (const fraction of fractions) {
        const level = (fraction - 0.5) * (axis === 'x' ? w : h), hits = [];
        const ai = axis === 'x' ? 0 : 1, bi = 1 - ai;
        for (let i = 0; i < o.length; i++) {
          const a = o[i], b = o[(i + 1) % o.length];
          if ((a[ai] <= level && b[ai] > level) || (b[ai] <= level && a[ai] > level)) hits.push(a[bi] + (level-a[ai])/(b[ai]-a[ai])*(b[bi]-a[bi]));
        }
        hits.sort((a,b)=>a-b);
        for (let j = 0; j + 1 < hits.length; j += 2) {
          const lo = hits[j], hi = hits[j+1], mid = (lo+hi)/2;
          const bar = axis === 'x' ? box(bw, hi-lo, .05, mc, level, mid, -.135) : box(hi-lo, bw, .05, mc, mid, level, -.135);
          bar.name = 'custom-window-bar'; g.add(bar);
        }
      }
    }
  } else if (type !== 'basement' && spec.mullions !== false) {
    const mc = wall(spec.mullionColor, trim);
    const mv = box(0.06, h * 0.98, 0.05, mc, 0, 0, -0.135);
    const mh = box(w, 0.06, 0.05, mc, 0, spec.transomY ?? h * 0.12, -0.135);
    g.add(mv, mh);
    if (type === 'arch' || type === 'gothic') g.add(box(w, 0.06, 0.05, mc, 0, h / 2 - w / 2, -0.135)); // springline bar
    if (spec.tracery) for (const dx of [-0.25, 0.25]) g.add(box(0.06, h * 0.6, 0.05, mc, dx * w, -h * 0.1, -0.135)); // extra lancet bars
  }
  if (spec.sill !== false && type !== 'round' && type !== 'basement') g.add(rbox(w + 2 * frameW + 0.16, 0.08, 0.16, trim, 0.02, 0, -h / 2 - frameW - 0.04, -0.06));
  if (spec.hood) { // flat stone hood / pediment cap over the window
    g.add(rbox(w + 2 * frameW + 0.24, 0.14, 0.2, wall(spec.hood === true ? spec.trim : spec.hood, trim), 0.03, 0, h / 2 + frameW + 0.08, -0.08));
  }
  if (spec.shutters) {
    for (const s of [-1, 1]) g.add(rbox(w * 0.42, h, 0.06, wall(spec.shutters), 0.02, s * (w / 2 + frameW + w * 0.24), 0, -0.05));
  }
  if (spec.keystone) g.add(rbox(0.3, 0.4, 0.14, trim, 0.03, 0, h / 2 + frameW, -0.08));
  if (spec.planter) { // flower box under the sill
    g.add(rbox(w + 0.1, 0.26, 0.32, wall(spec.planter === true ? '#6b4a35' : spec.planter), 0.04, 0, -h / 2 - frameW - 0.28, -0.22));
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), mat(P.flowers[i % P.flowers.length])); f.position.set(-w / 2 + 0.15 + (i * (w - 0.3)) / 3, -h / 2 - frameW - 0.1, -0.3); g.add(f); }
  }
  return g;
}

// Wide sectional garage door: pale flat leaf in a thin surround, a few shallow
// horizontal panel grooves and a row of four little lights in the top panel.
function garageDoorEl(spec) {
  const w = spec.w || 2.6, h = spec.h || 2.4;
  const g = new THREE.Group();
  const color = wall(spec.color, 0xe4e1da);
  const sur = wall(spec.surround, P.trim);
  const groove = new THREE.Color(color).offsetHSL(0, 0, -0.1).getHex();
  const o = outline('rect', w, h);
  g.add(slab(grow(o, spec.surroundW || 0.12), 0.1, sur, 0));      // thin surround
  g.add(slab(o, 0.1, color, -0.04));                              // the leaf
  const panels = spec.panels || 4;
  for (let i = 1; i < panels; i++) g.add(box(w * 0.98, 0.04, 0.03, groove, 0, -h / 2 + (i * h) / panels, -0.1));
  if (spec.lights !== false) { // a row of small square lights in the top panel
    const ly = h / 2 - h / panels / 2, lw = Math.min(0.42, w / 6), lh = Math.min(0.32, (h / panels) * 0.55);
    for (let i = 0; i < 4; i++) {
      const lx = ((i - 1.5) * w) / 4.6;
      g.add(box(lw + 0.08, lh + 0.08, 0.03, sur, lx, ly, -0.095));
      const gl = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, 0.03), glowMat);
      gl.position.set(lx, ly, -0.11);
      g.add(gl);
    }
  }
  if (spec.lamp === true) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: P.lampGlow, emissive: P.lampGlow, emissiveIntensity: 1.4 }));
    lamp.position.set(w / 2 + 0.45, h * 0.3, -0.16);
    g.add(lamp);
  }
  const wrap = new THREE.Group();
  g.position.y = h / 2;
  wrap.add(g);
  return wrap;
}

function doorEl(spec) {
  const type = spec.type || 'rect';
  if (type === 'garage') return garageDoorEl(spec);
  const w = spec.w || (type === 'double' ? 1.8 : 1.2), h = spec.h || 2.5;
  const g = new THREE.Group();
  const color = wall(spec.color, P.doors[0]);
  const sur = wall(spec.surround, P.trim);
  const shape = type === 'double' ? 'rect' : type;
  const o = outline(shape, w, h);
  g.add(slab(grow(o, spec.surroundW || 0.22), 0.14, sur, 0));         // surround / architrave
  // Door leaf: on arched/gothic doors it stops at the springline and the head
  // is a glass fanlight; on square doors an optional transom sits above it.
  const headH = shape === 'arch' ? w / 2 : shape === 'gothic' ? Math.min(0.866 * w, h * 0.55) : (spec.fanlight ? 0.4 : 0);
  const leafH = h - headH;
  const leaf = slab(outline('rect', w, leafH), 0.12, color, -0.05);
  leaf.position.y = -h / 2 + leafH / 2;
  g.add(leaf);
  if (headH > 0) {
    // Follow the outline counter-clockwise: bottom-right, over the head,
    // bottom-left. Reversing the bottom corners makes a crossed bow tie.
    const springY = -h / 2 + leafH;
    const head = o.filter(([, y]) => y > springY + 1e-6)
      .filter((p, i, pts) => !i || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-8);
    head.unshift([w / 2, springY]); head.push([-w / 2, springY]);
    const hs = spec.fanlight === 'dark' ? mat(0x2a2826) : spec.fanlight !== false ? glowMat : mat(color);
    g.add(slab(head, 0.12, null, -0.05, hs));
    g.add(box(w, 0.07, 0.05, sur, 0, -h / 2 + leafH, -0.125));               // springline bar
    if (spec.fanlight !== false) for (const dx of [-0.25, 0.25]) g.add(box(0.05, headH * 0.9, 0.05, sur, dx * w, -h / 2 + leafH + headH * 0.45, -0.125));
  }
  if (type === 'double') g.add(box(0.05, leafH * 0.96, 0.04, sur, 0, -h / 2 + leafH / 2, -0.125));
  const knobs = type === 'double' ? [-0.15, 0.15] : [w * 0.3];
  for (const kx of knobs) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(WALL_COLORS.gold)); k.position.set(kx, -h / 2 + leafH * 0.45, -0.14); g.add(k); }
  if (spec.steps) {
    for (let i = 0; i < spec.steps; i++) g.add(rbox(w + 0.9 + i * 0.3, 0.18, 0.45 + i * 0.3, P.flagstone, 0.05, 0, -h / 2 - 0.09 - i * 0.18, -(0.3 + i * 0.15)));
  }
  if (spec.lamp !== false) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: P.lampGlow, emissive: P.lampGlow, emissiveIntensity: 1.4 }));
    lamp.position.set(w / 2 + 0.55, h * 0.25, -0.16);
    g.add(lamp);
  }
  // door sits on the ground: shift so its bottom is at y = 0
  const wrap = new THREE.Group();
  g.position.y = h / 2 + (spec.steps ? spec.steps * 0.18 : 0);
  wrap.add(g);
  return wrap;
}

// ---------------------------------------------------------------------------
// Sign textures

function signMaterial(text, style = 'board', opts = {}, aspect = 4) {
  const cv = document.createElement('canvas');
  cv.height = 256; cv.width = Math.min(4096, Math.round(256 * aspect));
  const ctx = cv.getContext('2d');
  const styles = {
    'gold-on-black': { bg: '#1c1a19', fg: '#d9b45a', font: '600 118px "Georgia", "Times New Roman", serif', border: '#c9a44a', caps: false, ornaments: true },
    'carved': { bg: opts.bg || '#cfc3a9', fg: '#4a4438', font: '700 120px "Georgia", serif', border: null, caps: true },
    'board': { bg: '#f4efe4', fg: '#2f2a26', font: '800 118px "Nunito", "Arial Rounded MT Bold", sans-serif', border: '#2f2a26', caps: false },
    'red': { bg: '#a8352c', fg: '#ffffff', font: '800 120px "Nunito", sans-serif', border: '#ffffff', caps: true },
    'navy': { bg: '#243456', fg: '#f2ead6', font: '700 118px "Georgia", serif', border: '#f2ead6', caps: false },
    'green': { bg: '#2f4f3f', fg: '#e8d59a', font: '700 118px "Georgia", serif', border: '#e8d59a', caps: false },
    'stone': { bg: '#cbb894', fg: '#4a3f33', font: '700 110px "Georgia", serif', border: null, caps: true },
    // dark bronze plaque with pale gold lettering and a thin border
    'bronze': { bg: '#4a3b2a', fg: '#d8c08a', font: '700 106px "Georgia", "Times New Roman", serif', border: '#d8c08a', borderW: 5, caps: true },
    // faded lettering painted straight on the brick: no board at all
    'ghost': { bg: null, fg: 'rgba(240,235,220,0.6)', font: '700 118px "Georgia", "Times New Roman", serif', border: null, caps: true, condense: 0.82 },
  };
  const s = { ...(styles[style] || styles.board), ...opts };
  const lines = (s.caps ? text.toUpperCase() : text).split('\n');
  const W = cv.width, H = cv.height;
  if (!s.bg) {
    ctx.clearRect(0, 0, W, H); // transparent: the wall shows through
  } else if (s.arch) {
    // board with a raised, segmental top; the corners stay transparent
    ctx.clearRect(0, 0, W, H);
    const board = (inset) => {
      ctx.beginPath();
      ctx.moveTo(inset, H - inset); ctx.lineTo(inset, H * 0.42 + inset * 0.6);
      ctx.quadraticCurveTo(W / 2, -H * 0.28 + inset * 2.2, W - inset, H * 0.42 + inset * 0.6);
      ctx.lineTo(W - inset, H - inset); ctx.closePath();
    };
    board(0); ctx.fillStyle = s.bg; ctx.fill();
    if (s.border) { board(20); ctx.strokeStyle = s.border; ctx.lineWidth = 8; ctx.stroke(); }
  } else {
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, W, H);
    if (s.border) { const bw = s.borderW || 10; ctx.strokeStyle = s.border; ctx.lineWidth = bw; ctx.strokeRect(18, 18, W - 36, H - 36); }
  }
  // Condensed faces (ghost signs) are drawn through a horizontal squeeze, so
  // text positions and widths are measured in the stretched space Wt.
  const cond = s.condense || 1, Wt = W / cond;
  if (cond !== 1) ctx.setTransform(cond, 0, 0, 1, 0, 0);
  ctx.fillStyle = s.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const margin = s.ornaments && lines.length === 1 ? 480 : 110;
  if (lines.length === 1) {
    let size = 118;
    do { ctx.font = s.font.replace(/\d+px/, `${size}px`); size -= 6; } while (ctx.measureText(lines[0]).width > Wt - margin && size > 40);
    ctx.fillText(lines[0], Wt / 2, H / 2 + 6 + (s.arch ? H * 0.12 : 0));
  } else {
    // first line smaller over a bigger second line, a thin rule with diamonds between
    const top = s.arch ? H * 0.2 : H * 0.12, bottom = H * 0.9;
    const slot = (bottom - top) / (lines.length + 0.6);
    lines.forEach((ln, i) => {
      const scale = i === lines.length - 1 ? 1 : 0.72;
      let size = Math.round(slot * 1.15 * scale);
      do { ctx.font = s.font.replace(/\d+px/, `${size}px`); size -= 4; } while (ctx.measureText(ln).width > Wt - margin && size > 30);
      ctx.fillText(ln, Wt / 2, top + slot * (i + 0.5) + (i === lines.length - 1 ? slot * 0.55 : 0));
    });
    const ry = top + slot * 1.1;
    ctx.strokeStyle = s.fg; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(Wt * 0.2, ry); ctx.lineTo(Wt * 0.8, ry); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Wt / 2, ry - 12); ctx.lineTo(Wt / 2 + 12, ry); ctx.lineTo(Wt / 2, ry + 12); ctx.lineTo(Wt / 2 - 12, ry); ctx.closePath(); ctx.fill();
  }
  if (cond !== 1) ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (s.ornaments && lines.length === 1 && !s.arch) { // little filigree marks at the ends, like the Avondale's
    ctx.strokeStyle = s.fg; ctx.lineWidth = 8;
    for (const sx of [-1, 1]) {
      const x = cv.width / 2 + sx * (cv.width / 2 - 90);
      ctx.beginPath(); ctx.arc(x, cv.height / 2, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - sx * 40, cv.height / 2, 14, 0, Math.PI * 2); ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // Ghost lettering keeps its soft alpha (no alphaTest); the arched board only needs a hard cut-out
  const seeThrough = !s.bg;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, transparent: !!s.arch || seeThrough, alphaTest: s.arch ? 0.5 : 0, depthWrite: !seeThrough, polygonOffset: seeThrough, polygonOffsetFactor: -1 });
}

const imageLoader = new THREE.TextureLoader();
const imageTextures = new Map();

function signEl(spec) {
  const w = spec.w || 4, h = spec.h || 0.7;
  if (spec.image) { // a photo (mural, painted panel) mapped flat onto the wall; path is relative to the page, e.g. data/avon-extended/textures/x.jpg
    // A sign can appear on several faces. Reuse its preloaded image/texture
    // instead of starting another request once the first preload is consumed.
    let tex = imageTextures.get(spec.image);
    if (!tex) {
      tex = imageLoader.load(spec.image);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      imageTextures.set(spec.image, tex);
    }
    const g = new THREE.Group();
    // Illustrated signs can follow an SVG/PNG silhouette without a rectangular
    // background. Alpha testing keeps them in the ordinary opaque depth pass.
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, alphaTest: spec.shape === 'cutout' ? 0.5 : 0 }));
    m.rotation.y = Math.PI; // face toward -z (out of the wall)
    m.position.z = -0.04;
    g.add(m);
    return g;
  }
  const branded = brandSignMaterial(spec.brand || signBrand(spec.text), w / h);
  if (branded) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), branded);
    mesh.rotation.y = Math.PI; mesh.position.z = -0.14; group.add(mesh);
    return group;
  }
  const face = signMaterial(spec.text, spec.style, { ...(spec.opts || {}), arch: spec.shape === 'arch' }, w / h);
  const edgeColor = spec.style === 'carved' ? wall(spec.opts?.bg || '#cfc3a9') : spec.style === 'stone' ? 0xcbb894 : spec.style === 'bronze' ? 0x4a3b2a : 0x2a2724;
  const edge = mat(edgeColor);
  if (spec.shape === 'arch' || spec.style === 'ghost') { // drawn entirely in the texture; a thin plane carries it
    const g = new THREE.Group(); // place() sets the group's rotation, so the plane's own flip survives
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face);
    m.rotation.y = Math.PI; // face toward -z (out of the wall)
    m.position.z = spec.style === 'ghost' ? -0.08 : -0.14; // ghost lettering sits (almost) flush on the brick, just clear of gable ends
    m.userData.castShadow = false;
    g.add(m);
    return g;
  }
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), [edge, edge, edge, edge, edge, face]);
  m.position.z = -0.14;
  if (spec.shape === 'plaque') {
    // stone tablet with rounded ends behind the lettered face
    const g = new THREE.Group();
    const o = [];
    const r = (h + 0.36) / 2, hw = (w + 0.3) / 2 - r;
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI; o.push([hw + Math.cos(a) * r, Math.sin(a) * r]); }
    for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI; o.push([-hw + Math.cos(a) * r, Math.sin(a) * r]); }
    g.add(slab(o, 0.16, edgeColor, -0.08));
    m.position.z = -0.2;
    g.add(m);
    return g;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Parapet outlines (x across the face, y up from the wall top)

function parapetOutline(type, W, H) {
  if (type === 'pediment') return [[-W / 2, 0], [W / 2, 0], [W / 2, H * 0.3], [0, H], [-W / 2, H * 0.3]];
  if (type === 'stepped') return [[-W / 2, 0], [W / 2, 0], [W / 2, H * 0.4], [W * 0.3, H * 0.4], [W * 0.3, H * 0.7], [W * 0.12, H * 0.7], [W * 0.12, H], [-W * 0.12, H], [-W * 0.12, H * 0.7], [-W * 0.3, H * 0.7], [-W * 0.3, H * 0.4], [-W / 2, H * 0.4]];
  if (type === 'arch') { // segmental arch over the middle (Opera Block style)
    const pts = [[-W / 2, 0], [W / 2, 0], [W / 2, H * 0.35]];
    for (let i = 0; i <= 16; i++) { const a = Math.PI - (i / 16) * Math.PI; pts.push([Math.cos(a) * -W / 2, H * 0.35 + Math.sin(a) * H * 0.65]); }
    return pts;
  }
  if (type === 'mission') { // curved Spanish-mission parapet with shoulders
    const pts = [[-W / 2, 0], [W / 2, 0], [W / 2, H * 0.28]];
    const curve = (x0, y0, x1, y1, cx, cy, n = 8) => { for (let i = 1; i <= n; i++) { const t = i / n; pts.push([(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1]); } };
    curve(W / 2, H * 0.28, W * 0.28, H * 0.55, W * 0.45, H * 0.55);
    curve(W * 0.28, H * 0.55, W * 0.14, H, W * 0.14, H * 0.55);
    pts.push([-W * 0.14, H]);
    curve(-W * 0.14, H, -W * 0.28, H * 0.55, -W * 0.14, H * 0.55);
    curve(-W * 0.28, H * 0.55, -W / 2, H * 0.28, -W * 0.45, H * 0.55);
    return pts;
  }
  return [[-W / 2, 0], [W / 2, 0], [W / 2, H], [-W / 2, H]]; // flat
}

// The Stars and Stripes as one shared canvas texture: 13 stripes, a canton
// with the 50 stars as dots (the diorama is too small for points), on a gently
// waving plane so it never reads as a stiff board.
let _flagTex = null;
function flagTexture() {
  if (_flagTex) return _flagTex;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 270;
  const ctx = cv.getContext('2d');
  const sh = cv.height / 13;
  for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? '#f2efe8' : '#b8323a'; ctx.fillRect(0, i * sh, cv.width, sh + 1); }
  const cw = cv.width * 0.4, ch = sh * 7;
  ctx.fillStyle = '#2f3f6b'; ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#f2efe8';
  const r = 5.5;
  for (let row = 0; row < 9; row++) {
    const n = row % 2 ? 5 : 6, x0 = row % 2 ? cw / 12 * 2 : cw / 12;
    for (let k = 0; k < n; k++) { ctx.beginPath(); ctx.arc(x0 + k * (cw / 6), ch / 10 * (row + 1), r, 0, Math.PI * 2); ctx.fill(); }
  }
  _flagTex = new THREE.CanvasTexture(cv);
  _flagTex.colorSpace = THREE.SRGBColorSpace;
  _flagTex.anisotropy = 4;
  return _flagTex;
}

function flagEl(height = 7, w = 1.6) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, height, 8), mat(0xdedbd2));
  pole.position.y = height / 2;
  g.add(pole);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(WALL_COLORS.gold));
  ball.position.y = height + 0.08;
  g.add(ball);
  const h = w / 1.9;
  const geo = new THREE.PlaneGeometry(w, h, 10, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { // a soft ripple that grows toward the fly end
    const x = pos.getX(i), t = (x + w / 2) / w;
    pos.setZ(i, Math.sin(t * Math.PI * 2.2) * 0.08 * t);
  }
  geo.computeVertexNormals();
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: 0.8, side: THREE.DoubleSide }));
  flag.position.set(0.06 + w / 2, height - 0.1 - h / 2, 0);
  flag.castShadow = false;
  g.add(flag);
  return g;
}

function crossEl(size = 1.2, color = 0xf0ece4) {
  const g = new THREE.Group();
  g.add(rbox(0.14, size, 0.14, color, 0.03, 0, size / 2, 0));
  g.add(rbox(size * 0.6, 0.14, 0.14, color, 0.03, 0, size * 0.72, 0));
  return g;
}

// ---------------------------------------------------------------------------
// Open porch: a raised floor slab, square posts, a shallow hip / flat / gable
// roof with a fascia, an optional railing and steps. Built in the face frame
// (x across the face, -z outward) and placed at the porch's centre fraction.
// Doors behind it stay on the main face; give them `y: floorH`.

// Shallow hip against a wall: three slopes rising to a flat strip at the top.
// Spans x in ±rw/2 and z from +0.1 (the wall) out to -rd; rises from y = 0.
// Wound counter-clockwise seen from outside/above, or the slopes get
// back-face culled and whatever is underneath shows through.
function leanHip(rw, rd, pitch, color) {
  const run = Math.max(0.1, Math.min(rd * 0.6, rw / 2 - 0.3, 1.6)), hh = run * pitch;
  const hx = rw / 2, tx = hx - run, tz = rd - run;
  const v = [
    -hx, 0, 0.1,  hx, 0, 0.1,  hx, 0, -rd,  -hx, 0, -rd,
    -tx, hh, 0.1,  tx, hh, 0.1,  tx, hh, -tz,  -tx, hh, -tz,
  ];
  const idx = [0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7, 4, 5, 7, 5, 6, 7];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setIndex(idx);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return { mesh: new THREE.Mesh(flat, surfaceMaterial('shingles', color)), h: hh };
}

// A carport is an open porch with no floor to speak of, no railing, posts only
// at the outer corners and a gable running out from the wall.
const CARPORT = { floorH: 0, railing: false, posts: 2, height: 2.4, roof: 'gable', pitch: 0.5, floorColor: '#a9a49c' };

function openPorch(rng, po, fr, spec, c) {
  if (po.style === 'carport') po = { ...CARPORT, ...po };
  const [fa, fb] = po.range || [(po.at ?? 0.5) - (po.w || 3) / 2 / fr.L, (po.at ?? 0.5) + (po.w || 3) / 2 / fr.L];
  const fc = (fa + fb) / 2, pw = (fb - fa) * fr.L, pd = po.d ?? 2.4, fh = po.floorH ?? 0.45;
  const uncovered = po.roof === 'none';
  if (po.roof === 'main' && !Number.isFinite(c.mainRoofY)) throw new Error('A shared porch roof requires a hip-roofed volume');
  const ph = po.roof === 'main' ? c.mainRoofY - fh : po.height ?? 2.7;
  const postC = wall(po.postColor, c.trimC), floorC = wall(po.floorColor, P.flagstone), roofC = po.roofColor ? roofc(po.roofColor) : c.roofC;
  const g = new THREE.Group();
  // Ground porches have a foundation; elevated balconies need a thin deck.
  const floorBottom = po.floorThickness !== undefined ? fh - po.floorThickness : uncovered ? fh - 0.22 : -0.3;
  const floor = rbox(pw, fh - floorBottom, pd + 0.04, floorC, 0.06, 0, (fh + floorBottom) / 2, -pd / 2 + 0.02);
  floor.name = 'porch-floor';
  g.add(floor);
  // posts along the outer edge, one every ~2.4 m including both ends
  const np = Math.max(2, po.posts ?? Math.round(pw / 2.4) + 1);
  const px = [];
  for (let i = 0; i < np; i++) px.push(-pw / 2 + 0.15 + (i * (pw - 0.3)) / (np - 1));
  const pz = -pd + 0.15;
  for (const x of px) {
    if (uncovered) {
      if (floorBottom > 0) {
        const support = box(0.2, floorBottom + 0.3, 0.2, postC, x, (floorBottom - 0.3) / 2, pz);
        support.name = 'deck-support'; g.add(support);
      }
      if (po.railing) {
        const post = box(0.14, 0.98, 0.14, postC, x, fh + 0.49, pz);
        post.name = 'deck-rail-post'; g.add(post);
      }
      continue;
    }
    const post=box(0.2, ph, 0.2, postC, x, fh + ph / 2, pz);
    post.name='porch-post';g.add(post);
  }
  // roof: fascia + ceiling box in trim, then the roof form on top
  const ov = 0.25, rw = pw + 2 * ov, rd = pd + ov, ry = fh + ph;
  const rtype = po.roof || 'hip';
  if (rtype !== 'main' && !uncovered) g.add(rbox(rw, 0.24, rd + 0.1, postC, 0.04, 0, ry + 0.12, -rd / 2 + 0.1));
  if (rtype === 'flat') {
    g.add(rbox(rw - 0.1, 0.14, rd, roofC, 0.04, 0, ry + 0.3, -rd / 2 + 0.05));
  } else if (rtype === 'shed') {
    const pitch = po.pitch ?? .25, rise = rd * pitch;
    const roof = rbox(rw, .16, Math.hypot(rd, rise), roofC, .035,
      0, ry + .24 + rise / 2, -rd / 2 + .05);
    roof.rotation.x = -Math.atan(pitch); // high edge meets the wall at z = 0
    roof.material = surfaceMaterial('shingles', roofC);
    roof.name = 'porch-shed-roof'; g.add(roof);
  } else if (rtype === 'gable') {
    const gh = Math.min(pw, 2 * pd) * (po.pitch || 0.45) / 2;
    const rg = gableRoof(rng, pw, pd, gh, roofC, 0.25, { bodyOverhang: 0.0 });
    rg.rotation.y = Math.PI / 2;                                     // ridge runs out from the wall
    rg.position.set(0, ry + 0.24, -pd / 2);
    g.add(rg);
    const s = pw / 2 + 0.13, tri = new THREE.ExtrudeGeometry(shapeOf([[-s, 0], [s, 0], [0, gh - 0.12]]), { depth: 0.2, bevelEnabled: false });
    const end = new THREE.Mesh(tri, mat(wall(po.gableColor, c.wallC)));
    end.position.set(0, ry + 0.24, -pd - 0.1);
    g.add(end);
  } else if (rtype !== 'main' && !uncovered) {
    const rm = leanHip(rw, rd, po.pitch || 0.4, roofC).mesh;
    rm.position.y = ry + 0.22;
    g.add(rm);
  }
  // steps, centred on the first door inside the porch (else the porch centre)
  const doorF = (spec.doors || []).map((d) => d.at ?? 0.5).find((f) => f >= fa - 1e-6 && f <= fb + 1e-6);
  const sAt = po.stepsAt ?? doorF ?? fc;
  const sx = -(sAt - fc) * fr.L;                                  // the group's local +x is the face's screen LEFT (rotY maps -z to n), so mirror fractions
  const ns = po.steps ?? 0;
  if (ns > 0) {
    const sh = fh / (ns + 1), sw = po.stepsW ?? 1.6;
    for (let i = 0; i < ns; i++) {
      const top = fh - (i + 1) * sh, dep = 0.34 * (i + 1);
      g.add(rbox(sw + i * 0.16, top + 0.2, dep, floorC, 0.05, sx, (top + 0.2) / 2 - 0.2, -pd - dep / 2 + 0.02));
    }
  }
  // railing: top rail + thin balusters between the posts, a gap in front of the steps
  if (po.railing) {
    const railSides = po.railSides ?? ['front', 'left', 'right'];
    const rh = 0.9, gap = ns > 0 || po.railingGap ? (po.railingGap ?? 1.5) : 0;
    const segs = [];
    for (let i = 0; i < np - 1; i++) {
      let a = px[i] + 0.1, b = px[i + 1] - 0.1;
      if (gap && sx - gap / 2 < b && sx + gap / 2 > a) {           // split around the opening
        if (sx - gap / 2 - a > 0.3) segs.push([a, sx - gap / 2]);
        if (b - (sx + gap / 2) > 0.3) segs.push([sx + gap / 2, b]);
      } else segs.push([a, b]);
    }
    for (const [a, b] of railSides.includes('front') ? segs : []) {
      const len = b - a, cx = (a + b) / 2;
      g.add(box(len, 0.08, 0.1, postC, cx, fh + rh, pz));
      g.add(box(len, 0.06, 0.06, postC, cx, fh + 0.12, pz));
      const nb = Math.max(1, Math.round(len / 0.3));
      for (let k = 1; k < nb; k++) g.add(box(0.05, rh - 0.2, 0.05, postC, a + (k * len) / nb, fh + rh / 2, pz));
    }
    // side rails from the wall to the corner posts
    for (const x of [px[0], px[np - 1]]) {
      const side = x > 0 ? 'left' : 'right';
      if (!railSides.includes(side)) continue;
      const len = pd - 0.45, cz = -pd / 2 + 0.05;
      const opening = po.sideRailGaps?.[side], lo = cz - len / 2, hi = cz + len / 2;
      const center = opening ? -pd * opening.at : 0;
      const runs = opening ? [[lo, Math.min(hi, center - opening.w / 2)],
        [Math.max(lo, center + opening.w / 2), hi]] : [[lo, hi]];
      for (const [a, b] of runs) {
        if (b - a < 0.05) continue;
        const length = b - a, mid = (a + b) / 2;
        g.add(box(0.1, 0.08, length, postC, x, fh + rh, mid));
        g.add(box(0.06, 0.06, length, postC, x, fh + 0.12, mid));
        const nb = Math.max(1, Math.round(length / 0.3));
        for (let k = 1; k < nb; k++) g.add(box(0.05, rh - 0.2, 0.05, postC, x, fh + rh / 2, a + (k * length) / nb));
        if (opening) for (const z of [a, b]) {
          if (z > lo + 0.01 && z < hi - 0.01) g.add(box(0.1, rh, 0.1, postC, x, fh + rh / 2, z));
        }
      }
    }
  }
  if (po.door) { const d = doorEl(po.door); d.position.set(-((po.door.at ?? fc) - fc) * fr.L, fh, -0.08); g.add(d); }   // a door on the main wall, standing on the floor
  const wrap = new THREE.Group();
  wrap.add(g);
  wrap.position.copy(fr.at(fc, 0, 0));
  wrap.rotation.y = fr.rotY;
  return wrap;
}

// Gambrel (Dutch barn) roof: a steep lower slope to a knee, then a shallow
// upper slope to the ridge. Ridge along x, slopes face ±z, like gableRoof.
// Body flush with the walls so a wall-coloured end shows; tiles overhang.
function gambrelRoof(rng, span, length, h, o) {
  const ovh = o.overhang ?? 0.4, kh = h * (o.kneeH ?? 0.62), s = span / 2 + ovh;
  const k = (span / 2) * (1 - (o.kneeIn ?? 0.28));                    // knee half-width
  const g = new THREE.Group();
  const prof = [[-s, -0.02], [s, -0.02], [k, kh], [0, h], [-k, kh]];
  const body = new THREE.ExtrudeGeometry(shapeOf(prof), { depth: length, bevelEnabled: false });
  body.translate(0, 0, -length / 2); body.rotateY(Math.PI / 2);
  g.add(new THREE.Mesh(body, mat(new THREE.Color(o.color).offsetHSL(0, -0.05, -0.12).getHex())));
  const endProf = [[-s + 0.12, 0], [s - 0.12, 0], [k - 0.08, kh - 0.06], [0, h - 0.12], [-k + 0.08, kh - 0.06]];
  const end = new THREE.ExtrudeGeometry(shapeOf(endProf), { depth: length + 0.1, bevelEnabled: false });
  end.translate(0, 0, -(length + 0.1) / 2); end.rotateY(Math.PI / 2);
  g.add(new THREE.Mesh(end, mat(o.gableColor)));
  const len = length + 2 * ovh;
  for (const side of [1, -1]) {
    g.add(roofPanel(len, s, 0, k, kh, side, o.color));
    g.add(roofPanel(len, k, kh, 0, h, side, o.color));
  }
  g.add(rbox(len + 0.08, 0.14, 0.25, o.color, 0.05, 0, h + 0.035, 0));

  return g;
}

// Ramp or exterior stair: starts at the group origin, runs toward -z for
// `length` and climbs `height`; an optional flat landing at the top; rails
// on both sides.
function accessEl(d) {
  const L = d.length || 6, hgt = d.height || 0.9, w = d.w || 1.2, stair = d.type === 'stair';
  const deckC = wall(d.color, stair ? '#7a746c' : '#c4bcae'), railC = wall(d.railColor, P.trim);
  const g = new THREE.Group();
  const yAt = (z) => Math.min(hgt, Math.max(0, hgt * (-z / L)));    // deck height along the run
  if (stair) {
    const n = Math.max(2, Math.round(hgt / 0.18)), td = L / n;
    const foundationDepth = d.foundationDepth ?? 0.2;
    for (let i = 0; i < n; i++) {
      const top = ((i + 1) / n) * hgt, open = d.construction === 'open';
      const tread = rbox(w, open ? .065 : top + foundationDepth, td + .04, deckC,
        open ? .01 : .03, 0, open ? top - .0325 : (top - foundationDepth) / 2, -(i + .5) * td);
      tread.name = open ? 'stair-tread' : 'solid-stair-step'; g.add(tread);
    }
    if (d.construction === 'open') {
      for (const sx of [-1, 1]) {
        const stringer = box(.09, .24, Math.hypot(L, hgt), deckC,
          sx * (w / 2 - .12), hgt / 2 - .065, -L / 2);
        stringer.rotation.x = Math.atan2(hgt, L); stringer.name = 'stair-stringer'; g.add(stringer);
      }
    }
  } else {
    const a = Math.atan2(hgt, L), slab = rbox(w, 0.14, Math.hypot(L, hgt) + 0.1, deckC, 0.03, 0, hgt / 2 + 0.07, -L / 2);
    slab.rotation.x = a; g.add(slab);
    g.add(rbox(w - 0.1, 0.2, 0.5, deckC, 0.03, 0, hgt - 0.1, -L + 0.2));                       // top edge sits square on the landing side
  }
  const land = d.landing || 0;
  if (land > 0) g.add(rbox(w, 0.16, land, deckC, 0.03, 0, hgt + 0.08, -L - land / 2));
  if (d.railing !== false) {
    const rh = 0.9, total = L + land;
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 + 0.04);
      const np = Math.max(2, Math.round(total / 1.5) + 1);
      for (let i = 0; i < np; i++) { const z = -(i * total) / (np - 1); g.add(box(0.07, rh, 0.07, railC, x, yAt(z) + rh / 2, z)); }
      const a = Math.atan2(hgt, L), rail = box(0.06, 0.06, Math.hypot(L, hgt), railC, x, hgt / 2 + rh, -L / 2);
      rail.rotation.x = a; g.add(rail);
      if (land > 0) g.add(box(0.06, 0.06, land, railC, x, hgt + rh, -L - land / 2));
    }
  }
  return g;
}

// Independent raised platform for joining exterior stair flights. Coordinates
// are its centre; unlike the stairs, length runs symmetrically along local z.
function stairLanding(d) {
  const g = new THREE.Group(), w = d.w || 2.4, L = d.length || 1.2, h = d.height || 1.5;
  const deckC = wall(d.color, '#925f49'), railC = wall(d.railColor, '#81503e');
  const solid = d.construction === 'solid', bottom = -(d.foundationDepth ?? 0.2);
  const floor = box(w, solid ? h - bottom : .18, L, deckC, 0, solid ? (h + bottom) / 2 : h - .09, 0);
  floor.name = 'stair-landing-floor'; g.add(floor);
  if (!solid) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const support = box(.14, h + (d.y || 0) + .02, .14, railC,
      sx * (w / 2 - .07), (h - .18 - (d.y || 0) - .2) / 2, sz * (L / 2 - .07));
    support.name = 'stair-landing-support'; g.add(support);
  }
  if (d.railing !== false) for (const side of d.railSides || ['front', 'back', 'left', 'right']) {
    const alongX = side === 'front' || side === 'back', span = alongX ? w : L;
    const x = side === 'left' ? -w / 2 : side === 'right' ? w / 2 : 0;
    const z = side === 'front' ? L / 2 : side === 'back' ? -L / 2 : 0;
    const rail = box(alongX ? span : .07, .07, alongX ? .07 : span, railC, x, h + .9, z);
    rail.name = 'stair-landing-rail'; g.add(rail);
    const n = Math.max(1, Math.ceil(span / .3));
    for (let i = 0; i <= n; i++) {
      const t = (i / n - .5) * span;
      g.add(box(.045, .9, .045, railC, x + (alongX ? t : 0), h + .45, z + (alongX ? 0 : t)));
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Volume builder

const FACES = {
  '+u': { n: [1, 0], t: [0, -1] }, '-u': { n: [-1, 0], t: [0, 1] },
  '+v': { n: [0, 1], t: [1, 0] }, '-v': { n: [0, -1], t: [-1, 0] },
};
// t is "screen right" when looking at the face from outside; both in (u, v)

const faceKeys = (vol) => vol.polygon ? vol.polygon.map((_, i) => `edge${i}`) : Object.keys(FACES);

function faceFrame(vol, key) {
  if (vol.polygon) {
    const i = Number(key.slice(4)), a = vol.polygon[i], b = vol.polygon[(i + 1) % vol.polygon.length];
    const du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv);
    // CCW in u/v: the exterior is to the right of a→b. Viewed from outside,
    // fractions run from b (screen left) to a (screen right).
    const n = [dv / L, -du / L], t = [-du / L, -dv / L];
    const cu = (a[0] + b[0]) / 2, cv = (a[1] + b[1]) / 2;
    return { n, t, L, cu, cv, rotY: Math.atan2(-n[0], -n[1]),
      at: (f, out = 0, y = 0) => new THREE.Vector3(b[0] - f * du + n[0] * out, y, b[1] - f * dv + n[1] * out) };
  }
  const { n, t } = FACES[key];
  const uc = (vol.u[0] + vol.u[1]) / 2, vc = (vol.v[0] + vol.v[1]) / 2;
  const W = vol.u[1] - vol.u[0], D = vol.v[1] - vol.v[0];
  const L = key[1] === 'u' ? D : W;
  const cu = uc + n[0] * W / 2, cv = vc + n[1] * D / 2;         // face centre
  const rotY = Math.atan2(-n[0], -n[1]);                       // local -z → n
  const at = (f, out = 0, y = 0) => new THREE.Vector3(cu + t[0] * (f - 0.5) * L + n[0] * out, y, cv + t[1] * (f - 0.5) * L + n[1] * out);
  return { n, t, L, cu, cv, rotY, at };
}

// Ground-level entrances in the same frame as their rendered facades. Used
// for paving and gardens, including clipped/angled commercial corners.
export function blueprintFrontages(b, { floorDatumOnly = false } = {}) {
  const result = [], bp = b.blueprint;
  if (!bp) return result;
  const c = Math.cos(b.obb.angle), s = Math.sin(b.obb.angle);
  if (bp.lennaHall) {
    const [a,z]=bp.lennaHall.outline,L=Math.hypot(z[0]-a[0],z[1]-a[1]),n=[(z[1]-a[1])/L,-(z[0]-a[0])/L];
    return [{point:(f,out=0)=>{const u=z[0]+f*(a[0]-z[0])+n[0]*out,v=z[1]+f*(a[1]-z[1])+n[1]*out;return [b.obb.cx+c*u-s*v,b.obb.cz+s*u+c*v];},
      n:[c*n[0]-s*n[1],s*n[0]+c*n[1]],length:L,storefront:false,doors:[.5],depth:2.8,pathAt:.5}];
  }
  for (const vol of bp.volumes || []) for (const key of faceKeys(vol)) {
    const spec = vol.faces?.[key] ?? vol.faces?.default;
    if (!spec || typeof spec !== 'object') continue;
    // An uphill wing can meet local ground several metres above the shared
    // building base. Include its explicit ground entrance for paths, while
    // retaining the original low-door set when selecting that shared base.
    const doors = [...(spec.doors || []).filter(d => ((d.y ?? 0) < 1.5 || (!floorDatumOnly && d.groundEntrance === true)) && d.type !== 'garage'),
      ...(spec.arcade?.door ? spec.arcade.at.map(at => ({at})) : [])];
    if (!doors.length && !spec.storefronts?.length) continue;
    const fr = faceFrame(vol, key);
    const point = (f, out = 0) => {
      const p = fr.at(f, out);
      return [b.obb.cx + c*p.x-s*p.z, b.obb.cz+s*p.x+c*p.z];
    };
    const porch = [...(spec.porches || [])];
    for(const p of bp.porches || []) {
      if(p.face !== key || Math.abs(p.wall-(key[1]==='u'?fr.cu:fr.cv))>0.1) continue;
      const along=key[1]==='u'?p.v:p.u;
      if(!along) continue;
      const sign=key[1]==='u'?fr.t[1]:fr.t[0];
      const step=(along[0]+along[1])/2+sign*((p.stepsAt??0.5)-0.5)*(along[1]-along[0]);
      const center=key[1]==='u'?fr.cv:fr.cu;
      const stepsAt=0.5+(step-center)*sign/fr.L;
      if(stepsAt>=0 && stepsAt<=1) porch.push({...p,stepsAt});
    }
    const depth = Math.max(spec.arcade?.approachDepth ?? 0, ...porch.map(p => (p.d ?? 2.4) + (p.steps || 0)*0.34));
    result.push({point, n: [c*fr.n[0]-s*fr.n[1],s*fr.n[0]+c*fr.n[1]], length: fr.L,
      storefront: Boolean(spec.storefronts?.length),
      doors: doors.map(d => d.at ?? 0.5), depth,
      pathAt: porch.find(p => p.steps && p.stepsAt !== undefined)?.stepsAt ?? (spec.arcade ? 0.5 : doors[0]?.at ?? 0.5)});
  }
  return result;
}

// Offset perpendicular to each edge, meeting at mitred corners. Used for both
// window frames and footprint trim: radial growth pinches a tall window's
// lower jambs and makes its arch disproportionately heavy.
function offsetOutline(points, distance) {
  // Gothic outlines meet at a duplicated apex; it is one corner, not an edge.
  const pts = points.filter((p, i) => Math.hypot(p[0] - points[(i + points.length - 1) % points.length][0], p[1] - points[(i + points.length - 1) % points.length][1]) > 1e-8);
  return pts.map((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const l0 = Math.hypot(p[0] - a[0], p[1] - a[1]), l1 = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const n0 = [(p[1] - a[1]) / l0, -(p[0] - a[0]) / l0];
    const n1 = [(b[1] - p[1]) / l1, -(b[0] - p[0]) / l1];
    const k = distance / Math.max(1e-6, 1 + n0[0] * n1[0] + n0[1] * n1[1]);
    return [p[0] + (n0[0] + n1[0]) * k, p[1] + (n0[1] + n1[1]) * k];
  });
}

function footprintSlab(pts, bottom, top, color, outset = 0, name = '') {
  const outline = outset ? offsetOutline(pts, outset) : pts;
  const geo = new THREE.ExtrudeGeometry(shapeOf(outline.map(([u, v]) => [u, -v])), { depth: top - bottom, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bottom, 0);
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.name = name;
  return mesh;
}

function place(g, el, frame, f, y, out = 0.1) {
  el.position.copy(frame.at(f, out, y));
  el.rotation.y = frame.rotY;
  g.add(el);
}

// An arcade is cut through the front portion of a rectangular volume. The
// extruded holes supply actual jambs and vaulted soffits; a separate back wall
// carries the entrance doors at the specified recess depth.
function arcadeWalls(vol, key, spec, bottom, H, wallC, trimC, kind, material) {
  const fr = faceFrame(vol, key), depth = spec.depth;
  const totalDepth = key[1] === 'u' ? vol.u[1] - vol.u[0] : vol.v[1] - vol.v[0];
  const y = spec.y ?? 0, w = spec.w, h = spec.h;
  const floorThickness = 0.14;
  const shape = shapeOf([[-fr.L / 2, bottom], [fr.L / 2, bottom], [fr.L / 2, H], [-fr.L / 2, H]]);
  const g = new THREE.Group(); g.name = 'arcade';
  for (const at of spec.at) {
    const x = (0.5 - at) * fr.L;
    const opening = outline('arch', w, h).map(([px, py]) => [px + x, py + y + h / 2]);
    // Cut through the floor slab: the extrusion's horizontal sill and the
    // trim's bottom rail must stay below the sole visible walking surface.
    // Keeping those at y caused coplanar triangles across every recess.
    opening[0][1] = opening[1][1] = Math.max(bottom + 0.001, y - floorThickness);
    shape.holes.push(new THREE.Path([...opening].reverse().map(p => new THREE.Vector2(...p))));
    const trim = new THREE.Mesh(frameGeometry(offsetOutline(opening, spec.surroundW ?? 0.18), opening, 0.22), mat(wall(spec.trim, trimC)));
    trim.name = 'arcade-surround'; g.add(trim);
    if (spec.backColor) {
      const panel = slab(opening, 0.02, wall(spec.backColor), depth - 0.005);
      panel.name = 'arcade-recess-back'; g.add(panel);
    }
    if (spec.door) {
      const door = doorEl({ ...spec.door, steps: 0, lamp: false });
      door.position.set(x, y, depth - 0.08); door.name = 'arcade-recessed-door'; g.add(door);
    }
  }
  const pierced = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false}), material);
  pierced.name = 'arcade-pierced-wall'; g.add(pierced);
  const back = box(fr.L, H - bottom, totalDepth - depth, wallC, 0, (H + bottom) / 2, (depth + totalDepth) / 2);
  back.material = material;
  back.name = 'arcade-back-wall'; g.add(back);
  // The floor stops flush at the facade and reaches the recessed thresholds.
  const floor = box(fr.L, floorThickness, depth, wall(spec.floorColor, trimC), 0, y - floorThickness / 2, depth / 2);
  floor.name = 'arcade-floor'; g.add(floor);
  g.position.copy(fr.at(0.5)); g.rotation.y = fr.rotY;
  return g;
}

function buildVolume(rng, vol, ctx) {
  const polygon = vol.polygon;
  if (polygon) {
    if (vol.roof?.type && !['flat','none'].includes(vol.roof.type)) throw new Error('Polygon blueprint volumes require a flat roof or explicit roofless base');
    vol = { ...vol, u: [Math.min(...polygon.map(p => p[0])), Math.max(...polygon.map(p => p[0]))],
      v: [Math.min(...polygon.map(p => p[1])), Math.max(...polygon.map(p => p[1]))] };
  }
  const g = new THREE.Group();
  g.name = vol.id || '';
  const W = vol.u[1] - vol.u[0], D = vol.v[1] - vol.v[0];
  const uc = (vol.u[0] + vol.u[1]) / 2, vc = (vol.v[0] + vol.v[1]) / 2;
  const H = vol.height || 6;
  const bottom = vol.bottom ?? (typeof ctx.wallBottom === 'function' ? ctx.wallBottom(vol) : ctx.wallBottom);
  const wallC = jitterColor(rng, wall(vol.wall, ctx.wall), 0.015, 0.004).getHex();
  const trimC = wall(vol.trim ?? ctx.trim, P.trim);
  const roof = vol.roof || { type: 'flat' };
  const roofC = jitterColor(rng, roofc(roof.color ?? ctx.roofColor), 0.02).getHex();

  // Walls (down to 1.2 m below grade so slopes never show a gap). An optional
  // upperWall colour splits the mass at `split` metres (brick base, clapboard above).
  const arcade = Object.entries(vol.faces || {}).find(([, spec]) => spec?.arcade);
  if (arcade) {
    if (polygon || vol.upperWall || Object.values(vol.faces).filter(spec => spec?.arcade).length !== 1) throw new Error('An arcade requires one explicit face on a rectangular unsplit volume');
    const [key, spec] = arcade;
    g.add(arcadeWalls(vol, key, spec.arcade, bottom, H, wallC, trimC, ctx.kind,
      facadeMaterial(wallC, ctx.kind, vol.wall ?? ctx.wall, vol.wallMaterial ?? ctx.wallMaterial)));
  } else if (vol.upperWall) {
    const sy = vol.split ?? 3.6;
    const upperC = jitterColor(rng, wall(vol.upperWall), 0.015, 0.004).getHex();
    const lower = polygon ? footprintSlab(polygon, bottom, sy, wallC) : new THREE.Mesh(new RoundedBoxGeometry(W, sy - bottom, D, 2, 0.14), mat(wallC));
    const upper = polygon ? footprintSlab(polygon, sy, H, upperC) : new THREE.Mesh(new RoundedBoxGeometry(W, H - sy, D, 2, 0.14), mat(upperC));
    if (!polygon) {
      lower.position.set(uc, (sy + bottom) / 2, vc);
      upper.position.set(uc, sy + (H - sy) / 2, vc);
      lower.userData.volumeWall = upper.userData.volumeWall = true;
    }
    lower.material = facadeMaterial(wallC, ctx.kind, vol.wall ?? ctx.wall, vol.wallMaterial ?? ctx.wallMaterial);
    upper.material = facadeMaterial(upperC, ctx.kind, vol.upperWall, vol.wallMaterial ?? ctx.wallMaterial);
    g.add(lower, upper);
  } else {
    const body = polygon ? footprintSlab(polygon, bottom, H, wallC, 0, 'walls') : new THREE.Mesh(new RoundedBoxGeometry(W, H - bottom, D, 2, 0.14), mat(wallC));
    if (!polygon) { body.position.set(uc, (H + bottom) / 2, vc); body.userData.volumeWall = true; }
    body.material = facadeMaterial(wallC, ctx.kind, vol.wall ?? ctx.wall, vol.wallMaterial ?? ctx.wallMaterial);
    g.add(body);
  }

  // Plinth / raised basement band
  if (vol.plinth) {
    const ph = vol.plinth.height || 1.4;
    g.add(polygon ? footprintSlab(polygon, -0.4, ph, wall(vol.plinth.color, WALL_COLORS.stone), 0.08)
      : rbox(W + 0.16, ph + 0.4, D + 0.16, wall(vol.plinth.color, WALL_COLORS.stone), 0.05, uc, ph / 2 - 0.2, vc));
  }
  // Belt courses
  for (const bc of vol.beltCourses || []) {
    const bh = bc.height || 0.22;
    g.add(polygon ? footprintSlab(polygon, bc.y - bh / 2, bc.y + bh / 2, wall(bc.color, trimC), 0.1)
      : rbox(W + 0.2, bh, D + 0.2, wall(bc.color, trimC), 0.04, uc, bc.y, vc));
  }

  // Roof. `slopeOut(key, yy)` describes the slope above face `key`: how far
  // outward from the wall plane the roof surface is at `yy` m above the eave
  // (null when that face is a gable end), so dormers can sit in any of them.
  const ridgeAlongU = (roof.ridge || (W >= D ? 'u' : 'v')) === 'u';
  let ridgeH = 0;
  let slopeOut = null;
  let mainRoofY = null;
  const slopeFace = (key) => key[1] === (ridgeAlongU ? 'v' : 'u');   // faces the slopes fall toward
  if (roof.type === 'flat' || !roof.type) {
    const c = vol.cornice || { height: 0.45, overhang: 0.35 };
    const ch = c.height ?? 0.45, ov = c.overhang ?? 0.35;
    const cornice = polygon ? footprintSlab(polygon, H - ch + 0.05, H + 0.05, wall(c.color, trimC), ov, 'cornice')
      : rbox(W + 2 * ov, ch, D + 2 * ov, wall(c.color, trimC), 0.05, uc, H - ch / 2 + 0.05, vc);
    if (!polygon) cornice.userData.flatRoofPart = 'cornice';
    g.add(cornice);
    if (c.dentils !== false) {
      const dz = 0.55;
      for (const key of faceKeys(vol)) {
        const fr = faceFrame(vol, key);
        const n = Math.floor(fr.L / dz);
        for (let i = 0; i < n; i++) {
          const d = rbox(0.22, 0.22, 0.28, wall(c.color, trimC), 0.03);
          place(g, d, fr, (i + 0.5) / n, H - ch - 0.08, ov * 0.5);
        }
      }
    }
    if (roof.lip !== false) {
      const lip = polygon ? footprintSlab(polygon, H + 0.025, H + 0.375, wallC, 0.05)
        : rbox(W + 0.1, 0.35, D + 0.1, wallC, 0.04, uc, H + 0.2, vc);
      if (!polygon) lip.userData.flatRoofPart = 'lip';
      g.add(lip);
    }
    const deckY = H + (roof.lip !== false ? 0.32 : 0.12);
    const deck = polygon ? footprintSlab(polygon, deckY - 0.1, deckY + 0.1, roofC, -0.15, 'roof-deck')
      : rbox(W - 0.3, 0.2, D - 0.3, roofC, 0.04, uc, deckY, vc);
    deck.material = surfaceMaterial('membrane', new THREE.Color(roofC).lerp(new THREE.Color(0x86827b),0.12).getHex());
    if (!polygon) deck.userData.flatRoofPart = 'deck';
    g.add(deck); // deck sits proud of the lip so the roof colour shows from above
  } else if (roof.type === 'gable') {
    const span = ridgeAlongU ? D : W, length = ridgeAlongU ? W : D;
    ridgeH = Math.min(span * (roof.pitch || 0.55), roof.maxH || 9);
    const rg = new THREE.Group();
    rg.add(gableRoof(rng, span, length, ridgeH, roofC, roof.overhang ?? 0.5, { bodyOverhang: 0.0 }));
    // wall-coloured gable ends
    const s = span / 2 + (roof.overhang ?? 0.5) - 0.12, hh = ridgeH - 0.12;
    const tri = shapeOf([[-s, 0], [s, 0], [0, hh]]);
    const endLen = length + 0.1;
    const endGeo = new THREE.ExtrudeGeometry(tri, { depth: endLen, bevelEnabled: false });
    endGeo.translate(0, 0, -endLen / 2);
    endGeo.rotateY(Math.PI / 2);
    rg.add(new THREE.Mesh(endGeo, mat(wall(roof.gableColor, wallC))));
    if (roof.cross) { const cr = crossEl(roof.crossSize || 1.4, wall(roof.crossColor, trimC)); cr.position.set(-length / 2 * (roof.crossEnd === '+' ? -1 : 1), ridgeH, 0); cr.rotation.y = Math.PI / 2; rg.add(cr); } // bar parallel to the gable face
    rg.position.set(uc, H, vc);
    if (!ridgeAlongU) rg.rotation.y = Math.PI / 2;
    g.add(rg);
    { const ovh = roof.overhang ?? 0.5, s0 = span / 2 + ovh, rh = ridgeH; slopeOut = (key, yy) => slopeFace(key) ? ovh - yy * s0 / rh : null; }
  } else if (roof.type === 'barrel') {
    const span = ridgeAlongU ? D : W, length = ridgeAlongU ? W : D, overhang = roof.overhang ?? .25;
    ridgeH = roof.h ?? 1.4;
    const rg = buildBarrelRoof(length+overhang*2,span+overhang*2,ridgeH,roofC,wall(roof.gableColor,wallC),trimC);
    rg.position.set(uc,H,vc);if(!ridgeAlongU)rg.rotation.y=Math.PI/2;g.add(rg);
  } else if (roof.type === 'gambrel') {
    const span = ridgeAlongU ? D : W, length = ridgeAlongU ? W : D;
    ridgeH = roof.h ?? Math.min(span * (roof.pitch || 0.62), roof.maxH || 9);
    const ovh = roof.overhang ?? 0.4, kneeH = roof.kneeH ?? 0.62, kneeIn = roof.kneeIn ?? 0.28;
    const rg = new THREE.Group();
    rg.add(gambrelRoof(rng, span, length, ridgeH, { overhang: ovh, kneeH, kneeIn, color: roofC, gableColor: wall(roof.gableColor, wallC) }));
    rg.position.set(uc, H, vc);
    if (!ridgeAlongU) rg.rotation.y = Math.PI / 2;
    g.add(rg);
    { const s0 = span / 2 + ovh, k = (span / 2) * (1 - kneeIn), kh = ridgeH * kneeH, rh = ridgeH;
      slopeOut = (key, yy) => !slopeFace(key) ? null : yy <= kh ? ovh - yy * (s0 - k) / kh : (k - (yy - kh) * k / (rh - kh)) - span / 2; }
  } else if (roof.type === 'hip') {
    // Hipped roof, optionally truncated to a flat deck (`flatTop` / `run`).
    const ovh = roof.overhang ?? 0.5;
    // A recessed portico shares the house's roof and entablature. Extend
    // those over its columns while keeping the wall and its openings back.
    const cover = { u: [...vol.u], v: [...vol.v] }, extensions = {};
    for (const key of Object.keys(FACES)) {
      const porches = (vol.faces?.[key] ?? vol.faces?.default)?.porches || [];
      const depth = Math.max(0, ...porches.filter(p => p.roof === 'main').map(p => p.d ?? 2.4));
      extensions[key] = depth;
      cover[key[1]][key[0] === '-' ? 0 : 1] += key[0] === '-' ? -depth : depth;
    }
    const roofW = cover.u[1] - cover.u[0], roofD = cover.v[1] - cover.v[0];
    const roofU = (cover.u[0] + cover.u[1]) / 2, roofV = (cover.v[0] + cover.v[1]) / 2;
    const length = roofW + 2 * ovh, span = roofD + 2 * ovh;     // along u, along v
    ridgeH = roof.h ?? Math.min(Math.min(span, length) * (roof.pitch || 0.4), roof.maxH || 6);
    const run = roof.run ?? (roof.flatTop ? Math.min(span, length) * 0.3 : Math.min(span, length) / 2 - 0.01);
    const tx = Math.max(0.15, length / 2 - run), tz = Math.max(0.15, span / 2 - run);
    const v = [
      -length / 2, 0, -span / 2,  length / 2, 0, -span / 2,  length / 2, 0, span / 2,  -length / 2, 0, span / 2,
      -tx, ridgeH, -tz,  tx, ridgeH, -tz,  tx, ridgeH, tz,  -tx, ridgeH, tz,
    ];
    const idx = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4, 4, 7, 5, 5, 7, 6, 0, 1, 2, 0, 2, 3];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex(idx);
    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();
    const rm = new THREE.Mesh(flat, surfaceMaterial('shingles',roofC));
    rm.name = 'hip-roof';
    rm.position.set(roofU, H - 0.02, roofV);
    g.add(rm);
    slopeOut = (key, yy) => { const half = key[1] === 'u' ? length / 2 : span / 2, t = key[1] === 'u' ? tx : tz; return extensions[key] + ovh - yy * (half - t) / ridgeH; };
    const c = vol.cornice || { height: 0.5, overhang: ovh, dentils: false };
    mainRoofY = H - (c.height ?? 0.5) + 0.02;
    const cornice = rbox(roofW + 2 * (c.overhang ?? ovh), c.height ?? 0.5, roofD + 2 * (c.overhang ?? ovh), wall(c.color, trimC), 0.05, roofU, H - (c.height ?? 0.5) / 2 + 0.02, roofV);
    cornice.name = 'hip-cornice';
    g.add(cornice);
    if (c.dentils) {
      for (const key of Object.keys(FACES)) {
        const fr = faceFrame({ ...vol, ...cover }, key);
        const n = Math.floor(fr.L / 0.55);
        for (let i = 0; i < n; i++) place(g, rbox(0.22, 0.22, 0.28, wall(c.color, trimC), 0.03), fr, (i + 0.5) / n, H - (c.height ?? 0.5) - 0.1, (c.overhang ?? ovh) * 0.5);
      }
    }
  } else if (roof.type === 'mansard') {
    // Mansard: a steep frustum (slope height `h`, horizontal run `inset`) with
    // a flat cap, an eave cornice, and dormers poking out of the slope.
    const ovh = roof.overhang ?? 0.3, mh = roof.h ?? 2.6, inset = roof.inset ?? 0.9;
    const length = W + 2 * ovh, span = D + 2 * ovh;
    const tx = Math.max(0.3, length / 2 - inset), tz = Math.max(0.3, span / 2 - inset);
    const v = [
      -length / 2, 0, -span / 2,  length / 2, 0, -span / 2,  length / 2, 0, span / 2,  -length / 2, 0, span / 2,
      -tx, mh, -tz,  tx, mh, -tz,  tx, mh, tz,  -tx, mh, tz,
    ];
    const idx = [0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4, 4, 7, 5, 5, 7, 6, 0, 1, 2, 0, 2, 3];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setIndex(idx);
    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();
    const rm = new THREE.Mesh(flat, surfaceMaterial('shingles',roofC));
    rm.position.set(uc, H - 0.02, vc);
    g.add(rm);
    const capC = wall(roof.capColor, new THREE.Color(roofC).offsetHSL(0, -0.04, -0.06).getHex());   // a shade darker than the slope
    g.add(rbox(2 * tx + 0.24, 0.16, 2 * tz + 0.24, capC, 0.05, uc, H + mh + 0.04, vc));   // flat cap with a thin lip
    ridgeH = mh + 0.1;
    // eave cornice (band + optional dentils), like the hip
    const c = vol.cornice || { height: 0.4, overhang: ovh, dentils: false };
    const ch = c.height ?? 0.4, cov = c.overhang ?? ovh;
    g.add(rbox(W + 2 * cov, ch, D + 2 * cov, wall(c.color, trimC), 0.05, uc, H - ch / 2 + 0.02, vc));
    if (c.dentils) {
      for (const key of Object.keys(FACES)) {
        const fr = faceFrame(vol, key);
        const n = Math.floor(fr.L / 0.55);
        for (let i = 0; i < n; i++) place(g, rbox(0.22, 0.22, 0.28, wall(c.color, trimC), 0.03), fr, (i + 0.5) / n, H - ch - 0.1, cov * 0.5);
      }
    }
    slopeOut = (key, yy) => ovh - inset * Math.min(1, yy / mh);
  }

  // Dormers: wall-coloured boxes growing out of a roof slope, a window on the
  // outer face and a tiny gable (or a shed slab) on top. Any pitched roof;
  // faces without a slope (gable ends) are skipped.
  const dm = roof.dormers;
  if (dm && slopeOut) {
    const dw = dm.w ?? 0.9, dh = dm.h ?? 1.2, dy = dm.y ?? 0.5, dtype = dm.type || 'rect';
    const dC = wall(dm.color, wallC), dTrim = wall(dm.trim, trimC), dRoof = wall(dm.roofColor, roofC);
    const halfIn = Math.min(W, D) / 2 + (roof.overhang ?? 0.4);
    for (const key of dm.faces || Object.keys(FACES)) {
      const so = slopeOut(key, dy);
      if (so === null) continue;
      const fr = faceFrame(vol, key);
      const fracs = dm.at || (() => { const n = dm.count ?? Math.max(1, Math.floor(fr.L / 4.5)); const m = 1.2 / fr.L; const a = []; for (let i = 0; i < n; i++) a.push(m + ((i + 0.5) / n) * (1 - 2 * m)); return a; })();
      const bw = dw + 0.5, bh = dh + 0.4;
      const outF = so + 0.12;                                          // dormer face, a hair proud of the slope at its sill
      const depth = Math.min(halfIn + outF, Math.max(0.9, dm.depth ?? (outF - (slopeOut(key, dy + bh) ?? 0) + 0.5), roof.type === 'mansard' ? (roof.inset ?? 0.9) + 0.9 : 0));
      for (const f of fracs) {
        const dg = new THREE.Group();
        dg.add(rbox(bw, bh, depth, dC, 0.06, 0, bh / 2 - 0.1, -(outF - depth / 2)));
        const win = windowEl({ type: dtype, w: dw, h: dh, trim: dTrim, sill: true });
        win.position.set(0, dh / 2 + 0.1, -outF);
        dg.add(win);
        if (dm.style === 'shed') {
          // shed slab rising back into the main roof, with a wall-coloured
          // wedge filling the box top up to it so the ends never show a gap
          const sl = rbox(bw + 0.3, 0.12, depth + 0.4, dRoof, 0.03, 0, bh + 0.02 + (depth + 0.4) / 2 * 0.22, -(outF - depth / 2) - 0.2);
          sl.rotation.x = -Math.atan(0.22);
          dg.add(sl);
          const wg = new THREE.ExtrudeGeometry(shapeOf([[-outF - 0.05, bh - 0.12], [-outF + depth, bh - 0.12], [-outF + depth, bh - 0.12 + 0.22 * (depth + 0.05)]]), { depth: bw, bevelEnabled: false });
          wg.translate(0, 0, -bw / 2); wg.rotateY(-Math.PI / 2);          // profile drawn in (z, y), extruded along x (rotateY(-90°) keeps z's sign)
          dg.add(new THREE.Mesh(wg, mat(dC)));
        } else {
          // little gable cap, ridge pointing out of the slope
          const rs = bw / 2 + 0.12, rh = rs * 0.7;
          const capGeo = new THREE.ExtrudeGeometry(shapeOf([[-rs, -0.02], [rs, -0.02], [0, rh]]), { depth: depth + 0.25, bevelEnabled: false });
          capGeo.translate(0, 0, -(depth + 0.25) / 2);
          const cap = new THREE.Mesh(capGeo, surfaceMaterial('shingles',dRoof));
          cap.position.set(0, bh - 0.1, -(outF - depth / 2) - 0.12);
          dg.add(cap);
        }
        dg.add(box(bw + 0.1, 0.12, 0.08, dTrim, 0, bh - 0.12, -outF - 0.14));   // fascia board under the cap
        place(g, dg, fr, f, H + dy, 0);
      }
    }
  }

  // Cupola on the ridge
  if (vol.cupola) {
    const cw = vol.cupola.width || 2.4;
    const cg = new THREE.Group();
    cg.add(rbox(cw, cw * 1.1, cw, wall(vol.cupola.color, WALL_COLORS.white), 0.06, 0, cw * 0.55, 0));
    const cr = new THREE.Mesh(new THREE.ConeGeometry(cw * 0.8, cw * 0.55, 4), mat(roofC));
    cr.rotation.y = Math.PI / 4; cr.position.y = cw * 1.1 + cw * 0.27; cg.add(cr);
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; const w = box(cw * 0.35, cw * 0.5, 0.06, P.timberDark, Math.sin(a) * cw / 2, cw * 0.55, Math.cos(a) * cw / 2); w.rotation.y = a; cg.add(w); }
    cg.position.set(uc + (vol.cupola.u || 0), H + ridgeH - 0.3, vc + (vol.cupola.v || 0));
    g.add(cg);
  }

  // Facades
  for (const key of faceKeys(vol)) {
    const spec = vol.faces?.[key] ?? vol.faces?.default;
    if (!spec || spec === 'blank') continue;
    const fr = faceFrame(vol, key);
    const bays = spec.bays || [];
    const behindBay = (f, y0, y1) => bays.some((by) => Math.abs(f - (by.at ?? 0.5)) * fr.L < (by.w || 2.4) / 2 + 0.3 && y1 > (by.y0 ?? 0) - 0.1 && y0 < (by.y1 ?? (by.h ? (by.y0 ?? 0) + by.h : H)) + 0.1);
    // storeys of windows
    for (const st of spec.storeys || []) {
      const win = st.windows;
      if (!win) continue;
      const wh = win.h || 1.8;
      const y = st.y + wh / 2;
      let fracs = [];
      if (win.at) fracs = win.at;
      else if (win.spread) { const n = win.count || 3; for (let i = 0; i < n; i++) fracs.push((win.center ?? 0.5) + ((i - (n - 1) / 2) * win.spread) / fr.L); }
      else { const n = win.count || Math.max(1, Math.floor(fr.L / 3)); const m = (win.margin ?? 0.9) / fr.L; for (let i = 0; i < n; i++) fracs.push(m + ((i + 0.5) / n) * (1 - 2 * m)); }
      for (const f of fracs) {
        if ((st.skip || []).some(([a, b]) => f > a && f < b)) continue;
        if (behindBay(f, st.y, st.y + wh)) continue;                 // the bay carries this window instead
        place(g, windowEl({ ...win, _variant: f * 97 + y, trim: win.trim ?? spec.trim ?? vol.trim ?? ctx.trim }), fr, f, y, st.out ?? 0.1);
      }
    }
    // bay windows: a box growing out of the wall, windows on its front and
    // sides for every storey it spans (the face's own storeys unless given),
    // a little hip or flat cap unless it runs up under the eaves
    for (const by of bays) {
      const bw = by.w || 2.4, bd = by.d || 0.8, y0 = by.y0 ?? 0, y1 = by.y1 ?? (by.h ? y0 + by.h : H);
      const bC = wall(by.color, wallC), bT = wall(by.trim ?? spec.trim, trimC);
      const bg = new THREE.Group();
      bg.add(rbox(bw, y1 - y0, bd + 0.1, bC, 0.05, 0, (y0 + y1) / 2, -bd / 2 + 0.05));
      if (y0 > 0.3) bg.add(rbox(bw + 0.1, 0.16, bd + 0.1, bT, 0.03, 0, y0 - 0.06, -bd / 2 + 0.05));   // skirt board under a raised bay
      const storeys = by.storeys ?? (spec.storeys || []).filter((st) => st.windows && st.y >= y0 - 0.1 && st.y + (st.windows.h || 1.8) <= y1 + 0.1);
      for (const st of storeys) {
        const win = st.windows; if (!win) continue;
        const wh = win.h || 1.8, yy = st.y + wh / 2, trim = win.trim ?? by.trim ?? spec.trim ?? vol.trim ?? ctx.trim;
        const n = by.count ?? Math.max(1, Math.round((bw - 0.6) / 1.4));
        for (let i = 0; i < n; i++) {
          const fw = windowEl({ ...win, w: Math.min(win.w || 1.1, (bw - 0.5) / n - 0.15), trim, at: undefined });
          fw.position.set(-(bw - 0.5) / 2 + ((i + 0.5) * (bw - 0.5)) / n, yy, -bd - 0.1);
          bg.add(fw);
        }
        if (by.sides !== false && bd >= 0.5) for (const sx of [-1, 1]) {
          const sw = windowEl({ ...win, w: Math.min(win.w || 1.1, bd - 0.3), trim, at: undefined, shutters: undefined });
          sw.position.set(sx * (bw / 2 + 0.1), yy, -bd / 2);
          sw.rotation.y = -sx * Math.PI / 2;
          bg.add(sw);
        }
      }
      const cap = by.roof ?? (y1 < H - 0.25 ? 'hip' : 'flat');
      if (cap === 'hip') {
        bg.add(rbox(bw + 0.3, 0.16, bd + 0.2, bT, 0.03, 0, y1 + 0.06, -bd / 2));
        const lh = leanHip(bw + 0.36, bd + 0.24, by.pitch || 0.5, wall(by.roofColor, roofC)).mesh;
        lh.position.y = y1 + 0.14; bg.add(lh);
      } else if (cap === 'flat') {
        bg.add(rbox(bw + 0.24, 0.16, bd + 0.2, bT, 0.03, 0, y1 + 0.06, -bd / 2 + 0.02));
      }
      place(g, bg, fr, by.at ?? 0.5, 0, 0);
    }
    // storefront glass bands
    for (const sf of spec.storefronts || []) {
      const [a, b] = sf.range;
      const len = (b - a) * fr.L;
      const glass = new THREE.Group();
      const frameC = wall(sf.frame, P.timberDark);
      glass.add(new THREE.Mesh(frameGeometry(outline('rect',len,sf.h || 2.3),outline('rect',len-0.24,(sf.h || 2.3)-0.24)),mat(frameC)));
      const gl = new THREE.Mesh(new THREE.BoxGeometry(len - 0.24, (sf.h || 2.3) - 0.24, 0.1), shopGlass);
      gl.position.z = -0.04; glass.add(gl);
      const nm = Math.max(1, Math.round(len / 1.3));
      for (let i = 1; i < nm; i++) glass.add(box(0.06, (sf.h || 2.3) - 0.3, 0.05, frameC, -len / 2 + (i * len) / nm, 0, -0.135));
      glass.add(box(len - 0.3, 0.06, 0.05, frameC, 0, (sf.h || 2.3) * 0.28, -0.135)); // transom bar
      if (sf.kick !== false) glass.add(rbox(len + 0.1, 0.55, 0.3, wall(sf.kick, frameC), 0.04, 0, -(sf.h || 2.3) / 2 - 0.3, -0.12));
      place(g, glass, fr, (a + b) / 2, (sf.y ?? 0.75) + (sf.h || 2.3) / 2);
    }
    // doors
    for (const d of spec.doors || []) place(g, doorEl(d), fr, d.at ?? 0.5, d.y ?? 0, 0.08);   // `y` lifts a door onto a porch floor
    // awnings
    for (const aw of spec.awnings || []) {
      const [a, b] = aw.range;
      const len = (b - a) * fr.L;
      if (aw.type === 'barrel') {
        place(g, buildBarrelAwning(len, aw, wall(aw.color, WALL_COLORS.navy), wall(aw.trim, trimC)), fr, (a + b) / 2, aw.y ?? 3.3, .12);
        continue;
      }
      const ag = new THREE.Group();
      const awn = rbox(len, 0.12, aw.depth || 1.5, wall(aw.color, WALL_COLORS.navy), 0.04, 0, 0, -(aw.depth || 1.5) / 2);
      awn.rotation.x = -0.32;
      ag.add(awn);
      if (aw.stripes) for (let i = 0; i < Math.floor(len / 0.5); i += 2) { const s = rbox(0.25, 0.13, aw.depth || 1.5, wall(aw.stripes), 0.03, -len / 2 + 0.125 + i * 0.5, 0.005, -(aw.depth || 1.5) / 2); s.rotation.x = -0.32; ag.add(s); }
      place(g, ag, fr, (a + b) / 2, aw.y ?? 3.3, 0.12);
    }
    // parapets standing on the wall top
    for (const pp of spec.parapets || []) {
      const Wp = pp.width === 'full' || !pp.width ? fr.L + 0.2 : pp.width;
      const o = pp.outline ? pp.outline.map(([x,y])=>[x*Wp,y*(pp.height || 2.5)]) : parapetOutline(pp.type || 'pediment', Wp, pp.height || 2.5);
      const pm = slab(o, pp.depth || 0.45, wall(pp.color, vol.upperWall ? wall(vol.upperWall) : wallC), (pp.depth || 0.45) / 2 - 0.02);
      // coping / trim edge: a slightly bigger, thinner slab behind gives an outline
      const trimS = slab(pp.outline ? offsetOutline(o, pp.trimWidth ?? 0.12) : grow(o, pp.trimWidth ?? 0.18), pp.trimDepth ?? 0.25, wall(pp.trim, trimC), (pp.depth || 0.45) / 2 + 0.1);
      const pg = new THREE.Group();
      pg.add(pm, trimS);
      if (pp.cross) { const cr = crossEl(pp.crossSize || 1.3, wall(pp.crossColor, trimC)); cr.position.set(0, (pp.height || 2.5) + 0.05, 0.1); pg.add(cr); }
      if (pp.roundel) { const rd = slab(grow(outline('round', pp.roundel === true ? 0.8 : pp.roundel, 0.8), 0.12), 0.1, wall(pp.trim, trimC), -0.06); rd.position.y = (pp.height || 2.5) * 0.58; pg.add(rd); const inner = slab(outline('round', (pp.roundel === true ? 0.8 : pp.roundel) - 0.1, 0.7), 0.1, wall(pp.color, wallC), -0.1); inner.position.y = rd.position.y; pg.add(inner); }
      if (pp.text) { const s = signEl({ text: pp.text, style: pp.textStyle || 'carved', w: Math.min(Wp * 0.7, 8), h: 0.8, opts: { bg: pp.color ? undefined : undefined } }); s.position.set(0, (pp.height || 2.5) * 0.45, -0.1); pg.add(s); }
      place(g, pg, fr, pp.at ?? 0.5, H + 0.05, 0.0);
    }
    // wall-mounted signs
    // A measured molding profile: stacked courses, specified from bottom up.
    for (const molding of spec.moldings || []) {
      const range = molding.range || [0, 1], mg = new THREE.Group();
      let y = 0;
      for (const course of molding.profile) {
        mg.add(rbox((range[1]-range[0])*fr.L, course.height, course.depth, wall(molding.color, trimC), Math.min(.025,course.height/4), 0, y+course.height/2, -course.depth/2));
        y += course.height;
      }
      place(g, mg, fr, (range[0]+range[1])/2, molding.y, 0.02);
    }
    for (const sg of spec.signs || []) place(g, signEl(sg), fr, sg.at ?? 0.5, sg.y ?? 3.6, sg.out ?? (sg.style === 'ghost' ? 0 : 0.1));
    // pilasters / corner piers with stone caps
    if (spec.pilasters) {
      const pl = spec.pilasters;
      for (const f of pl.at || [0.03, 0.97]) {
        const pw = pl.w || 0.9, pd = pl.d || 0.3;
        const capH = pl.capHeight ?? 0.3, capOut = pl.capOverhang ?? 0.1;
        const requestedH = pl.height ?? H + 0.35;
        const ph = pl.fitUnderEave ? Math.min(requestedH, H - (vol.cornice?.height ?? 0.5) - capH - 0.03) : requestedH;
        const pg = new THREE.Group();
        pg.add(rbox(pw, ph + 0.6, pd, wall(pl.color, wallC), 0.05, 0, ph / 2 - 0.3, -pd / 2 + 0.02));
        const capBottom = ph - 0.05;
        let capTop = capBottom + capH;
        // A belt and capital can end on exactly the same horizontal plane.
        // Let the capital finish slightly above it, retaining its overlap
        // with the shaft below, so their exposed tops cannot z-fight.
        for (const bc of vol.beltCourses || []) {
          if (Math.abs(capTop - (bc.y + (bc.height || 0.22) / 2)) < 0.001) capTop += 0.03;
        }
        const cap = rbox(pw + 2*capOut, capTop - capBottom, pd + 2*capOut, wall(pl.cap, trimC), 0.04, 0, (capBottom + capTop) / 2, -pd / 2 + 0.02);
        cap.name = 'pilaster-cap';
        if (pl.cap !== false) pg.add(cap);
        place(g, pg, fr, f, 0, 0);
      }
    }
    // buttresses at the corners (and at listed fractions)
    if (spec.buttresses) {
      const bt = spec.buttresses;
      const fr2 = fr;
      const fracs = bt.at || [0.5 / fr.L, 1 - 0.5 / fr.L];
      for (const f of fracs) {
        const bh = (bt.height || H * 0.8);
        const b1 = rbox(bt.w || 0.7, bh, bt.d || 0.9, wall(bt.color, wallC), 0.05, 0, bh / 2, -(bt.d || 0.9) / 2 + 0.1);
        const cap = rbox(bt.w || 0.7, 0.4, (bt.d || 0.9) + 0.1, wall(bt.color, wallC), 0.05, 0, bh + 0.1, -(bt.d || 0.9) / 2 + 0.1);
        cap.rotation.x = -0.6;
        const bg = new THREE.Group(); bg.add(b1, cap);
        place(g, bg, fr2, f, 0, 0);
      }
    }
    // porches protruding from this face: an open one (floor, posts, roof,
    // railing) or the default gabled entry box
    for (const po of spec.porches || []) {
      if (ctx.athenaeumFront && key === '+v' && ['lakefront', 'north_wing', 'south_wing'].includes(vol.id)) continue;
      if (po.style === 'open' || po.style === 'carport') { g.add(openPorch(rng, po, fr, spec, { wallC, trimC, roofC, roof, mainRoofY })); continue; }
      const pw = po.w || 3, pd = po.d || 2.4, ph = po.height || 3;
      if (polygon) {
        const entry = buildVolume(rng, { u: [-pw / 2, pw / 2], v: [-pd, 0], height: ph,
          wall: po.wall ?? vol.wall, trim: po.trim ?? vol.trim,
          roof: { type: 'gable', ridge: 'v', pitch: po.pitch || 0.7, color: po.roofColor ?? roof.color,
            overhang: 0.3, cross: po.cross, crossEnd: '-', crossSize: 0.9, gableColor: po.gableColor },
          faces: { '-v': { doors: po.door ? [{ ...po.door, at: 0.5 }] : [] } } }, ctx);
        place(g, entry, fr, po.at ?? 0.5, 0, 0);
        continue;
      }
      const pv = {
        u: [0, 0], v: [0, 0], height: ph, wall: po.wall ?? vol.wall, trim: po.trim ?? vol.trim,
        roof: { type: 'gable', pitch: po.pitch || 0.7, color: po.roofColor ?? roof.color, ridge: key[1] === 'u' ? 'u' : 'v', overhang: 0.3, cross: po.cross, crossEnd: key[0], crossSize: 0.9, gableColor: po.gableColor },
        faces: { [key]: { doors: po.door ? [{ ...po.door, at: 0.5 }] : [] } },
      };
      // extents: centred at the face fraction, protruding outward by pd
      const c = fr.at(po.at ?? 0.5, pd / 2, 0);
      const alongU = key[1] === 'v'; // face runs along u when its normal is ±v
      pv.u = alongU ? [c.x - pw / 2, c.x + pw / 2] : [c.x - pd / 2, c.x + pd / 2];
      pv.v = alongU ? [c.z - pd / 2, c.z + pd / 2] : [c.z - pw / 2, c.z + pw / 2];
      g.add(buildVolume(rng, pv, ctx));
    }
  }

  // Towers rising from within the volume footprint
  for (const tw of vol.towers || []) {
    const tw_w = tw.w || 4, th = tw.height || H + 6;
    const tg = new THREE.Group();
    tg.add(rbox(tw_w, th + 1, tw_w, wall(tw.wall, wallC), 0.1, 0, (th + 1) / 2 - 1, 0));
    tg.add(rbox(tw_w + 0.3, 0.3, tw_w + 0.3, trimC, 0.05, 0, th, 0));
    if (tw.spire !== false) { const sp = new THREE.Mesh(new THREE.ConeGeometry(tw_w * 0.62, tw_w * (tw.spireH || 1.8), 4), mat(roofC)); sp.rotation.y = Math.PI / 4; sp.position.y = th + tw_w * (tw.spireH || 1.8) / 2; tg.add(sp); }
    if (tw.cross) { const cr = crossEl(1.2, wall(tw.crossColor, trimC)); cr.position.y = th + (tw.spire === false ? 0.3 : tw_w * (tw.spireH || 1.8)); tg.add(cr); }
    if (tw.windows !== false) for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; const w = windowEl({ type: tw.windowType || 'gothic', w: 0.9, h: 2.2, trim: trimC }); w.position.set(Math.sin(a) * (tw_w / 2 + 0.06), th - 2.4, Math.cos(a) * (tw_w / 2 + 0.06)); w.rotation.y = a + Math.PI; tg.add(w); }
    tg.position.set(tw.u ?? uc, 0, tw.v ?? vc);
    g.add(tg);
  }

  // Chimneys
  for (const ch of vol.chimneys || []) {
    const c = buildChimney(rng, ridgeH, H, 0, 0);
    c.group.position.set(ch.u ?? uc, 0, ch.v ?? vc);
    g.add(c.group);
    ctx.smokes.push(c.emitter); // retain the animated puffs, not the staging scene through c.group.parent
  }
  return g;
}

// ---------------------------------------------------------------------------

export function buildBlueprint(rng, b, bp, baseY, smokes, wallBottom = -1.2) {
  const obb = b.obb;
  const root = new THREE.Group();
  root.position.set(obb.cx, baseY, obb.cz);
  root.rotation.y = -obb.angle; // local x = u, local z = v
  if (bp.amphitheater) {
    root.add(buildAmphitheater(obb, bp.amphitheater, b.amphitheaterGround));
    return root;
  }
  if (bp.fountain) {
    root.add(buildFountain(obb, bp.fountain));
    return root;
  }
  if (bp.bridge) {
    root.add(buildBridge(obb, bp.bridge, wall(bp.wall), wall(bp.trim, 0xc4b99e)));
    return root;
  }
  if (bp.pavilion) root.add(buildPavilion(obb, bp.pavilion, wall(bp.wall, '#b48b58'), roofc(bp.roofColor, '#594638')));
  const ctx = { kind: b.style?.kind || 'house', wall: bp.wall || 'cream', wallMaterial: bp.wallMaterial, trim: bp.trim || 'white', roofColor: bp.roofColor || 'slate', smokes, wallBottom, athenaeumFront: bp.athenaeumFront };
  for (const vol of bp.volumes || []) root.add(buildVolume(rng, vol, ctx));
  joinFlatRoofs(root.children.flatMap(group => group.children.filter(mesh => mesh.userData.flatRoofPart)));
  const volumes=bp.volumes || [];
  for(let i=0;i<volumes.length;i++) {
    const a=volumes[i]; if(a.polygon) continue;
    const boxes=[];
    for(let j=0;j<volumes.length;j++) {
      const b=volumes[j]; if(j<=i || b.polygon) continue;
      if(Math.min(a.u[1],b.u[1])-Math.max(a.u[0],b.u[0])<0.01
        || Math.min(a.v[1],b.v[1])-Math.max(a.v[0],b.v[0])<0.01) continue;
      // Only remove coincident flat faces. Subtracting the whole bounding
      // box cuts holes beside the other wall's rounded corners and belts.
      const levels=b.upperWall ? [b.bottom??-1.2,b.split??3.6,b.height||6] : [b.bottom??-1.2,b.height||6];
      for(const [axis,key] of [[0,'u'],[2,'v']]) for(const edge of [0,1]) {
        if(Math.abs(a[key][edge]-b[key][edge])>1e-5) continue;
        for(let k=1;k<levels.length;k++) {
          const min=[b.u[0]+0.15,levels[k-1]+0.15,b.v[0]+0.15];
          const max=[b.u[1]-0.15,levels[k]-0.15,b.v[1]-0.15];
          min[axis]=b[key][edge]-0.002;max[axis]=b[key][edge]+0.002;
          boxes.push({min,max});
        }
      }
    }
    if(boxes.length) for(const mesh of root.children[i].children) {
      if(mesh.userData.volumeWall) trimCoveredWalls(mesh,boxes);
    }
  }

  // Porches that back onto one wall line but span several volumes: `face` is
  // the outward normal, `u` (or `v`) the extent along the wall, `wall` the
  // wall plane's v (or u) coordinate. Fractions (stepsAt, door.at) run along
  // the porch itself.
  for (const po of bp.porches || []) {
    const key = po.face, F = FACES[key];
    const along = key && (key[1] === 'v' ? po.u : po.v);
    if (!F || !along || po.wall === undefined) continue;
    const L = along[1] - along[0], mid = (along[0] + along[1]) / 2;
    const fr = {
      n: F.n, t: F.t, L, rotY: Math.atan2(-F.n[0], -F.n[1]),
      at: (f, out = 0, y = 0) => key[1] === 'v'
        ? new THREE.Vector3(mid + F.t[0] * (f - 0.5) * L + F.n[0] * out, y, po.wall + F.n[1] * out)
        : new THREE.Vector3(po.wall + F.n[0] * out, y, mid + F.t[1] * (f - 0.5) * L + F.n[1] * out),
    };
    const wallC = wall(po.wall_color ?? bp.wall, WALL_COLORS.cream), trimC = wall(po.trim ?? bp.trim, P.trim), roofC = roofc(po.roofColor ?? bp.roofColor);
    root.add(openPorch(rng, { ...po, style: po.style || 'open', range: [0, 1] }, fr, { doors: [] }, { wallC, trimC, roofC, roof: {} }));
  }

  // Free-standing details in the (u, v) frame
  for (const d of bp.details || []) {
    let m = null;
    if (d.type === 'lawnsign') {
      m = new THREE.Group();
      const postH = d.postHeight ?? 1.3;
      m.add(box(0.1, postH, 0.1, 0x3a3a3a, -(d.w || 2.2) / 2 + 0.2, postH / 2, 0));
      m.add(box(0.1, postH, 0.1, 0x3a3a3a, (d.w || 2.2) / 2 - 0.2, postH / 2, 0));
      const s = signEl({ text: d.text, style: d.style || 'red', w: d.w || 2.2, h: d.h || 0.9, opts: d.opts, shape: d.shape });
      s.position.set(0, postH + (d.h || 0.9) / 2, 0.14 - 0.14);
      m.add(s);
      m.rotation.y = d.rotation ?? 0;
    } else if (d.type === 'cross') {
      m = crossEl(d.size || 1.2, wall(d.color, 0xf0ece4));
    } else if (d.type === 'bush') {
      m = buildBush(rng);
    } else if (d.type === 'flag') {
      m = flagEl(d.height || 7, d.w || 1.6);
      m.rotation.y = d.rotation ?? (obb.angle - Math.PI / 4); // every flag in the village flies toward the south-east, whatever its building's frame
    } else if (d.type === 'landing') {
      m = stairLanding(d); m.rotation.y = d.rotation || 0;
    } else if (d.type === 'ramp' || d.type === 'stair') {
      // starts at (u, v) at grade and climbs in direction `dir` (u, v)
      m = accessEl(d);
      const [du, dv] = d.dir || [1, 0];
      m.rotation.y = d.rotation ?? Math.atan2(-du, -dv);              // local -z → dir
    }
    if (!m) continue;
    m.position.set(d.u, d.y || 0, d.v);
    if (bp.athenaeumFront && d.type === 'flag') {
      m.name = 'athenaeum-roof-flag';
      m.traverse(o => { if (o.isMesh) o.userData.streamCoarse = true; });
    }
    root.add(m);
  }
  if (bp.athenaeumFront) root.add(buildAthenaeumFront(bp.athenaeumFront, b.athenaeumGround));
  if (bp.alumniHallBalcony) root.add(buildAlumniHallBalcony());
  if (bp.lennaHall) root.add(buildLennaHall(bp.lennaHall,b.lennaGround));
  if (bp.hultquistCenter) root.add(buildHultquistCenter(bp.hultquistCenter,b.hultquistGround));
  return root;
}
