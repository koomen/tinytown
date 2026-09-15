# Brief — OSM 1090362841 — no address

## Identity
- OSM id `1090362841`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "#c8b48e", "roofColor": "tar"}
- Earlier research note (from the style pass; verify, do not trust blindly): Small salon at ~59 Genesee - 2-storey flat-roof tan brick/stone facade, brown awning, purple-curtained windows (name unreadable, not in chamber directory). Med confidence on appearance (2841_a/2842_b), low on tenant, so signless.
- Nearby POI: {"id": 11155436521, "kind": "florist", "name": "Avon Floral World, Gift Shoppe & Flower Delivery", "x": -105.98, "z": 85.68}

## Frame (blueprint u/v)
- OBB 7.4 m along u × 30.3 m along v; +u bears 15° (NNE), +v bears 105° (ESE). Centroid local (-106, 75) m.
- Road face: **+v** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 15° NNE | 30.3 m | ESE |  |
| `-u` | 195° SSW | 30.3 m | WNW |  |
| `+v` | 105° ESE | 7.4 m | SSW | ROAD SIDE |
| `-v` | 285° WNW | 7.4 m | NNE |  |

- Footprint polygon in (u, v), metres: [(3.7, -15.1), (3.7, 15.1), (-3.7, 15.1), (-3.7, -15.1)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_1090362841.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(3.7, -15.1, 0.0), (3.7, 15.1, 2.3), (-3.7, 15.1, 2.1), (-3.7, -15.1, 0.0)]
- The lot slopes 2.3 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `1090362840`   (commercial): off face `-u`, gap 1.0 m, generic style
- `1090362842`   (commercial): off face `+u`, gap 2.4 m, generic style

## Photos
- `front_1090362841_+u.png` — face `+u`, 39.6 m out, 45° off head-on, fov 55°, imagery Aug 2025
- `front_1090362841_+u_2.png` — face `+u`, 55.3 m out, 31° off head-on, fov 55°, imagery Aug 2025
- `front_1090362841_-u.png` — face `-u`, 40.6 m out, 44° off head-on, fov 55°, imagery Aug 2025
- `front_1090362841_-u_2.png` — face `-u`, 56.7 m out, 30° off head-on, fov 55°, imagery Aug 2025
- `front_1090362841_+v.png` — face `+v`, 13.5 m out, 13° off head-on, fov 55°, imagery Aug 2025
- `front_1090362841_+v_2.png` — face `+v`, 23.9 m out, 1° off head-on, fov 55°, imagery Aug 2023
- `front_1090362841_+v_3.png` — face `+v`, 33.4 m out, 1° off head-on, fov 55°, imagery Aug 2023
- `front_1090362841_-v.png` — face `-v`, 96.7 m out, 8° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_1090362841_a.png, sv_1090362841_b.png, sv_1090362841_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911546,-77.746702,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911677,-77.746655,3a,55y,195h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911134,-77.746848,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911003,-77.746894,3a,55y,15h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911261,-77.746358,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911227,-77.746179,3a,55y,285h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911419,-77.747192,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911453,-77.747370,3a,55y,105h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_1090362841.json`; notes: `blueprint_1090362841.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 1090362841` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 1090362841 +v --dist 45 --compare` → `render_1090362841_+v.png` and `compare_1090362841_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=1090362841&focus=1090362841&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
