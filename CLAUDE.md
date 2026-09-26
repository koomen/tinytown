# CLAUDE.md

Notes for coding agents working in this repository. Read
`docs/ARCHITECTURE.md` first: it is the contract every module follows. The CLI
(`./town <verb> --help`) is the truth for flags; the docs describe intent.

## Setup

```sh
python3 -m venv .venv && .venv/bin/pip install -e .   # Python >= 3.10; pillow, websocket-client
./town browser setup                                  # private headless Chromium -> runs/headless-browser/ (render, bake, browser tests)
node --version                                        # >= 22 for bake and tests
codex login                                           # `town author` with OpenAI models; Claude models need pip install -e ".[anthropic]" + ANTHROPIC_API_KEY
```

`./town` runs `python -B -m tinytown` with `.venv/bin/python` when present
(`PIPELINE_PYTHON` overrides). `serve`, `build`, `stage --no-bake`, `bake --check`,
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
| `stage [--target avon\|chautauqua\|all] [--no-bake]` | bake stale surfaces/streams and restamp the viewer, then stage `dist/<target>/`; `--no-bake` fails on stale instead |
| `serve [--port 8734] [--dist [TARGET]]` | dev server: `/`, `/avon`, `/chautauqua`, `/?site=<name>`; or a built dist |
| `verify <target> <domain> [site]` | live files match `dist/<target>/` |
| `browser setup\|status\|cleanup\|stop` | the private headless Chromium |
| `migrate <site>… [--dry-run]` | pre-2026-09 layout -> current layout |

## Edit -> rebuild loops

- **Viewer or generator (`src/`)**: `./town bake <site>` for every affected site
  (surfaces are fingerprinted on all `src/*.js`; streams on the generator
  modules) to view it locally, then `./town bake --viewer` and commit
  `index.html` (its `?v=` stamps hash `src/`). Baked assets are gitignored;
  Cloudflare bakes them on deploy. `./town bake <site> --check` says what is stale.
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
| `data/<site>/site.json`, `textures/` | built scene and textures (committed, deployed) |
| `data/<site>/surfaces*`, `stream/` | baked runtime assets (gitignored build output of `bake`/`stage`; deployed) |
| `scripts/cloudflare-build.sh` | Workers Builds entry point (wrangler `build.command`): venv, browser, libs, `town stage` |
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
   `deploy`, `bake --check`, `site.build`; import `PIL`/`websocket` lazily.
   (`stage` itself bakes, so running it needs the full toolchain.)
6. Python >= 3.10, Node >= 22. One browser harness (`browser.py` / `browser.mjs`).
7. Verbs are idempotent.

## Gotchas

- Surfaces and streams are never committed. `town stage` bakes what is stale
  first; Cloudflare runs `scripts/cloudflare-build.sh <target>` (via wrangler's
  `build.command`) on Ubuntu 24.04 without root, within a 20-minute limit.
  See `docs/deploy.md`.
- A fresh clone has no baked assets: `./town bake <site>` before viewing
  streamed sites locally (otherwise the viewer falls back to `?stream=0`).
- Stream export is byte-reproducible: chunks are only re-exported when their
  fingerprint is stale (or with `bake --force`), and then only chunks whose
  contents changed get new names, so local rebuilds stay cheap.
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
bakes are byte-reproducible: two Linux builds (Cloudflare) give identical
chunks, and a macOS bake matches them except chunks with canvas text (glyph
anti-aliasing differs by OS; fonts are bundled in `tinytown/web/fonts/`). `tests/browser/chautauqua-browser.py` needs
`./town stage --target chautauqua` first; `avon-isolation` and
`miniature-sectors` need `./town stage --target avon`. Drivers that read
baked streams need `./town bake avon-extended` first (`streaming`,
`streaming-startup`, `streaming-regions`, `regional-streaming`,
`streaming-zoom`, `firehouse-lod`, `camera-depth`, `viewer-cache`) or
`./town bake chautauqua` (`chautauqua-streaming`). The default `viewer` suite
needs no bake.

## Deploy checklist

1. `./town bake --viewer --check` (else `./town bake --viewer`)
2. `./town stage` (bakes what is stale, stages both targets; what Cloudflare runs)
3. `tests/run.sh`
4. Commit `data/` (baked files are ignored), `index.html`, `sites/`, `_headers`;
   push to `main`. Cloudflare bakes and deploys each Worker.
5. `./town verify avon https://avon.town` and
   `./town verify chautauqua https://chautauqua.town`.

Do not commit `dist/`, `runs/`, `.venv/`, baked `surfaces*`/`stream/`, or any
image under `data/*/buildings/`.
