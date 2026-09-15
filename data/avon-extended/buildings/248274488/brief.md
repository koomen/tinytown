# Brief — OSM 248274488 — no address

## Identity
- OSM id `248274488`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 23.1 m along u × 12.3 m along v; +u bears 103° (ESE), +v bears 193° (SSW). Centroid local (22, -136) m.
- Road face: **-u** (Prospect Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 103° ESE | 12.3 m | SSW |  |
| `-u` | 283° WNW | 12.3 m | NNE | ROAD SIDE |
| `+v` | 193° SSW | 23.1 m | WNW |  |
| `-v` | 13° NNE | 23.1 m | ESE |  |

- Footprint polygon in (u, v), metres: [(11.5, -6.2), (11.5, 6.2), (1.2, 6.2), (0.6, 2.5), (-11.5, 2.5), (-11.5, -6.2)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248274488.png`).
- Footprint card: `research/card_248274488.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(11.5, -6.2, 0.0), (11.5, 6.2, 0.5), (1.2, 6.2, 0.7), (0.6, 2.5, 0.6), (-11.5, 2.5, 1.0), (-11.5, -6.2, 0.9)]
- The lot slopes 1.0 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248273911` 80 Prospect Street Avon Post Office (civic): off face `+v`, gap 4.7 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248274488_+u.png` — face `+u`, 114.1 m out, 2° off head-on, fov 55°, imagery Aug 2025
- `front_248274488_-u.png` — face `-u`, 27.1 m out, 5° off head-on, fov 55°, imagery Aug 2025
- `front_248274488_+v.png` — face `+v`, 43.6 m out, 62° off head-on, fov 55°, imagery Aug 2025
- `front_248274488_+v_2.png` — face `+v`, 48.3 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_248274488_+v_3.png` — face `+v`, 70.5 m out, 1° off head-on, fov 55°, imagery Aug 2025
- `front_248274488_-v.png` — face `-v`, 45.8 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248274488_-v_2.png` — face `-v`, 52.0 m out, 46° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913171,-77.744836,3a,55y,283h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913140,-77.744657,3a,55y,283h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913300,-77.745589,3a,55y,103h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913331,-77.745768,3a,55y,103h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913007,-77.745286,3a,55y,13h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912875,-77.745328,3a,55y,13h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913464,-77.745140,3a,55y,193h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913596,-77.745098,3a,55y,193h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274488.json`; notes: `blueprint_248274488.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274488` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274488 -u --dist 45 --compare` → `render_248274488_-u.png` and `compare_248274488_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274488&focus=248274488&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
