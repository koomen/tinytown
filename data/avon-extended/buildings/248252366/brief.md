# Brief — OSM 248252366 — no address

## Identity
- OSM id `248252366`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 16.3 m along u × 11.4 m along v; +u bears 17° (NNE), +v bears 107° (ESE). Centroid local (-188, 10) m.
- Road face: **-v** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 17° NNE | 11.4 m | ESE |  |
| `-u` | 197° SSW | 11.4 m | WNW |  |
| `+v` | 107° ESE | 16.3 m | SSW |  |
| `-v` | 287° WNW | 16.3 m | NNE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(8.2, 5.7), (-8.2, 5.7), (-8.2, -5.7), (8.2, -5.7)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252366.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(8.2, 5.7, 1.0), (-8.2, 5.7, 0.6), (-8.2, -5.7, 0.0), (8.2, -5.7, 0.2)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- none

## Photos
- `front_248252366_+u.png` — face `+u`, 16.7 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248252366_+u_2.png` — face `+u`, 24.2 m out, 30° off head-on, fov 55°, imagery Aug 2025
- `front_248252366_+u_3.png` — face `+u`, 32.7 m out, 20° off head-on, fov 55°, imagery Aug 2025
- `front_248252366_-u.png` — face `-u`, 17.2 m out, 49° off head-on, fov 55°, imagery Aug 2025
- `front_248252366_-u_2.png` — face `-u`, 25.0 m out, 32° off head-on, fov 55°, imagery Aug 2025
- `front_248252366_-u_3.png` — face `-u`, 34.0 m out, 24° off head-on, fov 55°, imagery Aug 2025
- `front_248252366_+v.png` — face `+v`, 18.3 m out, 180° off head-on, fov 60°, imagery Aug 2025
- `front_248252366_-v.png` — face `-v`, 6.9 m out, 0° off head-on, fov 80°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912165,-77.747691,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912295,-77.747638,3a,55y,197h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911681,-77.747890,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911552,-77.747943,3a,55y,17h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911857,-77.747489,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911818,-77.747313,3a,55y,287h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911989,-77.748092,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912028,-77.748268,3a,55y,107h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252366.json`; notes: `blueprint_248252366.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252366` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252366 -v --dist 45 --compare` → `render_248252366_-v.png` and `compare_248252366_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252366&focus=248252366&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
