# Architecture

tiny-town generates small 3D miniatures of real places and serves them in a
browser. This document is the contract every module follows. Read it before
touching `tinytown/`.

## The pipeline

Every miniature moves through eight stages. A structure (building) moves
through the middle four independently of every other structure.

| # | Stage | Verb | Reads | Writes |
|---|-------|------|-------|--------|
| 1 | Fetch source data for a bounding box | `town fetch` | network (OSM, USGS elevation, Esri imagery) | `data/<site>/source/` |
| 2 | Scope which structures are in the miniature | `town scope` | `source/`, `sites/<site>/scope.json` | `sites/<site>/scope.json` |
| 3 | Gather references per building | `town refs` | `source/`, Street View, aerial crops, web images | `data/<site>/buildings/<id>/` |
| 4 | Author a blueprint per building | `town author` | building references, `overrides.json` | `buildings/<id>/draft.json`, `author.json` |
| 5 | Review and repair, bounded | `town review`, `town lint` | draft, renders | `buildings/<id>/review.json`, `repair-N.json` |
| 6 | Accept into the authored truth | `town accept` | drafts | `data/<site>/overrides.json` |
| 7 | Build the scene and bake assets | `town build`, `town bake` | `source/`, `overrides.json`, the renderer in headless Chromium | `data/<site>/site.json`, `surfaces*.bin.gz`, `stream/` |
| 8 | Stage and deploy | `town stage`, `town verify`, `town serve` | scenes, `sites/`, `index.html`, `src/` | `dist/<target>/` |

`town author` runs stages 3 through 6 for many buildings in one command. It is
idempotent: status is derived from files on disk, so re-running it resumes.
There is no campaign ledger, no separate resume tool, and no supervisor.

## Layout

```
tiny-town/
  town                 CLI shim: exec python -m tinytown "$@" (prefers .venv/)
  pyproject.toml       package metadata; `pip install -e .` gives you `town`
  tinytown/            the Python package (one module per stage, see below)
    web/               browser-side helpers the pipeline drives: bake pages, stream export
    plugins/           per-site code hooks (landmarks, outlines); one module per site that needs one
  index.html, src/     the viewer (Three.js). Runtime only. Served as-is.
  sites/<site>/        deployment metadata per miniature: site.json, icons, scope.json, labels.json,
                       web-references.json, landmarks.json, outline.json
  sites/deploy.json    deploy targets -> dist directory and wrangler config
  data/<site>/         the miniature (see "Data layout")
  tests/unit/          python unittest, one file per module: test_<module>.py
  tests/node/          node --test suites for src/ and tinytown/web
  tests/browser/       headless-browser drivers (*.mjs) and their check modules (checks/*.js)
  tests/run.sh         runs everything that does not need network or a model
  docs/                this file plus deep dives
  wrangler.avon.jsonc, wrangler.chautauqua.jsonc, _headers   Cloudflare
```

## Modules

Each module is one file in `tinytown/` and owns one stage. Every module that
has CLI verbs exposes `register(subparsers)`; `cli.py` maps verbs to modules
and imports a module only when one of its verbs runs.

