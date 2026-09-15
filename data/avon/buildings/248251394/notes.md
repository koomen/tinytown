# 248251394 — 102 Genesee Street ("The Foot Doctor")

## Identification
Two-storey greige clapboard house converted to a podiatrist's office ("THE FOOT DOCTOR" sign on the porch wall), on the west side of Genesee St just south of the Community Bank (90 Genesee, 248251397). All seven photos show the same building from consistent angles, and the EV-charger lot in the -v photos matches the green stalls in the overhead beside label 1394. Confidence: high.

## Frame
OBB 17.2 m (u) × 11.8 m (v); +u = 287° WNW = Genesee St (road face), +v = 17° NNE (toward the bank). Flat lot. The OSM rectangle includes the ~2.4 m porch depth at the street end, so the walls occupy u ≤ 6.2 and the porch fills u 6.2..8.6.

## Photos used
- `front_248251394_+u.png` (Aug 2025, 12° off): the primary read — whole front, porch, sign.
- `front_248251394_-v.png` / `_-v_2.png`: SSW side, gable block windows, rear wing peeking past the block.
- `front_248251394_-u_2.png` (rear, 6° off) and `_-u.png` (oblique): rear gable, red door, one-storey rear wing.
- `front_248251394_+v.png` (very close, 58° off): cross-gable end of the NNE wing with its two gable windows and the low rear wing. `_+v_2.png` is aimed at the bank's rear wall and shows only a sliver of this house — not used.
- `card_248251394.png`, `overhead_labeled.jpg` (too coarse for roof form here).

## Reading face by face
- **+u (street, 11.8 m, left = NNE):** Left ~38%: a 1.5-storey wing whose roof slopes toward the street (cross gable, ridge along v, gable end on +v); one ground-floor window behind the porch. Right ~62%: the 2-storey gable-front block, eave ≈5.5 m, roof pitch ≈30°, two 1/1 upper windows plus a small third window near the left, no chimney. Ground: front door with glass at the wing/block junction under a small white pediment, one window right of it, white "THE FOOT DOCTOR" sign at the far right. Full-width open porch: raised ~0.45 m, white square posts (4 + 2 pediment posts), white railing, 3-4 steps centred on the door, shallow hip roof, grey floor. Greige siding, white trim, charcoal shingles.
- **-v (SSW, 17.2 m, left = street):** The 2-storey block occupies the front ~9.5 m: upper storey one window left + a close pair right, ground one window left; utility boxes along the base. A one-storey grey wing with a low roof shows past the block's rear corner.
- **-u (rear):** Block gable end with two upper windows, one lower window right, and a dark red door at the junction with the rear wing; the one-storey rear wing (gable, ridge along u) with a wide window sits to the NNE.
- **+v (NNE):** The wing's gable end: two tall upper windows in the gable (one taller), a large + two narrow ground windows; behind it the low rear wing with a wide horizontal window; the porch end in front.

## What was modelled / exaggerated
- Main gable-front block (u -3.4..6.2, v -5.9..1.5, eave 5.5, ridge +2.3) with the two big upper windows and the small third one; three-window rhythm on -v; red rear door.
- Cross-gable wing (u 0.5..6.2, v 1.5..5.9, eave 4.0, ridge +1.8) with two small windows in the gable and two below.
- Rear one-storey wing (u -8.6..0.5, v 1.5..5.9, eave 3.0).
- Full-width white open porch as a top-level `porches` entry: face `+u`, v -5.9..5.9, backing onto the shared front wall plane u = 6.2 and spanning both front volumes; railing, six posts, three steps centred on the door (`stepsAt` 0.436 along the porch), shallow hip roof. The entry pediment is a small gabled face porch on the gable block's `+u` face at the door (its gable pokes just above the hip).
- The front door (`y: 0.45` so it stands on the porch floor), the two ground windows and the "navy" sign sit on the real faces: door, one window and the sign on `main-gable-block +u`, the other window on `cross-gable-wing +u`.
- Windows are fewer and larger than reality; colours mid-tone greige/white/charcoal.

## Approximations / schema gaps
- The front door really straddles the block/wing junction (v ≈ 1.5); it sits 0.7 m into the gable block (`at` 0.1 of that face, v ≈ 0.76) so it and its pediment stay on one face, under the small upper window.
- The entry pediment is a small gabled open porch rather than a true pediment on the porch fascia.
- The porch's small wrap around the -v corner is omitted. Utility boxes, fire hydrant and the lot are ignored.
- `+v` compare cannot be framed: the bank sits 8.4 m off that face, so `--dist 30` shows the bank's wall and `--dist 7` looks steeply down. Checked only that the gable and its windows exist.
- Coverage warning from lint (64%) is intentional: porch depth and the empty rear SSW corner.

## Confidence
High on identification, roof forms, porch and colours; medium on the exact depth of the 2-storey block vs. the rear wing (read from foreshortened side photos) and on the rear wing's plan.
