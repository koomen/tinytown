# 67 West Main Street — OSM 249594583

## Identification (confidence: high)
Although addressed on West Main, the house fronts South Avenue just north of the 75 West Main (red, metal-roofed, `249594582`) lot. Pale cream clapboard, two storeys, mauve-pink shutters throughout, a taller square Italianate-style block at the SW end with pedimented low gables and deep eaves, a small hip-roofed porch with thin black iron posts, and a lower gabled wing running NE with a bay window and a hedge under it. The "67" house number is visible on the porch in `+v_2.png`.

## Frame
OBB 13.4 m (u) × 9.1 m (v); +u bears 36° (NE), +v 126° (SE). Road face `+v` (South Avenue), left end (0) = -u = SW. Footprint is a slightly skewed quad (the front edge runs from v=4.5 at the SW corner to v=3.2 at the NE corner); modelled as a full-depth tower at u∈[-6.7,-1.7] and a wing at u∈[-1.7,6.7] whose front is set back to v=3.9, plus a 0.65 m-deep bay window as a `faces[].bays` entry on the wing's `+v` face. Flat lot.

## Photos used
- `front_249594583_+v.png` (16° off, 7 m, fov 80) and `+v_2.png` (38° off) — main reads of the street face and porch.
- `front_249594583_+u.png` (35° off) and `+u_2.png` (6° off, head-on) — NE gable end of the wing, the tower roof behind it.
- `front_249594583_-u.png` (59° off) and `-u_2.png` — SW side: plain clapboard wall of the tower, a white-framed carport lean-to, the tower's two pediments. `-u_3.png` is dominated by a white house in the foreground (the neighbour to the SW, not the target); the target is small in the background.
- `front_249594583_-v*.png` — all three are aimed at the red 75 West Main building; the target shows only as a pale wall with one pink-shuttered window behind it (`-v.png`, far left). Rear treated as plain.
- `card_249594583.png` for the frame.

## Reading face by face
- `+v` (road, 13.4 m). Left ~5 m: the tower — upper storey one shuttered window centred; a low gable/pediment facing the street with a very deep boxed eave; a hip-roofed open porch across its full width on a ~0.5 m slab with thin black iron posts and iron railing, steps at its right end (and another set at the left onto the gravel drive), a dark front door about 0.6 across the porch, a diamond-shaped ornament and a window with blue stained-glass panes beside it. Right ~8.4 m: the wing — upper storey two shuttered windows (~0.2, ~0.66 of the wing), lower storey one shuttered window (~0.2) and a shuttered projecting bay window (~0.68) with a small shingled cap; gable ridge along the street, eave just above the upper windows; low hedge under the bay.
- `+u` (NE gable end of the wing, 9.1 m): clapboard gable, no upper windows, two shuttered windows below (~0.3, ~0.75 from the road side); shrubs along the base.
- `-u` (SW end of the tower): plain clapboard with a pediment above; a white-frame carport lean-to at ground level (not modelled). One shuttered upper window assumed.
- `-v` (rear): not visible; a shuttered window per storey and a back door assumed.

## What was modelled / exaggerated
- The tower: taller eave (6.9 m vs 5.6 m) with two crossing low gables (`ridge: "v"` volume + an overlapping `ridge: "u"` volume) and a 0.6 m overhang so the pediments read from the street and from the SW.
- The porch: `style: "open"`, hip roof, dark posts/railing, floor 0.5 m, steps at the right end, dark door and blue-glass window behind it.
- Mauve shutters on every visible window (`shutters: "#b08a90"`), the signature colour.
- The bay window as a `faces[].bays` entry at 0.667 of the wing's street face: 2.4 m wide, 0.65 m deep, three lights across the front, a narrow light each side, hip cap at 2.9 m.
- Hedge under the bay and shrubs at the NE end as bushes.

## Approximations / schema gaps
- `roof.cross: true` renders a crucifix at the gable peak (church cross), not a cross gable — the cross-gable is done with an overlapping second volume instead (as in the 119 Genesee exemplar). Worth a note in the schema doc.
- The carport lean-to on the -u side and the diamond window on the porch are omitted; so are the mauve shutters that flank the bay on the wall (they belong to the bay as a whole, not to its three lights).
- Render notes: `--dist 30` from `+v` puts the camera inside the embankment across South Avenue (solid green); `--dist 20 --height 6` works. Every `-u` camera (dist 22 and 14) lands inside a neighbouring building's roof, so the -u compare is unusable; the +u render at `--dist 22` confirms the tower's cross gable and the wing gable end.

## Confidence
High on massing, roof forms, porch and colours; medium on exact window fractions on the wing (perspective-corrected by eye); low on the -u and -v faces.
