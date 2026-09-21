# Brief — OSM 248688344 — 290 North Avenue

## Identity
- OSM id `248688344`; address: 290 North Avenue; name: none in OSM; tags: {"building": "house"}
- Current generic style: {"kind": "house", "floors": 2, "roof": "gable", "wall": "tan", "roofColor": "auto"}
- **A blueprint already exists** in overrides.json; you are refining it. Start from `data/avon-extended/buildings/248688344/draft.json` if present, else copy it out of overrides.json.

## Frame (blueprint u/v)
- OBB 12.3 m along u × 18.3 m along v; +u bears 283° (WNW), +v bears 13° (NNE). Centroid local (363, -827) m.
- Road face: **+v** (D'Angelo Parkway). Faces are named by outward normal; fractions along a face run 0→1 from the LEFT end as seen from outside.

| face | looks toward | width | left end lies toward | note |
|---|---|---|---|---|
| `+u` | 283° WNW | 18.3 m | NNE |  |
| `-u` | 103° ESE | 18.3 m | SSW |  |
| `+v` | 13° NNE | 12.3 m | ESE | ROAD SIDE |
| `-v` | 193° SSW | 12.3 m | WNW |  |

- Footprint polygon in (u, v), metres: [(-6.2, -9.1), (6.2, -9.2), (6.2, 0.5), (3.5, 0.5), (3.5, 9.1), (-6.2, 9.1)]  — NOT a rectangle: model the notches/wings as separate volumes (see `footprint.png`).
- Footprint card: `data/avon-extended/buildings/248688344/footprint.png` (blue box = OBB, numbers = polygon vertices).

## Terrain
- Ground at the polygon corners (u, v, metres above the lowest corner): [(-6.2, -9.1, 1.3), (6.2, -9.2, 0.2), (6.2, 0.5, 0.0), (3.5, 0.5, 0.2), (3.5, 9.1, 0.0), (-6.2, 9.1, 0.9)]
- The lot slopes 1.3 m across the footprint. The renderer sets the floor at street level along the road face and carries the rest on a foundation, so do NOT add a plinth to compensate; model the exposed basement on the downhill side only if the photos show one.

## Neighbours (within 10 m)
- none

## Photos
- Photo paths below are relative to `data/avon-extended/buildings/248688344/`.
- WARNING: these captures were taken against an older footprint; camera metadata is untrusted. Recapture with `--force` after reviewing.
- `fronts/+u.png` — face `+u`, 54.8 m out, 5° off head-on, fov 55°, imagery Aug 2023
- `fronts/-u.png` — face `-u`, 39.1 m out, 59° off head-on, fov 55°, imagery Aug 2025
- `fronts/-u-2.png` — face `-u`, 50.8 m out, 39° off head-on, fov 55°, imagery Aug 2025
- `fronts/+v.png` — face `+v`, 28.8 m out, 5° off head-on, fov 55°, imagery Aug 2025
- `fronts/-v.png` — face `-v`, 75.2 m out, 55° off head-on, fov 55°, imagery Aug 2025
- `fronts/oblique-1.png` — oblique view toward face `+u`, 52.0 m out, imagery Aug 2023
- More viewpoints if you need them (Google snaps to the nearest pano; edit `…h` to aim, `…y` for zoom):
  - `+u`: [20 m](https://www.google.com/maps/@42.919493,-77.741337,3a,55y,103h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.919522,-77.741516,3a,55y,103h,90t/data=!3m1!1e1)
  - `-u`: [20 m](https://www.google.com/maps/@42.919389,-77.740711,3a,55y,283h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.919360,-77.740531,3a,55y,283h,90t/data=!3m1!1e1)
  - `+v`: [20 m](https://www.google.com/maps/@42.919696,-77.740945,3a,55y,193h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.919828,-77.740905,3a,55y,193h,90t/data=!3m1!1e1)
  - `-v`: [20 m](https://www.google.com/maps/@42.919186,-77.741102,3a,55y,13h,90t/data=!3m1!1e1) · [35 m](https://www.google.com/maps/@42.919054,-77.741143,3a,55y,13h,90t/data=!3m1!1e1)

## Tooling
- Schema: `docs/BLUEPRINT_SCHEMA.md`.
- Draft: `data/avon-extended/buildings/248688344/draft.json`; notes: `data/avon-extended/buildings/248688344/notes.md`. Touch nothing else in the repo.
- Lint: `./town lint avon-extended 248688344` — fix every error before rendering.
- Render from a face (photo-like camera, trees hidden): `./town render avon-extended 248688344 --face=+v --dist 45 --compare` → `data/avon-extended/buildings/248688344/renders/` (render, and the photo beside it in `compare-<face>.png`). Other faces: `--face=-u`, `--face=+v`, …; `--iso` for the diorama camera; `--with <id> <id>` to load neighbours' drafts.
- Preview URL (same thing, by hand): `http://localhost:8734/?site=avon-extended&free=1&bp=248688344&focus=248688344&side=+v&dist=45&notrees=1`
- Do NOT run `town accept` yourself; the coordinator accepts reviewed drafts into overrides.json.

## Method
1. Read every photo of the road face first, then the other covered faces. Per face, write the elevation bay by bay: storeys, openings per storey with shape, doors, storefront extents as fractions from the left, signs, roof form, colours (mid-tones).
2. Preserve observed window counts, floor levels, proportions and distinctive silhouettes; do not replace accuracy with exaggeration. Faces without photos stay plain.
3. Notes file sections: Identification (with confidence), Frame, Photos used, Reading face by face, Observed features and measured proportions, Approximations / schema gaps, Confidence.
4. Every draft is reviewed independently (`town review`) against renders of all sides before it is accepted; resolve the findings it lists.
