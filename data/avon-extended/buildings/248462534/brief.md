# Brief — OSM 248462534 — 50 East Main Street

## Identity
- OSM id `248462534`; address: 50 East Main Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 12.8 m along u × 9.1 m along v; +u bears 16° (NNE), +v bears 106° (ESE). Centroid local (175, 16) m.
- Road face: **-u** (East Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 16° NNE | 9.1 m | ESE |  |
| `-u` | 196° SSW | 9.1 m | WNW | ROAD SIDE |
| `+v` | 106° ESE | 12.8 m | SSW |  |
| `-v` | 286° WNW | 12.8 m | NNE |  |

- Footprint polygon in (u, v), metres: [(6.4, 4.5), (-6.4, 4.5), (-6.4, -4.5), (6.4, -4.5)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248462534.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(6.4, 4.5, 0.7), (-6.4, 4.5, 0.8), (-6.4, -4.5, 0.3), (6.4, -4.5, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248462536` 56 East Main Street  (house): off face `+v`, gap 8.1 m, generic style

## Photos
- `front_248462534_+u.png` — face `+u`, 31.1 m out, 174° off head-on, fov 55°, imagery Sep 2025
- `front_248462534_+u_2.png` — face `+u`, 70.6 m out, 64° off head-on, fov 55°, imagery Aug 2025
- `front_248462534_-u.png` — face `-u`, 18.4 m out, 11° off head-on, fov 55°, imagery Sep 2025
- `front_248462534_+v.png` — face `+v`, 30.7 m out, 52° off head-on, fov 55°, imagery Sep 2025
- `front_248462534_+v_2.png` — face `+v`, 37.8 m out, 40° off head-on, fov 55°, imagery Sep 2025
- `front_248462534_-v.png` — face `-v`, 27.6 m out, 64° off head-on, fov 55°, imagery Sep 2025
- `front_248462534_-v_2.png` — face `-v`, 33.4 m out, 49° off head-on, fov 55°, imagery Sep 2025
- `front_248462534_-v_3.png` — face `-v`, 60.3 m out, 5° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912090,-77.743245,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912219,-77.743194,3a,55y,196h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911634,-77.743426,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911505,-77.743478,3a,55y,16h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911800,-77.743047,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911763,-77.742870,3a,55y,286h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911924,-77.743625,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911961,-77.743801,3a,55y,106h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248462534.json`; notes: `blueprint_248462534.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248462534` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248462534 -u --dist 45 --compare` → `render_248462534_-u.png` and `compare_248462534_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248462534&focus=248462534&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
