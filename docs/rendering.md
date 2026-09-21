# Rendering, streaming and the viewer

The viewer is `index.html` plus `src/` (Three.js from a pinned CDN import map,
no bundler). `src/site.js` turns a built `data/<site>/site.json` into the
diorama; `src/blueprint.js` renders per-building blueprints; `src/bake.js`
collapses the result into a handful of draw calls. Everything below is runtime
behaviour; the pipeline that produces the data is in [pipeline.md](pipeline.md).

## The look

The rendering is layered to get a soft, cozy, miniature feel in the spirit of
Tiny Glade / Islands & Trains:

- a pale blue gradient sky dome that also lights the scene (PMREM environment)
  plus one warm, low sun with blurred VSM shadows. VSM needs `shadow.bias = 0`;
  a large negative bias removes shadows. Shadow coverage follows the visible
  neighbourhood with room for offscreen casters; small pans reuse the cached
  shadow map (`shadowMap.autoUpdate = false`), larger pans, zoom changes,
  streamed geometry and day/night changes refresh it.
- a cool sky fill against the gold sun, so shadows drift blue rather than grey,
  and fresh, vivid lawn and foliage greens.
- post-processing: GTAO ambient occlusion, tilt-shift depth of field whose focus
  and blur scale track the camera, bloom on lamps and windows, ACES tone
  mapping, then a grade: a little saturation and contrast, a split tone
  (shadows lifted and cooled, highlights warmed), fine animated film grain and
  a warm vignette.
- a faint world-space grain baked into the shared materials (`grainy` in
  `src/kit.js`) so flat vertex colour reads as plaster, asphalt or turf.
- shared procedural brick, stone, siding, shingle and membrane-roof patterns
  (`src/materials.js`) that need no image downloads or texture allocations.
  Windows have open frames with recessed, muted daylight glass and stable
  per-pane variation in blinds, curtains, brightness and warmth.
- geometry that is not perfectly flat or straight: gently bumpy vertex-tinted
  grass with instanced tufts and wildflowers, shingle courses, dry-stone walls,
  flagstone paths and a small random wobble on props. Entrance paths meet the
  porch steps; storefront aprons and sidewalks share one continuous surface.
- trees as Tiny Glade draws them: a gently lobed canopy volume wearing a few
  hundred small domed leaf-cluster dabs, each taking its shading normal mostly
  from the canopy so hundreds of strokes light as one soft ball. Opaque
  geometry throughout (no alpha cards), so ambient occlusion and depth of field
  see what the eye sees. One surface per canopy matters: blurred VSM shadows
  paint a dark splotch wherever two shadow-receiving surfaces intersect.
  Heavier lobing and darker crevices read as small and busy; keep the volume
  gentle and let the dabs carry the detail. `IcosahedronGeometry` `detail` is
  (detail+1)² triangles per face, not recursive halving: 10 for a street
  tree, 18 for a park tree.
- roads coloured by where they are, never by which ribbon is drawn: a mottle
  plus a darker gutter by distance to the traced curb contour, so overlapping
  ribbons at a junction paint alike; faded double-yellow centre lines on
  two-way through streets, a manhole cover every so often; chimney smoke while
  the viewer is awake.
- terrain, roads and pedestrian paving share one piecewise-planar grade. Roads
  and parking form one asphalt mesh with curbs taken from its boundary;
  sidewalks, aprons, park paths and crossing approaches form another,
  clipped against the asphalt, 14 cm above the road and ramping down at
  crossings. Building floors meet their frontages, with foundations carrying
  the backs of sloping lots.

`src/palette.js` holds every scene colour and `src/colors.js` the named
wall/roof swatches used by styles and blueprints. A place always builds from
its own name as the RNG seed (`overrides.json` may set `seed` to share
placement with a parent site), so tree placement, colour jitter and wobble
never move between visits.

### Day and night

The **Day / Night** button changes the scene in place: cool moonlight, a blue
evening sky and haze, warm windows with per-room variation and curtains, and
streetlights with a soft halo and a pool of light following the terrain (six
nearby real lights, three on phones, also light walls and trees). The camera
and geometry stay put; the transition respects reduced motion and the choice
is saved in `localStorage` (`town-time`). `?time=day|night` in the URL takes
precedence. Fades follow elapsed time and resume after slow shader compilation.
`src/lighting.js` holds both profiles;
`window.__town.lighting.setMode('night')` switches from the console.
Streetlights are procedural placements, not surveyed locations; a style's
`nightWindows: "all"` keeps every window of a building lit.

### Landscape

Lawns, woodland floors and agricultural fields are separated, with fine
surface detail evaluated in world metres so large rural triangles do not
stretch the grass variation. Mapped woods keep most of their density outside
the village centre; yards and waterways get irregular groups with exclusions
for buildings, paving, pitches and water. Placement is deterministic and
capped at 9,000 additional trees and 3,500 shrubs per site. Open waterways
round mapped bends conservatively, keep their endpoints and follow the shared
terrain mesh so they never break through the ground. The mix is a visual
approximation, not a tree survey.

