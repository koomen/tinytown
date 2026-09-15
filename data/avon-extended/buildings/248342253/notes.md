# 248342253 — 54 North Avenue

## Identification
Olive-green clapboard American Foursquare with cream trim on the west side of North Avenue, between 48 (pale blue side-gabled house, SSW) and 60 (tan side-gabled Colonial with dark shutters, NNE). Broad hip roof with a wide eave, a hipped dormer with paired windows centred on the front slope, brick chimney near the ridge, full-width hip-roofed open porch with three square cream posts and a solid siding half-wall, steps down the NNE (driveway) end, a clipped hedge across the porch front. Confidence: high (the neighbours in every photo match the brief; the red RAV4 in the driveway ties the +u, +v and -v shots together).

## Frame
OBB 14.3 m (u) x 9.1 m (v); +u = 285 deg (road face), +v = 15 deg (toward 60 North, driveway side). Rectangle footprint; the whole footprint sits under one hip roof (ridge along u, the long axis), so a single main volume spans the OBB. Flat lot.

## Photos used
- `front_248342253_+u.png` (18.2 m, 15 deg off) and `front_-u.png` (which is a second, farther shot of the same road face from the street, not the rear): primary read.
- `front_+v.png` (66 deg off) for the NNE/driveway side; `+v_2` / `+v_3` are mostly the neighbour at 60 North and a street tree, used only to confirm the side door.
- `front_-v_3.png` (38 deg off) for the SSW side (bay window, window rhythm); `-v.png` / `-v_2.png` add little (tree, utility pole, 48 North in the foreground).
- The overhead crop does not cover North Avenue; roof form read from the obliques (one hip roof, no rear wing).

## Reading face by face
- **+u (road, 9.1 m, left = NNE)**: two tall storeys, wide boxed eave. Upper: two 1/1 windows at ~0.23 and ~0.66 (both left of the right edge, leaving a blank strip at the right). Hipped dormer with a pair of windows centred slightly left of the middle; brick chimney behind it near the ridge. Ground: full-width open porch, hip roof, three square posts (ends + one near the middle), solid siding half-wall with a cream rail, steps at the far left end toward the driveway. Dark front door at ~0.3 with cream surround; wide triple window at ~0.7. Hedge of round clipped shrubs along the porch front. Colours: olive-grey siding, cream trim, medium grey shingles, grey porch deck.
- **+v (NNE / driveway, left = rear)**: side door with a small stoop toward the rear (~0.18), a window beside it, more windows toward the front; upper storey windows over roughly the same bays.
- **-v (SSW, left = street)**: three upper windows in an even rhythm; ground: one window mid-face and a small box bay window with its own little hip hood toward the rear (~0.78).
- **-u (rear)**: not visible from the street; kept plain (two windows up, window + door down).

## What was modelled / exaggerated
- One hip-roofed volume 14.3 x 9.1 m, eaves 6.4 m, ridge 2.9 m above the eaves, 0.6 m overhang; chimney at u 0.6 / v 0.4.
- Front dormer as `roof.dormers` on the +u slope (at 0.46, one 1.8 × 1.0 m mullioned window standing in for the pair, sill 0.5 m above the eave, gable cap).
- Full-width open porch (hip, 3 posts, railing, 4 steps at 0.1 = the driveway end), dark door at 0.3, one wide 2.3 m window at 0.7.
- Four bushes in a row along the porch front for the hedge.
- Side box bay on -v as a `faces["-v"].bays` entry (at 0.76, 2.2 × 0.8 m, raised y0 0.5 → y1 2.9 with a skirt board, hip hood, one 1.5 m window, side lights).
- Side door with steps on +v toward the rear.

## Approximations / schema gaps
- The dormer and the side bay are now real schema features (`roof.dormers`, `faces[].bays`); the dormer's cap is a small gable rather than the real hip, and its window pair is one wide window.
- The porch's solid half-wall is rendered as a baluster railing; the real steps descend sideways off the NNE end rather than forward.
- Side-face compare renders are blocked by the neighbours' generic boxes (gaps 7-9 m); sides checked with `--iso` only.
- Rear face inferred.

## Confidence
Road face: high. Sides: medium. Rear: low.
