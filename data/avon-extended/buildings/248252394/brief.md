# Brief — OSM 248252394 — no address

## Identity
- OSM id `248252394`; address: none in OSM; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "gable", "wall": "#d6cba6", "roofColor": "slate", "sign": "Rivoli Dental"}
- Earlier research note (from the style pass; verify, do not trust blindly): 37/39 W Main St (Rivoli Dental): 2-storey tan/khaki clapboard Victorian with dark maroon trim, front-gable end to the street, full-width two-level porch and balcony with wooden balustrade, big shop-style ground-floor window, stone porch base, long white rear addition; banner reads 'RIVOLI'. Confidence high on appearance, medium on address (Yelp lists Rivoli Dental at 39 W Main). Based on sv_248252394_a/b, sv_248252397_c + web.

## Frame (blueprint u/v)
- OBB 28.9 m along u × 10.9 m along v; +u bears 217° (SW), +v bears 307° (NW). Centroid local (-129, -29) m.
- Road face: **-u** (West Main Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 217° SW | 10.9 m | NW |  |
| `-u` | 37° NE | 10.9 m | SE | ROAD SIDE |
| `+v` | 307° NW | 28.9 m | NE |  |
| `-v` | 127° SE | 28.9 m | SW |  |

- Footprint polygon in (u, v), metres: [(-14.4, -5.5), (14.4, -5.5), (14.4, 5.5), (-14.4, 5.5)]  — a plain rectangle; volumes can just span the OBB.
- Footprint card: `research/card_248252394.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-14.4, -5.5, 2.0), (14.4, -5.5, 1.4), (14.4, 5.5, 0.0), (-14.4, 5.5, 0.8)]
- The lot slopes 2.0 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `248252391`   (house): off face `+v`, gap 4.1 m, generic style
- `248252397` 29 West Main Street  (house): off face `-v`, gap 6.2 m, generic style

## Photos
- `front_248252394_+u.png` — face `+u`, 53.4 m out, 57° off head-on, fov 55°, imagery Aug 2025
- `front_248252394_+u_2.png` — face `+u`, 56.6 m out, 48° off head-on, fov 55°, imagery Aug 2025
- `front_248252394_-u.png` — face `-u`, 13.7 m out, 15° off head-on, fov 55°, imagery Aug 2025
- `front_248252394_+v.png` — face `+v`, 50.2 m out, 8° off head-on, fov 55°, imagery Aug 2025
- `front_248252394_+v_2.png` — face `+v`, 51.7 m out, 2° off head-on, fov 55°, imagery Aug 2025
- `front_248252394_-v.png` — face `-v`, 39.5 m out, 46° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_248252394_a.png, sv_248252394_b.png, sv_248252394_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.912025,-77.747323,3a,55y,37h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911917,-77.747434,3a,55y,37h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.912517,-77.746812,3a,55y,217h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912625,-77.746701,3a,55y,217h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.912409,-77.747316,3a,55y,127h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912491,-77.747463,3a,55y,127h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.912133,-77.746819,3a,55y,307h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.912051,-77.746672,3a,55y,307h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_248252394.json`; notes: `blueprint_248252394.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 248252394` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 248252394 -u --dist 45 --compare` → `render_248252394_-u.png` and `compare_248252394_-u.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=248252394&focus=248252394&side=-u&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
