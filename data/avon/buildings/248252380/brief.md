# Brief — OSM 248252380 — no address

## Identity
- OSM id `248252380`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "sage", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 18.8 m along u × 9.4 m along v; +u bears 38° (NE), +v bears 128° (SE). Centroid local (-164, -53) m.
- Road face: **-v** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 38° NE | 9.4 m | SE |  |
| `-u` | 218° SW | 9.4 m | NW |  |
| `+v` | 128° SE | 18.8 m | SW |  |
| `-v` | 308° NW | 18.8 m | NE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(9.4, 4.7), (-9.4, 4.7), (-9.4, -4.7), (9.4, -4.7)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252380.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(9.4, 4.7, 2.0), (-9.4, 4.7, 1.3), (-9.4, -4.7, 0.0), (9.4, -4.7, 1.1)]
- The lot slopes 2.0 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248252384` 51 West Main Street  (house): off face `+v`, gap 4.9 m, generic style

## Photos
- `front_248252380_+u.png` — face `+u`, 21.0 m out, 14° off head-on, fov 55°, imagery Aug 2025
- `front_248252380_+u_2.png` — face `+u`, 21.0 m out, 14° off head-on, fov 55°, imagery Aug 2025
- `front_248252380_-u.png` — face `-u`, 16.2 m out, 31° off head-on, fov 55°, imagery Aug 2025
- `front_248252380_-u_2.png` — face `-u`, 23.6 m out, 14° off head-on, fov 55°, imagery Aug 2025
- `front_248252380_-u_3.png` — face `-u`, 32.2 m out, 5° off head-on, fov 55°, imagery Aug 2025
- `front_248252380_+v.png` — face `+v`, 36.3 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248252380_+v_2.png` — face `+v`, 42.6 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_248252380_-v.png` — face `-v`, 11.2 m out, 18° off head-on, fov 80°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912694,-77.747269,3a,55y,218h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912801,-77.747156,3a,55y,218h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912276,-77.747711,3a,55y,38h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912170,-77.747823,3a,55y,38h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912349,-77.747250,3a,55y,308h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912267,-77.747105,3a,55y,308h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912621,-77.747729,3a,55y,128h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912703,-77.747875,3a,55y,128h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252380.json`; notes: `blueprint_248252380.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252380` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252380 -v --dist 45 --compare` → `render_248252380_-v.png` and `compare_248252380_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252380&focus=248252380&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
