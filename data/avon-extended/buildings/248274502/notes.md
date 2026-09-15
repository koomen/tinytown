# Blueprint notes — OSM 248274502, Village Restaurant block, 13 Genesee St, Avon NY

## Identification
- Village Restaurant, 13 Genesee Street (Yelp / Tripadvisor / Waze / visitlivco listing; family diner,
  35+ years). OSM tags the footprint "17 Genesee Street"; the restaurant's own address is 13.
- 3-storey red-brick Italianate commercial block on the WEST side of Genesee St, so its front (+u)
  faces EAST (bearing 104°). Sandwiched between the Wadsworth Building (248274499, north, -v side)
  and the Opera Block / Avon Town Hall (1090362846, south, +v side). Note: the Avon Historical Society
  Museum storefront immediately south belongs to the Opera Block, not to this building (same
  bracketed cornice and stone-arched windows as the Opera Block; brick seam and change of window
  detailing mark the boundary).
- Sources: earlier oblique shots sv_248274502_{a,b,c}.png; head-on captures
  front_248274502_+u.png (level, 28 m) and front_248274502_+u_2.png (zoomed storefront);
  St. John Fisher "Finding Our Main Street" exhibit title "Genesee Street, Avon, NY Opera Block and
  Village Restaurant" (fisherpub.sjf.edu/exhibition_findingourmainstreet/6/).

## Footprint vs. reality (important)
- OSM footprint is 22.0 m deep x 6.8 m of frontage. Read against the neighbours (Wadsworth ~20 m and
  Opera Block 20.4 m for 7 bays, i.e. ~2.9 m per bay) the real Village Restaurant façade is FOUR bays,
  roughly 10-11 m wide. The OSM boundary with the Town Hall footprint is almost certainly ~4 m too far
  north, so the Town Hall footprint contains the southernmost bay or so of this façade.
- Per the brief I modelled only inside this footprint (v in [-3.4, 3.4]). To keep the neighbours'
  ~2-3 m bay rhythm on a 6.8 m face I caricatured the four bays as THREE (at 0.2 / 0.5 / 0.8).
  If the footprint is ever corrected, the fractions still work; bump window count to 4.

## Bay-by-bay reading, +u face (Genesee, east). Left = south (Town Hall side), right = north (Wadsworth)
- Ground floor: continuous black-painted fascia across the whole front, ending in a black pilaster at
  the right. Arched-top gold-on-black sign board "VILLAGE RESTAURANT" left of centre on the fascia.
  Grey/white striped awning over the left ~70 %. Glazed storefront on a low brick kick panel;
  aluminium-framed glass door just right of centre; a separate dark wooden door to the upstairs at the
  far right bay (with transom). Bench and sandwich board on the sidewalk.
- 2nd floor: 4 one-over-one sash windows with FLAT STONE LINTELS and stone sills (AC unit in bay 1).
  Brick between.
- 3rd floor: 4 ROUND-ARCHED windows, brick arches with a small stone keystone, white frames, stone
  sills. Small dark (bronze) rectangular plaque between bays 2 and 3.
- Roof: flat. Plain bracketed/dentilled cornice, painted light grey-cream, LOWER than the Wadsworth
  block's ornate cornice (by ~1 m) and about level with the Opera Block's.
- Proportions read off the level photo: storefront ~4.3 m, 2nd floor ~4 m, 3rd ~3.9 m, cornice ~0.6 m;
  ~12.8 m to cornice top.

## Other faces
- -u (rear, west): NOT visible from any Street View pano (the two attempts snapped to NY-5 and South
  Ave). Guessed: two rect windows per upper floor, one back door and a small window at ground level.
  Low confidence.
- +v (south, 22 m party wall): Town Hall footprint is only 15.3 m deep, so ~6.7 m of this wall at the
  rear is exposed. Added two small rect windows per upper floor in that exposed rear stretch
  (fractions 0.08, 0.2 from the west end). Guess.
- -v (north): fully hidden by the 22 m-deep Wadsworth block; left blank.

## Signature features modelled (exaggerated a little)
1. Black storefront band with the gold-on-black VILLAGE RESTAURANT sign — done as a thin 0.58 m
   "storefront" skin volume (u 10.6..11.18, height 4.3) painted near-black, carrying the storefront,
   both doors, awning and sign; its tiny flat top reads as the storefront cornice.
2. Grey/white striped awning over the left 70 % of the frontage.
3. Round-arched keystoned top-floor windows over flat-stone-lintelled 2nd-floor windows (hood colour
   = stone).
4. Dentilled light cornice on a narrow, plain brick slab squeezed between two bigger blocks.

## Colours
- wall #9c503d (muted red-orange brick, mid-tone from photo; #a65740 rendered too orange)
- trim / lintels / sills #d9cfb8, window frames #e6e2d8, glass #5c6a78
- cornice #cfc8b6 (light grey-cream paint)
- storefront black #2a2826, kick #8a4a3a, glass door #9aa0a6, upstairs door #3a2a24
- awning #dcdedf with #9a9ea2 stripes; sign gold-on-black (built-in style); roof "tar"

## What the schema could not express
- Bronze rectangular plaque between bays 2-3: the only plaque option is the tan "stone" roundel,
  which read like a clock in the render, so it was dropped.
- Brick (not stone) arches with a stone keystone: arches are drawn with the light trim colour, so they
  read as stone-surrounded arches.
- Arched top of the real sign board; AC unit; bench and sandwich board.
- Four bays on a 6.8 m footprint (see above) — reduced to three.

## Confidence
- Identity, front composition, colours: high (head-on photo).
- Heights: medium (read off level photo, scaled to neighbours).
- Rear and exposed south wall: low (never seen).

## Files
- Photos: data/avon/research/front_248274502_+u.png (head-on, level), front_248274502_+u_2.png (zoomed storefront).
  Rear/-u: no pano exists; attempts discarded.
- Renders (iteration 2): data/avon/research/render_248274502_+u.png (head-on, 60 m),
  render_248274502_+u_2.png (3/4 view from the north-east, bearing 60°, 55 m, next to the Wadsworth block).
- Iteration log: v1 had a 0.9 m cornice (read as a slab), 12.6 m eaves (taller than both neighbours),
  a text-less stone plaque (looked like a clock) and brick #a65740 (too orange); v2 fixed all four.
