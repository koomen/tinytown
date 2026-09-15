# Brief — OSM 1090362843 — 43 Genesee Street

## Identity
- OSM id `1090362843`; address: 43 Genesee Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "gable", "wall": "#ddd4c0", "roofColor": "#5a5048", "sign": "Woody's"}
- Earlier research note (from the style pass; verify, do not trust blindly): Pete's photo of the Genesee row shows 'WOODY'S' on the white clapboard building south of the Avondale Pub.

## Frame (blueprint u/v)
- OBB 21.8 m along u × 6.2 m along v; +u bears 104° (ESE), +v bears 194° (SSW). Centroid local (-96, 54) m.
- Road face: **+u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 104° ESE | 6.2 m | SSW | ROAD SIDE |
| `-u` | 284° WNW | 6.2 m | NNE |  |
| `+v` | 194° SSW | 21.8 m | WNW |  |
| `-v` | 14° NNE | 21.8 m | ESE |  |

- Footprint polygon in (u, v), metres: [(-10.9, -3.1), (10.9, -3.1), (10.9, 3.1), (-10.9, 3.1)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_1090362843.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-10.9, -3.1, 0.0), (10.9, -3.1, 1.9), (10.9, 3.1, 1.8), (-10.9, 3.1, 0.0)]
- The lot slopes 1.9 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `1090362842`   (commercial): off face `+v`, gap 0.0 m, generic style
- `1090362844` 39 Genesee Street  (commercial): off face `-v`, gap 0.0 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `1090362845`   (commercial): off face `-v`, gap 6.2 m, generic style

## Photos
- `front_1090362843_+u.png` — face `+u`, 16.3 m out, 5° off head-on, fov 55°, imagery Aug 2025
- `front_1090362843_+u_2.png` — face `+u`, 26.9 m out, 11° off head-on, fov 55°, imagery Aug 2025
- face `-u`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- `front_1090362843_+v.png` — face `+v`, 32.8 m out, 46° off head-on, fov 55°, imagery Aug 2025
- `front_1090362843_+v_2.png` — face `+v`, 40.5 m out, 36° off head-on, fov 55°, imagery Aug 2025
- `front_1090362843_-v.png` — face `-v`, 34.9 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_1090362843_-v_2.png` — face `-v`, 42.8 m out, 36° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_1090362843_a.png, sv_1090362843_b.png, sv_1090362843_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911461,-77.746285,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911429,-77.746106,3a,55y,284h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911595,-77.747020,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911627,-77.747199,3a,55y,104h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911326,-77.746721,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911195,-77.746765,3a,55y,14h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911729,-77.746584,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911860,-77.746540,3a,55y,194h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_1090362843.json`; notes: `blueprint_1090362843.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 1090362843` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 1090362843 +u --dist 45 --compare` → `render_1090362843_+u.png` and `compare_1090362843_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=1090362843&focus=1090362843&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
