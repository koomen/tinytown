# Brief — OSM 248251392 — 121 Genesee Street

## Identity
- OSM id `248251392`; address: 121 Genesee Street; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "paleblue", "roofColor": "auto"}

## Frame (blueprint u/v)
- OBB 11.2 m along u × 18.9 m along v; +u bears 194° (SSW), +v bears 284° (WNW). Centroid local (-131, 183) m.
- Road face: **-v** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 194° SSW | 18.9 m | WNW |  |
| `-u` | 14° NNE | 18.9 m | ESE |  |
| `+v` | 284° WNW | 11.2 m | NNE |  |
| `-v` | 104° ESE | 11.2 m | SSW | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(-5.6, -9.4), (5.6, -9.4), (5.6, 9.4), (-5.6, 9.4)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248251392.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-5.6, -9.4, 0.2), (5.6, -9.4, 0.1), (5.6, 9.4, 0.0), (-5.6, 9.4, 0.0)]
- Flat lot (under 1 m across the footprint).

## Neighbours (within 10 m)
- `248251393` 119 Genesee Street  (house): off face `-u`, gap 6.4 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248251392_+u.png` — face `+u`, 30.7 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248251392_+u_2.png` — face `+u`, 37.1 m out, 44° off head-on, fov 55°, imagery Aug 2025
- face `-u`: no Street View coverage; infer it from the overhead/oblique views and keep it plain.
- `front_248251392_+v.png` — face `+v`, 35.2 m out, 177° off head-on, fov 55°, imagery ?
- `front_248251392_-v.png` — face `-v`, 29.2 m out, 13° off head-on, fov 55°, imagery ?
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.910143,-77.747166,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910012,-77.747210,3a,55y,14h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.910589,-77.747017,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910720,-77.746974,3a,55y,194h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.910428,-77.747442,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910460,-77.747621,3a,55y,104h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.910303,-77.746741,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.910271,-77.746562,3a,55y,284h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248251392.json`; notes: `blueprint_248251392.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248251392` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248251392 -v --dist 45 --compare` → `render_248251392_-v.png` and `compare_248251392_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248251392&focus=248251392&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
