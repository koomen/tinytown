# Blueprint notes — OSM 248361683 — 65 East Main St

## Identification (confidence: high)
Not a brick commercial building (the generic style was wrong). It is a pale yellow-green
clapboard two-storey house with a low hip roof and cream trim, converted to a small shop:
a one-storey enclosed front porch with a hip roof runs the full width and wraps into a
one-storey east (+v) wing; two large dark-framed display windows (purple heart decals in
Sep 2025) and a cream door with a few steps sit under it. A two-storey gabled rear wing
stands behind. Business name not legible — no sign modelled. Immediately west (-v) is the
Avon Inn (248290078, already blueprinted).

## Frame
+u = road face (NNE, East Main St), 15.9 m; left end of +u lies toward +v (ESE). +v/-v are
the 19.8 m deep sides. Flat lot.

## Photos used
- `front_248361683_+u.png` — head-on, partly behind a street tree and a lamp post but the
  whole front is readable. Primary source.
- `front_248361683_+v.png`, `+v_2.png` — obliques from the ESE: hip main block, one-storey
  wing in front, gabled rear wing with its gable end facing +v.
- `front_248361683_-u.png` — aimed at the WRONG building: shows the Avon Inn's white
  Temple St wing (80° off, 60 m out). Not used.
- `front_248361683_-v.png` — the Avon Inn's colonnade stands between camera and face;
  shows only the Inn. Not used; -v face kept plain.

## Reading face by face
**+u (road).** Full-width one-storey front (~15.9 m): left third is the wing front with a big
display window; right two-thirds is the main block's porch front with the door at ~0.2 from
the left and the second display window at ~0.7. Above it the two-storey main block
(~10 m wide) with three upper windows and a low dark hip roof with cream eave. Two wall
lamps, steps to the door.
**+v (ESE side).** Wing side ~6 m with a small window; main block with two windows per
storey; behind, the rear wing's gable end with a window per storey.
**-v (WNW side).** Not visible; plain two windows per storey.
**-u (rear).** Not photographed; two windows per storey and a back door.

## What was modelled / exaggerated
- `main` hip block 10 × 10 m, 6.8 m eaves, cream cornice, three upper windows on the front.
- `front-porch` + `east-wing`: two 3.1 m hip-roofed one-storey volumes at the same height so
  the fascia reads as one L-shaped enclosed porch; dark-framed `storefronts` (no kick) for
  the two display windows, cream door with dark surround, lamp and two steps.
- `rear-wing` two-storey gable (ridge v, capped at 2 m).
- Three bushes along the front, as in the photo.

## Approximations / schema gaps
- Lint warns volumes cover only 60% of the footprint; the OSM polygon is generous (likely
  includes a rear deck/garage) and the photos show nothing else, so left as is.
- Display windows are storefront glass, not the dark decal-covered panes.
- No business sign (name not legible in the imagery).
- Gable `pitch` is rise ÷ full span — `maxH` used to keep the rear ridge low.

## Confidence
Identification high; road face high; +v side medium; -v and rear low (no usable photo).
