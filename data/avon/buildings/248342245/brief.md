# Brief — OSM 248342245 — 24 North Avenue

## Identity
- OSM id `248342245`; address: 24 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 15.4 m along u × 9.8 m along v; +u bears 286° (WNW), +v bears 16° (NNE). Centroid local (155, -51) m.
- Road face: **+u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 286° WNW | 9.8 m | NNE | ROAD SIDE |
| `-u` | 106° ESE | 9.8 m | SSW |  |
| `+v` | 16° NNE | 15.4 m | ESE |  |
| `-v` | 196° SSW | 15.4 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-7.7, 4.9), (-7.7, -4.9), (7.7, -4.9), (7.7, 4.9)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342245.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-7.7, 4.9, 0.3), (-7.7, -4.9, 0.5), (7.7, -4.9, 0.2), (7.7, 4.9, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342246` 32 North Avenue  (house): off face `+v`, gap 7.4 m, generic style
- `248342243` 18 North Avenue  (house): off face `-v`, gap 7.8 m, generic style

## Photos
- `front_248342245_+u.png` — face `+u`, 17.7 m out, 8° off head-on, fov 55°, imagery Aug 2025
- `front_248342245_-u.png` — face `-u`, 33.0 m out, 176° off head-on, fov 55°, imagery Aug 2025
- `front_248342245_+v.png` — face `+v`, 28.2 m out, 63° off head-on, fov 55°, imagery Aug 2025
- `front_248342245_+v_2.png` — face `+v`, 33.8 m out, 48° off head-on, fov 55°, imagery ?
- face `-v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912538,-77.743909,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912574,-77.744087,3a,55y,106h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912404,-77.743255,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912367,-77.743078,3a,55y,286h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912686,-77.743500,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912816,-77.743451,3a,55y,196h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912255,-77.743665,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912125,-77.743714,3a,55y,16h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342245.json`; notes: `blueprint_248342245.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342245` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342245 +u --dist 45 --compare` → `render_248342245_+u.png` and `compare_248342245_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342245&focus=248342245&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
