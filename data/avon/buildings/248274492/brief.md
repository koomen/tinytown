# Brief — OSM 248274492 — 70 West Main Street

## Identity
- OSM id `248274492`; address: 70 West Main Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "#e3d27c", "roofColor": "#5f6367"}
- Earlier research note (from the style pass; verify, do not trust blindly): 70 W Main St (OSM footprint): the Street View shots were blocked by a truck; from the 72 W Main viewpoint the footprint bearing/distance and long-along-street shape match the yellow clapboard 2-storey side-gable house with grey roof and exterior stair east of 72. Listings say 70 W Main is now a vacant lot, so this may be a neighbour (66-68) or a since-removed building. Confidence low-med.

## Frame (blueprint u/v)
- OBB 19.1 m along u × 9.8 m along v; +u bears 37° (NE), +v bears 127° (SE). Centroid local (-145, -112) m.
- Road face: **-u** (West Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 37° NE | 9.8 m | SE |  |
| `-u` | 217° SW | 9.8 m | NW | ROAD SIDE |
| `+v` | 127° SE | 19.1 m | SW |  |
| `-v` | 307° NW | 19.1 m | NE |  |

- Footprint polygon in (u, v), metres: [(9.6, 4.9), (-9.6, 4.9), (-9.6, -4.9), (9.6, -4.9)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274492.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(9.6, 4.9, 1.3), (-9.6, 4.9, 0.6), (-9.6, -4.9, 0.0), (9.6, -4.9, 0.1)]
- The lot slopes 1.3 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248274494`   (commercial): off face `+v`, gap 3.2 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `248274491` 72 West Main Street  (commercial): off face `-v`, gap 6.4 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248274492_+u.png` — face `+u`, 38.7 m out, 172° off head-on, fov 55°, imagery Aug 2025
- `front_248274492_-u.png` — face `-u`, 19.7 m out, 13° off head-on, fov 55°, imagery Aug 2025
- `front_248274492_-u_2.png` — face `-u`, 27.2 m out, 6° off head-on, fov 55°, imagery Aug 2025
- `front_248274492_+v.png` — face `+v`, 35.7 m out, 54° off head-on, fov 55°, imagery Aug 2025
- `front_248274492_+v_2.png` — face `+v`, 42.6 m out, 43° off head-on, fov 55°, imagery Aug 2025
- `front_248274492_-v.png` — face `-v`, 34.7 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_248274492_-v_2.png` — face `-v`, 41.1 m out, 44° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248274492_a.png, sv_248274492_b.png, sv_248274492_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.913227,-77.747039,3a,55y,217h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913335,-77.746928,3a,55y,217h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912803,-77.747475,3a,55y,37h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912696,-77.747586,3a,55y,37h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912881,-77.747013,3a,55y,307h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912800,-77.746867,3a,55y,307h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.913150,-77.747501,3a,55y,127h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.913231,-77.747648,3a,55y,127h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274492.json`; notes: `blueprint_248274492.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274492` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274492 -u --dist 45 --compare` → `render_248274492_-u.png` and `compare_248274492_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274492&focus=248274492&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
