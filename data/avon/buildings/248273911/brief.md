# Brief — OSM 248273911 — 80 Prospect Street — Avon Post Office

## Identity
- OSM id `248273911`; address: 80 Prospect Street; name: Avon Post Office; tags: {"amenity": "post_office", "building": "yes"}
- Current generic style: {"kind": "civic", "floors": 1, "roof": "gable", "wall": "#a9563f", "roofColor": "#8a8a86", "sign": "US Post Office"}
- Earlier research note (from the style pass; verify, do not trust blindly): United States Post Office, Avon NY 14414 (80 Prospect St): 1-storey red brick, front-facing gable clad in white siding, navy shutters, white gabled entry; ridge along the long axis. Confidence high (sv_3911_a shows the lettering).

## Frame (blueprint u/v)
- OBB 19.0 m along u × 15.5 m along v; +u bears 285° (WNW), +v bears 15° (NNE). Centroid local (6, -124) m.
- Road face: **+u** (Prospect Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 285° WNW | 15.5 m | NNE | ROAD SIDE |
| `-u` | 105° ESE | 15.5 m | SSW |  |
| `+v` | 15° NNE | 19.0 m | ESE |  |
| `-v` | 195° SSW | 19.0 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-9.5, 7.7), (-9.5, -7.7), (9.5, -7.7), (9.5, 7.7)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248273911.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-9.5, 7.7, 0.0), (-9.5, -7.7, 0.3), (9.5, -7.7, 0.1), (9.5, 7.7, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248274488`   (house): off face `+v`, gap 4.7 m, generic style
- `248273912` 80 Park Place  (commercial): off face `-v`, gap 8.5 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248273911_+u.png` — face `+u`, 17.4 m out, 4° off head-on, fov 60°, imagery Aug 2025
- `front_248273911_-u.png` — face `-u`, 36.4 m out, 178° off head-on, fov 55°, imagery Aug 2025
- `front_248273911_+v.png` — face `+v`, 32.9 m out, 53° off head-on, fov 55°, imagery Aug 2025
- `front_248273911_+v_2.png` — face `+v`, 40.1 m out, 41° off head-on, fov 55°, imagery Aug 2025
- `front_248273911_-v.png` — face `-v`, 28.0 m out, 62° off head-on, fov 55°, imagery Aug 2025
- `front_248273911_-v_2.png` — face `-v`, 51.7 m out, 2° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248273911_a.png, sv_248273911_b.png, sv_248273911_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913186,-77.745757,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913220,-77.745935,3a,55y,105h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913053,-77.745056,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913019,-77.744878,3a,55y,285h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913361,-77.745321,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913491,-77.745275,3a,55y,195h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912878,-77.745492,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912748,-77.745538,3a,55y,15h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248273911.json`; notes: `blueprint_248273911.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248273911` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248273911 +u --dist 45 --compare` → `render_248273911_+u.png` and `compare_248273911_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248273911&focus=248273911&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
