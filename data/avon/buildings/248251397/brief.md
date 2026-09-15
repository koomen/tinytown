# Brief — OSM 248251397 — 90 Genesee Street

## Identity
- OSM id `248251397`; address: 90 Genesee Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "#ececea", "roofColor": "tar", "sign": "T's On Genesee"}
- Earlier research note (from the style pass; verify, do not trust blindly): T's On Genesee Market & Deli, 90 Genesee St: 2-storey white clapboard commercial block with sage-green window trim, flat roof with bracketed cornice, storefront with red umbrellas/red accents. Confidence high (SV a/b/c head-on from 87 Genesee viewpoint; Yelp/iloveny confirm 90 Genesee).

## Frame (blueprint u/v)
- OBB 25.4 m along u × 9.4 m along v; +u bears 285° (WNW), +v bears 15° (NNE). Centroid local (-60, 137) m.
- Road face: **+u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 285° WNW | 9.4 m | NNE | ROAD SIDE |
| `-u` | 105° ESE | 9.4 m | SSW |  |
| `+v` | 15° NNE | 25.4 m | ESE |  |
| `-v` | 195° SSW | 25.4 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-12.7, 4.7), (-12.7, -4.7), (12.7, -4.7), (12.7, 4.7)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248251397.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-12.7, 4.7, 0.8), (-12.7, -4.7, 0.4), (12.7, -4.7, 0.0), (12.7, 4.7, 0.5)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248251398` 78 Genesee Street  (commercial): off face `+v`, gap 0.3 m, generic style
- `248251394` 102 Genesee Street  (house): off face `-v`, gap 8.4 m, generic style

## Photos
- `front_248251397_+u.png` — face `+u`, 19.0 m out, 14° off head-on, fov 55°, imagery Aug 2025
- `front_248251397_-u.png` — face `-u`, 19.2 m out, 14° off head-on, fov 55°, imagery Aug 2023
- `front_248251397_-u_2.png` — face `-u`, 20.3 m out, 17° off head-on, fov 55°, imagery Aug 2023
- `front_248251397_+v.png` — face `+v`, 34.5 m out, 20° off head-on, fov 55°, imagery Aug 2021
- `front_248251397_+v_2.png` — face `+v`, 39.8 m out, 4° off head-on, fov 55°, imagery Aug 2023
- `front_248251397_-v.png` — face `-v`, 31.0 m out, 8° off head-on, fov 57°, imagery Aug 2021
- Older oblique captures from the style pass: sv_248251397_a.png, sv_248251397_b.png, sv_248251397_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910859,-77.746608,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910894,-77.746785,3a,55y,105h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910706,-77.745833,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910671,-77.745656,3a,55y,285h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910997,-77.746142,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911127,-77.746094,3a,55y,195h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910568,-77.746299,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910438,-77.746347,3a,55y,15h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248251397.json`; notes: `blueprint_248251397.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248251397` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248251397 +u --dist 45 --compare` → `render_248251397_+u.png` and `compare_248251397_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248251397&focus=248251397&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
