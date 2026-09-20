# Landmarks and outlines

Landmarks are the non-building features a miniature needs to feel like the
place: water, running tracks, pitches with real base positions, playgrounds,
piers, plaza paving, parking rows, gates and fences, a garden. Buildings come
from OSM footprints plus blueprints; landmarks come from OSM tags plus a
per-site **survey** kept in `sites/<site>/landmarks.json`.

## Where landmark geometry comes from

`town build` assembles `site.json → landmarks` in this order:

1. **Request and overrides.** `overrides.json → landmarks` holds features in
   local metres (`{"id", "kind", "name", "pts": [[x, z], …], …}`).
2. **The plugin hook.** If `sites/<site>/site.json` names a `plugin`, and
   `tinytown/plugins/<plugin>.py` defines `landmarks(site, paths)`, its features
   are merged in: a feature with the same `id` replaces the earlier one, new ids
   are appended.
3. **Clipping.** Everything is clipped to the site bounds (or the outline).

The Avon and Chautauqua plugins implement `landmarks()` the same way: read the
sidecar named by the `landmarks` key in `site.json`, project its geographic
`[lon, lat]` coordinates into the site's local frame with
`site.geo_point(site['center'])`, and hand the rest of each feature through
unchanged. Because the sidecar is geographic, one survey serves every site that
shares the ground. Avon keeps its survey in
`sites/avon-extended/landmarks.json`.

```json
{"features": [
  {"id": "driving-park-oval", "kind": "track", "width": 6, "closed": true,
   "source": "traced from the Esri aerial", "coordinates": [[-77.7466, 42.9142], …]},
  {"id": "pitch-…", "kind": "pitch", "closed": true, "coordinates": […], "bases": [home, first, second, third]},
  {"id": "playground-…", "kind": "playground", "closed": true, "coordinates": […],
   "equipment": [{"type": "swing", "coordinates": [lon, lat]}]}
]}
```

Kinds the renderer (`src/landmarks.js`, `buildLandmarks(features, {grade})`)
understands include `water` (closed polygon, or an open centreline with
`width`), `track` (centreline with `width`), `pitch`, `playground`, `paving`,
`gravel`, `beach`, `pier`, `parking-row`, `barrier`, `gate-barrier`,
`bleachers`, `garden`, `cropland`, `park-sign`, `school-sign`, `school-forecourt`, and
site-specific grounds such as `andriaccios-ground`. Pitch `bases` are
`[home, first, second, third]`; the renderer never guesses diamond orientation
from a boundary. Polygon `holes` use the same coordinate convention. Every
feature should carry a `source` (map, aerial, photograph) so the survey stays
auditable; approximate locations are recorded as such.

Horizontal landmark geometry is clipped to the terrain cells and their
triangulation diagonals before height sampling (`src/landmark-drape.js`), so
water, tracks and playing surfaces sit on the terrain between OSM vertices
instead of sinking between endpoints. Water extraction omits tunnel/culvert
and covered segments; an untagged river centreline defaults to a visual width
(40 m for the Genesee, 25 m elsewhere; an explicit OSM `width` wins). These are
visual approximations, not surveyed bank polygons.

Corn fields use `kind: "cropland"`, `closed: true` and
`crop: {"type": "corn", "angle": -0.25, "height": 1.9, "rowSpacing": 0.8}`.
The angle is in radians from local south toward east; dimensions are metres.
Trace separate cultivated polygons around woodland, drainage, solar arrays
and buildings. Individual corn stalks are planted about 28 cm apart along
rows. Each stalk is one upright quad that turns toward the camera; there are
no crossing cards or horizontal foliage images. Four stalk silhouettes share
one small atlas. Compact instanced attributes store position and height in
centimetres. Distant fields retain individual plants at a lower density.
Alpha cutouts write depth without blending. Corn uses the ground's AO/focus
depth (color-pass layer 1) and adds no animation or stalk shadow draws.
Every cropland polygon also has brown plowed soil draped over the terrain,
including its unplanted headland. Procedural furrows follow `crop.angle` and
`crop.rowSpacing`, fading below pixel size. Field coordinates survive surface
batching and streaming; the soil needs no texture download. Cropland suppresses
grass bumps and random vegetation. Omit `crop.type` for a bare plowed field.

## Outlines

A diorama may have a non-rectangular physical edge (Chautauqua follows the
shoreline and NY 394). `town build` looks, in order, at `overrides.json →
outline`, `source/site_request.json → outline`, the plugin's
`outline(site, request, overrides, paths)` hook, and finally the sidecar named
by an `outline` key in `site.json`. Records are geographic
(`{"coordinates": [[lon, lat], …]}`) or local (`{"pts": [[x, z], …]}`) and are
projected with the same helper. `src/diorama-outline.js` cuts the terrain,
surfaces and streamed base to it.

## Plugin hooks

A plugin is `tinytown/plugins/<name>.py`, named by `"plugin"` in
`sites/<site>/site.json`. Nothing in `tinytown/` compares site names; all
per-site behaviour is one of these optional functions:

| Hook | Called by | Purpose |
| --- | --- | --- |
| `extra_sources(request) -> {name: overpass_query}` | `town fetch` | Extra OSM extracts into `source/<name>-osm.json`. `{{bbox}}` in a query becomes `south,west,north,east`. |
| `landmarks(site, paths) -> [feature]` | `town build` | Authored landmark features in the local frame (above). |
| `outline(site, request, overrides, paths) -> record \| None` | `town build` | The physical outline when neither overrides nor the request has one. |
| `refine_building(building) -> None` | `town build` | Last-chance edits to a built structure record (with its blueprint). |
| `scope_filter(elements, request) -> [element]` | `town scope --bounds` / `--source` | Which mapped buildings belong in the miniature when no explicit ids are given (Chautauqua: centroid inside OSM relation 19317589, the Institution grounds). |

Sites without a plugin get default behaviour everywhere. Unit tests for the
hooks live in `tests/unit/test_plugins.py`.

## Brand signs

Some landmark buildings carry recognisable signage. Blueprint `signs[].brand`
(`tom-wahls`, `mcdonalds`, `mcdonalds-wordmark`, `barilla`) draws a procedural
wordmark or shape; `signs[].image` (an SVG or JPEG under `data/<site>/textures/`)
takes priority. Procedural wordmarks approximate typography; no claim is made
that they are pixel-identical brand artwork, and the miniatures are not
affiliated with the businesses depicted. Signs use alpha-tested canvas
textures that survive the streaming bake.