| Module | Owns | Verbs | Replaces (old `pipeline/`) |
|--------|------|-------|-----------------------------|
| `paths.py` | every filesystem path; `SitePaths`, `BuildingPaths` | | hard-coded paths everywhere |
| `config.py` | `sites/*/site.json`, `sites/deploy.json`; routes derive from these | | `site_routes.ROUTES` |
| `state.py` | fingerprints, atomic JSON, per-building status derivation | `status` | `work_state`, `artifact_patch` |
| `sources.py` | fetching OSM, elevation, imagery; aerial crops | `fetch` | `fetch_site`, `aerial_refs` |
| `site.py` | source + overrides -> `site.json`; scoping; geometry helpers | `build`, `scope` | `build_site`, `geom`, `diorama_outline`, `prepare_chautauqua*`, `expansion_prepare`, `subset_site` |
| `plugins/<site>.py` | landmark and outline hooks called by `site.py` | | `avon_landmarks`, `chautauqua_landmarks` |
| `references.py` | Street View fronts, extra views, orientation, aerial packets, web images, briefs, footprint cards, research planning | `refs`, `brief`, `plan` | `capture_fronts`, `sv_urls`, `miniature_references`, `miniature_views`, `miniature_orientation`, `photo_match`, `brief`, `footprint_card`, `plan_research` |
| `review.py` | blueprint lint, geometry audit, review policy and records, repair counting | `lint`, `review` | `lint_blueprint`, `geometry_audit`, `review_blueprint`, `miniature_policy`, the live parts of `fidelity` |
| `render.py` | rendering a building or scene through the viewer; comparisons | `render` | `render_bp`, `miniature_render` |
| `browser.py` + `browser.mjs` | one headless Chromium harness for Python and Node | `browser` | `headless`, `private_browser`, `browser.mjs`, `setup_browser` (deleted: `agent_browser`, `terminal_browser`) |
| `model.py` | the model adapter (Codex CLI today); usage accounting; `BudgetExhausted` | | `miniature_model`, `model_runner`, the model parts of `fidelity_runner` |
| `author.py` | per-building author/review/repair state machine; concurrency; budgets; scene critique; accept | `author`, `accept` | `miniature_pipeline`, `fidelity_runner`, `run_diorama`, `expand_diorama`, `expansion_queue`, `publish_*`, `merge_blueprints`, `production_baseline`, `renderer_snapshot` |
| `changes.py` | local source-change queue, isolated workspaces, worker events, approval, dashboard and preview URLs | `changes`, `preview` | |
| `change_bakes.py` | task bake snapshots, serialized bake jobs and immutable map serving | `changes bake` | |
| `change_merge.py` | three-way text and structured JSON merge rules | | |
| `preview.py` | cropped and whole-map live-source scenes and preview documents | | |
| `change_worker.py` | standalone worker progress/preview reporter, scoped to one queue pass | `changes report` | |
| `bake.py` + `web/` | terrain/pavement surfaces, streaming chunks, viewer version stamping | `bake` | `precompute_surfaces`, `precompute.html`, `prepare_streaming.mjs`, `stream-export.*`, `stream-asset-limits.mjs`, `version_viewer` |
| `deploy.py` | route documents, dist staging per target, dev server, live verification | `stage`, `serve`, `verify` | `build_routes`, `build_deployment`, `site_routes`, `verify_deployment`, `serve.py` |
| `migrate.py` | one-time move from the pre-2026-09 layout | `migrate` | |

Deleted outright, not ported: `resume_expansion`, `watch_expansion`,
`supervise_expansion`, `pin_expansion_renderer`, `benchmark_expansion`,
`publish_saved_miniatures`, `restore_avon_region`, `compose_neighborhood`,
`build_avon_production`, `merge_research`, `agent_browser`, `terminal_browser`,
`progress.html`, `resume-avon.sh`, `production/`, `archives/`, `benchmarks/`.

## Rules

1. **Paths come from `paths.py`.** No module builds a `data/...` or `sites/...`
   path by hand. Add a property to `SitePaths`/`BuildingPaths` if one is missing.
2. **Sites are config, not code.** Nothing in `tinytown/` may compare a site
   name to a literal (`if site == 'chautauqua'`). Per-site behaviour goes in
   `sites/<site>/site.json` or a `plugins/<site>.py` hook named in that config.
3. **Per-building state lives in `data/<site>/buildings/<id>/`** and status is
   derived from which files exist and whether their recorded fingerprints match
   current inputs. Never keep a separate ledger of what is done.
4. **`overrides.json` is the authored truth.** Drafts are proposals; `accept`
   is the only thing that writes blueprints into `overrides.json`.
5. **Stdlib only on the deploy path.** `config`, `paths`, `state`, `deploy` (the `stage` verb),
   `bake --check`, and `site.build` must import nothing outside the standard
   library at module import time. Cloudflare runs them with bare `python3`.
   Import `PIL` and `websocket` lazily inside the functions that need them.
