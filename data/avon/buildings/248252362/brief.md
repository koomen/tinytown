# Brief — OSM 248252362 — 38 South Avenue

## Identity
- OSM id `248252362`; address: 38 South Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 12.9 m along u × 11.2 m along v; +u bears 199° (SSW), +v bears 289° (WNW). Centroid local (-187, 46) m.
- Road face: **+v** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 199° SSW | 11.2 m | WNW |  |
| `-u` | 19° NNE | 11.2 m | ESE |  |
| `+v` | 289° WNW | 12.9 m | NNE | ROAD SIDE |
| `-v` | 109° ESE | 12.9 m | SSW |  |

- Footprint polygon in (u, v), metres: [(-6.4, -5.6), (6.4, -5.6), (6.4, 5.6), (-6.4, 5.6)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252362.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-6.4, -5.6, 1.1), (6.4, -5.6, 1.2), (6.4, 5.6, 0.3), (-6.4, 5.6, 0.0)]
- The lot slopes 1.2 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- none

## Photos
- `front_248252362_+u.png` — face `+u`, 27.3 m out, 68° off head-on, fov 55°, imagery Aug 2025
- `front_248252362_+u_2.png` — face `+u`, 32.2 m out, 52° off head-on, fov 55°, imagery Aug 2025
- `front_248252362_+u_3.png` — face `+u`, 39.0 m out, 40° off head-on, fov 55°, imagery Aug 2025
- `front_248252362_-u.png` — face `-u`, 30.8 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248252362_-u_2.png` — face `-u`, 37.1 m out, 45° off head-on, fov 55°, imagery Aug 2025
- `front_248252362_-u_3.png` — face `-u`, 44.8 m out, 36° off head-on, fov 55°, imagery Aug 2025
- `front_248252362_+v.png` — face `+v`, 20.3 m out, 10° off head-on, fov 55°, imagery Aug 2025
- `front_248252362_-v.png` — face `-v`, 31.4 m out, 174° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911376,-77.747874,3a,55y,19h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911248,-77.747934,3a,55y,19h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911824,-77.747662,3a,55y,199h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911952,-77.747602,3a,55y,199h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911675,-77.748065,3a,55y,109h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911719,-77.748239,3a,55y,109h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911525,-77.747471,3a,55y,289h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911481,-77.747298,3a,55y,289h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252362.json`; notes: `blueprint_248252362.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252362` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252362 +v --dist 45 --compare` → `render_248252362_+v.png` and `compare_248252362_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252362&focus=248252362&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
