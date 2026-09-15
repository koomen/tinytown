# Brief — OSM 248288901 — 33 Temple Street

## Identity
- OSM id `248288901`; address: 33 Temple Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "paleblue", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 7.6 m along u × 16.0 m along v; +u bears 196° (SSW), +v bears 286° (WNW). Centroid local (102, 139) m.
- Road face: **-v** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 196° SSW | 16.0 m | WNW |  |
| `-u` | 16° NNE | 16.0 m | ESE |  |
| `+v` | 286° WNW | 7.6 m | NNE |  |
| `-v` | 106° ESE | 7.6 m | SSW | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(-3.8, -8.0), (3.8, -8.0), (3.8, 8.0), (-3.8, 8.0)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248288901.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-3.8, -8.0, 0.7), (3.8, -8.0, 0.7), (3.8, 8.0, 0.0), (-3.8, 8.0, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248288900` 35 Temple Street  (house): off face `+u`, gap 2.6 m, generic style
- `248288902` 29 Temple Street  (house): off face `-u`, gap 2.9 m, generic style

## Photos
- `front_248288901_+u.png` — face `+u`, 29.6 m out, 49° off head-on, fov 55°, imagery Aug 2025
- `front_248288901_+u_2.png` — face `+u`, 37.2 m out, 38° off head-on, fov 55°, imagery Aug 2025
- `front_248288901_-u.png` — face `-u`, 25.0 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248288901_-u_2.png` — face `-u`, 31.3 m out, 41° off head-on, fov 55°, imagery Aug 2025
- `front_248288901_-u_3.png` — face `-u`, 39.2 m out, 31° off head-on, fov 55°, imagery Aug 2025
- `front_248288901_+v.png` — face `+v`, 30.0 m out, 174° off head-on, fov 55°, imagery Aug 2025
- `front_248288901_-v.png` — face `-v`, 14.2 m out, 12° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910553,-77.744310,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910423,-77.744362,3a,55y,16h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910963,-77.744145,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911092,-77.744093,3a,55y,196h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910829,-77.744557,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910867,-77.744734,3a,55y,106h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910687,-77.743898,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910649,-77.743722,3a,55y,286h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248288901.json`; notes: `blueprint_248288901.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248288901` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248288901 -v --dist 45 --compare` → `render_248288901_-v.png` and `compare_248288901_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248288901&focus=248288901&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
