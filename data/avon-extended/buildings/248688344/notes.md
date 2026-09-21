# 290 North Avenue — corrected reconstruction, September 2026

## Identification and frame
OSM 248688344, 290 North Avenue, Avon, NY. High confidence from the geolocated North Avenue photographs, D’Angelo Parkway, driveway, and aerial. +u faces WNW toward North Avenue (283 degrees); +v faces NNE. Main entrance and garage face +u.

## Correction prompted by the second user photograph
The first reconstruction incorrectly divided the original 14.6 by 11.5 m OSM rectangle into two long, narrow wings. That rectangle covers the southern portion of the actual house and omits most of the northern living wing. It was not a reliable whole-house envelope.

The leaf-off Esri zoom-19 aerial shows the missing northern wing and a recessed west/front wall. The corrected L-shaped wall outline is about 12.3 m deep by 18.3 m across the frontage. The southern wing is about 12.3 by 9.7 m; the northern wing about 9.6 by 8.6 m, recessed approximately 2.7 m. Dimensions and wall positions are approximate readings inside the roof eaves, not survey measurements. Original compass bearing retained, frame recentered, and blueprint coordinates translated with it. The original OSM download remains unchanged; a single-property footprint override supplies the corrected geometry.

## Photos used
- User attachment: CleanShot 2026-09-20 at 19.32.09@2x.png, preserved in runs/change-worker/images/0b7cf6fe36ea.png. Closest architectural reference: two shallow roof heights, broad frontage, narrow fascia, two living-room window groups, entry at the wing junction, garage below the tall wing, and brick chimney at the far left.
- fronts/north-avenue-north.png: panorama Mpta_nY6jnZXv3V3UjsEXw, Aug 2023, southeast view. Shows the same architecture with property context.
- fronts/north-avenue-entry.png: panorama nSgKBT_-m3ggfKJVAWprew, Aug 2023. Nearly head-on driveway view; confirms the second upper bedroom window to the right of the tree.
- fronts/north-avenue-south.png: panorama AnllPWAMM7b5CNpS3eks_Q, Aug 2025. Confirms a broad single garage door with top lights and the small basement window to its left.
- fronts/+v.png, fronts/-u.png, fronts/-u-2.png: inspected again; most wall detail is hidden by vegetation and cannot justify a regular grid of side/rear windows.
- Esri World Imagery zoom 19: runs/290-north/aerial-19.jpg. Shows the complete stepped footprint under sparse trees. Reproducible mosaic bounds, pixel trace, and original frame are recorded in footprint-reference.json. Zoom 20 was unavailable and was not used as evidence.

## Reading face by face
+u, north wing: olive-tan horizontal siding above a muted masonry-colored base; two separated broad paired window groups; dark raised entrance at the right, recessed beside the taller wing. Low shallow hip and thin pale fascia. Brick chimney against the north end near the front.

+u, south wing: two short, wide paired bedroom windows near the eave, a small lower window to the left, and a wide off-center garage door with top lights to the right. Upper wall rises roughly 1.6 m above the low wing eave. Shallow hip roof with broad pale eaves.

+v, south wing: one small upper window on the exposed return above/beside the lower roof, visible in the user photograph. Shared wall below the low roof has no openings. Remaining north/rear/south faces are deliberately plain because the references are obscured.

## Distinctive features and proportions
The broad split-level silhouette and missing northern wing are the primary correction. The low living roof has a 1.1 m rise and the upper garage/bedroom roof a 1.3 m rise. Eaves are 3.65 and 5.25 m above the building reference ground. Fascia is 0.16 m rather than the renderer’s heavy 0.5 m default. The tall facade has a 4.85 m garage door; the living wing has two independent window groups rather than one oversized opening.

## Approximations and confidence
High confidence: overall split-level arrangement, northern living wing, southern garage/bedrooms, street-facing entry and garage, two hipped roofs, paired upper windows, small lower window, and north brick chimney. Medium confidence: corrected footprint extents, recess depth, eave heights, precise opening dimensions and roof rise. The aerial has resolution and roof-parallax limits. Rear openings, exact stair count, masonry courses and hidden landscaping cannot be recovered reliably; no detached rear structure was added. The kit’s two-tone wall represents the low masonry base without exact stone coursing. Existing terrain and parcel surroundings are preserved.

## Validation
Passed: draft and merged lint (zero errors/warnings), 99 Python unit tests covering site construction/review/acceptance/rendering, the Node massing test, deterministic scene rebuild, current footprint frame, and semantic preservation checks proving only this property changed in overrides and the built scene.

Inspected all four cardinal elevations, a 305-degree oblique matching the reference direction, and a roof overview. The repository private Chromium harness rendered the 60 m bounded source scene recorded in runs/290-north/render-scene.json; all five required render-provenance checks passed against that exact scene, and the browser logged no exceptions. The oblique confirms the stepped entrance, two separate window groups, exposed upper return window, and clean roof junction. The geometry audit flags only the intentional shared wall between the wings; no visible coplanar flashing appears at its exterior junction.

The full-scene rendering attempt was replaced with bounded source rendering because this isolated workspace omits generated town bakes. Port 8734 served an older checkout; final evidence was regenerated using this workspace’s source files and a dedicated temporary static server. Final render records describe the bounded scene, not the full world. No whole-town bake or deployment was performed. The attached queue live preview also loaded successfully and was checked to contain the accepted 12.3 by 18.3 m frame and all three corrected volumes, with no browser exceptions. Its first CDN request failed transiently; the retry passed.

Local source acceptance used town accept --force after direct visual review. The separate automated baseline-comparison reviewer was not run; the acceptance metadata honestly retains needs-attention for that absent independent comparison. This source acceptance only updates this isolated workspace and does not apply changes to the parent checkout.
