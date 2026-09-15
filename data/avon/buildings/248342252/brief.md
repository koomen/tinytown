# Brief — OSM 248342252 — 48 North Avenue

## Identity
- OSM id `248342252`; address: 48 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "tan", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 18.3 m along u × 9.4 m along v; +u bears 287° (WNW), +v bears 17° (NNE). Centroid local (177, -123) m.
- Road face: **+u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 287° WNW | 9.4 m | NNE | ROAD SIDE |
| `-u` | 107° ESE | 9.4 m | SSW |  |
| `+v` | 17° NNE | 18.3 m | ESE |  |
| `-v` | 197° SSW | 18.3 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-9.1, 4.7), (-9.1, -4.7), (9.1, -4.7), (9.1, 4.7)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342252.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-9.1, 4.7, 0.3), (-9.1, -4.7, 0.4), (9.1, -4.7, 0.1), (9.1, 4.7, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342251` 42 North Avenue  (house): off face `-v`, gap 6.8 m, generic style
- `248342253` 54 North Avenue  (house): off face `+v`, gap 8.9 m, generic style

## Photos
- `front_248342252_+u.png` — face `+u`, 18.6 m out, 8° off head-on, fov 55°, imagery Aug 2025
- `front_248342252_-u.png` — face `-u`, 36.8 m out, 176° off head-on, fov 55°, imagery Aug 2025
- `front_248342252_+v.png` — face `+v`, 33.7 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248342252_+v_2.png` — face `+v`, 40.3 m out, 45° off head-on, fov 55°, imagery Aug 2025
- `front_248342252_-v.png` — face `-v`, 29.9 m out, 64° off head-on, fov 55°, imagery Aug 2025
- `front_248342252_-v_2.png` — face `-v`, 42.5 m out, 38° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913195,-77.743655,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913234,-77.743831,3a,55y,107h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913042,-77.742971,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913003,-77.742795,3a,55y,287h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913331,-77.743224,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913459,-77.743171,3a,55y,197h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912906,-77.743401,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912777,-77.743455,3a,55y,17h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342252.json`; notes: `blueprint_248342252.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342252` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342252 +u --dist 45 --compare` → `render_248342252_+u.png` and `compare_248342252_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342252&focus=248342252&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
