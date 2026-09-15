# Blueprint notes — OSM 1090362845 — former State Bank of Avon + Pure Body Day Spa (31 Genesee St)

## Identification
One OSM way covering two joined two-storey flat-roofed commercial buildings on Genesee St between the
Avondale Pub (1090362844) and the Town Hall (1090362846):
- **North half — former State Bank of Avon**: tan/buff brick with limestone trim, two big round-arched
  ground-floor openings (banking-hall window + entrance), two arched windows above, a pale frieze with
  bronze "STATE BANK OF AVON" letters, stone cornice and low parapet. ~10 m tall.
- **South half — Pure Body Day Spa (31 Genesee)**: white-painted brick, three tall sash windows with
  rough-cut stone lintels, a moulded cornice and low parapet, a navy fascia and navy awning with a cream
  "PURE BODY DAY SPA" board. ~8.2 m tall.
**High confidence** on both identities (lettering and signs legible in three panos); **medium** on the
split of the 14.1 m frontage (read as 47 % spa / 53 % bank off the head-on pano).

## Frame
- OBB 14.1 m (u, frontage) × 28.7 m (v, depth); road face is **+v** (looks 104° ESE).
- On +v, fraction 0 is the SSW (pub) end, 1 is the NNE (Town Hall) end → spa u −7.05…−0.45, bank u −0.45…7.05.
- The polygon's extra vertices all lie on the rectangle's edges (shared nodes with neighbours); one
  rectangle, split into four volumes (front and rear of each half).
- Terrain drops 2.6 m from the street to the rear; left to the renderer's foundation.

## Photos used
- `front_1090362845_+v.png` (12.5 m, 9° off, Aug 2025) — the primary elevation: bays, split, heights
  (scaled against the Town Hall's 5.0 / 8.7 m sills visible at the right).
- `front_1090362845_+v_2.png`, `front_1090362846_-v.png`, `front_1090362846_-v_2.png` — the row from
  Park Pl / the circle: relative heights (bank ≈ 10 m, spa ≈ 8.2 m vs Town Hall 12.2 m).
- `sv_1090362845_a/b/c.png` — head-on bank, head-on spa, bank + Town Hall: colours, door/awning detail.
- `front_1090362845_-u.png`, `-u_2.png` — looking up Genesee from the SW: only the spa's cornice/parapet
  profile above the pub is visible; the -u face itself is the party wall with the pub.
- `front_1090362845_+u*.png` — show the Wadsworth corner block, not this building (the +u face is the
  party wall with the Town Hall); not used.
- `overhead_labeled.jpg` / `satellite.jpg` — both halves have white membrane flat roofs; the rear third
  looks lower/greyer, modelled as lower rear volumes.

## Reading face by face
**+v, bank half (7.5 m; fractions below are within the bank volume)**
- Ground: big round-arched banking-hall window (black frames, ~3 × 4.3 m to the arch top) at 0.32; arched
  entrance with recessed dark door and a lamp at 0.72; limestone arch surrounds and keystones; limestone
  quoin bands at both ends. Stone band at ~5.0 m.
- 2nd floor: two arched windows (paired sashes under a brick arch) at 0.32 / 0.72, sills ≈ 5.5 m,
  heads ≈ 8.0 m.
- Frieze 8.5–9.5 m: pale greenish-cream band with dark bronze "STATE BANK OF AVON"; limestone cornice at
  ~9.7 m; blocky low parapet to ~10 m.
- Wall tan/khaki brick (#ad956d), trim limestone (#cfc4a6).

**+v, spa half (6.6 m; fractions within the spa volume)**
- Ground: recessed grey-blue apartment door at ~0.08; shop window 0.16–0.40 with panelled kick; glass spa
  door with transom at ~0.48; shop window 0.56–0.93; white pilasters at the ends.
- Navy fascia 3.3–4.25 m with the cream "PURE BODY ✦ DAY SPA" board centred; navy awning below it
  (~3.0 m at the wall, sloping out ~1.4 m).
- 2nd floor: three tall sash windows (~1.0 × 2.0 m) at 0.2 / 0.5 / 0.8, sills ≈ 4.9 m, rough-cut white
  stone lintels.
- Moulded cornice ≈ 7.5 m; parapet to ≈ 8.2 m with small raised end blocks and a slightly raised centre.
- Wall white-painted brick (modelled #d9d5cb), trim #e2dfd6.

**-u (toward the pub, 28.7 m)** — party wall; the pub is 7.3 m tall and 24 m deep, so ~1 m of the spa's
wall shows above it and the last few metres of the rear. Plain.

**+u (toward the Town Hall, 28.7 m)** — party wall with the 12.2 m Town Hall for the first 20 m; the
rear 8 m stands clear. One window on the rear volume, otherwise plain.

**-v (rear, 14.1 m)** — no coverage. Lower rear volumes (bank 6 m, spa 5 m) with a door and a window or
two each, plain.

## What was modelled / exaggerated
- Bank: 10.0 m volume; ground-floor `arch` window 3.0 × 4.3 m with 0.22 m limestone frame and keystone;
  `arch` door 2.1 × 4.0 m with 0.35 m surround, two steps and a lamp; two 1.9 × 2.5 m arch windows with
  keystones; limestone belt at 4.95 m; frieze as a 1.05 m belt course (#c6c09b) carrying a `carved` sign
  "STATE BANK OF AVON" 6.6 × 0.85 m with matching background; pale cornice; flat 0.55 m parapet;
  limestone pilasters at both ends.
- Spa: 7.6 m volume + `stepped` 0.7 m parapet; navy fascia as a 0.95 m belt course; navy awning; cream
  `board` sign pushed 0.2 m out; three 1.15 × 2.1 m sash windows with pale hoods (the stone lintels);
  two shop windows with grey-blue kicks, grey-blue apartment door and dark glass spa door.
- Rear volumes lower, plain, with doors.

## Approximations / schema gaps
- The bank's frieze letters are really dark bronze on stone; the `carved` style with a matching `bg` is
  the closest flush treatment (no dark-on-pale wall lettering without a ghost plane).
- Bank quoin bands rendered as pilasters, nearly the same tone as the wall trim — legible mainly as
  edge lines. The real cornice is deeper and more moulded.
- The spa's parapet is a gentle curve with raised end blocks; `stepped` is the nearest outline
  (`flat` loses the profile, `mission` overstates it).
- The spa's awning is a plain navy canopy; the real one has a scalloped valance.
- The spa's paired sash windows are read as single sashes; the brick "STATE BANK OF AVON" frieze's
  raised panel ends are omitted.
- The 47/53 split and the rear volumes are inferred, not measured.

## Confidence
High on identity, bay layout and signs; medium-high on heights (scaled against the Town Hall's sills);
medium on the frontage split and colours; low on the rear third.

Renders: `compare_1090362845_+v.png` (photo beside the 40 m street render, with 1090362846 loaded),
`render_1090362845_104.png` (street view from bearing 104°, 50 m), `render_1090362845_-v.png` (rear).
