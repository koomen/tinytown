# Brief — OSM 248288900 — 35 Temple Street

## Identity
- OSM id `248288900`; address: 35 Temple Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 11.5 m along u × 15.0 m along v; +u bears 196° (SSW), +v bears 286° (WNW). Centroid local (100, 152) m.
- Road face: **-v** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 196° SSW | 15.0 m | WNW |  |
| `-u` | 16° NNE | 15.0 m | ESE |  |
| `+v` | 286° WNW | 11.5 m | NNE |  |
| `-v` | 106° ESE | 11.5 m | SSW | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(-5.8, -7.5), (5.8, -7.5), (5.8, 1.9), (3.0, 1.5), (2.1, 7.5), (-5.8, 7.5)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248288900.png`).
- Footprint card: `research/card_248288900.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-5.8, -7.5, 0.5), (5.8, -7.5, 0.5), (5.8, 1.9, 0.2), (3.0, 1.5, 0.2), (2.1, 7.5, 0.0), (-5.8, 7.5, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248288901` 33 Temple Street  (house): off face `-u`, gap 2.6 m, generic style
- `248288899`   (house): off face `+u`, gap 6.7 m, generic style

## Photos
- `front_248288900_+u.png` — face `+u`, 26.2 m out, 54° off head-on, fov 55°, imagery Aug 2025
- `front_248288900_+u_2.png` — face `+u`, 34.5 m out, 42° off head-on, fov 55°, imagery Aug 2025
- `front_248288900_-u.png` — face `-u`, 24.5 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248288900_-u_2.png` — face `-u`, 31.0 m out, 41° off head-on, fov 55°, imagery Aug 2025
- `front_248288900_-u_3.png` — face `-u`, 39.0 m out, 31° off head-on, fov 55°, imagery Aug 2025
- `front_248288900_+v.png` — face `+v`, 28.4 m out, 178° off head-on, fov 55°, imagery Aug 2025
- `front_248288900_-v.png` — face `-v`, 13.5 m out, 5° off head-on, fov 58°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910425,-77.744340,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910295,-77.744389,3a,55y,16h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910871,-77.744171,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911001,-77.744121,3a,55y,196h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910714,-77.744580,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910751,-77.744757,3a,55y,106h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910582,-77.743931,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910546,-77.743753,3a,55y,286h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248288900.json`; notes: `blueprint_248288900.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248288900` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248288900 -v --dist 45 --compare` → `render_248288900_-v.png` and `compare_248288900_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248288900&focus=248288900&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
