# 248274711 — 71 Park Place, Avon NY

## Identification (IMPORTANT: not a restaurant)

The earlier pass labelled this "Big Mike's Dogz, hot-dog / fast-food, drive-through".
Head-on Street View from Park Place (Aug 2025 pano, `front_248274711_-u.png` and
`_-u_2.png`) shows the building at this footprint is a **two-storey private house**
with a plaque reading **"71"** beside the front door. OSM way 248274711 carries only
`addr:housenumber=71, addr:street=Park Place, building=yes` (no shop/amenity tags).
Web listings (bippermedia, a Facebook page created ~2023) put "Big Mike's Dogz" at
71 Park Pl — almost certainly a hot-dog cart / home-based catering business
registered at the owner's home address, not a restaurant building. No sign, no
drive-through, no commercial fabric exists on site. The "T's On Genesee" hit for the
same address is a search-summary error (that deli is at 90 Genesee St).

So the blueprint models the house, and no "Big Mike's Dogz" sign is drawn
(adding one to a residence would be inventing). Sources:
- https://bippermedia.com/restaurants/united-states/new-york/avon-5/big-mikes-dogz-reviews-big-mikes-dogz-at-71-park-pl-avon-ny-14414/
- https://www.facebook.com/p/Big-Mikes-Dogz-100091287790675/
- https://www.openstreetmap.org/api/0.6/way/248274711.json

## Frame

`footprint_card`: obb 22.9 (u) x 13.1 (v) m; +u bears 105 deg (ESE), +v bears 195 deg
(S). Road face is **-u** (Park Place, to the WNW). L-shaped polygon: front block
u[-11.5,-3.5] is only 9.3 m wide (v -6.5..2.8); rear block u[-3.5,11.5] is the full
13.1 m (the extra strip on +v is the one-storey south wing).

## Photos

- `front_248274711_-u.png`, `front_248274711_-u_2.png` — head-on from Park Place
  (pano labelled "61 Park Pl" by Google but the house plaque reads 71). Clear.
- `front_248274711_+u.png` — from Temple St to the east; hedge blocks most of it,
  rear of the house visible as a dark-teal gable with white trim behind a white garage.
- `front_248274711_-v.png` — Google snapped to E Main St (Avon Market); useless, kept
  only as evidence there is no pano north of the lot.
- `sv_248274711_{a,b,c}.png` — old obliques from the park island, all trees.

## Bay-by-bay reading, -u (front, 9.3 m)

Two-storey gable-front house (ridge along u, gable faces the street), dark slate
grey-green shingle walls, white trim, dark grey shingle roof, brick chimney on the
north (-v) slope near the front. Full-width one-storey porch with a flat roof that
doubles as an open second-floor balcony with a white balustrade:
- Porch: 4 round white Tuscan columns on low stone piers, stone-faced base (~0.8 m),
  white fascia + white balustrade above (~0.9 m). Steps (4) centred up to the door.
- Ground floor (behind porch): L bay = pair of tall dark double-hung windows with a
  planter box; centre = dark glazed door, white surround with sidelights and an
  elliptical fanlight, "71" plaque; R bay = one tall window.
- Second floor: window (L), white glazed balcony door (centre-left), window (R).
- Attic gable: one wide 2-sash window centred, small louvre at the peak.
- Right of the porch (+v side), set back ~2 m: one-storey white clapboard wing with a
  low hip roof and its own little single-column porch and a window.
- Behind everything: detached white garage (not in this footprint, ignored).

## Other faces

- +v (south): white wing in front; house behind with a few windows. Guessed rhythm.
- -v (north): hidden by neighbour 61 Park Pl; standard 3-bay guess.
- +u (rear): teal gable end with a window over a 1-storey rear ell (from the Temple St
  shot). Modelled as a lower gable ell, same shingle colour.

## Blueprint decisions / approximations

- `house` u[-9,3.5] x v[-6.5,2.8], eaves 6.8 m, gable ridge u, pitch 0.46 (ridge ~4.3 m).
- `porch` u[-11.5,-9] flat-roofed volume, wall a darker shade of the house colour so it
  reads as shadowed recess; 4 white `pilasters` (w 0.42) stand in for the round columns
  (schema has no columns); stone `plinth` 0.8 m for the piers; a white `beltCourse`
  placed ABOVE the porch roof (y 3.68, h 0.5) fakes the balcony balustrade (solid,
  not balusters). Door/ground-floor windows live on the porch's -u face because the
  house's own ground floor is inside the porch volume.
- Balcony door on the 2nd floor drawn as a tall pale-glass window at 0.45 (doors sit
  at ground level in the renderer).
- `wing` u[-3.5,3.5] x v[2.8,6.5], white, hip roof, one tiny pilaster for its column.
- `rear` u[3.5,11.5] full width, eaves 4.2, low gable.
- Bushes along the front hedge line and one by the driveway.

## Colours

wall #5f6e6d (shingles read ~#4f5f5e in the photo; lightened one step because the
renderer's shading pushed the first try to near-black), porch recess #4a5857, trim
#ebe8e0, roof #3b3d40, wing #e6e3db, stone piers #8a7f71, glass #2e3436.

## Confidence

Identity of the building: high (plaque, OSM address, pano). Front elevation: high.
Side/rear: low-medium (hedge, no north pano). Business identity: "Big Mike's Dogz" is
registered here but is not a building feature — medium confidence it is a cart.
