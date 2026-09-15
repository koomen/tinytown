# Brief — OSM 248251399 — 68 Genesee Street

## Identity
- OSM id `248251399`; address: 68 Genesee Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 1, "roof": "gable", "wall": "#b9a789", "roofColor": "#3b3b3b", "sign": "Community Bank"}
- Earlier research note (from the style pass; verify, do not trust blindly): Community Bank, 68 Genesee St: low 1-storey branch, tan horizontal siding on a red-brick base, dark shingle shallow-gable roof, glass atrium entrance with a tan clock tower at the north end facing the street. Confidence high (SV a/b/c, BBB/cbna.com address).
- Nearby POI: {"id": 12963670238, "kind": "bank", "name": "Community Bank", "x": -58.01, "z": 98.47}

## Frame (blueprint u/v)
- OBB 21.9 m along u × 18.2 m along v; +u bears 14° (NNE), +v bears 104° (ESE). Centroid local (-56, 107) m.
- Road face: **-v** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 14° NNE | 18.2 m | ESE |  |
| `-u` | 194° SSW | 18.2 m | WNW |  |
| `+v` | 104° ESE | 21.9 m | SSW |  |
| `-v` | 284° WNW | 21.9 m | NNE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(10.9, 9.1), (4.3, 9.1), (4.3, 1.7), (-10.9, 1.7), (-10.9, -9.1), (10.9, -9.1)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_248251399.png`).
- Footprint card: `research/card_248251399.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(10.9, 9.1, 0.9), (4.3, 9.1, 0.6), (4.3, 1.7, 0.5), (-10.9, 1.7, 0.1), (-10.9, -9.1, 0.0), (10.9, -9.1, 0.7)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248251398` 78 Genesee Street  (commercial): off face `-u`, gap 4.2 m, generic style

## Photos
- `front_248251399_+u.png` — face `+u`, 10.4 m out, 45° off head-on, fov 80°, imagery Aug 2023
- `front_248251399_+u_2.png` — face `+u`, 38.6 m out, 6° off head-on, fov 55°, imagery Aug 2025
- `front_248251399_-u.png` — face `-u`, 29.9 m out, 8° off head-on, fov 55°, imagery Aug 2021
- `front_248251399_+v.png` — face `+v`, 20.0 m out, 11° off head-on, fov 69°, imagery Aug 2023
- `front_248251399_-v.png` — face `-v`, 18.9 m out, 11° off head-on, fov 72°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248251399_a.png, sv_248251399_b.png, sv_248251399_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911318,-77.746075,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911449,-77.746031,3a,55y,194h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910779,-77.746260,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910649,-77.746305,3a,55y,14h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910985,-77.745821,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910952,-77.745643,3a,55y,284h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911112,-77.746514,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911145,-77.746693,3a,55y,104h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248251399.json`; notes: `blueprint_248251399.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248251399` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248251399 -v --dist 45 --compare` → `render_248251399_-v.png` and `compare_248251399_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248251399&focus=248251399&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
