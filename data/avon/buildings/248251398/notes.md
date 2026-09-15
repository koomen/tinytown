# Blueprint notes — OSM 248251398 — 78 Genesee Street (Coyne Econ-O-Wash)

## Identification
Coyne Econ-O-Wash laundromat, 78 Genesee St. The road photo (Aug 2025) shows the
gold-on-black "COYNE ECON-O-WASH" sign on a tall white Second Empire block with a black
mansard and a pedimented gable, standing between the drive-through bank canopy to the
north and T's On Genesee (90) across a narrow alley to the south. Confidence: high.

## Frame
OBB 26.6 m (u) × 9.5 m (v); +u bears 105° (ESE) = rear; -u = road face (WNW); +v bears
195° (SSW) toward T's; -v toward the bank drive-through (68 Genesee, 4.2 m gap).

Satellite (Esri, OSM outlines overlaid) and the street photos show a ~2.3 m alley between
this building and T's that the OSM footprints do not have, so the volumes stop at v = 3.7
instead of 4.7 (T's draft does the same on its +v side). Modelled facade width 8.4 m.

## Photos used
- `front_248251398_-u.png` (road face, 12° off) — primary elevation; `sv_248251398_a/b/c.png`.
- `front_248251398_+u.png`, `front_248251398_+u_2.png` — rear gable end and the south side.
- `front_248251398_-v.png` — north side seen over the bank canopy (blank wall, one window
  near the rear, the gable roof behind the mansard).
- `front_248251398_+v*.png` actually show T's south wall (green trim), not this building.
- `overhead_labeled.jpg`, `satellite.jpg` (+ a crop with the OSM outlines drawn).

## Reading face by face
**-u (road, left = north end):** three layers. (1) Red-brick storefront base to ~3.5 m:
recessed dark door at ~0.14–0.16, plate-glass window wall from ~0.28 to ~0.95 with white
frames and a low brick kick, lace curtains inside. Gold-on-black sign board on the brick
just under the clapboard, left half (0.15–0.52). (2) White clapboard second storey with
two tall windows carrying moulded pediment hoods at ~0.18 and ~0.46 (the right third is
blank), then a deep white bracketed cornice at ~7.8 m. (3) Black asphalt-shingle mansard,
nearly vertical, ~2.6 m, wrapping the front corners, with a white triangular pediment
(~4.4 m wide, ~1.7 m tall, an oval/oculus motif) sitting on top at the centre.

**+u (rear, left = south):** gable end (ridge along u, low pitch): brick base ~3.3 m with
a large window at 0.1–0.45, a louvre, a glazed white door at ~0.85 under a steel fire
escape; white vinyl clapboard above with a wide paired window with black shutters at
~0.3, a small window/door at ~0.82 for the fire escape landing; brick chimney on the
ridge toward the north side.

**+v (south, alley side):** white clapboard, brick base along the rear ~5 m, upper
windows with black shutters near the rear, a few windows mid-length with AC units; the
mansard returns only ~3–4 m along this side, a plain gable roof continues behind it.

**-v (north):** blank white wall, one small upper window ~3 m from the rear.

## What was modelled / exaggerated
- `mansard-front` u [-13.3, -9.3]: brick to 3.5 m (`upperWall` white above), 7.8 m eave,
  mansard h 2.6 / inset 0.7 (#37373c), bracketed cornice 0.65 m with dentils; storefront
  0.3–0.96 with brick kick, dark door with fanlight at 0.16, gold-on-black sign, two
  hooded windows (w 1.15, h 2.1) at 0.21 and 0.53.
- `pediment-post`: a 0.4 × 4.4 m post hidden inside the mansard (u [-12.9, -12.5]) rising to
  the cap, carrying a `pediment` parapet with a roundel so the gable sits on top of the
  mansard as in the photo.
- `gable-mid` u [-9.4, 7.8] and `gable-rear` u [7.5, 13.3]: white gable roof (pitch 0.31,
  ridge at the mansard cap), the rear block with a brick base, big window, door, shuttered
  paired window and a ridge chimney.
- Exaggerated: mansard and cornice mass, pediment size, hoods on the upper windows.

## Approximations / schema gaps
- Parapets stand on the wall top (eave), so a pediment on a mansard volume would sit
  inside the slope; hence the hidden post volume. A `parapets` option on the mansard cap
  (or a `y` offset for parapets) would make this a one-liner.
- Window hoods are flat caps, not the moulded pediment heads in the photo.
- The mansard wraps all four sides of the 4 m front volume; the real one returns a
  little less and meets the gable roof with a short flat.
- The fire escape, louvre and rooftop vents are omitted.
- `gable-rear` is 0.2 m lower than `gable-mid` so their coincident roofs do not z-fight;
  a small step shows at the junction.
- Volumes are 1 m narrower than the OBB on the alley side (see Frame).

## Confidence
Identification high. Road face high. Rear medium-high (two oblique frontal photos).
South side medium (glimpsed), north side medium-low.
