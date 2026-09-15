# Brief — OSM 248273908 — 91 Prospect Street

## Identity
- OSM id `248273908`; address: 91 Prospect Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "tan", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 13.7 m along u × 12.5 m along v; +u bears 105° (ESE), +v bears 195° (SSW). Centroid local (-33, -171) m.
- Road face: **+u** (Prospect Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 105° ESE | 12.5 m | SSW | ROAD SIDE |
| `-u` | 285° WNW | 12.5 m | NNE |  |
| `+v` | 195° SSW | 13.7 m | WNW |  |
| `-v` | 15° NNE | 13.7 m | ESE |  |

- Footprint polygon in (u, v), metres: [(6.8, -6.2), (6.8, 6.2), (-6.8, 6.2), (-6.8, -6.2)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248273908.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(6.8, -6.2, 2.0), (6.8, 6.2, 1.9), (-6.8, 6.2, 0.3), (-6.8, -6.2, 0.0)]
- The lot slopes 2.0 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- none

## Photos
- `front_248273908_+u.png` — face `+u`, 16.9 m out, 8° off head-on, fov 55°, imagery Aug 2025
- `front_248273908_-u.png` — face `-u`, 30.5 m out, 176° off head-on, fov 55°, imagery Aug 2025
- `front_248273908_-u_2.png` — face `-u`, 32.6 m out, 158° off head-on, fov 55°, imagery Aug 2025
- `front_248273908_+v.png` — face `+v`, 26.1 m out, 63° off head-on, fov 55°, imagery Aug 2025
- `front_248273908_+v_2.png` — face `+v`, 31.2 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248273908_+v_3.png` — face `+v`, 38.4 m out, 37° off head-on, fov 55°, imagery Aug 2025
- `front_248273908_-v.png` — face `-v`, 28.1 m out, 56° off head-on, fov 55°, imagery Aug 2025
- `front_248273908_-v_2.png` — face `-v`, 34.7 m out, 42° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913482,-77.745569,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913447,-77.745391,3a,55y,285h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913605,-77.746205,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913639,-77.746383,3a,55y,105h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913316,-77.745969,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913185,-77.746016,3a,55y,15h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913771,-77.745805,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913901,-77.745758,3a,55y,195h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248273908.json`; notes: `blueprint_248273908.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248273908` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248273908 +u --dist 45 --compare` → `render_248273908_+u.png` and `compare_248273908_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248273908&focus=248273908&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
