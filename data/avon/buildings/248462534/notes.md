# 248462534 — 50 East Main Street (house)

## Identification
Two-storey white clapboard house with a tall street-facing gable whose eaves flare out (bell-cast / Dutch-Colonial-flavoured), an oculus with cross-shaped trim in the gable, a full-width open porch on a green lattice skirt with white posts and railing, steps at the right, a brick chimney at the ridge just behind the front gable, and a detached grey hip-roof garage at the end of the right-hand driveway (not modelled; separate footprint if any). Confidence: high — the `-u` photo is 11° off head-on and shows the house alone; the `+u` photo (174° off head-on) is the same view from further back.

## Frame
OBB 12.8 m (u) × 9.1 m (v); +u bears 16° (away from the street), +v 106° (ESE, toward 56 East Main). Road face `-u`, left end = -v (WNW). Flat lot (< 1 m across).

## Photos used
- `front_248462534_-u.png` — primary elevation, clean.
- `front_248462534_+u.png` — actually the street front again from further away (174° off head-on); used to confirm porch/gable.
- `front_248462534_+u_2.png` — 70 m out, shows a green Dutch-colonial and a grey hip-roofed house; neither is clearly this building. Not used.
- `front_248462534_+v.png`, `_+v_2.png` — oblique ESE side: front gable, chimney at the ridge near the front, 2nd-floor windows, ground-floor leaded window, rear cross gable facing +v with a small window in it.
- `front_248462534_-v*.png` — hedge / trees block the WNW side entirely (`-v_3` shows a fragment of a bay window through the maple). Kept plain.
- Overhead: labels 2534/2536 are outside `overhead_labeled.jpg`; roof plan taken from the obliques.

## Reading face by face
- `-u` (street, 9.1 m): 2 storeys, eaves ≈ 6.2 m, gable rise ≈ 0.44 × span with flared lower slopes. Upstairs three 1-over-1 windows at ≈ 0.31 / 0.50 / 0.71, sills right under the porch roof. Oculus in the gable at ≈ 1.3 m above the eave. Full-width porch, floor ≈ 0.9 m up on a green lattice skirt, 4 round posts, white railing, shallow hip roof, 4 steps with white handrails at ≈ 0.75. Door at ≈ 0.78 (white storm door), wide leaded window at ≈ 0.3. American flag on the porch post; Irish flag on the left.
- `+v` (12.8 m, left = street): upstairs windows at ≈ 0.4 (single) and ≈ 0.6 (pair); rear cross gable at ≈ 0.8 with a small window in the gable and one below. Downstairs a wide leaded window at ≈ 0.35 and a window ≈ 0.7. Chimney at the main ridge ≈ 3 m behind the front wall.
- `-v`, `+u`: not visible; plain windows, a rear door.

## What was modelled / exaggerated
- Main volume 12.8 × 9.1, eaves 6.2 m, gable ridge along u, pitch 0.42 (ridge +3.9 m) — the gable is kept tall and steep, which is the building's silhouette.
- Oculus enlarged to 0.9 m, three big upstairs windows, one big leaded-window stand-in downstairs.
- Open porch full width, `floorH 0.9`, `floorColor #3d7a58` so the slab reads as the green lattice skirt, 4 posts, hip roof, railing, 4 steps.
- Chimney at u -3.4 on the ridge.
- Rear cross gable as a second volume (`u 1.5..6.45`, `v 0..4.6`, ridge along v, ridge +2.1 m) pushed 5 cm proud of the main +v/+u walls to avoid coplanar z-fighting; the rear-door and +u windows live on it.

## Approximations / schema gaps
- No flared (bell-cast) gable eaves in the schema — a straight gable is used. The oculus's cross-shaped trim is not modelled.
- Round porch posts rendered as square posts. Leaded/diamond upper sashes not modelled.
- **Pipeline bug (flag for coordinator):** `openPorch()` in `src/blueprint.js` builds the porch in a local frame whose +x is the opposite of the face's "screen right" (`wrap.rotation.y = fr.rotY` maps local +x to -t), so `stepsAt` (and the default door-centred steps and railing gap) render mirrored about the porch centre, while doors placed with `place()` are correct. Workaround here: `stepsAt: 0.22` renders the steps at the real 0.78 position. If the bug is fixed, change `stepsAt` back to 0.78. Merged blueprint 248252394 (door at 0.64, full-width porch) probably shows the same mirroring today.
- `+v --compare` from 40 m is blocked by the neighbour 56 East Main (8 m off +v); the side was checked with `--iso` only.
- Detached garage behind the house not modelled (no footprint in this blueprint).

## Confidence
High on the street front (proportions, gable, oculus, porch, colours). Medium on the +v side and rear cross gable (oblique photo). Low on -v and +u (unseen, kept plain).
