# CLAUDE.md

Notes for coding agents working in this repository. Read
`docs/ARCHITECTURE.md` first: it is the contract every module follows. The CLI
(`./town <verb> --help`) is the truth for flags; the docs describe intent.

## Setup

```sh
python3 -m venv .venv && .venv/bin/pip install -e .   # Python >= 3.10; pillow, websocket-client
./town browser setup                                  # private headless Chromium -> runs/headless-browser/ (render, bake, browser tests)
node --version                                        # >= 22 for bake and tests
codex login                                           # only for `town author` (OpenAI Codex CLI)
```

`./town` runs `python -B -m tinytown` with `.venv/bin/python` when present
(`PIPELINE_PYTHON` overrides). `serve`, `build`, `stage`, `bake --check`,
`status`, `plan`, `lint` need only the standard library.

## Verbs

| Verb | One line |
| --- | --- |
| `fetch <site> [--center LAT,LON --size W,H --title T] [--no-satellite] [--force] [--aerials [ID…]]` | OSM, USGS elevation, Esri imagery into `data/<site>/source/`; crops aerials |
| `scope <site> [--ids…] [--ids-file F] [--bounds S,W,N,E] [--exclude…] [--source SITE]` | freeze `sites/<site>/scope.json`; `--source` seeds a site from another's downloads |
| `build <site>` | `source/` + `overrides.json` -> `data/<site>/site.json` (milliseconds) |
| `refs <site> [ids…] [--all] [--list F] [--faces=+u,-v\|all\|road] [--force] [--missing] [--aerials] [--web] [--extra-views N]` | Street View fronts, aerials, model packet into `buildings/<id>/` |
| `brief <site> [ids…] [--list F]` | `buildings/<id>/brief.md` + `footprint.png` |
| `plan <site> [--limit N] [--out F] [--json]` | what still needs research/authoring/review, by priority |
| `render <site> <id> [--face=F]… [--dist M] [--iso] [--with ID…] [--no-bp] [--compare] [--force] [--trees]` | screenshot a draft through the viewer; `compare-<face>.png` beside the photo |
| `lint <site> [ids…] [--merged] [-q]` | blueprint lint (drafts, or `overrides.json` with `--merged`); errors exit 1 |
| `review <site> ids… [--stage massing\|detail] [--record]` | non-model review: lint + geometry audit + render evidence -> `review.json` |
| `author <site> [ids…] [--all] [--reauthor ID…] [--accept] [--force] [--dry-run] [--workers N] [--max-tokens N] [--max-seconds S]` | stages 3–6 per building: references, author, render, review, <= 2 repairs, scene critique, accept |
| `accept <site> [ids…] [--all-reviewed] [--force] [--no-rebuild]` | reviewed drafts -> `overrides.json`, then `build`; the only writer of blueprints |
| `status <site> [--ids…]` | derived per-building status |
| `bake <site> [--check] [--surfaces-only\|--stream-only]`, `bake --viewer [--check]` | surfaces + stream chunks for a site; `?v=` stamps in `index.html` |
| `deploy [--target avon\|chautauqua\|all] [--no-check]` | stage `dist/<target>/` after `bake --check` and viewer checks |
| `serve [--port 8734] [--dist [TARGET]]` | dev server: `/`, `/avon`, `/chautauqua`, `/?site=<name>`; or a built dist |
| `verify <target> <domain> [site]` | live files match `dist/<target>/` |
| `browser setup\|status\|cleanup\|stop` | the private headless Chromium |
| `migrate <site>… [--dry-run]` | pre-2026-09 layout -> current layout |

## Edit -> rebuild loops

- **Viewer or generator (`src/`)**: `./town bake <site>` for every affected site
  (surfaces are fingerprinted on all `src/*.js`; streams on the generator
  modules), then `./town bake --viewer`, then commit the regenerated `data/`
  and `index.html`. `./town bake <site> --check` says what is stale.
- **Authored data (`data/<site>/overrides.json`, `sites/<site>/landmarks.json`,
  `scope.json`)**: `./town build <site>` then `./town bake <site>`.
- **A blueprint**: edit `buildings/<id>/draft.json` -> `town lint` ->
  `town render --compare` -> `town review --record` -> `town accept` (rebuilds)
  -> `town bake`. Or `town author <site> --reauthor ID --accept`.
- **Docs the model reads**: `docs/MINIATURE_KIT.md` is sent verbatim in every
  author prompt; `docs/miniature_examples.json` (falling back to
  `pipeline/miniature_examples.json`) supplies the style examples.

## Where things live

