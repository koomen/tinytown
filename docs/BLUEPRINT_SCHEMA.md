# Building blueprints (overrides.json → "blueprints" → "<osm id>")

Memorial fountains may use a top-level `fountain` object instead of building
volumes. See [the component catalog](MINIATURE_KIT.md#memorial-fountains) for its
dimensions and color fields. It renders an open square basin, relief pylon,
stepped crown and four corner jets. Fountains have no doors or enclosing walls.

A blueprint replaces the generic style for one building with an explicit,
photo-grounded description of the real thing. Author it from photos.

Integrated `amphitheater` objects accept `rearWingChamfer` (metres, default 0)
to clip the two canopy wing corners adjoining the stage house and back porch.
The maximum is the smaller of 15% of the cross-axis span and 15% of the length
remaining after `backstageDepth`. This changes only the canopy; the bowl's
six-sided ground excavation remains intact. Optional `stringLightSpacing`
(0.9–1.2 m) enables perimeter string lights, and `interiorLighting` is an optional
boolean controlling the interior lighting treatment.

## Frame

Everything is in the footprint's oriented-bounding-box frame, in metres:
`u` runs along the long side of the box, `v` across it, origin at the box
centre. The site file's `obb` gives `w` (extent along u), `d` (along v) and
`angle`. `./town brief <site> <id>` writes `data/<site>/buildings/<id>/brief.md`
with the polygon in (u, v), the compass bearing of +u and +v, and which side
faces the road, and draws the diagram `footprint.png` beside it. Faces are named by their outward normal: `+u`, `-u`, `+v`, `-v`.
Positions along a face are fractions 0..1 from the LEFT end as seen from
outside the building.

## Top level

```
{ "wall": swatch|hex, "wallMaterial": "siding"|"brick"|"stone"|"plaster", "trim": ..., "roofColor": ..., // optional defaults
  "volumes": [ Volume, ... ],
  "porches": [ Porch, ... ],                              // porches spanning several volumes (see Porch)
  "details": [ Detail, ... ] }
```

## Volume

```
{ "id": "nave", "u": [u0, u1], "v": [v0, v1], "height": eaves height (m),
  "bottom": -1.2, // explicit wall base above building grade; omit to meet the scene foundation (or extend below grade when unsupported)
  "wall": ..., "wallMaterial": "siding"|"brick"|"stone"|"plaster", "upperWall": ..., "split": 3.6, // optional cladding override, two-tone at split
  "trim": ...,
  "roof": { "type": "flat"|"gable"|"hip", "ridge": "u"|"v", "pitch": 0.3–0.8 (ridge height = full span × pitch, capped by maxH; an ordinary house gable is ~0.3), "maxH": m,
            "color": ..., "overhang": m, "cross": true, "crossEnd": "+"|"-", "crossSize": m,   // cross = a crucifix ornament on the gable end (churches), NOT a cross gable; make wings with a second volume
            "gableColor": ..., "lip": false,
            "flatTop": true, "h": m, "run": m },              // hip: truncated to a flat deck; run = horizontal inset of the deck
  "roof": { "type": "gambrel", "ridge": "u"|"v", "h": ridge height m | "pitch", "kneeH": 0.62, "kneeIn": 0.28,   // Dutch Colonial: steep lower slope to a knee, shallow above
            "overhang": 0.4, "color": ..., "gableColor": ... },                                              // kneeH = knee height as a fraction of h; kneeIn = knee set in from the wall as a fraction of the half-span
  "roof": { "type": "mansard", "h": 2.6, "inset": 0.9, "color": ..., "capColor": ..., "overhang": 0.3 },   // steep frustum + flat cap
  "roof": { "type": "barrel", "ridge": "u"|"v", "h": 1.4, "overhang": 0.25, "color": ..., "gableColor": ... }, // continuous curved metal roof; h <= half the smaller span; no dormers
  "roof": { ..., "dormers": { "faces": ["-v", ...], "count": n | "at": [f, ...], "w": 0.9, "h": 1.2,     // on ANY pitched roof (gable, hip, gambrel, mansard)
                              "type": "rect"|"arch", "style": "gable"|"shed", "color": wall, "trim": ..., "roofColor": ...,
                              "y": 0.5, "depth": m } },                                                  // y = sill above the eave; gable-end faces are skipped
  "cornice": { "height": m, "overhang": m, "dentils": true|false, "color": ... },   // eave band on flat, hip and mansard roofs
  "plinth": { "height": m, "color": ... },                // raised basement band
  "beltCourses": [ { "y": m, "height": m, "color": ... } ],
  "cupola": { "width": m, "color": ..., "u": offset, "v": offset },
  "towers": [ { "u": , "v": , "w": m, "height": m, "wall": ..., "spire": true|false, "spireH": ratio, "cross": true, "windows": false, "windowType": "gothic"|"arch"|"rect" } ],
  "chimneys": [ { "u": , "v": } ],
  "faces": { "+u": Face, "-u": Face, "+v": Face, "-v": Face, "default": Face } }
```

Overlapping rectangular flat-roof volumes at the same level share one exposed
roof surface, keeping each volume's roof colour. Different roof heights remain
separate. Explicit `bottom` values still control raised equipment and sign
supports; they must be below `height`.

## Polygon volumes

For a flat-roofed building with angled walls, a clipped corner, or a concave
footprint, replace a volume's `u` and `v` ranges with `polygon`:

```json
{
  "id": "corner-block",
  "polygon": [[-5, -4], [5, -4], [5, 2], [3, 4], [-5, 4]],
  "height": 10,
  "roof": { "type": "flat", "lip": false },
  "cornice": { "height": 0.6, "overhang": 0.3 },
  "faces": {
    "edge2": { "doors": [{ "at": 0.5, "type": "double" }] }
  }
}
```

Points are `[u, v]` metres in the same building frame, ordered counter-clockwise
when u points right and v points up. The ring closes automatically; do not
repeat the first point. It must be a simple polygon with no crossings or
zero-length edges. Concave corners are supported; holes are not.

`edge0` joins point 0 to point 1, `edge1` joins point 1 to point 2, and so on;
the last edge joins the last point back to point 0. `default` applies to
unspecified edges. Fractions still run left-to-right as seen from outside:
on edge i, fraction 0 is point i+1 and fraction 1 is point i. All facade
elements follow the edge's actual angle. Use `edgeN` names, rather than `+u`
and `+v`, for polygon volumes.

Polygon volumes currently support flat roofs. Walls, plinths, belt courses,
cornices, and roof decks follow the outline, including its concave corners.
Keep trim overhangs/insets small relative to narrow parts of the footprint.
The Wadsworth blueprint (`248274499`) is a worked example.

## Face

An optional `arcade` cuts real arched recesses into one explicit face of a
rectangular volume. The other facade details remain available. The volume must
have no `polygon` or `upperWall`, and its plinth/belt courses must stay below or
above the openings. Every opening must fit completely inside the wall.

```json
"arcade": {
  "at": [0.25, 0.5, 0.75], "w": 2.5, "h": 6.5, "y": 2.2, "depth": 2.1,
  "trim": "#eee8d9", "surroundW": 0.18, "backColor": "#9a8172",
  "floorColor": "#b7b3a4", "approachDepth": 6,
  "door": {"type": "double", "w": 1.8, "h": 2.7, "color": "#50433a", "fanlight": "dark"}
}
```

`y` is the threshold/arcade floor elevation. `depth` is measured inward from the
facade and must leave a solid back wall. Smaller doors stand at that back wall;
omit `door` for empty recesses. `approachDepth` reserves exterior entrance paving
for stairs or a landing. The visible arch is an opening with thick jambs and a
curved soffit, so it has no door leaf or fanlight at the front plane.

Solid `details` stairs and landings accept `foundationDepth` (default 0.2 m),
measured downward from the detail's `y`. Use enough buried support to meet the
local terrain across a sloped stair width. A landing with `construction: "solid"`
has a filled masonry base; the existing post-supported landing is the default.

```
{ "trim": ...,
  "storeys": [ { "y": sill height (m), "skip": [[a,b], ...], "out": m,      // out: push off the wall plane (default 0.1)
                 "windows": { "type": "rect"|"arch"|"gothic"|"round"|"shop"|"basement",
                              "w": m, "h": m,
                              "count": n, "margin": m           // evenly spaced, or
                              "at": [f, f, ...],                  // explicit fractions, or
                              "center": f, "spread": m, "count": n,   // a tight cluster
                              "trim": ..., "glass": hex, "frameW": m, "hood": true|hex,
                              "shutters": hex, "keystone": true, "mullions": false, "sill": false,
                              "planter": true|hex } } ],                                  // flower box under the sill
  "doors": [ { "at": f, "y": m, "type": "rect"|"arch"|"gothic"|"double", "w": m, "h": m, "color": ...,
               "surround": ..., "surroundW": m, "steps": n, "fanlight": true, "lamp": false, "groundEntrance": false },   // y lifts the sill (onto a porch floor)
             { "at": f, "type": "garage", "w": 2.6, "h": 2.4, "color": "#e4e1da", "panels": 4, "lights": true, "lamp": true } ],
  "storefronts": [ { "range": [a, b], "y": sill m, "h": m, "frame": ..., "kick": ...|false } ],
  "awnings": [ { "range": [a, b], "y": m, "depth": m, "color": ..., "stripes": hex },
               { "type": "barrel", "range": [a,b], "y": springline height m, "depth": m,
                 "rise": m, "color": ..., "trim": ..., "posts": true,
                 "brand": "athenaeum-hotel" } ], // curved fabric canopy with scalloped end and open underside; optional local crest
  "parapets": [ { "type": "pediment"|"mission"|"arch"|"stepped"|"flat", "at": f, "width": m|"full",
                  "height": m, "depth": m, "color": ..., "trim": ..., "cross": true, "crossSize": m,
                  "text": "OPERA BLOCK 1876", "textStyle": "carved", "roundel": true|diameter m } ],
  "signs": [ { "text": "...", "style": "gold-on-black"|"carved"|"stone"|"board"|"red"|"navy"|"green"|"bronze"|"ghost",
               "shape": "plaque"|"arch",                            // plaque: rounded tablet (edge colour follows the style)
               "at": f, "y": m, "w": m, "h": m, "out": m },      // out: default 0.1 (ghost: 0, flush with the wall)
             { "image": "data/avon-extended/textures/firehall_mural.jpg", "at": f, "y": m, "w": m, "h": m } ],   // a photo flat on the wall (murals); path relative to the page
  "pilasters": { "at": [f, ...], "w": m, "d": m, "height": m, "color": ..., "cap": ... },   // corner piers with caps
  "buttresses": { "at": [f, ...], "w": m, "d": m, "height": m, "color": ... },
  "bays": [ { "at": f, "w": 2.4, "d": 0.8, "y0": 0, "y1": m | "h": m,                          // bay window: a box out of the wall, windows on front and sides
              "storeys": [ Storey, ... ],                                                    // default: the face's own storeys that fit between y0 and y1
              "count": n, "sides": true, "roof": "hip"|"flat"|"none", "pitch": 0.5,          // count = windows across the front; roof defaults to hip, or flat when it meets the eaves
              "color": ..., "trim": ..., "roofColor": ... } ],
  "porches": [ { "at": f, "w": m, "d": m, "height": m, "pitch": 0.7, "cross": true,           // gabled entry box
                 "wall": ..., "roofColor": ..., "door": Door },
               { "style": "open", "range": [a, b] | "at": f, "w": m, "d": 2.4, "height": 2.7,   // open porch: floor, posts, roof
                 "floorH": 0.45, "floorThickness": 0.22, "floorColor": ..., "posts": n, "postColor": ..., "roof": "hip"|"flat"|"gable"|"shed"|"main"|"none", "pitch": 0.4,
                 "roofColor": ..., "railing": true, "railingGap": m, "steps": n, "stepsAt": f, "stepsW": m },
               { "style": "carport", "range": [a, b], "d": 5.5, ... } ] }                      // open porch with carport defaults: no floor, no railing, 2 posts, gable out from the wall
```

For a recessed portico, use `roof: "main"` on a full-width (`range: [0, 1]`)
open porch attached to a rectangular hip-roofed volume. The main hip roof and
cornice extend over the porch, and its posts automatically meet the underside
of that cornice. Omit `height` and separate porch roof settings in this case.
Ordinary porch `height` is the post height **above `floorH`**, not above grade.

A door that meets uphill terrain above `y: 1.5` can set `groundEntrance: true`
to receive pedestrian approaches. Its sill still uses the building's shared
vertical datum; match it to the local ground or landing. These explicit uphill
entrances do not participate in choosing that shared datum. Unmarked upper
doors and garage doors do not receive pedestrian approaches.

## Porch (top level, spanning volumes)

```
{ "style": "open"|"carport", "face": "-v", "u": [u0, u1], "wall": v of the wall plane,   // face = outward normal; the extent runs along the wall
  ...every open-porch option above; "stepsAt", "door.at" are fractions along the porch itself }
{ "style": "open", "face": "+u", "v": [v0, v1], "wall": u of the wall plane, ... }
```
`height` on an open porch is its post height above `floorH`; its roof eave is
`floorH + height`. Optional `floorThickness` (0.05–1 m) creates a thin elevated
deck instead of the default foundation reaching the ground. Use this for upper
balconies.

`roof: "none"` on an open porch creates an uncovered deck with slender posts
supporting it from grade, and short railing posts when `railing: true`. Its
floor defaults to a 0.22 m thick slab; `floorThickness` overrides this. `height`
is ignored because there is no roof. Use `floorH` for the deck elevation and
`posts` for the support count.
`railSides: ["front", "left", "right"]` selects railing edges (all three by
default); left/right are as viewed facing the wall. Omit shared edges where
two deck sections meet.
`sideRailGaps: {"left": {"at": 0.15, "w": 1.2}}` creates an opening for
stairs in an end railing. Keys are `left`/`right`; `at` runs from the house
(0) to the outer edge (1), and `w` is the opening width in metres. Use a
matching `details` stair; its top elevation is `y + height`.

A face porch (`faces[].porches`) can only span its own volume; use this when one
porch runs across two volumes' fronts (an upright-and-wing farmhouse, a house
plus its shop wing).

