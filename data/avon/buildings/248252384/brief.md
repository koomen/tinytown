# Brief — OSM 248252384 — 51 West Main Street

## Identity
- OSM id `248252384`; address: 51 West Main Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "paleblue", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 17.6 m along u × 8.7 m along v; +u bears 37° (NE), +v bears 127° (SE). Centroid local (-152, -45) m.
- Road face: **-v** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 37° NE | 8.7 m | SE |  |
| `-u` | 217° SW | 8.7 m | NW |  |
| `+v` | 127° SE | 17.6 m | SW |  |
| `-v` | 307° NW | 17.6 m | NE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(8.8, 4.4), (-8.8, 4.4), (-8.8, -4.4), (8.8, -4.4)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252384.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(8.8, 4.4, 1.5), (-8.8, 4.4, 0.9), (-8.8, -4.4, 0.0), (8.8, -4.4, 0.6)]
- The lot slopes 1.5 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248252391`   (house): off face `+v`, gap 3.9 m, generic style
- `248252380`   (house): off face `-v`, gap 4.9 m, generic style

## Photos
- `front_248252384_+u.png` — face `+u`, 19.8 m out, 4° off head-on, fov 55°, imagery Aug 2025
- `front_248252384_-u.png` — face `-u`, 27.4 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248252384_-u_2.png` — face `-u`, 31.7 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248252384_-u_3.png` — face `-u`, 37.9 m out, 27° off head-on, fov 55°, imagery Aug 2025
- `front_248252384_+v.png` — face `+v`, 33.1 m out, 59° off head-on, fov 55°, imagery Aug 2025
- `front_248252384_+v_2.png` — face `+v`, 39.1 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248252384_-v.png` — face `-v`, 25.1 m out, 6° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912623,-77.747131,3a,55y,217h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912730,-77.747019,3a,55y,217h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912210,-77.747558,3a,55y,37h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912103,-77.747670,3a,55y,37h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912284,-77.747107,3a,55y,307h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912202,-77.746960,3a,55y,307h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912549,-77.747582,3a,55y,127h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912630,-77.747729,3a,55y,127h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252384.json`; notes: `blueprint_248252384.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252384` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252384 -v --dist 45 --compare` → `render_248252384_-v.png` and `compare_248252384_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252384&focus=248252384&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
