# 248342243 — 18 North Avenue

## Identification
Sage-green Dutch Colonial with cream trim and a dark charcoal gambrel roof, on the east side of North Avenue just north of the big foursquare at 40 East Main. Side gambrel (ridge parallel to the street), two gabled dormers in the steep front slope, a centred front-facing cross gambrel (barn-shaped gable) with a triple window and a small attic window, full-width raised porch on Tuscan columns with white railing and central white steps, dark front door with an oval light, stone foundation. Confidence: high — the +v photo is nearly head-on and unobstructed, and the north-side photos confirm the gambrel ends.

## Frame
OBB 11.6 m (u, NNE–SSW) × 15.0 m (v, WNW–ESE). Road face +v = west (North Ave); left end of +v is north (-u). The OSM polygon has a 3.4 × 5.6 m notch at the north-west (front) corner that no photo supports — the front elevation is continuous across the full width — so the body is drawn as u ∈ [-5.8, 5.8], v ∈ [-5.0, 5.1] with the 2.4 m porch in front, and the polygon's rear strip becomes a one-storey rear wing at the east (u ∈ [-3.4, 5.8], v ∈ [-7.5, -5.0]), matching the low rear section seen in the +u photos.

## Photos used
- `front_248342243_+v.png` and `front_248342243_-v.png` (the "-v" capture is actually 173° off, i.e. another head-on street view): the whole front elevation, bay by bay.
- `front_248342243_-u.png`, `_-u_2.png`, `_-u_3.png` (from the north along the street): north gambrel end with two 2nd-floor windows and an attic window, the front-slope dormer, porch at the west, the neighbour 24 North Ave (red/tan) to the north.
- `front_248342243_+u.png`, `_+u_2.png` (from the south along the street): south gambrel end, side door with a stoop, low rear section at the east.
- Satellite crop for the plan; inconclusive on the notch (tree shadow).

## Reading face by face
- **+v (west, street)**: ground floor — window, [porch: window, oval-glass door at centre, window], window; porch roof is a shallow hip on 4 posts with a white railing, 5 steps at centre. Upper — steep lower gambrel slope with a gabled single-window dormer left and right (about 0.18 / 0.82 across), the central cross gambrel with a triple window on the 2nd floor and a small attic window in its upper gable; upper slopes shallow. Sage siding, cream trim, near-black roof.
- **-u (north)**: gambrel end — two ground-floor windows, two 2nd-floor windows, one attic window; cream trim traces the barn profile.
- **+u (south)**: same gambrel end plus a side door with a little stoop at ground level; a one-storey rear section at the east end.
- **-v (east, rear)**: not photographed; kept plain with two windows on the rear wing and two on the body.

## What was modelled / exaggerated
- The gambrel silhouette on the street — the signature — is a real `roof.type: "gambrel"` on the body (ridge along u, eave at the first floor 3.5 m, ridge 4.7 m above it, knee at 0.66 of that and set in 0.28 of the half-span): steep lower slopes, shallow upper slopes, wall-coloured vertical gambrel ends at north and south carrying the two 2nd-floor windows and the attic window each.
- The two gabled front dormers are `roof.dormers` on the body's `+v` slope at 0.16 / 0.84, single rect window, sill 0.7 m above the eave, gable-capped.
- The front cross gambrel is a second gambrel volume (`cross`, 5.4 m wide, ridge along v toward the street, same eave and ridge height) whose gable end carries the door with fanlight, two ground-floor windows, the 2.4 m triple window and the small attic window; its rear end is buried in the main roof.
- Full-width raised porch, 4 posts, railing, 5 central steps; foundation plinth; four foundation shrubs.

## Approximations / schema gaps
- Dormers are rectangular boxes with a tiny gable cap; the dormer window has no glass-colour option, so it renders paler than the wall windows — fine at diorama scale.
- The cross gambrel's upper slopes are steeper than the main roof's (narrower span, same ridge height), which matches the photo's barn-shaped front gable.
- The OSM footprint notch at the NW corner was ignored (see Frame); the rear one-storey wing is placed at the east from the +u photos rather than from the polygon.
- The -u render camera lands inside 24 North Ave (7.8 m gap), so the north face was checked only via the +u render (mirror-image gambrel end) — it reads fine.

## Confidence
High on the street face, roof form, porch and colours; medium on the rear wing and side-window positions.
