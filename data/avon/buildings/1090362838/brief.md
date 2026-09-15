# Brief — OSM 1090362838 — no address

## Identity
- OSM id `1090362838`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "flat", "wall": "#a86b4d", "roofColor": "tar", "sign": "Edward Jones"}
- Earlier research note (from the style pass; verify, do not trust blindly): Edward Jones office (87 Genesee) - 2-storey flat-roof corner building, red-brick ground floor with white-trimmed shop windows, tan clapboard upper with green shutters; buff-brick side wall facing the pocket park. High confidence: 'Jones Investments' sign in 2838_a/c, address confirmed by Yelp/chamber.

## Frame (blueprint u/v)
- OBB 13.9 m along u × 19.9 m along v; +u bears 196° (SSW), +v bears 286° (WNW). Centroid local (-112, 124) m.
- Road face: **-v** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 196° SSW | 19.9 m | WNW |  |
| `-u` | 16° NNE | 19.9 m | ESE |  |
| `+v` | 286° WNW | 13.9 m | NNE |  |
| `-v` | 106° ESE | 13.9 m | SSW | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(-6.9, 10.0), (-7.0, -10.0), (6.9, -10.0), (6.7, 10.0)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_1090362838.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-6.9, 10.0, 0.9), (-7.0, -10.0, 1.4), (6.9, -10.0, 1.0), (6.7, 10.0, 0.0)]
- The lot slopes 1.4 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248274518`   (pavilion): off face `+u`, gap 1.2 m, generic style
- `1090362839`   (house): off face `-u`, gap 3.3 m, generic style

## Photos
- `front_1090362838_+u.png` — face `+u`, 27.1 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `front_1090362838_+u_2.png` — face `+u`, 34.0 m out, 41° off head-on, fov 55°, imagery Aug 2025
- `front_1090362838_+u_3.png` — face `+u`, 42.3 m out, 32° off head-on, fov 55°, imagery Aug 2025
- `front_1090362838_-u.png` — face `-u`, 29.8 m out, 46° off head-on, fov 55°, imagery Aug 2025
- `front_1090362838_-u_2.png` — face `-u`, 37.1 m out, 35° off head-on, fov 55°, imagery Aug 2025
- `front_1090362838_+v.png` — face `+v`, 32.0 m out, 175° off head-on, fov 55°, imagery Aug 2025
- `front_1090362838_-v.png` — face `-v`, 12.2 m out, 12° off head-on, fov 71°, imagery Aug 2025
- `front_1090362838_-v_2.png` — face `-v`, 27.7 m out, 18° off head-on, fov 55°, imagery Aug 2021
- Older oblique captures from the style pass: sv_1090362838_a.png, sv_1090362838_b.png, sv_1090362838_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910659,-77.746944,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910529,-77.746994,3a,55y,16h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911125,-77.746764,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911255,-77.746714,3a,55y,196h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910965,-77.747208,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911002,-77.747385,3a,55y,106h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910819,-77.746500,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910782,-77.746323,3a,55y,286h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_1090362838.json`; notes: `blueprint_1090362838.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 1090362838` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 1090362838 -v --dist 45 --compare` → `render_1090362838_-v.png` and `compare_1090362838_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=1090362838&focus=1090362838&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
