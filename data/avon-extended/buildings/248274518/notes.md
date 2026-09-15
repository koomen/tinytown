# Blueprint notes — OSM 248274518 — Avon Farmers Market pavilion, Pocket Park

## Identification
The open timber post-and-beam pavilion in the Pocket Park at 97 Genesee St,
Avon NY, home of the Avon Farmers Market (banner "AVON FARMERS MARKET" on the
black iron fence in `front_248274518_+u.png` and `sv_248274518_a.png`). It sits
1.2 m south of the Edward Jones building (1090362838) on the west side of
Genesee Street. **Confidence: high.**

Decision: a blueprint **was** written. The generic pavilion already reads as an
open shelter, but its ridge runs across the lot (eave toward the street) and its
roof is a tall dark slab; the real pavilion presents a gable end to the street.
The draft gets the gable facing the road, natural timber posts, a low concrete
pad, the banner and the planters, so it replaces the generic.

## Frame
OBB 11.7 m along u × 9.9 m along v; +u bears 103° (ESE, the street), +v bears
193° (SSW). Road face **+u** (9.9 m wide). Flat lot. The OBB traces the roof,
so the posts stand inside it.

## Photos used
- `front_248274518_+u.png` (head-on, 12 m), `front_248274518_+u_2.png` (2021),
  `sv_248274518_a.png` — gable end from the street.
- `front_248274518_-v.png`, `-v_2.png`, `front_1090362838_+u*.png` — the long
  side and the relationship to the Edward Jones wall.
- `front_248274518_+v.png`, `sv_1090362838_b.png` — the other long side.
- `front_248274518_-u.png` and `sv_248274518_b.png` look away / show only the
  fence; not useful.
- `render_248274518_+u.png` with `--no-bp` — the generic version, for the
  keep-or-replace decision.

## Reading face by face
**+u (street, gable end).** A symmetrical gable, pitch about 0.45–0.5 (rise ~2.3
m over a 4.9 m half-span), very dark brown standing-seam metal roof with a wide
overhang, open truss visible in the gable, string lights along the beams. Two
heavy square natural-cedar posts at the corners carrying a beam at ~3 m; the
same at the far end — four posts in all. Concrete plaza floor at grade with
café tables. In front, a black iron fence with flower planters and the white
"AVON FARMERS MARKET" banner; a park bench on the lawn.

**+v / -v (long sides).** Eave sides: the low eave beam, two posts, roof
overhanging ~1 m. The -v side faces the buff-brick wall of Edward Jones across a
paved gap.

**-u (rear).** Mirror of the street gable, open to the trees behind.

## What was modelled / exaggerated
- Blueprint volumes are solid, so the shelter is built from two back-to-back
  `style: "open"` porches on the +u and -u faces of a single 0.4 × 0.4 m,
  3 m-tall `centre-post` volume (the lint minimum height is 1.5 m, so the core
  cannot be hidden under the floor; coloured timber it reads as a king post
  under the ridge). Each porch is `at 0.5, w 9.9, d 5.65`, `posts: 2`, gable
  roof pitch 0.47 — the open-porch gable ridge runs out from its wall, so the
  two roofs meet at the centre and form one 11.7 m gable with its ends toward
  the street and the trees. Four corner posts result, as in reality.
- Floor: `floorH 0.12`, concrete grey — the plaza pad.
- Colours: posts, beams and gable `#c9a672` / `#bb9663` (natural cedar), roof
  `#3f342c` (near-black brown, brightened by the renderer's plank shading).
- The banner is a `lawnsign` "Avon Farmers Market" in `board` style with green
  lettering standing 1.1 m off the street end, flanked by two `bush` planters.

## Approximations / schema gaps
- The gable ends are solid timber-coloured triangles; the real gable is an open
  truss you see the sky through. No open-truss option exists.
- Posts are the porch's fixed 0.2 m squares (the real ones are ~0.3 m) and the
  roof overhang beyond the posts is only 0.25 m instead of ~1 m.
- The centre post is a fiction forced by the minimum volume height.
- The iron fence and bench are not modelled (a porch `railing` would sit between
  the posts, not at the plaza edge).
- Lint warns "volumes cover only 0% of the footprint" — expected, the core is a
  single 0.4 m post; the porches fill the OBB.
- The first `render_bp.py +u` runs fell back to a default camera (an
  un-encoded `+` in the URL, since fixed); the compare was re-rendered with the
  fixed tool from the true +u face and matches the earlier bearing-103° check.

## Confidence
High on the form (gable to the street, four posts, dark roof, light timber) and
placement. Medium on eave height (~3.0 m) and pitch, read from a 12 m pano.
