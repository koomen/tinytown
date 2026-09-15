# Brief — OSM 248274713 — no address

## Identity
- OSM id `248274713`; address: none in OSM; name: none in OSM; tags: {"building": "garage"}
- Current generic style: {"kind": "garage", "floors": 1, "roof": "gable", "wall": "white", "roofColor": "grey"}

## Frame (blueprint u/v)
- OBB 13.7 m along u × 10.7 m along v; +u bears 13° (NNE), +v bears 103° (ESE). Centroid local (101, 72) m.
- Road face: **+v** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 13° NNE | 10.7 m | ESE |  |
| `-u` | 193° SSW | 10.7 m | WNW |  |
| `+v` | 103° ESE | 13.7 m | SSW | ROAD SIDE |
| `-v` | 283° WNW | 13.7 m | NNE |  |

- Footprint polygon in (u, v), metres: [(6.8, 5.3), (-6.8, 5.3), (-6.8, -5.3), (6.8, -5.3)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274713.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(6.8, 5.3, 0.3), (-6.8, 5.3, 0.3), (-6.8, -5.3, 0.0), (6.8, -5.3, 0.1)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248274712` 25 East Main Street  (house): off face `+v`, gap 9.3 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `248274710` 11 East Main Street  (commercial): off face `-v`, gap 9.5 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248274713_+u.png` — face `+u`, 41.4 m out, 3° off head-on, fov 55°, imagery Sep 2025
- `front_248274713_-u.png` — face `-u`, 40.8 m out, 72° off head-on, fov 55°, imagery Aug 2025
- `front_248274713_-u_2.png` — face `-u`, 44.7 m out, 59° off head-on, fov 55°, imagery Aug 2025
- `front_248274713_-u_3.png` — face `-u`, 50.4 m out, 49° off head-on, fov 55°, imagery Aug 2025
- `front_248274713_+v.png` — face `+v`, 34.5 m out, 0° off head-on, fov 55°, imagery Aug 2025
- `front_248274713_-v.png` — face `-v`, 51.7 m out, 9° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911600,-77.744168,3a,55y,193h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911731,-77.744128,3a,55y,193h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911130,-77.744313,3a,55y,13h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910998,-77.744354,3a,55y,13h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911315,-77.743938,3a,55y,283h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911285,-77.743758,3a,55y,283h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911415,-77.744544,3a,55y,103h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911445,-77.744723,3a,55y,103h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274713.json`; notes: `blueprint_248274713.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274713` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274713 +v --dist 45 --compare` → `render_248274713_+v.png` and `compare_248274713_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274713&focus=248274713&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
