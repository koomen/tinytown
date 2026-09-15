# 248342249 — 38 North Avenue

## Identification
Small one-storey post-war ranch: greige vinyl siding, low medium-grey hip roof, a shallow open porch across the left ~60% of the front, white front door with a black barn star beside it. **Confidence: medium-high.** The neighbour list fixes it: from the road (`-u` photo, looking ESE) 42 North Ave is on the left (NNE) and 32 North Ave on the right (SSW). The cream 2.5-storey house with the arched portico that dominates the right half of `-u.png` and the whole of both `+v` photos is 32 North Ave (248342246), NOT this building. The detached garage 248342248 is visible at the end of the driveway on the SSW side, behind the ranch, which matches the footprint's rear wing being offset toward +v.

## Frame
OBB 22.1 m (u) × 14.3 m (v); road face `-u` (WNW). The polygon is an L: main block u −11.1..4.3 × v −7.1..2.6 (about 15.4 × 9.7 m) and a rear wing u 4.3..11.1 × v ~0.7..7.1 with a slightly skewed inner edge. On the `-u` face fraction 0 is the NNE (−v) end = left of the photo. Flat lot.

## Photos used
- `front_248342249_-u.png` — head-on road face, 8° off; a utility pole covers the right post of the porch but the whole facade is legible. Primary source.
- `front_248342249_+u.png` — labelled `+u` but taken from the street (176° off head-on): another front view, slightly further out. Used to confirm the porch extent and window positions; the rear is not photographed.
- `front_248342249_-v.png`, `_-v_2.png` — oblique from the NNE: the ranch is centre-right behind a street tree; confirm the low hip and that the porch is at the NNE end of the front.
- `front_248342249_+v.png`, `_+v_2.png` — aimed at 32 North Ave; the ranch is only glimpsed behind it. Used just to confirm the hip roof and a lower rear section.
- Overhead too coarse (label 2249 near the top right); the footprint card gave the wing.

## Reading face by face
- **-u (road, 9.7 m of main block):** one storey, eaves ~3 m, low hip roof, thin fascia. From the left: an open porch from the corner to just past the door (~0.6), its roof continuous with the main roof, two slim white posts; a wide triple window at ~0.25; the white front door at ~0.5 with a small stoop and iron rails; then outside the porch a twin window at ~0.8. Satellite dish on the right roof slope. No visible chimney.
- **-v (NNE side, 15.4 m):** plain siding, a few small windows.
- **+v (SSW side):** glimpsed only; windows and (assumed) a side door onto the driveway.
- **Rear wing:** lower hip-roofed block offset toward the SSW (driveway/garage) side.

## What was modelled / exaggerated
- Main block as one volume, eaves 3.0 m, hip ridge along u, `maxH` 1.9 (kept low; first pass at 2.3 looked too tall against the photo).
- Porch as an `open` porch over `range [0, 0.62]`, 1.8 m deep, three posts, near-flat hip roof in roof grey, no railing, two steps at the door.
- Triple window widened to one 2.4 m window at 0.24; twin window as one 1.8 m window at 0.8; white door at 0.5 lifted onto the porch floor.
- Rear wing u 4.2..11.1 × v 0.9..7.1, eaves 2.8 m, low hip, a window per face.
- Low plinth, three foundation shrubs along the front.

## Approximations / schema gaps
- The real porch is recessed under the main roof; the schema's open porch projects from the wall instead, so the porch reads as an add-on rather than an inset. Acceptable at diorama scale.
- The skewed edge of the wing (polygon vertices 1→2) is squared off.
- The satellite dish and barn star are not modelled.
- Both default renders (`--dist 30`, camera 8 m up) look down onto the roof of this 3 m building; use `--height 2.5` for a photo-like view. The `-v` compare also has the generic neighbour 42 North Ave's roof in the foreground.
- Side and rear openings are inferred.

## Confidence
Medium-high on identity and the front elevation; medium on the wing's height and the side openings.
