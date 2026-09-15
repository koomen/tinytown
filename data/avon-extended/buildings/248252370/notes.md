# Blueprint notes — OSM 248252370 — 20 South Ave

## Identification (confidence: high)
Narrow two-storey gable-front house, pale grey-white vinyl siding, white trim, dark grey shingle roof,
number "20" on the stair newel. Confirmed by the `-u` photo (5° off head-on, 6.8 m out) and by the
`-v` photos, where the open garage (neighbour 248252373) sits in front of this house's deck stairs,
matching the brief's 3.3 m gap off face `-v`.

## Frame
OBB 13.5 m (u) × 7.2 m (v); +u bears 107° ESE (rear), +v 197° SSW. Road face `-u` (WNW, South Avenue);
its left end (fraction 0) is `-v` = NNE = the driveway / garage side. Single rectangular volume spans the OBB.
Ground rises 2.8 m toward the rear (+u) corner; floor set at street level along `-u`, per the brief.

## Photos used
- `front_248252370_-u.png` (primary) and `front_248252370_+u.png` — the latter is 178° off head-on, i.e.
  it is actually another shot of the road face from the street, not the rear. Both show the same elevation.
- `front_248252370_-v.png`, `_-v_2.png`, `_-v_3.png` — NNE side, mostly hidden by the garage and trees; the
  raised white deck, its picket railing, lattice skirt and the road-facing stair are visible in `-v.png`.
- `front_248252370_+v.png`, `_+v_2.png` — SSW side, completely tree-blocked (`+v_2` shows the road and a
  white one-storey building further south, not this house). Face inferred.
- No true rear (+u) photo; kept plain.

## Reading face by face
- `-u` (road, 7.2 m): two storeys under a steep gable (ridge ≈ 3.3 m above the eave, ~45°), boxed eaves with
  small returns. Two bays: 1/1 double-hung windows at ≈0.31 and 0.69 on both storeys, upper pair a little
  smaller. No door, no porch, no chimney. A large butterfly bush and low shrubs at the base.
- `-v` (NNE, 13.5 m, left = rear): raised deck ~1 m above the driveway near the road end, white picket
  railing, white lattice skirt, white stair descending toward the road at the road-end corner; entry door onto
  the deck. Upper storey shows small 1/1 windows; ground storey one or two windows toward the rear.
- `+v` (SSW): inferred — three windows per storey, same rhythm.
- `+u` (rear): inferred — one window per storey and a back door with two steps.
- Roof: dark grey asphalt shingles; a small vent on the ridge, no chimney.

## What was modelled / exaggerated
- Tall, skinny gable-front proportions with a steep roof (pitch 0.46, maxH 3.3) — the signature.
- Two stacked bays of large windows on the road face, no door — as in life.
- The white side deck as an `open` porch on `-v` (range 0.64–0.98, floorH 1.0, railing, 5 steps at 0.93)
  so the white railing and stair read from the road.
- Two bushes at the road face.

## Approximations / schema gaps
- The real deck is UNCOVERED; the schema's open porch always builds a roof, so it is modelled as a
  low flat-roofed porch (height 2.3). A roofless deck option (`roof: "none"`) would fix this.
- The real stair runs PARALLEL to the wall toward the road; the schema's steps go straight out from the
  porch edge (into the driveway).
- `+v` and `+u` openings are guesses.
- Renders: `-u` at `--dist 30` compares well; `-v` needed `--with 248252373 --dist 22 --height 6` because a
  default camera lands inside the (generic) neighbour.

## Confidence
High on identity, road-face elevation, roof form and colours. Medium on the deck geometry (door position,
deck extent along the side). Low on `+v` / `+u` openings.
