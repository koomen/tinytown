# Blueprint notes — OSM 248274494 — 58–60 West Main St (Puppy's Bar & Grill + the yellow house)

## Identification (confidence: high)
One OSM footprint (15.2 m along the road × 21.3 m deep) that actually holds two attached
buildings, confirmed by the +u photo and the overhead (label 4494 covers two roofs):
- **#60 West Main (left / +v / NW half)** — a long yellow clapboard two-storey house with a
  squared false front over the street gable and a full-width two-storey porch (thin dark
  posts, white balcony railing, yellow-and-white striped awning under the porch roof).
- **#58 West Main, Puppy's Bar & Grill (right / -v / SE half)** — a teal front-gabled
  two-storey with a brick ground floor, a shingled pent canopy with the gold-on-green
  PUPPY'S BAR & GRILL board, and a low white shed behind it.
The earlier style-pass guess ("clapboard house with storefront") was half right; the sign
belongs on the teal half only.

## Frame
+u = road face (SW, West Main St), 15.2 m; left end of +u lies toward +v (NW). +v/-v are the
21.3 m long sides. Lot slopes 2.3 m (front-NW corner lowest); no plinth added, per brief.

## Photos used
- `front_248274494_+u.png` — head-on, both halves clearly readable. Primary source.
- `front_248274494_-u.png` — despite the name it is another street-side view (164° off),
  centred on the yellow house; used for the porch/ground-floor details.
- `front_248274494_+v.png`, `+v_2.png` — oblique from the NW: long yellow side wall, gable
  ridge running back, rear exterior stair, ~4 upper windows.
- `front_248274494_-v.png`, `-v_2.png` — oblique from the SE: teal gable ridge running back,
  brick only on the front, white single-storey shed with a chimney behind Puppy's.
- Overhead crop confirmed two roofs in one footprint.
Side-face renders (+v, -v at 45 m) are blocked by the neighbours' roofs (70 and 52 W Main
stand between camera and face), so only the +u compare was iterated.

## Reading face by face
**+u (road).** Left ~8 m: yellow house. Two storeys; open porch across the whole width on
three thin posts; upper balcony with white railing and a striped awning hung from the porch
eave; above, a pale-beige squared false front with vents. Ground floor behind the porch:
wide window left, white 9-light door and a grey second door right. Right ~7 m: Puppy's.
Steep teal gable end, two small upper windows, shingled pent canopy over a brick ground
floor with a central glass door, windows either side, sign board at the canopy eave, flags.
**+v (yellow side).** Gable ridge along u, ~4 upper windows, 2 lower, rear door with stair.
**-v (teal side).** Teal to the ground on the side; 2–3 upper windows; white shed behind.
**-u (rear).** Not photographed; plain gable end with two windows per storey.

## What was modelled / exaggerated
- Two volumes side by side plus a shed: `house-60` (yellow, gable ridge u, ridge capped at
  1.5 m so the false front hides it), `porch-60`, `puppys-58` (brick base / teal upper via
  `upperWall`+`split`), `shed-58`.
- Two-storey porch as a shadow-coloured volume with dark pilasters for posts, a white belt
  course pair as balcony floor + railing, and a striped awning right under the flat porch
  roof — the awning and balcony are the signature.
- Flat false-front parapet, pale beige, over the yellow gable.
- Puppy's: pent canopy as an open hip-roofed porch, big gold-on-black sign board above it,
  dark glass door on the porch floor, a flag detail at the corner.

## Approximations / schema gaps
- No two-storey open porch in the schema; faked with a volume + pilasters + belt courses.
  The awning sits on the wall plane rather than hanging from the porch eave.
- `upperWall/split` makes the brick wrap the teal building's sides; in reality only the
  front is brick.
- Pent (shed) canopy rendered as a shallow hip. Sign is gold-on-black, real board is dark
  green.
- Gable `pitch` is rise ÷ full span (not half-span) — used `maxH` to cap ridges.
- Shed chimney and satellite dish omitted.

## Confidence
Identification high; road face medium-high (reads as the pair at a glance); sides and rear
medium-low (obliques only; renders unverifiable because neighbours block the camera).
