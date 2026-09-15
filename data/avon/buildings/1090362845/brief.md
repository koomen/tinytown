# Brief — OSM 1090362845 — no address

## Identity
- OSM id `1090362845`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "#c3b18d", "roofColor": "tar", "sign": "Pure Body Day Spa"}
- Earlier research note (from the style pass; verify, do not trust blindly): Two joined 2-storey flat-roof buildings: former State Bank of Avon (buff limestone/brick, arched windows, engraved name) on the north half and Pure Body Day Spa (31 Genesee, white-painted brick, navy awning) on the south half. Style blends the bank's buff wall with the spa's navy awning and sign. Med-high confidence (photos clear; split of 14 m footprint inferred).
- Nearby POI: {"id": 3234371976, "kind": "courthouse", "name": "Avon Town and Village Court", "x": -80.71, "z": 29.3}

## Frame (blueprint u/v)
- OBB 14.1 m along u × 28.7 m along v; +u bears 14° (NNE), +v bears 104° (ESE). Centroid local (-94, 37) m.
- Road face: **+v** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 14° NNE | 28.7 m | ESE |  |
| `-u` | 194° SSW | 28.7 m | WNW |  |
| `+v` | 104° ESE | 14.1 m | SSW | ROAD SIDE |
| `-v` | 284° WNW | 14.1 m | NNE |  |

- Footprint polygon in (u, v), metres: [(-7.0, 14.4), (-7.0, 13.7), (-7.0, -10.4), (-7.0, -14.4), (7.0, -14.4), (7.0, -4.9), (7.0, 14.4)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_1090362845.png`).
- Footprint card: `research/card_1090362845.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-7.0, 14.4, 2.5), (-7.0, 13.7, 2.5), (-7.0, -10.4, 0.3), (-7.0, -14.4, 0.0), (7.0, -14.4, 0.0), (7.0, -4.9, 0.7), (7.0, 14.4, 2.6)]
- The lot slopes 2.6 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `1090362844` 39 Genesee Street  (commercial): off face `-u`, gap 0.0 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `1090362846` 23 Genesee Street Avon Town Hall (commercial): off face `+u`, gap 0.0 m, generic style
- `1090362843` 43 Genesee Street  (commercial): off face `-u`, gap 6.2 m, generic style

## Photos
- `front_1090362845_+u.png` — face `+u`, 52.6 m out, 18° off head-on, fov 55°, imagery Aug 2025
- `front_1090362845_+u_2.png` — face `+u`, 55.3 m out, 9° off head-on, fov 55°, imagery Aug 2025
- `front_1090362845_-u.png` — face `-u`, 36.6 m out, 46° off head-on, fov 55°, imagery Aug 2025
- `front_1090362845_-u_2.png` — face `-u`, 52.5 m out, 30° off head-on, fov 55°, imagery Aug 2025
- `front_1090362845_+v.png` — face `+v`, 12.5 m out, 9° off head-on, fov 71°, imagery Aug 2025
- `front_1090362845_+v_2.png` — face `+v`, 36.7 m out, 15° off head-on, fov 55°, imagery Aug 2025
- face `-v`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- Older oblique captures from the style pass: sv_1090362845_a.png, sv_1090362845_b.png, sv_1090362845_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911912,-77.746557,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912043,-77.746513,3a,55y,194h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911441,-77.746717,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911310,-77.746762,3a,55y,14h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911602,-77.746228,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911570,-77.746050,3a,55y,284h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911751,-77.747046,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911784,-77.747225,3a,55y,104h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_1090362845.json`; notes: `blueprint_1090362845.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 1090362845` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 1090362845 +v --dist 45 --compare` → `render_1090362845_+v.png` and `compare_1090362845_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=1090362845&focus=1090362845&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
