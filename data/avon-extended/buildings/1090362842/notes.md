# Blueprint notes — OSM 1090362842 — 53 Genesee Street (AudioNova / Hurricane Technologies)

## Identification (confidence: high)
Two-storey colonial-style office block on the corner of Genesee St and Park Place, west side of Genesee,
immediately south of Woody's (1090362843). Signed "53" on the brick between the two shop windows,
"AudioNova — Your Hearing Experts" on the left porch fascia and the red Hurricane Technologies swoosh on the
right one (front_1090362842_-v.png, sv_1090362842_a.png). Footprint 13.4 m on the street x 25.1 m deep; the
polygon is a rectangle with one extra collinear vertex.

## Frame
OBB 13.4 m along u x 25.1 m along v; +u bears 194 deg (SSW, Park Place side), +v bears 284 deg (rear, WNW).
Road face is **-v** (104 deg ESE, Genesee St); its LEFT end (fraction 0) is the +u / south / Park Place end.
-u is the party wall shared with Woody's (which is taller and deeper along the first 21.8 m). Lot falls
2.3 m toward the rear; nothing added for it.

## Photos used
- front_1090362842_-v.png (12.8 m out, 6 deg off), front_1090362842_-v_2.png, sv_1090362842_a.png — the
  road elevation, bay by bay.
- front_1090362843_+u.png / +u_2.png — the same facade from further north, roof form and the right wing.
- front_1090362842_+u.png/_2/_3, -u.png/_2/_3 — obliques along Genesee; +u_3 shows the hipped roof end and
  the grey side wall; -u views are mostly other buildings.
- front_1090362842_+v.png — Google snapped to a house elsewhere; not used.
- overhead_labeled.jpg — single rectangular roof, ridge along the long (v) axis.

## Reading face by face
**-v (Genesee St, 13.4 m, left = south/Park Place):** three bays.
- Left wing [0, 0.25], ~3.4 m: a two-storey open porch recessed ~2 m. Ground: square white posts on
  ~1 m brick piers with pale caps, a dark glazed door at the back wall (AudioNova entrance), white fascia
  band with the AudioNova sign at ~3.5 m. Upper: balcony with white railing and posts, a window/door onto it,
  the main roof running out over it.
- Centre [0.25, 0.75], ~6.6 m, flush with the street: brick ground floor with two large white-framed shop
  windows (AudioNova left, Hurricane right) and the "53" between them at ~3 m; white belt at the floor line
  (~3.5 m); grey vinyl upper floor with two 6-over-6 windows with grey-blue shutters and white head casings;
  a front gable (grey shakes, white raking trim) with a small half-round fan ornament near the peak.
- Right wing [0.75, 1]: mirror of the left wing — brick piers, white posts, dark door (Hurricane), white
  fascia with the red swoosh logo, balcony with white railing above.
- Roof: grey asphalt hip over the whole footprint, ridge along v, cross gable on the street end.
**+u (Park Place side, 25.1 m):** brick below the belt, grey vinyl above, hipped end; a wall-hung AC unit;
windows in both storeys (count not readable — modelled as three per storey).
**-u (party wall):** hidden by Woody's for 21.8 m; one upper window near the rear.
**+v (rear):** no usable coverage; a door and a few windows.

## What was modelled / exaggerated
- `main` volume: full width, front plane set back 2 m (v from -10.5) so the wings' ground floors are open;
  brick #8e4e3d below 3.5 m, grey #a9acab above (`split`), white belt course, hip roof `h: 3.0`.
- `centre-gable` volume: 6.6 m wide, projecting to the street, gable roof with ridge along v
  (`pitch 0.3, maxH 2.3`), grey-shake gable (`gableColor`) with a round "fan" window; two shop windows,
  the "53" plaque (carved style, a little bigger than life), two shuttered upper windows.
- Two-storey porches on each wing, built from stacked open porches on the main -v face: a tall one
  (posts to the eave, shallow hip roof continuing the main roof) plus a short one whose flat roof is the
  balcony deck / fascia. Brick piers are `towers` (0.5 m, 1.0 m tall, white cap) at the post feet.
- Fascia signs: "AudioNova" (board) and "Hurricane" (red) pushed `out: 2.42` so they sit on the balcony
  fascia; doors lifted `y: 0.15` onto the porch floors.

## Approximations / schema gaps
- Balcony railing at second-floor level: not expressible (an open porch's floor slab is solid from the
  ground, so a porch cannot start at 3.5 m; `railing` only exists at the porch floor). The deck fascia
  stands in for it.
- `roof.cross` is a crucifix, not a cross gable, so the front gable is a separate overlapping volume; the
  seam where the gable meets the hip is hidden inside the hip roof.
- The Hurricane logo is a red swoosh on a white board; rendered as a red sign with the word HURRICANE.
- The fan ornament in the gable is a glowing round window; hanging flower baskets, the flag and the AC unit
  are omitted.
- Side/rear window counts are guesses.

## Confidence
High on the street elevation: bay widths, brick/grey split, gable, porches, signs and "53" all read from
near-frontal photos. Medium on the roof height and pitch. Low on the Park Place side detail and the rear.
