# Authoring miniatures with a model

`town author` turns photographs of a real building into a blueprint
([BLUEPRINT_SCHEMA.md](BLUEPRINT_SCHEMA.md)) using two model roles, a bounded
number of repairs, and deterministic checks between every step. The goal is a
charming, recognisable caricature at normal diorama viewing distance, not a
measured reconstruction. This page is the policy; `tinytown/author.py` is the
implementation and `./town author --help` the option list.

## Requirements

Authoring is the only stage that needs a model. Two providers are supported,
chosen per role by the model name (`tinytown/model.py`):

- **OpenAI** through the Codex CLI (`codex exec`): `codex` must be installed
  and logged in (`codex login`); credentials stay in `CODEX_HOME` (default
  `~/.codex`) and are never read or copied. `--codex PATH` selects another binary.
- **Anthropic** through the Messages API: `pip install -e '.[anthropic]'` and
  `ANTHROPIC_API_KEY` in the environment (read by the SDK, never logged).

| Alias | Model | Provider | Default role |
| --- | --- | --- | --- |
| `astra` | `gpt-6-astra` | OpenAI | author and repairs (`--author-model`) |
| `sol` | `gpt-5.6-sol` | OpenAI | building review, scene critique, baseline comparison (`--reviewer-model`) |
| `terra`, `luna` | `gpt-5.6-terra`, `gpt-5.6-luna` | OpenAI | alternatives |
| `opus` | `claude-opus-5-5` | Anthropic | alternative author or reviewer |
| `sonnet`, `fable`, `haiku` | `claude-sonnet-5`, `claude-fable-5-1`, `claude-haiku-4-5-20251001` | Anthropic | alternatives |

Any literal model id also works; ids starting `claude-` go to Anthropic. Roles
can mix providers, e.g. `--author-model opus --reviewer-model sol`; a reviewer
from a different model family is less inclined to approve its own style.

