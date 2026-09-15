# Blueprint notes — OSM 248252391 — house between 51 W Main and Rivoli Dental (south side of West Main St)

## Identification (confidence: high)

- `front_248252391_-v.png` (7° off head-on, 20 m out) has the target dead centre: a white clapboard L-plan Victorian with a gingerbread front gable. To its left (photo) is the tall side-gabled house with a fieldstone basement (the neighbour `248252394`, commercial, which fronts Rivoli Dental), to its right the tan house with the outside stair and green shutters (51 W Main, `248252384`). Neighbour bearings in the brief match (`+u` = SE = photo-left, `-u` = NW = photo-right).
- OSM gives no address; the earlier note ("cream/white Victorian, front gable with gingerbread trim, ornate porch") is confirmed.

## Frame

- OBB 9.5 m along u × 17.2 m along v; +u bears 129° (SE), +v bears 219° (SW, away from the street). Road face `-v` (NE); left end (0) of `-v` = `+u` = SE toward Rivoli Dental.
- Lot slopes 1.9 m (rises toward the back/NW); no plinth added. The house does sit a little above the sidewalk on a lawn bank — left to the renderer's foundation.

## Photos used

- `-v.png`: the whole front elevation — primary source.
- `-u.png`: the NW side, reasonably head-on: the two-storey front wing with a hooded window, then the lower rear section with a small high window, a shed canopy over a side door, stone steps climbing the bank, a ground-floor window and big shrubs.
- `-u_2.png`: mostly a tree and 51 W Main's porch; not used.
- `+u*.png`: 67°/53°/43° off-axis from the SE — the target is hidden behind Rivoli Dental and a street tree in all three. `+u_3` is a bus. Not used.
- `+v*.png` (rear): show a derelict OSB-clad garage and a different house ("20") — aimed past the target. Rear inferred.
- Overhead crop (label 2391): long footprint with a ridge running back along v and the roof mass concentrated at the street end; consistent with the L-plan front + lower rear.

## Reading face by face

- `-v` (road, 9.5 m; left = SE). Fractions 0–0.55: two-storey side-gabled block (eave to the street, ridge along u), two tall 1/1 windows above at ~0.15 and ~0.4, a one-storey open porch across the full block width on turned posts with gingerbread brackets and a low white balustrade, shallow hip roof; under the porch a window with a wreath at ~0.15 and the front door (white storm door, lamp beside it) at ~0.5, right against the wing; a concrete walk leads straight to the door with two or three steps. Fractions 0.55–1.0: a steep front-gabled wing projecting ~1–1.5 m forward; a wide three-part picture window on the ground floor, two windows above with peaked hood mouldings, and an ornate lacy bargeboard with a sunburst/trefoil at the apex. White/cream clapboard, white trim, dark grey architectural shingles. No chimney visible from the front.
- `-u` (NW side, 17.2 m; left = NE/street end): the wing's two storeys with tall hooded windows, then a lower rear section (lower eave) with a small square window high up, a small shed-roof canopy sheltering a side door reached by steps, and one ground-floor window.
- `+u` (SE side): not visible; two-over-two windows on the main block, two on the rear.
- `+v` (rear): not visible; plain with two windows.

## What was modelled / exaggerated

- Three volumes: `main` side-gabled block (u −0.5…4.75, v −7.1…1.5, eaves 6.0 m, ridge along u); `front-gable-wing` (u −4.75…−0.5) pushed 1.5 m forward to v −8.6 with a steep gable (pitch 0.62, ridge 2.7 m) so it towers over the main block as in the photo; `rear` lower section (eaves 4.3 m, ridge along v) with a chimney near the junction.
- Signature features, slightly enlarged: the steep gingerbread gable (a small round ornament at the apex stands in for the sunburst), the two hooded upper windows, the wide three-part window (2.5 m, mullioned), the full-width open porch with railing and steps at the door, the door with its lamp.
- Fewer/larger windows than reality; rhythm kept (two over two on the main block, two over one-wide on the wing).
- Side door under a gabled entry-box porch on the rear's `-u` face; two front bushes (the big yew right of the walk, a smaller one at the porch corner).

## Approximations / schema gaps

- No bargeboard/gingerbread or turned-post ornament in the schema; the round "window" at the gable apex is the only hint. Porch posts are plain squares.
- Window hood mouldings rendered with `hood: true` (a flat hood, not the peaked Italianate profile).
- Rear volume shape and the `+u`/`+v` faces are inferred.
- `--compare` renders for `-u` and `+u` land inside the 3.9–4.1 m-away neighbours, so the side was checked with `--iso` only.

## Confidence

- Identity: high. Front elevation: high. NW side: medium. SE side and rear: low-medium.
