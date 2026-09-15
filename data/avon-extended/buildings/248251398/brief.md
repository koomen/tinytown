# Brief — OSM 248251398 — 78 Genesee Street

## Identity
- OSM id `248251398`; address: 78 Genesee Street; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "hip", "wall": "#9a5a48", "roofColor": "#2e2e2e", "sign": "Coyne Econ-O-Wash"}
- Earlier research note (from the style pass; verify, do not trust blindly): Coyne Econ-O-Wash (laundromat), 78 Genesee St: tall 2-storey white clapboard Italianate/Second Empire block with pediment cornice and black mansard roof (modelled as steep capped hip), red-brick storefront base with large windows. Confidence med-high: SV clearly shows it immediately south of the bank; Chamber directory lists the business (address there is garbled), OSM gives 78.

## Frame (blueprint u/v)
- OBB 26.6 m along u × 9.5 m along v; +u bears 105° (ESE), +v bears 195° (SSW). Centroid local (-56, 128) m.
- Road face: **-u** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 105° ESE | 9.5 m | SSW |  |
| `-u` | 285° WNW | 9.5 m | NNE | ROAD SIDE |
| `+v` | 195° SSW | 26.6 m | WNW |  |
| `-v` | 15° NNE | 26.6 m | ESE |  |

- Footprint polygon in (u, v), metres: [(13.3, -4.7), (13.3, 4.7), (-13.3, 4.7), (-13.3, -4.7)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248251398.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(13.3, -4.7, 0.3), (13.3, 4.7, 0.4), (-13.3, 4.7, 0.0), (-13.3, -4.7, 0.1)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248251397` 90 Genesee Street  (commercial): off face `+v`, gap 0.3 m, generic style
- `248251399` 68 Genesee Street  (commercial): off face `-v`, gap 4.2 m, generic style

## Photos
- `front_248251398_+u.png` — face `+u`, 16.1 m out, 16° off head-on, fov 55°, imagery Aug 2023
- `front_248251398_+u_2.png` — face `+u`, 17.1 m out, 18° off head-on, fov 55°, imagery Aug 2023
- `front_248251398_-u.png` — face `-u`, 20.0 m out, 12° off head-on, fov 55°, imagery Aug 2025
- `front_248251398_+v.png` — face `+v`, 15.9 m out, 2° off head-on, fov 80°, imagery Aug 2021
- `front_248251398_+v_2.png` — face `+v`, 40.6 m out, 5° off head-on, fov 55°, imagery Aug 2021
- `front_248251398_-v.png` — face `-v`, 29.8 m out, 2° off head-on, fov 60°, imagery Aug 2023
- Older oblique captures from the style pass: sv_248251398_a.png, sv_248251398_b.png, sv_248251398_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910789,-77.745774,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910755,-77.745596,3a,55y,285h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910940,-77.746564,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910974,-77.746742,3a,55y,105h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910649,-77.746245,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910519,-77.746292,3a,55y,15h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911079,-77.746092,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911210,-77.746046,3a,55y,195h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248251398.json`; notes: `blueprint_248251398.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248251398` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248251398 -u --dist 45 --compare` → `render_248251398_-u.png` and `compare_248251398_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248251398&focus=248251398&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
