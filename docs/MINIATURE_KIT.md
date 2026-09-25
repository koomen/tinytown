# Miniature component catalog

Make a cute, recognizable miniature of the photographed structure. Prioritize
its silhouette, entrance, roof shape, palette and 3–5 characteristic details.
Use a coherent handcrafted style: warm masonry, muted roofs, painted trim,
readable window rhythms and restrained exaggeration. This applies to any town.
Infer concealed elevations simply. Exact opening counts and tiny details are
not objectives. Use 1–6 main volumes (up to 10 for a complex), not custom meshes.

Return one complete blueprint JSON object. Coordinates are metres in the supplied
building's u/v frame. Use the footprint polygon to arrange wings and recesses;
do not fill a U-shaped courtyard with a single bounding rectangle. Height is
the wall-top elevation above building ground; bottom defaults to -1.2.
Face +u is the end at maximum u, -u minimum u, +v maximum v, -v minimum v.
Positions at and range run 0..1 left to right when viewing that face from outside.
Use supplied compass bearings to interpret photographs. Connected wings may overlap.
Set root or volume `wallMaterial` to `siding`, `vertical-wood` (board-and-batten), `brick`, `stone`, or `plaster`
when the cladding is known. This overrides color-based material inference;
small wooden cabins should use `wallMaterial:"siding"`.

Orientation is part of recognizability. Establish each important entrance's
outward face and volume using the north-up footprint map, geolocated camera
positions and visible architectural context. Camera heading points INTO the
photograph, opposite the outward normal of a head-on facade. An oblique image
can show two faces; screen-left does not mean the same world direction in each
photo. The nearest road and postal address do not establish the main entrance.
An unlocated web close-up supplies architectural detail, not a facade assignment.
Do not mirror the footprint, move a landmark feature to a more visible side, or
duplicate one principal entrance to hedge uncertainty. Distinguish independent
secondary entries from the same feature seen in multiple photographs. Report
unresolved placement explicitly in entrance_plan and uncertainties.

## Building and volume

```json
{"wall":"#ad604a","trim":"#e5dbc5","roofColor":"#555d61",
 "volumes":[{"id":"main","u":[-6,6],"v":[-4,4],"height":7,
   "roof":{"type":"gable","ridge":"u","pitch":0.3,"maxH":3,"overhang":0.25},
   "faces":{"-v":{"storeys":[{"y":1,"windows":{"type":"rect","w":1,"h":1.8,"at":[0.2,0.8]}}],
                     "doors":[{"at":0.5,"w":1.2,"h":2.4,"color":"#364d49"}]}}}]}
```

All colors must be six-digit hex strings. Volume height >=1.5; bottom below height.
u/v ranges ascend and are at least 0.2 m wide. Openings have positive dimensions.
Leave entrance gaps with explicit window positions. Volume IDs must be unique.
Two-tone walls (brick base, siding above): volume `"upperWall":"#d8d0bd","split":3.4`
recolors the wall above `split` metres.

Cross gables, ells, rear additions and projecting pavilions are SEPARATE
overlapping volumes whose roofs meet the main roof, not one bounding box. A
wing's ridge runs perpendicular to the main ridge for a cross gable; a lower
rear addition can use a shed-like low-pitch gable or flat roof.

## Roof and silhouette components

Every roof may set its own `color`; `gableColor` colors the triangular gable-end
walls (e.g. shingled gables above clapboard).

- Flat: `{"type":"flat","lip":false}`.
- Gable or hip: type gable/hip, ridge u/v, pitch 0.15–0.65, maxH in metres,
  overhang 0.1–0.5. Gable ends are on the ridge-axis faces. Rise is the FULL
  perpendicular span times pitch, capped by maxH. Supply maxH to control it.
  An ordinary house gable is pitch ~0.3–0.45; steep Victorian cottages ~0.55–0.65.
  Hip with `"flatTop":true` (optional `run` inset metres) truncates to a flat deck.
