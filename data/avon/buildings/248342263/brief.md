# Brief — OSM 248342263 — 37 North Avenue

## Identity
- OSM id `248342263`; address: 37 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "grey", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 26.4 m along u × 16.4 m along v; +u bears 110° (ESE), +v bears 200° (SSW). Centroid local (106, -115) m.
- Road face: **+u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 110° ESE | 16.4 m | SSW | ROAD SIDE |
| `-u` | 290° WNW | 16.4 m | NNE |  |
| `+v` | 200° SSW | 26.4 m | WNW |  |
| `-v` | 20° NNE | 26.4 m | ESE |  |

- Footprint polygon in (u, v), metres: [(11.6, -8.2), (13.2, 1.2), (4.3, 1.2), (4.3, 8.2), (-6.0, 8.2), (-6.0, -0.2), (-13.2, -0.2), (-13.2, -8.2)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248342263.png`).
- Footprint card: `research/card_248342263.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(11.6, -8.2, 1.2), (13.2, 1.2, 1.7), (4.3, 1.2, 1.3), (4.3, 8.2, 1.8), (-6.0, 8.2, 1.3), (-6.0, -0.2, 0.9), (-13.2, -0.2, 0.3), (-13.2, -8.2, 0.0)]
- The lot slopes 1.8 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248342261` 47 North Avenue  (house): off face `-v`, gap 9.0 m, generic style

## Photos
- `front_248342263_+u.png` — face `+u`, 25.8 m out, 5° off head-on, fov 55°, imagery Aug 2025
- `front_248342263_-u.png` — face `-u`, 52.1 m out, 177° off head-on, fov 55°, imagery Aug 2025
- `front_248342263_+v.png` — face `+v`, 45.8 m out, 65° off head-on, fov 55°, imagery Aug 2025
- `front_248342263_+v_2.png` — face `+v`, 51.4 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248342263_+v_3.png` — face `+v`, 58.2 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248342263_-v.png` — face `-v`, 43.7 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248342263_-v_2.png` — face `-v`, 49.5 m out, 45° off head-on, fov 55°, imagery Aug 2025
- `front_248342263_-v_3.png` — face `-v`, 56.6 m out, 37° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912943,-77.743799,3a,55y,290h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912896,-77.743626,3a,55y,290h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913148,-77.744564,3a,55y,110h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913194,-77.744736,3a,55y,110h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912807,-77.744300,3a,55y,20h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912681,-77.744364,3a,55y,20h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913283,-77.744062,3a,55y,200h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913410,-77.743999,3a,55y,200h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342263.json`; notes: `blueprint_248342263.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342263` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342263 +u --dist 45 --compare` → `render_248342263_+u.png` and `compare_248342263_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342263&focus=248342263&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
