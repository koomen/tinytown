# Brief — OSM 248340723 — 36 Temple Street

## Identity
- OSM id `248340723`; address: 36 Temple Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 12.9 m along u × 8.6 m along v; +u bears 287° (WNW), +v bears 17° (NNE). Centroid local (144, 167) m.
- Road face: **+u** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 287° WNW | 8.6 m | NNE | ROAD SIDE |
| `-u` | 107° ESE | 8.6 m | SSW |  |
| `+v` | 17° NNE | 12.9 m | ESE |  |
| `-v` | 197° SSW | 12.9 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-6.4, 4.3), (-6.4, -4.3), (6.4, -4.3), (6.4, 4.3)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248340723.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-6.4, 4.3, 0.7), (-6.4, -4.3, 0.0), (6.4, -4.3, 0.8), (6.4, 4.3, 1.1)]
- The lot slopes 1.1 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248340724` 40 Temple Street  (house): off face `-v`, gap 3.8 m, generic style

## Photos
- `front_248340723_+u.png` — face `+u`, 19.2 m out, 4° off head-on, fov 55°, imagery Aug 2025
- `front_248340723_-u.png` — face `-u`, 32.0 m out, 178° off head-on, fov 55°, imagery Aug 2025
- `front_248340723_-u_2.png` — face `-u`, 32.9 m out, 165° off head-on, fov 55°, imagery Aug 2025
- `front_248340723_+v.png` — face `+v`, 31.4 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248340723_+v_2.png` — face `+v`, 38.3 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_248340723_-v.png` — face `-v`, 28.8 m out, 60° off head-on, fov 55°, imagery Aug 2025
- `front_248340723_-v_2.png` — face `-v`, 33.5 m out, 43° off head-on, fov 55°, imagery Aug 2025
- `front_248340723_-v_3.png` — face `-v`, 41.9 m out, 35° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910580,-77.744027,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910618,-77.744203,3a,55y,107h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910444,-77.743406,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910406,-77.743229,3a,55y,287h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910721,-77.743631,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910850,-77.743579,3a,55y,197h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910303,-77.743801,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910174,-77.743854,3a,55y,17h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248340723.json`; notes: `blueprint_248340723.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248340723` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248340723 +u --dist 45 --compare` → `render_248340723_+u.png` and `compare_248340723_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248340723&focus=248340723&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
