299 Spring Street — user-directed correction, 2026-09-13

Evidence: the user supplied a north-up satellite crop and two clearer views from Spring Street. Stable copies live in `runs/model-edits-20260913/299-spring/reference-satellite.png`, `reference-front-1.png`, and `reference-front-2.png`.

The previous three roof volumes reproduced the old eight-point source outline, including an uninterrupted east–west south bar and two narrow north fingers. The satellite instead shows a central southward extension, east and west crossbar wings, a wide projecting front window room, and an open deck at the north end. The northernmost gray rectangle has pale perimeter rails and furniture; treating that entire rectangle as an enclosed gabled north wing caused the largest visual error.

The corrected four roof masses are the taller north–south main house, lower east garage, west wing with a hipped end, and shallow gable over the projecting front window room. The enclosed footprint has twelve vertices. The open deck is separate porch geometry and is deliberately excluded from the wall footprint and its bounding box. Scale is calibrated to the existing 26.4 m overall east–west building span; the supplied image does not have a scale bar. Tree-obscured rear and west facade openings remain simplified.

Orientation is unchanged: site x is east, z is south, OBB angle is -2.94 radians. +v faces 11.5504 degrees (north/northeast) toward Spring Street. The ground photos confirm two garage doors on the left/east, the projecting window room to their right/west, the broad raised deck and right-hand steps. The corrected main entrance is on projecting-front-window +v. Garage doors use the same north-facing side. No entrance is inferred from nearest-road metadata alone.

The siding is muted gray/taupe, the two sectional garage doors are brown, and the projecting window room has a wide dark picture window, glazed side windows, and a door raised to the 0.68 m deck floor. The first correction used a 12.2 by 6.9 m deck; the follow-up below supersedes that size and adds the west return. The shallow front gable sits below the taller main roof, matching the supplied front views.

Integration: apply `runs/model-edits-20260913/299-spring/integration-patch.json` and merge this blueprint together. The unchanged physical anchor and angle are expressed with a newly centered enclosed-footprint OBB: cx -1384.942173, cz 663.24672, width 26.4, depth 15.8. Blueprint v coordinates have already been rebased +5.1 m for that frame. Do not merge the blueprint onto the old OBB. Keep front metadata unchanged. Update override footprint, associated blueprint frame, and generated scene streams in the coordinating parent task. The footprint ring uses the positive winding expected by build_site.

Validation: schema/geometry lint against the proposed building frame reports 0 errors and 0 warnings. Before/after north-up, front, and southeast images are rendered through a private loopback route that substitutes only this building, using the correct frame for each version. Render camera states and JavaScript exceptions are recorded in `render-validation.json` and the final `render-validation-after.json`. No aggregate scene or shared renderer files are edited by this task.

The source driveway (road 762801101) previously ended inside the newly identified deck. `driveway-patch.json` preserves its first two approach points and 4 m width, moves its bottom leg east of the deck with 1.7 m edge clearance, and extends it to the north garage wall. The satellite supports that placement. Parent integration must apply this road change both to the scene and persistent override before rebaking surfaces.


2026-09-13 follow-up — shallower deck with west return

The user clarified that the deck is less deep and wraps the west side of the projecting front room. The updated deck projects 2.1 m north from the front wall, reduced from 6.9 m. Its front span now runs u -5.5 to +9.1 (14.6 m) so it joins a 2.4 m return beside the +u wall of the projection. This is geographic west, bearing 281.5504 degrees, and returns 4.6 m south to the front wall of the west wing. The nominal deck area is 41.70 square metres, versus 84.18 before. These dimensions are calibrated visual estimates from the supplied aerial and street photographs, not a measured survey.

Both segments keep the +0.68 m floor and existing entrance threshold. The outer rail follows the L perimeter; no rail crosses the front-to-side junction, the door route, or the south end where the return meets the west wing. The two rounded floor edges interlock by 0.12 m (two 0.06 m bevels), putting their flat walking surfaces together at v 7.92 without overlapping coplanar top area or a lowered seam. A 1.7 m railing opening leads to the west-end steps at u 7.8. The explicit five-tread flight faces north and rises toward the deck from local y -0.20 to +0.68. Its foundations extend below terrain; its handrails join the deck opening.

Actual production seating was measured from the full Avon Extended site, not an isolated approximation. Building base is -22.9434235353. The stair toe ground is roughly 0.19–0.20 m below that base; the explicit flight gives measured bottom risers of 0.166–0.177 m. The earlier built-in porch stair at this location would have produced a roughly 0.32 m bottom riser. This correction does not change the building base or the shared renderer. The relocated stair and reduced deck remain west of driveway 762801101, with at least 1.6999 m deck-to-driveway-edge clearance.

Roof volumes, facade openings, footprint vertices, OBB, front metadata, style, and the already corrected driveway are preserved exactly. Evidence is in `runs/model-edits-20260913/299-deck-refinement`: full integrated baseline guard and integration sidecar; before/after isolation views; actual-terrain front, oblique, north, and contact renders; baked-stream round-trip renders; `dimension-report.json`; and `validation.json`. Lint passes with zero errors and warnings. Geometry probes confirm open entrance and wrap routes, level deck joint and threshold, and grounded stairs. The production bake/pack/unpack/StreamObjectLoader round-trip preserves the model bounds within 0.000001 m and produces no browser exceptions. Parent integration should replace only this blueprint in aggregate and overrides, retain all existing geometry metadata, and regenerate scene streams.

## Owner correction — September 19, 2026

Extended the two-door garage 2.5 m east, retaining its 8.2 m width, and added
an approximately 2.5 m wide recessed breezeway with a north-facing entry door.
The enlarged footprint has a recentered authoring frame; the main house,
windows, chimney, wraparound deck and stairs retain their previous world positions.
Replaced the narrow driveway ribbon with a mapped asphalt polygon: the final
right/west edge runs straight to the house, while the left/east side opens into
a 6.1 m (20 ft) deep rectangular apron before both garage doors. Added basketball
hoops at the east and north edges, facing inward. Dimensions are approximate,
based on the owner's description rather than a new survey.
