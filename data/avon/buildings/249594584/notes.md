# Blueprint notes — OSM 249594584 — 15 South Avenue

## Identification (confidence: high)
Small white clapboard gable-front-and-wing house on the west side of South Avenue, just south of Genesee St. House number "15" is legible beside the door in the 2025 front photo, and the driveway/garage arrangement matches the footprint's rear-left lobe. Not to be confused with the beige shingled two-storey ("67", mauve shutters) in the foreground of the `-u` photos — that is the neighbour on the corner, and in those photos our house is the white one in the background.

## Frame
OBB 17.0 (u) × 17.1 (v) m; +u = 198° SSW, +v = 288° WNW. Road face `-v` (ESE, South Avenue); left end (0) of `-v` is SSW (+u). Polygon is an L: the 9 m front at v = −8.5 spans u −0.5…8.5; the u < −1.5 part starts 5.6 m back at v = −2.9 — that lobe is the (OSM-merged) garage. Flat lot.

## Photos used
- `front_249594584_-v.png` (2025, 28° off, 9.8 m out) — main read: whole front, hood, sunroom, garage.
- `front_249594584_-u.png`, `_-u_2.png` — both are actually taken from South Avenue to the NNE, so they show the same ESE front obliquely plus the wing's NNE gable end and chimney; used for roof form and the triple window. `_-u_3.png` shows a different (cream, mauve-shuttered) house head-on — not ours; ignored.
- `front_249594584_+u*.png` — mostly trees; `+u` shows the SSW side from the road: two upper windows (front one shuttered), a wide lower window near the front.
- `front_249594584_+v.png` — old blurry Street View from the road (169° off, i.e. from the front); confirms gable-front + wing + garage, but window count differs (older siding); 2025 wins.
- Overhead: the house lies off the left edge of `overhead_labeled.jpg` (no coverage); no card-based roof read possible beyond the photos.

## Reading face by face
- `-v` (road, ESE): left 5.5 m is the two-storey upright with the street gable (~40° pitch, low eaves just above the upper window heads); upper storey 2 windows with pale grey louvered shutters, lower storey 2 windows (left one shuttered). Right of it, the two-storey wing, ~4 m wide, set back a whisker, side-gabled (ridge along u) with lower eaves; upper: one wide 3-light window centred; lower: front door with a small gabled hood and "15" beside it, a window to its right. Further right a one-storey enclosed sunroom (band of windows, shed/low roof) set back ~1.5 m. Then the driveway and the white gable-front garage with a big sectional door, its front ~5–6 m behind the house front. White clapboard, grey asphalt roofs, brick chimney on the wing ridge beside the upright.
- `-u` (NNE): wing gable end, blank apart from a possible small window; the sunroom sits in front of its lower half toward the street; garage beyond.
- `+u` (SSW): upright's long side; 2 upper windows toward the front, one wide lower window.
- `+v` (rear): not photographed; kept plain with a low rear shed.

## What was modelled / exaggerated
Five volumes: upright (u 3.0…8.5, gable ridge v, eaves 5.7, ridge +2.4), wing (u −0.8…3.0, ridge u, eaves 5.0, chimney at the junction), hip-roofed sunroom, gable-front garage with a `garage` door on `-v`, low hip rear shed. Signature features pushed: the tall narrow street gable with its four shuttered windows, the wide triple window over the hooded door, the sunroom, and the big white garage door at the end of the drive. Three bushes along the front fence line.

## Approximations / schema gaps
- The gabled door hood is modelled as a tiny `open` porch (2 posts, gable roof, 1 step); the schema has no bracketed hood without posts.
- Shutter colour is pale grey (#9aa0a4) to read as shutters against the white wall; real ones are near-white grey.
- The garage is in the OSM polygon, so it is a volume of this blueprint (u −8.5…−3.2, v −2.9…4.5); the real gap between sunroom and garage (fence, ~3 m) is compressed.
- Rear extent (v > 1.5) is guessed as a low shed; no photo coverage.
- `render_bp -u` camera lands inside the neighbour; the `-u` check was done from bearing 60° instead (`render_249594584_60.png`), which matches the `-u` photos' viewpoint.

## Confidence
High on the front elevation and massing (upright + wing + hood + sunroom + garage); medium on the wing depth and chimney position; low on the rear.
