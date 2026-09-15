# 248342252 — 48 North Avenue

## Identification
Light steel-blue vinyl-sided 2.5-storey house on the west side of North Avenue, between 54 (olive American Foursquare, to the NNE) and 42 (cream side-gabled Colonial, to the SSW). Side-gabled with a semicircular fanlight in the front roof slope, a brick chimney at the NNE end of the ridge, a full-width hip-roofed open porch with three white posts and a solid siding half-wall, and a big dark 3x3 solar-glass panel in the SSW gable end. Confidence: high (house number "48" readable on the porch post in `front_+u.png`; both neighbours match the brief).

## Frame
OBB 18.3 m (u) x 9.4 m (v); +u = 287 deg (road face, North Avenue), +v = 17 deg (toward 54 North). Rectangle footprint. Main block ~9.4 m deep at the street end (u -0.3..9.1); a one-storey wing fills the rest toward the garage (u -9.1..-0.3). Flat lot.

## Photos used
- `front_248342252_+u.png` (18.6 m, 8 deg off): the primary read of the road face. Also `front_-u.png`, which is actually a second, farther shot of the same road face (the pano is in the street; the rear is not visible from anywhere).
- `front_+v.png` / `front_+v_2.png` (57 / 45 deg off): NNE side. Clear enough to count openings; a street tree hides the front corner.
- `front_-v.png` / `front_-v_2.png` (64 / 38 deg off): SSW side. Mostly the porch front plus the compressed gable end with the glass panel; a maple hides the upper left.
- The overhead crop (`overhead_labeled.jpg`) does not cover North Avenue, so the rear wing is inferred from the obliques.

## Reading face by face
- **+u (road, 9.4 m, left = NNE)**: 2 storeys under a gable roof whose ridge runs parallel to the street (ridge slightly shorter than the eaves because of the rake overhang). Upper: two 1/1 double-hung windows at ~0.23 and ~0.78. Fanlight (half-round, white trim, radiating muntins) centred in the roof slope about halfway up. Brick chimney just behind the ridge at the left end. Ground: full-width open porch, hip roof, three square white posts (ends + one at ~0.53), solid siding-clad half-wall with flower boxes in place of a railing, four steps at the left in front of the white glazed front door (~0.26); to the right of the middle post a wide window (~0.68) and a large navy barn star on the wall. Colours: pale blue-grey siding, white trim, dark blue-grey shingles, grey porch deck.
- **+v (NNE, left = rear)**: gable end with chimney at the peak and a small attic window under it. Upper: three windows (two narrow ones toward the rear, one toward the front). Ground: window, white side door with a 3-step concrete stoop (driveway side), then a narrow box window near the porch. Basement windows at grade.
- **-v (SSW, left = street)**: gable end. Upper storey largely filled by a dark 3x3 glass panel (solar collector / sunspace glazing) with one small white window set in it; tiny attic window at the peak. Ground: two windows. A/C unit and generator at grade.
- **-u (rear)**: not photographed; one-storey wing with a low roof, then a detached garage (separate building). Kept plain.

## What was modelled / exaggerated
- Side-gable main block (pitch 0.36, ridge 3.4 m) with a 0.45 m overhang; chimney at u 4.2 / v 3.7.
- The fanlight as a real `roof.dormers` entry on the main gable (`faces: ["+u"]`, `at: [0.5]`, `type: "arch"`, `style: "gable"`, w 1.4, h 0.8, sill 1.0 m above the eave so it sits mid-slope) — slightly bigger than life so it reads from the diorama camera.
- Full-width open porch, hip roof, 3 posts, railing, 4 steps at the door; white front door at 0.26 and one wide window at 0.7 (real porch has a door + one wide double window).
- -v gable: a single big dark-framed 3.0 x 2.3 m window standing in for the 3x3 glass panel, plus the attic window.
- +v: three upper windows, side door with 3 steps, two ground windows, attic window.
- One-storey hip-roofed rear wing, slightly narrower than the main block.

## Approximations / schema gaps
- The barn star on the porch wall has no schema equivalent (no image/decal shape other than rectangular signs); omitted.
- The porch's solid siding half-wall is rendered as a baluster railing (`railing: true`).
- The real fanlight is flush with the roof; the schema dormer gives it a small wall-coloured box and gable cap.
- The 3x3 glass grid is one big window (mullions give a 2x2 look, not 3x3).
- Rear wing size/roof form inferred; overhead does not cover this block.
- Side compare renders (`compare_+v`, `compare_-v`) are blocked by the neighbours' generic boxes even with `--height 16`; checked the sides via `--iso` instead.

## Confidence
Road face: high. Sides: medium (oblique photos, tree cover). Rear: low (inferred).
