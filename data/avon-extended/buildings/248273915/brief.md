# Brief — OSM 248273915 — no address

## Identity
- OSM id `248273915`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 19.7 m along u × 12.4 m along v; +u bears 105° (ESE), +v bears 195° (SSW). Centroid local (-46, -133) m.
- Road face: **+u** (Prospect Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 105° ESE | 12.4 m | SSW | ROAD SIDE |
| `-u` | 285° WNW | 12.4 m | NNE |  |
| `+v` | 195° SSW | 19.7 m | WNW |  |
| `-v` | 15° NNE | 19.7 m | ESE |  |

- Footprint polygon in (u, v), metres: [(9.8, -6.2), (9.8, 6.2), (-9.8, 6.2), (-9.8, -6.2)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248273915.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(9.8, -6.2, 2.7), (9.8, 6.2, 2.8), (-9.8, 6.2, 0.0), (-9.8, -6.2, 0.0)]
- The lot slopes 2.8 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248273914` 53 Prospect Street  (house): off face `+v`, gap 3.6 m, generic style
- `248273917` 77 Prospect Street  (house): off face `-v`, gap 5.1 m, generic style

## Photos
- `front_248273915_+u.png` — face `+u`, 16.2 m out, 10° off head-on, fov 55°, imagery Aug 2025
- face `-u`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- `front_248273915_+v.png` — face `+v`, 36.2 m out, 55° off head-on, fov 55°, imagery ?
- `front_248273915_+v_2.png` — face `+v`, 43.7 m out, 44° off head-on, fov 55°, imagery ?
- `front_248273915_-v.png` — face `-v`, 44.1 m out, 36° off head-on, fov 55°, imagery ?
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913136,-77.745690,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913101,-77.745513,3a,55y,285h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913279,-77.746395,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913315,-77.746573,3a,55y,105h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912981,-77.746128,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912851,-77.746177,3a,55y,15h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913435,-77.745957,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913565,-77.745908,3a,55y,195h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248273915.json`; notes: `blueprint_248273915.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248273915` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248273915 +u --dist 45 --compare` → `render_248273915_+u.png` and `compare_248273915_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248273915&focus=248273915&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
