// Parked cars where cars actually park: in rows in the parking lots, and
// parallel along the on-street bays.
//
// Each lot's minimum-area bounding rectangle gives the row direction. A lot
// too narrow for a stall's depth plus an aisle gets one parallel row down its
// middle (Genesee Street's on-street bays); a wider one gets a row of nose-in
// stalls along the long edge farthest from the road, and both long edges when
// there is room for an aisle between. About half the stalls are taken, each
// car a hair off square the way parked cars are, so the lots read as a quiet
// afternoon rather than a scatter.

import * as THREE from 'three';
import { buildCar } from './kit.js';

const SCALE = 1.3;                 // the kit car is 3.7 m long; this makes it a real sedan
const CAR_L = 3.7 * SCALE, CAR_W = 1.75 * SCALE;
const STALL_W = 2.8, STALL_D = 5.6;  // nose-in stall
const BAY_STEP = 6.8;                // parallel parking, nose to tail
const AISLE = 6.0;
const INSET = 0.25;                  // a car keeps this far inside the paving

// Minimum-area bounding rectangle of a polygon: one side lies along a polygon
// edge, so try each edge direction
function obb(ring) {
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-6) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L; // along the edge, and (-uz, ux) across it
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of ring) {
      const u = x * ux + z * uz, v = -x * uz + z * ux;
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ux, uz, u0, u1, v0, v1 };
  }
  if (!best) return null;
  const { ux, uz, u0, u1, v0, v1 } = best;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  // long axis first
  const long = u1 - u0 >= v1 - v0;
  return {
    cx: cu * ux - cv * uz, cz: cu * uz + cv * ux,
    ux: long ? ux : -uz, uz: long ? uz : ux,
    lenU: long ? u1 - u0 : v1 - v0, lenV: long ? v1 - v0 : u1 - u0,
  };
}

function inside(ring, x, z) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// lots: parking polygons ({ pts } in local metres). surfaceY(x, z): height of
// the paving. roadEdge(x, z): signed distance from the nearest road's edge
// (negative on the road). W, H: site size.
export function buildParking(rng, { lots, surfaceY, roadEdge, W, H }) {
  const group = new THREE.Group();
  const HW = W / 2, HH = H / 2;

  for (const lot of lots) {
    const ring = lot.pts.length > 2 && lot.pts[0][0] === lot.pts[lot.pts.length - 1][0] && lot.pts[0][1] === lot.pts[lot.pts.length - 1][1] ? lot.pts.slice(0, -1) : lot.pts;
    const box = ring.length >= 3 ? obb(ring) : null;
    if (!box || box.lenU < CAR_L + 1) continue;
    const { cx, cz, ux, uz, lenU, lenV } = box;
    const vx = -uz, vz = ux; // across the lot
    const at = (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v];
    // A car centred at (u, v), its length along (ax, az): all four corners on the paving, inside the border
    const fits = (u, v, ax, az) => {
      const bx = -az, bz = ax, hl = CAR_L / 2 + INSET, hw = CAR_W / 2 + INSET;
      for (const [s, t] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const [x, z] = at(u + ax * hl * s + bx * hw * t, v + az * hl * s + bz * hw * t);
        if (!inside(ring, x, z) || Math.abs(x) > HW - 1 || Math.abs(z) > HH - 1) return false;
      }
      return true;
    };
    const park = (u, v, yaw) => {
      const [x, z] = at(u, v);
      const car = buildCar(rng);
      car.scale.multiplyScalar(SCALE);
      car.position.set(x + rng.range(-0.12, 0.12), surfaceY(x, z) + 0.02, z + rng.range(-0.12, 0.12));
      car.rotation.y = yaw + rng.range(-0.045, 0.045); // a couple of degrees off square, as parked cars are
      group.add(car);
    };
    const yawOf = (dx, dz) => Math.atan2(dx, dz); // the kit car's nose is its local +z

    // A strip hugging the road is the street's own parking lane, part of the
    // ribbon: it keeps its cars even where the road test says they are on it
    const onStreet = lenV < 12 && roadEdge(cx, cz) < 3;

    // How full: the street's own bays are busy, each lot has its own quiet or
    // busy afternoon
    const occupancy = onStreet ? 0.3 : rng.range(0.06, 0.28);
    // Edges of a real lot are rarely parallel to its box: slide a stall inward
    // a little until all four corners are on the paving
    const settle = (u, v, ax, az, dvx, dvz) => {
      for (let d = 0; d <= 2; d += 0.25) if (fits(u + dvx * d, v + dvz * d, ax, az)) return [u + dvx * d, v + dvz * d];
      return null;
    };

    if (lenV < STALL_D + 1.5) {
      // A bay: one parallel row down the middle, all facing the same way
      const face = rng.chance(0.5) ? 1 : -1;
      const yaw = yawOf(ux * face, uz * face);
      for (let u = -lenU / 2 + BAY_STEP / 2; u <= lenU / 2 - BAY_STEP / 2; u += BAY_STEP) {
        if (!rng.chance(occupancy)) continue;
        const spot = settle(u, 0, 1, 0, 0, 1) || settle(u, 0, 1, 0, 0, -1);
        if (spot) park(...spot, yaw);
      }
      continue;
    }
    // Nose-in rows: one along the edge away from the road, then back-to-back
    // pairs with an aisle between, and one along the near edge if it still fits
    const far = roadEdge(...at(0, lenV / 2)) >= roadEdge(...at(0, -lenV / 2)) ? 1 : -1;
    const rows = [[STALL_D / 2, far, 1]]; // [depth in from the far edge, which way the nose points, which way to settle]
    let used = STALL_D;
    while (used + AISLE + 2 * STALL_D <= lenV) {
      rows.push([used + AISLE + STALL_D / 2, -far, 0], [used + AISLE + STALL_D * 1.5, far, 0]);
      used += AISLE + 2 * STALL_D;
    }
    if (used + AISLE + STALL_D <= lenV) rows.push([lenV - STALL_D / 2, -far, -1]);
    for (const [depth, face, inward] of rows) {
      const v = far * (lenV / 2 - depth), yaw = yawOf(vx * face, vz * face);
      for (let u = -lenU / 2 + STALL_W / 2 + 0.5; u <= lenU / 2 - STALL_W / 2 - 0.5; u += STALL_W) {
        if (!rng.chance(occupancy)) continue;
        const spot = inward ? settle(u, v, 0, 1, 0, -far * inward) : (fits(u, v, 0, 1) ? [u, v] : null);
        if (!spot) continue;                                          // off the paving
        if (!onStreet && roadEdge(...at(...spot)) < 0.5) continue;    // on the street
        park(...spot, yaw);
      }
    }
  }
  return group;
}
