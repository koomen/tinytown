# Brief — OSM 248251394 — 102 Genesee Street

## Identity
- OSM id `248251394`; address: 102 Genesee Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "grey", "roofColor": "black"}

## Frame (blueprint u/v)
- OBB 17.2 m along u × 11.8 m along v; +u bears 287° (WNW), +v bears 17° (NNE). Centroid local (-68, 154) m.
- Road face: **+u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 287° WNW | 11.8 m | NNE | ROAD SIDE |
| `-u` | 107° ESE | 11.8 m | SSW |  |
| `+v` | 17° NNE | 17.2 m | ESE |  |
| `-v` | 197° SSW | 17.2 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-8.6, 5.9), (-8.6, -5.9), (8.6, -5.9), (8.6, 5.9)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248251394.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-8.6, 5.9, 0.4), (-8.6, -5.9, 0.4), (8.6, -5.9, 0.0), (8.6, 5.9, 0.1)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248251397` 90 Genesee Street  (commercial): off face `+v`, gap 8.4 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248251394_+u.png` — face `+u`, 19.9 m out, 12° off head-on, fov 55°, imagery Aug 2025
- `front_248251394_-u.png` — face `-u`, 10.5 m out, 58° off head-on, fov 71°, imagery Aug 2021
- `front_248251394_-u_2.png` — face `-u`, 28.4 m out, 6° off head-on, fov 55°, imagery Aug 2023
- `front_248251394_+v.png` — face `+v`, 5.2 m out, 58° off head-on, fov 80°, imagery Aug 2021
- `front_248251394_+v_2.png` — face `+v`, 52.6 m out, 15° off head-on, fov 55°, imagery Aug 2021
- `front_248251394_-v.png` — face `-v`, 10.2 m out, 5° off head-on, fov 80°, imagery Aug 2021
- `front_248251394_-v_2.png` — face `-v`, 29.1 m out, 8° off head-on, fov 55°, imagery Aug 2023
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910697,-77.746656,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910735,-77.746832,3a,55y,107h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910549,-77.745984,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910511,-77.745808,3a,55y,287h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910846,-77.746229,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910975,-77.746176,3a,55y,197h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910400,-77.746411,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910271,-77.746464,3a,55y,17h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248251394.json`; notes: `blueprint_248251394.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248251394` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248251394 +u --dist 45 --compare` → `render_248251394_+u.png` and `compare_248251394_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248251394&focus=248251394&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
