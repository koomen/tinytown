# Fixing a miniature

Something looks wrong. Find the symptom, run the verb. Every command takes the
site name (`avon-extended`, `chautauqua`, or a new one) and, where it
applies, OSM way ids. Spell negative faces `--face=-u` / `--faces=-u` so
argparse does not read `-u` as an option.

| Symptom | What to do |
| --- | --- |
| A facade is wrong (windows, door, porch on the wrong side) | `./town refs <site> ID --faces=-u --force` to recapture that face, then the manual loop below. |
| A face has no photo (`fronts.json` records no coverage) | `./town refs <site> ID --faces=-u --missing` retries it; add an oblique with `--extra-views 1`; or add a curated photo to `sites/<site>/web-references.json`. |
| A building is generic (no blueprint) | `./town plan <site>` lists it as `new`; author it: `./town author <site> ID --accept`. |
| A building is missing altogether | If OSM has it and the site is scoped: `./town scope <site> --ids ID` then `./town build <site>`. If OSM lacks it: add it to `overrides.json → authored_buildings` (negative id, `[lon, lat]` ring), then `./town build <site>`. |
| A footprint OSM still has but the lot is empty | `overrides.json → buildings → {ID: {"demolished": true}}`, then `./town build <site>`. |
| A building should be authored again | `./town author <site> --reauthor ID --accept`. The candidate is compared against the accepted blueprint; it replaces it only if approved (`comparison.json`). |
| `town author` says `failed` for a building | Read `buildings/ID/author.json` (`error`, `attempts`). `--reauthor ID` clears it; `--dry-run` first to see the next step. |
| Wrong colours, floors, sign text on a non-blueprint building | Edit the style in `overrides.json → buildings` ([STYLE_SCHEMA.md](STYLE_SCHEMA.md)), `./town build <site>`. |
| Road too wide, missing centre line, wrong surface | `overrides.json → roads` keyed by name or way id (`width`, `lanes`, `marking`, `surface`); `./town build <site>`. |
| A prop, tree or parking area is missing | `overrides.json → extras` / `areas` in local metres (x east, z south); `./town build <site>`. |
| Water, pitch, pier or fence geometry is off | Edit `sites/<site>/landmarks.json` ([landmarks.md](landmarks.md)) and `./town build <site>`. |
| Terrain seam, floating pavement, stale ground after a data edit | `./town build <site>` then `./town bake <site>` (surfaces and stream are fingerprinted on `site.json` and `src/`; `--check` tells you which is stale). |
| The viewer loads old JavaScript or a stale manifest | `./town bake --viewer` restamps the `?v=` URLs in `index.html`. |
| `town stage` fails with "Baked assets are stale" | `./town bake <site>` for each named site, `./town bake --viewer`, commit `data/` and `index.html`. |
| `town stage` says the scene does not match its scope | `./town build <site>` after editing `sites/<site>/scope.json`; every scoped structure must also have a blueprint. |
| `town render --compare` or `town review` fails for want of images | Fronts and renders are gitignored. `./town refs <site> ID` (recapture) and `./town render <site> ID --face=… --force`. |
| Lint warnings in `overrides.json` | `./town lint <site> --merged -q` lists them; fix through the manual loop and re-accept. |
| Accept refuses a forced publication | It is telling the truth: inspection failed after two repairs. Fix the draft, or `./town accept <site> ID --force` knowingly. |
| The frame changed under an accepted blueprint | `town plan` shows `review-frame` (from `data/<site>/frame_review.json`). Check `./town render <site> ID --iso`; re-author or accept the drift by re-accepting the draft. |
| A whole site should move to the new layout | `./town migrate <site> --dry-run`, then without `--dry-run`. |

## The manual loop for one building

```sh
./town brief avon-extended 247541316                          # buildings/247541316/brief.md + footprint.png
./town refs avon-extended 247541316 --faces=all               # or --faces=+u,-v; --force to recapture
$EDITOR data/avon-extended/buildings/247541316/draft.json     # the blueprint, in the u/v frame
./town lint avon-extended 247541316                           # errors exit 1
./town render avon-extended 247541316 --face=+u --face=-v --compare   # renders/compare-<face>.png beside the photo
./town render avon-extended 247541316 --iso --with 247541280  # diorama camera, neighbours' drafts loaded
./town review avon-extended 247541316 --record                # lint + geometry audit + render evidence -> review.json
./town accept avon-extended 247541316                         # into overrides.json, rebuilds site.json
./town bake avon-extended                                     # new surfaces and stream chunks
```

`town render` previews the draft through the dev server with
`?site=avon-extended&free=1&bp=247541316&focus=247541316&side=+u&dist=60&notrees=1`,
so you can also open that URL in a normal browser and orbit. `--no-bp` renders
the currently accepted state for comparison; `--dist` and `--eye` move the
camera; `--stage massing` hides facade detail. Re-running with unchanged inputs
reuses the saved image; `--force` renders again.

`town accept` is all-or-nothing: a draft with lint errors, a missing or stale
review, a forced publication or an unapproved re-authoring refuses the whole
call and changes nothing. `--no-rebuild` skips `town build` when you are
accepting several buildings in a row.

## Checking your work

```sh
./town status avon-extended --ids 247541316            # derived status of one building
./town plan avon-extended --limit 8                    # what still needs work, in priority order
./town lint avon-extended --merged -q                  # every accepted blueprint
./town bake avon-extended --check && ./town bake --viewer --check
tests/run.sh
```
