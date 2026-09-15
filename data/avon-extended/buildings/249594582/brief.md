# Brief — OSM 249594582 — 75 West Main Street

## Identity
- OSM id `249594582`; address: 75 West Main Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "brick", "roofColor": "tar"}

## Frame (blueprint u/v)
- OBB 21.9 m along u × 8.5 m along v; +u bears 37° (NE), +v bears 127° (SE). Centroid local (-191, -79) m.
- Road face: **+v** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 37° NE | 8.5 m | SE |  |
| `-u` | 217° SW | 8.5 m | NW |  |
| `+v` | 127° SE | 21.9 m | SW | ROAD SIDE |
| `-v` | 307° NW | 21.9 m | NE |  |

- Footprint polygon in (u, v), metres: [(10.9, 4.0), (0.7, 4.3), (0.5, 1.9), (-11.0, 2.6), (-10.9, -4.3), (11.0, -4.3)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_249594582.png`).
- Footprint card: `research/card_249594582.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(10.9, 4.0, 0.6), (0.7, 4.3, 0.8), (0.5, 1.9, 0.6), (-11.0, 2.6, 0.6), (-10.9, -4.3, 0.1), (11.0, -4.3, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `249594583` 67 West Main Street  (house): off face `+v`, gap 2.2 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_249594582_+u.png` — face `+u`, 14.6 m out, 12° off head-on, fov 55°, imagery Aug 2025
- `front_249594582_-u.png` — face `-u`, 27.8 m out, 74° off head-on, fov 55°, imagery Aug 2025
- `front_249594582_-u_2.png` — face `-u`, 33.6 m out, 60° off head-on, fov 55°, imagery Aug 2025
- `front_249594582_-u_3.png` — face `-u`, 40.9 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_249594582_+v.png` — face `+v`, 18.2 m out, 3° off head-on, fov 74°, imagery Aug 2025
- `front_249594582_-v.png` — face `-v`, 34.4 m out, 48° off head-on, fov 55°, imagery Aug 2025
- `front_249594582_-v_2.png` — face `-v`, 42.7 m out, 40° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912944,-77.747598,3a,55y,217h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913052,-77.747488,3a,55y,217h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912499,-77.748054,3a,55y,37h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912391,-77.748164,3a,55y,37h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912591,-77.747588,3a,55y,307h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912510,-77.747441,3a,55y,307h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912852,-77.748064,3a,55y,127h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912933,-77.748211,3a,55y,127h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_249594582.json`; notes: `blueprint_249594582.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 249594582` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 249594582 +v --dist 45 --compare` → `render_249594582_+v.png` and `compare_249594582_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=249594582&focus=249594582&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
