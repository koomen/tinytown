# Blueprint notes — OSM 248273904 — Saint Agnes School house, Prospect St

## Identification
Two-storey white clapboard Greek Revival house with a monumental two-storey four-column portico across the road face, low hip roof with a deep entablature, stone foundation; the red "SAINT AGNES SCHOOL" lawn sign stands right of the front walk. It is the parish/school office between the Frontier building (84 Prospect, to the south) and the St. Agnes church parking lot (north). Confidence: high — the head-on `-v` photo and every oblique show this house at the OSM position.

## Frame
OBB 13.3 m (u) × 23.7 m (v); +u bears 15° NNE, +v 105° ESE. Road face `-v` (WNW); its left end (0) is NNE (+u). No neighbours within 10 m. Footprint notch: the rear 3.5 m (v 8.3..11.8) exists only on the +u half.

## Photos used
- `front_248273904_-v.png` (head-on, 22 m) — portico, centred door with transom and 7-step grey stair, ground-floor windows either side, lattice fence and arched canopy on the north side; upper floor mostly behind trees.
- `front_248273904_-u.png`, `-u_2.png`, `-u_3.png` (from the SSW, 40–56° oblique) — the four round columns (two columns + corner pilasters), the entablature, hip roof, stone foundation with lattice, blue-grey shutters, the side door with a stair at the junction with the one-storey rear part, the rear part and the detached garage behind.
- `front_248273904_+u.png`, `+u_2.png` (from the NNE) — the +u side: 2 + 1 ground windows (front one shuttered), 4 upper windows incl. a small one, a side door under an arched metal canopy near the portico, two small stacks on the roof, a one-storey hip-roofed rear wing with a flue and three windows, flush with the +u face.
- `+v`: no coverage; inferred from the overhead (hip main roof ~15 m deep, lower rear section, narrower gabled tail on the +u half).

## Reading face by face
- `-v` (road, 13.3 m): full-width recessed portico, columns at the front plane; ground floor: door at centre (transom, white surround), one shuttered window either side; upper floor: three windows. Entablature band continuous across the top; hip roof above with two small stacks/finials.
- `+u` (NNE, long side): 2 storeys, ground 2 windows + shuttered front window, side door with canopy about two-thirds toward the front; upper 4 windows. One-storey rear wing flush with this face, hip roof, flue, 3 windows.
- `-u` (SSW): 2 storeys of 3–4 windows; side door with 4–5 steps and railing at the junction with the rear one-storey part; stone foundation with lattice panels under the portico end.
- `+v` (rear): not seen; plain, a window on the wider part, a door and window on the tail.

## What was modelled / exaggerated
- Portico: `open` porch across the full road face, `d` 2.4, four cream posts, flat trim-coloured roof at 7.0 m so it reads as the entablature; the main body is set back 2.4 m (v -9.4) so the porch's front edge is the OSM front line — i.e. the recess is real, not a bump-out. Wide grey stair (6 steps) centred on the door.
- Deep cream cornice (0.75 m) as the frieze, stone-grey plinth 1.0 m, one chimney stack, blue-grey shutters `#9aabb7` on the front and front-side ground windows.
- Rear: one-storey hip-roofed section (full width) then a gabled tail on the +u half, both with a lower plinth. Red lawn sign `SAINT AGNES SCHOOL` at (u -3.6, v -15.5) facing the road, three bushes in front.
- Colours: wall `#e9e7df`, trim `#f4f2ec`, roof `#55585c`.

## Approximations / schema gaps
- Porch posts are slim square posts; there is no column width/round option, so the columns read thinner than the real 0.6 m Doric shafts. A `postW`/round-column option would help this and other Greek Revival fronts.
- The portico's corner pilasters, the arched metal canopies over the side doors, the lattice under the porch, and the second roof stack are omitted.
- The sign rotation: `rotation: 0` faces the road here (-v); π showed the back of the board.
- `render_bp --dist 30` puts the camera between the columns; `--dist 55` for `-v`/`+u`, `--dist 32` for `-u` (dist 55 landed inside the church).

## Confidence
Road face and NNE side: high. SSW side: medium-high. Rear: low (overhead only). Overall silhouette (portico + hip + rear wing): high.
