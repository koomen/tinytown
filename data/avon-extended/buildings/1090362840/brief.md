# Brief — OSM 1090362840 — no address

## Identity
- OSM id `1090362840`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "#d2bd8b", "roofColor": "tar", "sign": "Park Theater"}
- Earlier research note (from the style pass; verify, do not trust blindly): Avon Park Theater (71 Genesee, 1938) - wide 2-storey buff/yellow brick Art-Deco-ish block, PARK marquee, vertical pylon, black-and-white striped awnings on both flanking storefronts. The big footprint also seems to absorb Avon Floral World (63, white clapboard gable) at its north end; theatre chosen as dominant. High confidence on theatre, med on footprint merge.
- Nearby POI: {"id": 11155436521, "kind": "florist", "name": "Avon Floral World, Gift Shoppe & Flower Delivery", "x": -105.98, "z": 85.68}

## Frame (blueprint u/v)
- OBB 32.6 m along u × 26.3 m along v; +u bears 104° (ESE), +v bears 194° (SSW). Centroid local (-113, 91) m.
- Road face: **+u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 104° ESE | 26.3 m | SSW | ROAD SIDE |
| `-u` | 284° WNW | 26.3 m | NNE |  |
| `+v` | 194° SSW | 32.6 m | WNW |  |
| `-v` | 14° NNE | 32.6 m | ESE |  |

- Footprint polygon in (u, v), metres: [(-13.6, -13.1), (16.3, -13.1), (16.3, 13.1), (-9.0, 13.1), (-13.7, 13.1), (-13.7, 10.3), (-16.3, 10.3), (-16.3, 1.6), (-13.7, 1.6), (-13.6, -0.8), (1.8, -0.8), (1.8, -9.8), (-13.6, -9.9)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_1090362840.png`).
- Footprint card: `research/card_1090362840.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-13.6, -13.1, 0.7), (16.3, -13.1, 2.9), (16.3, 13.1, 2.1), (-9.0, 13.1, 0.2), (-13.7, 13.1, 0.1), (-13.7, 10.3, 0.1), (-16.3, 10.3, 0.0), (-16.3, 1.6, 0.1), (-13.7, 1.6, 0.2), (-13.6, -0.8, 0.2), (1.8, -0.8, 1.7), (1.8, -9.8, 1.7), (-13.6, -9.9, 0.6)]
- The lot slopes 2.9 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `1090362839`   (house): off face `+v`, gap 0.0 m, generic style
- `1090362841`   (commercial): off face `-v`, gap 1.0 m, generic style
- `249550114`   (house): off face `-u`, gap 9.0 m, generic style

## Photos
- `front_1090362840_+u.png` — face `+u`, 15.5 m out, 17° off head-on, fov 80°, imagery Aug 2025
- `front_1090362840_+u_2.png` — face `+u`, 58.3 m out, 5° off head-on, fov 55°, imagery Aug 2021
- `front_1090362840_-u.png` — face `-u`, 97.2 m out, 19° off head-on, fov 55°, imagery ?
- `front_1090362840_+v.png` — face `+v`, 44.1 m out, 43° off head-on, fov 55°, imagery Aug 2025
- `front_1090362840_+v_2.png` — face `+v`, 60.2 m out, 30° off head-on, fov 55°, imagery Aug 2025
- `front_1090362840_-v.png` — face `-v`, 47.7 m out, 41° off head-on, fov 55°, imagery Aug 2025
- `front_1090362840_-v_2.png` — face `-v`, 64.1 m out, 30° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_1090362840_a.png, sv_1090362840_b.png, sv_1090362840_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911111,-77.746430,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911078,-77.746251,3a,55y,284h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911269,-77.747293,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911302,-77.747472,3a,55y,104h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910901,-77.746960,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910770,-77.747005,3a,55y,14h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911479,-77.746763,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911609,-77.746718,3a,55y,194h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_1090362840.json`; notes: `blueprint_1090362840.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 1090362840` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 1090362840 +u --dist 45 --compare` → `render_1090362840_+u.png` and `compare_1090362840_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=1090362840&focus=1090362840&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
