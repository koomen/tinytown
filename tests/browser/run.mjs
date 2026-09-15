#!/usr/bin/env node
// Runs the headless-browser suites. Node 22+, the private headless Chromium
// (./town browser setup) and internet access for the pinned CDN import maps.
//
//   node tests/browser/run.mjs                 the viewer suite (viewer-browser.mjs)
//   node tests/browser/run.mjs arcades decks   tests/browser/arcades-browser.mjs, decks-browser.mjs
//   node tests/browser/run.mjs chautauqua      tests/browser/chautauqua-browser.py (Python drivers too)
//   node tests/browser/run.mjs all             every *-browser.mjs driver; some need dist/ built first
//   node tests/browser/run.mjs --list          the driver names
//
// Without the private browser this prints one SKIP line and exits 0, so
// tests/run.sh can call it unconditionally. load-benchmark.mjs is a benchmark,
// not a test, and is never selected.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const DEFAULT = ['viewer'];

export function browserInstalled() {
  return !!process.env.PIPELINE_PYTHON || existsSync(root + 'runs/headless-browser/runtime/bin/python');
}

function python() {
  if (process.env.PIPELINE_PYTHON) return process.env.PIPELINE_PYTHON;
  return existsSync(root + '.venv/bin/python') ? root + '.venv/bin/python' : 'python3';
}

const drivers = readdirSync(here).filter(f => /-browser\.(mjs|py)$/.test(f)).sort();
const names = [...new Set(drivers.map(f => f.replace(/-browser\.(mjs|py)$/, '')))];

function resolveDriver(name) {
  for (const candidate of [name, `${name}-browser.mjs`, `${name}-browser.py`, `${name}.mjs`, `${name}.py`]) {
    if (candidate !== 'run.mjs' && existsSync(here + candidate)) return candidate;
  }
  throw new Error(`Unknown browser driver "${name}". Known: ${names.join(', ')}`);
}

const args = process.argv.slice(2);
if (args.includes('--list') || args.includes('-l')) {
  for (const f of drivers) console.log(f);
  process.exit(0);
}
if (!browserInstalled()) {
  console.log('SKIP browser tests: private browser not installed; run: ./town browser setup');
  process.exit(0);
}

const selected = args.length === 0 ? DEFAULT
  : args.includes('all') ? drivers.filter(f => f.endsWith('-browser.mjs'))
  : args;
const failed = [];
for (const entry of selected) {
  const file = resolveDriver(entry);
  console.log(`== ${file}`);
  const command = file.endsWith('.py') ? [python(), ['-B', here + file]] : [process.execPath, [here + file]];
  const result = spawnSync(command[0], command[1], { stdio: 'inherit', cwd: root });
  if (result.status !== 0) {
    failed.push(file);
    console.error(`FAIL ${file}${result.signal ? ` (${result.signal})` : ''}`);
  }
}
if (failed.length) {
  console.error(`\n${failed.length} of ${selected.length} browser driver(s) failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nAll ${selected.length} browser driver(s) passed.`);
