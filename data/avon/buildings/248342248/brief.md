# Brief — OSM 248342248 — no address

## Identity
- OSM id `248342248`; address: none in OSM; name: none in OSM; tags: {"building": "garage"}
- Current generic style: {"kind": "garage", "floors": 1, "roof": "gable", "wall": "white", "roofColor": "grey"}

## Frame (blueprint u/v)
- OBB 11.1 m along u × 7.1 m along v; +u bears 286° (WNW), +v bears 16° (NNE). Centroid local (184, -68) m.
- Road face: **+u** (North Avenue). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 286° WNW | 7.1 m | NNE | ROAD SIDE |
| `-u` | 106° ESE | 7.1 m | SSW |  |
| `+v` | 16° NNE | 11.1 m | ESE |  |
| `-v` | 196° SSW | 11.1 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-5.5, 3.5), (-5.5, -3.5), (5.5, -3.5), (5.5, 3.5)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248342248.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-5.5, 3.5, 0.3), (-5.5, -3.5, 0.5), (5.5, -3.5, 0.2), (5.5, 3.5, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248342249` 38 North Avenue  (house): off face `+u`, gap 1.9 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248342248_+u.png` — face `+u`, 43.5 m out, 5° off head-on, fov 55°, imagery Aug 2025
- `front_248342248_-u.png` — face `-u`, 54.8 m out, 174° off head-on, fov 55°, imagery Aug 2025
- `front_248342248_+v.png` — face `+v`, 50.1 m out, 78° off head-on, fov 55°, imagery Aug 2025
- `front_248342248_+v_2.png` — face `+v`, 53.3 m out, 67° off head-on, fov 55°, imagery Aug 2025
- `front_248342248_+v_3.png` — face `+v`, 58.2 m out, 58° off head-on, fov 55°, imagery Aug 2025
- `front_248342248_-v.png` — face `-v`, 50.5 m out, 76° off head-on, fov 55°, imagery Aug 2025
- `front_248342248_-v_2.png` — face `-v`, 53.8 m out, 66° off head-on, fov 55°, imagery Aug 2025
- `front_248342248_-v_3.png` — face `-v`, 58.6 m out, 57° off head-on, fov 55°, imagery Aug 2025
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912678,-77.743526,3a,55y,106h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912715,-77.743703,3a,55y,106h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912555,-77.742922,3a,55y,286h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912519,-77.742745,3a,55y,286h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912820,-77.743146,3a,55y,196h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912950,-77.743097,3a,55y,196h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912413,-77.743302,3a,55y,16h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912283,-77.743351,3a,55y,16h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248342248.json`; notes: `blueprint_248342248.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248342248` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248342248 +u --dist 45 --compare` → `render_248342248_+u.png` and `compare_248342248_+u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248342248&focus=248342248&side=+u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
