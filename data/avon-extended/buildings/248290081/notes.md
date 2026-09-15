# Quicklee’s fuel canopy apron — 2026-09-13

The user’s screenshot shows the generic level foundation as a partially buried triangular slab. Actual grade rises 0.316 m across the canopy footprint; the old foundation top is below the uphill terrain.

Preserved the footprint, oriented frame, root floor elevation (15.336960444 m in the local review), canopy roof, pump positions, and visible support tops. Extended only the three post bottoms by 1 m, below the apron. Existing dispenser plinths already extend through the apron elevation. Corrected the canopy’s Quicklee’s spelling.

The accompanying `quicklees-pump-apron` paving landmark follows the canopy rectangle with a 0.75 m edge allowance. Its explicit `supportsBuildingId: 248290081` association replaces the generic foundation only when the paved polygon contains the whole footprint. The paving uses the exact terrain mesh triangulation at 0.08 m clearance, with existing grass/terrain-bump suppression.

Reference: a local screenshot.

Evidence: `runs/model-edits-20260913/quicklees/baseline-overall.png`, `after-overall.png`, and `contact-and-roundtrip.json`. Raycasts of all 986 apron triangle centers give clearance 0.079999674–0.080000283 m; all three posts and both pump plinths contact the apron. Lint has no errors; low ground-volume coverage is expected for an open canopy.
