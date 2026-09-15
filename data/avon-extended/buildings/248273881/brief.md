# Brief — OSM 248273881 — no address

## Identity
- OSM id `248273881`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "garage", "floors": 1, "roof": "gable", "wall": "#d8d8d3", "roofColor": "#bcbcb7"}
- Earlier research note (from the style pass; verify, do not trust blindly): 35 Rochester St: white-grey corrugated-metal pole barn / warehouse-garage with two roll-up bays and a low tan block office annex on the east; low-pitch metal gable roof, green-trimmed eaves. Unbranded contractor/fleet yard (box trucks). Confidence med-high on look, business unknown.

## Frame (blueprint u/v)
- OBB 16.9 m along u × 23.9 m along v; +u bears 20° (NNE), +v bears 110° (ESE). Centroid local (-163, -171) m.
- Road face: **-v** (Rochester Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 20° NNE | 23.9 m | ESE |  |
| `-u` | 200° SSW | 23.9 m | WNW |  |
| `+v` | 110° ESE | 16.9 m | SSW |  |
| `-v` | 290° WNW | 16.9 m | NNE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(8.5, -11.9), (8.5, 11.9), (-8.4, 11.9), (-8.4, 0.9), (-8.5, -11.9)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248273881.png`).
- Footprint card: `research/card_248273881.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(8.5, -11.9, 0.0), (8.5, 11.9, 1.0), (-8.4, 11.9, 1.4), (-8.4, 0.9, 0.5), (-8.5, -11.9, 0.0)]
- The lot slopes 1.4 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248273879` 90 West Main Street  (commercial): off face `-u`, gap 0.0 m, generic style

## Photos
- `front_248273881_+u.png` — face `+u`, 34.1 m out, 48° off head-on, fov 55°, imagery Aug 2025
- `front_248273881_+u_2.png` — face `+u`, 41.0 m out, 38° off head-on, fov 55°, imagery Aug 2025
- `front_248273881_+u_3.png` — face `+u`, 49.0 m out, 31° off head-on, fov 55°, imagery Aug 2025
- `front_248273881_-u.png` — face `-u`, 31.7 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248273881_-u_2.png` — face `-u`, 41.0 m out, 42° off head-on, fov 55°, imagery Aug 2025
- `front_248273881_-u_3.png` — face `-u`, 58.0 m out, 3° off head-on, fov 55°, imagery Aug 2025
- `front_248273881_+v.png` — face `+v`, 41.6 m out, 157° off head-on, fov 55°, imagery Aug 2025
- `front_248273881_-v.png` — face `-v`, 14.2 m out, 11° off head-on, fov 73°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248273881_a.png, sv_248273881_b.png, sv_248273881_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913787,-77.747360,3a,55y,200h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913913,-77.747296,3a,55y,200h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913307,-77.747604,3a,55y,20h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913181,-77.747669,3a,55y,20h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913447,-77.747115,3a,55y,290h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913400,-77.746943,3a,55y,290h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913647,-77.747849,3a,55y,110h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913694,-77.748022,3a,55y,110h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248273881.json`; notes: `blueprint_248273881.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248273881` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248273881 -v --dist 45 --compare` → `render_248273881_-v.png` and `compare_248273881_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248273881&focus=248273881&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
