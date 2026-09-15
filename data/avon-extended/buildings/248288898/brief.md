# Brief — OSM 248288898 — no address

## Identity
- OSM id `248288898`; address: none in OSM; name: none in OSM; tags: {"building": "garage"}
- Current generic style: {"kind": "garage", "floors": 1, "roof": "gable", "wall": "white", "roofColor": "grey"}

## Frame (blueprint u/v)
- OBB 7.9 m along u × 7.8 m along v; +u bears 106° (ESE), +v bears 196° (SSW). Centroid local (87, 178) m.
- Road face: **+u** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 106° ESE | 7.8 m | SSW | ROAD SIDE |
| `-u` | 286° WNW | 7.8 m | NNE |  |
| `+v` | 196° SSW | 7.9 m | WNW |  |
| `-v` | 16° NNE | 7.9 m | ESE |  |

- Footprint polygon in (u, v), metres: [(3.9, -3.9), (3.9, 3.9), (-3.9, 3.9), (-3.9, -3.9)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248288898.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(3.9, -3.9, 0.9), (3.9, 3.9, 0.5), (-3.9, 3.9, 0.0), (-3.9, -3.9, 0.2)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248288899`   (house): off face `-v`, gap 2.1 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248288898_+u.png` — face `+u`, 24.5 m out, 5° off head-on, fov 55°, imagery Aug 2025
- `front_248288898_-u.png` — face `-u`, 32.4 m out, 176° off head-on, fov 55°, imagery Aug 2025
- `front_248288898_-u_2.png` — face `-u`, 40.8 m out, 137° off head-on, fov 55°, imagery Aug 2025
- `front_248288898_+v.png` — face `+v`, 28.3 m out, 73° off head-on, fov 55°, imagery Aug 2025
- `front_248288898_+v_2.png` — face `+v`, 34.2 m out, 58° off head-on, fov 55°, imagery Aug 2025
- `front_248288898_+v_3.png` — face `+v`, 40.6 m out, 46° off head-on, fov 55°, imagery Aug 2025
- `front_248288898_-v.png` — face `-v`, 29.5 m out, 62° off head-on, fov 55°, imagery Aug 2025
- `front_248288898_-v_2.png` — face `-v`, 35.2 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248288898_-v_3.png` — face `-v`, 42.6 m out, 37° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910353,-77.744130,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910315,-77.743953,3a,55y,286h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910472,-77.744694,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910510,-77.744870,3a,55y,106h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910206,-77.744493,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910077,-77.744544,3a,55y,16h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910619,-77.744330,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910748,-77.744279,3a,55y,196h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248288898.json`; notes: `blueprint_248288898.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248288898` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248288898 +u --dist 45 --compare` → `render_248288898_+u.png` and `compare_248288898_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248288898&focus=248288898&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
