# 32 North Avenue — OSM 248342246

## Identification
Compact pale-yellow clapboard 1.75-storey gable-front house (gable faces the street; second-floor windows tucked under low eaves; a wide low-arched attic window in the gable), tall red-brick chimney on the SSW roof slope near the front and a smaller one at the ridge farther back, hipped rear with a small dormer on the SSW slope. Front: white door under a small arched white hood with red-painted steps at the left, a dark-green-trimmed three-window bay under its own little roof right of centre, one narrow green-trimmed window at the far right. Confidence: high (three angles agree; sits between 24 North (red/tan Queen Anne with porch) and 38 North (grey ranch)).

## Frame
OBB 13.0 m along u (286° WNW = depth) × 11.6 m along v (16° NNE = width along the street). Road face `+u`; left (0) = `+v` = NNE (toward 38 North). Plain rectangle, flat lot; base at street level.

## Photos used
- `front_248342246_+u.png` (20 m, 3° off) and `front_248342246_-u.png` (mislabelled `-u`: the pano snapped to the street, so it is another frontal, slightly farther) — primary read; a street tree hides the door/left half partially.
- `front_248342246_+v.png`, `_2`, `_3` — obliques from the NNE: `+v` side with side door and stoop, triple upper window, hipped rear, both chimneys, the arched attic window.
- `front_248342246_-v.png`, `_2`, `_3` — obliques from the SSW: `-v` side, tall brick chimney on the slope, small dormer, green-trimmed lower window, and the hood over the door. 24 North Ave fills the right half of these frames.
- Rear `-u`: no photo; kept plain.

## Reading face by face
- `+u` (road, 11.6 m): ground — door with arched hood + 2 red steps at ~0.16, green-trimmed 3-light bay window (hip-lidded) ~0.3–0.75, narrow green-trimmed window ~0.88. Second floor — two 1/1 windows at ~0.18 and ~0.64 just under the eave (~4.5 m). Gable — wide low-arched 3-light attic window centred. Roof asphalt grey-brown, pitch ~25–30°, ridge ~7.3 m; brick chimney rising on the right (SSW) slope just behind the gable.
- `+v` (NNE, 13 m, left = front): ground — small window near the front, side door with 2-step stoop about mid-face, window toward the rear; upstairs — small window near front, a wide triple window mid-face, a window toward the rear; roof hips down at the rear.
- `-v` (SSW, left = rear): ground — green-trimmed wide window near the front, another toward the rear; upstairs two windows; small gabled dormer on the slope about a third back; tall chimney near the front.
- `-u` (rear): unseen; two windows down, one up.

## What was modelled / exaggerated
- Two volumes sharing one ridge along u: `main` gable-front block (u -1.5…6.5) and `rear` hip (u -6.5…-0.5), eaves 4.9 m, ridge 8.2 m — proportions scaled up ~10% because the OSM footprint (11.6 m) is wider than the house reads (~9–10 m), so the gable keeps its tall look.
- Oversized arched attic window in the gable; tall brick chimney on the SSW slope near the front (the code runs chimneys from eave level to above the ridge, so it reads tall like the real one); small second chimney at the rear ridge.
- Door portico as a 2-post open porch with a white gable roof and red-painted floor/steps (stand-in for the arched hood), lamp.
- Bay window as a real `faces["+u"].bays` entry: 4.2 m wide, 0.9 m deep, at 0.52, three green-trimmed lights across the front plus side lights, hip lid (`roof: "hip"`, lightened hip grey). Green trim also on the narrow front window and the side windows.
- Small gabled dormer as `roof.dormers` on the `rear` hip volume (`faces: ["-v"]`, at 0.35 = about u -2.6, 0.8 × 0.8 window, sill 0.5 m above the eave); side door with stoop on `+v`; big bush at the front right corner plus two small ones.
- Colours: pale yellow siding `#e9e2be`, white trim, dark green sash trim `#2f5a3c`, grey roof.

## Approximations / schema gaps
- No arched/barrel door hood: used a tiny gabled open porch instead.
- Hip roofs render as a flat-shaded mesh (no shingle striping) so they look darker than gables; hip colours lightened a touch to compensate.
- Side views needed `--height 18` to look over 24/38 North Ave (6–7 m away); at the default height the camera sits inside the neighbour.
- Rear face generic.

## Confidence
High on identity, roof form, front rhythm and colours; medium on absolute heights (footprint is generous for the house) and the rear hip; low on the rear face.
