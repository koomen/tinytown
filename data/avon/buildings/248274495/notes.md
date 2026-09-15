# 248274495 — 52 West Main Street — DEMOLISHED (placeholder only)

## Identification
The building no longer exists. Confidence high.

- `front_248274495_+u.png` (18 m out, 7° off head-on to this footprint, Aug 2025) has, at the centre of frame, a gravel drive, a dumpster and a grassy scrub slope. The blue gable-front house at the right edge is numbered "46" (readable in `front_248274495_-v.png`) and is centred in `front_248274497_+u.png`, so it is 248274497.
- Calibration: Puppy's Bar (`front_248274494_+u.png`) is centred correctly by the same capture procedure, and the render of this footprint from the same camera puts 46 in the same relative place as the photo does.
- `front_248274495_-u.png`, `-u_2`, `+v`, `+v_2` (from across the street) all show the same gap between Puppy's (58) and 46: gravel lot, dumpster, no structure.
- The Esri overhead tile (`overhead_labeled.jpg`, label 4495) also shows bare gravel under the footprint.
- The style-pass note ("derelict duplex, deemed not habitable, sold 2023 … only a light blue-grey side wall visible") fits: the house was torn down after the sale, and the "side wall" it saw is the NW wall of 46.

## Frame
OBB 14.7 (u) × 6.5 (v); +u = road face (SW, 214°), left end (0) = NW. Lot slopes 2.8 m. Not used for anything except placing the placeholder.

## Photos used
All seven fronts plus `sv_248274495_a/b/c.png`, `card_248274495.png`, the overhead. None shows a building on this footprint.

## Reading face by face
Nothing to read: empty lot (gravel drive on the NW part shared with Puppy's, grass slope on the SE part, dumpster near the drive).

## What was modelled
A placeholder so the footprint does not render as the generic 2-storey blue-grey gable house: one 2 × 1.8 × 1.5 m dark-green box where the dumpster stands (the linter requires at least one volume ≥ 1.5 m) and two scrub bushes. The renderer still draws its lot slab under the footprint, so from the road it reads as a grey pad with a bin on it.

## Approximations / schema gaps
- The schema has no way to say "no building"; the right fix is for the coordinator to drop this footprint from the site (or mark it demolished) rather than merge this file.
- Lint warning "volumes cover only 5% of the footprint" is intentional.

## Confidence
High that 52 W Main is gone (Aug 2025 imagery). The placeholder is a stopgap; recommend removal.
