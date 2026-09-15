# Blueprint notes — OSM 248251399 — Community Bank, 68 Genesee Street

## Identification
Community Bank branch, 68 Genesee St (east side of Genesee, north of the Opera Block row).
Confirmed by the "Community Bank" sign under the clock in `front_-v.png`, `sv_a.png`, `sv_b.png`
and the "Comm… Bank" lettering on the atrium glass in `front_+u.png`; the OSM POI 12963670238
(bank, "Community Bank") sits on the footprint. **Confidence: high.**

## Frame
OBB 21.9 m (u) × 18.2 m (v); +u bears 14° (NNE), +v 104° (ESE). Road face `-v` (Genesee St,
looks WNW); from the street the left end is north (+u). Footprint is an L: the street block
u −10.9..10.9 × v −9.1..1.7 (21.9 × 10.8 m) plus a rear wing at the north end
u 4.3..10.9 × v 1.7..9.1. Flat lot (<1 m).

## Photos used
- `front_248251399_-v.png` (Aug 2025, 19 m out, 11° off) — the road elevation, primary source.
- `sv_248251399_a.png`, `sv_248251399_b.png`, `sv_248251399_c.png` — clock tower, atrium, sign, south end.
- `front_248251399_+u.png` (Aug 2023, 45° oblique) — north face: atrium glass, drive-through canopy, ATM.
- `front_248251399_+v.png` (Aug 2023) — rear: garage door, clerestory monitor along the ridge.
- `front_248251399_+u_2.png` and `front_248251399_-u.png` show other buildings (the 2-storey
  Coastal Staffing block and the white side wall of 78 Genesee) — not used.
- `overhead_labeled.jpg` (label 1399) — ridge runs along u, L-shaped footprint, wing at the NE.

## Reading face by face
**−v (Genesee St, 21.9 m, left = north).** One storey. Red-brick base ~1.3 m, then tan horizontal
siding to an eave at ~3.6 m; dark shingle gable roof, very shallow, ridge along the length,
overhanging eave with a dark fascia. From the left: the glass atrium wraps the NW corner (dark
glass, dark bronze frame, ~2 m of it on this face); the tan clock tower (~3.4 m wide, ~9.5 m
tall, flat top) at ≈0.10–0.25 of the face with a round white clock near the top, the red/orange
"Community Bank" board below it and a small round blue "$" sign at eye level; then a square
window (~1.8 m) at ≈0.31 sitting on the brick; a band of five small high windows at ≈0.43–0.60;
a group of three windows at ≈0.68–0.84 sitting on the brick. Nothing on the far right.
**+u (north, 18.2 m, left = east).** Glass atrium at the west (right) end with the entrance;
east of it a low tan wall under a dark flat metal canopy on thin posts (drive-through/ATM),
running ~10 m. The gable end above is tan siding.
**+v (rear).** Tan siding over brick, a tan garage/loading door, and a raised monitor along
the ridge with a continuous band of small windows facing east.
**−u (south).** Gable end, plain siding, 4 m from the white 2-storey neighbour (78 Genesee).

## What was modelled / exaggerated
- `hall`: the street block, brick `wall` with tan `upperWall` split at 1.3 m, gable roof
  pitch 0.28 ridge u, dark shingles. −v: one square window, four small high windows, three
  medium windows — fewer than reality, same three groups, no mullions (commercial glazing).
- `clock-tower`: a separate flat-topped volume (3.4 × 3.5 m, 9.6 m) protruding 0.4 m in front
  of the wall so its −v face can carry the features: a `round` window with pale glass as the
  clock (slightly bigger than life), a `red` "Community Bank" board, a `navy` "$" plaque.
- `atrium`: a dark-glass box at the NW corner (5.4 m tall) with `shop` storefront bands on
  −v and +u and a dark double door on +u.
- Drive-through canopy: two flat `open` porches on the north faces of `hall` and `wing`
  (3.1 m tall, thin dark posts, dark flat roof).
- `monitor`: a low flat-roofed box on the ridge with a row of five windows facing +v.
- `wing`: the rear NE wing with a hip roof; garage door on the rear of `hall`.
- Flag pole by the street (there is one in front of the tower).

## Approximations / schema gaps
- The clock is a `round` window, so it has a rim but no hands.
- The real atrium has a sloped glass roof rising against the tower; modelled as a flat-topped
  glass box.
- The canopy posts are the porch's fixed 0.2 m posts; fine here (the real ones are thin).
- Tower via a volume rather than `towers[]` because `towers[]` has no faces for signs; its
  flat roof draws a small cornice band that the real tower lacks.
- The band of five small windows is really six or seven; the three windows at right are
  really a 3+2 group.
- The head-on `+u` camera (north face) at 30–40 m lands inside the Coastal Staffing block
  across the parking lot, so the north view was shot from bearing 335° at 34 m
  (`render_248251399_north.png`, composed into `compare_248251399_+u.png`).
  `render_248251399_iso.png` is the diorama camera from the street side.

## Confidence
High on identity, massing, colours and the tower/atrium arrangement; medium on exact window
positions and the rear (the rear wing and monitor are read from one oblique photo and the
overhead).
