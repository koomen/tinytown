# 295 Spring Street — user photo correction, 2026-09-13

Building ID: `248675022`. The existing centroid, eight-point footprint, OBB and local axes are unchanged. The northwest/`-v` frontage faces the approach from Spring Street. Northeast/`+u` is image-left when viewed from this approach.

## Current evidence and edits

The user supplied the partly obscured front photo and explicitly said it is the best available view. The working copy is `runs/model-edits-20260913/295-spring/reference-front.png`; source: a local screenshot.

The useful visible cues are a compact taller section at image-left, its shallow roof and dark upper openings, a lower entrance-roof line beneath it, and a long gray/taupe roof extending right. This contradicts the previous uniformly single-storey model.

- Retain the southwest wing and the stepped footprint. Split the old northeast wing at `u=5.5`, raising only its exposed northeast end to a 5.8 m eave with a 1.1 m shallow hip cap. The attached lower roofs remain at the previous 3.2 m eave.
- Use restrained pale gray/beige siding, off-white trim, taupe-gray shingles, and dark rectangular glazing. Two simple upper openings express the visible dark band without inventing decorative window divisions.
- Place the entrance under a small open shed canopy on the raised section's northwest face. The former freestanding green door on the low wing was based only on an inferred driveway approach; the photo places the dark entrance area toward the taller left section.
- Retain simple existing openings on unseen sides where possible. No pool, landscaping, chimney, dormers, or ornate façade features are added.

The photo cannot resolve the exact top-roof subtype, heights, glazing subdivisions, entrance arrangement, post count, or rear elevations. The shallow hip, paired upper windows, simple door and two canopy supports are conservative modeling interpretations, not measurements. Tree and shadow colors are not treated as wall colors. The model should remain approximate in these obscured areas.

## Historical source audit

The pre-edit aggregate building and review state are preserved as `runs/model-edits-20260913/295-spring/before-building.json` and `before-review.json`; the old review was `ready`, run `20260910-041246-727779`.

Earlier source material remains unchanged in `data/avon-expanded--92bb1889fe--expansion-0286/miniature/248675022/`: `references.json`, `orientation.png`, `reference-1.jpg` through `reference-5.jpg`, `author-response.json`, `repair-response.json`, and `review.json`. The original author explicitly recorded that the four Street View captures show the tree-lined driveway rather than clear elevations. Its single-storey height, openings, and door location were inferred from the small aerial. The aerial and orientation map still support the retained footprint and approach direction; the new user photo supplies the visible vertical silhouette.

## Validation

Current schema lint and direct-render proof are recorded under `runs/model-edits-20260913/295-spring/`. The final proof uses `isolated-proof.mjs` with the shared current `src/blueprint.js` renderer; paired `before-isolated-*.png` and `after-isolated-*.png` images cover the northwest front, approach oblique, rear and top. `isolated-geometry-report.json` checks the raised roof height, open shed canopy, two supports and browser exceptions. `validation.json` records unchanged footprint coverage and frame.

The earlier `after-front.png`, `after-oblique.png`, and `after-top.png` regional files are diagnostic drafts from before the explicit open-canopy correction; use the `after-isolated-*` files as final proof. Aggregate integration and full-scene checks are handled by the parent task.
