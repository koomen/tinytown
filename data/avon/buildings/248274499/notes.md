# 248274499 — Wadsworth Building, 3 West Main / Genesee St (corner of the circle)

## Identification
Three-storey red-brick Italianate / High Victorian commercial block on the west
side of the Memorial Park circle where West Main Street leaves it. Bronze plaque
on the chamfered corner reads "...J. Wadsworth Building, Established 1876".
Tenants: Avon Property Management (Genesee-face window), shops, Avondale Pub
sandwich board outside. Not Hall's Opera Block (that is 15-19 Genesee, further
south). Sources: Street View Aug/Sep 2025 (head-on captures listed below), the
earlier oblique shots sv_248274499_a-c, overhead_labeled.jpg. Web search found
no page for the building itself; the 1876 date and Wadsworth name come from the
plaque.

## Photos (head-on)
- `front_248274499_+v.png` — Genesee (east) face from the circle, heading 284.
- `front_248274499_wmain.png` — West Main (north-east) face from 36 W Main St, heading 216.
- `front_248274499_chamfer.png` — the corner from the NE, heading 250 (both faces + chamfer).
- Also useful: `front_1090362847_-u.png` (west end of the West Main face + 15 W Main).

## Geometry and roof
The building is one polygon volume, 13.8 m high, with a continuous flat roof.
Its footprint follows the OSM ring in the building's u/v frame, including the
angled West Main facade, the clipped entrance corner, and the rear notch.
Two extra vertices meet the adjoining infill building's party wall: the aerial
footprints leave an approximately 1.7 m gap there, but the photographed buildings
are flush. This preserves the earlier blueprint's correction of that gap.

Facade keys refer to polygon edges. Fractions run left-to-right viewed from
outside (from the edge's second vertex toward its first):
- `edge0`: West Main, the three paired-window bays, with the shop at the
  chamfer end, the large ground-floor arch in the middle, and doors at the west.
- `edge1`: the clipped corner, with its double door, plaque, and upper windows.
- `edge2`: Genesee, with six single-window bays and the gilt-column storefronts.
- `edge3` / `edge4`: rear faces, retaining the earlier generic arched windows.
- Other edges: blank party walls and the short connection to the infill.

The cream cornice, dark-green belt course, stone plinth, and roof deck follow
this ring. There are no internal cornices or overlapping roof decks. The
previous approximation used nine rectangles with slightly different heights;
it made the diagonal frontage into steps and left white seams across the roof.

## Bay-by-bay reading
### Genesee face (+v, 13.8 m + chamfer), left = south
- Upper floors (2 and 3): six identical single arched windows, ~1 m wide,
  evenly spaced (~2.2 m), dark-green frames, corbelled brick segmental hoods
  with a cream keystone and a roundel in the arch; cream stone blocks at the
  third-floor sill line. Windows on floor 2 are taller than floor 3.
- Ground: continuous cast-iron storefront, dark green with gilt (ochre)
  fluted columns and a dark-green cornice band with a gilt saw-tooth frieze at
  ~4.5-5.0 m. From left: shop window | maroon door with transom (~2.7 m) |
  long run of shop windows (three columns, street tree in front) | recessed
  stair entry (dark, steps up, ~10.2-11.6 m) | "AVON PROPERTY MANAGEMENT"
  window | chamfer.
- Chamfer: maroon double door with transom, gilt-framed, bronze plaque above
  at ~3.5 m; one wide arched window per upper floor; pedimented cap on the
  cornice.
- Cornice: cream/white pressed-metal cornice with brackets and little
  pediment ornaments over brick corbelling. Total ~14.5 m to the top.
### West Main face (diagonal, 10.4 m), left = chamfer / circle
- Upper floors: three bays of PAIRED narrow arched windows (each ~0.8 m, pair
  ~2 m) under one corbelled hood, centred ~1.7 / 5.05 / 8.5 m from the chamfer.
- Ground, left to right: gilt-column shop bay (~3.3 m, shop glass) | brick bay
  with a large 2-light arched window (~1.9 m wide, cream imposts) over a
  rusticated stone basement with a basement window | two squat rectangular
  windows (~1.2 x 2.2 m) above a LOW dark-green bracketed cornice (~3.3 m),
  under which are a dark recessed doorway and a maroon door (the ground falls
  ~1 m toward 15 W Main, so this end has a taller ground floor and ~1 m of
  exposed rusticated stone base).
- The dark-green saw-tooth band continues across the whole face at ~4.5 m.
### Other faces
Back (-u) and west (-v) faces are plain brick; given generic arched windows.

## Colours
brick #a9573f · cornice cream #d9d2c1 · frames / storefront / band dark green
#2f4a3a · gilt columns #a8905a (caps #c6ad6a) · stone hoods #cdbf9f · glass
#5c6b74 · doors maroon #6b2f2a · rusticated base #8b8377 · roof "tar".

## Things the schema could not express
- Corbelled brick hoods with roundels: `hood` + `keystone` on arch windows.
- Brick corbel table under the cornice and the gilt saw-tooth on the band: a
  dentilled cream cornice and a plain dark-green belt course.
- The 1 m fall of the sidewalk toward the west is simplified to one floor datum.
- The low secondary storefront cornice at the west end is omitted.

## Render check
Checked from the northeast with the isometric camera (`side=30`, `dist=90`):
the roof is continuous, the West Main wall is straight, and the clipped corner
holds the entrance. Six Genesee window bays and three paired West Main bays are
preserved. The party-wall extension keeps the neighboring infill attached.
Geometry tests also raycast the roof interior and rear notch and verify that
windows face outward along every polygon edge.

Confidence: high on facade counts and the main outline; medium on the exact
name (plaque only partly legible) and the adjustment at the shared wall.
