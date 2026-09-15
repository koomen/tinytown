# 248273908 — 91 Prospect Street

## Identification (confidence: high)
White clapboard two-storey farmhouse with slate-blue shutters and a wraparound
porch on the west side of Prospect Street, between the mint 77 Prospect
(248273917, to the SSW) and a tan two-storey house (to the NNE, 248273907).
Every photo shows both neighbours flanking it, so the target is unambiguous.

## Frame
OBB 13.7 m (u) x 12.5 m (v); +u bears 105° (ESE, toward the street), +v bears
195° (SSW). Road face `+u`; its left end (fraction 0) is `+v` = SSW, toward 77
Prospect. Plain rectangle. The lot drops 2.0 m from the street to the rear; the
drive along the NNE side digs down to a garage under the north wing.

## Photos used
- `front_248273908_+u.png` (8° off, 17 m) and `-u.png` (176° off = also from
  the street): the true frontal views, but the big street maple hides most of
  the upper floor. Used for the porch, door, skirt colour.
- `front_248273908_-u_2.png` (158° off, from the street, NNE oblique): best
  view of the whole front and the north wing with its awning and garage door.
- `front_248273908_+v_3.png`: despite its name, shot from the street a little
  SSW; the clearest near-frontal read of the roof (front gable over the left
  half, main ridge running to the chimney), window rhythm and garage.
- `front_248273908_+v.png`, `+v_2.png`: from the SSW; show the porch wrapping
  round the south side and the south slope of the front gable. `+v_2` is mostly
  77 Prospect's mint wall.
- `front_248273908_-v.png`, `-v_2.png`: from the NNE; north wing, awning,
  exposed garage, the tan neighbour.
- No rear (`-u`) view exists; rear invented from the satellite (low wing).

## Reading face by face
- `+u` (street), left (SSW) to right: two-storey block ~9.4 m: a full-height
  front gable over the left ~half with two tiny square attic lights; upper
  floor three shuttered 1/1 windows (two under the gable, one right); ground
  floor behind the porch: window, front door (glass panel, mailbox) at ~0.3,
  window, then a shuttered window at the right with an AC unit. Porch: full
  width, low hip roof, turned white posts, white railing, teal lattice skirt,
  central run of 5 steps to the door. Right of the block: one-storey hip-roofed
  north wing (~3 m), shuttered window, garage door tucked below at drive level.
  Dark grey asphalt roof, brick chimney where the front gable meets the main
  ridge, TV antenna.
- `+v` (SSW): porch wraps back ~45% of the depth; shuttered upper windows;
  south slope of the front gable.
- `-v` (NNE): north wing with a side door under a small white awning and a
  stair; main block's gable end above it with two shuttered windows.
- `-u` (rear): unseen; low rear wing.

## What was modelled / exaggerated
- `main` (side-gabled, ridge v, eave 6.4, ridge +2.8) with a flush
  `front-gable` volume over v 1.5..6.2 (ridge u, same ridge height) carrying two
  shuttered windows and the paired attic lights; chimney at the junction.
- Wraparound `open` porch: full `+u` range plus `+v` 0.55..1.0, floorH 0.9,
  teal floor/skirt, white posts and railing, 5 steps at the door.
- `north-wing` 4.2 m hip with a street-facing garage door at grade and a
  shuttered window above; side door + awning on `-v`.
- `rear-wing` low hip, plain windows and a back door.
- Exaggerated: shutters on every upper window, porch a little deeper, attic
  lights a little bigger, teal skirt saturated.

## Approximations / schema gaps
- The garage really sits a storey below the street (the drive digs down); the
  renderer floors the building at street grade, so the garage door is placed at
  grade with the wing's window above it.
- Porch steps/floor share one colour (`floorColor`), so the steps come out teal
  instead of grey.
- Corner post doubled where the two porch ranges meet (harmless).
- Front-gable width (~50% of the front) is a compromise between the north and
  south obliques (0.44 vs 0.58).
- `+v` compare camera lands among neighbour geometry; the face itself checked.

## Confidence
High on identity, colours, porch and roof form; medium on window fractions and
the front-gable width; low on the rear wing.
