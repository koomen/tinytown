# Blueprint notes — OSM 1090362841 — 59 Genesee St (stone-fronted shop)

## Identification (confidence: high on the building, medium on the tenant)
The narrow two-storey flat-roofed shop immediately north of Avon Floral World's gable
and south of the driveway to the grey Empire/AudioNova building (1090362842). Street
face: tan/grey random-ashlar limestone veneer above a red-brick storefront storey with
a flat brown canopy; a plain stone coping at the top; two small upper windows. Big
shop window with purple curtains and a dark wood door at the right. Side and rear walls
are red brick (seen from the driveway); the roof is a white membrane in the satellite.
2023 imagery shows a red flat canopy; 2025 shows the same canopy darker and window
lettering "… Floral Boutique" with a purple daisy — the tenant name is not fully
legible, so only the legible words are used.

## Frame
OBB 7.4 m (u) × 30.3 m (v); +u bears 15° (NNE), +v bears 105° (ESE) = **road face**.
The 7.4 m facade runs along u; fractions on +v run from the SSW (gable side) end.
Ground drops 2.3 m to the rear; no plinth added.

## Photos used
- `front_1090362841_+v.png` (2025, 13.5 m), `+v_2.png` and `+v_3.png` (2023, head-on).
- `sv_1090362841_a.png` (head-on 2025, coping and ashlar), `_b.png` (gable neighbour),
  `_c.png` (looking south along the row).
- `front_1090362841_+u.png`, `+u_2.png` — north side from the driveway: brick flank.
- `front_1090362841_-u.png`, `-u_2.png` — the row from the south.
- `front_1090362841_-v.png` is a house elsewhere (pano snapped wrong) — unused.
- `overhead_labeled.jpg` + satellite crop: white flat roof nearly the full 30 m.

## Reading face by face
**+v (Genesee St), 7.4 m, left = south.** Ground: brick piers at both ends, shop window
≈0.07–0.70, door ≈0.85 with a small transom, flat brown canopy across the width at
≈3.0 m. Upper: ashlar from the canopy up to a projecting flat coping at ≈8 m; two small
windows at ≈0.27 and ≈0.73 (exact positions tree-obscured; symmetric caricature).
**+u (north, driveway):** red brick, a few small windows, a side door. **−u (south):**
1 m from the gable — blank. **−v (rear):** brick, single-storey portion, service door.

## What was modelled / exaggerated
- `facade` slab (0.7 m deep) with `wall` brick below `split` 3.25 m and `upperWall`
  tan ashlar above, plus a pale 0.28 m cornice as the coping — so the stone is only on
  the street face and the brick shows on the flanks.
- Storefront 0.07–0.70, dark wood door at 0.85, brown 1 m canopy awning, small navy
  "Floral Boutique" board just above the canopy, two 1.1 × 1.4 m upper windows.
- `body` (2-storey, 17 m deep) and `rear` (1-storey, 12 m) in red brick with light
  membrane roofs (`lip: false`, dentil-free cornices).

## Approximations / schema gaps
- Random-ashlar texture is a flat tan colour.
- The rear single-storey step is inferred from the side photo, not confirmed.
- Window lettering and purple curtains not represented beyond the small sign.
- Flat-roof default lip/dentils had to be disabled explicitly to show the roof colour.

## Confidence
High on massing and facade materials; medium on upper-window positions and rear height.