### Notes

- `roof.type: "mansard"`: a frustum `h` high whose slopes run `inset` m inward
  (small `inset` = nearly vertical), with a flat cap and an eave cornice
  (`cornice` works as on hip roofs, dentils included). Cupolas and chimneys sit
  on the cap. `dormers` pokes wall-coloured dormers with a window and a tiny
  gable out of the slope on the listed faces (all four if omitted), `y` m above
  the eave; `count` spaces them evenly, `at` places them.
- Windows or signs at or above the eave of a mansard sit inside the slope;
  give the storey or sign an `out` so they come forward of it.
- `doors[].type: "garage"`: a wide pale sectional door with a thin surround,
  `panels` shallow grooves and four little lights in the top panel; no knob,
  no lamp unless `lamp: true`.
- Sign styles `"bronze"` (dark bronze, pale gold serif caps, thin border; the
  bronze rectangular plaque — or the rounded tablet with `shape: "plaque"`)
  and `"ghost"` (faded caps painted straight on the wall, no board; `opts.fg`
  overrides the paint, multi-line text works). Ghost signs are a transparent
  plane, so they stay a separate mesh in the bake — use them sparingly.
- `signs[].image`: a rectified photo (see the fire hall mural: captured from a
  2021 Street View pano, perspective-corrected with Pillow to the mural's real
  aspect, saved as a JPEG under `data/<site>/textures/`) mapped onto a plane
  flush with the wall; `w`/`h` in metres should match the photo's aspect.
