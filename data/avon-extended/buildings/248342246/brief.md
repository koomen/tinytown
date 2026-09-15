# Brief — OSM 248342246 — 32 North Avenue

## Identity
- OSM id `248342246`; address: 32 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 13.0 m along u × 11.6 m along v; +u bears 286° (WNW), +v bears 16° (NNE). Centroid local (161, -68) m.
- Road face: **+u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 286° WNW | 11.6 m | NNE | ROAD SIDE |
| `-u` | 106° ESE | 11.6 m | SSW |  |
| `+v` | 16° NNE | 13.0 m | ESE |  |
| `-v` | 196° SSW | 13.0 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-6.5, 5.8), (-6.5, -5.8), (6.5, -5.8), (6.5, 5.8)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342246.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-6.5, 5.8, 0.3), (-6.5, -5.8, 0.3), (6.5, -5.8, 0.0), (6.5, 5.8, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342249` 38 North Avenue  (house): off face `+v`, gap 6.4 m, generic style
- `248342245` 24 North Avenue  (house): off face `-v`, gap 7.4 m, generic style

## Photos
- `front_248342246_+u.png` — face `+u`, 20.0 m out, 3° off head-on, fov 55°, imagery Aug 2025
- `front_248342246_-u.png` — face `-u`, 33.0 m out, 178° off head-on, fov 55°, imagery Aug 2025
- `front_248342246_+v.png` — face `+v`, 30.0 m out, 63° off head-on, fov 55°, imagery Aug 2025
- `front_248342246_+v_2.png` — face `+v`, 35.9 m out, 49° off head-on, fov 55°, imagery Aug 2025
- `front_248342246_+v_3.png` — face `+v`, 43.4 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248342246_-v.png` — face `-v`, 30.3 m out, 60° off head-on, fov 55°, imagery Aug 2025
- `front_248342246_-v_2.png` — face `-v`, 36.1 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248342246_-v_3.png` — face `-v`, 43.3 m out, 37° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912691,-77.743818,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912729,-77.743995,3a,55y,106h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912558,-77.743194,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912520,-77.743018,3a,55y,286h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912847,-77.743418,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912976,-77.743366,3a,55y,196h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912402,-77.743595,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912273,-77.743647,3a,55y,16h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342246.json`; notes: `blueprint_248342246.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342246` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342246 +u --dist 45 --compare` → `render_248342246_+u.png` and `compare_248342246_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342246&focus=248342246&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