6. **Python 3.10 or newer**; Node 22 or newer for anything under `web/` and
   for tests.
7. **One browser harness.** Everything that needs Chromium goes through
   `browser.py` (Python) or `browser.mjs` (Node).
8. **Verbs are idempotent.** Re-running a verb with the same inputs does no
   work and exits 0.

## Data layout

The source-change queue stores its own requests, events and isolated Git
workspaces under gitignored `runs/changes/`. This is job state for source edits,
not a second ledger of per-building authoring status. Snapshots include dirty
source files but exclude ignored private files and generated bake assets.
Approval merges against the snapshot baseline before applying any files to the
checkout. Overlapping edits queue an isolated repair pass and return for review.
Task world bakes use separate immutable snapshots; Whole map serves their assets. See [changes.md](changes.md).

```
data/<site>/
  source/                  stage 1 output and other acquisition inputs
    site_request.json      centre, size, title as requested
    osm.json  elevation.json  satellite.json  (satellite.jpg is gitignored)
    <name>-osm.json        extra OSM extracts a plugin asks for (lake, barriers)
    sv_index.json          Street View pano index built while capturing
    composition.json       provenance: bounds, structure counts, imported ids
  overrides.json           the authored truth: buildings, blueprints, blueprint_frames,
                           roads, extras, landmarks, areas, miniature_review, ...
  site.json                built scene (stage 7); regenerable from source + overrides
  surfaces.json  surfaces-<hash>.bin.gz      baked terrain and pavement
  stream/manifest.json  stream/<chunk>-<hash>.bin.gz   baked geometry chunks
  textures/                curated images referenced from blueprints
  frame_review.json        ids whose footprint frame drifted under an accepted blueprint (written by build)
  buildings/<id>/          everything about one structure
    brief.md  footprint.png   human-readable brief for the author (footprint, faces, context) and its card
    fronts.json            Street View capture records; fronts/*.png are gitignored
    aerial.json            aerial crop record; aerial*.png gitignored
    references.json        the packet assembled for the model (which images, why); images/ gitignored
    draft.json             the working blueprint (proposal)
    notes.md               author notes
    author.json            last author response and usage
    review.json            last review verdict, findings, renderer signature
    repair-<n>.json        repair responses
    comparison.json        re-authoring verdict against the accepted baseline
    renders/<view>.png.json   render records (png gitignored)
sites/<site>/
  site.json                title, description, domain, deploy placements, plugin, scope, landmarks, outline
  scope.json               frozen structure ids, exclusions, bounds (optional)
  labels.json  web-references.json   known names and curated web images (optional)
  landmarks.json  outline.json        geographic sidecars a plugin projects (optional)
  favicon.*  apple-touch-icon.png  social-preview.jpg   (optional; falls back to repo root)
```

Status of a building, derived by `state.building_status(paths, bid)`:

| Status | Condition |
|--------|-----------|
| `unreferenced` | no `fronts.json`, `aerial.json` or `references.json` |
| `referenced` | references exist, no `draft.json` |
| `drafted` | `draft.json` exists, no `review.json` for its fingerprint |
| `needs-repair` | `review.json` for this draft has findings and repairs remain |
| `reviewed` | `review.json` for this draft passed, or repairs exhausted |
| `accepted` | `overrides.json` blueprint for `id` has the same fingerprint as `draft.json` |
| `failed` | `author.json` records a terminal error |

## Site config

`sites/<site>/site.json`:

```json
{
  "title": "Chautauqua Institution, New York",
  "description": "...",
  "domain": "https://chautauqua.town",
  "deploy": [
    {"target": "chautauqua", "route": "/"},
    {"target": "avon", "route": "/chautauqua"}
  ],
  "plugin": "chautauqua",
  "scope": "scope.json",
  "landmarks": "landmarks.json",
  "outline": "outline.json",
  "social_image": {"alt": "...", "width": 1200, "height": 630}
}
```

