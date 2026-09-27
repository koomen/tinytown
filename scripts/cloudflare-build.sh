#!/bin/sh
# Cloudflare Workers Builds: install the bake's two Node packages, then bake
# and stage one deploy target into dist/<target>. Baked assets (surfaces,
# stream chunks) are build output and are not committed, so every build
# generates them here.
#
#   scripts/cloudflare-build.sh avon|chautauqua
#
# Needs python3 (3.10+, standard library only) and node (22+). Also works
# locally; everything it installs goes under node_modules/ (gitignored).
set -eu
target="${1:?usage: scripts/cloudflare-build.sh <target>}"
cd "$(dirname "$0")/.."
phase() { echo "== $(date -u +%H:%M:%S) $*"; }

phase "install toolchain"
node -e 'if (+process.versions.node.split(".")[0] < 22) { console.error(`Node ${process.version}: bake needs Node 22+`); process.exit(1); }'
npm ci --omit=dev --no-audit --no-fund

phase "bake and stage $target"
./town stage --target "$target"
phase done
