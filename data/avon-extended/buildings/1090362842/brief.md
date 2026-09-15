# Brief — OSM 1090362842 — no address

## Identity
- OSM id `1090362842`; address: none in OSM; name: none in OSM; tags: {"building": "yes"}
- Current generic style: {"kind": "commercial", "floors": 2, "roof": "gable", "wall": "#a5614b", "roofColor": "#4b4f55", "sign": "AudioNova"}
- Earlier research note (from the style pass; verify, do not trust blindly): 53 Genesee St (AudioNova hearing centre + Hurricane Technologies) - 2-storey colonial-style: red-brick ground floor, grey vinyl upper with white balcony/porch and front gable, white trim. Corner of Park Pl. High confidence: signed '53' and AudioNova in 2842_a.

## Frame (blueprint u/v)
- OBB 13.4 m along u × 25.1 m along v; +u bears 194° (SSW), +v bears 284° (WNW). Centroid local (-100, 63) m.
- Road face: **-v** (Genesee Street). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 194° SSW | 25.1 m | WNW |  |
| `-u` | 14° NNE | 25.1 m | ESE |  |
| `+v` | 284° WNW | 13.4 m | NNE |  |
| `-v` | 104° ESE | 13.4 m | SSW | ROAD SIDE |

- Footprint polygon in (u, v), metres: [(-6.7, 9.2), (-6.7, -12.5), (6.7, -12.5), (6.7, 12.5), (-6.7, 12.5)]  — NOT a rectangle: model the notches/wings as separate volumes (see `card_1090362842.png`).
- Footprint card: `research/card_1090362842.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-6.7, 9.2, 0.6), (-6.7, -12.5, 2.3), (6.7, -12.5, 2.0), (6.7, 12.5, 0.0), (-6.7, 12.5, 0.2)]
- The lot slopes 2.3 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- `1090362843` 43 Genesee Street  (commercial): off face `-u`, gap 0.0 m, generic style
- `1090362841`   (commercial): off face `+u`, gap 2.4 m, generic style
- `1090362844` 39 Genesee Street  (commercial): off face `-u`, gap 6.2 m, HAS a blueprint — match party-wall heights and fill any OSM gap from the taller/earlier one

## Photos
- `front_1090362842_+u.png` — face `+u`, 31.9 m out, 52° off head-on, fov 55°, imagery Aug 2025
- `front_1090362842_+u_2.png` — face `+u`, 38.6 m out, 41° off head-on, fov 55°, imagery Aug 2025
- `front_1090362842_+u_3.png` — face `+u`, 46.6 m out, 32° off head-on, fov 55°, imagery Aug 2025
- `front_1090362842_-u.png` — face `-u`, 33.4 m out, 50° off head-on, fov 55°, imagery Aug 2025
- `front_1090362842_-u_2.png` — face `-u`, 40.7 m out, 40° off head-on, fov 55°, imagery Aug 2025
- `front_1090362842_-u_3.png` — face `-u`, 48.9 m out, 33° off head-on, fov 55°, imagery Aug 2025
- `front_1090362842_+v.png` — face `+v`, 101.2 m out, 1° off head-on, fov 55°, imagery Aug 2025
- `front_1090362842_-v.png` — face `-v`, 12.8 m out, 6° off head-on, fov 67°, imagery Aug 2025
- `front_1090362842_-v_2.png` — face `-v`, 19.7 m out, 34° off head-on, fov 55°, imagery Aug 2025
- Older oblique captures from the style pass: sv_1090362842_a.png, sv_1090362842_b.png, sv_1090362842_c.png (useful for colour and massing, not for bay counts).
- Overhead: `research/overhead_labeled.jpg` (label = last 4 digits of the id) and `satellite.jpg` for roof forms and rear wings.
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.911213,-77.746780,3a,55y,14h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911082,-77.746824,3a,55y,14h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.911679,-77.746622,3a,55y,194h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911809,-77.746578,3a,55y,194h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.911516,-77.747088,3a,55y,104h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911549,-77.747267,3a,55y,104h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.911376,-77.746314,3a,55y,284h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.911343,-77.746135,3a,55y,284h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`. Exemplars: the merged blueprints in `data/avon/overrides.json` → `blueprints` (e.g. `247541316` mixed-use block, `248274499` Wadsworth corner block, `248251396` house with porch, `248290075` church).
- Draft: `data/avon/research/blueprint_1090362842.json`; notes: `blueprint_1090362842.notes.md`. Touch nothing else in the repo.
- Lint: `python3 pipeline/lint_blueprint.py data/avon 1090362842` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `uv run pipeline/render_bp.py data/avon 1090362842 -v --dist 45 --compare` → `render_1090362842_-v.png` and `compare_1090362842_-v.png` (photo beside render). Other faces: `-u`, `+v`, …; `--iso` for the diorama camera; `--with <id,id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon&free=1&bp=1090362842&focus=1090362842&side=-v&dist=45&notrees=1`
- Do NOT run merge_blueprints.py yourself; the coordinator merges finished drafts.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Pick the 3–5 features that make the building recognizable and exaggerate them a little; fewer, larger windows than reality but the same rhythm.
3. Write the draft, lint, render the road face with `--compare`, look at the compare image, fix, repeat. Then check the other faces once.
4. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, What was modelled/exaggerated, Approximations / schema gaps, Confidence.
