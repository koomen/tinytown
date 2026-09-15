# Blueprint notes — OSM 1090362840 — Avon Park Theater block, 63–71 Genesee St

## Identification (confidence: high for the theater, medium-high for the merge)
The OSM outline is one polygon for three street buildings plus the theater's rear
auditorium: from south (left as seen from Genesee St) to north —
1. **Avon Park Theater (71 Genesee, 1938)** — ~14 m of buff/yellow brick, two storeys,
   flat roof with a raised centre parapet, PARK marquee over a recessed pair of
   double doors, a black vertical PARK blade sign, and black-and-white striped awnings
   on the two flanking storefronts. Still buff brick in the Aug 2025 imagery — the
   research note is right; it has NOT been re-clad.
2. **Narrow white flat-roof two-storey (~4.5 m)** — dark dentil cornice, two 1/1
   windows with dark trim, black awning ("Integrity Tours" in 2023, "Wedding Flowers
   by Avon Floral World" in 2025), glass storefront and a transomed door at the right.
3. **Avon Floral World (63 Genesee)** — white clapboard gable-front (~7.8 m), burgundy
   trim, two upper windows, long green "AVON FLORAL WORLD" board over a storefront
   with a centred door.
The polygon notches match: the big rear block (u −13.6…1.8, v −0.8…13.1) is the
auditorium behind the theater; the 3.2 m strip along the north edge (v −13.1…−9.9) is
a single-storey wing behind the florist; the open notch between them is a yard; the
small bump at u −16.3 is a rear annex behind the auditorium.

## Frame
OBB 32.6 m (u) × 26.3 m (v); +u bears 104° (ESE) = **road face**, +v bears 194° (SSW).
Fractions on +u run from the SSW (theater) end. Street frontage split used:
theater v −0.8…13.1 (13.9 m), white-flat v −5.3…−0.8 (4.5 m), gable v −13.1…−5.3 (7.8 m).
Ground drops 2.9 m from the street to the rear; no plinth added.

## Photos used
- `front_1090362840_+u.png` (Aug 2025, 15 m, 17° off) — primary road-face read.
- `sv_1090362840_a.png` (head-on at the marquee), `sv_1090362840_b.png` (south
  storefront + neighbour), `sv_1090362840_c.png` (white-flat + gable).
- `front_1090362841_-u.png` / `-u_2.png` and `+v_2/_3.png` (2023) — the whole row
  obliquely, confirming the order theater → white-flat → gable → stone salon.
- `overhead_labeled.jpg` and a 5× crop of `satellite.jpg` — roof forms: dark flat
  auditorium with rows of roof units, grey pitched gable running ~15 m back, dark
  narrow rear wing, the notch reads as yard/low roof (kept empty per OSM).
- `front_1090362840_-u.png`, `+v.png` are black (pano failed); the two `-v` captures
  look north at the Empire building instead — not usable. The compare tool's `+u`
  face was broken by URL-encoding until the coordinator's fix (renders before that
  fix were from a default camera inside the neighbour).

## Reading face by face
**+u (Genesee St), 26.3 m, left = south.**
- 0.00–0.53 theater: ground — storefront with striped awning (0.02–0.29 of the theater's
  13.9 m), recessed entry with two pairs of black glass double doors flanking a central
  pier, white marquee box with PARK centred and reader boards each side, storefront
  with striped awning (0.71–0.98). Upper — four paired windows (one each side of the
  blade, one near each end), two thin dark brick belt courses, stepped/raised central
  parapet with a light coping; the blade rises from the marquee to ~3 m above the parapet.
- 0.53–0.70 white-flat: storefront glass left, door right with transom, black awning,
  two dark-trimmed upper windows, dark dentil cornice.
- 0.70–1.00 gable: two burgundy-trimmed upper windows in the clapboard, green
  AVON FLORAL WORLD board at ~3.2 m, two shop windows around a centred burgundy door,
  moderately steep gable with burgundy raking trim.
**−v (north, toward the salon, 1 m gap):** gable's clapboard side with a few windows;
rear wing with a door and small windows. **+v (south):** abuts 1090362839 (gap 0) — left
blank; an exit door on the auditorium. **−u (rear, parking lot):** auditorium back wall
with a double exit door; small rear annex.

## What was modelled / exaggerated
- Theater: buff brick, two dark belt courses, `stepped` full-width parapet (1.2 m) with
  light coping; four 2 m-wide paired windows; two striped awnings (black + cream
  stripes); white marquee = a pale 1.8 m awning with three `board` signs hung at its
  front edge (`out` 1.65): FALL MUSIC SCHEDULE | PARK | RAIDERS OF THE LOST ARK.
- PARK blade: a 0.7 m dark `tower` (windows off, no spire) embedded in the facade at
  the entry centre, rising to 10.6 m, with four single-letter black boards P/A/R/K
  stacked in front of it from 5.4 to 9.2 m. Below the marquee the tower doubles as the
  real central pier between the two double doors.
- White-flat: dentil cornice, black awning, door right.
- Gable: raised to 6.5 m eaves / ~9.3 m ridge so the ridge tops the theater parapet as
  in the photos; green sign 6.4 m wide.
- Auditorium 7.8 m flat, rear wing 3.6 m, annex 3.4 m — all dentil-free cornices.

## Approximations / schema gaps
- The blade is flush with the wall (signs and towers can't be perpendicular); the real
  one projects ~1.2 m. Its cap is trim-coloured, so the theater-front volume trim was
  set dark (every other trim on that volume is explicit).
- The marquee is a sloped awning slab + boards, not a boxed soffit; the real letters
  are black-on-white script.
- The two small square brick medallions above the theater's outer windows are omitted.
- The recessed entry vestibule is drawn flush.
- `parapet.type: "flat"` passes lint but `parapetOutline` has no case for it — avoided.
- Flat roofs get a default dentil cornice and a wall-coloured lip that hides the deck
  colour; explicit `cornice` + `lip: false` on every flat volume.
- Frontage widths of the three parts are estimated from photo proportions (±1 m).

## Confidence
High that the block reads as the Park Theater row; medium on the exact split of the
26.3 m frontage and on the rear-wing/annex heights (no usable rear photo).
