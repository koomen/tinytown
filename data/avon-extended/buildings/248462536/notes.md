# 248462536 — 56 East Main Street (house)

## Identification
Two-storey tan/beige clapboard house with a dark brown-grey hip roof, a full-width open front porch with white posts and railing, a central front door with the brick path leading straight to it, a white-painted brick chimney toward the rear of the main ridge, and a one-storey hipped rear wing set toward the ESE (-v) side (the footprint notch). Confidence: medium — the head-on street photo is almost entirely hidden behind a large copper beech; the reading is stitched from obliques.

## Frame
OBB 23.5 m (u) × 13.3 m (v); +u bears 193° (toward the street), +v 283° (WNW, toward 50 East Main). Road face `+u`, left end = +v (WNW). Footprint is an L: front block u -4.5..11.7 full width; rear wing u -11.7..-4.5 only on v -6.6..1.1. Flat lot.

## Photos used
- `front_248462536_+u.png` (6° off) — the copper beech hides the house; only the white porch railing, posts, porch roof edge, the dark central doorway with a flag, the hedge gap and brick path to the centre are visible.
- `front_248462536_-u.png` (160° off, i.e. from the street on the WNW side) — best overall view of the tan house behind the tree: 2 storeys, hip roof, white full-width porch, white trim.
- `front_248462536_+v.png`, `_+v_2.png` — porch end from the WNW: white railing, flag, a side stair at the WNW end of the porch.
- `front_248462536_+v_3.png` (0° off, from the shared driveway) — WNW side: 2-storey block with hip roof, white-painted chimney at the ridge toward the rear, 2nd-floor window with an AC unit, one-storey wing with a low dark roof behind, garage further back; porch roof at the right edge.
- `front_248462536_-v_2.png`, `_-v_3.png` — from the ESE: tan house with a dark brown hip roof and white porch posts, seen past the hedge and the orange stucco neighbour.
- `front_248462536_-v.png` — aimed at the orange stucco neighbour (fanlight dormer); not this building.
- Overhead: labels 2534/2536 fall outside `overhead_labeled.jpg`.

## Reading face by face
- `+u` (street, 13.3 m): eaves ≈ 6.4 m, shallow hip. Three upstairs windows (0.2 / 0.5 / 0.8 chosen), porch across the full width with ≈ 5 posts and a white railing, floor ≈ 0.8 m up, hip porch roof, central door (dark) with steps to the brick path; a wide window each side of the door under the porch.
- `+v` (WNW, 16.2 m on the main block): upstairs three windows, downstairs two; chimney at the ridge ≈ 3 m behind the front-block centre; the wing's +v face is recessed 5.5 m.
- `-v` (ESE): mirrored plain reading; wing face flush with the main -v wall.
- `-u` (rear): unseen; upstairs windows, a back door on the wing.

## What was modelled / exaggerated
- Main block hip roof (`pitch 0.35, maxH 2.8`), dark brown-grey `#5b4d45`, tan wall `#c9b998`, white trim.
- Full-width open porch (`d 2.6, height 2.9, floorH 0.8`, 5 posts, hip roof, railing, 4 central steps) as the signature feature, with a dark fanlit central door.
- Chimney on the ridge at u -1.8 (white-painted in reality; chimneys have no colour option).
- One-storey rear wing `u -11.7..-4.4, v -6.65..1.1`, hip roof, pushed 5 cm proud of the main -v wall to avoid coplanar z-fighting; back door and windows on it.

## Approximations / schema gaps
- Window count/positions on the street face are a caricature guess (hidden by the tree); the side stair at the WNW porch end is not modelled (one set of steps only).
- Chimney colour (white-painted brick) not expressible.
- `stepsAt 0.5` is unaffected by the open-porch mirroring bug noted in `blueprint_248462534.notes.md`, since it is centred.
- No visible photo of `-u`; kept plain. Detached garage behind not modelled.

## Confidence
Medium on massing, colours, porch and roof form; low on exact window rhythm of the street face; low on the rear.
