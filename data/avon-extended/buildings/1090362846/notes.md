# Blueprint notes — OSM 1090362846 — Avon Town Hall / Hall's Opera Block (1876), 23 Genesee St

## Identification
Hall's Opera Block, 1876, now Avon Town Hall + Avon Historical Society Museum. Three-storey red-brick
Italianate block with a black cast-iron storefront, a bracketed dark cornice that rises into a segmental
arched pediment lettered "OPERA BLOCK 1876", and bronze "TOWN OF AVON" letters on the brick between the
second and third floors. **High confidence**: the head-on Aug-2025 pano at 24 Genesee St shows the whole
15.3 m face (bank on the left, Village Restaurant party wall on the right), and its width scaled off the
storey heights comes out at 15.3 m — exactly the OSM frontage.

## Frame
- OBB 20.4 m (u, depth) × 15.3 m (v, frontage); +u bears 284° (rear), road face is **-u** (looks 104° ESE).
- On -u, fraction 0 is the SSW (bank, 1090362845) end, 1 is the NNE (Village Restaurant, 248274502) end.
- The polygon notch (1.2 m × 0.1 m at the -v street corner) is below caricature resolution; one rectangle.
- Terrain drops 2.1 m from the street to the rear; left to the renderer's foundation, no plinth.

## Photos used
- `front_1090362846_-u.png` — **black frame (failed capture)**; the compare tool therefore shows an empty
  photo panel. Replaced by my own head-on captures (scratchpad `th_front20.png`, `th_front35.png`, from the
  brief's -u URLs at 20 m / 35 m; 70° and 55° fov).
- `sv_1090362846_a/b/c.png` (Aug 2025 obliques from 24 Genesee) — colours, storefront detail, door types.
- `front_1090362846_-v.png`, `front_1090362846_-v_2.png`, `front_1090362845_+v_2.png` — the pair together
  from Park Pl / the circle; relative heights of bank, spa and Town Hall.
- `front_1090362846_+u.png`, `+v.png`, `+v_2.png` — black or show other buildings (both faces are party
  walls); not used.
- `overhead_labeled.jpg` / `satellite.jpg` — flat dark tar roof over the full 20 m depth, no rear wing.

## Reading face by face
**-u (Genesee St, 15.3 m)** — symmetric about the arched entrance at 0.5.
- Ground: black cast-iron storefront to ~4.9 m (glazing to ~4.0 m, bracketed iron cornice band 4.2–4.9).
  Bays from the left: shop window · narrow dark-red double door with transom (0.205) · shop window ·
  **arched dark-red double entrance with fanlight and cream stone surround (0.5)** · shop window ·
  shop window with gold "AVON HISTORICAL SOCIETY MUSEUM" on the transom (0.885).
  Frames dark red, kick panels dark red, iron piers black.
- 2nd floor: eight tall rect windows (~0.85 × 2.3 m) in a **3-2-3 rhythm** with slight segmental brick
  heads and small stone hood blocks, sills ≈ 5.0 m: 0.09 0.216 0.34 | 0.462 0.538 | 0.66 0.784 0.91.
- "TOWN OF AVON" — bronze serif letters on the brick, centred at 0.5, ~3.4 m wide, centre ≈ 8.1 m.
- 3rd floor: eight arched windows (~0.85 × 2.5 m) in the same 3-2-3 rhythm, sills ≈ 8.7 m, brick arch
  hoods with stone keystones.
- Cornice ≈ 12.2 m: dark grey bracketed metal cornice, rising into a **segmental arched pediment across the
  whole face** (~1.8 m rise) with gold "OPERA BLOCK / 1876".
- Wall red-orange brick; window frames dark red.

**-v (toward the bank, 20.4 m)** — party wall with 1090362845 (bank ~10 m tall, 28.7 m deep), so only the
top ~2 m of plain brick shows. Left plain.

**+v (toward 248274502, 20.4 m)** — party wall with the 12.2 m Village Restaurant block. Plain.

**+u (rear, 15.3 m)** — no coverage. Modelled plain with three windows per upper storey, two low windows and
a rear door, red frames; the 2 m of terrain drop becomes the renderer's foundation.

## What was modelled / exaggerated
- September 6, 2026: the user requested plain windows rather than mixed drapes
  and shades. All 24 front/rear storey windows in the live blueprint now use
  `interior: false`. Keep their existing frames, mullions and glass color;
  storefront glazing already uses the glass-only treatment.
- Main block 12.2 m (matches the neighbouring 248274502 blueprint so the shared cornice line continues),
  flat tar roof, dark dentilled cornice 0.55 m.
- Full-width `arch` parapet, 1.9 m, dark grey (#3f4341) with a lighter trim edge; gold ghost lettering
  "OPERA BLOCK / 1876" 6.6 × 1.5 m pushed 0.25 m out onto the parapet face — larger than life.
- "TOWN OF AVON" as brass ghost lettering 5.6 × 0.75 m (real ≈ 3.4 × 0.35 m).
- Eight windows per upper floor kept (the 3-2-3 rhythm is the recognisable thing), widened to 1.0 m,
  2.2 m rect below and 2.6 m arch with keystones above.
- Storefront as a separate thin black volume (u −10.4…−9.75, 4.9 m, dentilled band) as on 248274502:
  four dark-red framed shop windows, a dark-red `double` door with fanlight at 0.205, and the arched
  entrance at 0.5 (2.2 × 3.9 m, cream surround, lamp). "AVON MUSEUM" gold-on-black over the last bay.

## Approximations / schema gaps
- The neighbour 248274502's blueprint gives the same 1876 cornice a **pale** colour (#cfc8b6); the photos
  show a dark grey bracketed cornice continuing across both. I followed the photo; the coordinator may
  want to darken the neighbour's cornice for continuity.
- The cast-iron piers between storefront bays and the dentil/bracket detail of the storefront cornice are
  only suggested by the black volume and its band.
- Segmental brick window heads and stone hood blocks on the 2nd floor are omitted (a `hood` on eight
  close-set windows fused into a belt course in the render), keeping plain red frames and pale sills.
- The bronze letters are painted ghost planes (two transparent meshes); if the bake budget objects, the
  parapet's built-in `text` would do for "OPERA BLOCK 1876" at the cost of the gold colour.
- Rear (+u) elevation is invented.

## Confidence
High on the road face (bay count, rhythm, pediment span, lettering, storefront layout, heights within
~0.3 m). Medium on colours (sampled from Aug-2025 panos). Low on the rear elevation.

Renders: `render_1090362846_-u.png` (62 m, with 1090362845 loaded), `render_1090362846_iso.png`,
`render_1090362846_284.png` (rear). `compare_1090362846_-u.png` has a black photo panel because the
captured front image is black.
