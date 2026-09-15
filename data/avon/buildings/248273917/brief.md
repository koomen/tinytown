# Brief — OSM 248273917 — 77 Prospect Street

## Identity
- OSM id `248273917`; address: 77 Prospect Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "paleblue", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 13.4 m along u × 11.4 m along v; +u bears 285° (WNW), +v bears 15° (NNE). Centroid local (-37, -149) m.
- Road face: **-u** (Prospect Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 285° WNW | 11.4 m | NNE |  |
| `-u` | 105° ESE | 11.4 m | SSW | ROAD SIDE |
| `+v` | 15° NNE | 13.4 m | ESE |  |
| `-v` | 195° SSW | 13.4 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-6.7, 5.7), (-6.7, -5.7), (6.7, -5.7), (6.7, 5.7)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248273917.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-6.7, 5.7, 1.4), (-6.7, -5.7, 1.6), (6.7, -5.7, 0.2), (6.7, 5.7, 0.0)]
- The lot slopes 1.6 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248273915`   (house): off face `-v`, gap 5.1 m, generic style

## Photos
- `front_248273917_+u.png` — face `+u`, 28.5 m out, 171° off head-on, fov 55°, imagery Aug 2025
- `front_248273917_+u_2.png` — face `+u`, 44.6 m out, 129° off head-on, fov 55°, imagery Aug 2025
- `front_248273917_-u.png` — face `-u`, 15.5 m out, 17° off head-on, fov 55°, imagery Aug 2025
- `front_248273917_-u_2.png` — face `-u`, 15.3 m out, 19° off head-on, fov 55°, imagery Aug 2025
- `front_248273917_+v.png` — face `+v`, 28.8 m out, 48° off head-on, fov 55°, imagery Aug 2025
- `front_248273917_+v_2.png` — face `+v`, 36.0 m out, 36° off head-on, fov 55°, imagery Aug 2025
- `front_248273917_-v.png` — face `-v`, 28.9 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_248273917_-v_2.png` — face `-v`, 36.9 m out, 40° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913408,-77.746251,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913444,-77.746428,3a,55y,105h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913282,-77.745619,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913246,-77.745442,3a,55y,285h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913567,-77.745852,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913697,-77.745804,3a,55y,195h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913122,-77.746018,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912992,-77.746067,3a,55y,15h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248273917.json`; notes: `blueprint_248273917.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248273917` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248273917 -u --dist 45 --compare` → `render_248273917_-u.png` and `compare_248273917_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248273917&focus=248273917&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
