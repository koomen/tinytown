# Brief — OSM 248342256 — 68 North Avenue

## Identity
- OSM id `248342256`; address: 68 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "sage", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 20.2 m along u × 12.7 m along v; +u bears 285° (WNW), +v bears 15° (NNE). Centroid local (191, -173) m.
- Road face: **+u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 285° WNW | 12.7 m | NNE | ROAD SIDE |
| `-u` | 105° ESE | 12.7 m | SSW |  |
| `+v` | 15° NNE | 20.2 m | ESE |  |
| `-v` | 195° SSW | 20.2 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-0.1, 6.4), (-0.1, 2.0), (-10.1, 2.0), (-10.1, -6.4), (-1.3, -6.4), (-1.2, -2.5), (10.1, -2.5), (10.1, 6.4)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248342256.png`).
- Footprint card: `research/card_248342256.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-0.1, 6.4, 0.0), (-0.1, 2.0, 0.4), (-10.1, 2.0, 0.3), (-10.1, -6.4, 0.6), (-1.3, -6.4, 1.5), (-1.2, -2.5, 0.9), (10.1, -2.5, 1.0), (10.1, 6.4, 0.3)]
- The lot slopes 1.5 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248342255` 60 North Avenue  (house): off face `-v`, gap 4.6 m, generic style

## Photos
- `front_248342256_+u.png` — face `+u`, 18.2 m out, 5° off head-on, fov 55°, imagery Aug 2025
- `front_248342256_-u.png` — face `-u`, 39.2 m out, 168° off head-on, fov 55°, imagery Aug 2025
- `front_248342256_+v.png` — face `+v`, 32.4 m out, 64° off head-on, fov 55°, imagery Aug 2025
- `front_248342256_+v_2.png` — face `+v`, 38.7 m out, 52° off head-on, fov 55°, imagery Aug 2025
- `front_248342256_-v.png` — face `-v`, 35.9 m out, 53° off head-on, fov 55°, imagery Aug 2025
- `front_248342256_-v_2.png` — face `-v`, 42.8 m out, 42° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913634,-77.743493,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913668,-77.743671,3a,55y,105h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913498,-77.742778,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913465,-77.742600,3a,55y,285h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913796,-77.743054,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913926,-77.743008,3a,55y,195h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913337,-77.743217,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913207,-77.743263,3a,55y,15h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342256.json`; notes: `blueprint_248342256.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342256` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342256 +u --dist 45 --compare` → `render_248342256_+u.png` and `compare_248342256_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342256&focus=248342256&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
