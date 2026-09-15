# Data format

Every miniature is a directory `data/<site>/` plus a small config directory
`sites/<site>/`. `tinytown/paths.py` is the only place that spells these paths;
this document describes what each file holds. Schemas for the two authored
building formats are in [STYLE_SCHEMA.md](STYLE_SCHEMA.md) and
[BLUEPRINT_SCHEMA.md](BLUEPRINT_SCHEMA.md).

## `data/<site>/`

| Path | Written by | Contents |
| --- | --- | --- |
| `source/site_request.json` | `town fetch` | `{"center": {"lat", "lon"}, "size_m": {"w", "h"}, "bounds": {north, south, east, west}, "title"?}`. Re-fetching with different coordinates errors unless `--force`. |
| `source/osm.json` | `town fetch` | Overpass JSON: buildings, roads, footways, rails, water, land cover, trees, POIs for the box scaled by 1.25. |
| `source/elevation.json` | `town fetch` | USGS 3DEP grid: `{"cols", "rows", "bounds", "order", "units", "values": [m, …]}`, row-major from the north-west corner (96 × 96 by default). |
| `source/satellite.json` | `town fetch` | `{"z", "px": [w, h], "bounds", "source": "Esri World Imagery"}` describing the mosaic. |
| `source/satellite.jpg` | `town fetch` | The Esri mosaic itself. **Gitignored**; refetched on demand. Needed for aerial crops. |
| `source/<name>-osm.json` | `town fetch` | Extra Overpass extracts a plugin asked for through `extra_sources()` (Chautauqua: `lake-osm.json`, `barriers-osm.json`). |
| `source/sv_index.json` | `town refs` | Street View panorama index built while capturing (pano ids, positions, dates). |
| `source/composition.json` | `town scope --source` / migration | Provenance of a composed site: bounds, structure counts, which ids were imported and from where. |
| `overrides.json` | you, `town accept`, `town scope` | **The authored truth** (below). |
| `site.json` | `town build` | The built scene. Regenerable from `source/` + `overrides.json`; committed so the viewer and Cloudflare need no build step. |
| `surfaces.json`, `surfaces-<hash>.bin.gz` | `town bake` | Baked terrain and pavement. The index records `inputSha256` (of `site.json`), `sourceSha256` (of `src/*.js` + the precompute page), `compressedSha256`, byte counts and the build profile. Only one `surfaces-*.bin.gz` is kept per site. |
| `stream/manifest.json`, `stream/<chunk>-<hash>.bin.gz` | `town bake` | Camera-sector geometry: `base[-part-N]`, `detail-<x>_<z>` tiles and, for large maps, `region-<x>_<z>` chunks. The manifest records `inputSha256`, `sourceSha256`, per-file sha256 and sizes; `town stage` verifies every file against it. |
| `textures/` | you | Curated images referenced from blueprints (`signs[].image`, murals). Paths in blueprints are repository-relative (`data/avon/textures/…`). Only referenced textures are deployed. |
| `buildings/<id>/` | stages 3–6 | Everything about one structure (below). |
| `frame_review.json` | `town build` | Ids whose footprint frame changed since their blueprint was accepted; `town plan` lists them as `review-frame`. |

Ids are OSM way ids as strings. Structures that OSM lacks get negative local
ids (for example `-7967716565` for a fountain around OSM node 7967716565).

### `overrides.json`

One JSON object, written compactly by `town accept`. Every section is optional.

