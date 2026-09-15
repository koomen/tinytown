# 249594582 — 75 West Main Street ("the red building")

## Identification (confidence: high)
The 2-storey barn-red brick house-form with a bright red standing-seam gable roof and a two-storey front porch at the West Main / South Avenue corner, immediately NW of 67 West Main (the cream house, 249594583). Confirmed in `front_+u.png` (head-on, 12° off) and both `-v` obliques; the `-u` photos show its low cream rear wing behind the parking lot on South Ave. No business name visible in OSM or on the building (the "Tire & Alignment Center" pole sign in the -v photos belongs to the lot next door).

## Frame
OBB 21.9 m (u, bearing 37° NE) × 8.5 m (v, 127° SE). The brief names `+v` (South Ave) the road face, but the building's *front* is the short `+u` end on West Main; the long `+v` side faces the 2.2 m gap to 67 West Main. Footprint is an L: the full 8.5 m width only from u≈0.7 to 11 (main block + enclosed porch); from u=-11 to 0.5 the +v edge steps in to v≈2.3 (rear wing). Base at street level, lot flat (<1 m).

## Photos used
- `front_249594582_+u.png` — the front, the main source.
- `front_249594582_-v.png`, `_-v_2.png` — long NW side and the rear wing.
- `front_249594582_-u.png`, `_-u_2.png`, `_-u_3.png` — rear wing gable end from South Ave; main-block rear gable glimpsed.
- `front_249594582_+v.png` — mostly 67 West Main; the red building's +v side visible at right (one upper window, one lower).
- `card_249594582.png` for the L footprint.

## Reading face by face
- **+u (West Main front, 8.5 m):** steep gable, ridge along u, red metal roof; gable end tan/khaki shingle with a paired window and a small vent. Second floor: open balcony across the full width, cream square posts, white balustrade; behind it red brick with a dark central door and a window either side. Ground floor: enclosed under the balcony, cream clapboard, big display window on the left half, cream door on the right, brick planter/step at the right corner.
- **-v (NW long side):** red brick both storeys; two upper windows (near the porch end and mid), a small cream gabled entry porch just right of centre with a window right of it. Then the 1-storey rear wing, red gable roof, cream/white siding, a couple of windows (van in front).
- **-u (rear gable end of wing):** cream siding, red roof, a door and a window; main block's rear gable behind it in red brick.
- **+v (toward 67 W Main):** plain brick, one upper and one lower window visible; the rest hidden by the fence — kept plain and regular.

## What was modelled / exaggerated
- Three volumes: `main-brick` (u 0.7–8.8, 6.4 m eaves, gable pitch 0.44 → 3.7 m ridge, red metal, tan gable), `enclosed-porch` (u 8.8–11, 3.3 m, cream, flat, brick plinth, storefront window + door), `rear-wing` (u -11–0.7, v -4.3–2.4, 3.0 m, cream, red gable).
- The upper balcony is an `open` porch with `floorH: 3.3` — its slab is hidden inside the enclosed-porch box below, so the balcony floor, posts, railing and red hip roof sit on top of the enclosed ground floor. This is the signature feature and is made a little grander (3 posts, full-width rail).
- Colours pushed: brick `#9a3f31`, roof `#b83a2d`, tan gable `#ab905f`, cream trim `#e3d9c1`.
- Cream gabled entry box on -v; two bushes at the front.

## Approximations / schema gaps
- `gableColor` is per volume, so the rear (-u) gable of the main block is tan like the front; in reality it is red brick.
- No stacked-porch primitive: the two-storey porch is faked as enclosed box + raised open porch (slab buried). The real balcony ceiling is the main roof continued; here it is a separate red hip.
- The ground-floor display window is one `storefront` panel; the real one is a single big pane with a transom.
- The chimney is a guess (a small stack shows near the ridge in `-v_2`).
- Lint warning: door `y: 3.3` is intentional (door onto the balcony floor).

## Confidence
High on massing, roof, colours and the two-storey porch; medium on window positions on -v/+v and the rear wing's openings (van, fence and obliques).
