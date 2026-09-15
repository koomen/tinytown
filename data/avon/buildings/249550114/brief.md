# Brief — OSM 249550114 — no address

## Identity
- OSM id `249550114`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "cream", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 10.4 m along u × 6.5 m along v; +u bears 15° (NNE), +v bears 105° (ESE). Centroid local (-143, 96) m.
- Road face: **+v** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 15° NNE | 6.5 m | ESE |  |
| `-u` | 195° SSW | 6.5 m | WNW |  |
| `+v` | 105° ESE | 10.4 m | SSW | ROAD SIDE |
| `-v` | 285° WNW | 10.4 m | NNE |  |

- Footprint polygon in (u, v), metres: [(5.2, 3.2), (-5.2, 3.2), (-5.2, -3.2), (5.2, -3.2)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_249550114.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(5.2, 3.2, 1.5), (-5.2, 3.2, 0.4), (-5.2, -3.2, 0.0), (5.2, -3.2, 0.5)]
- The lot slopes 1.5 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `1090362840`   (commercial): off face `+v`, gap 9.0 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- face `+u`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- face `-u`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- `front_249550114_+v.png` — face `+v`, 56.3 m out, 1° off head-on, fov 55°, imagery Aug 2025
- `front_249550114_-v.png` — face `-v`, 88.1 m out, 29° off head-on, fov 55°, imagery Aug 2025
- `front_249550114_-v_2.png` — face `-v`, 89.7 m out, 24° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911364,-77.747157,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911494,-77.747108,3a,55y,195h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910927,-77.747321,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910797,-77.747370,3a,55y,15h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911090,-77.746964,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911054,-77.746786,3a,55y,285h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911201,-77.747513,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911237,-77.747691,3a,55y,105h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_249550114.json`; notes: `blueprint_249550114.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 249550114` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 249550114 +v --dist 45 --compare` → `render_249550114_+v.png` and `compare_249550114_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=249550114&focus=249550114&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
