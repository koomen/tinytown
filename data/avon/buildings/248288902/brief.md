# Brief — OSM 248288902 — 29 Temple Street

## Identity
- OSM id `248288902`; address: 29 Temple Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "tan", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 18.7 m along u × 13.4 m along v; +u bears 286° (WNW), +v bears 16° (NNE). Centroid local (103, 126) m.
- Road face: **-u** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 286° WNW | 13.4 m | NNE |  |
| `-u` | 106° ESE | 13.4 m | SSW | ROAD SIDE |
| `+v` | 16° NNE | 18.7 m | ESE |  |
| `-v` | 196° SSW | 18.7 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-2.2, 2.5), (-2.2, 6.7), (-9.3, 6.7), (-9.3, -6.7), (9.3, -6.7), (9.3, 2.5)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248288902.png`).
- Footprint card: `research/card_248288902.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-2.2, 2.5, 0.7), (-2.2, 6.7, 0.6), (-9.3, 6.7, 0.6), (-9.3, -6.7, 0.9), (9.3, -6.7, 0.0), (9.3, 2.5, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248288901` 33 Temple Street  (house): off face `-v`, gap 2.9 m, generic style
- `248274714` 23 Temple Street  (house): off face `+v`, gap 4.1 m, generic style

## Photos
- `front_248288902_+u.png` — face `+u`, 35.8 m out, 157° off head-on, fov 55°, imagery Aug 2025
- `front_248288902_+u_2.png` — face `+u`, 70.1 m out, 24° off head-on, fov 55°, imagery Aug 2025
- `front_248288902_-u.png` — face `-u`, 15.2 m out, 14° off head-on, fov 59°, imagery Aug 2025
- `front_248288902_+v.png` — face `+v`, 29.0 m out, 54° off head-on, fov 55°, imagery Aug 2025
- `front_248288902_+v_2.png` — face `+v`, 35.7 m out, 40° off head-on, fov 55°, imagery Aug 2025
- `front_248288902_-v.png` — face `-v`, 32.1 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_248288902_-v_2.png` — face `-v`, 39.3 m out, 40° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910955,-77.744563,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910992,-77.744739,3a,55y,106h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910808,-77.743871,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910771,-77.743695,3a,55y,286h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911112,-77.744126,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911241,-77.744075,3a,55y,196h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910651,-77.744308,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910521,-77.744359,3a,55y,16h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248288902.json`; notes: `blueprint_248288902.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248288902` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248288902 -u --dist 45 --compare` → `render_248288902_-u.png` and `compare_248288902_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248288902&focus=248288902&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
