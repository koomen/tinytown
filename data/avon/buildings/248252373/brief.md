# Brief — OSM 248252373 — no address

## Identity
- OSM id `248252373`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "butter", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 10.5 m along u × 9.6 m along v; +u bears 122° (ESE), +v bears 212° (SSW). Centroid local (-175, -31) m.
- Road face: **-u** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 122° ESE | 9.6 m | SSW |  |
| `-u` | 302° WNW | 9.6 m | NNE | ROAD SIDE |
| `+v` | 212° SSW | 10.5 m | WNW |  |
| `-v` | 32° NNE | 10.5 m | ESE |  |

- Footprint polygon in (u, v), metres: [(5.3, -4.8), (5.3, 4.8), (-5.3, 4.8), (-5.3, -4.8)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252373.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(5.3, -4.8, 2.8), (5.3, 4.8, 1.8), (-5.3, 4.8, 0.0), (-5.3, -4.8, 1.3)]
- The lot slopes 2.8 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248252370`   (house): off face `+v`, gap 3.3 m, generic style

## Photos
- `front_248252373_+u.png` — face `+u`, 17.5 m out, 157° off head-on, fov 55°, imagery Aug 2025
- `front_248252373_-u.png` — face `-u`, 7.7 m out, 18° off head-on, fov 80°, imagery Aug 2025
- `front_248252373_+v.png` — face `+v`, 14.5 m out, 38° off head-on, fov 55°, imagery Aug 2025
- `front_248252373_+v_2.png` — face `+v`, 21.9 m out, 18° off head-on, fov 55°, imagery Aug 2025
- `front_248252373_+v_3.png` — face `+v`, 30.7 m out, 8° off head-on, fov 55°, imagery Aug 2025
- `front_248252373_-v.png` — face `-v`, 22.4 m out, 45° off head-on, fov 55°, imagery Aug 2025
- `front_248252373_-v_2.png` — face `-v`, 30.2 m out, 34° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912166,-77.747368,3a,55y,302h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912094,-77.747212,3a,55y,302h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912407,-77.747893,3a,55y,122h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912479,-77.748049,3a,55y,122h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912098,-77.747792,3a,55y,32h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911984,-77.747890,3a,55y,32h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912475,-77.747469,3a,55y,212h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912589,-77.747371,3a,55y,212h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252373.json`; notes: `blueprint_248252373.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252373` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252373 -u --dist 45 --compare` → `render_248252373_-u.png` and `compare_248252373_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252373&focus=248252373&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