## Streaming

The published miniatures stream by default. `town bake <site>` exports the
scene into camera-sector chunks under `data/<site>/stream/` (see
[data-format.md](data-format.md)); the viewer loads a simple regional base
first and swaps in detail sectors as they come into view.

- Sectors cover roughly 100 m and hold terrain, pavement, building, vegetation
  and prop detail. Whole offscreen sectors are culled before geometry and
  shadow traversal; panning prioritises the new view and unloads distant detail.
- Repeated trees share one canopy library per miniature and are instanced per
  sector; distant crowns keep shape and colour without leaf dabs.
- Streetlamp poles and bulbs share geometry; instanced bulbs retain their
  original emissive material and day/night behavior.
- Large maps split the distant landscape into 400 m regions. Dense smaller
  miniatures whose coarse geometry exceeds 32 MiB use 200 m regions. Startup
  loads the shared base and the opening camera's regions; visited regions stay
  resident. The full building and terrain generators load only for authoring
  views or the original loader.
- Zooming out simplifies sectors by projected screen size, central detail
  outlasting peripheral. At the usual 26° field of view central detail loads
  to about 1800 m and stays until about 2075 m (`src/stream-policy.js`).
- Far geometry uses compact normals and millimetre rounding; exact surface
  seams, bridge beds and loaded detail keep their positions. Coarse terrain
  keeps exact tile edges; streetlights and central monuments stay resident so
  night lighting is consistent.
- A worker inflates chunks into one buffer and transfers it to the main
  thread; geometry uses the typed arrays directly. Base downloads are split into
  independently verified files of at most 20 MiB. Stalled downloads time out
  after 30 s without progress; a failed streaming start falls back once to the
  original in-browser generator (`?stream=0`) and then shows a retry button.

| Resource | Phone profile | Desktop profile |
| --- | ---: | ---: |
| Resident detail budget, geometry and textures | 40 MiB | 80 MiB |
| Maximum resident detail tiles | 6 | 12 |
| Compressed tile cache | 4 MiB | 8 MiB |
| Concurrent fetch/decode operations | 1 | 1 |

Those limits are in addition to the resident coarse base, decoding buffers and
renderer allocations. Every exported asset must stay under 25 MiB compressed
(`tinytown/web/stream-asset-limits.mjs`). Eviction disposes geometry, instance
buffers, materials and textures; `window.__town.streaming.stats` shows the
current allocations.

Browsers without workers, gzip `DecompressionStream` or the secure-context
digest API (including plain HTTP over a LAN) use the original generator.
Authoring views (`bp`, `isolate`, `stage`, `procedural`, `notrees`, `nobake`)
always use it. Sites that are not published stream only when opened with
`?stream=1` after baking.

## Viewer URL parameters

All parameters are read from `location.search` (`src/site-data.js`,
`src/main.js`, `src/bootstrap.js`, `src/stream-policy.js`, `index.html`).

| Parameter | Values | Effect |
| --- | --- | --- |
| `site` | site name | which `data/<site>/site.json` to load; a route document pins it with `<meta name="town-site">` |
| `time` | `day`, `night` | opening scene; overrides the saved preference |
| `quality` | `mobile`, `desktop` | force the phone or desktop rendering profile |
| `resolution` | `desktop`, `mobile`, or a number 0.25–2 | canvas pixels per CSS pixel (desktop caps at 1.75, mobile at 1); below 1 uses crisp pixelated scaling |
| `stream` | `0`, `1` | `0` uses the in-browser generator; `1` streams an unpublished site and opens the Streaming demo panel |
| `tiles` | `1` | open with sector outlines visible (green loaded, amber pending, grey base) |
| `diagnose` | present | keep a streaming failure visible instead of falling back |
| `free` | `1` | free orbit camera instead of the fixed isometric tilt |
| `focus`, `side`, `dist`, `height` | id, face, metres, metres | aim at a building: `side` is `+u`/`-u`/`+v`/`-v`, `front`, or a compass bearing; defaults 45 m and 8 m |
| `bp` | id[,id…] | preview `data/<site>/buildings/<id>/draft.json` in place of the accepted blueprint |
| `isolate` | id | render only that building |
| `stage` | `massing`, `detail` | massing renders volumes without facade detail |
| `procedural` | present | ignore baked surfaces and regenerate terrain and pavement |
| `notrees` | present | leave trees out so nothing blocks a facade |
| `nobake` | present | keep every generator mesh separate (slow) so a raycast can say what a pixel is |

