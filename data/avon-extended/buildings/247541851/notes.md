# 247541851 — 40 East Main Street (corner of North Avenue)

## Identification
Large grey vinyl-sided 2.5-storey American Foursquare on the north-east corner of East Main St and North Avenue. Pyramidal hip roof with hipped dormers, centre chimney, full-width front porch on Tuscan columns that continues along the east side as a porte-cochère over the driveway. Black shutters, white trim. Confidence: high (the -v oblique photo shows the whole house from the south-east, the +u photo shows the porch and brick walk head-on).

## Frame
OBB 18.5 m (u, NNE–SSW) × 17.0 m (v, WNW–ESE). +u = SSW = East Main St (the real front); +v = WNW = North Avenue (the "road face" by distance); -v = east driveway side; -u = north rear (toward 18 North Ave). Flat lot. The OBB includes the porch and the porte-cochère, so the hip block is drawn as u ∈ [-6.8, 6.3], v ∈ [-5.8, 8.5] with the porches added outward from its faces.

## Photos used
- `front_247541851_-v.png` / `_-v_2.png` (from the SE, on East Main): best overall view — whole front elevation, dormers, chimney, porte-cochère with flag. Used for bay rhythm and roof form.
- `front_247541851_+u.png`: head-on front but mostly tree; shows the column porch, brick walk, central steps and the porte-cochère columns at the right (east).
- `front_247541851_+v.png` / `_+v_2.png` (North Ave, road face): mostly blocked by a big maple; shows the north end with a 2nd-floor window (AC unit), a one-storey hip wing at the NW corner, hedge, porch columns at the south end.
- `front_247541851_-u.png` / `_-u_2.png` (from the NW on North Ave): rear — gable end with attic window facing north, hipped dormer on the west slope, a two-storey square bay with shutters on the North Ave face, a small rear stoop with flag at the NE.
- Satellite crop: confirmed the pyramidal hip (four hips meeting at a short ridge), the pale porch roof along the whole south side wrapping ~half-way up the east side, and the darker gable at the NW.

## Reading face by face
- **+u (south front)**: 2 storeys under a wide hip; 2nd floor about four bays of 1-over-1 sash with black shutters; ground floor behind the porch: door at centre with sidelights, large windows either side. Full-width porch, ~6 Tuscan columns, hip porch roof, 3 steps at centre on a brick walk. Hipped dormer centred on the front slope.
- **-v (east)**: same window rhythm; porte-cochère (porch roof continues over the driveway) on the south half; a side door under it; hipped dormer on the east slope; small rear stoop at the north end with a US flag.
- **+v (west, North Ave)**: two-storey square bay with 3-light windows north of centre; hipped dormer; single shuttered windows; one-storey hip kitchen wing at the NW corner.
- **-u (north)**: two-storey gable-ended rear wing with an attic window, flanked by the NW kitchen wing and the NE stoop.

## What was modelled / exaggerated
- Pyramidal hip (`maxH` 4.0, overhang 0.6) with three dormers as `roof.dormers` on the +u, -v and +v slopes (one centred per slope, 1.3 × 0.9 m window, gable cap) and a centre chimney.
- Full-width column porch (6 posts, no railing, 3 steps) plus a second open porch on the east face as the porte-cochère (posts, no floor to speak of, no steps).
- Four large shuttered 2nd-floor windows per long face; fewer, bigger windows than reality.
- Two-storey square bay on the North Ave face as a `faces["+v"].bays` entry (at 0.34, 2.6 × 0.8 m, y0 0 → y1 6.8 = the eave, flat cap, its own two storeys of 2.0 m mullioned shuttered windows, side lights).
- Rear gable wing, NW one-storey hip wing, NE stoop with railing, flag, foundation hedges.

## Approximations / schema gaps
- Dormers and the bay are now real schema features (`roof.dormers`, `faces[].bays`); the dormer caps are small gables rather than the hips in the photos.
- Open-porch `range` must stay within 0..1, so the porch corner where the front porch meets the porte-cochère is left open (no roof over the SE corner square).
- The lint warns that volumes cover only 68 % of the footprint — the remainder is the porch/porte-cochère strip, which is intentional.
- Exact positions of the rear wings are guessed from the satellite and oblique views; the NW kitchen wing may in reality sit further west.

## Confidence
High on the main block, roof form, porch and colours; medium on the rear (north) wings and the bay position.
