# Brief — OSM 248274491 — 72 West Main Street

## Identity
- OSM id `248274491`; address: 72 West Main Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "gable", "wall": "#c9b48f", "roofColor": "#5a5a5a", "sign": "@Work Personnel"}
- Earlier research note (from the style pass; verify, do not trust blindly): 72 W Main St: @Work Personnel staffing office - 2.5-storey grey-clapboard front-gable former house on a tan stucco ground floor, blue standing-seam metal awning over big office windows, '@WORK Personnel' sign. Confidence high (Street View label 72 NY-5 + clearlyrated/officespace).

## Frame (blueprint u/v)
- OBB 18.1 m along u × 13.6 m along v; +u bears 217° (SW), +v bears 307° (NW). Centroid local (-161, -121) m.
- Road face: **+u** (West Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 217° SW | 13.6 m | NW | ROAD SIDE |
| `-u` | 37° NE | 13.6 m | SE |  |
| `+v` | 307° NW | 18.1 m | NE |  |
| `-v` | 127° SE | 18.1 m | SW |  |

- Footprint polygon in (u, v), metres: [(-9.1, -6.8), (9.1, -6.8), (9.1, 6.8), (-9.1, 6.8)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274491.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-9.1, -6.8, 0.6), (9.1, -6.8, 0.5), (9.1, 6.8, 0.0), (-9.1, 6.8, 0.1)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248273879` 90 West Main Street  (commercial): off face `+v`, gap 6.2 m, generic style
- `248274492` 70 West Main Street  (house): off face `-v`, gap 6.4 m, generic style

## Photos
- `front_248274491_+u.png` — face `+u`, 18.1 m out, 12° off head-on, fov 55°, imagery Aug 2025
- `front_248274491_-u.png` — face `-u`, 36.1 m out, 174° off head-on, fov 55°, imagery Aug 2025
- `front_248274491_-u_2.png` — face `-u`, 53.0 m out, 84° off head-on, fov 55°, imagery Aug 2025
- `front_248274491_+v.png` — face `+v`, 41.4 m out, 10° off head-on, fov 55°, imagery Aug 2025
- `front_248274491_-v.png` — face `-v`, 31.7 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248274491_-v_2.png` — face `-v`, 38.0 m out, 45° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248274491_a.png, sv_248274491_b.png, sv_248274491_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912891,-77.747664,3a,55y,37h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912784,-77.747775,3a,55y,37h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913307,-77.747234,3a,55y,217h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913415,-77.747123,3a,55y,217h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913245,-77.747711,3a,55y,127h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913326,-77.747857,3a,55y,127h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912954,-77.747187,3a,55y,307h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912873,-77.747040,3a,55y,307h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274491.json`; notes: `blueprint_248274491.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274491` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274491 +u --dist 45 --compare` → `render_248274491_+u.png` and `compare_248274491_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274491&focus=248274491&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
