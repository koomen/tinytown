# Brief — OSM 248342249 — 38 North Avenue

## Identity
- OSM id `248342249`; address: 38 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "grey", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 22.1 m along u × 14.3 m along v; +u bears 104° (ESE), +v bears 194° (SSW). Centroid local (172, -84) m.
- Road face: **-u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 104° ESE | 14.3 m | SSW |  |
| `-u` | 284° WNW | 14.3 m | NNE | ROAD SIDE |
| `+v` | 194° SSW | 22.1 m | WNW |  |
| `-v` | 14° NNE | 22.1 m | ESE |  |

- Footprint polygon in (u, v), metres: [(4.3, -7.1), (4.3, 0.7), (11.1, 1.7), (11.1, 7.1), (4.4, 7.1), (4.4, 2.6), (-11.1, 2.6), (-11.1, -7.1)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248342249.png`).
- Footprint card: `research/card_248342249.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(4.3, -7.1, 0.3), (4.3, 0.7, 0.3), (11.1, 1.7, 0.5), (11.1, 7.1, 0.6), (4.4, 7.1, 0.6), (4.4, 2.6, 0.3), (-11.1, 2.6, 0.1), (-11.1, -7.1, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342248`   (garage): off face `+u`, gap 1.9 m, generic style
- `248342251` 42 North Avenue  (house): off face `-v`, gap 4.8 m, generic style
- `248342246` 32 North Avenue  (house): off face `+v`, gap 6.4 m, generic style

## Photos
- `front_248342249_+u.png` — face `+u`, 43.8 m out, 176° off head-on, fov 55°, imagery Aug 2025
- `front_248342249_-u.png` — face `-u`, 21.8 m out, 8° off head-on, fov 55°, imagery Aug 2025
- `front_248342249_+v.png` — face `+v`, 39.1 m out, 59° off head-on, fov 55°, imagery Aug 2025
- `front_248342249_+v_2.png` — face `+v`, 45.2 m out, 48° off head-on, fov 55°, imagery Aug 2025
- `front_248342249_-v.png` — face `-v`, 41.5 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_248342249_-v_2.png` — face `-v`, 48.6 m out, 41° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912695,-77.743006,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912662,-77.742827,3a,55y,284h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912830,-77.743745,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912862,-77.743924,3a,55y,104h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912526,-77.743456,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912395,-77.743500,3a,55y,14h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912999,-77.743295,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913129,-77.743251,3a,55y,194h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342249.json`; notes: `blueprint_248342249.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342249` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342249 -u --dist 45 --compare` → `render_248342249_-u.png` and `compare_248342249_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342249&focus=248342249&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
