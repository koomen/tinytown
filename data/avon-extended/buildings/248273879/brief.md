# Brief — OSM 248273879 — 90 West Main Street

## Identity
- OSM id `248273879`; address: 90 West Main Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "brick", "roofColor": "tar"}

## Frame (blueprint u/v)
- OBB 31.4 m along u × 20.8 m along v; +u bears 21° (NNE), +v bears 111° (ESE). Centroid local (-173, -149) m.
- Road face: **-v** (Rochester Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 21° NNE | 20.8 m | ESE |  |
| `-u` | 201° SSW | 20.8 m | WNW |  |
| `+v` | 111° ESE | 31.4 m | SSW |  |
| `-v` | 291° WNW | 31.4 m | NNE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(15.7, 2.4), (-4.7, 2.2), (-4.8, 10.4), (-15.7, 10.2), (-15.5, -5.5), (-11.5, -10.4), (15.5, -10.4)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248273879.png`).
- Footprint card: `research/card_248273879.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(15.7, 2.4, 0.5), (-4.7, 2.2, 0.9), (-4.8, 10.4, 1.9), (-15.7, 10.2, 2.3), (-15.5, -5.5, 0.4), (-11.5, -10.4, 0.1), (15.5, -10.4, 0.0)]
- The lot slopes 2.3 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248273881`   (garage): off face `+u`, gap 0.0 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `248274491` 72 West Main Street  (commercial): off face `+v`, gap 6.2 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248273879_+u.png` — face `+u`, 31.8 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_248273879_+u_2.png` — face `+u`, 46.2 m out, 32° off head-on, fov 55°, imagery Aug 2025
- `front_248273879_+u_3.png` — face `+u`, 63.4 m out, 23° off head-on, fov 55°, imagery Aug 2025
- `front_248273879_-u.png` — face `-u`, 26.6 m out, 2° off head-on, fov 55°, imagery Aug 2025
- `front_248273879_-u_2.png` — face `-u`, 69.7 m out, 26° off head-on, fov 55°, imagery Aug 2025
- `front_248273879_-v.png` — face `-v`, 14.4 m out, 8° off head-on, fov 80°, imagery Aug 2025
- `front_248273879_-v_2.png` — face `-v`, 65.4 m out, 1° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913648,-77.747447,3a,55y,201h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913774,-77.747379,3a,55y,201h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913051,-77.747767,3a,55y,21h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912925,-77.747834,3a,55y,21h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913250,-77.747260,3a,55y,291h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913201,-77.747088,3a,55y,291h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913449,-77.747953,3a,55y,111h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913498,-77.748125,3a,55y,111h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248273879.json`; notes: `blueprint_248273879.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248273879` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248273879 -v --dist 45 --compare` → `render_248273879_-v.png` and `compare_248273879_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248273879&focus=248273879&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
