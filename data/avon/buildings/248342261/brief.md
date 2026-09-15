# Brief — OSM 248342261 — 47 North Avenue

## Identity
- OSM id `248342261`; address: 47 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "tan", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 12.6 m along u × 11.3 m along v; +u bears 14° (NNE), +v bears 104° (ESE). Centroid local (130, -132) m.
- Road face: **+v** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 14° NNE | 11.3 m | ESE |  |
| `-u` | 194° SSW | 11.3 m | WNW |  |
| `+v` | 104° ESE | 12.6 m | SSW | ROAD SIDE |
| `-v` | 284° WNW | 12.6 m | NNE |  |

- Footprint polygon in (u, v), metres: [(6.3, 5.7), (-6.3, 5.6), (-6.3, -5.6), (6.3, -5.6)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342261.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(6.3, 5.7, 1.0), (-6.3, 5.6, 1.0), (-6.3, -5.6, 0.0), (6.3, -5.6, 0.4)]
- The lot slopes 1.0 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248342264` 55 North Avenue  (house): off face `+u`, gap 6.6 m, generic style
- `248342263` 37 North Avenue  (house): off face `-u`, gap 9.0 m, generic style

## Photos
- `front_248342261_+u.png` — face `+u`, 22.6 m out, 61° off head-on, fov 55°, imagery Aug 2025
- `front_248342261_+u_2.png` — face `+u`, 29.1 m out, 43° off head-on, fov 55°, imagery Aug 2025
- `front_248342261_+u_3.png` — face `+u`, 37.1 m out, 33° off head-on, fov 55°, imagery Aug 2025
- `front_248342261_-u.png` — face `-u`, 26.0 m out, 48° off head-on, fov 55°, imagery Aug 2025
- `front_248342261_-u_2.png` — face `-u`, 33.6 m out, 35° off head-on, fov 55°, imagery Aug 2025
- `front_248342261_+v.png` — face `+v`, 14.3 m out, 13° off head-on, fov 60°, imagery Aug 2025
- `front_248342261_-v.png` — face `-v`, 25.4 m out, 173° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913424,-77.743803,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913554,-77.743757,3a,55y,194h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912966,-77.743962,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912835,-77.744008,3a,55y,14h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913138,-77.743578,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913105,-77.743400,3a,55y,284h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913252,-77.744187,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913285,-77.744366,3a,55y,104h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342261.json`; notes: `blueprint_248342261.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342261` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342261 +v --dist 45 --compare` → `render_248342261_+v.png` and `compare_248342261_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342261&focus=248342261&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
