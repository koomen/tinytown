# Quicklee’s / Dunkin’ storefront — 2026-09-13

The user’s storefront photograph shows white masonry, royal-blue fascia with white trim, a low gray-shingled entrance gable, glass storefront and double entrance, a white Quicklee’s capsule logo with green speedometer and red needle on the gable, and the older stacked orange/pink Dunkin’ Donuts lettering with a tilted DD cup on the dark wall to the left.

Preserved the existing building footprint, oriented frame, all four main volume extents, and roof heights. Added the two signs using local CanvasTextures in `src/quicklees-signs.js`, blue fascia, masonry treatment, and front glazing. The photographed entrance replaces the old plain service-style door; storefront glass stops beside it to avoid coincident faces. The commercial entrance grade now follows that front entrance, 0.121 m below the previous modeled main-wall door; canopy floor and height are unaffected.

Reference: a local screenshot.

Evidence: `runs/model-edits-20260913/quicklees/after-front.png`, `after-overall.png`, `frame-guards.json`, and `contact-and-roundtrip.json`. Both sign CanvasTextures retain their alpha cutouts and load after bake plus the stream pack/unpack/ObjectLoader roundtrip. Blueprint lint passes; the dark backing wall uses a deliberately wall-height molding profile, producing one harmless generic units warning.
