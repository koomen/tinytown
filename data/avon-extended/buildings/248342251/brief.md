# Brief — OSM 248342251 — 42 North Avenue

## Identity
- OSM id `248342251`; address: 42 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 16.2 m along u × 10.1 m along v; +u bears 197° (SSW), +v bears 287° (WNW). Centroid local (169, -105) m.
- Road face: **+v** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 197° SSW | 10.1 m | WNW |  |
| `-u` | 17° NNE | 10.1 m | ESE |  |
| `+v` | 287° WNW | 16.2 m | NNE | ROAD SIDE |
| `-v` | 107° ESE | 16.2 m | SSW |  |

- Footprint polygon in (u, v), metres: [(-8.1, -5.1), (8.1, -5.1), (8.1, 5.1), (-8.1, 5.0)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342251.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-8.1, -5.1, 0.3), (8.1, -5.1, 0.2), (8.1, 5.1, 0.0), (-8.1, 5.0, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342249` 38 North Avenue  (house): off face `+u`, gap 4.8 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `248342252` 48 North Avenue  (house): off face `-u`, gap 6.8 m, generic style

## Photos
- `front_248342251_+u.png` — face `+u`, 26.1 m out, 66° off head-on, fov 55°, imagery Aug 2025
- `front_248342251_+u_2.png` — face `+u`, 31.4 m out, 49° off head-on, fov 55°, imagery Aug 2025
- `front_248342251_+u_3.png` — face `+u`, 38.6 m out, 37° off head-on, fov 55°, imagery Aug 2025
- `front_248342251_-u.png` — face `-u`, 29.0 m out, 61° off head-on, fov 55°, imagery Aug 2025
- `front_248342251_-u_2.png` — face `-u`, 35.4 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248342251_-u_3.png` — face `-u`, 43.3 m out, 37° off head-on, fov 55°, imagery Aug 2025
- `front_248342251_+v.png` — face `+v`, 19.7 m out, 5° off head-on, fov 57°, imagery ?
- `front_248342251_-v.png` — face `-v`, 29.8 m out, 177° off head-on, fov 55°, imagery ?
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912714,-77.743509,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912585,-77.743562,3a,55y,17h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913197,-77.743308,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913326,-77.743255,3a,55y,197h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913021,-77.743702,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913060,-77.743878,3a,55y,107h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912890,-77.743114,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912851,-77.742938,3a,55y,287h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342251.json`; notes: `blueprint_248342251.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342251` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342251 +v --dist 45 --compare` → `render_248342251_+v.png` and `compare_248342251_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342251&focus=248342251&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
