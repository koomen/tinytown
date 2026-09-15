# Avon High School — sign, two-story frontage and main entrance

Target: connected High School / Middle School campus building **248254714**.
This is not Avon Elementary School (248254717). The user requested the historic
**AVON HIGH SCHOOL / HOME OF THE BRAVES** lettering, which is retained.

## Authored changes

- Split the previously continuous `south_classrooms` frontage at its mapped
  main entrance. The main classroom wing has an 8.45 m eave, two distinct rows
  of large four-part windows, a low pale foundation band, and plain metal roof
  edging. The adjoining south core has an 8.7 m flat roof.
- Put two pairs of entry doors behind the existing sidewalk endpoint, under
  a deep flat canopy with a thick dark fascia and two supporting posts. The
  lower, tall-glazed commons wing steps forward on the left, matching the
  supplied entrance photograph. Four rooftop HVAC units and a vent remain
  visible over the flat roofs.
- Use the existing blueprint waving US flag on a 10.8 m flagpole, left of
  the approach. The planting court has pale low raised planters, brown beds,
  shrubs, two young deciduous trees with stakes, low path lights, and a
  continuous 4.2 m center walk.
- Add a pale green-white sign panel between two capped brick piers on the
  east-facing school lawn. Its text and small crest are locally drawn
  CanvasTexture artwork; there are no imported bitmap assets.

The building's original `pts`, OBB, orientation, and all nine other original
volumes are unchanged. In particular, the northern library-side entrance,
Middle School wings, gym, south end, and courtyard spur are preserved.

## Source and placement

The primary references are the two supplied CleanShot images:

- a local screenshot
- a local screenshot

The cached Esri aerial (`data/avon-extended/satellite.jpg`) and the August 2025
east-facing Street View (`data/avon-expanded--92bb1889fe--expansion-0007/research/front_248254714_+v.png`)
establish the connected campus and the location of the school-side lawn sign.
The main approach follows mapped footway **249547678**, approximately
`u=-60, v=81.1..114.7`. The vestibule is recessed to `v=78.9`.
The sign is at estimated `u=-26.5, v=105`, facing `+v` toward the eastern
parking lot. Its exact placement and all unmeasured detail dimensions are
photo/aerial estimates, not surveys.

The [district's capital project page](https://www.avoncsd.org/66502_3) describes
the main entrance as a flexible outdoor learning and entrance area. The
[district's 2023–24 report](https://core-docs.s3.us-east-1.amazonaws.com/documents/asset/uploaded_file/1897/AvonCSD/5022017/SotS_Final_2023-24.pdf)
distinguishes the main entrance from the frequently confused library entrance.
The supplied photo governs the actual appearance modeled here.

## Parent integration

No aggregate site/override file, stream bundle, deployment artifact, or git
commit was changed by this task.

1. Merge `building-patch.json` only into building **248254714** after checking
   `expectedFrame` with `pipeline.work_state.building_frame` and
   `expectedBlueprintHash` with `pipeline.work_state.fingerprint`.
   Apply `blueprint`, the optional improved `name`, and `stylePatch.floors`.
   Keep `pts` and `obb` exactly as they are. `blueprint_248254714.json` is the
   standalone authoring payload.
2. Add the two unique features in `landmark-source-patch.json` to
   `data/avon-landmarks.json`, preserving all other features. The projected
   counterpart is `landmark-site-patch.json`; `authored_features` can regenerate
   it for another site center without bespoke projection changes.
3. `src/school-entrance.js` is the only source file owned by this task. The
   parent already wired its exports in `src/landmarks.js` and the school sign
   and forecourt vegetation exclusions in `src/site.js`.

`author-school.py` regenerates the candidate files from the saved baseline.
It deliberately does not modify live aggregates. The final full-source review
uses a local response override for the candidate building and two landmarks.

## Validation evidence

- `before-building.json`, `before-campus.png`, and `before-entrance.png` capture
  the original model. The former sidewalk ended against a continuous wall.
  The first close-up used a too-short review camera far plane, making the
  distant sky black; later review images retain the scene's large sky radius.
- `after-entrance.png`, `after-campus.png`, `after-roof.png`, `after-sign.png`
  show the full source-built town with the candidate applied.
- `after-stream-roundtrip-entrance.png` and
  `after-stream-roundtrip-sign.png` show the baked, packed, decoded detail on
  a ground patch sampled from the real town terrain.
- `browser-checks.json` records finite geometry, all three textures retained
  (entry lettering, US flag, monument sign), decoded bounds agreement, sign
  pier ground contact, doorway and flag ground levels, and exact terrain
  subdivision of all eight forecourt surfaces. The review restores procedural
  brick, glass and ground shaders exactly as `src/streaming.js` does after
  decoding, before capturing the streamed screenshots. Soil and the flag
  island sit 3.5 cm above the paving where their polygons overlap.
- `placement-checks.json` checks that the closest planter is **25.61 m** from
  a vehicle lane and the closest sign pier **14.22 m** away. Beds clear the
  left glass facade by **1.75 m**; all door leaves lie within the central walk.
- Blueprint lint reports **zero errors**. Its only warning is the campus-wide
  window count (149, reduced from 153), most of which belongs to the unchanged
  school wings.

Run the final review with:

```sh
node runs/model-edits-20260913/avon-high-school/render-check.mjs --after-only
```

This uses the repository's private Chromium and loopback server; it does not
open or modify a personal browser or rebuild frozen distribution bundles.
