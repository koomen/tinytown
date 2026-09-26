# Deployment

Two Cloudflare Workers serve static assets built by `town stage`. Nothing is
built in the browser or at request time; the Workers upload `dist/<target>/`.
Baked assets (`surfaces.json`, `surfaces-*.bin.gz`, `stream/`) are gitignored
build output: Cloudflare bakes them on every deploy.

| Worker | Domain | Wrangler config | Dist | Routes |
| --- | --- | --- | --- | --- |
| `avon-town` | avon.town | `wrangler.avon.jsonc` | `dist/avon/` | `/` Avon, `/avon` an alias of the larger scene, `/avon-extended` (+ alias `/extended`), `/chautauqua` |
| `chautauqua-miniature` | chautauqua.town | `wrangler.chautauqua.jsonc` | `dist/chautauqua/` | `/` Chautauqua |

## Routes are config

Routes are not written anywhere in code. `config.routes(target)` reads the
`deploy` placements of every `sites/*/site.json`:

```json
"deploy": [
  {"target": "avon", "route": "/"},
  {"target": "avon", "route": "/avon-extended", "aliases": ["/extended"]}
]
```

The site whose route is `/` is the target's root and becomes `index.html`;
every other route becomes `<route>.html` (Cloudflare's
`html_handling: auto-trailing-slash` serves it at the extensionless path).
Each document is the shared viewer with `<meta name="town-site">`, the site's
title, description, canonical URL (only when `domain` is set), and social
metadata (`social_image`, `social-preview.jpg`). `sites/deploy.json` maps
targets to dist directories and Wrangler files.

To add a site to an existing target, add a placement. To add a target, add an
entry to `sites/deploy.json`, a `wrangler.<target>.jsonc` whose `build.command`
is `sh scripts/cloudflare-build.sh <target>` and whose `assets.directory`
is the dist directory, and connect a Worker to it in Cloudflare (dashboard
settings below).

## What `town stage` does

```sh
./town stage                      # every target
./town stage --target avon        # one target
./town stage --target chautauqua --no-bake   # stage what is on disk; fail if stale
```

For each target it:

1. Bakes whatever is stale: `town bake <site>` for every site on the target
   (surfaces and streams whose fingerprints no longer match `site.json` and
   the current `src/`; current assets are kept) and `town bake --viewer` (the
   `?v=` stamps in `index.html`). A failed bake fails the stage. With
   `--no-bake` it only runs `town bake <site> --check` and
   `town bake --viewer --check` and fails on anything stale.
2. Copies `src/*.js` and `src/*.css`, writes one route document per route,
   and for each site copies `data/<site>/site.json`, `surfaces.json` and its
   `surfaces-<hash>.bin.gz`, `stream/manifest.json` and every chunk it lists
   (each verified against the manifest's sha256 and size), and only the
   textures the scene references. A scoped site must match its
   `sites/<site>/scope.json` exactly and have no unauthored structure.
3. Publishes icons and `social-preview.jpg`: the root site's own (or the repo
   root fallbacks) at the dist root, other sites' under `sites/<site>/`.
4. Copies `_headers` (from `sites/<root-site>/_headers` if present, else the
   repo root) and swaps the staged directory into place atomically.

Baking needs the package's dependencies (`pip install -e .`), Node 22+ and
the private headless browser, so a stage that has to bake does too. Importing
`tinytown/deploy.py` stays standard library only, and `--no-bake` on current
assets needs nothing beyond `python3` and `node`. Codex and model keys are
never needed to deploy.

## Caching: `_headers`

```
/                                  Cache-Control: no-cache
/index.html, /avon, /avon-extended, /chautauqua      no-cache
/data/:site/surfaces-*.bin.gz      public, max-age=31536000, immutable
/data/:site/surfaces.json          no-cache
/data/:site/stream/*.bin.gz        public, max-age=31536000, immutable
/data/:site/stream/manifest.json   no-cache
```

Fingerprinted binaries are immutable; documents and manifests revalidate.
Viewer modules carry a `?v=<hash of src/>` stamp in the import map (written by
`town bake --viewer`) so a cached pre-update `main.js` can never consume a newer
manifest. When you add a route, add its `no-cache` line here.

Only the staged `dist/<target>` directory is uploaded, and `town stage`
copies runtime files alone (viewer, scenes, surfaces, streams, textures,
icons). Nothing under `data/*/source`, `data/*/buildings`, or `overrides.json`
ever reaches Cloudflare.