| Path | What |
| --- | --- |
| `tinytown/<stage>.py` | one module per stage; each with verbs exposes `register(subparsers)`; `cli.py` maps verbs to modules |
| `tinytown/paths.py`, `config.py`, `state.py` | every filesystem path; site/deploy config and derived routes; fingerprints, atomic JSON, status derivation |
| `tinytown/plugins/<site>.py` | per-site hooks: `extra_sources`, `landmarks`, `outline`, `refine_building`, `scope_filter` |
| `tinytown/web/` | `precompute.html` (surfaces), `prepare_streaming.mjs` + `stream-export.*` (chunks) |
| `index.html`, `src/` | the viewer, served as-is |
| `sites/<site>/site.json` | title, description, domain, `deploy` placements, `plugin`, `scope`, `landmarks`, `outline`, `social_image` |
| `sites/deploy.json` | target -> `{dist, wrangler}` |
| `data/<site>/source/` | stage-1 inputs (`satellite.jpg` gitignored; cache in `data/.town-cache/`) |
| `data/<site>/overrides.json` | the authored truth: `buildings`, `blueprints`, `blueprint_frames`, `miniature_review`, `roads`, `extras`, `areas`, `landmarks`, `footprints`, `authored_buildings`, `authored_roads`, `notes`, `seed`, `title` |
| `data/<site>/site.json`, `surfaces*`, `stream/`, `textures/` | built scene and runtime assets (committed, deployed) |
| `data/<site>/buildings/<id>/` | per-building records; images gitignored |
| `tests/unit`, `tests/node`, `tests/browser`, `tests/run.sh` | see Tests |
| `runs/` | gitignored: browser runtime, `runs/model-calls/` scratch |

## Rules (from ARCHITECTURE.md)

1. Paths come from `paths.py`; never build `data/…` or `sites/…` by hand.
2. Sites are config. No `if site == 'chautauqua'` anywhere in `tinytown/`;
   per-site behaviour is `sites/<site>/site.json` or a plugin hook it names.
3. Per-building state is the files in `buildings/<id>/`; status is derived,
   never ledgered.
4. `overrides.json` is the authored truth; `accept` is the only thing that
   writes blueprints into it. Drafts are proposals.
5. Standard library only at import time for `config`, `paths`, `state`,
   `stage`, `bake --check`, `site.build`; import `PIL`/`websocket` lazily.
6. Python >= 3.10, Node >= 22. One browser harness (`browser.py` / `browser.mjs`).
7. Verbs are idempotent.

## Gotchas

- `town stage` (and the Cloudflare build) fails if surfaces, streams or the
  viewer stamps are stale. Bake, restamp, commit `data/` + `index.html` first.
- Stream export is byte-reproducible: chunks are only re-exported when their
  fingerprint is stale (or with `bake --force`), and then only chunks whose
  contents changed get new names. Commit the deletions with the additions.
- `/` on avon.town is `avon-extended`; `/avon` and `/extended` are aliases of the same
  larger miniature. Routes come from `sites/*/site.json`,
  `_headers` still lists them by hand.
- `--faces=-u`, `--face=-u`: the `=` keeps argparse from reading `-u` as an option.
- Keep `town refs --workers` at 2; 3+ makes Google flaky.
- `town author` with no ids means `--all`. On a scoped site (Chautauqua) keep
  `sites/<site>/scope.json` in place and named in `site.json` before `--all`,
  or every mapped building in the box becomes work.
- Renders, fronts, aerials and web images are gitignored, so `town render
  --compare` and `town review` fail closed on a fresh clone until you
  re-capture and re-render.
- `town accept` refuses forced publications (two failed repairs) and
  unapproved re-authoring unless `--force`; it is all-or-nothing per call.
- `town author` and `town render` start the dev server on 8734 and the
  private browser themselves; `town browser cleanup` disposes leaked contexts.
- `sites/<site>/site.json` needs `title` and `description` to deploy.
- Env: `PIPELINE_PYTHON`, `PIPELINE_BROWSER_STATE_DIR`, `CODEX_HOME`, `TOWN_BENCH_*`.

## Tests

```sh
tests/run.sh                                                   # everything that needs no network or model
.venv/bin/python -B -m unittest discover -s tests/unit -t .   # python unit tests; no browser, network or model
node --test tests/node/*.test.mjs                              # viewer/generator logic; Node 22
node tests/browser/run.mjs [--list | name… | all]             # headless suites; private browser + network (CDN); some need dist/
.venv/bin/python tests/browser/headless-integration.py         # real browser isolation/restart checks
```

Golden checks: `./town build <site>` must reproduce the committed
`data/<site>/site.json` for both sites (apart from `name`), and
`./town stage` must reproduce the committed dist hashes apart from `?v=`
stamps. `tests/browser/chautauqua-browser.py` needs
`./town stage --target chautauqua` first.

## Deploy checklist

1. `for s in avon-extended chautauqua; do ./town bake "$s" --check; done`
2. `./town bake --viewer --check`
3. `./town stage` (stages both targets; same checks Cloudflare runs)
4. `tests/run.sh`
5. Commit `data/`, `index.html`, `sites/`, `_headers`; push to `main`.
6. `./town verify town https://avon.town` and
   `./town verify chautauqua https://chautauqua.town`.

Do not commit `dist/`, `runs/`, `.venv/`, or any image under
`data/*/buildings/`.
