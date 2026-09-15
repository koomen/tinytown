# Brief — OSM 248342255 — 60 North Avenue

## Identity
- OSM id `248342255`; address: 60 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "slate", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 10.9 m along u × 15.0 m along v; +u bears 14° (NNE), +v bears 104° (ESE). Centroid local (184, -158) m.
- Road face: **-v** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 14° NNE | 15.0 m | ESE |  |
| `-u` | 194° SSW | 15.0 m | WNW |  |
| `+v` | 104° ESE | 10.9 m | SSW |  |
| `-v` | 284° WNW | 10.9 m | NNE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(5.4, 7.5), (-5.4, 7.5), (-5.4, -7.5), (5.4, -7.5)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342255.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(5.4, 7.5, 0.2), (-5.4, 7.5, 1.1), (-5.4, -7.5, 0.6), (5.4, -7.5, 0.0)]
- The lot slopes 1.1 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248342256` 68 North Avenue  (house): off face `+u`, gap 4.6 m, generic style
- `248342253` 54 North Avenue  (house): off face `-u`, gap 7.0 m, generic style

## Photos
- `front_248342255_+u.png` — face `+u`, 27.7 m out, 63° off head-on, fov 55°, imagery Aug 2025
- `front_248342255_+u_2.png` — face `+u`, 33.4 m out, 48° off head-on, fov 55°, imagery Aug 2025
- `front_248342255_+u_3.png` — face `+u`, 40.8 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248342255_-u.png` — face `-u`, 30.0 m out, 58° off head-on, fov 55°, imagery Aug 2025
- `front_248342255_-u_2.png` — face `-u`, 36.6 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_248342255_+v.png` — face `+v`, 32.6 m out, 178° off head-on, fov 55°, imagery Aug 2025
- `front_248342255_+v_2.png` — face `+v`, 33.3 m out, 165° off head-on, fov 55°, imagery Aug 2025
- `front_248342255_-v.png` — face `-v`, 17.6 m out, 4° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913653,-77.743151,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913783,-77.743105,3a,55y,194h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913210,-77.743306,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913080,-77.743352,3a,55y,14h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913370,-77.742902,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913336,-77.742724,3a,55y,284h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913493,-77.743555,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913527,-77.743733,3a,55y,104h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342255.json`; notes: `blueprint_248342255.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342255` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342255 -v --dist 45 --compare` → `render_248342255_-v.png` and `compare_248342255_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342255&focus=248342255&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
