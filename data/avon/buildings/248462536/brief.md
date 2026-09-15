# Brief — OSM 248462536 — 56 East Main Street

## Identity
- OSM id `248462536`; address: 56 East Main Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "paleblue", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 23.5 m along u × 13.3 m along v; +u bears 193° (SSW), +v bears 283° (WNW). Centroid local (196, 10) m.
- Road face: **+u** (East Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 193° SSW | 13.3 m | WNW | ROAD SIDE |
| `-u` | 13° NNE | 13.3 m | ESE |  |
| `+v` | 283° WNW | 23.5 m | NNE |  |
| `-v` | 103° ESE | 23.5 m | SSW |  |

- Footprint polygon in (u, v), metres: [(-4.5, 1.1), (-11.7, 1.1), (-11.7, -6.6), (11.7, -6.7), (11.7, 6.6), (-4.5, 6.6)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248462536.png`).
- Footprint card: `research/card_248462536.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-4.5, 1.1, 0.5), (-11.7, 1.1, 0.3), (-11.7, -6.6, 0.7), (11.7, -6.7, 0.7), (11.7, 6.6, 0.3), (-4.5, 6.6, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248462534` 50 East Main Street  (house): off face `+v`, gap 8.1 m, generic style

## Photos
- `front_248462536_+u.png` — face `+u`, 25.2 m out, 6° off head-on, fov 55°, imagery Sep 2025
- `front_248462536_-u.png` — face `-u`, 50.9 m out, 160° off head-on, fov 55°, imagery Sep 2025
- `front_248462536_+v.png` — face `+v`, 41.3 m out, 60° off head-on, fov 55°, imagery Sep 2025
- `front_248462536_+v_2.png` — face `+v`, 46.9 m out, 49° off head-on, fov 55°, imagery Sep 2025
- `front_248462536_+v_3.png` — face `+v`, 76.7 m out, 0° off head-on, fov 55°, imagery Aug 2025
- `front_248462536_-v.png` — face `-v`, 41.0 m out, 67° off head-on, fov 55°, imagery Sep 2025
- `front_248462536_-v_2.png` — face `-v`, 46.3 m out, 55° off head-on, fov 55°, imagery Sep 2025
- `front_248462536_-v_3.png` — face `-v`, 53.1 m out, 46° off head-on, fov 55°, imagery Sep 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911644,-77.743159,3a,55y,13h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911512,-77.743200,3a,55y,13h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912199,-77.742982,3a,55y,193h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912330,-77.742940,3a,55y,193h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911976,-77.743388,3a,55y,103h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912006,-77.743568,3a,55y,103h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911867,-77.742752,3a,55y,283h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911836,-77.742573,3a,55y,283h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248462536.json`; notes: `blueprint_248462536.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248462536` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248462536 +u --dist 45 --compare` → `render_248462536_+u.png` and `compare_248462536_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248462536&focus=248462536&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
