# Chautauqua Institution

`data/chautauqua/` is a miniature of the Chautauqua Institution grounds in
western New York: from Elm Gate to Bryant Gate along Chautauqua Lake, with
Bestor Plaza and its fountain, the historic halls, the Amphitheater, the
Athenaeum Hotel, Miller Bell Tower, the piers and the 43 detached practice
cabins beside Lenna Hall. It is served at https://chautauqua.town (its own
Worker, `wrangler.chautauqua.jsonc`) and at https://avon.town/chautauqua.

## What makes it different from Avon

- **Scoped.** Avon models every footprint in its box. Chautauqua's
  `sites/chautauqua/scope.json` freezes `building_ids`; `town build` includes
  only those structures, `town author --all` authors only those, and
  `town stage` refuses a scene whose ids differ from the scope or that still
  has an unauthored structure. Keep the scope file in place (and named by
  `"scope"` in `site.json`) before any `--all` run, otherwise every mapped
  building in the box becomes work.
- **A plugin.** `tinytown/plugins/chautauqua.py` supplies
  `landmarks()` (piers, plaza paving, parking rows, gate barriers, pitches, the
  garden, from `sites/chautauqua/landmarks.json`), `outline()` (the shoreline
  and NY 394 edge from `sites/chautauqua/outline.json`) and `scope_filter()`
  (mapped buildings whose centroid lies inside OSM relation 19317589, the
  Institution grounds). Extra Overpass extracts for the lake and the perimeter
  fences live in `source/lake-osm.json` and `source/barriers-osm.json`.
- **A non-rectangular diorama.** The outline cuts terrain, surfaces and the
  streamed base to the lakefront, so the miniature ends at the water and the
  highway rather than at a box.
- **Authored structures OSM lacks.** Negative ids in `overrides.json →
  authored_buildings` and `footprints`: the Bestor Plaza fountain envelope
  (`-7967716565`, an 11 m basin inferred from the aerial around OSM node
  7967716565) and open-lane envelopes around the Bryant and Elm gate nodes.
  These are authoring footprints, not surveyed outlines; the gate models are
  small booths beside the lane.
- **Curated references.** `sites/chautauqua/labels.json` names structures OSM
  does not, and `sites/chautauqua/web-references.json` points the model at
  known photographs and the original fountain drawing. `town author` picks
  both up by default.
- **Integrated components.** Several buildings use renderer composites rather
  than generic volumes: `amphitheater`, `fountain`, `pavilion` with classical
  columns (Hall of Philosophy, Smith Wilkes Hall), `athenaeumFront`,
  `lennaHall`, `hultquistCenter`, `alumniHallBalcony`, barrel roofs (McKnight
  Hall). Their fields are in [BLUEPRINT_SCHEMA.md](BLUEPRINT_SCHEMA.md) and the
  Chautauqua appendix of [MINIATURE_KIT.md](MINIATURE_KIT.md).
- **Perimeter fencing.** Eight mapped fence ways define the Institution
  boundary. Gate nodes cut openings and short panels follow the terrain; source
  tags and Street View show chain-link, so the renderer keeps it open mesh at
  about 2.15 m (a visual estimate).

## Working on it

```sh
./town serve                                  # http://localhost:8734/chautauqua
./town status chautauqua
./town author chautauqua 619932539 --reauthor 619932539 --accept   # the Amphitheater again
./town bake chautauqua
./town stage --target chautauqua && ./town serve --dist chautauqua --port 8735
```

Browser checks specific to this site: `node tests/browser/run.mjs chautauqua`
(`tests/browser/chautauqua-browser.py`, needs `dist/chautauqua/` built first),
`hultquist`, `amphitheater-lod`, `pavilion-lod`, `barrel-lod`, `boats`,
`fountain-lighting`, `gate-barrier`, `diorama-outline`.

## Sources

Scope was matched against the Institution grounds map
(https://www.chq.org/wp-content/uploads/2016/08/chqmap.pdf) and aerial imagery.
The fountain's proportions follow the original drawing and restoration
photographs published by The Chautauquan Daily (13 ft overall, 2 ft 3 in basin
wall). The Amphitheater is the 2017 replacement, not its predecessor.
