# Blueprint notes — OSM 248274488 — 84 Prospect St (Frontier telephone exchange)

## Identification
One-storey red brick Colonial Revival telephone-company building ("frontier" red sign in the front window, house number 84), immediately north of the Post Office (80 Prospect). Confidence: high — the building with the lunette gable and the frontier sign sits between the Post Office and the St. Agnes School house in every oblique shot, matching the OSM position.

## Frame
OBB 23.1 m (u) × 12.3 m (v); +u bears 103° ESE, +v 193° SSW. Road face `-u` (WNW, Prospect St); its left end (0) is NNE (-v). Post Office is off `+v`, gap 4.7 m.

## Photos used
- `front_248274488_-u.png` (head-on, 27 m) — mostly hidden by two trees and a van, but shows the big gridded window with stone sill, the frontier sign, the shuttered window and the brick.
- `front_248273904_-u_2.png` / `_-u_3.png` (photos aimed at the neighbour 248273904, but this building fills their right side, 40–47° oblique) — the best reading of the road face: gable pavilion with lunette, hip-roofed wing, sign, shutters, "84", round medallion, dark door at the Post Office end.
- `front_248274488_-v.png`, `-v_2.png` (oblique from NNE) — north side: long brick wall under the eave, small windows (one with an A/C), a rear entry with a stoop near the back; the gable end confirmed facing the road.
- `front_248274488_+v*.png` — `+v` and `+v_2` show the Post Office front (it blocks the south side); `+v_3` (70 m) is aimed at a pale-blue concrete-block building — the wrong target. Not used.
- `front_248274488_+u.png` (114 m) — the rear is hidden behind a tree and other houses. Not used.
- `overhead_labeled.jpg` — E-W ridge along the north half of the block, lower hipped south half.

## Reading face by face
- `-u` (road): left ~45 %: a steep gable end, cream trim/cornice returns, a half-round cream lunette in the gable over a wide multi-pane (glass block) window with a stone sill. Right ~55 %: a lower hip-roofed section under a cream cornice: red "frontier" sign, a small window with cream shutters (pine-tree cut-outs), "84", a round cream medallion and a dark door with a lamp/meter box at the far right (Post Office end). Brick everywhere, dark grey shingle roof.
- `-v` (north, 23 m): plain brick wall under the eave, 3–4 small windows (one with an A/C unit), a rear entry near the back end.
- `+v` (south): blocked by the Post Office; inferred plain with three small windows.
- `+u` (rear): not visible; inferred plain, two windows.

## What was modelled / exaggerated
- Full-length gable-roofed pavilion along the north half (steep pitch, cream lunette + one big gridded window) over a lower hip-roofed body — the two-roof silhouette is the signature.
- On the south half of the road face: the frontier sign (red board style), one shuttered window, a round "medallion" (round window with cream glass), dark door with lamp.
- Cream cornice on the hip body; mid brick red `#8e4b3f`, cream trim `#e6e0d0`, slate roof `#4b4e53`. Three bushes along the front.

## Approximations / schema gaps
- OSM's footprint has a notch at the road/+v corner (road face only 8.7 m); the photos show the hip wing coplanar with the gable end, so the block is modelled as the full 23.1 × 12.4 m rectangle. If the coordinator prefers the OSM outline, trim `main` to v ≤ 2.5 for u < 1.2 — but the front reads better as-is.
- The gable pavilion runs the full length so its rear gable end shows above the hip roof at the back — acceptable, matches the overhead's long E-W ridge.
- The lunette is a schema `arch` window (w 1.5, h 1.0); the real one is a true half-round. Shutter cut-outs, the "84" numeral and the A/C units are omitted. No cornice is drawn on the gable pavilion (cornice only exists for flat/hip/mansard roofs).
- `render_bp` at `--dist 30` lands very close for this deep block; `--dist 48 --height 2.5` gives a proper view of the road face.

## Confidence
Road face: high. North side: medium. South and rear: low (inferred). Roof form: medium-high (overhead + obliques agree).
