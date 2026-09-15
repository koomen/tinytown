# Brief — OSM 1090362846 — 23 Genesee Street — Avon Town Hall

## Identity
- OSM id `1090362846`; address: 23 Genesee Street; name: Avon Town Hall; tags: {"amenity": "townhall", "building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 3, "roof": "flat", "wall": "#a3553f", "roofColor": "tar", "sign": "Town of Avon"}
- Earlier research note (from the style pass; verify, do not trust blindly): Hall's Opera Block 1876 / Avon Town Hall (15-23 Genesee) - 3-storey red brick, 'TOWN OF AVON' lettering, ornate black cast-iron storefront, dark-red doors, bracketed cornice with arched pediment; also houses Avon Historical Society museum. High confidence: signed in sv_b/c and 2846_a, 20 m frontage matches footprint.
- Nearby POI: {"id": 3234370470, "kind": "restaurant", "name": "Village Restaurant", "x": -73.88, "z": 10.49}
- Nearby POI: {"id": 3234371976, "kind": "courthouse", "name": "Avon Town and Village Court", "x": -80.71, "z": 29.3}

## Frame (blueprint u/v)
- OBB 20.4 m along u × 15.3 m along v; +u bears 284° (WNW), +v bears 14° (NNE). Centroid local (-86, 24) m.
- Road face: **-u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 284° WNW | 15.3 m | NNE |  |
| `-u` | 104° ESE | 15.3 m | SSW | ROAD SIDE |
| `+v` | 14° NNE | 20.4 m | ESE |  |
| `-v` | 194° SSW | 20.4 m | WNW |  |

- Footprint polygon in (u, v), metres: [(10.2, 7.6), (-10.2, 7.7), (-10.2, -7.6), (-9.0, -7.6), (10.2, -7.7)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_1090362846.png`).
- Footprint card: `research/card_1090362846.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(10.2, 7.6, 0.0), (-10.2, 7.7, 2.1), (-10.2, -7.6, 2.0), (-9.0, -7.6, 2.0), (10.2, -7.7, 0.1)]
- The lot slopes 2.1 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248274502` 17 Genesee Street  (commercial): off face `+v`, gap 0.0 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `1090362845`   (commercial): off face `-v`, gap 0.0 m, generic style
- `248274499`   (commercial): off face `+v`, gap 6.8 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_1090362846_+u.png` — face `+u`, 47.3 m out, 117° off head-on, fov 55°, imagery Aug 2025
- `front_1090362846_+u_2.png` — face `+u`, 45.1 m out, 129° off head-on, fov 55°, imagery Aug 2025
- `front_1090362846_-u.png` — face `-u`, 12.0 m out, 14° off head-on, fov 77°, imagery Aug 2025
- `front_1090362846_-u_2.png` — face `-u`, 35.0 m out, 3° off head-on, fov 55°, imagery Aug 2025
- `front_1090362846_+v_2.png` — face `+v`, 39.5 m out, 5° off head-on, fov 55°, imagery ?
- `front_1090362846_-v.png` — face `-v`, 25.9 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_1090362846_-v_2.png` — face `-v`, 40.4 m out, 31° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_1090362846_a.png, sv_1090362846_b.png, sv_1090362846_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911859,-77.746890,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911891,-77.747068,3a,55y,104h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911728,-77.746171,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911695,-77.745993,3a,55y,284h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912034,-77.746449,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912165,-77.746404,3a,55y,194h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911552,-77.746612,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911421,-77.746657,3a,55y,14h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_1090362846.json`; notes: `blueprint_1090362846.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 1090362846` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 1090362846 -u --dist 45 --compare` → `render_1090362846_-u.png` and `compare_1090362846_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=1090362846&focus=1090362846&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
