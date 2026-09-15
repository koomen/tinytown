# Brief — OSM 248252358 — 60 South Avenue

## Identity
- OSM id `248252358`; address: 60 South Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "butter", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 20.3 m along u × 13.7 m along v; +u bears 200° (SSW), +v bears 290° (WNW). Centroid local (-196, 82) m.
- Road face: **+v** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 200° SSW | 13.7 m | WNW |  |
| `-u` | 20° NNE | 13.7 m | ESE |  |
| `+v` | 290° WNW | 20.3 m | NNE | ROAD SIDE |
| `-v` | 110° ESE | 20.3 m | SSW |  |

- Footprint polygon in (u, v), metres: [(-3.8, 0.1), (-10.2, 0.1), (-10.1, -6.9), (10.1, -6.9), (10.1, 6.9), (-3.8, 6.9)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248252358.png`).
- Footprint card: `research/card_248252358.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-3.8, 0.1, 0.4), (-10.2, 0.1, 0.3), (-10.1, -6.9, 1.1), (10.1, -6.9, 1.4), (10.1, 6.9, 0.2), (-3.8, 6.9, 0.0)]
- The lot slopes 1.4 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- none

## Photos
- `front_248252358_+u.png` — face `+u`, 33.5 m out, 56° off head-on, fov 55°, imagery Aug 2025
- `front_248252358_+u_2.png` — face `+u`, 39.6 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_248252358_-u.png` — face `-u`, 32.6 m out, 68° off head-on, fov 55°, imagery Aug 2016
- `front_248252358_-u_2.png` — face `-u`, 35.4 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248252358_-u_3.png` — face `-u`, 42.2 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_248252358_+v.png` — face `+v`, 21.4 m out, 3° off head-on, fov 63°, imagery Aug 2025
- `front_248252358_-v.png` — face `-v`, 51.8 m out, 132° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911019,-77.748011,3a,55y,20h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910892,-77.748073,3a,55y,20h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911528,-77.747758,3a,55y,200h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911654,-77.747695,3a,55y,200h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911356,-77.748194,3a,55y,110h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911401,-77.748367,3a,55y,110h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911191,-77.747575,3a,55y,290h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911145,-77.747402,3a,55y,290h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252358.json`; notes: `blueprint_248252358.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252358` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252358 +v --dist 45 --compare` → `render_248252358_+v.png` and `compare_248252358_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252358&focus=248252358&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
