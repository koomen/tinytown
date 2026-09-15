# 248274500 — 17 West Main Street (doors numbered 13, 15 and 17)

## Identification
Two-storey red-brick Italianate commercial block with a very large, ornate
cream/tan bracketed and dentilled cornice, five arched windows with peaked
cream stone hoods, and a dark-green cast-iron storefront with gilt pilasters
housing three doors (13, 15 — a white stair door — and 17). US flag on a
bracket at the east end. Occupied, no readable business sign. Confidence high
(head-on `front_248274500_-v.png`, `front_248274500_-v_2.png`; sv_248274500_a-c).

## Frame
OBB 9.3 x 17.6 m; road face is -v (9.3 m, looks NE). From the street, left =
+u (toward 15 W Main), right = -u (west). The footprint has a narrower rear ell
(u -4.3..3.4, v 3.3..8.8) modelled as a lower plain volume.

## Bay-by-bay (road face, left to right)
- Upper floor: five arched windows, ~0.95 m wide, ~2.3 m tall; the first bay
  is set apart (wider spacing), the other four evenly spaced — at fractions
  0.14 / 0.40 / 0.57 / 0.75 / 0.92. Cream hoods with a peaked keystone,
  dark-green frames, cream sills.
- Cornice: ~1.2 m tall cream pressed-metal cornice with big paired brackets,
  a dentil/rosette band and a cream frieze; the most recognizable feature.
- Ground (storefront, ~3.6-4.1 m to the top of its dark-green dentilled
  cornice): shop window | maroon door 13 with transom | shop window | white
  stair door 15 (recessed) | gilt pilaster | shop window (blinds) | gilt
  pilaster | maroon door 17 | shop window. Gilt fluted cast-iron pilasters
  between every bay.

## Colours
brick #b0604a · cornice #d8cfba · hoods #d3c8ad · frames / storefront / band
#2f4a3a · gilt pilasters #a8905a · doors #6b2f2a, stair door #d9d2c1 · glass
#5c6b74.

## Approximations
- The brackets and rosette band of the cornice: `dentils: true` on an
  oversized (1.1 m, 0.55 m overhang) cornice.
- The storefront's dentilled green cornice: a 0.55 m belt course at 3.6 m.
- Peaked hoods: `hood` + `keystone`.
- West side (-u) is a party wall in fact partly exposed; given two small rect
  windows. Rear ell given two windows and a back door.

## Render check
`render_1090362847_-u.png` (the whole row from West Main — the primary
comparison with `front_248274500_-v.png`) and `render_248274500_-v.png` (the
`side=-v` preset aims at the centre of this deep footprint, so it looks down
over the roof; the cornice, five arches and storefront are still visible). Five arches, giant cream cornice, alternating shop/door
rhythm with gilt pilasters, maroon doors; heights consistent with 15 W Main
(7.2 m) and the corner block (13.8 m).
