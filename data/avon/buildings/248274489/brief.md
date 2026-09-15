# Brief — OSM 248274489 — no address

## Identity
- OSM id `248274489`; address: none in OSM; name: none in OSM; tags: {"building": "garage"}
- Current generic style: {"kind": "garage", "floors": 1, "roof": "gable", "wall": "white", "roofColor": "grey"}

## Frame (blueprint u/v)
- OBB 8.5 m along u × 7.1 m along v; +u bears 104° (ESE), +v bears 194° (SSW). Centroid local (-78, -121) m.
- Road face: **+u** (Prospect Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 104° ESE | 7.1 m | SSW | ROAD SIDE |
| `-u` | 284° WNW | 7.1 m | NNE |  |
| `+v` | 194° SSW | 8.5 m | WNW |  |
| `-v` | 14° NNE | 8.5 m | ESE |  |

- Footprint polygon in (u, v), metres: [(4.2, -3.5), (4.2, 3.5), (-4.2, 3.5), (-4.2, -3.5)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274489.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(4.2, -3.5, 1.1), (4.2, 3.5, 2.6), (-4.2, 3.5, 1.7), (-4.2, -3.5, 0.0)]
- The lot slopes 2.6 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- none

## Photos
- `front_248274489_+u.png` — face `+u`, 52.0 m out, 2° off head-on, fov 55°, imagery Aug 2025
- `front_248274489_-u.png` — face `-u`, 83.5 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248274489_+v.png` — face `+v`, 73.5 m out, 18° off head-on, fov 55°, imagery Aug 2025
- `front_248274489_+v_2.png` — face `+v`, 74.9 m out, 11° off head-on, fov 55°, imagery Aug 2025
- face `-v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913044,-77.746152,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913013,-77.745973,3a,55y,284h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913146,-77.746730,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913177,-77.746909,3a,55y,104h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912889,-77.746508,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912758,-77.746552,3a,55y,14h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913300,-77.746374,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913432,-77.746330,3a,55y,194h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274489.json`; notes: `blueprint_248274489.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274489` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274489 +u --dist 45 --compare` → `render_248274489_+u.png` and `compare_248274489_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274489&focus=248274489&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
