# Blueprint notes — OSM 248288900 — 35 Temple Street

## Identification (confidence: high)
White clapboard upright-and-wing farmhouse with black louvered shutters, "35" over the porch door, American flag on the porch. The head-on `-v` photo (5° off) shows it centred; 33 Temple (brown-roofed, cream, hip porch) is the neighbour to the right (NNE, `-u` side, 2.6 m gap) and the stucco two-storey with navy trim in the `+u` photos is 248288899 (SSW, 6.7 m gap).

## Frame
OBB 11.5 (u) × 15.0 (v) m; +u = 196° SSW, +v = 286° WNW. Road face `-v` (ESE, Temple Street); left end (0) of `-v` is SSW (+u). Full-width front at v = −7.5; the rear (v > 1.9) narrows to u −5.8…2.1 (notch at the +u/+v corner). Flat lot.

## Photos used
- `front_248288900_-v.png` and `_+v.png` (the latter is 178° off, i.e. also taken from the street) — the main reads.
- `front_248288900_+u.png`, `_+u_2.png` — SSW gable end of the wing with the tall brick chimney, the wing's roof pitch, plain side windows; willows behind.
- `front_248288900_-u*.png` — 33 Temple and its porch fill the foreground; our upright's NNE side shows only as a sliver. Kept plain from the overhead.
- Overhead crop confirms the two blocks: deep upright at the NNE, wing at the SSW with the rear narrowing on the SSW side.

## Reading face by face
- `-v` (road): right ~5.2 m is the two-storey upright with the street gable (steep ~45°, small attic vent in the gable): 2 shuttered windows over 2 shuttered windows, eaves right above the upper heads. Left ~6.4 m is the two-storey side-gabled wing with lower eaves; upper: a shuttered window (with AC) at the left and a narrower shuttered pair right of centre; ground floor entirely behind a full-width screened open porch (slim square posts, very shallow hip roof, low rail), front door at the porch's right end against the upright, wide window(s) to its left. Concrete steps down to a straight walk. Light grey shingles, white walls, black shutters, dark door, flag.
- `+u` (SSW): wing gable end with a tall brick chimney on the front slope at the gable; plain windows (two upper, one lower toward the front); a low rear extension behind.
- `-u` (NNE): upright's long side; three bays upper, two lower — inferred.
- `+v` (rear): unseen; low gabled rear wing.

## What was modelled / exaggerated
Upright (u −5.8…−0.6, eaves 6.3, gable ridge v +2.6) with 2+2 black-shuttered windows and the gable vent; wing (u −0.6…5.8, eaves 5.4, ridge u +2.4, chimney at the SSW end) with the full-width open porch (`range [0,1]`, hip, railing, 3 steps at the door, floor 0.5 m), door with lamp, wide mullioned window behind the porch; low gabled rear block. Signature features pushed: the black shutters on every front window, the long shallow porch, the tall chimney, the flag (`details.flag` in the front lawn) and the hydrangea bushes.

## Approximations / schema gaps
- The porch is screened in reality (black frames); modelled as an open porch with a railing.
- Chimney sits on the ridge end rather than on the front slope (chimneys take only u/v).
- Wing upper "narrow pair" modelled as one 1.5 m mullioned window with shutters.
- Rear wing form is a guess (no photo).
- `render_bp +u` camera lands inside 248288899; checked the SSW side from bearing 150° instead (`render_248288900_150.png`), which matches the `+u` photos' viewpoint.

## Confidence
High on the front and massing; medium on the SSW side and chimney placement; low on the rear.