| Key | Shape | Meaning |
| --- | --- | --- |
| `title` | string | Scene title carried into `site.json`. |
| `seed` | string | Viewer RNG seed for procedural placement (trees, jitter). Defaults to the site name; `avon-extended` sets `"avon"` so the village centre matches the compact miniature. |
| `buildings` | `{id: style}` | Per-building **styles**: kind, floors, colours, roof, storefront, sign, `demolished`, … ([STYLE_SCHEMA.md](STYLE_SCHEMA.md)). Applied over the generator's guess. |
| `blueprints` | `{id: blueprint}` | Per-building **blueprints** ([BLUEPRINT_SCHEMA.md](BLUEPRINT_SCHEMA.md)): volumes, roofs, faces, porches, details in the footprint's u/v frame. Written by `town accept`; a blueprint replaces the style for that building. |
| `blueprint_frames` | `{id: hash}` | Fingerprint of the footprint frame (`center`, `obb`, `pts`) each blueprint was authored against. `town build` compares it with the current frame and flags drift. |
| `miniature_review` | `{id: record}` | The review record published with each blueprint: `status` (`ready` / `needs-attention`), `run`, the `publication` record (`published`, `forced`, `inspection_passed`, repair counts, inspection snapshots), and any `user_edits`. |
| `notes` | `{id: text}` | Provenance notes per building (what the blueprint was authored from). |
| `roads` | `{name-or-way-id: {width?, lanes?, marking?, surface?, pts?}}` | Road overrides. Way ids take precedence over names and can target unnamed driveways; `lanes: 2` enables centre markings; crossings may set `marking: "ladder"`. |
| `authored_roads` | `[road]` | Roads OSM lacks: `{id, class, name, width, oneway, circular, pts}` in local metres. |
| `extras` | `[prop]` | Props placed in local metres: `{"type": "memorial" \| "monument" \| "plaza" \| "clock" \| "canopy" \| "tree", "x", "z", …}`. |
| `areas` | `[area]` | Extra land-cover polygons: `{"id", "kind": "parking" \| …, "name", "pts"}`. |
| `landmarks` | `[feature]` | Landmark features in local metres (`water`, `pitch`, `track`, `playground`, `pier`, `paving`, `barrier`, `gate-barrier`, `garden`, …). Plugin-authored features with the same id replace these; see [landmarks.md](landmarks.md). |
| `footprints` | `{id: {pts, obb}}` | Footprint polygons frozen for buildings whose OSM geometry should not move under an accepted blueprint (or that were hand-drawn). |
| `authored_buildings` | `[building]` | Buildings OSM lacks: `{id (negative), coordinates: [[lon, lat], …], tags?}`, turned into building elements before styles and blueprints apply (gate envelopes, a fountain basin). |

Hand edits to styles, roads, extras, areas and landmarks are normal. Blueprints
should arrive through `town accept` so `blueprint_frames` and
`miniature_review` stay consistent; see [fixing.md](fixing.md) for the manual
repair loop.

### `buildings/<id>/`

| File | Written by | Contents |
| --- | --- | --- |
| `fronts.json` | `town refs` | Street View capture records per face: pano id, position, true distance, angle off head-on, imagery date, faces recorded without coverage. `file` fields are relative to the building directory. |
| `fronts/<face>[-n].png`, `fronts/oblique-<n>.png` | `town refs` | The captures. **Gitignored.** |
| `aerial.json` | `town fetch --aerials`, `town refs --aerials` | Crop record: source mosaic, pixel box, north-up flag. `aerial.png` / `aerial_footprint.png` beside it are gitignored. |
| `references.json` | `town refs --web`, `town author` | The packet the model sees: which images (Street View sheet, orientation map, aerial, web photos), why, camera poses. |
| `images/` | `town refs`, `town author` | Packet imagery: `reference-<n>.jpg`, `orientation.png`, `street-views.jpg`, `web-original-<hash>`. **Gitignored.** |
| `brief.md`, `footprint.png` | `town brief` | Human-readable brief (identity, u/v frame with compass bearings, polygon, terrain, neighbours, photo list, checklist) and the footprint card. |
| `draft.json` | `town author`, you | The working blueprint. Only written when it validates. |
| `notes.md` | you / older runs | Author notes. |
| `author.json` | `town author` | The author call: response, usage, canonical blueprint, validation errors, cues, uncertainties, entrance plan, packet hash, frame, attempts, `terminal`. |
| `repair-<n>.json` | `town author` | Repair pass n (same shape, role `repair`, `base_hash`). At most `review.MAX_REPAIRS` (2). |
| `review.json` | `town author`, `town review --record` | Verdict, findings, `draft_hash`, `passed`, renderer signature, scene critique and follow-up. |
| `comparison.json` | `town author` | For a re-authored building: `{verdict, reason, baseline_hash, candidate_hash, …}` against the accepted blueprint. |
| `renders/<view>.png`, `renders/<view>.png.json` | `town render`, `town author` | Screenshots and their provenance (blueprint, frame, context and renderer fingerprints, neighbours). PNGs gitignored; `compare-<face>.png` puts render and photo side by side. |

