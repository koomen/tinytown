# Blueprint notes — OSM 248252384 (51 West Main Street)

## Identification (confidence: high)
51 West Main Street, the greige clapboard two-storey house with a "51" on the porch frieze, second in the row of houses along the SW side of West Main (overhead label 2384), between the corner house 248252380 (NW) and the white Gothic-trimmed house 248252391 (SE). The front gable's tall round-arched window with green shutters is unmistakable in every photo that shows it.

## Frame
OBB 17.6 m along u × 8.7 m along v. `+u` bears 37° NE and is the real front (gable end + porch toward West Main). `-v` (307° NW) is the pipeline's road face (South Ave) but faces the neighbour 248252380 across a 4.9 m gap; `+v` faces 248252391 across 3.9 m. Lot drops ~1.5 m toward the SW; left to the renderer.

## Photos used
- `front_248252384_+u.png` — head-on front, 20 m, the primary read (right half behind the maple).
- `front_248252384_+v.png`, `_+v_2.png` — oblique from West Main to the SE: show the front gable, the exterior stair and balcony door on the `+v` side, the flag, and the porch steps at the NW end. `_+v_2` is mostly a street tree.
- `front_248252380_+u.png`, `_+u_2.png` (neighbour's brief) — 51 is the LEFT house; clearest view of the arched window + shutters and the porch.
- `front_248252384_-v.png` — NOT this building: it shows 248252380's wrap porch and South Ave wall (248252380 stands between the camera and 51). Flag for the coordinator.
- `front_248252384_-u.png`, `_-u_2.png`, `_-u_3.png` — from South Ave: `_-u_2` shows the rear of 51 as a plain tan gable end behind 248252380's sun porch; the others show 248252380 or a garage.

## Reading face by face
- `+u` (front, 8.7 m, left = SE): two storeys, steep gable end, dark grey roof, greige clapboard, white trim. Upstairs: a tall round-arched window with a white fan head and dark green shutters left of centre (~0.38), a rectangular window with green shutters at ~0.76. Full-width open porch on a ~0.7 m floor, white posts and railing, shallow hip roof, "51" on the frieze; steps at the right (NW) end where the path arrives. Behind the porch: window left, dark door with screen door at centre, window right.
- `+v` (SE side, 17.6 m, left = SW): an exterior wooden stair climbs from the rear toward the front to a second-floor white door with a small balcony and an American flag, under a small cross gable near the front corner; ground windows behind it. Rest of the side plain with a few windows.
- `-v` (toward 248252380): not visible; plain with windows and a side door inferred.
- `-u` (rear): plain gable end, two windows per storey inferred.

## What was modelled / exaggerated
- Single main volume, gable ridge along u, pitch 0.45 (steeper than the neighbour's), eaves 6.4 m.
- Arched window enlarged to 1.3 × 2.4 m with green shutters and a sill — the signature; second green-shuttered window beside it.
- Full-width open porch, dark green-grey floor, white posts/railing, steps at 0.8.
- A `stair-gable` volume protruding 0.6 m on the `+v` side near the front with a cross gable and a second-floor door at y 3.4 standing for the stair landing; a flag detail at the front `+v` corner.

## Approximations / schema gaps
- No exterior staircase or balcony in the schema: the upper `+v` door floats on the wall (lint warns about `y` = 3.4; intentional).
- "51" house number not modelled (no sign type small enough for a porch frieze).
- `+v` cannot be rendered with `render_bp.py` at any distance — the camera lands inside 248252391 (gap 3.9 m); checked only via the front render.
- `-v` and `-u` window layouts are inferred.

## Confidence
Identification high; front elevation high; `+v` stair/gable medium (oblique photos only); `-v`/`-u` low.
