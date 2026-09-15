# Authoring miniatures with a model

`town author` turns photographs of a real building into a blueprint
([BLUEPRINT_SCHEMA.md](BLUEPRINT_SCHEMA.md)) using two model roles, a bounded
number of repairs, and deterministic checks between every step. The goal is a
charming, recognisable caricature at normal diorama viewing distance, not a
measured reconstruction. This page is the policy; `tinytown/author.py` is the
implementation and `./town author --help` the option list.

## Requirements

Authoring is the only stage that needs a model. It shells out to the OpenAI
Codex CLI (`codex exec`), so `codex` must be installed and logged in
(`codex login`); credentials stay in `CODEX_HOME` (default `~/.codex`) and are
never read or copied. Model aliases come from `tinytown/model.py`:

| Alias | Model | Default role |
| --- | --- | --- |
| `astra` | `gpt-6-astra` | author and repairs (`--author-model`) |
| `sol` | `gpt-5.6-sol` | building review, scene critique, baseline comparison (`--reviewer-model`) |
| `terra`, `luna` | `gpt-5.6-terra`, `gpt-5.6-luna` | alternatives; any literal model id also works |

Each call is a fresh, non-interactive session with the model's tools disabled,
the images attached and a strict JSON schema for the response. Token usage is
measured from the CLI's event stream, never estimated. `--codex PATH` selects
another binary; a different backend can register itself in `model.BACKENDS`.

It also needs the private headless browser (`./town browser setup`) for Street
View capture and renders, network access, and the `pillow` and
`websocket-client` packages from `pip install -e .`.

## The state machine

`town author <site> [IDS…]` (no ids = `--all`: every structure in `site.json`
that is not `accepted` or `failed`) derives each building's status from the
files under `data/<site>/buildings/<id>/` and runs only the missing steps:

| Step | Who | Produces |
| --- | --- | --- |
| references | code, browser, web | `fronts.json` (Street View, all four faces, `--capture missing` reuses existing photos, `reuse-only` never captures), `aerial.json` (crop from the Esri mosaic), `references.json` (the packet: a labelled Street View sheet, a north-up orientation map with footprint, face normals, roads and camera poses, the aerial, up to `--max-web-images` web photos from `sites/<site>/web-references.json` or a Bing image search, `--extra-street-views 1|2` oblique panoramas) |
| author | author model | `author.json`, `draft.json` (only when the blueprint validates). The prompt is the packet, the brief, [MINIATURE_KIT.md](MINIATURE_KIT.md) verbatim, two approved style examples, and the accepted blueprint as a baseline when re-authoring. It returns a complete blueprint, 3–5 recognition cues, uncertainties and an entrance plan (volume, outward face, role, evidence, confidence). |
| render | code, browser | `renders/<phase>-{+u,-u,+v,-v,overview}.png` and a labelled four-face sheet `<phase>-faces.jpg`, plus the door inventory computed from the rendered blueprint |
| review | reviewer model | `review.json`: `ready`, `repair` or `insufficient-evidence`, at most three actionable issues, and an explicit orientation verdict (`correct` / `incorrect` / `uncertain`) with a source-to-face explanation |
| repair N | author model | `repair-N.json` and a new `draft.json`; a hash-bound patch or a full replacement, then render and review again. At most `MAX_REPAIRS` = 2. |
| scene | reviewer model | one batch critique of every reviewed building's overview and four-face sheet; `needs-attention` verdicts use a remaining repair round, never a third |
| compare | reviewer model | `comparison.json` for a re-authored building (`--reauthor ID`): the accepted baseline and the candidate side by side; the candidate replaces the baseline only with an explicit `approved` |
| accept | code | with `--accept`: drafts → `overrides.json` (`blueprints`, `blueprint_frames`, `miniature_review`), then `town build` |

Re-running the same command resumes: completed responses are reused, nothing
is called twice. There is no campaign ledger, no run directory and no
supervisor; model-call scratch goes to `runs/model-calls/` (gitignored).
`--dry-run` prints each building's status and next step without touching the
model or the browser.

## Policy

- **Bounded.** One author call, one review, at most two repairs each with a
  fresh inspection, one scene critique. No evidence loops, no re-reviews, no
  escalation. A failed transport attempt is recorded and counts toward usage;
  after `ATTEMPTS` = 3 tries a call is terminal and the building is `failed`.
- **Forced publication.** After the second repair the latest *valid* draft is
  recorded as `reviewed` even if inspection still fails. Its
  `miniature_review.publication` says `forced: true` and keeps the failed
  verdict and issues; publishing never turns a failure into an approval.
  `town accept` refuses such a building unless `--force` is given (or `town
  author --accept --force`). An invalid last repair leaves the previous valid
  draft in place.
- **Baseline comparison.** A re-authored building never silently replaces an
  accepted one. The reviewer must approve the candidate against the baseline,
  tied to both blueprint hashes and the saved views; otherwise the accepted
  blueprint stays and `accept` refuses the draft (again `--force` overrides,
  deliberately).
- **Orientation is evidence-based.** The author's entrance plan is a claim.
  The reviewer checks it against the geolocated camera positions, the map and
  the actual door inventory. Camera heading is not the outward face bearing,
  the nearest road is not the entrance, an unlocated web photo establishes
  appearance only, and a duplicated or mirrored principal entrance is not
  `ready`.
- **Not objectives:** exact window counts, hidden elevations, photographic
  perfection. Simplification is encouraged; changing which way an entrance
  faces is not.
- **Budgets.** `--max-tokens` (default 100,000 input + output) and
  `--max-seconds` (600 of active execution) are admission limits shared by
  every call of the run; 18,000 tokens are reserved per author/repair call and
  10,000 per review before admission. In-flight calls finish and are recorded
  when the budget runs out or on Ctrl-C. `--call-timeout` (120 s) bounds one
  call. `--workers` runs 1–6 buildings concurrently; rendering is serialised
  through one browser.

## What the model sees

- **Images**, in this order: the references (Street View sheet, orientation
  map, aerial, web photos), then for reviews the model's own overview and the
  labelled four-face sheet. Attachments are resized to at most 900 px; the
  Street View sheet is up to 1400 × 1590 and the orientation map 900 × 820.
- **Text**: the building's identity (`sites/<site>/labels.json` names
  structures OSM does not), footprint frame with compass bearings for every
  face, terrain, neighbours, `docs/MINIATURE_KIT.md` in full (so an edit to
  that file changes every prompt), two approved style examples, and the
  fixed task instructions in `author.py` (`AUTHOR_TASK`, `REVIEW_TASK`,
  `SCENE_TASK`, `COMPARISON_TASK`).
- **Never**: a shell, the filesystem, web browsing or delegation. Search and
  capture happen in code before the call; renders happen in code after it.

Web images are fetched for local reference only, are never committed
(`images/` is gitignored) and may show the wrong subject; a curated
`sites/<site>/web-references.json` is more reliable than the Bing adapter.

## Without a model

Every step except the model calls has a verb, so a person can author too:
`town refs`, `town brief`, edit `buildings/<id>/draft.json`, `town lint`,
`town render --compare`, `town review <site> ID --record` (lint, geometry
audit and render evidence, no model), `town accept`. See
[fixing.md](fixing.md) for the loop and [pipeline.md](pipeline.md) for where it
sits in a new town.