- `porches[].style: "open"`: a real open porch on a raised slab (`floorH`),
  square posts every ~2.4 m including both ends (or `posts`), a shallow hip /
  flat / gable roof with a trim-coloured fascia, and with `railing: true` a top
  rail with thin balusters that leaves a gap in front of the steps. `range`
  spans face fractions (`[0, 1]` = full width) instead of `at` + `w`; `d` is
  the depth outward. `steps: n` are centred on `stepsAt`, defaulting to the
  first door of that face inside the porch (else the porch centre). Doors and
  windows behind the porch stay on the main face: give the door `y: floorH`
  so it stands on the floor. Without `style` the porch is the gabled entry box.

## Detail (free-standing, in the u/v frame)

```
{ "type": "lawnsign", "text": "...", "style": "red"|"navy"|..., "u": , "v": , "w": m, "h": m, "rotation": radians }
{ "type": "cross"|"bush"|"flag", "u": , "v": , "size": m, "height": m }
{ "type": "keyboard-tribute", "u": , "v": , "y": 0.65, "rotation": 0 }
// Owner-requested keyboard on an X stand with a laid bouquet of white roses. 88 keys, 1.50 m wide;
// y is the supporting deck height. Keys face +v before rotation.
{ "type": "ramp"|"stair", "u": , "v": , "dir": [du, dv], "length": m, "height": m, "w": 1.2,   // starts at (u, v) at grade and climbs toward dir
  "landing": m, "railing": true, "color": ..., "railColor": ... }                             // wheelchair ramp (sloped deck) or an exterior stair (steps) with rails
// Stair construction:"open" gives thin treads and two stringers, with open
// risers and empty space below. Default construction:"solid" retains masonry.
// y raises the bottom; y+height is the top of the flight. dir is numeric [du,dv].
{ "type":"landing", "u": , "v": , "w": 1.3, "length": 2.2, "height": 1.475,
  "y":0, "color":..., "railColor":..., "railing":true,
  "railSides":["front","back","left"], "rotation":0 }
// Independent thin platform with four supports reaching grade. u/v centre;
// w along u, length along v. Railing front=+v, back=-v, left=-u, right=+u
// before rotation. Omit edges joining stair flights. Walking surface=y+height.
```

