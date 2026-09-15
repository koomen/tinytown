# Blueprint notes — OSM 248290076 (St. Agnes School, one-storey wing)

## Identity
Mid-century (c. 1955–65) one-storey classroom wing of St. Agnes School,
60 Park Place, Avon NY — the H-plan building immediately WEST of the 1908
school (248290075) on the north side of the Memorial Park circle. Overhead
label 0076. Google Street View (Sep 2025) shows the red "SAINT AGNES SCHOOL —
A Diocese of Rochester Catholic School" board sign standing in front of its
east wing. No published construction date found for the wing (Catholic Courier
/ avon-ny.org only describe the 1908 building); the detailing — aluminium
window bands over dark-blue spandrels, steel corner posts, low shingled
gables with plywood gable panels — is textbook late-1950s parochial school.

Sources: Street View captures listed below; catholiccourier.com "Avon school
celebrates 150 years of Catholic education"; avon-ny.org schools page;
overhead_labeled.jpg; footprint_card.py.

## Frame / footprint
obb 27.3 (u) x 26.6 (v); +u = 14 deg (north), +v = 104 deg (east).
Road side = -u (Park Place). Polygon is a true H:
- west wing  u[-12.4, 13.3]  v[-13.3, -2.1]
- east wing  u[-13.6, 13.7]  v[ 2.1, 13.3]   (sticks 1.2 m further toward the road)
- connector  u[-7.8, 6.4]    v[-2.6, 2.6]    -> a 6 m deep entry court on the
  street side between the wing ends, and a matching rear court.
- Small notches on the outer long faces (west face at u[-1.1,3.4] to v=-8.6;
  east face at u[-2.0,2.3] to v=10.5) were ignored — wings are modelled as
  plain boxes.

## Photos (head-on, Sep 2025 pano ZnBpgSJDtRdPZLpIyDIJIg on Park Place)
- front_248290076_-u.png      55y, whole frontage
- front_248290076_-u_2.png    35y, entry court and both ears
- front_248290076_-u_3.png    35y, west wing end
- front_248290076_-u_4.png    35y, east wing end + red sign
- front_248290076_-v.png      snapped to W Main St; west face visible small at far left
- front_248290076_+v.png      no usable pano (east face is in the 5 m gap to the 1908 school)
Earlier obliques sv_248290076_{a,b,c}.png used for colour only.

## Bay-by-bay reading
### -u (street) face — three parts
1. West wing end (11.2 m). From left: continuous aluminium window band
   ~8 m long (clear glass ~1.2-2.5 m, dark-blue enamel spandrel ~0.4-1.2 m
   with a louvre grille, brick to grade below), then a full-height brick pier
   ~2 m at the court corner with a grey-green steel corner post. Above the
   glass a dark band (~1.3 m) runs up to a grey-green metal fascia. Roof flat.
   Over the pier, at the court edge, a small pointed roof "ear": tan/plywood
   gable panel ~2 m wide, ~1 m rise, grey shingles, steep side toward the
   court, shallow side outward, ridge running back along u.
2. Entry court (4.2 m wide, 6 m deep). Full-glass entrance in the connector
   face with dark frames and double door; flagpole on the walk in front.
   Connector roof is a low shingled gable pointing at the street (ridge along u).
3. East wing end (11.2 m). Mirror image: brick pier + ear at the court, then
   the window band to the right. Red board sign "SAINT AGNES SCHOOL" with the
   diocesan crest stands in the bed in front of its right end.
### -v (west) face — seen at distance only
Same window band / spandrel / dark upper band; flat roof with fascia.
### +v, +u — not visible from any street; given the same band by inference.

## What the blueprint does
- Five volumes: west-wing, east-wing (flat, 4.1 m), connector (gable ridge u,
  tan gable end, entry doors), west-ear and east-ear (thin brick volumes over
  the court piers, 3.3 m wide, gable ridge u, pitch 0.7, tan gable panels).
  The ears poke 0.15 m proud of the wing fronts and 0.5 m into the court so
  they read as separate pointed elements, as in the photo.
- Window bands = `storefronts` (aluminium frame, dark-blue `kick` panel =
  spandrel), reinforced by a dark-blue `beltCourse` 0.45-1.2 m on both wings
  so the spandrel reads as one strong horizontal like the photo (first render
  showed the 0.55 m kick alone as too thin). `upperWall` #4a4038 with `split`
  2.5 gives the dark band under the fascia; `cornice` in grey-green #5a655f
  is the metal fascia.
- Details: flagpole in the court, two bushes at the pier feet, red lawnsign
  "Saint Agnes School" in front of the east wing.

## Colours
- Brick #a85c40 — a touch more orange/lighter than the 1908 school's #a0533f
  (the wing really is oranger) but the same family so the campus reads as one.
- Plinth #6e5a4c 0.4 m — same swatch as the 1908 building, lower (no basement).
- Spandrel blue #26365a; aluminium #b9bcb8; fascia grey-green #5a655f;
  gable panels tan #c9a86a; shingles #66645f; dark upper band #4a4038.

## Approximations / schema gaps
- Real ears are asymmetric (steep court side, shallow outer side); schema
  gables are symmetric, so each ear is a narrow symmetric gable.
- Spandrel kick renders as a 0.55 m strip under the glass; brick below it to
  the plinth (real: brick ~0.4 m, blue ~0.8 m). Close enough.
- Louvre grille, sunburst window decal, steel corner posts not modelled.
- Whether the upper band is dark stained panel or shaded brick is uncertain;
  modelled dark, which matches the head-on shots.
- Footprint notches on the outer faces omitted.

## Renders
- render_248290076_-u.png          head-on from Park Place (compare front_248290076_-u.png)
- render_248290076_-u_oblique.png  from the SSW, matches sv_248290076_a.png
- render_248290076_-v.png          west side (camera lands close; shows band + fascia)
Iteration 1: structure right, spandrel too thin -> added belt course.
Iteration 2: final.

## Confidence
High on plan, heights, bands, ears and entry (three head-on captures).
Medium on the north and east faces (never seen) and on the exact colour of
the band above the windows.
