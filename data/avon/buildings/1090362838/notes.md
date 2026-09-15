# Blueprint notes — OSM 1090362838 — Edward Jones, 87 Genesee St

## Identification
Edward Jones investment office, 87 Genesee St, Avon NY. Two-storey flat-roofed
corner building on the west side of Genesee Street, immediately north of the
Pocket Park / farmers-market pavilion (248274518). Confirmed by the green
"Edward Jones INVESTMENTS" fascia sign and the "87" on the left door in
`front_1090362838_-v.png` and `sv_1090362838_a/c.png`. **Confidence: high.**

## Frame
OBB 13.9 m along u × 19.9 m along v. +u bears 196° (SSW, toward the pavilion),
+v bears 286° (WNW, rear). Road face **-v** (13.9 m wide, faces ESE onto
Genesee); its left end as seen from the street is the +u / pavilion end.
Footprint is a plain rectangle; the lot drops 1.4 m toward the rear-north
corner. The flat roof is confirmed by the overhead.

## Photos used
- `front_1090362838_-v.png` (12° off, 2025) and `-v_2.png` (18°, 2021),
  `sv_1090362838_a.png`, `sv_1090362838_c.png` — road face, bay by bay.
- `front_1090362838_+u.png`, `+u_2.png`, `+u_3.png`, `front_248274518_+u.png`,
  `front_248274518_-v.png`, `sv_1090362838_b.png` — south (+u) side wall.
- `front_1090362838_-u.png`, `-u_2.png` — north (-u) side wall (mostly hidden
  behind the gabled neighbour).
- `front_1090362838_+v.png` looks away from the rear; the rear is unphotographed.
- `card_1090362838.png` for the frame.

## Reading face by face
**-v (road, 13.9 m).** Two storeys, flat roof with a plain white fascia/cap.
Ground floor red-brown brick; upper floor tan horizontal clapboard; between
them a white frieze band with a scalloped/dentil edge at about 3.6–3.9 m.
Ground floor, left to right: white-framed glass door "87" at ~0.07–0.09;
projecting white bay window ~0.20–0.41; recessed Edward Jones entrance with
white pedimented surround and double glass doors at ~0.55; second white bay
window ~0.70–0.88. Green fascia sign "Edward Jones INVESTMENTS" above the
entrance and right bay, roughly 0.45–0.75, at ~3.0 m. Upper floor: two ribbons
of tall six-over-six sashes with dark sage-green shutters at the ribbon ends —
a 3-sash ribbon centred ~0.28 and a wider 4–5-sash ribbon centred ~0.67; sills
~4.5 m, heads ~6.3 m. Chimney of buff brick at the right (-u) end, just behind
the front parapet. Hanging flower baskets, a lamp post and a US flag on the
facade (not modelled).

**+u (south side toward the pavilion, 19.9 m).** Entirely pale buff/cream brick,
parapet slightly lower than the front cap; the tan clapboard and white trim
wrap only a corner-board's width around the front. One small upper window near
the rear third, one larger upper window past the middle, one small ground-floor
window toward the rear where the lot drops.

**-u (north side, 19.9 m).** Buff brick like +u; the tall buff chimney rises
near the front. One or two upper windows visible near the front; a low ground
window pair at ~0.25. A gabled neighbour (1090362839) sits 3.3 m away and hides
most of it.

**+v (rear).** Not photographed; given a plain door and two upper windows.

## What was modelled / exaggerated
- Two volumes: a 19.3 m buff-brick `main-buff` body (height 6.9, dark flat
  roof, plain buff cornice so the default white dentilled eave does not appear,
  chimney at u -5.6 / v -8.2) and a 0.7 m-thick `front-block` skin along the
  road face (height 7.6) carrying the red-brick / tan-clapboard split at 3.6 m,
  the white belt course and the white cornice. The thin block puts the two-tone
  wall only on the street face and gives the corner-board wrap seen in photos.
- Road face: door at 0.09, two white storefronts (bay windows) at 0.20–0.41 and
  0.70–0.88, white-surrounded double door with fanlight at 0.555, green
  "Edward Jones" sign, and three tall shuttered windows (one 2.0 m at 0.28, two
  1.5 m at 0.56 and 0.78) standing for the two ribbons of sashes. Shutters are
  made a bit fatter than life by the renderer; the rhythm (one group left, a
  wider group right, blank clapboard at the far right under the chimney) is kept.
- Side walls: two upper windows each, one low window, no trim colour beyond white.

## Approximations / schema gaps
- Ribbon windows: the schema cannot express one wide window with shutters only
  at the ends and several sashes inside; shutters scale with window width, so
  the right ribbon became two windows with their own shutters.
- Bay windows are flat `storefronts`; the real ones project ~0.5 m.
- The chimney is the renderer's fixed small stack; the real one is a tall buff
  brick chimney about 1.5 m above the parapet.
- The scalloped frieze is a plain white belt course.
- Flag, lamp post, flower baskets, hanging "Municipal Parking Lot" sign omitted.
- `render_bp.py -u` puts the camera inside the neighbouring house, so the -u
  check used a bearing of 40°. The +u compare was re-rendered head-on with the
  fixed tool (the pavilion roof sits in the foreground); `render_1090362838_b141.png`
  is the oblique that matches the +u photo's viewpoint.

## Confidence
High on massing, colours, roof, the two-tone front and the sign. Medium on
exact bay fractions (read off 12–18° oblique panos) and on the side-wall window
positions. Low on the rear (+v), which is unphotographed.