`scope`, `landmarks` and `outline` name sidecar files relative to
`sites/<site>/` (for example, `landmarks.json`). `title` and
`description` are required to deploy. `sites/deploy.json` maps targets to
dist directories and Wrangler configs:

```json
{"avon": {"dist": "dist/avon", "wrangler": "wrangler.avon.jsonc"},
 "chautauqua": {"dist": "dist/chautauqua", "wrangler": "wrangler.chautauqua.jsonc"}}
```

`config.routes(target)` returns `{route: site}` for one target. The site whose
route is `/` is the target's root. Aliases (`/extended` -> `/avon-extended`)
are listed as `"aliases": ["/extended"]` on a placement.

A plugin is a module `tinytown/plugins/<name>.py` that may define any of:

```python
def extra_sources(request) -> dict[str, str]        # name -> Overpass query, fetched into source/<name>-osm.json
def landmarks(site, paths) -> list[dict]             # authored landmark features
def outline(site, request, overrides, paths) -> dict | None
def refine_building(building) -> None                # last-chance edits to a built structure
def scope_filter(elements, request) -> list[dict]    # which mapped buildings `scope --bounds/--source` selects when no ids are given
```

`site.build` and `site.scope` call the hooks that exist. Sites without a plugin get default behaviour.

## Interfaces other modules rely on

