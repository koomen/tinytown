# Blueprint notes — OSM 248290078 — Avon Inn, 55 East Main Street

## Identification
The Avon Inn (NRHP 1991): 1840s Greek Revival residence enlarged in 1882 and 1912 into an inn.
Confirmed by the "AVON INN" lettering on the entablature and above the door in
`front_248290078_+u.png` and the vertical "AVON INN" sign by the drive in `front_+v.png`.
Wikipedia/NRHP: "five bay structure … two-story portico supported by massive Ionic columns".
**Confidence: high.**

**Orientation correction.** The brief names `-v` (Temple St) as the road face and the task
brief guessed `-u` for the front, but the photos are unambiguous: the columned front faces
**+u** (NNE, East Main St / Routes 5 & 20 — the wide road with the yellow centre line in
`front_+u.png`); `-u` (SSW) is the rear parking lot behind a white vinyl fence
(`front_-u.png`, `front_-u_2.png`); `-v` is the Temple St side with the white clapboard wing
and its stairs. The blueprint treats **+u as the front**.

## Frame
OBB 45.2 m (u) × 32.0 m (v); +u bears 15° (NNE), +v 105° (ESE). From East Main St (+u) the
left end is east (+v). Footprint: the main block is the northern 15.6 m (u 7.0..22.6) and only
19.6 m wide (v −6.9..12.7); behind it the building widens to the full 32 m: a wing on the
Temple St side (u −7.5..9.7, v −16.0..−6.9), the big rear block (u −22.6..7.0, v −10.9..16.0)
and a rear-west wing (u −22.6..−12.5, v −15.2..−10.9), with a 5 m notch between the two west
wings. Lot slopes 1.3 m (renderer handles it; no plinth added except the wing's real base).

## Photos used
- `front_248290078_+u.png` (Sep 2025, 27 m, 3° off) — the front: portico, bays, signs. Primary.
- `front_248290078_+v.png`, `_+v_2.png`, `_+v_3.png` (Sep 2025, oblique from the east) — the
  portico in perspective, the plain east side, low hip roofs, no cupola visible.
- `front_248290078_-v.png` (Aug 2025, 13 m) and `sv_a/b` — Temple St wing: pent roof with
  brackets, stairs, raised base, columns returning along the main block's west side.
- `sv_248290078_c.png` — rear-west wing (hip roof, boxed eaves) and the two-storey porch in
  the notch.
- `front_-u.png`, `_-u_2.png` — rear from the parking lot (chimney, plain 2-storey white walls).
- `overhead_labeled.jpg` (label 0078) — footprint notch on the Temple St side, pale roofs.

## Reading face by face
**+u (front, 19.6 m, left = east).** Two tall storeys under a deep entablature (~9.5 m to the
top). A full-width, full-height portico of four giant columns on a low porch floor with a
railing between the end pairs of columns; the entablature carries "AVON INN" in dark serif
caps. Five bays: ground floor has four tall 6/6 windows (bays 1, 2, 4, 5) and the central
door with a surround, a small black "AVON INN" board and an eagle above it, reached by a few
steps; upper floor has five windows. Behind the entablature a very low hip roof — **no cupola
is visible in any 2025 photo**, so none was modelled. Right of the portico a lower 2-storey
white clapboard block (the Temple St wing's north end) with 3 + 2 windows. A tall vertical
"AVON INN" sign stands by the drive on the east lawn; flagpole and clipped hedges in front.
**−v (Temple St, 45 m, left = north).** Left: the main block's west side with the colonnade
returning along it (five columns, railing, floor at porch level). Then the proud wing: two
storeys, flat/very low roof with a boxed cornice, a bracketed dark pent roof over the ground
floor, four small windows under it, a central door up a 6-step stair from both sides, two
windows above, white-painted masonry base ~1 m. Then the notch with a two-storey porch and
balcony, and the rear-west wing: two storeys, hip roof with wide boxed eaves, 2 + 2 windows.
**+v (east).** Plain white clapboard, two rows of 6/6 windows, low hip roofs; a one-storey
projection near the middle (not modelled).
**−u (rear).** Plain two-storey white wall with a tall brick chimney.

## What was modelled / exaggerated
- `main` (8.8 m eaves, hip 0.3, cornice band) with an `open` porch across the whole front:
  3.2 m deep, 7.9 m tall, flat roof, railing, three steps at the door.
- **Giant columns**: nine `towers` (0.85 m square, 8.1 m, `spire:false`,
  `windows:false`) form four columns across the front and the existing five along the west
  return. Front columns sit at v −6.75, 0.2, 5.6 and 12.55 m; the inner pair brackets the
  entrance, leaving room for both window bays on each side. The front porch has only two
  narrow endpoint posts, enclosed by the outer column volumes, so it adds no extra
  full-height supports. Ionic capitals remain simplified to square caps.
- **Entablature**: a solid L-shaped portico volume from 8.2 to 9.5 m, meeting the column
  capitals and returning along Temple St. Dark serif "AVON INN" lettering uses a transparent
  `ghost` sign just 0.02 m off the front frieze, centered over the entrance at 8.84 m.
  The band has a lower molding, upper cornice and roof deck; there is no sign backing.
- Five bays with 4 + 5 tall windows, central door (fanlight, wide surround) standing on the
  porch floor, black "AVON INN" board above it.
- West return colonnade: `open` porch on `main`'s −v face over 80% of its length.
- `west-wing`: flat roof + cornice, `plinth` 0.9 m (the real painted base), `awning` as the
  bracketed pent roof, door with 5 steps at y 1.0, 4 + 2 windows.
- `rear`: hip roof, chimney, windows all round; two-storey `open` porch in the notch with a
  door and stair.
- `rear-west`: hip roof with wide overhang, 2 + 2 windows.
- Details: green "AVON INN" lawn sign by the east drive, flagpole west of the walk, four
  hedge bushes along the front.

## Approximations / schema gaps
- Columns are square, not round/Ionic; capitals are just the tower cap. The entablature
  is simplified to a solid frieze with upper and lower moldings.
- The front railing runs the full width (really only between the end column pairs).
- No cupola (contrary to the earlier generic style) — none visible in the photos.
- The one-storey east projection and the porch ceiling's pale-blue colour are omitted.
- `compare_248290078_+u.png` is the front (62 m). The Temple St side was also shot from
  bearing 300° (`render_248290078_300.png` → `compare_248290078_-v_oblique.png`) because the
  head-on −v camera at 60 m lands inside the neighbour across the street and at 40 m is too
  close to show the colonnade. `render_248290078_iso.png` is the diorama camera from the north.

## Confidence
High on identity, orientation, portico (four front columns, five bays, two storeys) and massing;
medium on rear-wing heights and window counts (oblique photos only); low on the exact roof
forms of the rear (read as low hips from `+v_2`, `sv_c` and the pale overhead).

## Main Street lettering correction — September 6, 2026
The user-supplied front photograph shows dark letters directly on the pale entablature
above the capitals. Removed the low, projecting carved board and added the connected
portico band with transparent lettering. Front and oblique renders verify the letters
are above the columns and the band joins the building and west return.

## Front column count correction — September 6, 2026
Recounted the user-supplied front photo: four full-height columns across East Main St,
separate from the two small columns at the doorway and the side-return colonnade.
The previous six-column front was incorrect. Replaced it with four columns, with the
inner pair framing the entrance, and removed the extra generated porch posts. The
photo does not establish the full side-return count; that existing count is unchanged.

## Owner correction — 2026-09-19
Added the broad rear/east parking lot from the supplied satellite reference, with the Temple Street entrance opening into the parking court. Restricted the service-road centerline to the northern entrance so the lot no longer reads as a through street. Only the rear grass garden has a white vinyl fence, with both ends meeting the building; the broader parking lot is unfenced.

## Appearance adjustment
Removed the rear garden fence at the owner’s request. Keep both the rear lawn and parking lot unfenced.
