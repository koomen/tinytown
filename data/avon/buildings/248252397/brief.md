# Brief — OSM 248252397 — 29 West Main Street

## Identity
- OSM id `248252397`; address: 29 West Main Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "#e8e2c4", "roofColor": "#6b5a48"}
- Earlier research note (from the style pass; verify, do not trust blindly): 29 W Main St: 2-storey pale-yellow clapboard house, grey-blue shutters, brown shingled gable roof (front gable toward street), enclosed sun-porch/room across the front, big honey-locust in the yard. Plain residence, no sign. Confidence high (sv_248252397_a; number 29 visible on the house).

## Frame (blueprint u/v)
- OBB 26.6 m along u × 9.9 m along v; +u bears 215° (SW), +v bears 305° (NW). Centroid local (-120, -13) m.
- Road face: **-u** (West Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 215° SW | 9.9 m | NW |  |
| `-u` | 35° NE | 9.9 m | SE | ROAD SIDE |
| `+v` | 305° NW | 26.6 m | NE |  |
| `-v` | 125° SE | 26.6 m | SW |  |

- Footprint polygon in (u, v), metres: [(-13.3, -4.9), (13.3, -4.9), (13.3, 4.9), (-13.3, 4.9)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252397.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-13.3, -4.9, 1.0), (13.3, -4.9, 1.0), (13.3, 4.9, 0.2), (-13.3, 4.9, 0.0)]
- The lot slopes 1.0 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248252394`   (commercial): off face `+v`, gap 6.2 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248252397_+u.png` — face `+u`, 66.7 m out, 73° off head-on, fov 55°, imagery ?
- face `-u`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- face `+v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- face `-v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- Older oblique captures from the style pass: sv_248252397_a.png, sv_248252397_b.png, sv_248252397_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911879,-77.747187,3a,55y,35h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911768,-77.747292,3a,55y,35h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912371,-77.746722,3a,55y,215h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912481,-77.746617,3a,55y,215h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912253,-77.747206,3a,55y,125h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912329,-77.747357,3a,55y,125h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911997,-77.746703,3a,55y,305h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911920,-77.746552,3a,55y,305h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252397.json`; notes: `blueprint_248252397.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252397` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252397 -u --dist 45 --compare` → `render_248252397_-u.png` and `compare_248252397_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252397&focus=248252397&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
