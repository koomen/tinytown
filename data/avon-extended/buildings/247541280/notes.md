# Blueprint notes — OSM 247541280 — Pizza Land, 19 Park Place, Avon NY

## Identification
- Pizza Land, 19 Park Place ("Est. 1960 — The best pizza anywhere"). Overhead label 1280,
  south-west quadrant of the Memorial Park circle, east neighbour of the 15-17 Park Place block
  (247541316); a parking lot / driveway and then the fire hall lie to its east.
- Sources: head-on Street View captures listed below (Aug 2015 / Aug 2021 / Aug 2023 / Aug 2025
  panos), earlier oblique shots `sv_247541280_{a,b,c}.png`, the research note in overrides.json.

## Frame
- OBB 19.6 m along u (+u = 194°, i.e. front-to-back toward the south), 9.7 m along v
  (+v = 284°, west). Road face is **-u** (looks NNE at 14° toward the circle / Park Place).
- `-v` = east flank (parking lot side, visible from Park Place). `+v` = west party wall with
  247541316 (the 1-storey stone link and stone rear of 1316 sit against it, so its upper part is
  exposed). `+u` = rear, on the bank parking lot.

## Photos (head-on)
- `front_247541280_-u.png` — front from Park Place (from the earlier test capture).
- `front_247541280_-v.png`, `front_247541280_-v_40.png` — east flank, but only obliquely from
  the "61 Park Pl" pano at the circle; Google has no pano inside the parking lot.
- `front_247541280_+u.png` — rear gable end from the bank lot (Aug 2023).
- `front_247541316_-v.png` (Aug 2015) also shows the front + the tan rear box beside the mansard.

## Reading, face by face
**-u front (9.7 m).** One storey of red-brown brick to ~3.2 m with a white fascia board, then a
very steep, nearly vertical dark-brown shingled mansard rising to ~7 m with a small dark cap.
Three bays: wide white-framed sliding window (left, ~2.5 m) | recessed centre door with a tiny
stoop and two carriage lamps | wide white-framed window (right). Big red sign with cream
lettering "PIZZA LAND — Est. 1960" centred on the mansard at ~5 m, ~5.3 m wide, with a string of
lights along a wooden rail under it. Left (east) edge of the mansard hips back onto the flank;
right (west) edge is a straight party-wall edge.

**-v east flank.** The mansard wraps onto the flank for ~4–5 m and carries a second, smaller red
"PIZZA LAND" sign; one white window under it. Behind it the rest of the building is a taller
tan/beige vertical-metal-sided box (2 storeys, ~5.6 m eaves) with a low gable roof, ridge running
front-to-back; a side door with a small stoop sits right at the junction, then two windows per
floor.

**+u rear (9.7 m).** Tan metal gable end; one white window upper-left, white door lower-right
with a small canopy, a recessed corner porch at the east corner, and a low tan lean-to shed in
front of the west half (outside the footprint, not modelled).

**+v west party wall.** Blank tan siding above the 1-storey stone volumes of 247541316.

## What was modelled (and exaggerated)
1. Brick base + dark shingle mansard band + red sign = the identity. The mansard is modelled as
   an `upperWall` band (dark shingle brown `#5a4334`) over brick `#6f3d30` from `split` 3.3 m up to
   7.2 m with a thin dark cornice and a dark flat cap — the schema has no true mansard; a truncated
   hip (`flatTop`) would have buried the sign inside the slope, and a capped steep gable reads as a
   normal roof. The white fascia is a belt course at 3.3 m.
2. Sign `style: red` ("PIZZA LAND · EST. 1960", 5.4 × 0.8 m) on the front and a 3.2 m one on the
   east flank of the mansard section.
3. Two wide white sliding windows + dark centre door with a step on the front.
4. Rear volume: tan `#c4a67b` box, 5.4 m eaves, low gable (pitch 0.15) so the ridge stays just under
   the mansard cap, as in the photos (nothing shows above the mansard from the street). Side door
   with two steps at the junction, two windows per floor on the flank, window + door on the rear.

## Approximations / gaps
- Mansard slope, the wooden light-rail under the sign, the carriage lamps, the recessed entry and
  the cartoon pizza-cook roundel on the sign are not expressible; the mansard's east hip is not
  modelled (band is vertical on all sides).
- No head-on view of the east flank exists (parking lot has no pano); the flank was read from the
  oblique "61 Park Pl" pano. The rear lean-to shed and the recessed rear corner porch were skipped.
- Mansard-section depth (4.5 m) is estimated from the oblique 2015 photo.

## Confidence
High on identity, front bays, colours and massing; medium on the flank/rear openings.

## Owner correction — 2026-09-19
Moved the chimney from Avon Fitness to the rear roof immediately behind the right end of the mansard, matching the supplied street view.
