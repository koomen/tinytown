# Blueprint notes — OSM 248251397 — 90 Genesee Street (T's On Genesee Market & Deli)

## Identification
T's On Genesee Market & Deli, 90 Genesee St. The road-face photo (Aug 2025) shows the
"T's ON GENESEE MARKET & DELI" sign board on this building, immediately south of the
Coyne Econ-O-Wash laundromat (78) across a narrow alley, with 102 Genesee (a grey-green
gabled house) 8 m to the south. Confidence: high.

## Frame
OBB 25.4 m (u) × 9.4 m (v); +u bears 285° (WNW) = road face; +v bears 15° (NNE) toward the
laundromat. Faces: `+u` road, `-u` rear (parking lot), `+v` alley side (laundromat), `-v`
south side (drive / parking toward 102 Genesee).

The satellite crop (Esri, with the OSM outlines overlaid) shows the two OSM footprints
each ~1 m too wide: the real roofs are ~8.2 m wide with a ~2.3 m alley between them, and
Street View from the road (front_248251398_-u.png, sv_248251398_a.png) shows that alley
with a bollard and a path. The volume therefore stops at v = 3.7 instead of 4.7, leaving
1 m for its half of the alley (the laundromat draft does the same on its +v side).

## Photos used
- `front_248251397_+u.png` (road face, 14° off) — primary elevation.
- `sv_248251397_a/b/c.png` — storefront details, colour, the neighbours.
- `front_248251398_-u.png`, `sv_248251398_a.png` — T's left bay, the alley, the tan brick kick.
- `front_248251398_+v.png`, `front_248251398_+v_2.png` — despite the name these show T's
  south (`-v`) wall (green trim + octagonal window; the laundromat's side has white trim and
  black shutters), the close one covering the rear 14 m of it.
- `front_248251398_+u.png`, `front_248251398_+u_2.png` — T's rear (`-u`) at the left edge.
- `front_248251397_-v.png` is actually the neighbour 102 Genesee (the camera stands behind
  it); `front_248251397_-u.png` and `front_248251397_+v.png` came out black.
- `overhead_labeled.jpg`, `satellite.jpg` (+ a crop with the OSM outlines drawn).

## Reading face by face
**+u (road, 8.4 m modelled, left = alley/north end):** two storeys, flat roof behind a
white bracketed cornice (a row of small brackets under a projecting board). Upper storey:
two tall double-hung windows with wide sage-green trim at ~0.25 and ~0.75, AC unit in the
right one. Sign band across the whole width above the storefront: white board, dark
letters, red "T's" at the left, round logo in the middle. Storefront on a tan/yellow brick
base: white entry door with a small dark hood at ~0.15, a poster-covered window
0.27–0.5, a big plate window 0.57–0.96 with the deli counter behind. Two red patio
umbrellas and a picnic table on the sidewalk in front.

**-v (south, 25.4 m, left = road end):** white clapboard, green trim. Upper: five tall
narrow windows plus one octagonal window about two-thirds of the way back
(measured from the rear: 3.0, 5.3, oct 8.3, 10.2, 12.9, 14.8 m; more toward the road end
hidden by the neighbour). Lower, rear half: paired window, pale double door with lamp,
paired window, single window near the corner. Front half of the lower storey unseen.

**-u (rear, 8.4 m, left = south):** white clapboard, flat roof with a small parapet, two
upper windows (green trim) at ~0.27 and ~0.68, a white door at ~0.42, a window at ~0.72,
a brick chimney near the south corner.

**+v (alley, north):** plain clapboard 2.3 m from the laundromat; only glimpsed. A few
upper windows assumed.

## What was modelled / exaggerated
- Single flat-roofed volume u [-12.7, 12.7] × v [-4.7, 3.7], 8.0 m to the eave.
- Bracketed cornice exaggerated: 0.6 m tall, 0.55 m overhang, dentils on.
- Sage-green window trim (#7b8d6c) on every opening, thick frames on the two big
  front windows (w 1.3, h 2.0).
- Storefront: door with green surround and a grey hood-awning, two glass bays on a tan
  brick kick (#c8b18a), a full-width white "board" sign, and a red awning over the big
  window standing in for the red umbrellas.
- South wall: six tall windows + a round (octagon) window upstairs, a lamp-lit double door
  and paired windows downstairs in the rear half, two single windows added in the unseen
  front half so the ground floor is not blank.
- Rear: two windows, a door, a small window, a chimney.

## Approximations / schema gaps
- The `+v` (alley) face cannot be photographed or rendered head-on: a camera 30 m out to the
  NNE stands inside 68 Genesee / the bank canopy, so `render_248251397_+v.png` shows only
  their roofs. The alley face was checked obliquely in the laundromat's `-u` render and the
  `--iso` view instead.
- No octagonal window type; used `round`.
- No door hood; used a small grey awning over the door.
- Red umbrellas / picnic tables have no detail type; a red awning carries the red accent.
- The real sign has a red "T's" and a round logo; the board sign is one colour.
- The rear roof has a slightly raised section and rooftop unit (satellite) — omitted.
- The volume is 1 m narrower than the OBB on the alley side (see Frame).

## Confidence
Identification high. Road face high (frontal photo). South wall medium-high for the rear
14 m, low for the front half of the ground floor. Rear medium (oblique). Alley face low.
