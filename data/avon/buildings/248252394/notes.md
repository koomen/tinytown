# Blueprint notes — OSM 248252394 — Rivoli Dental, 37/39 West Main St

## Identification
2-storey tan/khaki clapboard front-gable Victorian with dark maroon trim, a full-width two-level porch/balcony (wood balustrade), a big shop-style ground-floor window on a fieldstone base, a door to its right, and a long white 2-storey gable rear addition. Rivoli Dental (banner reads RIVOLI). Confidence: high on appearance of the road face; medium on the address (Yelp: 39 W Main).

## Frame
OBB 28.9 m along u x 10.9 m along v; +u bears 217° (SW), +v 307° (NW). Road face is `-u` (NE, W Main St). Footprint is a plain rectangle. Lot drops 2.0 m toward the rear (+u) — the renderer carries the rear on a foundation, which shows in the +u render as intended.

## Photos used
- `front_248252394_-u.png` and `sv_248252394_a.png` / `sv_248252394_c.png` — the road face. The right half is hidden behind a street tree in all of them; the left half (shop window, balcony, gable) is clear.
- `front_248252394_+u.png`, `front_248252394_+u_2.png` — a white 2-storey clapboard gable end with 2+2 windows and a raised deck with steps ("20" on the newel). Taken 53–57 m out and ~50° off head-on; I take it to be the rear of the long white addition (consistent with the overhead's single long bar and the earlier note), medium-low confidence.
- `front_248252394_+v.png`, `+v_2.png` — these show the cream/white-trim neighbour (248252391) with its rear ell and porch, not this building. Not used.
- `front_248252394_-v.png` — wide shot with an RTS bus; the neighbour 248252397 fills it, only a sliver of this building's balcony railing shows at the right. Not used beyond confirming the balcony runs to the -v corner.
- `overhead_labeled.jpg` (label 2394) — one long gabled bar from the road SW-ward, no side wings.

## Reading face by face
- `-u` (road, 10.9 m): front gable, fairly steep (~35–40°), khaki clapboard with maroon bargeboard/trim, dark grey shingle roof, no visible chimney. Two-level porch spanning the full width: at ground a shop window (maroon-framed, multi-pane, roughly 0.07–0.52 of the face) sitting on a fieldstone base about 0.9 m high, a maroon-framed door right of centre (~0.66), open porch corner with railing at the far right. Balcony floor at ~3.2 m with orange-wood spindle railing and a maroon spindle frieze under it; maroon posts; balcony roof flat-ish under the gable eaves. Upper storey behind the balcony: window at left, glazed balcony door right of centre.
- `+u` (rear, 10.9 m): white clapboard gable end, 2 windows per storey (left-of-centre and right-of-centre), white trim, eaves a little lower than the front block, raised deck at the left corner.
- `+v` / `-v` (28.9 m sides): no usable photo. Kept plain: 2 windows per storey on the front block, 3 per storey on the rear wing.

## What was modelled / exaggerated
- Front gable block 10 m deep, eaves 7.4 m, pitch 0.7, khaki walls, maroon trim, dark roof.
- The two-level porch: an open porch on the -u face with `floorH: 3.2` (its slab box becomes the ground-storey porch mass), 4 maroon posts, railing, flat dark roof at ~6.1 m; a thin `shopfront` volume (u -14.5..-11.9, 5 cm outside the slab) carries the maroon storefront window on a stone plinth, the door with fanlight and a step. Balcony door and window sit on the main face at `y: 3.2`.
- Rear wing 16.4 m long, white, eaves 6.0 m, pitch 0.5, 2 windows per storey on the gable end, 3 per storey on each side.
- "Rivoli Dental" navy lawn sign by the road.

## Approximations / schema gaps
- No true two-level open porch in the schema; faked with a tall `floorH` slab plus an overlapping shopfront volume. Works visually, but the ground-floor porch corner at the right is closed rather than open, and the spindle frieze is just the porch fascia.
- Balcony spindles are maroon (one `postColor`), not the orange wood of the photo.
- Rear deck and steps omitted (the lot drops ~1.7 m there and a porch slab would float).
- `+v` / `-v` windows are guesses; the +u reading is medium-low confidence.
- Lint warning about the balcony door `y: 3.2` is intentional (door stands on the balcony floor).

## Confidence
Road face: high. Rear: medium-low (photo may be the right building). Sides: guessed.
