# Blueprint notes — OSM 248273879 — 90 West Main Street (White Horse Automotive)

## Identification (confidence: high)
The tan stucco, one-storey, flat-roofed auto-repair shop at the corner of Rochester Street (-v) and West Main Street (-u). The `-u` photo shows the yellow "Registered Motor Vehicle Repair Shop" / "Official Inspection Station" signs and a round black horse logo on the rounded corner; the `-v` photo shows the same building running along Rochester St with the pole barn (248273881) attached at the left (+u) end. The satellite crop confirms an L-shaped single dark flat roof with a rounded SW corner. The old generic style (2-storey red brick) is wrong.

## Frame
OBB 31.4 (u) x 20.8 (v); +u bears 21° NNE, +v 111° ESE. Footprint is an L: a strip along Rochester St (u -11.5..15.7, v -10.4..2.4) plus a rear wing along West Main (u -15.6..-4.8, v -5.5..10.3). The polygon's chamfer between (-11.5,-10.4) and (-15.5,-5.5) is the rounded glass corner. Pole barn 248273881 abuts the +u face (gap 0); 72 W Main (248274491) is 6 m off +v.

## Photos used
- `front_248273879_-v.png` (14 m, head-on): the whole Rochester St face — primary source.
- `front_248273879_-u.png` (27 m, head-on): West Main face with signs and rounded corner.
- `front_248273879_+u.png`, `_2`, `_3`: mostly the pole barn; confirm flat roof, same height, and the -v bay rhythm from an angle.
- `front_248273879_-v_2.png`, `-u_2.png`: too far / obstructed (trees, other blocks); not used.
- `satellite.jpg` crop: L-shaped dark flat roof, rounded corner, pole barn white roof to the north.
- One Street View attempt at the +v link snapped to a pano on NY-5 that did not show the rear; +v remains unseen.

## Reading face by face
- `-v` (Rochester St, 27 m straight + curve): one storey ~3.9 m to a dark-brown coping; a slightly darker tan belt band at ~2.3 m (window-head height) running the full length and round the curve. From left: window, dark man-door with 2 steps and a rail, small window, two windows, a long blank stretch with a conduit, one window, then a continuous glass band that wraps the rounded corner. Wall tan stucco; window surrounds tan-brown.
- `-u` (West Main, ~16 m + curve): rounded glazed corner at left with a round black "White Horse" logo; small window; dark door with lamp; two small yellow signs above a three-pane window band; two windows toward the right corner. Same belt band and coping.
- `+u`: party wall against the pole barn — blank.
- `+v` (parking lot, unseen): no roll-up doors appear on either street face, so the repair bays must face the lot; modelled as three roll-up doors plus a man door on the strip's +v face, two windows on the wing's +v face.

## What was modelled / exaggerated
- Five flat-roofed volumes at 3.9 m: strip, wing, and three stair-stepped corner boxes approximating the quarter-circle corner (radius ~4.5 m), each with a glass band so the corner reads as a glassy curve.
- Belt course and dark coping cornice on every volume; tan wall `#d3c2a0`, trim `#b39a72`, coping `#5b4a3a`.
- Signs: gold-on-black round-ish plaque "White Horse" on the corner, two board signs ("MOTOR VEHICLE REPAIR SHOP", "INSPECTION STATION") on the West Main face. Text shortened to fit; the real signs are yellow (no yellow sign style).
- Windows a little larger than life, same rhythm; garage bays on +v are a guess.

## Approximations / schema gaps
- No curved volume in the schema: the rounded corner is three stepped boxes. A `chamfer`/`radius` corner option would make this much cleaner.
- No yellow sign style; used `board`.
- `+v` face (roll-up bays) is unverified — flagged for the coordinator.
- The lot slopes 2.3 m to the -u/+v corner; left to the renderer's foundation.

## Confidence
Identity and street faces: high. Corner geometry: medium (caricature). Rear (+v) bays: low — guessed from function.