- Gambrel (barns, Dutch Colonial): `{"type":"gambrel","ridge":"u","h":4,"kneeH":0.62,"kneeIn":0.28,"overhang":0.4}`.
  `h` is ridge height above the eave; `kneeH` the knee as a fraction of h; `kneeIn`
  the knee set in as a fraction of the half-span. Steep lower, shallow upper slope.
- Barrel: `{"type":"barrel","ridge":"u","h":1.4,"overhang":0.25,"color":"#aab3b0"}`
  gives a continuously curved circular-segment metal roof with standing seams
  and wall-colored curved ends, for shallow curved metal roofs.
  `h` is its rise, at most half the smaller span; no dormers.
- Mansard: `{"type":"mansard","h":2,"inset":1,"overhang":0.2,"capColor":"#4d5256"}` gives
  perimeter slopes and a broad flat top, useful for historic schools and commercial blocks.
- Dormers on ANY gable, hip, gambrel or mansard roof (not barrel):
  `"roof":{...,"dormers":{"faces":["-v"],"count":2,"w":0.9,"h":1.1,"style":"gable","type":"rect","y":0.5}}`.
  `faces` lists sloped faces (gable ends are skipped; omit for all slopes);
  `count` spaces evenly or `at:[0.3,0.7]` places them; `style` gable|shed (a
  wide shed dormer: larger `w`, `style:"shed"`); `type` rect|arch; `y` sill
  above the eave; optional `color`, `trim`, `roofColor`, `depth`. Use dormers
  for windows poking out of a slope, a separate volume for a full cross gable.
- Church cross on a gable end: roof `"cross":true,"crossEnd":"+","crossSize":1.2`.
- Cornice on volume: `{"height":0.25,"overhang":0.15,"color":"#ddd3bc","dentils":false}`.
- `chimneys` on volume: `[{"u":1,"v":0}]`.
- `plinth` on volume: `{"height":0.3,"color":"#9c9789"}`.
- `beltCourses` on volume: `[{"y":3.5,"height":0.18,"color":"#dbccb5"}]`.
- `cupola` on the ridge of a volume: `{"width":1.6,"color":"#ece6d8","u":0,"v":0}` (u/v offsets from the volume centre).
- `towers` on volume: `[{"u":0,"v":0,"w":2,"height":12,"wall":"#cabfa6","spire":true,"spireH":0.6,"cross":true,"windowType":"gothic"}]`;
  `windows:false` omits the tower's openings.
- Flat-roofed angled or concave footprints may replace `u`/`v` with
  `"polygon":[[u,v],...]` (counter-clockwise, no repeat); its faces are named
  `edge0`, `edge1`, `edge2`... (edge i joins point i to i+1), plus `default`.

An open timber shelter can use top-level `pavilion` instead of volumes:
`{"wall":"#b48b58","roofColor":"#594638","pavilion":{"axis":"u","height":3.1,"pitch":0.43,"bents":3,"furniture":true},"details":[]}`.
It fits the footprint with one open gable roof, posts, trusses and rafters.
Optional `floorH`, `floorColor` and `postWidth` control the slab and timber;
`furniture` adds cafe seating and a low fence at the positive-axis entrance.
Lawn signs may set `postHeight` to lower a banner to fence height.
For a classical open hall, `columns:"classical"` supplies round tapered columns
with bases/capitals, `columnColor` sets their color, `postWidth` their diameter
(up to 1.2 m), `bents` the side pairs (2–14), and `endPosts` adds 0–8 interior
columns at BOTH gable ends. Root `wall` still colors the exposed roof trusses.
`seatingRows` (0–24) adds two banks of benches separated by a central aisle.
`entranceEnd:"positive"|"negative"` chooses the main entrance along `axis`;
`floorH` (0–3 m) raises the terrace and adds real stairs at that end.
`railing:true` adds an open balustrade, leaving central openings at both ends.
`roofType:"flat"` gives an open square hall a flat roof and broad classical
cornice (`trimColor`), and `wallH` (0–1.5 m) adds low perimeter walls with end
entry gaps. Do not enclose an open hall's large open bays with windowed walls
or a closed pediment. Check reference direction before choosing `axis` and
`entranceEnd`.