```python
# paths.py
ROOT: Path
class SitePaths:
    name: str; root: Path
    config: Path              # sites/<name>/site.json
    site_dir: Path            # sites/<name>/
    scope, labels, web_references: Path        # sites/<name>/{scope,labels,web-references}.json
    data: Path                # data/<name>/
    source: Path              # data/<name>/source/
    request, osm, elevation, satellite, satellite_meta, sv_index, composition: Path   # under source/
    def extra_source(self, name) -> Path       # source/<name>-osm.json
    overrides: Path; scene: Path; surfaces_index: Path; stream: Path; stream_manifest: Path; textures: Path
    def surfaces(self, digest) -> Path         # surfaces-<digest>.bin.gz
    buildings: Path
    def building(self, bid) -> BuildingPaths
    def building_ids(self) -> list[str]        # directories present under buildings/
    def relative(self, path) -> str            # repository-relative posix path
class BuildingPaths:
    id: str; dir: Path
    brief, fronts, fronts_dir, aerial, references, draft, notes, author, review: Path
    def repair(self, n) -> Path
    renders: Path
    def render(self, view) -> Path             # renders/<view>.png
def site_paths(name_or_dir, root=ROOT) -> SitePaths   # accepts 'avon' or 'data/avon'

# config.py
def site_config(name, root=ROOT) -> dict
def all_sites(root=ROOT) -> list[str]
def deploy_targets(root=ROOT) -> dict
def placements(target, root=ROOT) -> list[tuple[str, dict]]   # (site, placement), root route first
def routes(target, root=ROOT) -> dict[str, str]
def root_site(target, root=ROOT) -> str
def sites_for_target(target, root=ROOT) -> list[str]
def plugin(name, root=ROOT) -> module | None
def scope(name, root=ROOT) -> dict | None

# state.py
def fingerprint(value) -> str
def atomic_json(path, value, compact=False) -> None
def read_json(path, default=None)
def building_frame(site, building) -> str       # fingerprint of center + obb + pts
def apply_patch(base, patch) -> dict           # hash-bound add/remove/replace operations
def building_status(paths: SitePaths, bid, overrides=None, max_repairs=2) -> str
def site_status(paths, max_repairs=2) -> dict[str, str]

# site.py
def load_site(paths) -> dict                    # site.json
def load_overrides(paths) -> dict
def find_building(site, bid) -> dict
def build(paths, *, write=True) -> dict         # the scene; identical output to old build_site
def scope(paths, *, ids=None, ids_file=None, bounds=None, exclude=None, title=None, source=None, padding=24) -> dict
FACE_NAMES; faces(b); road_face(b); to_latlon(site, x, z); to_uv(b, x, z); polygon_uv(b); viewpoints(...); neighbours(...); terrain_at(site, x, z)

# browser.py
def ensure_browser() -> dict                    # record with port
def ensure_server(port=8734, root=ROOT) -> int
class Tab(width=1400, height=1000, scale=1): go(url), ev(expr), wait_town(), wait_pano(), hide(css), shot(path, clip=None), close(); context manager

# render.py
def render(paths, bid, *, face=None, dist=None, iso=False, extra=None, no_bp=False, out=None, width=1400, height=1000,
           scale=1, trees=False, eye=8, tab=None, stage='detail', pose=None, isolate=False, site=None, force=False, ...) -> Path
def compare(paths, bid, face, render_path) -> Path
class RenderBatch: capture(building, face, distance, iso, out, no_bp=False, force=False); close()
def renderer_signature(root=ROOT) -> str        # hash of src/ that invalidates reviews

# model.py
MODELS: dict[str, str]                          # alias -> model id
class BudgetExhausted(Exception)
def execute(directory, prompt, schema, images, *, model, effort='medium', timeout=120, cancel=None, binary='codex', thread=None) -> dict   # {'response':..., 'usage':{...}, 'error':...}

# review.py
def lint_blueprint(bp, building, label) -> Lint  # .errors, .warnings
def audit_geometry(bp) -> dict
def review_errors(root, site, building, blueprint) -> list[str]
def check(paths, bid, *, stage='detail', views=FACE_NAMES, ...) -> dict   # every non-model check
def read_review(paths, bid) -> dict | None; def write_review(paths, bid, draft, report, *, renderer_signature=None, model=None, findings=(), ...) -> dict
MAX_REPAIRS: int                                # 2
def completed_repairs(paths, bid) -> int
def publication_record(st, bp, run_id, scene, repairs, *, retroactive=False); def review_record(st, run_id)

# references.py
def capture_fronts(paths, ids, *, faces=None, force=False, missing=False, max_photos=None, workers=2, dists=None, fov=55,
                   deadline=None, budget_seconds=None, extra_views=0, extra_seconds=90) -> None
def packet(paths, building, name, location, web_records, *, image_search='bing', max_web=1, extra_views=0, site=None) -> dict
def brief(paths, bid, *, card=True, site=None, overrides=None) -> str
def plan(paths, limit=None) -> dict             # total, remaining, counts, selected, capture_ids, buildings
def orientation_card(...); def entrance_inventory(bp, b, site)

# sources.py
def fetch(paths, center=None, size_m=None, *, margin=1.0, satellite=True, elevation=True, extra_sources=None, title=None, force=False, ...) -> dict
def crop_aerials(paths, ids=None, *, source=None, force=False, pad=45, log=print) -> None   # references imports it

# author.py
def author(paths, ids=None, **options) -> dict  # options are Run.__init__'s: all, workers, max_tokens, max_seconds, author_model, reviewer_model, ..., reauthor, dry_run, accept, force
def accept(paths, ids, *, rebuild=True, force=False, out=print) -> list[str]   # drafts -> overrides.json blueprints (+ blueprint_frames, miniature_review); all-or-nothing

# bake.py
def bake(paths, *, check=False, surfaces=True, stream=True) -> bool
def stamp_viewer(root=ROOT, check=False) -> bool

# deploy.py
def route_document(site, root=ROOT, target=None, fixed_site=True) -> str   # target defaults to the first in sites/deploy.json
def preview_document(url, root=ROOT, target=None) -> str | None
def build(target, root=ROOT, check=True) -> Path   # dist/<target>
def serve(port=8734, root=ROOT)
def verify(bundle, domain, site, attempts=12, delay=10) -> bool
```

## Testing

`tests/run.sh` runs, in order: `python -B -m unittest discover -s tests/unit`,
`node --test tests/node/*.test.mjs`, and `node tests/browser/run.mjs` when a
private browser is installed. Two golden checks guard the refactor:

- `town build <site>` must reproduce the committed `data/<site>/site.json` for
  all three sites, byte for byte apart from the `name` field.
- `town stage --target avon` and `--target chautauqua` must reproduce the
  committed dist hashes apart from viewer `?v=` stamps.
