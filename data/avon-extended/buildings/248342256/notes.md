# 248342256 — 68 North Avenue

## Identification
Two-storey slate-blue gable-ell house (blue clapboard below, darker blue-grey shingle above), white trim, steep dark-grey roofs, full-width open front porch on a high floor with white posts, railing and lattice skirt, red rocking chairs. Confidence: high. The frontal `+u` photo (18 m, 5° off) is centred on it, though the street maple hides the upper half; the `-u` capture (168° off, i.e. a second near-frontal view from 39 m) shows the whole front clearly. Neighbour bearings agree: the pale colonial to the SSW is 60 North (248342255); the grey colonial to the NNE is the next house up the street, not a target.

## Frame
OBB 20.2 m (u) × 12.7 m (v); +u bears 285° WNW (road face), +v 15° NNE. Fraction 0 on the road face is the +v (NNE) end. Footprint is an L: front block u [-1.2, 10.1] × v [-2.5, 6.4] and a rear block u [-10.1, -0.1] × v [-6.4, 2.0] offset 3.9 m toward 60 North. Lot slopes 1.5 m (high on the 60 North side, low at the NNE rear); no plinth added.

## Photos used
- `front_248342256_+u.png` — frontal; porch, steps at the left end, door, side (+v) door with railing and lamp post visible; roof hidden by the tree.
- `front_248342256_-u.png` — actually a near-frontal view of the road face from further out: full porch, second-storey window, and the rear block's street-facing gable end (attic window, two narrow windows, one ground-floor window) peeking out to the right of the front block; detached garage behind.
- `front_248342256_-v.png`, `_-v_2.png` — from the SSW: the SSW gable end with an attic window, second-storey windows, the porch corner with the flag; 60 North fills the right half.
- `front_248342256_+v.png`, `_+v_2.png` — from the NNE, oblique, mostly the grey neighbour and the tree; the target's NNE side with the side door and steps is glimpsed.
- Overhead: 2255/2256 lie outside the labelled crop; the roof forms were read from the obliques.

## Reading face by face
- **+u (road, WNW)**: full-width open porch, floor ~0.9 m up on a white lattice skirt, 4–5 steps at the far left (NNE) end, white square posts and railing. Front door left of centre (~0.33) with a storm door; a wide window to the right (~0.72); red rockers. Second storey: two windows (over the door and over the window). Roof: a steep gable whose ridge runs parallel to the street, so from the street you see the slope; the SSW gable end shows obliquely. To the right, set back ~11 m, the rear block's gable end faces the street with an attic window, two narrow second-storey windows and one ground-floor window.
- **-v (SSW, toward 60 North)**: the front block's gable end with a small attic window and two second-storey windows; the rear block's long eave side beyond it, with windows on both storeys (mostly behind the driveway tree).
- **+v (NNE)**: front block side with a white side door, steps and railing near the street end, a window toward the rear, two upstairs; attic window in this gable end too.
- **-u (rear, ESE)**: not photographed; the rear block's gable end with a back door and steps was assumed.

## What was modelled / exaggerated
- Front block 11.3 × 8.9 m, eaves 6.2 m, steep gable (`ridge: v`, maxH 4.0), two-tone wall (`split` 3.3) for the shingle upper storey; attic windows in both gable ends.
- Full-width open porch (floorH 0.9, 4 posts, railing, 5 steps at fraction 0.1, shallow hip roof), door at 0.33, one big window at 0.72.
- Rear block 10 × 8.4 m, eaves 6.0 m, gable ridge along u so its end faces the street beside the front block: attic window plus two narrow upper windows and one lower window on the exposed 3.9 m; chimney on its ridge.
- Side door with three steps on the +v face; three bushes in front of the porch.

## Approximations / schema gaps
- Roof orientation of the front block is the main uncertainty: the near-frontal `-u` capture shows a gable peak toward the SSW end of the front, and the `-v` captures show an attic-window gable end facing SSW, which fits a ridge parallel to the street; the tree-blocked frontal and the oblique `+v` capture could also be read as a street-facing gable. If the coordinator has a clearer photo, flipping `ridge` to `u` and moving the attic window to the `+u` face is a one-line change.
- The `-v` face cannot be rendered from outside: the 4.6 m gap to 60 North puts the `--dist 14` camera inside the neighbour's roof; a 7 m attempt was made for a partial check. The `+v` render at 30 m also lands close to the wall.
- Vinyl/shingle texture, the lattice skirt, red rockers, lamp post and detached garage are not modelled (the garage is a separate OSM building if any).

## Confidence
High on the road face (porch, high floor, door/step positions, colours, rear gable peeking out); medium on the roof orientation and side faces; low on the rear.
