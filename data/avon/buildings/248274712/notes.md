# 248274712 — 25 East Main Street (corner of Temple Street)

## Identification
White clapboard Italianate house at the SW corner of East Main and Temple, with a full-width square-post porch on East Main and a lower gabled wing running south along Temple that ends in a one-storey tail. Confidence: high — the `+u` photo (head-on from East Main) shows the porch front, the `-u` photos (from Temple, SSW) show the gabled wing, chimney, side porch in the notch and the bracketed pediment of the main block, and the `-v` photos (from East Main, NW) show the other pediment and the west wall. All photos show the same white house; none are aimed at a neighbour (the garage 248274713 appears with a green metal roof in the background of `+u`/`-u`).

## Frame
OBB 21.0 m along u (+u = 13°, NNE, toward East Main) × 16.1 m along v (+v = 103°, ESE, Temple Street). Road face `+v`; left end (0) on `+v` is the SSW (-u) end. Footprint is an L: full 16.1 m width for u in [-1.5, 10.5] (the East Main block), 10.8 m (v in [-8.1, 2.7]) for u in [-10.5, -1.5]; the notch at the -u/+v corner is where the side porch sits.

## Photos used
- `front_248274712_+u.png` — East Main front, head-on but half-hidden by two street trees: porch with square posts, glazed double door at centre with steps, tall windows either side, upper windows, low eaves roof.
- `front_248274712_-u.png`, `_-u_2.png` — from Temple SSW: steep-ish gable end of the south wing with a small attic window and two upper windows, one-storey hip-roofed tail in front of it, red brick chimney at the ridge where the wing meets the main block, side porch with a square post and a door in the notch, and the main block's bracketed low pediment with an arched attic window facing Temple, bay window on the ground floor beyond it.
- `front_248274712_+v.png` — Temple side, mostly oak canopy: one-storey bracketed bay window with hip cap, upper window above, glazed one-storey bay at the East Main corner, hedge along the sidewalk.
- `front_248274712_-v.png`, `_-v_2.png` — from East Main to the NW: porch front (left) and the west wall with two windows per floor and the low bracketed pediment with arched attic window over it.
- `card_248274712.png`, `overhead_labeled.jpg` (label 4712) for the L footprint.

## Reading face by face
- `+u` (East Main, 16.1 m): 2 storeys. Full-width open porch on a raised floor, square posts, low roof, 3–4 steps at the centre. Ground floor: glazed double door at centre, tall window each side. Upper: four tall 2/2 windows. Low gable roof (ridge along v) — from this side it reads as an eave with a deep bracketed frieze.
- `+v` (Temple, 21 m): left 9 m = the south wing (gable, 2 storeys, one-storey tail at the far left) and the notch porch; right 12 m = main block's gable end: bracketed pediment with an arched attic window, three upper windows, a bracketed one-storey bay window at ~0.55 of the block and a glazed one-storey bay at the East Main corner.
- `-v` (west): main block gable end with pediment and arched attic window, three windows per floor (photo shows two clearly, the third hidden by the porch). South wing and tail hidden by trees — kept plain.
- `-u` (south, toward 23 Temple): the wing's gable end with a small attic window and two upper windows above a one-storey hip-roofed tail; the notch porch (open, railing, side door) against the main block's south wall.

## What was modelled / exaggerated
- Main block 7.0 m eaves, low gable ridge along v (maxH 2.2), overhang 0.7, a 0.5 m trim-coloured belt course just under the eaves standing in for the bracketed frieze; arched attic window in both gable ends.
- Full-width East Main porch: 5 square posts, hip roof, floor 0.6 m, 3 steps at the centre, glazed double door, no railing (the photo shows none).
- South wing 6.0 m eaves, gable ridge along u (maxH 3.4), brick chimney at its junction with the main block; one-storey hip tail on the last 2.5 m.
- Notch side porch with railing and a dark side door.
- The two Temple-side bays are real `faces[].bays` on the main block's `+v` face: the bracketed one-storey bay at 0.55 (2.8 m wide, 1.0 m deep, one tall window on the front and one on each side, hip cap at 3.3 m) and the glazed corner bay at 0.895 (2.5 × 1.2 m, two front lights, side lights, hip cap at 3.2 m). Each bay carries its own ground storey; the wall windows behind them are skipped automatically.
- Hedge along Temple as six bushes.

## Approximations / schema gaps
- Gable roofs have no `cornice`/dentils, so the Italianate brackets are only suggested by the belt course; the bay window's bracketed cornice is just the bay feature's trim board under its hip cap (no dentils).
- Window counts reduced (4 upper on East Main, 3 on each gable end); the wing's tail and the west side of the wing are inferred (trees/hedge hide them).
- `render_bp` at `--dist 45` from `+v` lands the camera inside a neighbour; `--dist 30` worked. From `-u` the default camera sits very close (probably clipped by 23 Temple).

## Confidence
High on the massing, porch, pediments, chimney and colours; medium on the exact window positions on the west and Temple faces and on the tail's roof form.