Gate-node footprints are authoring envelopes that include an OPEN ROAD LANE.
Use only small booth/post volumes positioned beside the lane shown by the
aerial and Street View. Never fill the envelope with a hall or a raised slab;
its OSM outline is not a building perimeter.

## Facade components (inside a named face)

- storeys: `[{"y":4,"windows":{"type":"arch","w":1.2,"h":2.1,"at":[0.2,0.5,0.8],"trim":"#e7dec8","glass":"#78837b","hood":true,"keystone":true}}]`.
  Window types: rect, arch, gothic, round, shop, basement, clock. Use count + margin OR
  explicit at positions, OR a tight cluster `"center":0.5,"spread":1.4,"count":3`
  (spread = metres between centres). Optional mullions false, shutters color,
  planter true|color, sill false, frameW, hood true|color. A storey's
  `"skip":[[0.4,0.6]]` drops windows in those face fractions (e.g. behind a
  door); `out` pushes it off the wall plane.
  Set `interior: false` for decorative or church glazing that should have no
  household blinds or curtains; ordinary windows keep their existing treatment.
  A round window can use `tracery: "rose"` for six clover-shaped panes around a
  central pane. A gothic or round window can use `tracery: "quatrefoil"` for one
  four-lobed opening. `traceryColor` colors the solid stone between the panes;
  `trim` and `frameW` control the outside surround. These patterns use plain glass.
  `type: "clock"` creates an open metal Roman-numeral dial with hands; `w` sets
  its diameter and `trim` its metal color. The wall shows through the dial.
  For an open belfry, stop the solid tower shaft below it, then use separate
  corner piers and slender column volumes with elevated `bottom`, and a roof
  volume whose `bottom` is the belfry ceiling. Do not enclose it with glass.

- doors: `[{"at":0.5,"type":"double","w":1.6,"h":2.5,"color":"#2f4549","surround":"#ded1b6","surroundW":0.14,"fanlight":true,"steps":2}]`.
  Types: rect, arch, gothic, double, garage. Optional y lifts the door (onto a
  porch floor: `y` = porch `floorH`); `lamp:true` adds a wall lantern.
  Garage: `{"at":0.3,"type":"garage","w":2.6,"h":2.3,"color":"#e4e1da","panels":4,"lights":true}`.
  `groundEntrance:true` marks a door above y 1.5 that meets uphill ground.
- parapets: `[{"type":"mission","at":0.5,"width":4,"height":1.5,"depth":0.2,"color":"#ad604a","trim":"#d8cbb1","cross":true}]`.
  Types: mission, pediment, arch, stepped, flat. Optional `text:"OPERA 1876"`,
  `textStyle:"carved"`, `roundel:true|diameter`, `crossSize`. Parapets start at the volume eave;
  use this integrated component, not extra coplanar wall panels.
- buttresses: `{"at":[0.02,0.98],"w":0.5,"d":0.45,"height":6,"color":"#c5bba3"}`.
- pilasters: `{"at":[0.05,0.95],"w":0.35,"d":0.2,"height":3.5,"color":"#bea46e","cap":"#d9c393"}`.
- storefronts: `[{"range":[0.1,0.9],"y":0.4,"h":2.5,"frame":"#354d3e","kick":"#354d3e"}]`.
- awnings: `[{"range":[0.1,0.9],"y":3,"depth":1.2,"color":"#384b63","stripes":"#e8e1cf"}]` (stripes optional).
- bays (bay windows): `[{"at":0.3,"w":2.4,"d":0.8,"y0":0.5,"y1":3.2,"count":2,"sides":true,"roof":"hip","trim":"#e8e1cf"}]`.
  A box out of the wall with windows on front and sides; roof hip|flat|none;
  the face's own storeys fill it unless `storeys` is given. A whole projecting
  pavilion or two-storey tower bay is a separate volume instead.
