# Brief — OSM 248273904 — no address

## Identity
- OSM id `248273904`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 13.3 m along u × 23.7 m along v; +u bears 15° (NNE), +v bears 105° (ESE). Centroid local (26, -167) m.
- Road face: **-v** (Prospect Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 15° NNE | 23.7 m | ESE |  |
| `-u` | 195° SSW | 23.7 m | WNW |  |
| `+v` | 105° ESE | 13.3 m | SSW |  |
| `-v` | 285° WNW | 13.3 m | NNE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(6.6, 11.8), (0.2, 11.8), (0.2, 8.3), (-6.6, 8.3), (-6.6, -11.8), (6.6, -11.8)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248273904.png`).
- Footprint card: `research/card_248273904.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(6.6, 11.8, 0.4), (0.2, 11.8, 0.0), (0.2, 8.3, 0.1), (-6.6, 8.3, 0.1), (-6.6, -11.8, 0.3), (6.6, -11.8, 0.6)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- none

## Photos
- `front_248273904_+u.png` — face `+u`, 41.3 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248273904_+u_2.png` — face `+u`, 47.7 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_248273904_-u.png` — face `-u`, 41.5 m out, 56° off head-on, fov 55°, imagery Aug 2025
- `front_248273904_-u_2.png` — face `-u`, 47.7 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248273904_-u_3.png` — face `-u`, 54.5 m out, 40° off head-on, fov 55°, imagery Aug 2025
- face `+v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- `front_248273904_-v.png` — face `-v`, 22.4 m out, 1° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913746,-77.745084,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913876,-77.745038,3a,55y,195h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913283,-77.745248,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913152,-77.745294,3a,55y,15h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913443,-77.744788,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913409,-77.744610,3a,55y,285h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913586,-77.745544,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913620,-77.745722,3a,55y,105h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248273904.json`; notes: `blueprint_248273904.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248273904` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248273904 -v --dist 45 --compare` → `render_248273904_-v.png` and `compare_248273904_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248273904&focus=248273904&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
