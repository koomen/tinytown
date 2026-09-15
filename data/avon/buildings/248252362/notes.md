# 38 South Avenue — OSM 248252362

## Identification (confidence: high)
Raised ranch / split-entry house set back from South Avenue behind a broad lawn with a straight asphalt drive to a garage under the right end. The grey SUV in the drive appears in the `+v`, `-v` and `+u` photos, tying them to the same building; the brief lists no neighbours within 10 m.

## Frame
OBB 12.9 m (u) × 11.2 m (v); +u bears 199° (SSW), +v 289° (WNW). Road face `+v` (South Avenue), left end (0) = -u = NNE. Plain rectangle footprint; one volume spanning the OBB. Lot rises ~1.2 m from the road face to the rear, so the brick lower storey reads as a half-buried basement at the back (left to the renderer's foundation; no plinth added).

## Photos used
- `front_248252362_+v.png` (10° off, 20 m) — the primary read; whole front visible above the small ornamental tree.
- `front_248252362_-v.png` — 174° off head-on, i.e. shot from the road side; duplicates the +v view (with Maps chrome). The true rear (`-v`) has NO photo.
- `front_248252362_+u.png`, `_2`, `_3` — oblique from the SSW/backyard side; the +u gable end is visible behind a large tree in `_2` (upper siding with two windows, lower storey with a window and a door), the rest is mostly the yard, shed and swing set.
- `front_248252362_-u.png` — target behind trees, only the front-left corner readable. `-u_2` and `-u_3` are aimed at the WHITE two-storey neighbour to the NNE (black shutters, red porch rail, green foundation, chimney) — not this house; ignored except to confirm the target's position in the background of `-u_3`.
- `card_248252362.png` for the frame.

## Reading face by face
- `+v` (road, 12.9 m): two storeys, lower storey red-brown brick, upper storey pale yellow vinyl siding, low-pitched gable roof with the ridge along the street, dark brown shingles, modest overhang, no chimney. Upper storey L→R: wide triple window (~0.2), small window (~0.49), window over the garage (~0.83). Lower storey L→R: window under the tree (~0.2), white front door at grade (~0.5), dark brown single garage door at the right end (~0.77). Dark brown window frames upstairs, white frames on the brick storey.
- `+u` (SSW gable end, 11.2 m): siding gable, two upper windows, one lower window toward the front and a door toward the rear (partly obscured; the lower-rear wall may be siding rather than brick — kept brick for simplicity).
- `-u` (NNE gable end): barely visible; inferred as the mirror of +u without the door.
- `-v` (rear): no photo; three upper windows, lower storey mostly below grade.

## What was modelled / exaggerated
- The two-tone split (brick below, yellow above) via `upperWall`/`split` at 2.75 m — the signature of the house.
- Very low gable (`maxH` 1.8 m over an 11.2 m span) with the ridge along the street.
- The garage door under the right end (`type: "garage"`, 3.0 m wide, dark brown) and the white front door beside it.
- The triple picture window enlarged to 2.8 m wide; the other windows kept fewer and larger than reality.
- Two bushes standing for the ornamental tree and shrub in front of the lower-left window.

## Approximations / schema gaps
- Front door lands at grade with one step; the real split-entry has a small stoop. Fine at diorama scale.
- +u lower-rear wall/door read from an oblique, tree-blocked photo; colours there are a guess.
- No rear photo; `-v` is generic.
- `render_bp.py +u` works (compare mostly shows trees in the photo); `-u` not rendered because its photos show the neighbour.

## Confidence
High on massing, roof, colours and the +v bay rhythm; medium on the +u face; low on -u/-v details.
