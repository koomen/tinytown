# Blueprint notes — OSM 248252373 — detached garage beside 20 South Ave

## Identification (confidence: medium-high — FLAG for the coordinator)
OSM tags this `building=house` (generic style: 2 floors, butter walls), but every photo shows a single-storey
detached two-bay GARAGE at this spot: gable end to the road, black asphalt shingles, bare OSB sheathing under
torn white housewrap, concrete-block base, both bays open (no doors). Position checks out: it is 3.3 m NNE of
house 248252370 (20 South Ave) across that house's driveway, exactly where the brief puts the neighbour, and in
the `-u` photo the white house with the "20" stair is to the right (= +v = SSW) of the garage as expected.
The cream/butter 2-storey house at the left of the `-v` photos is the NEXT house north (outside the 10 m
neighbour list), not this building — the generic "butter" style probably came from it.
The OSM footprint (10.5 × 9.6 m) looks generous for the garage in the photos (~7–8 m wide) but was kept.

## Frame
OBB 10.5 m (u) × 9.6 m (v); +u bears 122° ESE (rear), +v 212° SSW (toward house 248252370). Road face `-u`
(WNW, South Avenue); left end (0) = `-v` = NNE. Single volume spanning the OBB. Lot rises 2.8 m to the rear.

## Photos used
- `front_248252373_-u.png` — road face, 18° off head-on: the garage front with both open bays, centre pier,
  torn wrap on the gable, house 248252370 to the right. Primary.
- `front_248252373_+v.png`, `_+v_2.png` — SSW side seen from the driveway / road: long black roof, OSB side
  wall with white wrap remnants; 20 South Ave at right.
- `front_248252373_+u.png` — from the rear driveway: the gable end, OSB and block, a white shed further back
  (a different structure).
- `front_248252373_-v.png`, `_-v_2.png` — the garage's roof at centre-right behind bushes; the cream house
  at left is the neighbour to the north, not this building.
- `_+v_3.png` — trees only.

## Reading face by face
- `-u` (road, 9.6 m): one storey, eaves ≈ 2.5 m, shallow-to-moderate gable (~25°), overhanging rake. Two open
  vehicle bays either side of a centre pier; white housewrap on the gable triangle and piers with OSB showing
  through; block foundation.
- `+v` (SSW, driveway side): blank OSB/white-wrap wall on a concrete-block base, no openings seen.
- `-v` (NNE) and `+u` (rear): not clearly seen; kept blank.
- Roof: black asphalt shingles, ridge along u (perpendicular to the road).

## What was modelled / exaggerated
- Low gable-front box, ridge along u, near-black roof (#45464a) with a 0.35 m overhang.
- Two wide, dark `garage` doors (panels 0, no lights) standing in for the open bays.
- Tan OSB walls (#b0956f) with a pale-grey wrap-coloured gable (`gableColor`) and a grey block plinth (0.4 m).

## Approximations / schema gaps
- No way to model a truly open bay (a recessed dark void); the garage-door type still draws a few grooves.
- No per-face wall colour (lint rejects `faces.+v.wall`), so the white-wrapped side reads as OSB tan too.
- Footprint kept as in OSM even though it looks ~30% larger than the real garage.
- Render at `--height 2.5` put the camera in the sloping terrain; `--dist 24 --height 6` works.

## Confidence
High that a garage, not a house, stands here; medium on dimensions (OSM footprint), high on roof form and
materials. If the coordinator would rather keep OSM's "house", this draft should be dropped, not merged.
