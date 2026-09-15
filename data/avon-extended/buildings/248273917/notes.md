# 248273917 — 77 Prospect Street

## Identification (confidence: high)
Pale-mint vinyl-sided house on the west side of Prospect Street, the odd stepped
building directly NNE of the cream Queen Anne (248273915, gap 5 m) and SSW of the
white house with blue shutters (91 Prospect, 248273908). Both `-u` photos show it
head-on (with the Queen Anne's porch at the left edge for orientation), so the
identification is certain.

## Frame
OBB 13.4 m (u) x 11.4 m (v); +u bears 285° (WNW, away from the street), +v bears
15° (NNE). Road face `-u`; its left end (fraction 0) is `-v` = SSW, toward the
Queen Anne. Footprint is a plain rectangle. The lot drops 1.6 m from the street
to the rear; no plinth added (renderer carries the rear on a foundation).

## Photos used
- `front_248273917_-u.png`, `front_248273917_-u_2.png` — both usable, near
  head-on; the big street maple hides the middle-right of the main block in the
  first, the second shows the whole face.
- `front_248273917_+u.png` (171° off) and `+u_2.png` (129° off) are actually
  shot from the street: `+u` repeats the front, `+u_2` mostly shows 91 Prospect
  (white, blue shutters). No true rear view exists; rear kept plain.
- `front_248273917_+v*.png` — target is centre-frame behind the maple; enough to
  confirm the silver metal gable end faces NNE (ridge parallel to the street)
  and the low gabled carport at the NNE end.
- `front_248273917_-v*.png` — target is behind the neighbour's trees; a sliver of
  the SSW wall and the white side door visible. Otherwise inferred.
- `data/avon/satellite.jpg` crop: bright white metal roof; flat lower roofs at
  the SSW front corner and across the rear.

## Reading face by face
- `-u` (street), left to right on ~11.4 m: (0–0.24) one-storey flat-roofed wing,
  plain fascia, white six-panel door at ~0.7 of the wing with a wall lamp to its
  left, at sidewalk grade on a concrete pad. (0.24–0.8) taller 1.5-storey block:
  eave ~3.7 m, steep bright standing-seam metal gable, ridge parallel to the
  street (~6.2 m); one wide 3-light picture window low-left, two small square
  windows high to the right, a meter box between. Tiny gabled entry portico with
  two white posts, silver metal roof, white door with a half-round glass panel,
  two steps flanked by brick planters at ~0.85. (0.8–1.0) open-fronted carport
  with a low gable to the street, dark red rear wall inside, black asphalt drive.
- `-v` (SSW): flat wing wall, blank; main block gable end rises behind it.
- `+v` (NNE): carport side; main block gable end above it.
- `+u` (rear): unseen; low flat additions per satellite.

## What was modelled / exaggerated
- Three volumes: `main` (gable, ridge v, height 3.8, ridge +2.6, silver roof),
  `front-wing` and `rear-wing` (flat, 2.9 m, thin white fascia, no dentils).
- The carport is a real top-level `porches` entry, `style: "carport"`: it hangs
  off the main block's NNE side on face `-u` (v 3.8..6.4, backing onto u = 0,
  6.7 m deep to the street line), 2.4 m tall, two white posts at the street end,
  silver gable whose ridge runs out from the wall so the gable end faces the
  street, dark asphalt slab. Open on all sides except where it meets the main
  block, as in the photos.
- Signature features pushed a little: the bright metal roof, the step between
  wing and main block, the one big picture window, the white-posted gabled
  portico, the carport gable.
- Fewer windows: one picture window + two small ones on the front; a single
  attic window in each gable end; a couple of plain windows on the wings.

## Approximations / schema gaps
- Carport runs 0.7 m past the OBB on +v (as it does in the imagery). Its dark
  red back wall is not modelled; the bay is open at the rear.
- Brick planters beside the portico steps approximated by two small bushes.
- `-v` compare camera lands inside the Queen Anne (5 m gap); checked massing
  with `--iso` instead.
- Rear elevation invented (two windows, a door).

## Confidence
High on the street face and roof form; medium on volume depths (main block
depth 8 m is a guess from the roof steepness and satellite); low on the rear.
