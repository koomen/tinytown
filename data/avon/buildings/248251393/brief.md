# Brief — OSM 248251393 — 119 Genesee Street

## Identity
- OSM id `248251393`; address: 119 Genesee Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "butter", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 17.4 m along u × 11.9 m along v; +u bears 106° (ESE), +v bears 196° (SSW). Centroid local (-125, 166) m.
- Road face: **+u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 106° ESE | 11.9 m | SSW | ROAD SIDE |
| `-u` | 286° WNW | 11.9 m | NNE |  |
| `+v` | 196° SSW | 17.4 m | WNW |  |
| `-v` | 16° NNE | 17.4 m | ESE |  |

- Footprint polygon in (u, v), metres: [(8.7, -5.9), (8.7, 5.9), (-8.7, 5.9), (-8.7, -5.9)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248251393.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(8.7, -5.9, 0.3), (8.7, 5.9, 0.2), (-8.7, 5.9, 0.0), (-8.7, -5.9, 0.2)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248251392` 121 Genesee Street  (house): off face `+v`, gap 6.4 m, generic style

## Photos
- `front_248251393_+u.png` — face `+u`, 14.8 m out, 3° off head-on, fov 56°, imagery Aug 2025
- `front_248251393_+u_2.png` — face `+u`, 29.6 m out, 21° off head-on, fov 55°, imagery Aug 2021
- `front_248251393_-u.png` — face `-u`, 32.2 m out, 179° off head-on, fov 55°, imagery Aug 2025
- `front_248251393_-u_2.png` — face `-u`, 38.2 m out, 150° off head-on, fov 55°, imagery Aug 2025
- `front_248251393_+v.png` — face `+v`, 27.7 m out, 61° off head-on, fov 55°, imagery Aug 2025
- `front_248251393_+v_2.png` — face `+v`, 34.1 m out, 47° off head-on, fov 55°, imagery Aug 2025
- `front_248251393_+v_3.png` — face `+v`, 41.9 m out, 37° off head-on, fov 55°, imagery Aug 2025
- `front_248251393_-v.png` — face `-v`, 27.5 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248251393_-v_2.png` — face `-v`, 33.9 m out, 42° off head-on, fov 55°, imagery Aug 2025
- `front_248251393_-v_3.png` — face `-v`, 41.6 m out, 33° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910448,-77.746673,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910410,-77.746496,3a,55y,286h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910592,-77.747349,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910630,-77.747525,3a,55y,106h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910297,-77.747100,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910167,-77.747151,3a,55y,16h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910744,-77.746922,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910873,-77.746870,3a,55y,196h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248251393.json`; notes: `blueprint_248251393.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248251393` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248251393 +u --dist 45 --compare` → `render_248251393_+u.png` and `compare_248251393_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248251393&focus=248251393&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
