# 343 River Street patio and stairs

Corrected 2026-09-14 after the user's render showed overlapping patio surfaces,
short railings and floating front steps. Cached Street View references are in
`data/avon-expanded--92bb1889fe--expansion-0271/research/`.

- The patio is an uncovered deck with a single 0.22 m floor. Its former low
  flat roof and the skirt's roof/cornice intersected the floor and railings.
- The blue skirt ends under the floor and extends below the sloping lawn.
  The deck's garage-side edge stops outside the garage wall.
- The patio has a constant-width, open stair flight with supporting stringers
  and white handrails, joining a railing opening next to the garage. The
  flight rises from y=-0.5 to the deck at y=1.9 in the house's local frame.
- The front door retains its specified 0.75 m sill. Its old automatic steps
  added another 0.72 m to the entire doorway and floated at y=0.75. A separate
  solid stair now rises from y=-0.14 to y=0.75 and has buried foundations.

Terrain heights were sampled in the full generator. The patio flight's foot
is approximately 0.48 m below the building base, and the front stair's foot is
approximately 0.12 m below it. Dimensions are miniature estimates. The current
blueprint is stored in both `overrides.json` and `site.json`; before/after
captures and geometry checks are under `runs/model-edits-20260914/343-river/`.