Each call is a fresh, non-interactive request with no tools, the images
attached and a strict JSON schema for the response. Token usage is measured
from the provider's reports, never estimated. The kit and style examples are
sent as a cacheable prompt prefix (Anthropic prompt caching; Codex receives the
joined text). A different backend can register itself in `model.BACKENDS`.

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
| author | author model | `author.json`, `draft.json` (only when the blueprint validates). The prompt is the task and [MINIATURE_KIT.md](MINIATURE_KIT.md) verbatim (a cacheable prefix shared by every call), 3–4 style examples retrieved for this building (below), the packet and brief, and the accepted blueprint as a baseline when re-authoring. It returns a complete blueprint, 3–5 recognition cues, uncertainties and an entrance plan (volume, outward face, role, evidence, confidence). |
| fix | author model | An invalid author or repair response gets one cheap call (kit, the rejected blueprint and its validation errors; no images) whose patch or blueprint is validated again. Recorded in the response's `fixes`; a valid fix becomes the draft. It never consumes a repair round. |
| render | code, browser | `renders/<phase>-{+u,-u,+v,-v,overview}.png`, a labelled four-face sheet `<phase>-faces.jpg`, and `<phase>-pairs.jpg`: one row per face with the geolocated Street View photo beside the render of the same side, labelled with outward bearing and road. Plus the door inventory computed from the rendered blueprint. |
| self-check N | author model | `self-check-N.json`: before the first independent review the author sees its own pairs sheet and overview and returns a patch (or an empty one). A changed draft is rendered as phase `initial-check-N`. `--self-checks 0..2` (default 1); not a repair. |
| review | reviewer model | `review.json`: `ready`, `repair` or `insufficient-evidence`, at most three actionable issues (each a blueprint edit), 1–5 rubric scores (silhouette, roof, materials, entrance, details, overall) and an explicit orientation verdict (`correct` / `incorrect` / `uncertain`) with a source-to-face explanation. Earlier drafts' reviews are kept in `history`. |
| repair N | author model | `repair-N.json` and a new `draft.json`; a hash-bound patch or a full replacement, then render and review again. At most `MAX_REPAIRS` = 2. |
| human repair N | author model | `human-repair-N.json` and a new `draft.json`, answering pending entries in `human-feedback.json` (written by the change queue's Buildings view or `town changes iterate`). The human text leads the prompt and outranks the automated review. It runs even after a passed review, spent repair rounds or acceptance, never uses a repair round, answers each entry once, and a draft it produces replaces an accepted blueprint without a baseline comparison (the human approves it in the queue). |
| scene | reviewer model | one batch critique of every reviewed building's overview and photo/render sheet; `needs-attention` verdicts use a remaining repair round, never a third |
| compare | reviewer model | `comparison.json` for a re-authored building (`--reauthor ID`): the accepted baseline and the candidate side by side; the candidate replaces the baseline only with an explicit `approved` |
| accept | code | with `--accept`: drafts → `overrides.json` (`blueprints`, `blueprint_frames`, `miniature_review`), then `town build` |

Re-running the same command resumes: completed responses are reused, nothing
is called twice. There is no campaign ledger, no run directory and no
supervisor; model-call scratch goes to `runs/model-calls/` (gitignored).
`--dry-run` prints each building's status and next step without touching the
model or the browser.

## Policy

- **Bounded.** One author call, at most one validation fix per response, up
  to two self-checks, one review, at most two repairs each with a fresh
  inspection, one scene critique. No evidence loops, no re-reviews, no
  escalation. A failed transport attempt is recorded and counts toward usage;
  after `ATTEMPTS` = 3 tries a call is terminal and the building is `failed`
  (a fix or self-check call is tried once and simply skipped on failure).
- **The author looks before it is judged.** Self-checks show the author its
  own render beside the matching photographs and let it patch obvious
  discrepancies (roof direction, missing porch, wrong palette) before the
  independent reviewer spends a verdict and a repair round on them.
- **Validation is not a repair.** A blueprint the schema or lint rejects gets
  one targeted fix call. `validate()` combines lint errors, unknown keys and
  `review.schema_errors()` (types and enums from `review.blueprint_json_schema()`,
  a JSON Schema generated from the lint key tables).
- **Forced publication, best draft.** After the second repair the latest
  *valid* draft is recorded as `reviewed` even if inspection still fails. If
  an earlier reviewed draft scored strictly better on the rubric (overall,
  then the sum of the criteria), that draft and its review are restored and
  `review.json`'s `selected_draft` records both scores. Its
  `miniature_review.publication` says `forced: true` and keeps the failed
  verdict and issues (plus `selected_draft`); publishing never turns a failure
  into an approval. `town accept` refuses such a building unless `--force` is
  given (or `town author --accept --force`). An invalid last repair leaves the
  previous valid draft in place.
- **Baseline comparison.** A re-authored building never silently replaces an
  accepted one. The reviewer must approve the candidate against the baseline,
  tied to both blueprint hashes and the saved views; otherwise the accepted
  blueprint stays and `accept` refuses the draft (again `--force` overrides,
  deliberately).
- **Orientation is evidence-based, and proportionate.** The author's entrance
  plan is a claim. The reviewer checks it against the geolocated camera
  positions, the map and the actual door inventory. Camera heading is not the
  outward face bearing, the nearest road is not the entrance, an unlocated web
  photo establishes appearance only, and a duplicated or mirrored principal
  entrance is `incorrect`. Each building has an `orientation_policy`:
  `strict` for churches, commercial, civic and institutional buildings,
  anything with amenity/shop/office/tourism/historic tags, and footprints over
  600 m²; `lenient` for ordinary houses, garages and outbuildings. Under
  `lenient`, `uncertain` orientation, an `insufficient-evidence` verdict and
  issues that only report missing evidence do not ask for a repair (a repair
  edits geometry; it cannot produce a photograph); `incorrect` still does.
  Reviewers are told to put evidence gaps in the summary, not in issues.
- **Not objectives:** exact window counts, hidden elevations, photographic
  perfection. Simplification is encouraged; changing which way an entrance
  faces is not.
- **Budgets.** `--max-tokens-per-building` (default 300,000) caps each
  building's calls within a run; a building that reaches it stops with an
  error while the others continue. `--max-tokens` and `--max-seconds` are
  optional run-wide limits (default unlimited, so the run is bounded by the
  per-building cap times the number of buildings). Admission reserves 30,000
  tokens per author/repair/self-check call, 12,000 per review or fix, 16,000
  per scene critique. In-flight calls finish and are recorded when a budget
  runs out or on Ctrl-C. `--call-timeout` (300 s) bounds one call. The author
  runs at `--author-effort high` and the reviewer at `--reviewer-effort medium`;
  `--reasoning-effort` sets both. Blueprints may use up to about 8,000 output
  tokens. `--workers` runs 1–6 buildings concurrently; rendering is serialised
  through one browser.

## Style examples

Each author prompt carries 3–4 approved examples chosen for the building:
accepted blueprints of the same site whose review was `ready` and not a forced
publication (legacy custom-geometry blueprints are excluded), ranked by same
building kind (house, garage, outbuilding, apartments, commercial, civic,
church, from OSM tags and the generic style), similar footprint area and the
same generic roof guess, ties broken by id, at most 24,000 characters in
total. The selection is deterministic, so a resumed run sends the same prompt.
`tinytown/miniature_examples.json` fills in when fewer than two fit.

## What the model sees

- **Images**, in this order: the references (orientation map, aerial, web
  photos, and the Street View atlas when there is no photo/render sheet or
  when the packet has extra oblique views), then for self-checks, reviews
  and repairs the `<phase>-pairs.jpg` photo|render sheet (or the labelled
  four-face sheet when no face has a photo) and the model's overview. The
  scene critique sees the scene and each building's sheet. Attachments are
  resized to at most 900 px; the Street View sheet is up to 1400 × 1590 and
  the orientation map 900 × 820.
- **Text**: the building's identity (`sites/<site>/labels.json` names
  structures OSM does not), footprint frame with compass bearings for every
  face, terrain, neighbours, `docs/MINIATURE_KIT.md` in full (so an edit to
  that file changes every prompt), the retrieved style examples, the
  building's orientation policy, and the fixed task instructions in
  `author.py` (`AUTHOR_TASK`, `FIX_TASK`, `SELF_CHECK_TASK`, `REVIEW_TASK`,
  `SCENE_TASK`, `COMPARISON_TASK`). Author, fix and self-check prompts are
  sent as segments whose stable prefix (task + kit, then the examples) is
  marked cacheable for providers with prompt caching.
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
