# Brief — OSM 248274494 — no address

## Identity
- OSM id `248274494`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "gable", "wall": "#e9e4d8", "roofColor": "#4a4a4a", "sign": "Puppy's Bar & Grill"}
- Earlier research note (from the style pass; verify, do not trust blindly): Puppy's Bar & Grill, 58 W Main St (chamber listing); appearance unverified — clapboard house with storefront. Low confidence on look.

## Frame (blueprint u/v)
- OBB 21.3 m along u × 15.2 m along v; +u bears 215° (SW), +v bears 305° (NW). Centroid local (-132, -103) m.
- Road face: **+u** (West Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 215° SW | 15.2 m | NW | ROAD SIDE |
| `-u` | 35° NE | 15.2 m | SE |  |
| `+v` | 305° NW | 21.3 m | NE |  |
| `-v` | 125° SE | 21.3 m | SW |  |

- Footprint polygon in (u, v), metres: [(-10.6, -7.6), (10.6, -7.6), (10.6, 7.6), (-10.6, 7.6)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274494.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-10.6, -7.6, 2.3), (10.6, -7.6, 1.5), (10.6, 7.6, 0.0), (-10.6, 7.6, 0.7)]
- The lot slopes 2.3 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248274492` 70 West Main Street  (house): off face `+v`, gap 3.2 m, generic style
- `248274495` 52 West Main Street  (house): off face `-v`, gap 9.9 m, generic style

## Photos
- `front_248274494_+u.png` — face `+u`, 18.4 m out, 3° off head-on, fov 57°, imagery Aug 2025
- `front_248274494_-u.png` — face `-u`, 40.9 m out, 164° off head-on, fov 55°, imagery Aug 2025
- `front_248274494_+v.png` — face `+v`, 36.7 m out, 50° off head-on, fov 55°, imagery Aug 2025
- `front_248274494_+v_2.png` — face `+v`, 43.7 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248274494_-v.png` — face `-v`, 37.3 m out, 54° off head-on, fov 55°, imagery Aug 2025
- `front_248274494_-v_2.png` — face `-v`, 44.0 m out, 44° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912707,-77.747317,3a,55y,35h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912597,-77.747424,3a,55y,35h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.913155,-77.746881,3a,55y,215h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913265,-77.746774,3a,55y,215h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.913075,-77.747375,3a,55y,125h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913153,-77.747525,3a,55y,125h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912787,-77.746823,3a,55y,305h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912709,-77.746673,3a,55y,305h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274494.json`; notes: `blueprint_248274494.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274494` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274494 +u --dist 45 --compare` → `render_248274494_+u.png` and `compare_248274494_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274494&focus=248274494&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
