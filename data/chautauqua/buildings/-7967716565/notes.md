# Bestor Plaza fountain reliefs — 2026-09-13

The user supplied three photographs of the central memorial pylon: the Art /
Religion corner, the Knowledge face, and the Music face. The native renderer
now gives each face its own shallow stone figure and identifying attribute:

- ART: robed figure with a painter's palette (including a thumb hole) and brush.
- RELIGION: bearded, robed figure holding an inscribed tablet against the chest.
- KNOWLEDGE: robed figure holding a raised torch and a lowered scroll.
- MUSIC: robed figure playing a lyre with an open bowl and seven strings.

Each name appears in Roman capitals on the corresponding pedestal face.
Layered drapery, faces, hands, feet and attributes are softened native mesh
geometry. The corner pilasters have scooped flutes. A shallow palmette frieze
sits below the existing stepped cap. No generated image or text texture is used.

The 11 m square basin, its original brick/stone/water colors, the 4.9 m height,
1.5 m pylon width, four corner fish and four water arcs are preserved.

The subsequent fish reference clarified that the four corner statuettes are
carved fish. They now have squat bodies, raised heads, gills, forked tails,
splayed fins, overlapping scale rows and open mouths. Each mouth meets the
unchanged start point and rising direction of its water arc. Structural fish
geometry, water, coping and the pylon are retained in coarse streamed scenery;
the relief figures, inscriptions and fine scale carvings remain in detail.

A close-camera visibility regression was reproduced against the actual stream:
the sector center moved behind the camera while the foreground fountain was
still visible. Detail selection now accounts for the sector's full depth range,
and prioritizes the sector containing the camera target within the existing
memory/tile limits. Evidence and compressed export roundtrip checks are under
`runs/model-edits-20260913/bestor-visibility`.

Art and Religion remain adjacent in the arrangement shown by the supplied
corner image: +v ART, +u RELIGION, -v KNOWLEDGE, -u MUSIC in the building frame.
The close-up photographs do not establish absolute compass bearings; this
assignment should not be interpreted as a surveyed cardinal orientation.

Source changes: `src/fountain.js` and `src/fountain-relief.js`. The authoring
blueprint only gains explanatory notes; its dimensional/material spec is
unchanged. Aggregate integration is described in
`runs/model-edits-20260913/bestor-fountain/integration-patch.json`.

Validation and before/after day/night images are in that same run directory.
`preview.mjs` exercises the actual `buildBlueprint` renderer and day/night
lighting, checks all four figures/attributes/labels, verifies finite geometry
and the existing fountain tests, compares dimensions to the saved baseline,
and checks serialized geometry and the production mobile baker.