A building's **status** (`town status`) is derived from these files, never
stored: `unreferenced`, `referenced`, `drafted`, `needs-repair`, `reviewed`,
`accepted`, `failed` (see ARCHITECTURE.md).

## `sites/<site>/`

| File | Contents |
| --- | --- |
| `site.json` | `title`, `description` (both required to deploy), `domain`, `deploy` placements (`[{"target", "route", "aliases"?}]`), `plugin` (module name under `tinytown/plugins/`), `scope` (scope file name), `landmarks` and `outline` (sidecar file names, relative to this directory; `../avon/landmarks.json` shares a sidecar), `social_image` (`alt`, `width`, `height`). |
| `scope.json` | Frozen `building_ids`, optional `exclusions`, `bounds`, `title`, plus whatever notes the author keeps (Chautauqua records `practice_ids`, `gates`, a `source_map`). Maintained by `town scope`; honoured by `town build` and checked by `town stage`. |
| `labels.json` | `{id: name}` known names for structures OSM does not name; `town author` uses it by default. |
| `web-references.json` | `{id: [{url, page_url, title, provider?}]}` curated web images for the packet. |
| `landmarks.json` | Geographic (`[lon, lat]`) landmark features the plugin projects into the local frame ([landmarks.md](landmarks.md)). |
| `outline.json` | `{"name", "coordinates": [[lon, lat], …]}` non-rectangular physical outline for the diorama. |
| `favicon.*`, `apple-touch-icon.png`, `social-preview.jpg` | Optional per-site icons and preview; the repository root files are the fallback. |

`sites/deploy.json` maps deploy targets to their dist directory and Wrangler
config: `{"town": {"dist": "dist/town", "wrangler": "wrangler.jsonc"}, …}`.

## What is gitignored, and why

| Pattern | Why |
| --- | --- |
| `data/*/source/satellite.jpg` | Esri World Imagery is research reference only and may not be redistributed. `town fetch` restores it (cached responses live in `data/.town-cache/`, also ignored). |
| `data/*/buildings/*/fronts/`, `images/`, `*.png`, `*.jpg`, `web-original-*` | Street View captures, aerial crops, web photos and renders are third-party or regenerable. Only the JSON records describing them are committed, so `town render --compare` and `town review` fail closed until you re-render or re-capture. |
| `data/*/stream/.prepare-*` | Streaming export scratch. |
| `/runs/` | The private headless browser runtime and model-call scratch (`runs/model-calls/`). |
| `/dist/`, `.wrangler/` | Deploy staging; Cloudflare rebuilds it. |
| `.venv/`, `__pycache__/`, `.env*`, `*.pem`, `*.key` | Local environment and (nonexistent) secrets. |

## Licensing of the data

Code in this repository is MIT licensed (see `LICENSE`). The committed derived
data (`data/*/site.json`, `overrides.json`, `surfaces*.bin.gz`, `stream/`) is
derived from OpenStreetMap (© OpenStreetMap contributors) and is available
under the Open Database License (ODbL) 1.0 with that attribution. Elevation
comes from the USGS 3D Elevation Program (public domain). Imagery from Esri,
Google Street View and the web is used locally as reference only and is never
committed or deployed.
