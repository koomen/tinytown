# Blueprint notes — OSM 1090362843 — 43 Genesee Street ("Woody's")

## Identification (confidence: high for the building, medium for the name)
The narrow cream clapboard commercial building between the Avondale Pub (1090362844, north) and the
AudioNova/Hurricane block (1090362842, south) on the west side of Genesee Street. Footprint 6.2 m on the
street and 21.8 m deep matches the photos: the facade is a single storefront bay, the same width as the pub,
and the overhead shows a long flat-roofed strip behind it. Pete's earlier photo of the row showed the
WOODY'S sign on this building; the Aug 2025 Street View imagery shows no sign at all on the fascia (the board
appears to have been removed), so the name comes from Pete's photo / the style pass, not the current imagery.

## Frame
OBB 21.8 m along u x 6.2 m along v; +u bears 104 deg (ESE) and is the ROAD face (Genesee St); -u is the
rear (WNW, parking lot); +v abuts 1090362842 (gap 0), -v abuts the pub (gap 0). Plain rectangle, one volume
spanning the OBB. Lot falls 1.9 m toward the rear; nothing added for it.

## Photos used
- front_1090362843_+u.png, front_1090362843_+u_2.png, sv_1090362843_a.png (frontal, Aug 2025) — elevation.
- front_1090362843_+v.png / +v_2, -v / -v_2 — obliques along the row (party walls are hidden by neighbours;
  used for height against the pub and for the roof line).
- sv_1090362843_b/c.png — obliques from the north, colours and massing only.
- overhead_labeled.jpg — flat roof, no rear wings.
- The render camera for "+u" is broken (the tool puts a literal "+" in the URL, which decodes to a space), so
  the road-face renders were made from compass bearing 104 and composed into compare_1090362843_+u.png.

## Reading face by face
**+u (Genesee St, 6.2 m, left = south):** one bay. Ground floor: full-width shop glass with a dark frame
from the left pier to ~70%, glazed door at ~85%, dark kick panel; a dark grey-and-lighter-grey striped awning
spans the whole width at ~3.1 m; above it a blank clapboard band with two gooseneck lamps and a light string
(where a fascia sign would sit). Upper floor: two 6-over-6 windows with white casings and dark taupe shutters
at ~0.3 / 0.7, sills ~4.7 m. Top: dark taupe cornice band with a false-front parapet — flat shoulders and a
steep central peak — the same profile and height as the pub's pediment parapet next door. Cream clapboard
walls, dark taupe trim everywhere.
**-v / +v (party walls):** hidden by the pub (same height) and by 1090362842 (lower eave, 2 m recessed at the
front); left blank.
**-u (rear):** no coverage; kept plain with a door and two upper windows.

## What was modelled / exaggerated
- One flat-roofed volume, 7.3 m to the cornice to match the pub's party wall, `pediment` parapet 2.4 m,
  `width: "full"`, dark trim — the paired false fronts are the row's signature.
- WOODY'S board sign (3.4 x 0.62 m) centred on the blank band above the awning; slightly larger than any
  real fascia sign would be so it reads from the diorama camera.
- Full-width striped awning, one storefront band [0.06, 0.70] with a dark frame/kick, door at 0.85.
- Two upper windows with dark shutters — kept at real count (already few and large).
- Colours: wall #dcd4c1 (cream clapboard), trim #5b524a (dark taupe), awning #4f4a45 with #9a948b stripes,
  roof "tar".

## Approximations / schema gaps
- Gooseneck lamps and the light string over the awning: no schema element; omitted.
- The sign style is a guess ("board": cream board, dark letters) — the actual WOODY'S sign is only known
  from Pete's photo, not the current imagery.
- Clapboard texture is not expressible; a flat cream wall stands in.
- Storefront transom/door glazing simplified to the renderer's standard storefront + rect door.

## Confidence
High on massing, height and the pediment false front (read from frontal photos and matched to the pub's
blueprint). High on the awning/storefront/shutters. Medium on the sign (name from Pete's photo; style
invented). Low on the rear face (no coverage).