- signs: `[{"text":"SHOP","style":"gold-on-black","at":0.5,"y":3.4,"w":3,"h":0.5}]`.
  For manual asset curation, the renderer also supports `image` plus
  `shape: "cutout"` on small SVG signs, preserving the transparent silhouette.
  This remains outside the automated authoring workflow; keep the SVG's texture
  dimensions modest.
  Allowed sign styles: board, bronze, carved, ghost, gold-on-black, green, navy, red, stone.
  Storey `y` is relative to its volume base and must be nonnegative; lower the volume base instead of using a negative storey position.
- porches: `[{"style":"open","at":0.5,"w":5,"d":2,"height":2.8,"floorH":0.2,"posts":3,"postColor":"#ded4bd","roof":"hip","pitch":0.2,"roofColor":"#56605c","railing":false,"steps":1}]`.
  `height` is the post height ABOVE `floorH`, not an absolute roof elevation.
  `roof:"shed"` supplies a single slope rising toward the wall; `pitch` is
  rise/run (0.05–1, default 0.25). It works on gabled walls and partial-width
  porches. Use `roof:"main"` only for the documented shared hip-roof form.
  Upper balconies should use `floorThickness: 0.22` for a thin deck, rather than
  a solid foundation extending to the ground. Roof eave = floorH + height.
  For an uncovered raised deck use `style:"open", roof:"none", floorH:3,
  floorThickness:0.22, railing:true`. This has slender supports from ground to
  the deck, short railing posts, and no roof; `height` is ignored. `posts`
  controls the number of supports. Use wood tones for floorColor/postColor.
  `railSides:["front","left","right"]` selects exterior railing edges; left
  and right are as seen facing the wall. Omit the shared edge on adjoining
  deck sections so the wraparound deck remains walkable.
  `sideRailGaps:{"left":{"at":0.15,"w":1.2}}` cuts a stair opening in a
  side railing. Keys are left/right as viewed facing the wall; `at` is a
  fraction of the porch depth from the house outward, and `w` is metres.
  Use a `details` stair with matching position and elevation at the opening.
  Stair example: `{"type":"stair","u":-10,"v":12,"dir":[0,-1],
  "length":4.5,"height":2.95,"w":1.4,"y":0,"color":"#925f49",
  "railColor":"#81503e","railing":true}`. It climbs from `(u,v,y)` toward
  the unit vector `dir:[du,dv]`; its top is `(u+du*length,v+dv*length,y+height)`.
  `dir` must be a numeric two-element array, never a face-name string.
  For open wooden stairs add `construction:"open"`: individual thin treads,
  open risers and two sloping stringers, with air below the flight. Omitted
  construction retains solid masonry steps. `y` raises the bottom of a flight.
  A switchback uses two opposing stair directions joined by a supported
  `details` platform: `{"type":"landing","u":-16.45,"v":7.4,"w":1.3,
  "length":2.2,"height":1.475,"railSides":["front","back","left"],
  "color":"#925f49","railColor":"#81503e"}`. Its u/v are the centre,
  w spans u, length spans v, height is its walking surface above y (default 0).
  It has a thin floor and four ground-reaching posts. Railing sides are local
  `left:-u`, `right:+u`, `front:+v`, `back:-v`; omit the edge joining flights.
  Optional rotation turns the whole platform about its centre.
  Open porch across part or all of a face: `range:[0,1]` instead of `at`+`w`;
  `roof` hip|gable|flat|shed; `railing:true` leaves a `railingGap` (m) at the
  steps; `stepsAt` (fraction) and `stepsW` place the steps (default: the first
  door behind the porch). Keep the door and windows on the wall behind it.
  `style:"carport"`: open roofed bay, no floor or railing.
  Wraparound or multi-volume porch: a TOP-LEVEL `porches` entry with `face`,
  the span along the wall and the wall plane, e.g.
  `{"style":"open","face":"-v","u":[-6,4],"wall":-4,"d":2.4,"height":2.6,"floorH":0.5,"roof":"hip","railing":true}`
  (for faces ±u use `"v":[v0,v1],"wall":u`). Combine two entries (-v and +u)
  for an L-shaped wraparound; omit their shared `railSides` edge.
  A simple entry gable uses `{"at":0.5,"w":2,"d":1,"height":2.7,"pitch":0.3,"wall":"#c6bba4","roofColor":"#555d61","cross":true,"door":{"type":"arch","w":1,"h":2}}`.

