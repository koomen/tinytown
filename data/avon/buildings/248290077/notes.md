# 33 North Avenue — OSM 248290077 — notes

## Identification
Two-storey front-gable house at 33 North Avenue (house number "33" visible beside the red door in the road-face photo). Tan vinyl siding above a cream stucco first storey, steep front gable with a wide bracketed overhang, a one-storey cream stucco enclosed sun porch across the front, a set-back two-storey south wing with a red door, a brick chimney on the north wall, and a long white-railed wheelchair ramp to the red door. Confidence: high.

## Frame
OBB 14.7 m (u) x 13.7 m (v); +u bears 104° (ESE, road side), +v bears 194° (SSW). Footprint is an L: main block u -7.4..7.4, v -6.9..1.5 (north side, includes the porch), plus wing u -7.4..3.0, v 1.5..6.9 (south). The wing is set back 4.4 m from the road line. I put the main block's real wall at u=4.6 and treat u 4.6..7.4 as the sun porch. Flat lot.

## Photos used
- `front_248290077_+u.png` — the good frontal shot, read bay by bay.
- `front_248290077_-u.png` — labelled -u but is actually a second frontal (+u) view from 26 m; used as a second front reference. No true rear photo exists.
- `front_248290077_-v.png`, `_-v_2.png` — north side through trees: chimney, side door, windows, roof.
- `front_248290077_+v.png`, `_+v_2.png` — south side: wing gable end + porch side (mostly hedge). `_+v_3.png` is all trees, unusable.
- `card_248290077.png` for the L footprint. Overhead too coarse to read the roof.

## Reading face by face
- **+u (road)**: Right two thirds = main block, steep front gable (roughly 45°) with wide overhang; attic: one paired window centred in the gable; 2nd floor: two windows at ~0.27 and ~0.73; 1st floor hidden behind the sun porch. Sun porch: cream stucco, ~6.5 m wide, ~2.9 m to eave, low gable facing the road with a siding-coloured gable face and a band of 7 tall narrow windows. Left third = the set-back wing: red front door near its right end (~0.74), small 1st-floor window to the left, one 2nd-floor window (with AC unit) above-left, a fire escape stair and a flat hood over the door, and a white-railed ramp from the sidewalk. Chimney rises past the right (north) shoulder of the gable.
- **-v (north)**: Long side, ~14.8 m incl. porch. External brick chimney about 40% back from the front corner; 2nd floor: window front of chimney, window behind; 1st floor: small square window in front of the chimney, red side door behind it; rear end lower. Roof reads as the north slope of the front gable; a second peak further back in `_-v_2` suggests a rear cross gable — not modelled.
- **+v (south)**: Wing shows a gable end (ridge along v) with a window in the 2nd storey/gable; 1st floor hidden by hedge; porch's south side has two windows.
- **-u (rear)**: no photo; plain, two windows per storey.

## What was modelled / exaggerated
- Three volumes: `main-front-gable` (gable ridge u, pitch 0.5 capped 4.0 m), `south-wing` (gable ridge v dying into the main roof, lower ridge), `sun-porch` (low gable, band of 6 tall windows).
- Two-tone wall (`split` 3.1): cream stucco below, tan siding above — the house's most visible trait after the red door.
- Red door on the wing face and matching red side door on the north wall; chimney on the roof edge near the north eave.
- Fewer, larger windows than reality (7 porch windows → 6; paired attic window → one).
- Three bushes along the north for the driveway hedge.
- Wheelchair ramp (`details` type `ramp`): light grey deck (`#c9c4b8`) with white rails, 1.2 m wide, starting on the lawn at (u 9.5, v 4.2) — about 2 m in front of the sun-porch line and ~1.2 m left of the door as seen from the street — and climbing toward the wing (`dir` [-1, -0.22]) over 5.5 m to 0.5 m, then a 1.0 m landing at the red door. The door `y` was raised to 0.5 so it stands on the landing (its two steps still drop to grade beside it).
- Fire-escape stair (`details` type `stair`): red steel (`#8a3a32` treads, `#c23a32` rails), 0.8 m wide, left of the door at v 4.9; it descends perpendicular to the wall toward the street — starting at grade at u 6.2 and climbing toward -u over 2.8 m to 3.0 m with a 0.4 m landing at the upper wall (the AC-unit window / upper door). In the frontal photo the stair reads as a near-vertical red frame left of the door, which is this foreshortened run.

## Approximations / schema gaps
- The ramp and the fire-escape stair are now modelled as `details` (see above). The stair's orientation (perpendicular to the wall, descending toward the street) is a read from a single frontal photo — medium confidence; its solid stepped block is heavier than the real open steel stair. The flat door hood is still skipped.
- Chimney sits on the roof near the eave rather than as an external wall stack.
- Possible rear cross gable seen in `_-v_2` left out (uncertain; rear unphotographed).
- Front-gable bracket/pent details not modelled.

## Confidence
Identification high; road face and massing high; north face medium (through trees); rear low (unphotographed, kept plain).
