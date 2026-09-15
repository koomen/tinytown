# Blueprint notes — OSM 247541271 (overhead label 1271)

## Identification
Unnamed white clapboard apartment house on the south side of the Memorial Park circle, east of the
Tilly Agency house (1396) and west of 4711. Google labels the pano in front of it "100 Park Pl" /
"71 Park Pl" (street numbers around it), no business sign — multi-unit residential (several mailboxes
by the door). Confidence high on looks, none on the exact address.

Sources: `front_247541271_+v.png` (head-on from Park Place, 40 m) and `front_247541271_+v_2.png`
(zoomed, 35y) — both excellent frontal views; `sv_247541271_a.png` oblique; `front_248251396_-v.png`
shows its west end at the left edge.

## Is it three storeys?
**Yes — but the third storey is a MANSARD**, not a plain gable. The block is two full clapboard
storeys with a projecting eave/cornice, then a steep light-grey clad mansard (curved/bellcast at the
base) holding the third-floor windows, capped by a very shallow dark roof with a central brick chimney.
The earlier "shallow gable, ridge E–W" note is the appearance of that cap from the north; the mansard
runs around all four sides.

## Frame
OBB 17.0 × 13.3 m; +v = north (15°, fronts Park Place), +u = west (285°). Face +v fractions run from
the EAST end (left as seen from the road). The main house is ~14 m wide; the extra ~3 m at the east end
of the footprint is a set-back one-storey wing (visible at the left of the frontal photo).

## Reading — north front (+v), left = east
- Mansard storey: 3 shuttered windows at ~0.20 / 0.51 / 0.81.
- 2nd floor: 5 shuttered windows at ~0.13 / 0.29 / 0.50 / 0.72 / 0.88 (outer pairs closer together,
  centre one over the door).
- Ground floor: full-width open porch on 4 square posts with fretwork brackets (posts at ~0.06 /
  0.36 / 0.66 / 0.96), low dark porch roof at 2nd-floor sill level, raised floor with 4 central steps.
  Behind it: a pair of tall shuttered windows left, the light-coloured entrance door (two narrow
  lights) at centre, a pair of tall shuttered windows right. Four big clipped shrubs in front.
- Colours: siding `#d9dbd6`, trim `#eceee9`, shutters `#262930`, roof/porch roof `#4d5054`.
Sides/rear not street-visible; given 2-3 shuttered windows per floor.

## What was modelled
- `house` (2 storeys, flat roof, white cornice as the mansard eave) + `mansard-storey` (a slightly
  inset third-storey volume with a truncated hip "flatTop" cap and a chimney) — approximates the mansard
  as a stepped box with a low cap, keeping the 3-over-5 window rhythm and the strong eave line.
- `porch` volume: shaded mid-grey `#8f8c86` with 4 white pilasters as posts, white cornice fascia,
  centre door with 3 steps and the two window pairs on its face.
- `east-wing`: low gabled one-storey wing set back at the east end.
- 4 bushes along the porch.

## Not expressible / approximated
- Curved mansard slope with windows in it → stepped third storey + shallow hip cap.
- Open porch with posts and brackets → shaded flat-roofed box with pilasters.
- Raised porch floor.

## Confidence
High on the front, mansard, bay counts and colours; low on the side/rear faces and the wing's size.
