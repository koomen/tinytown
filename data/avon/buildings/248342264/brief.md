# Brief — OSM 248342264 — 55 North Avenue

## Identity
- OSM id `248342264`; address: 55 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 11.9 m along u × 9.2 m along v; +u bears 197° (SSW), +v bears 287° (WNW). Centroid local (138, -150) m.
- Road face: **-v** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 197° SSW | 9.2 m | WNW |  |
| `-u` | 17° NNE | 9.2 m | ESE |  |
| `+v` | 287° WNW | 11.9 m | NNE |  |
| `-v` | 107° ESE | 11.9 m | SSW | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(-5.9, -4.6), (5.9, -4.6), (5.9, 4.6), (-5.9, 4.6)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342264.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-5.9, -4.6, 0.3), (5.9, -4.6, 0.7), (5.9, 4.6, 0.3), (-5.9, 4.6, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342266` 61 North Avenue  (house): off face `-u`, gap 6.5 m, generic style
- `248342261` 47 North Avenue  (house): off face `+u`, gap 6.6 m, generic style

## Photos
- `front_248342264_+u.png` — face `+u`, 23.4 m out, 49° off head-on, fov 55°, imagery Aug 2025
- `front_248342264_+u_2.png` — face `+u`, 31.3 m out, 35° off head-on, fov 55°, imagery Aug 2025
- `front_248342264_-u.png` — face `-u`, 20.8 m out, 49° off head-on, fov 55°, imagery Aug 2025
- `front_248342264_-u_2.png` — face `-u`, 28.0 m out, 34° off head-on, fov 55°, imagery Aug 2025
- `front_248342264_-u_3.png` — face `-u`, 36.2 m out, 25° off head-on, fov 55°, imagery Aug 2025
- `front_248342264_+v.png` — face `+v`, 21.2 m out, 178° off head-on, fov 55°, imagery Aug 2025
- `front_248342264_-v.png` — face `-v`, 12.0 m out, 4° off head-on, fov 65°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913131,-77.743883,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913002,-77.743938,3a,55y,17h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913575,-77.743691,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913704,-77.743636,3a,55y,197h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913420,-77.744075,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913460,-77.744250,3a,55y,107h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913287,-77.743499,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913246,-77.743324,3a,55y,287h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342264.json`; notes: `blueprint_248342264.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342264` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342264 -v --dist 45 --compare` → `render_248342264_-v.png` and `compare_248342264_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342264&focus=248342264&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
