# Brief — OSM 248342243 — 18 North Avenue

## Identity
- OSM id `248342243`; address: 18 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "slate", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 11.6 m along u × 15.0 m along v; +u bears 197° (SSW), +v bears 287° (WNW). Centroid local (150, -33) m.
- Road face: **+v** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 197° SSW | 15.0 m | WNW |  |
| `-u` | 17° NNE | 15.0 m | ESE |  |
| `+v` | 287° WNW | 11.6 m | NNE | ROAD SIDE |
| `-v` | 107° ESE | 11.6 m | SSW |  |

- Footprint polygon in (u, v), metres: [(-2.4, 1.9), (-5.8, 1.9), (-5.8, -7.5), (5.8, -7.5), (5.8, 7.5), (-2.4, 7.5)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248342243.png`).
- Footprint card: `research/card_248342243.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-2.4, 1.9, 0.2), (-5.8, 1.9, 0.2), (-5.8, -7.5, 0.3), (5.8, -7.5, 0.3), (5.8, 7.5, 0.1), (-2.4, 7.5, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342245` 24 North Avenue  (house): off face `-u`, gap 7.8 m, generic style

## Photos
- `front_248342243_+u.png` — face `+u`, 31.5 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248342243_+u_2.png` — face `+u`, 37.9 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_248342243_-u.png` — face `-u`, 28.0 m out, 70° off head-on, fov 55°, imagery Aug 2025
- `front_248342243_-u_2.png` — face `-u`, 33.0 m out, 54° off head-on, fov 55°, imagery Aug 2025
- `front_248342243_-u_3.png` — face `-u`, 39.9 m out, 42° off head-on, fov 55°, imagery Aug 2025
- `front_248342243_+v.png` — face `+v`, 18.8 m out, 12° off head-on, fov 55°, imagery Aug 2025
- `front_248342243_-v.png` — face `-v`, 33.6 m out, 173° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912087,-77.743732,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911959,-77.743787,3a,55y,17h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912529,-77.743543,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912658,-77.743488,3a,55y,197h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912382,-77.743959,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912423,-77.744135,3a,55y,107h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912234,-77.743316,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912194,-77.743140,3a,55y,287h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342243.json`; notes: `blueprint_248342243.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342243` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342243 +v --dist 45 --compare` → `render_248342243_+v.png` and `compare_248342243_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342243&focus=248342243&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
