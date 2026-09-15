# Athenaeum Hotel — 2026-09-13 model corrections

Building ID: `820058810`, 10 Janes Avenue. Source blueprint: `blueprint_820058810.json`.

The lake-facing entrance is `lakefront.faces.+v` (bearing 68°). Seven windows
belonging to `central_tower` were rendered at elevations 0.35–5.7 m despite that
volume beginning at 12.8 m. Face storey heights are measured above building grade,
not above a volume's `bottom`. Their glazing shared the entrance's wall plane,
overlapping both the double doors and the large arched window; the supplied night
screenshot and the stored daytime render showed the resulting flicker and stray
arched framing. Reproduced with the actual procedural glass, shared NIGHT uniform,
createLighting, and day/night environment maps.

Moved all seven panes onto the tower and spaced their trim within the exposed
facade: three rectangles at 13.5–15.1 m, three arches at 15.55–17.2 m, and the round
window at 17.5–18.0 m. Reduced pane heights and frame width enough to clear the
lower roof, adjacent rows, and the tower cornice beginning at 18.17 m. The lake
entrance, large arched pane, tower massing, and all other windows are preserved.
No renderer change was needed for this defect.

Replaced the flat placeholder canopy over the photographed garden-path entrance
with a burgundy barrel canopy, cream perimeter piping and scalloped front edge,
two slim supports, an open underside, and a simplified code-drawn white hotel crest.
The crest retains an oval hotel/colonnade illustration, flourishes, an
“Athenaeum Hotel” ribbon, and “CHAUTAUQUA INSTITUTION” beneath. It is a local canvas
texture, not a photo patch. Dimensions: 5.445 m wide, 3.6 m projection, 2.25 m rise,
3.8 m springline. The existing doorway and stairs remain in place.

Physical identification matters here: the user called this the south-facing
entrance, but the supplied canopy image matches the entrance visible in
`front_820058810_+u.png`. Its stored camera position is
42.2087421,-79.4636776, looking at heading 145° toward the hotel, from north-northwest
of the building. `fronts_820058810.json` records the outward face bearing as 338°.
The north-up `aerial_820058810.png` also locates the red canopy along the top-left
side, matching the user's satellite crop. Therefore the existing `north_wing.+u`
entrance was retained and improved; no duplicate entrance was introduced.

Renderer support is opt-in `awnings[].type: "barrel"`, implemented in `src/awning.js`
with a small dispatch in `src/blueprint.js` and matching schema/linter fields.
Existing sloped awnings remain on their existing renderer path.

Validation and screenshots: `runs/model-edits-20260913/athenaeum-hotel/`.

- Before/after day and night: entrance frontal/oblique, tower, whole hotel, and
  canopy frontal/oblique; no browser exceptions.
- Measured all seven tower pane bounds and the doorway ray intersections;
  displaced glazing no longer crosses the door.
- Four facade orientations, 16 awning geometry rays: front passage and underside
  remain open, curved roof/valance/supports present, all geometry finite.
- Four bake/JSON/reload cycles preserve the embedded crest texture, material,
  and world bounds. Existing door tests: 2,920 samples across seven cases pass.
- Awning schema tests (2), existing arcade schema tests (4), and fidelity tests
  (10 with the private Python 3.11 runtime) pass.
- Hotel linter: zero errors and the same two pre-existing warnings as before
  (64% footprint coverage and 172-window vertex-budget warning).

Only the source blueprint and shared renderer support were edited. Aggregate
site/overrides/stream/surface publication is handled by the parent task.
