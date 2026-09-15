# Brief — OSM 248274518 — no address

## Identity
- OSM id `248274518`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "pavilion", "floors": 1, "roof": "gable", "wall": "#c9a878", "roofColor": "#4a3a30", "sign": "Avon Farmers Market"}
- Earlier research note (from the style pass; verify, do not trust blindly): Avon Farmers Market pavilion, Pocket Park at 97 Genesee - open timber post-and-beam gable pavilion with dark brown metal roof, black iron fence, banner 'Avon Farmers Market'. High confidence: 248274518_a shows it centred with banner.

## Frame (blueprint u/v)
- OBB 11.7 m along u × 9.9 m along v; +u bears 103° (ESE), +v bears 193° (SSW). Centroid local (-112, 138) m.
- Road face: **+u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 103° ESE | 9.9 m | SSW | ROAD SIDE |
| `-u` | 283° WNW | 9.9 m | NNE |  |
| `+v` | 193° SSW | 11.7 m | WNW |  |
| `-v` | 13° NNE | 11.7 m | ESE |  |

- Footprint polygon in (u, v), metres: [(5.9, -5.0), (5.9, 5.0), (-5.9, 5.0), (-5.9, -5.0)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248274518.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(5.9, -5.0, 0.4), (5.9, 5.0, 0.2), (-5.9, 5.0, 0.0), (-5.9, -5.0, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `1090362838`   (commercial): off face `-v`, gap 1.2 m, generic style

## Photos
- `front_248274518_+u.png` — face `+u`, 12.1 m out, 0° off head-on, fov 56°, imagery Aug 2025
- `front_248274518_+u_2.png` — face `+u`, 26.8 m out, 7° off head-on, fov 55°, imagery Aug 2021
- `front_248274518_-u.png` — face `-u`, 23.9 m out, 180° off head-on, fov 55°, imagery Aug 2025
- `front_248274518_+v.png` — face `+v`, 30.5 m out, 34° off head-on, fov 55°, imagery Aug 2025
- `front_248274518_-v.png` — face `-v`, 24.0 m out, 51° off head-on, fov 55°, imagery Aug 2025
- `front_248274518_-v_2.png` — face `-v`, 31.6 m out, 37° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248274518_a.png, sv_248274518_b.png, sv_248274518_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910714,-77.746542,3a,55y,283h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910683,-77.746363,3a,55y,283h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910819,-77.747160,3a,55y,103h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910850,-77.747339,3a,55y,103h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910548,-77.746920,3a,55y,13h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910417,-77.746962,3a,55y,13h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910985,-77.746781,3a,55y,193h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911116,-77.746740,3a,55y,193h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248274518.json`; notes: `blueprint_248274518.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248274518` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248274518 +u --dist 45 --compare` → `render_248274518_+u.png` and `compare_248274518_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248274518&focus=248274518&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
