# Brief — OSM 248290077 — 33 North Avenue

## Identity
- OSM id `248290077`; address: 33 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "sage", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 14.7 m along u × 13.7 m along v; +u bears 104° (ESE), +v bears 194° (SSW). Centroid local (119, -88) m.
- Road face: **+u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 104° ESE | 13.7 m | SSW | ROAD SIDE |
| `-u` | 284° WNW | 13.7 m | NNE |  |
| `+v` | 194° SSW | 14.7 m | WNW |  |
| `-v` | 14° NNE | 14.7 m | ESE |  |

- Footprint polygon in (u, v), metres: [(7.4, -6.9), (7.4, 1.5), (3.0, 1.5), (3.1, 6.8), (-7.4, 6.9), (-7.4, -6.9)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248290077.png`).
- Footprint card: `research/card_248290077.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(7.4, -6.9, 0.3), (7.4, 1.5, 0.4), (3.0, 1.5, 0.3), (3.1, 6.8, 0.6), (-7.4, 6.9, 0.2), (-7.4, -6.9, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- none

## Photos
- `front_248290077_+u.png` — face `+u`, 11.8 m out, 6° off head-on, fov 72°, imagery Aug 2025
- `front_248290077_-u.png` — face `-u`, 26.5 m out, 177° off head-on, fov 55°, imagery Aug 2025
- `front_248290077_+v.png` — face `+v`, 21.9 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248290077_+v_2.png` — face `+v`, 28.3 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248290077_+v_3.png` — face `+v`, 36.1 m out, 29° off head-on, fov 55°, imagery Aug 2025
- `front_248290077_-v.png` — face `-v`, 24.4 m out, 53° off head-on, fov 55°, imagery Aug 2025
- `front_248290077_-v_2.png` — face `-v`, 31.7 m out, 38° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912742,-77.743693,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912710,-77.743514,3a,55y,284h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912859,-77.744345,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912891,-77.744523,3a,55y,104h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912566,-77.744097,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912435,-77.744141,3a,55y,14h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913035,-77.743940,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913166,-77.743897,3a,55y,194h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248290077.json`; notes: `blueprint_248290077.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248290077` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248290077 +u --dist 45 --compare` → `render_248290077_+u.png` and `compare_248290077_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248290077&focus=248290077&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
