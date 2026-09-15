# Blueprint notes — OSM 248274492 — 70 West Main Street

## Identification (confidence: high for *which* footprint, medium for the elevation)

- The OSM footprint sits between 72 W Main (@Work Personnel, 248274491, off `-v`) and the 58-60 W Main double footprint (248274494, off `+v`), exactly where the overhead imagery shows a long narrow gable roof (label 4492).
- In the Aug 2025 Street View the lot is **vacant** (tall grass, a tree, a parked car). The earlier research note guessed the yellow double-porch house; that is #60, already modelled inside 248274494.
- Using Street View's older dates (private headless Chrome via `pipeline/agent_browser.py`, pano `HLHI8nbeJw3D7ylnGQ18Dw`, Aug 2016) the building is visible: a plain, weathered white clapboard two-storey front-gabled house on a fieldstone foundation. It was demolished between Aug 2016 and Aug 2023 (the 2023 thumbnail already shows the gap).
- Modelled as it stood in 2016 because the OSM footprint (and the diorama) still carries it. The coordinator may prefer to drop the building entirely to match today's street; flagging that decision.

## Frame

- OBB 19.1 m along u × 9.8 m along v; +u bears 37° (NE, away from the street), +v bears 127° (SE). Road face `-u` (SW, West Main Street); left end (0) of `-u` = `-v` = NW toward @Work Personnel.
- Lot slopes 1.3 m across the footprint; no compensating plinth. The 0.7 m `plinth` on both volumes is the visible fieldstone foundation from the 2016 photo, not a terrain fix.

## Photos used

- `front_248274492_-u.png`: fully blocked by a green truck tarp — useless (the `--compare` image shows this).
- `front_248274492_-u_2.png`, `+u.png`, `+v*.png`, `-v*.png` (all Aug 2025): show the vacant lot and the neighbours only; used to confirm the footprint is the empty lot.
- `sv_248274492_a/b/c.png`: the same truck.
- Aug 2016 Street View captures (scratchpad only, not saved to research/): head-on from the street at 55° and 35° fov, and a 60° heading oblique showing the `+v` (SE) side. These are the source of the elevation.
- `overhead_labeled.jpg` crop around 4492: continuous gable ridge along u for the full 19 m, no visible side wings.

## Reading face by face

- `-u` (road, gable end, ~8 m wide in reality): two storeys on a ~0.7 m fieldstone foundation. Ground floor: boarded (plywood) window left at ~0.22, centred door with a four-step stone stoop, boarded window right at ~0.78 (with a mailbox). Upper floor: two six-over-six windows at ~0.27 / ~0.73. Front gable with a moderate-steep pitch (~40°), small cornice returns, weathered grey shingles. No porch, no chimney visible on the front. Peeling white clapboard, white trim.
- `+v` (SE side, oblique 2016 view): two-storey clapboard, a couple of windows; the roof steps down toward the back (a lower rear section). A tall vent pipe/chimney near the junction.
- `-v` (NW side): not photographed in 2016 from a usable angle; mirrored from `+v` with a side door on the rear wing (typical, and the lot's driveway ran along this side).
- `+u` (rear): not photographed; plain with two windows.

## What was modelled / exaggerated

- Two volumes on one ridge: a taller front-gabled block (u −9.55…1.6, eaves 6.1 m, pitch 0.42) and a lower rear wing (eaves 4.6 m) so the roof steps down as in the oblique photo. Ridge along u for both, matching the overhead.
- The signature features, made a little larger: the fieldstone plinth, the centred door with four steps, the two plywood-boarded ground-floor windows (rendered as windows with a muted plywood-tan "glass" and no mullions), the two upper windows, and the steep bare gable.
- House narrowed slightly inside the OBB (v ±4.5 of ±4.9) so the gable reads taller-than-wide like the photo.
- A chimney on the rear wing near the junction, two small bushes at the front corners.

## Approximations / schema gaps

- No way to express peeling paint, a satellite dish, cornice returns or a gable vent; skipped.
- Boarded windows are approximated with plywood-coloured glass — a `boarded: true` window flag would be cleaner.
- Rear wing footprint/height are inferred from the overhead and one oblique; the `-v` and `+u` faces are guesses.
- `--compare` on `+v` at the brief's distance rendered from inside the neighbour; re-rendered closer.

## Confidence

- Footprint identity: high. Front elevation (2016): high. Sides/rear: low-medium. Whether it should exist in the diorama at all: coordinator's call (demolished c. 2017-2022).
