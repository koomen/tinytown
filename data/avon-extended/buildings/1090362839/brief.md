# Brief — OSM 1090362839 — no address

## Identity
- OSM id `1090362839`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 25.3 m along u × 8.4 m along v; +u bears 104° (ESE), +v bears 194° (SSW). Centroid local (-113, 109) m.
- Road face: **+u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 104° ESE | 8.4 m | SSW | ROAD SIDE |
| `-u` | 284° WNW | 8.4 m | NNE |  |
| `+v` | 194° SSW | 25.3 m | WNW |  |
| `-v` | 14° NNE | 25.3 m | ESE |  |

- Footprint polygon in (u, v), metres: [(12.7, 4.2), (-12.7, 4.2), (-12.7, -4.2), (12.7, -4.2)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_1090362839.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(12.7, 4.2, 1.6), (-12.7, 4.2, 0.2), (-12.7, -4.2, 0.0), (12.7, -4.2, 1.8)]
- The lot slopes 1.8 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `1090362840`   (commercial): off face `-v`, gap 0.0 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `1090362838`   (commercial): off face `+v`, gap 3.3 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_1090362839_+u.png` — face `+u`, 14.7 m out, 9° off head-on, fov 55°, imagery Aug 2025
- face `-u`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- `front_1090362839_+v.png` — face `+v`, 35.7 m out, 48° off head-on, fov 55°, imagery Aug 2025
- `front_1090362839_+v_2.png` — face `+v`, 42.9 m out, 38° off head-on, fov 55°, imagery Aug 2025
- `front_1090362839_+v_3.png` — face `+v`, 51.1 m out, 31° off head-on, fov 55°, imagery Aug 2025
- `front_1090362839_-v.png` — face `-v`, 39.1 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_1090362839_-v_2.png` — face `-v`, 50.8 m out, 33° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910960,-77.746481,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910927,-77.746303,3a,55y,284h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911102,-77.747258,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911135,-77.747437,3a,55y,104h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910820,-77.746942,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910690,-77.746987,3a,55y,14h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911242,-77.746798,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911372,-77.746753,3a,55y,194h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_1090362839.json`; notes: `blueprint_1090362839.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 1090362839` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 1090362839 +u --dist 45 --compare` → `render_1090362839_+u.png` and `compare_1090362839_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=1090362839&focus=1090362839&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
