# 248273912 — 80 Park Place: former Kurtz-Hodge Implement Co. (Nash House + 1946 showroom)

## Identification (confidence: high)
- Head-on Street View of the front (Aug 2025) shows ghost lettering **"KURTZ-HODGE IMPLEMENT"** painted
  across the upper wall, right of the entry, with a Victorian house rising behind the one-storey block.
- Landmark Society of Western NY, *Avon Historic Resources Survey* (2019), inventory table:
  "80 Park Place — Contributing — c.1870 house, 1946 commercial add. — Kurtz-Hodge Implement Co. –
  Eastlake house w/ concrete block commercial addition". Narrative: "a conversion of a high-style
  Eastlake house on Circle Park into a showroom for equipment on rural arterial Route 5 in 1946";
  Figures 6a-b show the c.1910 "Eastlake Nash House" and the present view with the 1946 addition.
  https://landmarksociety.org/wp-content/uploads/2019/09/Avon-Historic-Resources-Survey-final-copy.pdf
- Trulia lists it as a 1900 "single family", 5,889 sq ft (the earlier note) — that is the house at its core.
- No current business found; the ghost sign, peeling paint, lumber props leaning on the facade and
  raw lumber along the fascia (2025) suggest it is vacant / being worked on. Sign is a historic trace,
  not an active tenant — kept because it is the single most recognizable thing about the building.

## Orientation
footprint_card: obb 31.0 x 26.7 m; +u bears 283° (west), +v 13° (north). Road side is **-v**
(faces south toward Memorial Park / the circle; the card labels the nearest road "Prospect Street",
the same carriageway as Park Place at the NW corner of the circle). Seen from the circle, LEFT = +u (west).
Polygon: the front block spans u -12.6..15.5 at v=-13.4; the rear is u -15.5..6.8 (east part deeper,
west part cut back to u 6.8 for v > 6.6).

## Photos (all in data/avon/research/)
- front_248273912_-v.png — head-on from the circle, 28 m (Aug 2025). Authoring source.
- front_248273912_-v_2.png — zoomed on the door/sign, 16h 84t.
- front_248273912_sw_2019.png — Jul 2019 oblique from the SW corner of the circle: shows the west
  face of the whole complex (then all painted white; the tall rear block was raw tan concrete block).
- sv_248273912_{a,b,c}.png — earlier obliques (identity/colour only).
- Google has no pano on the west lawn, the east driveway or the parking lot behind; head-on shots of
  +u, -u and +v snapped to the circle road / Prospect St and were discarded. +u is read from the 2019
  oblique; -u and +v are inferred (see gaps).

## Bay-by-bay reading, -v (front, 28.1 m visible, left→right from the circle)
One storey, painted concrete block, pale blue-grey (#a7bab6), flat roof, fresh raw-lumber fascia cap
along the top (tan). Blue-grey plinth ~0.75 m, then a continuous cream/white painted panel band
0.75–2.95 m (peeling), blue-grey block above it to the top at ~4.2 m.
- 0.00–0.25: cream panel, no window (a low white planter wall sits in front of the far-left corner).
- 0.285: square dark showroom window ~2.4 x 1.9 m, cream frame.
- 0.41: entry — small gabled portico, cream square posts, blue-grey gable, two steps; dark glazed
  door; US flag on a pole angled off the right post.
- 0.545, 0.775, 0.935: three more square windows, cream panels between; white diagonal wooden props
  lean against the panels (temporary; not modelled).
- Upper wall right of the door, y≈3.4–3.9: ghost letters "KURTZ-HODGE IMPLEMENT" (cream on blue-grey),
  ~8 m visible, continuing behind the tree — modelled as "KURTZ-HODGE IMPLEMENT CO.", 11.5 m.

Behind/above the showroom (from the same photo):
- House gable facing the circle, centred ≈0.49 of the front (u≈1.7), ≈8.5 m wide, ridge ≈9.8 m,
  eaves ≈6.9 m. Medium teal-green shingle walls (#6f9790), fish-scale shingles in the gable,
  cream trim, pale silver-grey roof (painted/metal, #c9cbc6). Second floor: boxed bay window with
  its own little roof on the LEFT third of the gable face, one window right of it; attic: pair of
  small windows. Brick chimney on the main ridge just behind the gable (u≈3.6).
- Left of the gable: the south slope of the main east–west roof, one second-floor window under it
  near the west end.
- Far left (u 8.6–15.5, flush with the showroom's west face): a two-storey flat-roofed block, now
  painted dark teal (#4f8683) — raw tan block in 2019 — one small high window on the west face.
  Top ≈7.8 m.
- Right of the gable: low flat roof (the rear east section, u -15.5..-2.4), pale block like the front.

## +u (west) from the 2019 oblique
Showroom west face: one-storey white block with the cream panel band and one propped window,
parapet stepping down toward the rear (not modelled — kept level). Behind it the tall block, then
the house's west wall under the main roof.

## Colours
showroom wall #a7bab6 (blue-grey block), plinth #9db0ac, cream band/trim #e6e2d2, glass #3d4a4e,
fascia lumber #c9a878, door #2e3335, house teal #6f9790 (gables a shade darker #679088),
house roof #c9cbc6, tall block #4f8683, chimney default brick, flat roofs "tar".

## Blueprint structure (blueprint_248273912.json)
volumes: showroom (u -12.6..15.5, v -13.4..-2.7, 4.2 m, belt course = cream panel band, plinth,
tan cornice, 4 windows + portico + ghost sign on -v, 2 windows each on ±u) · shopblock (dark teal,
7.8 m flat) · house (main, ridge u, eaves 6.9, ridge +2.7) · frontgable (ridge v, pulled forward to
v=-5 so it rises right behind the sign band; attic pair + one 2nd-floor window) · bay (box, 3 m wide
on the left third of the gable, 6.7 m) · rearshop (east rear, 4.0 m flat, pale block). details: flag
beside the portico.

## Schema limits / approximations
- Sign: schema styles have no "ghost paint"; used "carved" with opts {bg: wall colour, fg: pale}
  (signMaterial merges opts) so the letters sit straight on the wall without a plaque.
- Cross-gable: roof.cross is a crucifix, not a cross-gable, so the house is two overlapping gable
  volumes (ridge u + ridge v). Bay window has a flat cornice instead of its little hip roof.
- Stepped parapet on the showroom's west return, the diagonal props, the planter wall and the peeling
  paint are not modelled. Portico gable colour set via gableColor (supported by the porch builder).
- Flag detail initially sat on the door axis and rendered as a red rectangle in front of the porch;
  moved to u 2.3 (right of the portico from the street).

## Renders
render_248273912_-v.png (front, matches front_-v.png), render_248273912_+u.png (west),
render_248273912_sw.png (SW oblique, matches front_sw_2019.png in massing). Three compare/fix rounds.

## Gaps / confidence
- -u (east) and +v (rear) faces unseen: window rhythm there is invented (plain rect windows).
- Rear east section's height (4.0 m flat) inferred from the overhead crop and a sliver of roof in the
  front photo; medium-low confidence.
- Current use unknown; likely vacant. Front elevation and identity: high confidence.
