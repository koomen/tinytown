Hall of Philosophy — entrance stair correction, 2026-09-13

The supplied photograph shows the long central staircase with broad white
ornamental rails and substantial square capped posts. Local frontage metadata
places the east gable at +u, bearing 81 degrees, and the west gable at -u,
bearing 261 degrees. The west Street View image shows a level seating patio;
the aerial footprint and north frontage agree with a raised east entrance.
Retain `axis: u` and `entranceEnd: positive`.

Keep the mapped footprint, roof, timber, classical columns, pavilion floor
height and bench arrangement. Replace the short unrailed 4.08 m flight with
an 8.4 m long, 5 m wide solid flight and ornamental white railings. Six square
newels carry stepped caps. The matching terrace railing uses the same open
radial brace pattern seen in the supplied photograph and north frontage.

Production generateSite terrain measurements seat this pavilion at base
2.234691372662604 m. The existing floor is 2 m above that base. The eastern
stair toe lies near local u=22.836, where ground is approximately -2.14 to
-2.29 m relative to base across the width. `bottomY: -2.24` gives 24 risers
of 0.17667 m and 0.35 m treads; the lowest exposed riser varies from 0.072 to
0.229 m as the terrain crosses the stair. Foundation depth 0.55 m places the
entire solid flight below the measured ground. This count follows the existing
modeled floor and production slope; it is not a surveyed count from the photo.

Evidence and integration patch: runs/model-edits-20260913/philosophy-stairs/.
The private Chromium preview uses the exact production ground calculation,
checks all tread support and toe contact, and repeats the render after the
production bake/pack/unpack/load path. The before/after images omit vegetation
and other scene props to expose the stair-ground connection.
