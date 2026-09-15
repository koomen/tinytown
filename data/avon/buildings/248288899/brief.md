# Brief — OSM 248288899 — no address

## Identity
- OSM id `248288899`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 13.1 m along u × 10.2 m along v; +u bears 287° (WNW), +v bears 17° (NNE). Centroid local (98, 169) m.
- Road face: **-u** (Temple Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 287° WNW | 10.2 m | NNE |  |
| `-u` | 107° ESE | 10.2 m | SSW | ROAD SIDE |
| `+v` | 17° NNE | 13.1 m | ESE |  |
| `-v` | 197° SSW | 13.1 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-6.6, 5.1), (-6.6, -5.1), (6.6, -5.1), (6.6, 5.1)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248288899.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-6.6, 5.1, 0.4), (-6.6, -5.1, 0.2), (6.6, -5.1, 0.1), (6.6, 5.1, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248288898`   (garage): off face `-v`, gap 2.1 m, generic style
- `248288900` 35 Temple Street  (house): off face `+v`, gap 6.7 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248288899_+u.png` — face `+u`, 25.4 m out, 173° off head-on, fov 55°, imagery Aug 2025
- `front_248288899_+u_2.png` — face `+u`, 29.7 m out, 145° off head-on, fov 55°, imagery Aug 2025
- `front_248288899_-u.png` — face `-u`, 12.4 m out, 15° off head-on, fov 58°, imagery ?
- `front_248288899_+v.png` — face `+v`, 21.4 m out, 57° off head-on, fov 55°, imagery ?
- `front_248288899_+v_2.png` — face `+v`, 28.1 m out, 39° off head-on, fov 55°, imagery ?
- `front_248288899_+v_3.png` — face `+v`, 36.4 m out, 28° off head-on, fov 55°, imagery ?
- `front_248288899_-v.png` — face `-v`, 35.2 m out, 37° off head-on, fov 55°, imagery ?
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910557,-77.744594,3a,55y,107h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910596,-77.744770,3a,55y,107h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910420,-77.743970,3a,55y,287h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910381,-77.743794,3a,55y,287h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910705,-77.744194,3a,55y,197h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910834,-77.744141,3a,55y,197h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910273,-77.744371,3a,55y,17h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910144,-77.744424,3a,55y,17h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248288899.json`; notes: `blueprint_248288899.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248288899` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248288899 -u --dist 45 --compare` → `render_248288899_-u.png` and `compare_248288899_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248288899&focus=248288899&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