`town render` builds `?site=…&focus=…&side=…&dist=…&height=…&stage=…&free=1&bp=…&notrees=1`
for its screenshots. Named routes (`/avon`, `/chautauqua`) accept every
parameter except `site`, which the path already fixes.

## Performance profile

- Rendering is capped at 60 fps while the camera moves and 30 fps idle; after
  five seconds without input it pauses entirely (smoke and grain hold). Hidden
  tabs pause immediately. Call `window.__town.renderLoop.wake()` after changing
  a visual setting from the console.
- Phones and tablets use the same geometry and terrain resolution as desktop
  with 1024-pixel shadows, simpler foliage and fewer tufts; ambient occlusion,
  depth of field and bloom are omitted. `window.__town.quality` shows the
  active settings. A lost WebGL context pauses and offers a reload button.
- A loading bar runs from first paint to first frame, paced by how long each
  build section took on the last visit (`src/loading-progress.js`). Startup
  failures show a message and a **Try again** button.
- Surfaces: `town bake` precomputes terrain and pavement into
  `surfaces-<hash>.bin.gz` so visitors skip ground classification and
  triangulation. The viewer checks `SURFACE_VERSION` (`src/surface-assets.js`)
  and the manifest key; a mismatch or a missing asset falls back to generation.
  Bump `SURFACE_VERSION` only when the asset format changes; generator edits
  are already caught by the `bake --check` fingerprints.

Reproduce the cold-load benchmark (a benchmark, not a test; needs the private
browser and network access):

```sh
node tests/browser/load-benchmark.mjs
TOWN_BENCH_ROOT=/path/to/baseline node tests/browser/load-benchmark.mjs
```

`TOWN_BENCH_RUNS`, `TOWN_BENCH_PATH`, `TOWN_BENCH_MBPS` (cold-cache throttling)
and `PIPELINE_PYTHON` are optional.

## Console handles

`window.__town` exposes `scene`, `camera`, `renderer`, `composer`, `controls`,
`sun`, the passes (`gtao`, `bokeh`, `bloom`, `vignette` with `lift`/`grain`
uniforms), `grain.value`, `lighting`, `quality`, `streaming.stats`,
`renderLoop`, `lookAtBuilding(id, face, dist, eye)`, `street.surfaces.grade(x, z)`,
`street.prof` (per-section build timings) and `timing`.

## Camera

The camera is a fixed isometric tilt (`src/isocontrols.js`): drag grabs the
ground so the point under the cursor stays under it; scroll zooms; horizontal
scroll rotates around the look-at point; up/down arrows glide and left/right arrows turn. Each published
miniature opens on a fixed view that resets on load; `?free=1` and `?focus=`
views keep their camera per tab in `sessionStorage`.

## Live bounded previews

The local change queue serves unique `/previews/<id>/` links from each task's
workspace. `tinytown/preview.py` builds the site's current source and overrides
with `build(write=False)`, resolves a building id, address or landmark name,
and crops roads, terrain, areas and nearby structures before procedural
rendering. No surfaces or streaming bake is required. Preview lighting is a
simple inspection light rig; production post-processing remains in the main
viewer.

A preview spec is `{"site":"avon-extended","target":"75 South Avenue",
"radius":60}`. An explicit `"center":[x,z]` uses site coordinates in metres
and takes precedence over a target. Radius defaults to 60 metres and is limited
to 10–200 metres. Ambiguous names report an error; use an exact id or center.
Draft building files are not accepted automatically: the scene uses overrides.

For an asset without a property, use
`{"asset":{"module":"src/my-asset.js","export":"preview"}}`. The module
exports an async or synchronous `preview({THREE})` function returning a Three.js
`Object3D` or `{group: Object3D}`. This adapter can call an existing asset builder
with its required arguments. Its returned bounds determine the initial camera.
Only workspace-relative JavaScript module paths are accepted.

The preview shell watches `/previews/<id>/events` SSE `preview` events carrying
`{"fingerprint":"…"}`. The initial fingerprint establishes a baseline;
subsequent edits reload after a 450 ms debounce. Reloads fetch uncached modules
and scene data, preserving the orbit camera in session storage. Invalid JSON,
module imports and generator errors appear in the viewport, which keeps
watching for the next edit. Source polling includes source modules, site input
files, overrides and textures, and excludes generated streams and surface bakes.

Stock asset adapters use the current town generators and need no property or
custom wrapper. For example:

```sh
./town preview --asset tinytown/web/preview-assets.js --export tree
./town preview --asset tinytown/web/preview-assets.js --export bench
./town preview --asset tinytown/web/preview-assets.js --export playground
./town preview --asset tinytown/web/preview-assets.js --export fountain
```

The tree and bench use fixed seeds so edits can be compared without random
variation. The playground includes a wooden playset and swings. Custom module
paths must be under `src/` or named `tinytown/web/preview*.js`, matching the
preview server's permitted runtime files.