Free-standing `details` (u/v frame): `{"type":"bush","u":6,"v":-5,"size":1.2}`,
`flag` (`height`), `cross`, `lawnsign` (`text`,`style`,`w`,`h`,`rotation`),
`ramp` (like stair: `dir`,`length`,`height`,`w`,`railing`), `stair`, `landing`.

## House recipes (fit the actual footprint; these are shapes, not answers)

Gable cottage, front porch, dormers (footprint 10 x 8, front -v):
```json
{"wall":"#d9d2c0","wallMaterial":"siding","trim":"#f0ebe0","roofColor":"#5b5f63","volumes":[{"id":"main","u":[-5,5],"v":[-4,4],"height":5.6,
 "roof":{"type":"gable","ridge":"u","pitch":0.45,"maxH":3.6,"overhang":0.35,"dormers":{"faces":["-v"],"count":2,"w":0.9,"h":1.0}},
 "chimneys":[{"u":3,"v":0.5}],"faces":{
 "-v":{"storeys":[{"y":0.9,"windows":{"type":"rect","w":0.9,"h":1.6,"at":[0.2,0.8],"shutters":"#3f5a4a"}},{"y":3.4,"windows":{"type":"rect","w":0.8,"h":1.3,"at":[0.3,0.7]}}],
  "doors":[{"at":0.5,"w":1,"h":2.2,"y":0.5,"color":"#7a3b2e"}],
  "porches":[{"style":"open","range":[0.05,0.95],"d":2.2,"height":2.5,"floorH":0.5,"roof":"hip","pitch":0.25,"railing":true,"steps":2}]},
 "+u":{"storeys":[{"y":0.9,"windows":{"type":"rect","w":0.9,"h":1.6,"count":2}},{"y":4.2,"windows":{"type":"rect","w":0.7,"h":1.1,"at":[0.5]}}]}}}]}
```
Gambrel barn: one volume, `"roof":{"type":"gambrel","ridge":"u","h":4.5}`, a
`garage` or `double` door on a gable-end face, `gableColor` for the gable walls.
Upright-and-wing farmhouse or ell: a two-storey gable volume plus a lower,
perpendicular gable volume overlapping it, with a top-level porch across the
wing's front. Rear shed addition: a low volume against the back wall with a
low-pitch gable or flat roof, its top below the main eave.

Reuse integrated components. Do not emit custom profile polygons, moldings,
floating facade panels, image assets, hand-built arcade spandrels or roof carriers.
Simplify secondary features when the kit cannot express them cleanly.

## Memorial fountains

For a square memorial fountain use a root `fountain` instead of volumes:
`{"fountain":{"height":4,"basinHeight":0.68,"rimWidth":0.42,"pylonWidth":1.65,"stoneColor":"#d7d1bd","brickColor":"#995f4b","waterColor":"#84b9b5","jets":true},"volumes":[]}`.
The basin fits the supplied footprint. Height is the total crown height above
ground; basinHeight is the coping height. The component supplies an open water
basin, brick walls with pale coping, a four-sided relief pylon, a three-step cap,
and four sculpted fish/dove corner jets. Sculpture is deliberately abstract at
miniature scale. Use the supplied photographs/drawing for dimensions and palette.
No doors or principal entrance exist; return an empty entrance_plan.