## Authoring accuracy

### Measured detail controls

- `parapets[].outline`: 3–96 simple, counter-clockwise points `[x,y]`, with
  x normalized to `-0.5..0.5` of the specified width and y to `0..1` of the
  specified height. The ring closes automatically. This overrides the preset
  outline; sample actual curves with several points, keeping small steps intact.
  `trimWidth` and `trimDepth` control its coping. Custom outlines use an offset
  of the real silhouette instead of scaling a preset. Avoid tiny notches relative
  to trim thickness. Include the silhouette during massing review.
- `windows.divisions: {vertical:[0.25,0.5,0.75], horizontal:[0.3,0.65], width:0.05}`
  replaces default mullions. Fractions run left-to-right and bottom-to-top within
  the glass. Sorted unique fractions must be strictly inside 0..1. Bars are
  clipped to the pane outline, including arches. Empty arrays suppress that
  direction. Preserve the observed subdivisions of prominent windows.
- `pilasters.fitUnderEave:true` limits the capital below the cornice.
  `capHeight` (default 0.3 m), `capOverhang` (default 0.1 m), and `cap:false`
  allow measured capitals or no capital. Legacy defaults are unchanged; use the
  explicit fitted option for columns terminating beneath a pitched roof.
- `faces.FACE.moldings` supports measured courses from bottom to top:
  `[{range:[0,1], y:4.2, color:"#d7d4bc", profile:[{height:0.08,depth:0.12},
  {height:0.12,depth:0.2}]}]`. Each of 1–12 courses has height and projection in
  metres. Model the observed profile without stacking coincident bands.

