# Brief — OSM 248274495 — 52 West Main Street

## Identity
- OSM id `248274495`; address: 52 West Main Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "#b7c4cc", "roofColor": "#4b4f52"}
- Earlier research note (from the style pass; verify, do not trust blindly): 52 W Main St: tiny derelict 2-storey duplex (1,120 sqft, deemed not habitable, sold 2023) squeezed between Puppy's Bar (58 W Main, id 4494) and 46 W Main; only a light blue-grey clapboard side wall visible behind trees/dumpster lot. Confidence low on look; rendered as small blue-grey gable house.

## Frame (blueprint u/v)
- OBB 14.7 m along u × 6.5 m along v; +u bears 214° (SW), +v bears 304° (NW). Centroid local (-117, -87) m.
- Road face: **+u** (West Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 214° SW | 6.5 m | NW | ROAD SIDE |
| `-u` | 34° NE | 6.5 m | SE |  |
| `+v` | 304° NW | 14.7 m | NE |  |
| `-v` | 124° SE | 14.7 m | SW |  |

- Footprint polygon in (u, v), metres: [(-7.4, -3.3), (7.4, -3.3), (7.3, 3.3), (-7.3, 3.3)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274495.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-7.4, -3.3, 2.8), (7.4, -3.3, 0.2), (7.3, 3.3, 0.0), (-7.3, 3.3, 0.4)]
- The lot slopes 2.8 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248274497` 46 West Main Street  (house): off face `-v`, gap 2.8 m, generic style
- `248274494`   (commercial): off face `+v`, gap 9.9 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248274495_+u.png` — face `+u`, 18.3 m out, 7° off head-on, fov 55°, imagery Aug 2025
- `front_248274495_-u.png` — face `-u`, 32.9 m out, 176° off head-on, fov 55°, imagery Aug 2025
- `front_248274495_-u_2.png` — face `-u`, 45.0 m out, 134° off head-on, fov 55°, imagery Aug 2025
- `front_248274495_+v.png` — face `+v`, 31.0 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_248274495_+v_2.png` — face `+v`, 37.7 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248274495_-v.png` — face `-v`, 30.3 m out, 62° off head-on, fov 55°, imagery Aug 2025
- `front_248274495_-v_2.png` — face `-v`, 36.3 m out, 48° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248274495_a.png, sv_248274495_b.png, sv_248274495_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912587,-77.747108,3a,55y,34h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912475,-77.747211,3a,55y,34h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912994,-77.746732,3a,55y,214h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913105,-77.746629,3a,55y,214h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912908,-77.747156,3a,55y,124h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912983,-77.747309,3a,55y,124h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912673,-77.746684,3a,55y,304h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912598,-77.746531,3a,55y,304h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274495.json`; notes: `blueprint_248274495.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274495` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274495 +u --dist 45 --compare` → `render_248274495_+u.png` and `compare_248274495_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274495&focus=248274495&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