## Bridges

For a bridge use a root `bridge` instead of building volumes. Example (dimensions
and number of spans are illustrative; determine them from the supplied evidence):
`{"wall":"#a5987d","trim":"#c4b99e","volumes":[],"bridge":{"type":"masonry-arch","axis":"u","height":6,"arches":3,"pierWidth":1.5,"archRise":2,"deckThickness":0.65,"railing":true,"tracks":false}}`.
Types are `masonry-arch` (open elliptical spans) and `steel-girder` (deck, end
abutments and girders). Axis u/v runs along the bridge; length and width come
from its footprint. Height is deck elevation above the low ground under the
bridge, in metres. Arches 1..12, height 1.5..30, pierWidth .25..10,
deckThickness .15..3; archRise must fit below the deck. Choose tracks and railing
only when supported by photographs. Do not turn a bridge into a solid building.
Bridge orientation concerns its span axis and approaches; entrance_plan can be empty.

For photographed retaining wings, a steel girder bridge may set `abutmentWidth`
and `wingWalls:{length,splay,thickness,endHeight,color}`. All dimensions are metres;
the four wings extend away from the open road corridor. `approachWidth`,
`approachPlateau` and `approachLength` describe a broad level railway approach
and its transition back to the mapped terrain. Use only when reference-supported.

Landmark facade signs may set `brand` to `tom-wahls`, `mcdonalds` (golden arches),
`mcdonalds-wordmark`, or `barilla`. These draw custom recognizable logo shapes.
Tom Wahl's Avon rooftop paddle uses a tall aspect ratio; its position still
comes from the actual reference photographs.

## Roofed outdoor amphitheaters

Use root `amphitheater` for a large open auditorium, instead of enclosing volumes:
`{"amphitheater":{"axis":"v","stageEnd":"negative","height":8,"roofRise":5,"backstageDepth":15,"rows":12,"monitor":true,"wallColor":"#d9d0aa","trimColor":"#e8dfc4","roofColor":"#647064","seatColor":"#d8d5bc"},"volumes":[]}`.
The footprint supplies length/span. Axis is the roof ridge and stage-to-audience
axis. stageEnd specifies the end containing the stage house in that axis; resolve
it from the aerial and geolocated views. Height is perimeter eave height (5–14 m),
roofRise is the rise above it (1–9 m). backstageDepth is 3 m to 30% of length.
The integrated component provides a broad hipped canopy, optional ridge monitor,
perimeter posts with open galleries, stepped benches split by an aisle, stage,
abstract organ screen and a compact enclosed stage house. Rows 6–20 deliberately
simplify seating. Multiple open perimeter gates have no modeled door leaves;
entrance_plan may be empty, with orientation assessed using the stage house.
Use photographs of the structure as it stands today, not a demolished
predecessor. The long axis and stage end are evidence-driven.

## Appendix: Chautauqua Institution notes

Site-specific guidance for `data/chautauqua/` (see `docs/chautauqua.md`). It
applies only when authoring these structures.

- The reddish-brown wooden practice cabins beside Lenna Hall use
  `wallMaterial:"siding"`.
- McKnight Hall has a shallow silver `barrel` roof.
- Smith Wilkes Hall is an open classical `pavilion` (`columns:"classical"`,
  `roofType:"flat"`, low `wallH`); do not enclose its large open bays. The Hall
  of Philosophy has white classical columns and an OPEN timber gable, not a
  closed pediment or windowed walls.
- Bryant Gate and Elm Gate are gate-node envelopes: small booth/post volumes
  beside the open lane only.
- Bestor Plaza Fountain: the original drawing gives a 13-foot overall height
  and a 2-foot-3-inch basin wall. Do not author the smaller fountain by the
  Post Office.
- The Amphitheater is the 2017 replacement; use its photographs, not the
  demolished predecessor or a closed hall.
