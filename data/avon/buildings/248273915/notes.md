# Blueprint notes — OSM 248273915 — house between 53 and 77 Prospect Street (west side)

## Identification (confidence: medium-high)
Pale-yellow clapboard 1.5-storey farmhouse with a full-width open front porch
(white turned posts, spindle railing, a hammock in the right bay), dark-green
window trim, grey roof. Matched across three photos by the porch and hammock:
`+u` head-on (16 m), `+v` from the south (the same porch + hammock appear right
of 53 Prospect's brown roof and red chimney), and `-v` from the north (porch
with spindle railing at the far left). The neighbours are confirmed by bearing:
77 Prospect (248273917, pale-green with a metal roof) lies off `-v`, 53 Prospect
(248273914, cream with red shutters and a red brick chimney) off `+v`.

## Frame
OBB 19.7 m (u, ESE) × 12.4 m (v, SSW); road face `+u` (ESE), 12.4 m wide.
Face fractions on `+u` run 0 → 1 from SSW (+v, toward 53 Prospect) to NNE.
Lot slopes 2.8 m down toward the rear (-u); the renderer carries this on a
foundation, no plinth added.

## Photos used
- `front_248273915_+u.png` (16 m, 10° off) — road face, mostly behind a large
  maple: porch full width, door centred, big ground windows either side, main
  roof eave just above the porch roof, a small steep gable centred above with
  a window. Right of the porch: the one-storey pale-green metal-roofed
  addition and the tall pale-green house are 77 Prospect, not this building.
- `front_248273915_+v.png` (55° off) — from the south: shows the south gable end
  with two storeys of windows and an attic vent/window, the street-facing
  small gable with fish-scale shingles, and the porch. 53 Prospect in front.
- `front_248273915_+v_2.png` (44° off) — mostly 53 Prospect; the target's front
  gable and porch posts show behind it at right.
- `front_248273915_-v.png` (36° off) — mostly 77 Prospect and its addition; the
  target's porch and a gable appear at far left.
- `overhead_labeled.jpg` (3915): a continuous dark roof over the whole deep
  footprint; a lighter porch strip along the street edge.

## Reading face by face
- `+u` (road): porch across the full width, floor ~0.5 m up, ~6 turned posts,
  spindle railing, steps centred on the door. Behind it: a centred door with a
  dark-green surround, one wide window each side (≈0.2, ≈0.8). Eave ≈4.3 m,
  right above the porch roof; a steep cross gable ≈4 m wide centred on the
  face with a single window; grey shingles; a chimney near the ridge.
- `+v` (south, 19.7 m): the gable end of the main roof toward the street end:
  two ground windows, two upper windows up in the gable, an attic window at the
  peak; a lower rear wing behind.
- `-v` (north): mirror of the south, no attic window seen (blocked); kept plain.
- `-u` (rear): no coverage; rear wing with a door and a window.

## What was modelled / exaggerated
- Main volume u [-2, 9.8] with ridge along v (parallel to the street), eave
  4.4 m, pitch 0.36 / maxH 4.2 — the low eave over the porch is the key
  silhouette.
- Centred front cross gable (4.2 m wide, pitch 0.6) with a window, enlarged a
  little.
- Full-width open porch, 6 posts, railing, 3 steps, hip roof.
- South gable end with three tiers of windows including an attic window.
- Lower rear kitchen wing (u [-9.8, -1.9], eave 3.4, gable ridge u) filling the
  back of the deep footprint; rear door with steps.
- Dark-green window trim, cream posts and door, two bushes flanking the steps.

## Approximations / schema gaps
- Turned posts, spindle frieze and fish-scale gable shingles cannot be
  expressed; square posts and plain clapboard stand in.
- Hammock omitted (no schema).
- The rear half of the footprint is a guess (continuous roof in the overhead);
  the rear-wing height and door are invented.
- `+v` compare render: the camera lands inside 53 Prospect (3.6 m gap), so the
  render view is partly blocked by that neighbour; the target's gable end and
  attic window read correctly in what is visible.

## Confidence
Road face & porch: high. Roof orientation (ridge parallel to street with a front
cross gable): medium — inferred from the eave line over the porch and the
south gable in the `+v` photo; the overhead is ambiguous. Rear: low.
