# Brief — OSM 249594583 — 67 West Main Street

## Identity
- OSM id `249594583`; address: 67 West Main Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "paleblue", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 13.4 m along u × 9.1 m along v; +u bears 36° (NE), +v bears 126° (SE). Centroid local (-184, -70) m.
- Road face: **+v** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 36° NE | 9.1 m | SE |  |
| `-u` | 216° SW | 9.1 m | NW |  |
| `+v` | 126° SE | 13.4 m | SW | ROAD SIDE |
| `-v` | 306° NW | 13.4 m | NE |  |

- Footprint polygon in (u, v), metres: [(6.2, 3.2), (-6.7, 4.5), (-6.6, -4.5), (6.7, -4.5)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_249594583.png`).
- Footprint card: `research/card_249594583.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(6.2, 3.2, 0.7), (-6.7, 4.5, 0.5), (-6.6, -4.5, 0.0), (6.7, -4.5, 0.1)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `249594582` 75 West Main Street  (commercial): off face `-v`, gap 2.2 m, generic style

## Photos
- `front_249594583_+u.png` — face `+u`, 16.6 m out, 35° off head-on, fov 55°, imagery Aug 2025
- `front_249594583_+u_2.png` — face `+u`, 21.7 m out, 6° off head-on, fov 55°, imagery Aug 2025
- `front_249594583_-u.png` — face `-u`, 18.0 m out, 59° off head-on, fov 55°, imagery Aug 2025
- `front_249594583_-u_2.png` — face `-u`, 25.5 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_249594583_-u_3.png` — face `-u`, 34.0 m out, 37° off head-on, fov 55°, imagery Aug 2025
- `front_249594583_+v.png` — face `+v`, 7.2 m out, 16° off head-on, fov 80°, imagery Aug 2025
- `front_249594583_+v_2.png` — face `+v`, 11.2 m out, 38° off head-on, fov 74°, imagery Aug 2025
- `front_249594583_-v.png` — face `-v`, 31.7 m out, 65° off head-on, fov 55°, imagery Aug 2025
- `front_249594583_-v_2.png` — face `-v`, 37.2 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_249594583_-v_3.png` — face `-v`, 44.3 m out, 41° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912834,-77.747546,3a,55y,216h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912942,-77.747437,3a,55y,216h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912447,-77.747934,3a,55y,36h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912339,-77.748043,3a,55y,36h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912510,-77.747498,3a,55y,306h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912430,-77.747350,3a,55y,306h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912771,-77.747983,3a,55y,126h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912851,-77.748131,3a,55y,126h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_249594583.json`; notes: `blueprint_249594583.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 249594583` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 249594583 +v --dist 45 --compare` → `render_249594583_+v.png` and `compare_249594583_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=249594583&focus=249594583&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
