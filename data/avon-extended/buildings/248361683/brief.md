# Brief — OSM 248361683 — 65 East Main Street

## Identity
- OSM id `248361683`; address: 65 East Main Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "brick", "roofColor": "tar"}

## Frame (blueprint u/v)
- OBB 19.8 m along u × 15.9 m along v; +u bears 15° (NNE), +v bears 105° (ESE). Centroid local (200, 86) m.
- Road face: **+u** (East Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 15° NNE | 15.9 m | ESE | ROAD SIDE |
| `-u` | 195° SSW | 15.9 m | WNW |  |
| `+v` | 105° ESE | 19.8 m | SSW |  |
| `-v` | 285° WNW | 19.8 m | NNE |  |

- Footprint polygon in (u, v), metres: [(9.9, 8.0), (-9.9, 8.0), (-9.9, -8.0), (9.9, -8.0)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248361683.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(9.9, 8.0, 0.0), (-9.9, 8.0, 0.1), (-9.9, -8.0, 0.1), (9.9, -8.0, 0.2)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248290078`   (commercial): off face `-v`, gap 6.8 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248361683_+u.png` — face `+u`, 26.3 m out, 3° off head-on, fov 55°, imagery Sep 2025
- `front_248361683_-u.png` — face `-u`, 60.2 m out, 80° off head-on, fov 55°, imagery Aug 2025
- `front_248361683_+v.png` — face `+v`, 43.4 m out, 56° off head-on, fov 55°, imagery Sep 2025
- `front_248361683_+v_2.png` — face `+v`, 50.0 m out, 46° off head-on, fov 55°, imagery Sep 2025
- `front_248361683_-v.png` — face `-v`, 50.8 m out, 0° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911494,-77.742937,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911624,-77.742889,3a,55y,195h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910975,-77.743128,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910845,-77.743176,3a,55y,15h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911169,-77.742701,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911134,-77.742524,3a,55y,285h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911300,-77.743363,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911335,-77.743541,3a,55y,105h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248361683.json`; notes: `blueprint_248361683.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248361683` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248361683 +u --dist 45 --compare` → `render_248361683_+u.png` and `compare_248361683_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248361683&focus=248361683&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