## Cloudflare Workers Builds

Both Workers are connected to the `koomen/tinytown` GitHub repository with
`main` as the production branch and the repository root as the root directory.
On every push to `main` Cloudflare runs the dashboard's deploy command,
`npx --yes wrangler@4.131.2 deploy --config wrangler.<target>.jsonc` (`avon`,
`chautauqua`). The dashboard build command is empty: `wrangler deploy` runs the
config's `build.command`, `sh scripts/cloudflare-build.sh <target>`, before it
uploads `dist/<target>/`. Cloudflare manages the GitHub integration and
tokens; there are no GitHub Actions and no secrets in the repository.

`scripts/cloudflare-build.sh` (also runnable locally):

1. Requires Node 22+, creates `.venv/` if missing and runs
   `pip install -e .`.
2. Installs the private headless browser (`./town browser setup`) unless
   `runs/headless-browser/` already has one.
3. On Linux, if `ldd` reports missing shared libraries for the headless shell,
   downloads the needed Ubuntu packages with `apt-get download` as a normal
   user, unpacks them under `runs/system-libs/` and puts them on
   `LD_LIBRARY_PATH`. The Workers Builds image is Ubuntu 24.04 without root or
   sudo, so Playwright's `--with-deps` cannot install them.
4. Runs `./town stage --target <target>`, which bakes and stages.

Every build bakes from scratch (the builder keeps no `data/*/stream/`), so the
whole script must fit in Workers Builds' 20-minute, 8 GB limits. In a
Cloudflare-like container (Ubuntu 24.04 x86_64, 4 CPUs, 8 GB, under emulation)
the avon target, which bakes both sites, took about 8 minutes. To stay under
8 GB, `town stage` runs the surfaces and stream exports one after the other,
and the exporter forces a garbage collection every 25 tiles (the harness
launches Chromium with `--js-flags=--expose-gc`); V8 otherwise sizes its heap
from the host's RAM and collects too late.

The builder has none of the fonts the canvas sign textures ask for (Georgia,
Arial, Nunito), so `tinytown/web/stream-export.html` registers bundled,
metric-compatible substitutes under those names (Gelasio, Arimo, Nunito in
`tinytown/web/fonts/`, see its README) and only exposes `exportStream` once
all of them have loaded. Sign textures therefore use the same fonts on macOS
and Linux; only glyph anti-aliasing differs, so chunks with canvas text hash
differently between a Mac bake and Cloudflare's (Linux builds match each other). The font files are part of the stream fingerprint; the surfaces
bake draws no text and does not use them.

What must be current in the commit you push: `data/<site>/site.json` (golden
against `town build`), `overrides.json`, `source/`, `textures/`, `sites/`,
`_headers` and `index.html` with its `?v=` stamps. The stamps hash `src/`
only; the build restamps them anyway, but commit `./town bake --viewer` after
editing `src/` so the repository's `index.html` matches.

## Pre-push checklist

```sh
./town bake --viewer --check       # index.html stamps match src/ (else: ./town bake --viewer)
./town stage                       # bakes what is stale, stages both targets; what Cloudflare runs
tests/run.sh
git add data index.html sites _headers && git commit
```

Baked files are gitignored, so `git add data` never picks them up. `town bake`
re-exports chunks only when their fingerprint is stale (or with `--force`).
The export is byte-reproducible, so a local rebuild renames only chunks whose
contents changed and stays cheap.

## Preview a build locally

```sh
./town serve                        # the repository: /, /avon, /chautauqua, /?site=<name>
./town serve --dist avon            # dist/avon/ exactly as deployed
./town serve --dist chautauqua --port 8735
```

The dev server disables caching, generates route documents the same way
`town stage` does, and serves `?site=<name>` previews for any `data/<name>/`.
A fresh clone has no baked assets: run `./town bake <site>` (or `town stage`)
first. Without a stream a published site's streaming start fails and the
viewer reloads once with `?stream=0`, the in-browser generator.

## Verify a live deployment

```sh
./town verify avon https://avon.town                 # root site (avon-extended)
./town verify avon https://avon.town chautauqua      # another site on the target
./town verify chautauqua https://chautauqua.town
```

`verify` compares the live `index.html`, `src/main.js`, `site.json`,
`surfaces.json` and `stream/manifest.json` byte for byte with `dist/<target>/`
(ignoring the Cloudflare Web Analytics beacon), retrying for about two minutes
while the deployment propagates. Build the dist first with `./town stage`.
