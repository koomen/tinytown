# Brief — OSM 248342266 — 61 North Avenue

## Identity
- OSM id `248342266`; address: 61 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "slate", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 14.3 m along u × 10.6 m along v; +u bears 285° (WNW), +v bears 15° (NNE). Centroid local (140, -168) m.
- Road face: **-u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 285° WNW | 10.6 m | NNE |  |
| `-u` | 105° ESE | 10.6 m | SSW | ROAD SIDE |
| `+v` | 15° NNE | 14.3 m | ESE |  |
| `-v` | 195° SSW | 14.3 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-7.2, 5.3), (-7.2, -5.3), (7.2, -5.3), (7.2, 5.3)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342266.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-7.2, 5.3, 0.3), (-7.2, -5.3, 0.9), (7.2, -5.3, 0.6), (7.2, 5.3, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342264` 55 North Avenue  (house): off face `-v`, gap 6.5 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248342266_+u.png` — face `+u`, 27.1 m out, 178° off head-on, fov 55°, imagery Aug 2025
- `front_248342266_+u_2.png` — face `+u`, 33.3 m out, 144° off head-on, fov 55°, imagery Aug 2025
- `front_248342266_-u.png` — face `-u`, 12.8 m out, 4° off head-on, fov 57°, imagery Aug 2025
- `front_248342266_+v.png` — face `+v`, 25.0 m out, 53° off head-on, fov 55°, imagery ?
- `front_248342266_+v_2.png` — face `+v`, 31.6 m out, 39° off head-on, fov 55°, imagery ?
- `front_248342266_+v_3.png` — face `+v`, 39.0 m out, 29° off head-on, fov 55°, imagery ?
- face `-v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913581,-77.744090,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913616,-77.744267,3a,55y,105h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913452,-77.743447,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913417,-77.743269,3a,55y,285h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913736,-77.743687,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913866,-77.743638,3a,55y,195h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913297,-77.743850,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913167,-77.743899,3a,55y,15h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342266.json`; notes: `blueprint_248342266.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342266` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342266 -u --dist 45 --compare` → `render_248342266_-u.png` and `compare_248342266_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342266&focus=248342266&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
