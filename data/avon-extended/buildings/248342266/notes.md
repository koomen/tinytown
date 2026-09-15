# 61 North Avenue — OSM 248342266

## Identification
1.5-storey Craftsman-era bungalow, grey-beige vinyl clapboard, side-gable asphalt roof whose front slope sweeps down over a full-width enclosed front porch; a wide three-window shed dormer centred in the front slope; brick chimney at the ridge just right of centre. Number "61" beside the door in the head-on photo. Confidence: high (address plate visible, footprint and photos agree).

## Frame
OBB 14.3 m along u (285°, WNW = depth, away from the street) × 10.6 m along v (15°, NNE = width along the street). Road face `-u`; left (0) = `-v` = SSW (toward 55 North Ave). Plain rectangular footprint, flat lot. Base sits at street level along the frontage.

## Photos used
- `front_248342266_-u.png` — 12.8 m, 4° off head-on: the primary read.
- `front_248342266_+u.png` — despite the label this is ALSO the road face (the pano snapped to the street, 178° off head-on, i.e. looking at `-u`); used as a second frontal.
- `front_248342266_+u_2.png` — oblique from the SSW along the street: shows 55 North Ave (stucco box, orange ramp) at left and 61's `-v` gable end + porch corner at right. Useful for the side gable end, block foundation and the bay at the porch end.
- `front_248342266_+v.png` — oblique from the NNE: `+v` gable end with side door and stoop, porch-end bay window, foundation.
- `front_248342266_+v_2.png` / `_3.png` — mostly trees / blurry; only confirm the gable form.
- No photo of the rear `+u` face: kept plain (two windows).

## Reading face by face
- `-u` (road, 10.6 m): eaves ~3 m over the enclosed porch. Porch enclosure between two sided corner piers: triple 6/1 window (left) | pale panelled door with wreath, two lamps, 4 wooden steps (centre) | triple window (right). Above, the roof slope with a slight break where the shallower porch skirt meets the main slope; a ~5 m wide shed dormer with three tall windows; ridge ~7–7.5 m; chimney on the ridge right of centre.
- `-v` (SSW gable end, 14.3 m): steep gable with two windows in the attic storey, a vent at the peak; three or four 1/1 windows on the ground floor; grey block foundation with basement lights; a small bay window at the porch end (front).
- `+v` (NNE gable end): same gable; ground floor has a side door with a small stoop near mid-face, windows either side; two attic windows and a small window near the peak; porch-end bay window at the front.
- `+u` (rear): unseen; plain.

## What was modelled / exaggerated
- Two overlapping volumes: `main` (u -4.6…7.15, eaves 4.4 m, gable ridge along v, ridge 7.6 m) and `enclosed-porch` (u -7.15…-1.0, eaves 3.1 m, gable ridge along v, maxH 1.57) whose slope rises to meet the main eave, giving the continuous sweep with a faint kink like the real roof.
- The shed dormer is `roof.dormers` on `main` (`style: "shed"`, `faces: ["-u"]`): three 1.05 × 1.15 windows at 0.354 / 0.5 / 0.646, spaced exactly one dormer box (1.55 m) apart so the boxes abut and read as one ~4.7 m wide dormer with three lights and a single shed slab; sill 0.55 m above the main eave so the slab dies into the slope below the ridge.
- Front: two oversized triple windows, centred door up 4 steps with lamp; four bushes along the front.
- Chimney at the ridge right of centre; grey block plinth on both volumes.
- Porch-end bay windows as `faces[].bays` on `enclosed-porch` (`-v` at 0.75, `+v` at 0.25): 1.8 m wide, 0.6 m deep, raised 0.5 m on a skirt board, one light in front plus side lights, hip lid under the porch eave; the wall window behind each is skipped automatically. Side door with 2 steps on `+v`.

## Approximations / schema gaps
- Dormer windows take no `glass` colour, so they render with the default glowing pane (the rest of the house uses `#596068`); the abutting shed slabs overlap coplanar, which shows only as faint seams. The shed slab has no side cheeks, so from the gable ends a thin wedge between slab and slope is see-through.
- Real windows are 6/1 sash; modelled as plain rect with default mullions.
- The porch skirt overhang shows as a small verge board at the gable ends on the side faces — acceptable.
- Rear face unphotographed and kept generic.

## Confidence
High on identity, roof form, front bay rhythm and colours; medium on side-face window positions and ridge height (read from oblique photos); low on the rear.