The fidelity packet includes conservative geometry findings for roof penetration,
opening overlap, raised entrances without local support, and nearly coplanar wall
junctions. Intentional junctions require an independent visual explanation;
the audit is not a general-purpose solid collision solver.

- Preserve the building’s distinctive silhouette, proportions, window counts,
  floor levels and entrances. Style may soften edges and materials; it must not
  change observed architecture. Record measurable requirements before authoring.
- If the schema cannot express an observed feature, extend it or report the
  limitation as unresolved. Do not silently substitute a generic approximation.
- Colours: sample mid-tones from photos; avoid pure white/black.
- Heights: storey ≈ 3–4 m (commercial 3.6–4.2, churches 5–7 to eaves); raised
  basements 1.2–1.6 m.
- Projecting bays: a small bay window is `faces[].bays`; a whole projecting
  pavilion (door, plaque, tall window, parapet) is a second, slightly taller
  volume overlapping the face (see the St. Agnes pavilion).
- Cross gables and wings are second volumes whose gable meets the main roof;
  dormers (`roof.dormers`) are for windows poking out of a slope.
- Check the render against the photo from the same side and iterate.

## Lesson from St. Agnes: get a frontal photo of every face first

The first blueprint was read off an oblique Street View pano, which fused the
south front and the west side into one facade: the west side's three arched
windows ended up on the front and the parapet drifted off-centre. Before
authoring, capture a pano from directly in front of each face you'll model
(narrow field of view, `…,3a,55y,<heading>h,95t` in the Maps URL), and read the
elevation bay by bay: count bays, note which are projecting or recessed, then
per bay list the openings by floor with their shapes. Only then write faces.

