# Blueprint notes — OSM 247541852, "Avon on the Green" senior apartments

## Identification
- Avon on the Green Senior Living, 113 Avon on the Green (a.k.a. 51 Prospect St), Avon NY 14414.
  Landsman-managed, built 1998, 2 storeys, 35 one-bedroom units, elevator. Sits at the
  intersection of Routes 5&20 (West Main St) and Prospect St, the NW corner of the
  Memorial Park circle (overhead label 1852).
  Sources: apartments.com / after55.com / landsman.com listings (web search), Google Street
  View Jul 2019 (Prospect St) and Aug 2025 (West Main / NY-5).
- Footprint frame: obb 62.5 x 18.1 m, +u bears 195 deg (SSW), +v bears 285 deg (WNW).
  -v face (105 deg, ESE) fronts Prospect St and the circle; +u end faces West Main St;
  +v is the rear parking lot; -u end faces the neighbour house (4497).
  The +u end is notched: for u > 27 only v in [-9.1, 1.1] exists, i.e. the rear (+v) 8 m
  of the end are set back 4.2 m. Modelled as `block` (u -31.2..27) + `endbay`
  (u 20..31.2, v -9.1..1.1, overlapping).

## Photos (head-on)
- front_247541852_-v.png      Prospect St, 100 deg fov overview of the whole -v face
- front_247541852_-v_2.png    -v, left (SSW / +u) half: porch A, flag, brick bays
- front_247541852_-v_3.png    -v, right (NNE / -u) half: door, porch B, green lawn sign
- front_247541852_-v_4.png    -v centre zoom, bays around the entrance door
- front_247541852_+u.png      West Main St, head-on +u end (clear, Aug 2025)
- No street coverage of the +v rear (parking lot) or the -u end; those faces are inferred.

## Bay-by-bay reading
### -v face (Prospect St, 62.5 m; left = +u / SSW end)
- Grey rusticated concrete-block base, ~1.0-1.2 m on this side (the ground drops toward
  West Main so the base grows to a full ~2.5 m exposed basement at the +u end).
- Red brick, cream (almond) trim, 6/6 double-hung windows ~0.9 x 1.5 m with dark
  slate-blue-grey louvred shutters; many are set in close pairs (~1.8 m centres), some
  singles, a few wide unshuttered pairs with AC units. Two storeys; ground sills just
  above the stone base; eave/cornice cream fascia; low hip roof, dark grey asphalt.
- Left end (0.03-0.15): open porch A, cream columns and railings, hip roof, ramp + steps,
  US flag on a pole beside it. Second-floor windows continue above the porch.
- 0.15-0.42: paired shuttered windows in a steady rhythm, both floors.
- ~0.44: central pavilion — paired shuttered windows on both floors under a projecting
  cream-trimmed triangular PEDIMENT that breaks the eave (with a round vent).
  The white square louvred CUPOLA with a hip cap and ball finial sits on the ridge here.
- ~0.54: cream entrance door with lamp and a concrete walk (secondary entrance).
- 0.58-0.82: paired shuttered windows, both floors.
- 0.84-0.96: porch B (same as A, hanging flower baskets). Beyond it, near the -u corner,
  the green-and-gold "Avon on the Green" lawn sign on two posts.
### +u end (West Main St, 18.1 m; left = +v / rear side)
- Left 44 % is the recessed rear block: brick, one shuttered window per floor
  (three storeys visible here because the ground is lower; the bottom one is the
  walk-out basement level).
- Right 56 % is the projecting `endbay`: stone basement ~2.5 m with one small window and
  a brick patio wall + cream railing; two brick storeys each with a close PAIR of
  shuttered 6/6 windows flanked by two small square windows; a cream pediment with a
  round vent centred over the pair, breaking the eave; cupola visible behind on the ridge.
  Hedge along the base.
### +v rear and -u end
- Not photographed. Given regular apartment plans: 12 shuttered windows per floor on the
  rear with a rear door at the centre, 3 per floor on the -u end.

## What the blueprint does
- Colours sampled as mid-tones: brick #9e5340, trim #e9e0c8, shutters #5e7079,
  stone #8f8d84, roof #4d4e50, doors #e6dcc6, porch walls #ebe3cf, glass #5c6a78.
- Signature features exaggerated: the long repetitive shuttered-window rhythm (11 lower /
  16 upper bays on -v), the two cream porches, the two pediments (one on -v at 0.44, one on
  the +u end), and the cupola at u=3.7 on the ridge above the -v pediment; flag pole by
  porch A; green "Avon on the Green" lawn sign by the -u corner.
- The live blueprint uses two open porches with low hip roofs, cream columns and
  railings, rear-wall doors, and short entrance steps.
- Pediments are `parapets` of type pediment; with a hip roof they stand at the wall plane
  just behind the eave fascia (the real ones project slightly in front of it).

## Retired terrain workaround (removed September 6, 2026)
The original model raised its upper architecture by 2.2 m to compensate for an
old renderer that placed the base at the lowest terrain point. That workaround
became unnecessary after the renderer began using frontage elevations, and left
an oversized exposed basement and very tall porch staircases.

The live blueprint now uses a 1.1 m plinth, lower/upper window sills at 1.3 / 4.0 m,
and 6.4 m eaves. Both open porch floors are 1.0 m above the building base, with four
steps and unchanged 2.46 m posts. The small end basement window sits within the
shortened plinth. Ground-level doors and the grounded lawn sign retain their
existing offsets. Do not reintroduce the old 2.2 m lift from the historical draft.

## Renders
- render_247541852_-v.png         iso view from Prospect St (side=105, dist 110)
- render_247541852_+u.png         iso view from the SE showing the +u end and the -v face
- render_247541852_+u_2.png       close free-camera view of the West Main end
- render_247541852_-v_porchA.png  close view of porch A + flag
- render_247541852_-v_porchB.png  close view of porch B + lawn sign

## Confidence
- Identity, colours, materials, cupola, pediments, porches: high (two clear head-on faces).
- Exact bay count/positions on -v: medium (trees hide parts; caricatured to a regular rhythm).
- Pediment at 0.44 rather than dead centre: medium (estimated from pano geometry).
- +v rear and -u end: low (unseen, inferred).
