#!/bin/sh
# Cloudflare Workers Builds: install the bake toolchain, then bake and stage one
# deploy target into dist/<target>. Baked assets (surfaces, stream chunks) are
# build output and are not committed, so every build generates them here.
#
#   scripts/cloudflare-build.sh avon|chautauqua
#
# Needs python3 (3.10+) and node (22+). Also works locally; everything it
# installs goes under .venv/ and runs/ (both gitignored).
set -eu
target="${1:?usage: scripts/cloudflare-build.sh <target>}"
cd "$(dirname "$0")/.."
root=$(pwd)
phase() { echo "== $(date -u +%H:%M:%S) $*"; }

phase "install toolchain"

node -e 'if (+process.versions.node.split(".")[0] < 22) { console.error(`Node ${process.version}: bake needs Node 22+`); process.exit(1); }'
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check --quiet -e .
[ -f runs/headless-browser/runtime/installation.json ] || ./town browser setup

# The Workers Builds image (Ubuntu 24.04) has no root, so Playwright's
# --with-deps cannot apt-get install. Download the few shared libraries the
# headless shell still lacks as a normal user and put them on LD_LIBRARY_PATH.
if [ "$(uname -s)" = Linux ]; then
  shell=$(find runs/headless-browser/runtime/browsers -type f -name chrome-headless-shell | head -n 1)
  if [ -n "$shell" ] && ldd "$shell" | grep -q 'not found'; then
    libs="$root/runs/system-libs"
    apt="$libs/apt"
    mkdir -p "$apt/lists/partial" "$apt/archives/partial" "$libs/root"
    set -- -o Dir::State::Lists="$apt/lists" -o Dir::Cache="$apt" -o Dir::Cache::archives="$apt/archives" \
      -o Debug::NoLocking=1 -o APT::Sandbox::User="$(id -un)"
    apt-get "$@" -qq update
    (cd "$apt/archives" && apt-get "$@" -qq download libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 \
      libxcomposite1 libxdamage1 libxfixes3 libxi6 libxrandr2 libxkbcommon0 libasound2t64 libxshmfence1 libgbm1 libdbus-1-3)
    for deb in "$apt"/archives/*.deb; do dpkg-deb -x "$deb" "$libs/root"; done
    LD_LIBRARY_PATH="$libs/root/usr/lib/$(uname -m)-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
    export LD_LIBRARY_PATH
    if ldd "$shell" | grep 'not found'; then echo 'Headless Chromium is still missing the libraries above' >&2; exit 1; fi
  fi
fi

phase "bake and stage $target"
./town stage --target "$target"
phase done