Landmark signs may set `signs[].brand` to `tom-wahls`, `barilla`,
`mcdonalds` (golden arches) or `mcdonalds-wordmark` (white lettering).
Use a near-square sign for arches and the Tom Wahl's upright paddle; use a
wide sign for wordmarks and the Barilla oval. `image` still takes priority.

Steel-girder bridges can opt into broad retaining structures:
`bridge.girderHeight` adds solid steel side plates of that total height,
starting at the deck underside, with top/bottom flanges and vertical stiffeners.
The plates use the blueprint trim color and replace the open railing.
`bridge.abutmentWidth` sets the support width across the railway;
`bridge.wingWalls` accepts `{length, splay, thickness, endHeight, color}` in metres.
Four concrete walls extend outward from the abutments, flare away from the
road opening and taper to `endHeight`. Their geometry leaves the clear span
between piers untouched. `approachWidth` sets a level embankment top,
`approachPlateau` its level run beyond each bridge end, and `approachLength`
the subsequent smooth descent to terrain. At retaining bridges the bank rises
inside the abutments and slopes behind the wings to avoid exposed terrain seams.
Omitted options retain legacy form.

Set `bridge.approaches: false` for a freestanding bridge ruin: the span keeps
an open ground-level bed without artificial embankments up to the deck.

## Open auditoriums

Root `amphitheater` uses an integrated hipped canopy, open perimeter, stepped
seating, stage and stage house. It excludes volumes, porches and other root
structures. See `MINIATURE_KIT.md` for its axis, stageEnd, height, roofRise,
backstageDepth, rows, monitor and color fields. Dimensions follow the footprint.
`bowlDepth` (2–8 m, default 5.2) lowers the stage and nested seating tiers below
exterior grade. `audienceChamfer` clips both audience-end corners (default up to
12 m). `porchDepth` (1.5–6 m) controls the upper veranda depth: the deck and
bowed canopy project beyond the wall, with doors set in a shallow recess.
Its flared gable, clerestory and nameplate follow the Hagen Center;
the separate lower entry, stairs and loading apron meet the sampled hillside.
The scene excavates the same polygon and omits a generic building foundation.

Clock facade elements use window `type: "clock"`, diameter `w`, and metal `trim`.
They draw an open Roman-numeral dial and hands directly over the masonry.

`athenaeumFront: { "floorH": 1.4 }` selects the Athenaeum Hotel's native lake
facade details: decorated veranda columns, the grouped arched entrance transom,
and a central stair flight to a shared landing with two curved lower flights.
Keep the lakefront and wing porch specifications as
frontage metadata; this renderer replaces their geometry. The site supplies
`athenaeumGround.heightAt(u,v)` in the building's local frame, relative to its
unchanged floor base, to support the veranda and stair feet on the real terrain.
Optional `fountain: { "u": 1, "v": 35.25, "radius": 1.15 }` places the
tiered fountain on the entrance axis between the lower flights. Its forecourt
paving belongs in landmarks and must connect both stair feet.

`alumniHallBalcony: true` adds Alumni Hall's faceted upper balcony and roof cap,
with its deck supported by the clipped front-bay volume at height 7.9 m. The
cap's rear edge overlaps the main hip roof; omit the old elevated face porch.

### Lenna Hall veranda and roof

The optional `lennaHall` composite supplies the roof and continuous covered porch for Lenna Hall's eight-sided main volume. Its `outline` is the counterclockwise outer eave in building-local metres; `porchDepth` sets the wall inset, `floorH` the veranda level, and `eave` the lower roof height. `annexOutline` describes the attached lower rear roof. Pair it with matching polygon wall volumes using `roof.type: "none"`. `src/lenna-hall.js` builds the flared polygon roof, corner arches, rails and main entrance stairs; the site supplies local terrain heights for the stair feet and veranda foundation. `wallMaterial: "vertical-wood"` gives the hall its vertical timber boarding.

### Hultquist Center veranda and roof

`hultquistCenter: { "floorH": 0.55, "bunting": true }` supplies Hultquist
Center's two-level wraparound veranda, four open Miller Avenue arches,
rounded entrance steps and nameplate, and the shared main hip roof. Pair it
with the recessed room polygon using `roof.type: "none"`. Porch footings and
entrance treads follow local terrain. The roof, arches, decks, rail tops and
sign remain visible in coarse streaming geometry.
