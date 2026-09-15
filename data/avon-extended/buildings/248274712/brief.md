# Brief — OSM 248274712 — 25 East Main Street

## Identity
- OSM id `248274712`; address: 25 East Main Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "grey", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 21.0 m along u × 16.1 m along v; +u bears 13° (NNE), +v bears 103° (ESE). Centroid local (125, 71) m.
- Road face: **+v** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 13° NNE | 16.1 m | ESE |  |
| `-u` | 193° SSW | 16.1 m | WNW |  |
| `+v` | 103° ESE | 21.0 m | SSW | ROAD SIDE |
| `-v` | 283° WNW | 21.0 m | NNE |  |

- Footprint polygon in (u, v), metres: [(10.5, 8.1), (-1.9, 8.1), (-1.1, 2.7), (-10.5, 2.7), (-10.5, -8.1), (10.5, -8.1)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248274712.png`).
- Footprint card: `research/card_248274712.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(10.5, 8.1, 0.7), (-1.9, 8.1, 1.0), (-1.1, 2.7, 0.5), (-10.5, 2.7, 0.7), (-10.5, -8.1, 0.0), (10.5, -8.1, 0.0)]
- The lot slopes 1.0 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248274713`   (garage): off face `-v`, gap 9.3 m, generic style

## Photos
- `front_248274712_+u.png` — face `+u`, 30.5 m out, 2° off head-on, fov 55°, imagery Sep 2025
- `front_248274712_-u.png` — face `-u`, 22.2 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248274712_-u_2.png` — face `-u`, 29.9 m out, 32° off head-on, fov 55°, imagery Aug 2025
- `front_248274712_+v.png` — face `+v`, 10.6 m out, 23° off head-on, fov 80°, imagery Aug 2025
- `front_248274712_-v.png` — face `-v`, 47.8 m out, 62° off head-on, fov 55°, imagery Sep 2025
- `front_248274712_-v_2.png` — face `-v`, 53.4 m out, 53° off head-on, fov 55°, imagery Sep 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911642,-77.743869,3a,55y,193h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911773,-77.743828,3a,55y,193h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911108,-77.744035,3a,55y,13h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910976,-77.744076,3a,55y,13h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911319,-77.743617,3a,55y,283h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911289,-77.743437,3a,55y,283h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911431,-77.744288,3a,55y,103h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911461,-77.744467,3a,55y,103h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274712.json`; notes: `blueprint_248274712.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274712` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274712 +v --dist 45 --compare` → `render_248274712_+v.png` and `compare_248274712_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274712&focus=248274712&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
