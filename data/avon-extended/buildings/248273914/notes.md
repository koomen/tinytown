# Notes — OSM 248273914 — 53 Prospect Street

## Identification (high confidence)
Pale-yellow vinyl-clapboard two-family house with dark-red shutters and tan/brown shingle roofs: a side-gabled 2-storey block on the south ~55% of the street front, fronted by a full-width one-storey porch on heavy timber posts on stacked-stone piers with two front doors (white left, dark red right); a 2-storey front-facing gable wing on the north ~45% with two shuttered windows up and a shuttered bay window down; a tall red-brick exterior chimney on the south wall at the back of the 2-storey block; a long one-storey rear wing running west and downhill toward the detached garage 248274489 (not modelled here). Identified from the head-on `+u` photo (9° off) and the `+v` photos, in which the same red shutters, tan roof and red chimney appear beside the barn-roofed garage.

Flag for the coordinator: the three `-v` photos are aimed at the neighbour 248273915 (the cream Victorian with the gabled turned-post porch, spindle railing and a 2-storey rear wing on a raised basement). Only the target's north gable peak peeks over the Victorian's roof in `-v_2`. Nothing from those photos was used except to confirm the target's main ridge runs N–S.

## Frame
OBB 16.1 m (u, E–W) × 10.8 m (v, N–S). Road face +u (E, Prospect St); left end of +u = +v = S. 2-storey block u [2.3, 8.1] × full v; gable wing v [-5.5, -0.4] projecting 0.15 m; bay window as a face feature (0.7 m out from the wing); rear wing u [-8.1, 2.3], v [-4.0, 4.4]. Lot falls 2.1 m to the west; no plinth added (the renderer carries the rear on a foundation).

## Photos used
- `front_248273914_+u.png` — head-on road face, fully legible (a pickup in the foreground only hides the lawn).
- `front_248273914_+v.png` / `+v_2.png` — SE views: south wall with the red chimney, one shuttered window per floor near the back of the block, the low rear wing and the garage beyond. `+v_2` is distant and tree-blocked.
- `front_248273914_-v*.png` — the neighbour; see flag above.
- `overhead_labeled.jpg` (label 3914) — rectangle confirmed, darker 2-storey roof at the street, lighter/lower roof to the west.
- No -u (rear) coverage; rear face invented and kept plain.

## Reading face by face
- **+u (street, 10.8 m)**: left 0–0.56: porch with a low hip roof of tan shingle on four timber posts on stone piers, deck floor ~0.3 m, two steps at ~0.27; behind it a white door at ~0.19, a dark-red door at ~0.35 and a shuttered window at ~0.46. Above, one small shuttered window pair at ~0.39 under the main eave (~5.6–5.8 m); the main roof slopes toward the street with its south gable end edge-on at the left. Right 0.56–1.0: the gable wing, wall flush with the block, gable peak ~2.3 m above the eave; two shuttered windows upstairs (~0.66, ~0.85 of the whole face), a 3-sided bay window with a little hip roof and flanking shutters at ~0.77 below.
- **+v (south, 5.8 m of 2-storey wall)**: tall red-brick chimney against the wall at the west end of the block, one shuttered window per floor toward the middle; the one-storey rear wing continues west under a lower tan roof.
- **-v (north)**: not visible (neighbour in front); plain 2+2 windows.
- **-u (west) and rear wing**: unseen; plain windows and a back door on each.

## What was modelled / exaggerated
- The cross-gable silhouette: side-gabled block plus a flush front gable wing, both in tan shingle.
- The heavy-post porch with tan hip roof and the two front doors in white and dark red (the two-family read).
- Dark-red shutters on every street-facing window, slightly larger than life.
- The bay window as a `faces[].bays` entry on the gable wing's `+u` face: 2.4 m wide, 0.7 m deep, three lights across the front, one narrow light each side, hip cap at 2.7 m (below the upper windows' sills).
- The red-brick chimney as a full-height volume on the south wall (rises to 9 m, above the 8.4 m ridge).

## Approximations / schema gaps
- The bay's sides are square, not canted, and the red shutters that flank the bay on the wall in the photo are omitted (shutters would attach to each of the three lights, not to the bay as a whole).
- Stacked-stone piers under the porch posts are not representable; posts are plain timber-coloured squares.
- Exterior chimney is a separate volume rather than a `chimneys` entry, so it stands 0.55 m proud of the wall.
- The gable wing overlaps the main volume by 0.15 m in u and 0.1 m in v to avoid coincident faces.
- Rear wing extent (u -8.1..2.3) and its openings are inferred from the OSM rectangle and overhead; the downhill exposed basement is not modelled.
- Render checks: `+u` compare is good. The `+v` render camera lands inside the large brick building to the south at every distance tried (34 m, 14 m), so the south face was only checked at the frame edge (chimney and shuttered windows visible, plausible).

## Confidence
High on identification, street face, colours and roof form; medium on the depth of the 2-storey block and the chimney position; low on the rear wing and the north/west faces.
