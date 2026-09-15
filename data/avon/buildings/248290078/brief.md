# Brief — OSM 248290078 — no address

## Identity
- OSM id `248290078`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 3, "roof": "hip", "wall": "#f2f0ea", "roofColor": "#5f6367", "sign": "Avon Inn"}
- Earlier research note (from the style pass; verify, do not trust blindly): Reconciled: Avon Inn rendered with its real hip roof now that cupolas work on hips.

## Frame (blueprint u/v)
- OBB 45.2 m along u × 32.0 m along v; +u bears 15° (NNE), +v bears 105° (ESE). Centroid local (166, 91) m.
- Road face: **-v** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 15° NNE | 32.0 m | ESE |  |
| `-u` | 195° SSW | 32.0 m | WNW |  |
| `+v` | 105° ESE | 45.2 m | SSW |  |
| `-v` | 285° WNW | 45.2 m | NNE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(22.6, 12.7), (7.0, 12.7), (6.3, 16.0), (-22.6, 16.0), (-22.6, -15.2), (-12.5, -15.2), (-12.5, -10.9), (-7.5, -10.9), (-7.5, -16.0), (9.7, -16.0), (9.7, -6.9), (22.6, -6.9)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248290078.png`).
- Footprint card: `research/card_248290078.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(22.6, 12.7, 1.1), (7.0, 12.7, 1.3), (6.3, 16.0, 1.3), (-22.6, 16.0, 1.3), (-22.6, -15.2, 0.7), (-12.5, -15.2, 0.6), (-12.5, -10.9, 0.7), (-7.5, -10.9, 0.8), (-7.5, -16.0, 0.6), (9.7, -16.0, 0.0), (9.7, -6.9, 0.4), (22.6, -6.9, 0.4)]
- The lot slopes 1.3 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248361683` 65 East Main Street  (commercial): off face `+v`, gap 6.8 m, generic style

## Photos
- `front_248290078_+u.png` — face `+u`, 27.3 m out, 3° off head-on, fov 73°, imagery Sep 2025
- `front_248290078_-u.png` — face `-u`, 43.8 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `front_248290078_-u_2.png` — face `-u`, 60.8 m out, 27° off head-on, fov 55°, imagery Aug 2025
- `front_248290078_+v.png` — face `+v`, 56.1 m out, 62° off head-on, fov 56°, imagery Sep 2025
- `front_248290078_+v_2.png` — face `+v`, 68.3 m out, 47° off head-on, fov 55°, imagery Sep 2025
- `front_248290078_+v_3.png` — face `+v`, 84.0 m out, 36° off head-on, fov 55°, imagery Sep 2025
- `front_248290078_-v.png` — face `-v`, 12.9 m out, 16° off head-on, fov 80°, imagery Aug 2025
- `front_248290078_-v_2.png` — face `-v`, 108.4 m out, 5° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248290078_a.png, sv_248290078_b.png, sv_248290078_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911558,-77.743302,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911688,-77.743253,3a,55y,195h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910820,-77.743577,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910690,-77.743626,3a,55y,15h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911104,-77.743013,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911069,-77.742836,3a,55y,285h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911275,-77.743866,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911310,-77.744043,3a,55y,105h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248290078.json`; notes: `blueprint_248290078.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248290078` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248290078 -v --dist 45 --compare` → `render_248290078_-v.png` and `compare_248290078_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248290078&focus=248290078&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
