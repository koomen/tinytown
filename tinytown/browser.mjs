// Isolated headless Chromium contexts + loopback server for offline scene preparation and tests.
// Node 22+. The Python side of the harness (tinytown/browser.py) owns the browser; this module
// leases contexts from it through `python -m tinytown.browser <action>` run from the repo root.
// `./town browser setup` installs the private browser and the bridge's Python runtime.
//
// withBrowser(root) serves `root` over loopback. When root is a repository checkout the
// server answers exactly like `town serve`: '/' and the named routes ('/avon', '/chautauqua',
// ...) return their route documents and `/?site=<name>` an authoring preview, so drivers
// address a scene by its production URL. Other roots (a dist directory) are served statically
// with the deployment host's clean `.html` paths.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUNTIME_PYTHON = resolve(REPO_ROOT, 'runs/headless-browser/runtime/bin/python');

export function bridgePython() {
  const executable = process.env.PIPELINE_PYTHON || RUNTIME_PYTHON;
  if (!existsSync(executable) && !process.env.PIPELINE_PYTHON) {
    throw new Error('Install the private browser: ./town browser setup');
  }
  return executable;
}

export function privateBrowser(action, record) {
  const executable = bridgePython();
  const args = ['-B', '-m', 'tinytown.browser', action];
  if (action === 'open-tab') args.push('--owner-pid', String(process.pid));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), 90000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error(`headless browser ${action} failed (${signal || code}): ${stderr}`)); return; }
      try { resolve(stdout.trim() ? JSON.parse(stdout) : undefined); } catch (error) { reject(error); }
    });
    child.stdin.on('error', () => {}); // Startup errors are reported by close/error.
    child.stdin.end(record ? JSON.stringify(record) : '');
  });
}

export async function waitFor(fn, label, timeout = 180000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await delay(100); }
  throw new Error(`Timed out: ${label}`);
}

const PREVIEW_DOCUMENT = `
import json, sys
from tinytown.deploy import preview_document
try:
    document = preview_document(sys.argv[1], sys.argv[2])
except ValueError as error:
    print(json.dumps({'error': str(error)}))
else:
    print(json.dumps({'document': document}))
`;

// The document \`town serve\` (tinytown/deploy.py) answers for a request URL on a
// repository checkout: route documents for '/', '/avon', ... and \`?site=\` previews,
// so '/' loads the same scene as production. {document} to serve it, {error} for a
// 400, or null when the request is an ordinary file.
function previewDocument(root, url) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bridgePython(), ['-B', '-c', PREVIEW_DOCUMENT, url, root], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), 30000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error(`route document for ${url} failed (${code}): ${stderr}`)); return; }
      const result = JSON.parse(stdout);
      resolvePromise(result.error !== undefined ? result : result.document === null ? null : result);
    });
  });
}

export async function withBrowser(root, run, { route, width = 1440, height = 960 } = {}) {
  root = resolve(root);
  let record, ws;
  const pending = new Map();
  // Route documents are resolved once per (path, ?site=) and only where the dev
  // server would: a checkout with the deploy stage and its target table.
  const checkout = existsSync(resolve(root, 'tinytown/deploy.py')) && existsSync(resolve(root, 'sites/deploy.json'));
  const documents = new Map();
  const routeDocument = url => {
    const clean = url.pathname.replace(/\/$/, '') || '/';
    if (!checkout || (extname(clean) && !clean.endsWith('.html'))) return null;
    const site = url.searchParams.get('site');
    const key = clean + (site === null ? '' : '?site=' + site);
    if (!documents.has(key)) documents.set(key, previewDocument(root, site === null ? clean : `${clean}?site=${encodeURIComponent(site)}`));
    return documents.get(key);
  };
  const server = createServer(async (req, res) => {
    try {
      if (route && await route(req, res)) return;
      const url = new URL(req.url, 'http://localhost'), pathname = url.pathname;
      const document = await routeDocument(url);
      if (document) {
        res.setHeader('Cache-Control', 'no-store');
        if (document.error !== undefined) { res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end(document.error); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(document.document); return;
      }
      let file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
      // Static route documents use flat .html files, as on the deployment host.
      if (!existsSync(file) && !extname(pathname.replace(/\/$/, ''))) {
        file = resolve(root, '.' + pathname.replace(/\/$/, '') + '.html');
      }
      const bytes = await readFile(file);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml' }[extname(file)] || 'application/octet-stream');
      res.end(bytes);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    record = await privateBrowser('open-tab');
    ws = new WebSocket(record.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('headless browser CDP connection timed out')), 10000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('headless browser CDP connection failed')); };
      ws.onclose = () => { clearTimeout(timer); reject(new Error('headless browser CDP connection closed')); };
    });
    let disconnected = false;
    const rejectPending = () => {
      disconnected = true;
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('headless browser tab disconnected')); }
      pending.clear();
    };
    ws.addEventListener('close', rejectPending);
    ws.addEventListener('error', rejectPending);
    let sequence = 0;
    const events = new Set();
    ws.addEventListener('message', ({ data }) => {
      const m = JSON.parse(data), request = pending.get(m.id);
      if (request) {
        pending.delete(m.id); clearTimeout(request.timer);
        if (m.error) request.reject(new Error(JSON.stringify(m.error))); else request.resolve(m.result);
      } else for (const listener of events) listener(m);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      if (disconnected) { reject(new Error('headless browser tab disconnected')); return; }
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 300000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const targetId = record.target_id;
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten:true });
    events.add(message => {
      if ((message.method === 'Target.detachedFromTarget' && message.params?.sessionId === sessionId)
          || (['Inspector.detached', 'Inspector.targetCrashed'].includes(message.method) && message.sessionId === sessionId)) rejectPending();
    });
    const tabSend = (method, params) => send(method, params, sessionId);
    await tabSend('Page.enable'); await tabSend('Runtime.enable');
    await tabSend('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:1, mobile:false });
    const evaluate = async expression => {
      const r = await tabSend('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    await run({ send:tabSend, evaluate, events, origin,
      go: path => tabSend('Page.navigate', { url:origin + path }) });
  } finally {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('headless browser operation finished')); }
    pending.clear();
    ws?.close();
    if (record) await privateBrowser('close-tab', record).catch(error => console.error(error.message));
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
