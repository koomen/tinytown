# 248252366 — house, South Avenue (west side, just north of 60 South)

## Identification
White clapboard two-storey Greek Revival-era farmhouse with black shutters and a tall green-painted foundation, a front-facing cross gable with cornice returns at the north end of the road face, and a set-back one-storey wing with a red-railed deck at the north end. No OSM address (the neighbour across/south is 60 South). Confidence high for the road face: `-v.png` is head-on at 6.9 m and `+v.png` (mis-labelled 180° off, i.e. also shot from the road) is the same face at 18 m; the black shutters and red deck identify the target in the oblique end photos.

## Frame
OBB 16.3 m (u) × 11.4 m (v); +u bears 17° (NNE), +v 107° (ESE). Road face `-v`; left end of `-v` = +u = NNE. Plain rectangle footprint; the wing is set back ~2 m from the road face so the blueprint splits it: block u∈[-8.2, 2.2] × v∈[-5.7, 4.2], wing u∈[2.2, 8.2] × v∈[-3.7, 4.2] (the OBB's 11.4 m depth is not fully used; nothing rear is visible). Flat lot.

## Photos used
- `front_248252366_-v.png` and `front_248252366_+v.png`: both from the road, the primary reads.
- `front_248252366_+u.png`: the NNE end — wing in front, blank 2-storey gable end behind, exterior chimney at the road corner.
- `front_248252366_-u.png`, `-u_2.png`, `-u_3.png`: the SSW gable end (one shuttered window per storey toward the road, cellar hatch at the base, green foundation) and the red shed behind.
- `front_248252366_+u_2.png`: blocked by trees. `front_248252366_+u_3.png`: aimed at the northern neighbour (white 2-storey gable-front house with a white lattice deck) — the target is the shuttered house further down the street; not used except to confirm the wing/deck position.
- Overhead: `overhead_labeled.jpg` does not extend to South Avenue, so roof forms come from the photos.

## Reading face by face
- `-v` (road, 16.3 m, left = NNE): from the left, the one-storey wing (eave ≈ 3.4 m, one shuttered window, a storm door onto the deck), the red-railed open deck with stairs down to the left filling the notch between wing and block, then the two-storey block. Block: four shuttered 6/6 upper windows in a row tight under the eave (fractions ≈ 0.17, 0.4, 0.65, 0.86), lower storey shuttered windows under the first two and a wide window at ≈ 0.83 (a bush hides ≈ 0.4). Over the left ≈ 45% a front-facing gable with cornice returns, peak near the main ridge; a grey exterior chimney rises at the block's NNE/road corner. Green foundation ≈ 0.9 m exposed; dark grey shingle roof.
- `+u` (NNE end): wing end with two shuttered windows under a low hipped roof; behind it the block's blank gable end; chimney at the right (road) corner.
- `-u` (SSW gable end): one shuttered window per storey toward the road side, cornice returns, cellar hatch.
- `+v` (rear): not photographed; kept plain with a back door.

## What was modelled / exaggerated
Three volumes: side-gabled block (eaves 6.4 m, ridge along u, maxH 2.7, 0.9 m green plinth), a front cross-gable volume u∈[-3.5, 2.25] × v∈[-5.75, 0.5] (ridge v, maxH 2.75) carrying two windows per storey and the chimney at (1.9, -5.2), and the hip-roofed wing (eaves 3.5 m). Windows 1.0 × 1.5 with black shutters everywhere; wide 1.7 m lower window at 0.83 on the block. The deck is an `open` porch over the wing's -v range [0.45, 1.0], d 2.0 (flush with the block face), floorH 0.9, red floor/posts/railing, 5 steps. Three bushes in front. Exaggerated: shutters, the green plinth, the cross gable and chimney, the red deck.

## Approximations / schema gaps
- Roofless deck: the `open` porch always builds posts and a roof, so the deck got a light-coloured flat roof at 2.3 m; the real deck is uncovered with a stair running sideways (modelled straight out).
- Cornice returns on the gables are not in the schema (plain gable ends).
- The exterior chimney is a roof chimney placed at the eave corner; it pokes up at roughly the right place.
- Rear face invented; the OBB's extra depth (v 4.2 → 5.7) is left empty.

## Confidence
High for the road face and massing; medium for the ends; low for the rear.
