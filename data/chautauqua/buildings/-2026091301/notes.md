# Andriaccio’s restaurant miniature — September 13, 2026

Authoring scope: a new restaurant building absent from the cached Chautauqua OSM/site, plus its small parking forecourt and furnished garden patio. Stable authored ID: `-2026091301`. No OSM record was invented or inserted. Parent merges `authored-building-source.json` into `overrides.authored_buildings`, preserves `footprint.json` as the saved frame, and merges the associated blueprint.

## Location and evidence

- Official address and location link: https://www.andriaccios.com/ — 4837 W Lake Road, Mayville, NY. Its Google Maps link resolves to 42.2098515, −79.4754421.
- Google Street View, June 2026, front/east oblique: pano `DGTxUcx4Axe7IVDgpT7TJA`, located 42.2100479, −79.4753077, heading205°. `streetview-front.png` and metadata preserve the resolved view.
- Google Street View, June 2026, northwest approach: pano `pk2SWcZH1orLDlDdByElww`, located 42.2102419, −79.4755985, heading157°. `streetview-northwest.png` and metadata preserve the resolved view.
- Cached Esri World Imagery: `data/chautauqua/satellite.jpg` and `satellite.json`. `area-aerial.jpg`, `restaurant-aerial-grid.jpg`, and `footprint-overlay.jpg` document the plot and traced footprint. The building lies southwest of Turner Gate, in the wedge formed by the Route394 bend and the side road.
- County tourism exterior and patio photos: https://www.tourchautauqua.com/directory/andriaccios-restaurant — `tourism-exterior.jpg`, `patio.jpg`, `patio-sunset.jpg`.
- Detailed cream script channel lettering reference: https://www.barcelonalakeside.com/favorite-chautauqua-restaurants — `facade-close.jpg`.
- The official website's image caption suggests an exterior but its current image is an interior. The downloaded `official-exterior.png` was inspected and deliberately not used for exterior geometry.

## Reference-driven details

The miniature retains the low, irregular restaurant plan and separate east dining, west dining, kitchen, projecting sign bay, take-out entry, and service masses. Pale stucco stands above a roughly1m stone veneer band. The east frontage has three arched windows; two remain visible on the west frontage beyond the sign bay. Window frames are pale with dark glass and horizontal divisions.

The current cream `Andriaccio’s` lettering sits directly on the front stucco, with italic serif forms and the sweeping capitalA. It is drawn locally in CanvasTexture, with a separate red/black take-out canopy sign and small oval OPEN patio sign. No external image texture is used. The June2026 imagery shows the front door without the older brown dome awning; the take-out wing retains its dark green curved canopy.

The lot includes narrow white parking lines, wheel stops, a planted stone island with a bare flagpole, and two low solid steps at the main entry. The paving edge is clipped to keep0.8m from the mapped public road edges; the existing restaurant service access remains within the lot. The building footprint itself has at least2.13m of public-road clearance. The eastern and rear patio has timber pergola framing, a low screen fence, cafe tables/chairs, pots, and a red shade sail. The footprint, sign, and garden all stay within the restaurant exception supplied to the boundary agent.

## Limits

The footprint is an aerial-derived approximation rather than surveyed geometry; eaves, shadows, and image parallax limit wall-edge accuracy. Roof heights, hidden rear openings, and patio furniture positions are conservative miniature approximations. Current Street View determines the visible front entrances and lettering; older tourism photographs supplement the garden detail.

## Payloads and integration

- `authored-building-source.json`: geographic source record for `overrides.authored_buildings`.
- `footprint.json`: stable local points and oriented frame.
- `blueprint_-2026091301.json`: native miniature model.
- `building-record.json`: complete projected candidate used only by the private browser route.
- `building-patch.json`: expected-absent ID and stable-center guards, plus source/frame/blueprint payload.
- `landmark-source-patch.json`: geographic garden/forecourt addition; `landmark-site-patch.json` is its projected review counterpart.
- `src/andriaccios-sign.js`: native letter textures and garden geometry. Parent owns shared imports, dispatches, and vegetation exclusions.
- Six low stone cladding bases explicitly use `roof.type:"none"`; this requires the narrow roofless-volume lint support supplied by the parent.

No aggregate site JSON, overrides, cached OSM, generated bundles, or stream assets were modified by this agent. No commit or push was made.

## Validation

See `browser-checks.json` and rendered views for the completed numerical and visual review. The harness builds the full source Chautauqua scene with a private response override, checks the real computed building floor and terrain, then serializes and decodes the restaurant through the actual baked stream format. Procedural material shaders are restored using the same steps as `src/streaming.js`.

Final checks passed with unchanged source hashes: blueprint lint0 errors/0 warnings; native helper syntax; geographic reprojection maximum error0.000057m; centered-frame geometry error3.29e-10m; all geometry finite; four CanvasTexture maps retained after bake/pack/decode; nine procedural surface materials restored; stream bounds error0.0000025m; all13 draped surfaces within0.0000012m of their intended terrain lift; all8 pergola posts extend0.16m below grade; no browser exceptions. Packed restaurant detail is2,098,676 bytes. `after-restaurant.png`, `after-sign.png`, `after-stream-roundtrip.png`, and `after-stream-sign.png` use the final source; aerial/patio views precede only the final apron edge clipping.
