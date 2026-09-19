# Blueprint notes — OSM 248274709, Avon Fire Department / Village of Avon offices, 74 Genesee St

## Identification
- One L-shaped municipal complex on the SOUTH side of the Memorial Park circle (overhead label 4709).
  North block = Avon Fire Department apparatus hall (avonfirerescue.com lists 74 Genesee St).
  The set-back block behind it (east/south, fronting the parking lot off Genesee St) is the
  **Village of Avon offices** — "VILLAGE OF AVON 74" is lettered on its entry pavilion
  (villageofavonny.gov also gives 74 Genesee St for the Village Office).
- Frame: +u = 104° (≈E), +v = 194° (≈S). `-v` is the north face on the circle (Park Place),
  `-u` is the west face along Genesee Street, which carries the big **"AVON" mural**.
- Sources: footprint card; Street View head-on captures below; web (avonfirerescue.com,
  villageofavonny.gov). Confidence: high on identity, layout and the north face; medium on the
  office-block fenestration (only seen from the parking lot, partly behind cars/shrubs).

## Photos (head-on unless noted)
- `front_248274709_-v.png` — north face from the circle (Aug 2025). Clear.
- `front_248274709_-u.png`, `front_248274709_-u_2.png` — west (Genesee St) face: the AVON mural,
  from the lot right in front of it (Aug 2021 pano; `_2` is the 100° wide view showing the whole wall).
- `front_248274709_offices_-u.png` — west face of the Village offices from the parking lot (Aug 2023).
- `front_248274709_-u_3.png`, `_-u_4.png`, `_-u_5.png` — misses (snapped to 71 Genesee / Pizza Land /
  the lot behind 1399); kept only because `_-u_4` proves the earlier "2-bay west wing" in
  `sv_248274709_c.png` is just an oblique of the NORTH doors seen past Pizza Land — there are NO
  west-facing apparatus doors.

## Bay-by-bay reading
### North face (-v, 22 m, left = east)
1. Left ~5.3 m: low 1-storey brick office annex, own low hip roof, cream fascia lettered
   "AVON FIRE DEPARTMENT" with a round FD emblem; glass door at left, large multi-pane window right;
   brick-based amber LED message sign and a bell on the lawn in front; flag on a pole.
2. Right ~16.6 m: the hall. FOUR white sectional apparatus doors ≈3.5 m wide × 3.8 m tall with a
   row of three small lights, separated by ~0.6 m brick piers carrying wall lamps; ~0.5 m brick
   above the doors, then a cream fascia/cornice band, then the brown hip roof (ridge runs N–S,
   hip end faces the circle, rise ≈2.5–3 m). Small green FD sign on the pier right of door 4.
   Radio mast behind (not modelled).
### West face (-u, 28 m, left = north)
- Brick end piers (~1.5 m north, ~2.5 m south) framing one continuous painted mural: big pale-blue
  3-D block letters "AVON" on a dark blue/purple night sky with local-history figures. Low grey
  concrete plinth. Same brown hip roof with cream fascia running the whole length.
### South face of the hall (+v) — faces the parking lot; plain brick, a service door and two windows (not photographed head-on, approximated).
### Village offices (u −2.8→20.1 and the southern step u −6.5→17.7)
- 1-storey red brick, slightly browner than the hall, brown hip roof, cream fascia band.
- West face: a projecting entry pavilion toward the NORTH end with its own hip roof, cream band
  lettered "VILLAGE OF AVON", double glass doors with a lamp; then pairs of rectangular windows
  (~1.3 × 1.6 m, cream frames) with planters and shrubs; the southern section reads a little lower.
- Flagpole in the parking lot west of the offices; hanging planters.

## What was modelled (5 volumes)
- `hall` u[−20.1,−3.5] v[−33.3,−5.1], h 4.6, TRUNCATED hip (`flatTop`, rise 2.4 m over a 4 m run — both the
  north photo and the mural photo show a long horizontal roof top, so it is a flat-decked hip, not a ridge): four `double` doors 3.4×3.8
  (off-white #e4e2db, brick-toned surround) at 0.125/0.375/0.625/0.875 with lamps; cream belt at the
  eave as the fascia; the mural as a 24 m × 3.3 m `navy` sign "AVON" with opts bg #2b2d63 / fg #93c5d8.
- `annex` u[−3.5,1.8] v[−33.3,−2.1], h 3.3 hip: door, wide window, carved cream sign
  "AVON FIRE DEPARTMENT"; 5 windows on the east lawn side.
- `offices` u[−2.8,20.1] v[−5.1,16.8], h 3.4 hip, browner brick #9d5541, paired windows.
- `entry` pavilion u[−4.4,−2.6] v[−3.6,2.4], h 3.7 hip: double glass door with fanlight + lamp,
  carved sign "VILLAGE OF AVON".
- `south` u[−6.5,17.7] v[14.9,33.3], h 3.1 hip (reads lower).
- Details: red LED-style lawn sign "AVON FIRE DEPT" in front of the annex, flagpole in the lot,
  two bushes by the office windows.

## Colours (sampled mid-tones)
- Hall brick #a3583f (red-orange); offices/annex brick #9d5541; cream fascia/trim #dcd2b8;
  roof #6b4432 (between the sunlit 2021 red-brown and the mossy 2025 dark brown);
  doors #e4e2db; office glass #5a6470; mural panel #2b2d63 with #93c5d8 letters.

## Approximations / things the schema cannot express
- Sectional garage doors → `double` rect doors (the centre seam + knobs read as two leaves;
  the three little door lights are not representable).
- The painted mural → a flat navy sign panel with the word AVON (no figures/imagery).
- The hall's cream cornice under a hip roof → a belt course at eave height (cornice is flat-roof only).
- Radio mast, bell, hanging flower baskets, the round FD emblem and the green pier sign are omitted.
- The office block's south step-down is one volume 0.3 m lower; its rear faces are generic windows.

## Renders
- `render_248274709_-v.png` (north face from the circle, default camera at 100 m),
  `render_248274709_-v_2.png` (north face close, camera placed on the circle — compare with `front_248274709_-v.png`),
  `render_248274709_-u.png` (mural wall from the north end of Genesee St — compare with `front_248274709_-u_2.png`;
  the buildings across Genesee St block any farther head-on camera),
  `render_248274709_nw.png` (3/4 from the NW, like `sv_248274709_b.png`).
- Cameras: `lookAtBuilding` aims at the OBB centre, which for this 66 m long L-shape leaves the hall at the frame
  edge, so the close renders set `__town.camera.position` / `controls.target` directly (world x = east, z = south;
  u,v → world via the obb angle 0.248 rad).

## Update 2026-09-03 — real mural
The "AVON" navy sign panel is replaced by the actual mural: `signs[].image =
data/avon-extended/textures/firehall_mural.jpg` (24 × 3.33 m, centred 2.35 m up the hall's
-u face). Source: Google Street View pano `lPAX7O6w7hXiPweAo6weVg` (Aug 2021,
reached through "See more dates" — the 2025 pano has a pole in front),
shot at 60° fov / heading 74° / 2× scale, then perspective-corrected with
Pillow (QUAD transform, corners read off the screenshot) to 2880 × 400.
