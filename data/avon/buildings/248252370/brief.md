# Brief — OSM 248252370 — no address

## Identity
- OSM id `248252370`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 13.5 m along u × 7.2 m along v; +u bears 107° (ESE), +v bears 197° (SSW). Centroid local (-178, -18) m.
- Road face: **-u** (South Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 107° ESE | 7.2 m | SSW |  |
| `-u` | 287° WNW | 7.2 m | NNE | ROAD SIDE |
| `+v` | 197° SSW | 13.5 m | WNW |  |
| `-v` | 17° NNE | 13.5 m | ESE |  |

- Footprint polygon in (u, v), metres: [(6.8, -3.6), (6.7, 3.6), (-6.8, 3.6), (-6.8, -3.6)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252370.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(6.8, -3.6, 2.8), (6.7, 3.6, 1.1), (-6.8, 3.6, 0.1), (-6.8, -3.6, 0.0)]
- The lot slopes 2.8 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248252373`   (house): off face `-v`, gap 3.3 m, generic style

## Photos
- `front_248252370_+u.png` — face `+u`, 20.3 m out, 178° off head-on, fov 55°, imagery Aug 2025
- `front_248252370_-u.png` — face `-u`, 6.8 m out, 5° off head-on, fov 80°, imagery Aug 2025
- `front_248252370_+v.png` — face `+v`, 21.5 m out, 40° off head-on, fov 55°, imagery Aug 2025
- `front_248252370_+v_2.png` — face `+v`, 29.6 m out, 28° off head-on, fov 55°, imagery Aug 2025
- `front_248252370_-v.png` — face `-v`, 19.3 m out, 40° off head-on, fov 55°, imagery Aug 2025
- `front_248252370_-v_2.png` — face `-v`, 26.8 m out, 26° off head-on, fov 55°, imagery Aug 2025
- `front_248252370_-v_3.png` — face `-v`, 35.1 m out, 18° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912102,-77.747355,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912061,-77.747179,3a,55y,287h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912246,-77.747981,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912287,-77.748156,3a,55y,107h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911971,-77.747755,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911843,-77.747810,3a,55y,17h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912376,-77.747581,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912505,-77.747525,3a,55y,197h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252370.json`; notes: `blueprint_248252370.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252370` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252370 -u --dist 45 --compare` → `render_248252370_-u.png` and `compare_248252370_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252370&focus=248252370&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
