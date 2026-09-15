# Brief — OSM 247541851 — 40 East Main Street

## Identity
- OSM id `247541851`; address: 40 East Main Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "white", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 18.5 m along u × 17.0 m along v; +u bears 195° (SSW), +v bears 285° (WNW). Centroid local (141, 5) m.
- Road face: **+v** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 195° SSW | 17.0 m | WNW |  |
| `-u` | 15° NNE | 17.0 m | ESE |  |
| `+v` | 285° WNW | 18.5 m | NNE | ROAD SIDE |
| `-v` | 105° ESE | 18.5 m | SSW |  |

- Footprint polygon in (u, v), metres: [(-9.3, -8.5), (9.3, -8.5), (9.3, 8.5), (-9.3, 8.5)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_247541851.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-9.3, -8.5, 0.6), (9.3, -8.5, 0.9), (9.3, 8.5, 0.4), (-9.3, 8.5, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- none

## Photos
- `front_247541851_+u.png` — face `+u`, 17.9 m out, 3° off head-on, fov 63°, imagery Sep 2025
- `front_247541851_-u.png` — face `-u`, 31.8 m out, 58° off head-on, fov 55°, imagery Aug 2025
- `front_247541851_-u_2.png` — face `-u`, 37.7 m out, 45° off head-on, fov 55°, imagery Aug 2025
- `front_247541851_+v.png` — face `+v`, 20.6 m out, 19° off head-on, fov 60°, imagery Aug 2025
- `front_247541851_+v_2.png` — face `+v`, 21.2 m out, 19° off head-on, fov 59°, imagery Aug 2025
- `front_247541851_-v.png` — face `-v`, 34.0 m out, 53° off head-on, fov 55°, imagery Sep 2025
- `front_247541851_-v_2.png` — face `-v`, 40.9 m out, 42° off head-on, fov 55°, imagery Sep 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911715,-77.743848,3a,55y,15h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911585,-77.743895,3a,55y,15h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912223,-77.743662,3a,55y,195h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912353,-77.743615,3a,55y,195h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912035,-77.744093,3a,55y,105h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912070,-77.744270,3a,55y,105h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911903,-77.743417,3a,55y,285h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911868,-77.743239,3a,55y,285h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_247541851.json`; notes: `blueprint_247541851.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 247541851` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 247541851 +v --dist 45 --compare` → `render_247541851_+v.png` and `compare_247541851_+v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=247541851&focus=247541851&side=+v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
