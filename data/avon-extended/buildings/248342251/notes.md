# Notes — OSM 248342251 — 42 North Avenue

## Identification (high confidence)
Tall 2.5-storey pale-yellow vinyl-clapboard Colonial with white trim and slate-teal shutters, a dark grey side-gabled roof (ridge parallel to North Ave) with two gabled dormers on the street slope, a brick chimney on the ridge toward the SSW end, and a one-storey hip-roofed sunroom with tan pull-down shades hugging the SSW end wall. Confirmed by neighbour bearings: the grey one-storey ranch beside it in the +u photos is 38 North (blueprinted), the pale-blue two-storey house with the "48" on its porch post in the -u photos is 48 North.

## Frame
OBB 16.2 m (u, NNE–SSW along the street) × 10.1 m (v). Road face +v (WNW); left end of +v = -u = NNE (toward 48 North). Main block u [-8.1, 5.0] (13.1 m), sunroom u [5.0, 8.1] on the +u end, v [-3.0, 4.6]. Flat lot.

## Photos used
- `front_248342251_+v.png` (5° off head-on) — the road face; a big Norway maple hides the roof and part of the second storey, but all three bays are legible. `-v.png` is the same road-side viewpoint (177° off head-on), not a rear view; there is no usable rear photo.
- `front_248342251_+u_2.png` / `+u_3.png` — SSW gable end, the sunroom, the chimney, the right-hand dormer. `+u.png` is too oblique and tree-blocked.
- `front_248342251_-u.png` / `-u_2.png` / `-u_3.png` — NNE gable end (attic window, front portico, left-hand dormer above the triple-window bay). Partly tree-blocked.
- `overhead_labeled.jpg` — label 2251 sits at the frame edge, only useful to confirm the ridge runs along the street.

## Reading face by face
- **+v (street, 13.1 m main block)**: 2 storeys under a straight eave at ~6.6 m. Ground floor: wide shuttered triple window at ~0.2, front door at ~0.51 on a brick-red stoop under a small flat-roofed portico on two white round columns (3 brick steps), shuttered single window at ~0.86. Second floor: shuttered windows above each bay (0.2, 0.53, 0.86). Dark foundation band ~0.5 m. Two gabled dormers on the roof slope, each above an outer bay. To the right, the one-storey sunroom: hip roof, one wide opening with a tan shade between white pilasters.
- **+u (SSW gable end, 10.1 m)**: attic: a paired window at the peak; second floor: a shuttered window toward the front (~0.35) and a small window toward the rear (~0.72); ground floor entirely behind the sunroom, whose +u side shows two wide tan-shaded openings between three white posts. Brick chimney on the ridge just behind the gable.
- **-u (NNE gable end)**: small single attic window at the peak, one second-floor window right of centre; ground floor mostly behind shrubs (a small window visible). Kept symmetric and plain.
- **-v (rear)**: no photo; plain 3-bay elevation with a back door.

## What was modelled / exaggerated
- The two front gabled dormers, now real `roof.dormers` on the main gable (`faces: ["+v"]`, `at: [0.2, 0.86]` over the outer bays, 0.9 x 0.95 m rect window, sill 0.3 m above the eave so the dormer face sits at the eave as in the +u photos), and the ridge chimney — the roofline is what you see over the maple.
- The tall, steep side gable (maxH 4.2 m on a 10.1 m span).
- The three-bay rhythm with slate-teal shutters and the wide left window (one big window in place of the triple).
- The white-columned flat portico with brick-red stoop and steps.
- The tan-shaded sunroom on the SSW end, with its glass tinted tan to read as the shades.

## Approximations / schema gaps
- The sunroom's depth along v and whether anything fills the rear +u corner of the OSM rectangle is inferred (no rear photo); it is left as a notch.
- The rear face is invented. Real windows are smaller and more numerous (six-over-six sashes).
- Round columns rendered as square posts; the portico's flat roof is slightly bigger than life.

## Confidence
High on identification, form, colours and the street face; medium on dormer size and the sunroom footprint (dormer placement now follows the window bays); low on the rear face.
