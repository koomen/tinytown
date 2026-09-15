# Brief — OSM 248274497 — 46 West Main Street

## Identity
- OSM id `248274497`; address: 46 West Main Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "#a3b5c3", "roofColor": "#454749"}
- Earlier research note (from the style pass; verify, do not trust blindly): 46 W Main St: multi-family house (4bd, 3,356 sqft) - 2-storey light blue-grey clapboard, front-gable deep plan, dark roof, white porch. Confidence med-high (sv_4495_c / sv_4497_a-b + Redfin).

## Frame (blueprint u/v)
- OBB 23.0 m along u × 8.4 m along v; +u bears 219° (SW), +v bears 309° (NW). Centroid local (-106, -83) m.
- Road face: **+u** (West Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 219° SW | 8.4 m | NW | ROAD SIDE |
| `-u` | 39° NE | 8.4 m | SE |  |
| `+v` | 309° NW | 23.0 m | NE |  |
| `-v` | 129° SE | 23.0 m | SW |  |

- Footprint polygon in (u, v), metres: [(-11.5, -4.2), (11.5, -4.2), (11.5, 4.2), (-11.5, 4.2)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274497.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-11.5, -4.2, 4.7), (11.5, -4.2, 1.1), (11.5, 4.2, 0.0), (-11.5, 4.2, 4.5)]
- The lot slopes 4.7 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248274495` 52 West Main Street  (house): off face `+v`, gap 2.8 m, generic style

## Photos
- `front_248274497_+u.png` — face `+u`, 17.8 m out, 2° off head-on, fov 55°, imagery Aug 2025
- face `-u`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- face `+v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- face `-v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- Older oblique captures from the style pass: sv_248274497_a.png, sv_248274497_b.png, sv_248274497_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912537,-77.747030,3a,55y,39h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912432,-77.747147,3a,55y,39h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912974,-77.746540,3a,55y,219h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913078,-77.746423,3a,55y,219h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912893,-77.747014,3a,55y,129h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912979,-77.747157,3a,55y,129h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912617,-77.746555,3a,55y,309h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912532,-77.746413,3a,55y,309h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274497.json`; notes: `blueprint_248274497.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274497` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274497 +u --dist 45 --compare` → `render_248274497_+u.png` and `compare_248274497_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274497&focus=248274497&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
