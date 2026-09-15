# 248288901 — 33 Temple Street

## Identification
33 Temple Street, a narrow tan 2.5-storey gable-front house between 35 Temple (white, black shutters, off +u) and 29 Temple (pale grey, red shutters, off -u). Confidence: high — the -v photo is head-on (12° off) and the -u photos show the same tan house with both neighbours in their expected places.

## Frame
OBB 7.6 m (u) × 16.0 m (v), plain rectangle, +u → 196° SSW, +v → 286° WNW. Road face -v (Temple St); left end of -v = +u = SSW (toward 35 Temple). Flat lot (0.7 m fall front→back, ignored).

## Photos used
- `front_248288901_-v.png` — the main read (partly behind a tree and a pole, but the whole facade is visible).
- `front_248288901_-u.png`, `_-u_2.png`, `_-u_3.png` — 57°/41°/31° off; show the side, the rear cross gable, the hooded side door, the stone foundation and the chimney.
- `front_248288901_+u.png`, `_+u_2.png` — dominated by the neighbour 35 Temple; the target is only the brown roof behind it. Used only to confirm roof colour and the front gable.
- `front_248288901_+v.png` — 174° off head-on (looks at the front), not usable for the rear.
- `overhead_labeled.jpg` label 8901 — narrow deep rectangle, ridge along the long axis.

## Reading face by face
- **-v (street, 7.6 m)**: full-width one-storey open porch, brown low hip roof, cream square posts and a cream railing, ~5 steps up at left-centre to a white storm door (~0.4); one window right of the door (~0.75). Second storey: two windows (~0.3, ~0.7). Attic: the gable end is clad in dark brown shingles with one small window at centre. Tan vinyl siding, cream trim, dark brown roof.
- **-u (side toward 29 Temple, 16 m)**: two storeys of tan siding over a grey stone foundation; windows in a loose 3+3 rhythm; a small brown hip/gable-hooded side door about a third of the way back; a cross gable with a small attic window over the rear half; a brick chimney near the ridge at the rear.
- **+u**: not visible (hidden by 35 Temple); plain windows inferred.
- **+v (rear)**: no photo; plain back door and windows inferred.

## What was modelled / exaggerated
- Main volume 7.6 × 16 m, eaves 6.3 m, gable ridge along v, ridge +3.7 m, dark brown roof, `gableColor` brown so the street gable reads as the shingled brown "hat".
- Full-width open hip porch (`style: "open"`, floorH 0.8, 4 posts, railing, 5 steps at the door) with the door at 0.4 and one window at 0.74; two upper windows; one attic window — slightly larger than life.
- Rear cross gable (ridge u, v 1.6–7.6) with attic windows both sides; chimney; stone plinth 0.6 m; gabled entry hood over the -u side door; two bushes flanking the front walk.

## Approximations / schema gaps
- The attic may actually be a gambrel/clipped form behind the tree; modelled as a plain steep gable with a brown gable face.
- Side-door hood is a gabled entry box (the real one is a tiny hip hood).
- `-u` compare render was blocked twice by the generic roof of 29 Temple (camera lands inside it at dist 30 and 28/height 14); checked the side and roof form with `--iso` instead.
- The rear and +u faces are guesses.

## Confidence
High on identity, front elevation, porch, colours and roof form; medium on the side rhythm and the cross gable extent; low on the rear.
