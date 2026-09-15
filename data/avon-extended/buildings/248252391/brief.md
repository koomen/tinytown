# Brief — OSM 248252391 — no address

## Identity
- OSM id `248252391`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "#e6e3d6", "roofColor": "#3b3b3b"}
- Earlier research note (from the style pass; verify, do not trust blindly): House on south side of W Main opposite 46 W Main: cream/white clapboard Victorian, front gable with gingerbread trim, 2 storeys, dark-grey roof, ornate white porch. Plain residence. Confidence med-high (sv_2391_a centered at bearing 216).

## Frame (blueprint u/v)
- OBB 9.5 m along u × 17.2 m along v; +u bears 129° (SE), +v bears 219° (SW). Centroid local (-142, -37) m.
- Road face: **-v** (West Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 129° SE | 17.2 m | SW |  |
| `-u` | 309° NW | 17.2 m | NE |  |
| `+v` | 219° SW | 9.5 m | NW |  |
| `-v` | 39° NE | 9.5 m | SE | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(4.8, -8.6), (4.8, 8.6), (-4.8, 8.6), (-4.8, -8.6)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252391.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(4.8, -8.6, 1.9), (4.8, 8.6, 1.1), (-4.8, 8.6, 0.0), (-4.8, -8.6, 0.8)]
- The lot slopes 1.9 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248252384` 51 West Main Street  (house): off face `-u`, gap 3.9 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one
- `248252394`   (commercial): off face `+u`, gap 4.1 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_248252391_+u.png` — face `+u`, 31.9 m out, 67° off head-on, fov 55°, imagery Aug 2025
- `front_248252391_+u_2.png` — face `+u`, 37.2 m out, 53° off head-on, fov 55°, imagery Aug 2025
- `front_248252391_+u_3.png` — face `+u`, 44.1 m out, 43° off head-on, fov 55°, imagery Aug 2025
- `front_248252391_-u.png` — face `-u`, 36.4 m out, 12° off head-on, fov 55°, imagery Aug 2025
- `front_248252391_-u_2.png` — face `-u`, 37.9 m out, 2° off head-on, fov 55°, imagery Aug 2025
- `front_248252391_+v.png` — face `+v`, 41.0 m out, 52° off head-on, fov 55°, imagery Aug 2025
- `front_248252391_+v_2.png` — face `+v`, 45.1 m out, 40° off head-on, fov 55°, imagery Aug 2025
- `front_248252391_-v.png` — face `-v`, 20.3 m out, 7° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248252391_a.png, sv_248252391_b.png, sv_248252391_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912202,-77.746982,3a,55y,309h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912117,-77.746839,3a,55y,309h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912482,-77.747454,3a,55y,129h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912567,-77.747597,3a,55y,129h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912142,-77.747439,3a,55y,39h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912037,-77.747555,3a,55y,39h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912542,-77.746997,3a,55y,219h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912646,-77.746881,3a,55y,219h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252391.json`; notes: `blueprint_248252391.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252391` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252391 -v --dist 45 --compare` → `render_248252391_-v.png` and `compare_248252391_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252391&focus=248252391&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
