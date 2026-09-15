# Turner entrance lettering

Building: `678506333`, Turner Community Center, 4840 West Lake Road.

The readable reference is `photo-01.jpg`, a Google-attributed visitor photo in [Turner Community Center's public photo gallery](https://www.loc8nearme.com/new-york/chautauqua/turner-community-center/2835997/gallery/#id=WDH4m6ZOmp.jpg). The gallery HTML saved as `reference-loc8.html` explicitly credits this image to Google. [Original image](https://cdn9.localdatacdn.com/ny/chautauqua/2835997/original/WDH4m6ZOmp.jpg).

The photo shows white title-case lettering above the glazed entrance: “Turner / Community / Center.” The adjacent pane reads “Fitness Center / Pool / Classes,” each with a bullet. The left pane carries the Chautauqua Institution wordmark. This implementation uses native transparent lettering and a simple typographic approximation of that wordmark; it does not reproduce the small temple emblem.

The face is inferred from the photo's flanking gym brick on the left and lower long-wing wall on the right, together with the cached north-up aerial's path leading from the circular labyrinth to the recessed connector. In the unchanged authoring frame this is `connector`, face `+v` (northeast), not the long parking-lot facade. A four-column dark-glass facade and aluminum bars support the lettering where this connector face was previously blank. Its existing dimensions and roof remain intact.

Cached Google frontage `front_678506333_-v.png` (May 2023) provides the exterior context but does not show a legible facade wordmark. A detail initially resembling wall letters is Google's copyright watermark (`cached-sign-detail.png`); no large brick-wall wordmark was authored. Attempts to revisit archived pano `i0BgnPczZgsewOReUl3qyA` via original and nearest-viewpoint Google URLs returned “No Street View imagery available here.”

Only `connector.faces['+v']` differs in `blueprint-candidate.json`. `guarded-blueprint-update.json` contains the exact original blueprint SHA-256 and face replacement for parent integration. The site origin, OBB, footprint, all volume ranges/heights, and roofs are unchanged. No shared renderer code or aggregate data was modified.

Validation: blueprint lint reports zero errors and zero warnings. `check-render.mjs` rendered the entrance and full building and verified all eight CanvasTextures survived `bakeMobile` plus binary scene packing. See `entry-render.png`, `building-render.png`, and `render-audit.json`.

Final assembled-scene review: the signed entrance sits above the sampled exterior path. Added a solid landing and nine supported steps with side rails, leaving the building floor, all volume geometry, glass and signs unchanged. Ground contact and bake/pack validation: runs/model-edits-20260913/turner-sign/entrance-contact/notes.md.
