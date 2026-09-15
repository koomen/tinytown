# Brief — OSM 248342253 — 54 North Avenue

## Identity
- OSM id `248342253`; address: 54 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "paleblue", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 14.3 m along u × 9.1 m along v; +u bears 285° (WNW), +v bears 15° (NNE). Centroid local (179, -142) m.
- Road face: **+u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 285° WNW | 9.1 m | NNE | ROAD SIDE |
| `-u` | 105° ESE | 9.1 m | SSW |  |
| `+v` | 15° NNE | 14.3 m | ESE |  |
| `-v` | 195° SSW | 14.3 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-7.1, 4.5), (-7.1, -4.5), (7.1, -4.5), (7.1, 4.5)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342253.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-7.1, 4.5, 0.3), (-7.1, -4.5, 0.5), (7.1, -4.5, 0.1), (7.1, 4.5, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342255` 60 North Avenue  (house): off face `+v`, gap 7.0 m, generic style
- `248342252` 48 North Avenue  (house): off face `-v`, gap 8.9 m, generic style

## Photos
- `front_248342253_+u.png` — face `+u`, 18.2 m out, 15° off head-on, fov 55°, imagery Aug 2025
- `front_248342253_-u.png` — face `-u`, 32.3 m out, 170° off head-on, fov 55°, imagery Aug 2025
- `front_248342253_+v.png` — face `+v`, 27.0 m out, 66° off head-on, fov 55°, imagery Aug 2025
- `front_248342253_+v_2.png` — face `+v`, 32.0 m out, 50° off head-on, fov 55°, imagery Aug 2025
- `front_248342253_+v_3.png` — face `+v`, 38.9 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248342253_-v.png` — face `-v`, 26.8 m out, 67° off head-on, fov 55°, imagery Aug 2025
- `front_248342253_-v_2.png` — face `-v`, 32.1 m out, 50° off head-on, fov 55°, imagery Aug 2025
- `front_248342253_-v_3.png` — face `-v`, 39.5 m out, 38° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913348,-77.743609,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913384,-77.743786,3a,55y,105h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913220,-77.742967,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913185,-77.742789,3a,55y,285h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913497,-77.743209,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913627,-77.743160,3a,55y,195h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913072,-77.743367,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912942,-77.743415,3a,55y,15h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342253.json`; notes: `blueprint_248342253.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342253` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342253 +u --dist 45 --compare` → `render_248342253_+u.png` and `compare_248342253_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342253&focus=248342253&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
