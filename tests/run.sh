#!/bin/sh
# Runs everything that does not need network or a model, in order:
#   1. python -B -m unittest discover -s tests/unit -t .
#   2. node --test tests/node/*.test.mjs
#   3. node tests/browser/run.mjs   (only when the private browser is installed)
# Exits non-zero if any step that ran failed. Steps with nothing to run are skipped.
set -u
cd "$(dirname "$0")/.." || exit 1
status=0

if [ -n "${PIPELINE_PYTHON:-}" ]; then python="$PIPELINE_PYTHON"
elif [ -x .venv/bin/python ]; then python=.venv/bin/python
else python=python3; fi

echo "== python unit tests (tests/unit)"
if ls tests/unit/test_*.py >/dev/null 2>&1; then
  if [ -f tests/unit/__init__.py ]; then top=.
  else
    # `discover -t .` needs tests/unit to be a package; until it is, discover from tests/unit itself.
    echo "NOTE tests/unit/__init__.py is missing; discovering with -t tests/unit"
    top=tests/unit
  fi
  "$python" -B -m unittest discover -s tests/unit -t "$top" || status=1
else
  echo "SKIP python unit tests: tests/unit/ has no test_*.py"
fi

echo "== node tests (tests/node)"
if ls tests/node/*.test.mjs >/dev/null 2>&1; then
  node --test tests/node/*.test.mjs || status=1
else
  echo "SKIP node tests: tests/node/ has no *.test.mjs"
fi

echo "== browser tests (tests/browser)"
if [ -n "${PIPELINE_PYTHON:-}" ] || [ -x runs/headless-browser/runtime/bin/python ]; then
  node tests/browser/run.mjs || status=1
else
  echo "SKIP browser tests: private browser not installed; run: ./town browser setup"
fi

exit $status
