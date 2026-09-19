# Blueprint notes — OSM 247541316 — 15-17 Park Place / 40-44 Genesee St block, Avon NY

## Identification
- Two-storey mixed-use corner block at the top of Genesee Street on the south-west side of the
  Memorial Park circle (overhead label 1316). Ground-floor tenants, east to west: Veronica's Family
  Hair Salon (17 Park Pl), Alliance Group Insurance (15 Park Pl), Coastal Staffing; the Genesee
  Street end carries the "40" address. West neighbour of Pizza Land (247541280).
- Sources: head-on Street View captures listed below (Aug 2015 / 2021 / 2025 panos), the oblique
  `sv_247541316_{a,b,c}.png`, research note in overrides.json.

## Frame
- OBB 25.5 m along u (+u = 104°, east, toward Pizza Land), 15.4 m along v (+v = 194°, south).
  Road face is **-v** (Park Place / the circle, looks NNE). **-u** (west) fronts Genesee Street and
  is fully visible; **+v** (rear) faces the bank parking lot; **+u** abuts Pizza Land.
- Fractions on -v run east → west (Veronica's at 0, Coastal at 1). On -u they run north → south.

## Photos (head-on)
- `front_247541316_-v.png` (18 m, Aug 2015), `front_247541316_-v_28.png` (whole front, Aug 2025),
  `front_247541316_-v_40.png`, `front_247541316_-v_2.png` (35° zoom on the storefronts).
- `front_247541316_-u.png`, `_-u_40.png`, `_-u_2.png` — Genesee Street end (all snap to the same
  pano at ~8 m; the gable end and the brick wing are both in frame).
- `front_247541316_+v.png` / `_+v_2.png` — rear from the bank lot (Aug 2021): white-painted stone
  1-storey rear with the Alliance Group back window, Pizza Land's tan box to the right.

## Reading, face by face
**-v front (the clapboard block, ~21.5 m, plus a ~4 m 1-storey link at the east end set back
~2 m).** Red-orange brick ground floor to a white trim board at ~3.6 m; white vinyl clapboard above;
black shutters; dark-grey shingle gable roof, ridge along the street, eaves ~7 m. Ground floor,
east → west: Veronica's big window | woodgrain door with transom (railings, planter) | big window ‖
brick pier with lantern ‖ Alliance window | door ‖ Coastal big window | second window | door with
steps at the far west end. Signs over each shop at ~3.0 m: Veronica's black/gold oval board,
Alliance white board with dark lettering, Coastal cream board with blue lettering. Upper floor: a
run of 7–8 double-hung windows with black shutters (two with AC units). String lights along the
brick/siding line. The link: white-painted stone, one small window and a white door, low grey roof.

**-u Genesee Street end.** North part = the gable end of the front block (~8 m): brick ground floor
with one large shop window (left) and a white door "40" (right, under a small hood); clapboard upper
with 4 shuttered windows; a small pointed attic window in the gable. South part = a 2-storey
all-brick wing (~7 m) with WHITE shutters, two upper windows, ground-floor window + door, lower
hipped roof and a brick chimney at its west edge toward the south end.

**+v rear.** East half is a 1-storey white-painted rubble-stone building with a hip roof, windows
(one with the Alliance sign) and a rear door; the brick wing forms the west part.

## What was modelled (and exaggerated)
1. `front-block` u[-12.8, 8.8] v[-7.7, 0.5], 7.0 m, brick `#96553f` below `split` 3.6, clapboard
   `#e9e6de` above (`gableColor` the same so the gable ends are clapboard), white belt course at
   3.6, gable ridge u pitch 0.42, roof `#4d4c4a`. -v: five `storefronts` bands with brick kicks,
   three woodgrain doors (0.205, 0.565, 0.955), three signs (gold-on-black / board / board), seven
   shuttered upper windows. -u: shop window, white door, three shuttered windows, gothic attic light
   at 8 m.
2. `brick-wing` u[-12.8, -3.0] v[0.5, 7.7], 6.3 m, redder brick `#8f4b3d`, hip roof h 2.0, chimney
   at (-12.3, 6.4), white-shuttered windows on -u and +v, door on -u.
3. `rear-stone` u[-3.0, 12.8] v[0.5, 7.7], 3.4 m, `#e2ded4`, hip h 1.6, windows + door on +v.
4. `stone-link` u[8.8, 12.8] v[-5.6, 0.6], 3.3 m, same stone, small window + door on -v (set back
   2.1 m from the street line, as in the photos).

## Approximations / gaps
- Real upper-floor windows are 7–8 unevenly spaced (two with AC units) — drawn as 7 even ones.
- Lanterns, string lights, the Veronica's oval sign shape, the "40" door hood, the wheelchair ramp
  on Genesee St and the Coastal A-frame sidewalk sign are not expressible.
- The brick wing's u-extent and the split between wing and stone rear are estimated (only the -u
  and a partial +v view exist); the +v windows on the wing are guesses.
- OSM's footprint is a plain rectangle; the set-back link is placed inside it.

## Confidence
High on the Park Place front and the Genesee Street gable end; medium on the rear volumes.

## Street View correction — 2026-09-19

User-supplied Street View shows the narrow connector immediately right of Pizza Land
as white-painted masonry with a low flat roof, a small window and a white door.
The front remains at v=-5.6, 2.1 m behind the main street facade (v=-7.7).
Use a 4.2 m wall with a shallow white cap; this height is estimated from the photo.
Remove the incorrect seven-metre tan mass and upper side windows in Avon Extended;
replace the hipped connector roof in compact Avon. Retain each site's existing rear
footprint and the adjacent salon volumes.
