# 248274710 — Avon Mini Mart (Sunoco), 11 East Main Street

## Identification
- Sunoco gas station + convenience store, listed as "Avon Mini Mart" (Yelp, Yellow Pages,
  Yahoo Local; GasBuddy station 25121 still lists the older "Exxon" branding). The store
  itself is signed "Avon MARKET" (gold script "Avon" over red block "MARKET" on a cream
  board). Fuel brand on canopy/price sign: Sunoco (blue/yellow). Sources:
  https://www.yelp.com/biz/avon-mini-mart-avon ,
  https://www.yellowpages.com/avon-ny/mip/avon-mini-mart-2805280 ,
  https://local.yahoo.com/info-232798689-sunoco-avon/ , https://www.gasbuddy.com/station/25121
- Street View Sep 2025 (front) and Aug 2025 (west side).
- Orientation (footprint card): +u bears 105 deg (ESE), +v 195 deg (S). Road face is -v
  (north, East Main St). Seen from the road, the LEFT end of the -v face is the +u (east)
  end. The Sunoco canopy (already a site extra) sits to the WEST (-u end), between the
  store and the circle — the earlier note saying "east of it" is reversed.

## Photos
- `front_248274710_-v.png` (55y) and `front_248274710_-v_2.png` (30y zoom): head-on north front.
- `front_248274710_-u_2.png`: head-on west face from the circle sidewalk (pano near
  42.91165,-77.74501, heading 110). `front_248274710_-u.png` is the same face blocked by a tree.
- `front_248274710_+u.png`: SV snapped to Temple St and shows only the neighbouring white
  house; the east face is not visible from any street. South (+v) face likewise hidden.

## Bay-by-bay reading
### -v (north, road) face, 19.1 m, left = east
Brick wall ~2.9 m, then a continuous dark brown fascia band ~0.85 m (eaves ~3.75 m).
Low brown asphalt-shingle roof. Two satellite dishes + rooftop units on the roof.
- 0.03–0.25: "Avon MARKET" board sign on the brick, ~3.6 x 1.3 m, centred ~1.9 m up.
- 0.275–0.63: white vertical-board false gable (about 45 deg pitch, peak ~3.4 m above the
  fascia), sitting on the fascia; a short cross-gable of shingles runs back from it.
  Under it, 0.38–0.53: big plate-glass display window (sill ~0.35 m, ~2.35 m tall) full of
  VAPE SHOP / BEER / CIGARETTES / PROPANE posters.
- 0.63–0.74: recessed dark aluminium double door (glass), ~2.0 x 2.7 m.
- 0.76–0.90: second display window ("CRAFT BEER"), same size, dark frame.
- Behind the roof at the east end (fractions ~0.09–0.24) a dark charcoal box (cooler /
  mechanical) rises ~1–1.5 m above the ridge.
### -u (west) face, ~6 m of brick (front part only)
Plain brick, no openings; fascia band wraps around; above it a WHITE GABLE END
(ridge along u, pitch ~0.5) — so the front part has a gable roof with white ends, and the
deeper east part behind it shows as a hip-roof trapezoid rising a bit higher. The dark
box shows above the roof toward the rear (right side in the photo).
### +u / +v
Not visible; left blank (brick + fascia only).

## Colour choices
- Brick `#79493b` (dark red-brown mid-tone), fascia/upperWall `#3b3028`, trim `#3a2f28`.
- Roof `#5b4536` (brown shingle). Gable ends `#e6e4de` (off-white siding).
- Door/frames `#2a2826`. Sign board `#efe9dc` with red `#b0262a` letters (via `opts`,
  which the Zion lawnsign exemplar also uses; harmless if ignored → plain "board").
- Cooler box `#3b3d41` / roof `#33353a`.

## Signature features (exaggerated a little)
1. Tall white false gable over the entry bay (pitch 0.8, peak ~6.5 m).
2. Dark brown fascia band over dark brick (two-tone via split at 2.9 m).
3. "Avon MARKET" board sign on the east bay, oversized.
4. White gable end on the west face toward the pumps.
5. Dark cooler box poking above the rear-east roof.

## Roof topology (as modelled, after comparing the west photo)
Renderer note: `pitch` here is rise / FULL span (src/blueprint.js: ridgeH = span * pitch),
so 0.44 on a 6.8 m span = 3.0 m rise; hip uses min(span, length).
- `store`: u -9.6..9.6, v -4.9..1.1, eaves 3.75, hip pitch 0.27 (rise ~1.8 m).
- `rear-hip`: u -3.5..9.6, full depth, hip pitch 0.18 (rise ~1.9 m) — covers the deeper east part.
- `entry-gable`: u -2.5..4.3, full depth, gable ridge along v, pitch 0.44 (peak ~6.75 m),
  white gable ends. From the west this shows as the wide brown slope with a horizontal ridge
  that the west photo shows above the small white gablet — that is what settled the topology.
- `-u` face: `pediment` parapet, full width, 1.4 m, off-white — the small decorative white
  gable on the west end (it is a false gablet in front of the hip, not a true gable end).
- `cooler-box`: u 5.0..8.4, v 1.3..4.9, 5.8 m, charcoal, flat.

## What the schema could not express / approximations
- The front white gable is a facade element on a cross-gable; modelled as a full-depth
  volume so its rear end is also white (rear not street-visible).
- Satellite dishes, rooftop units, recessed entry, poster-covered glass, pump island,
  propane cage, white vinyl fence, boulders on the lawn — omitted (canopy is a site extra).
- Storefront `y`/`h`: sill 0.35 m, glass 2.35 m tall. Sign uses `opts` colours (as the
  Zion lawnsign exemplar does); falls back to plain "board" if ignored.

## Renders
- `render_248274710_-v.png` (head-on from East Main St, dist 45), `render_248274710_-v_2.png`
  (slight oblique from bearing 345), `render_248274710_-u.png` (from the pumps / circle).
  Note: `dist` >= 60 on the -v side puts the free camera inside a neighbour; use 45–50.

## Confidence
Identity: high. Front face layout: high (two head-on shots). West face: high (head-on shot
+ crop). Heights: medium (scaled from brick / door). Cooler box position/height: medium-low.
East and south faces: unknown, left plain.

## Owner correction — 2026-09-19
The supplied overhead image places the canopy northwest of the store, diagonally forward toward the circle and East Main Street. Its edges run approximately east-west/north-south rather than parallel to the angled store. Approximate center (67.65, 39.7), 14 x 9 m, rotation 0. This refines the west-side description above with the forecourt setback and orientation.

Moved the canopy another 2.5 m back from the Main Street sidewalk, preserving its orientation, per owner feedback.
