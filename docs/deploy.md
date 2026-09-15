# Deployment

Two Cloudflare Workers serve static assets built by `town stage`. Nothing is
built in the browser or at request time; the Workers upload `dist/<target>/`.

| Worker | Domain | Wrangler config | Dist | Routes |
| --- | --- | --- | --- | --- |
| `avon-town` | avon.town | `wrangler.avon.jsonc` | `dist/avon/` | `/` Avon, `/avon` the original village-centre scene, `/avon-extended` (+ alias `/extended`), `/chautauqua` |
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
is `python3 -m tinytown stage --target <target>` and whose `assets.directory`
is the dist directory, and connect a Worker to it in Cloudflare.

## What `town stage` does

```sh
./town stage                      # every target
./town stage --target avon        # one target
./town stage --target chautauqua --no-check   # skip the staleness checks (local experiments only)
```

For each target it:

1. Runs the pre-checks: `town bake <site> --check` for every site on the
   target (surface and stream fingerprints must match the committed `site.json`
   and the current `src/`) and `town bake --viewer --check` (the `?v=` stamps in
   `index.html` must match `src/`). Stale assets fail the build; deploy never
   generates them.
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

Standard library only: Cloudflare runs it with bare `python3` (3.10+), and the
stream check shells out to `node` (22+), both present in the Workers Builds
image. `pillow`, `websocket-client`, Codex and the private browser are never
needed to deploy.

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
On every push to `main` Cloudflare runs the config's `build.command`
(`python3 -m tinytown stage --target …`) and then deploys with Wrangler
(`npx --yes wrangler@4.131.2 deploy --config wrangler.avon.jsonc` and the
Chautauqua equivalent, configured in the dashboard). Cloudflare manages the
GitHub integration and tokens; there are no GitHub Actions and no secrets in
the repository.

Because the build only checks, **everything must be current in the commit you
push**: `data/<site>/site.json`, `surfaces*`, `stream/` and `index.html`.

## Pre-push checklist

```sh
for s in avon avon-extended chautauqua; do ./town bake "$s" --check; done
./town bake --viewer --check
./town stage                       # stages both targets locally; fails like Cloudflare would
tests/run.sh
git add data index.html && git commit
```

If a check reports stale assets: `./town bake <site>` (needs the private
browser and Node), `./town bake --viewer`, then commit the regenerated files.
Stream export is not byte-reproducible, so `town bake` re-exports chunks only
when their fingerprint is stale (or with `--force`); when it does, chunk names
change and the deletions are committed too.

## Preview a build locally

```sh
./town serve                        # the repository: /, /avon, /chautauqua, /?site=<name>
./town serve --dist avon            # dist/avon/ exactly as deployed
./town serve --dist chautauqua --port 8735
```

The dev server disables caching, generates route documents the same way
`town stage` does, and serves `?site=<name>` previews for any `data/<name>/`.

## Verify a live deployment

```sh
./town verify town https://avon.town                 # root site (avon-extended)
./town verify town https://avon.town avon            # another site on the target
./town verify chautauqua https://chautauqua.town
```

`verify` compares the live `index.html`, `src/main.js`, `site.json`,
`surfaces.json` and `stream/manifest.json` byte for byte with `dist/<target>/`
(ignoring the Cloudflare Web Analytics beacon), retrying for about two minutes
while the deployment propagates. Build the dist first with `./town stage`.
