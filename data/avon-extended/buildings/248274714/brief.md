# Brief — OSM 248274714 — 23 Temple Street

## Identity
- OSM id `248274714`; address: 23 Temple Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 11.0 m along u × 15.6 m along v; +u bears 195° (SSW), +v bears 285° (WNW). Centroid local (111, 111) m.
- Road face: **-v** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 195° SSW | 15.6 m | WNW |  |
| `-u` | 15° NNE | 15.6 m | ESE |  |
| `+v` | 285° WNW | 11.0 m | NNE |  |
| `-v` | 105° ESE | 11.0 m | SSW | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(-5.5, -7.8), (5.5, -7.8), (5.5, 7.8), (-5.5, 7.8)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274714.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-5.5, -7.8, 0.4), (5.5, -7.8, 0.6), (5.5, 7.8, 0.3), (-5.5, 7.8, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248288902` 29 Temple Street  (house): off face `+u`, gap 4.1 m, generic style

## Photos
- `front_248274714_+u.png` — face `+u`, 27.4 m out, 50° off head-on, fov 55°, imagery Aug 2025
- `front_248274714_+u_2.png` — face `+u`, 34.9 m out, 37° off head-on, fov 55°, imagery Aug 2025
- `front_248274714_-u.png` — face `-u`, 23.4 m out, 60° off head-on, fov 55°, imagery Aug 2025
- `front_248274714_-u_2.png` — face `-u`, 29.6 m out, 43° off head-on, fov 55°, imagery Aug 2025
- `front_248274714_-u_3.png` — face `-u`, 37.5 m out, 33° off head-on, fov 55°, imagery Aug 2025
- `front_248274714_+v.png` — face `+v`, 28.4 m out, 174° off head-on, fov 55°, imagery Aug 2025
- `front_248274714_+v_2.png` — face `+v`, 69.8 m out, 12° off head-on, fov 55°, imagery Aug 2025
- `front_248274714_-v.png` — face `-v`, 13.0 m out, 13° off head-on, fov 58°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910793,-77.744205,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910663,-77.744252,3a,55y,15h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911235,-77.744043,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911366,-77.743996,3a,55y,195h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911079,-77.744454,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911113,-77.744631,3a,55y,105h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910950,-77.743795,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910915,-77.743617,3a,55y,285h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274714.json`; notes: `blueprint_248274714.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274714` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274714 -v --dist 45 --compare` → `render_248274714_-v.png` and `compare_248274714_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274714&focus=248274714&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
