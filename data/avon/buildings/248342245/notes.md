# 248342245 — 24 North Avenue

## Identification
2.5-storey gable-front frame house (c. 1900, Folk Victorian / early Foursquare feel): tan clapboard body, barn-red shingled gable, butter-yellow trim, full-width open front porch. The house number "24" is legible on the porch post in `front_248342245_+u.png`, and the neighbours (32 North Ave cream house to the NNE, 18 North Ave to the SSW) line up with the brief. **Confidence: high.**

## Frame
OBB 15.4 m (u) × 9.8 m (v), plain rectangle; road face `+u` (WNW onto North Avenue). On the `+u` face fraction 0 is the NNE (+v) end, i.e. the left of the photo. Flat lot; base at street level.

## Photos used
- `front_248342245_+u.png` — head-on road face, clear. Primary source.
- `front_248342245_-u.png` — labelled `-u` but taken from the street (176° off head-on), so it is a second front view, not the rear. Used as a second front read; the rear was not photographed.
- `front_248342245_+v.png`, `front_248342245_+v_2.png` — oblique NNE side from the street; show the side windows, the side door and the red wall dormer near the rear.
- `-v` (SSW) face: no coverage; kept plain.
- Overhead too coarse for this lot (label 2245 near the top right) — not used beyond confirming a single rectangular block.

## Reading face by face
- **+u (road, 9.8 m):** rubble-stone foundation ~0.7 m. Full-width open porch on a stone base, four square yellow posts, a red-and-yellow spindle railing, 4–5 steps left of centre. Behind the porch: front door at ~0.36 (dark wood with storm door), a pair of 1/1 windows at ~0.65–0.8. Second storey: two 1/1 windows at ~0.3 and ~0.72. Attic gable: red shingles, one paired window centred. Steep gable, dark grey shingles, deep eaves with a returned/bracketed feel. Brick chimney rises just right (SSW) of the ridge about mid-depth.
- **+v (NNE side, 15.4 m; fraction 0 = rear):** two storeys of tan clapboard; upstairs three windows spread along the side, downstairs a window or two toward the front and a small side door with steps toward the rear third. A red-shingled gabled wall dormer sits in the roof toward the rear.
- **-v (SSW):** not photographed; plain windows in the same rhythm.
- **-u (rear):** not photographed; plain windows, a small attic window, a back door.

## What was modelled / exaggerated
- One volume spanning the OBB, eaves 6.3 m, gable ridge along u with `maxH` 4.0 (steep front gable) and `gableColor` red so the whole gable triangle reads as the red shingle field.
- Full-width `open` porch, 4 yellow posts, railing, near-flat hip roof, steps at the door (0.36); door lifted onto the porch floor (`y` = `floorH` 0.7).
- Fewer, bigger windows: one wide 2.0 m first-floor window instead of the pair, two big 1/1 upstairs, one wide paired attic window.
- Chimney at (u −1.5, v −1.6), right of the ridge as seen from the street.
- Side wall dormer as a small cross-gable volume (u −5.4..−2.2, v 0.5..5.0) with a red gable and one window; its v-range is kept short so its far end hides inside the main roof.
- Stone plinth, three foundation bushes in front of the porch.

## Approximations / schema gaps
- The porch roof is really a flat-topped shallow hip with a red fascia band; modelled as a 0.15-pitch hip in roof grey. No way to give the fascia/rail the two-tone red+yellow (railing takes one colour).
- The real gable has a slight pent/flare where the shingles meet the clapboard; not modelled.
- Wall dormer is rendered as a cross gable whose roof slopes face ±u — from the street its dark slope shows above the eave, which is roughly what the photo shows too.
- `+v` compare render: the camera at 30 m sits inside the neighbour 32 North Ave (only 7.4 m away), giving a black frame; re-rendered at `--dist 14`, which is still partly inside the neighbour but shows the dormer, side windows and door correctly.
- `-u` and `-v` faces are inferred.

## Confidence
High on identity, form, colours and the porch; medium on side/rear openings.
