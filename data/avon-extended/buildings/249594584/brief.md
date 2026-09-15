# Brief — OSM 249594584 — 15 South Avenue

## Identity
- OSM id `249594584`; address: 15 South Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "sage", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 17.0 m along u × 17.1 m along v; +u bears 198° (SSW), +v bears 288° (WNW). Centroid local (-199, -49) m.
- Road face: **-v** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 198° SSW | 17.1 m | WNW |  |
| `-u` | 18° NNE | 17.1 m | ESE |  |
| `+v` | 288° WNW | 17.0 m | NNE |  |
| `-v` | 108° ESE | 17.0 m | SSW | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(-8.5, -2.9), (-1.5, -2.9), (-0.5, -8.5), (8.5, -8.5), (8.5, 4.9), (-2.8, 4.9), (-2.8, 8.5), (-8.5, 8.5)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_249594584.png`).
- Footprint card: `research/card_249594584.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-8.5, -2.9, 0.8), (-1.5, -2.9, 0.6), (-0.5, -8.5, 0.6), (8.5, -8.5, 0.2), (8.5, 4.9, 0.0), (-2.8, 4.9, 0.3), (-2.8, 8.5, 0.0), (-8.5, 8.5, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- none

## Photos
- `front_249594584_+u.png` — face `+u`, 21.9 m out, 46° off head-on, fov 55°, imagery Aug 2025
- `front_249594584_+u_2.png` — face `+u`, 29.4 m out, 32° off head-on, fov 55°, imagery Aug 2025
- `front_249594584_+u_3.png` — face `+u`, 38.0 m out, 24° off head-on, fov 55°, imagery Aug 2025
- `front_249594584_-u.png` — face `-u`, 23.8 m out, 53° off head-on, fov 55°, imagery Aug 2025
- `front_249594584_-u_2.png` — face `-u`, 30.8 m out, 42° off head-on, fov 55°, imagery ?
- `front_249594584_-u_3.png` — face `-u`, 46.3 m out, 11° off head-on, fov 55°, imagery ?
- `front_249594584_+v.png` — face `+v`, 25.6 m out, 169° off head-on, fov 55°, imagery ?
- `front_249594584_-v.png` — face `-v`, 9.8 m out, 28° off head-on, fov 80°, imagery ?
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912208,-77.748029,3a,55y,18h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912080,-77.748086,3a,55y,18h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912695,-77.747813,3a,55y,198h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912823,-77.747756,3a,55y,198h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912531,-77.748254,3a,55y,108h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912573,-77.748429,3a,55y,108h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912372,-77.747588,3a,55y,288h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912330,-77.747414,3a,55y,288h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_249594584.json`; notes: `blueprint_249594584.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 249594584` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 249594584 -v --dist 45 --compare` → `render_249594584_-v.png` and `compare_249594584_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=249594584&focus=249594584&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
