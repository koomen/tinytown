// Node 22+, headless-chromium, uv, and internet access for pinned CDN imports.
// Uses an owned headless-chromium tab and a temporary local server.
// Run: node tests/load-benchmark.mjs
// TOWN_BENCH_ROOT, TOWN_BENCH_RUNS, TOWN_BENCH_PATH and PIPELINE_PYTHON are optional.
// TOWN_BENCH_MBPS enables cold-cache network throttling (50 ms latency).
// Otherwise runs share the pipeline session cache.
// GPU/driver initialization and network timings vary; build stages isolate CPU work.
import { privateBrowser } from '../../tinytown/browser.mjs';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(process.env.TOWN_BENCH_ROOT || fileURLToPath(new URL('../../',import.meta.url))) + '/';
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Cache-Control', 'no-store');
  const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    const content = await readFile(file);
    res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg' }[extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
});

async function waitFor(fn, label, timeout = 90000) {
  const end = Date.now() + timeout;
  let lastError;
  while (Date.now() < end) {
    try { const result = await fn(); if (result) return result; }
    catch (error) { lastError = error; }
    await delay(200);
  }
  throw new Error(`Timed out: ${label}${lastError ? ` (${lastError.message})` : ''}`);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    });
  }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timer = setTimeout(() => {
        this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`));
      }, 90000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

const tabs = new Set();
let cdp;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await privateBrowser('ensure');
  const ws = new WebSocket(browser.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  cdp = new CDP(ws);

  async function page(width = 390, height = 844) {
    const record = await privateBrowser('open-tab');
    tabs.add(record);
    const targetId = record.target_id;
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    return { send, evaluate,
      go: (path = '/') => send('Page.navigate', { url: origin + path }),
      close: async () => { await privateBrowser('close-tab', record); tabs.delete(record); },
    };
  }

  const p = await page(1440, 1000);
  const mbps=Number(process.env.TOWN_BENCH_MBPS||0);
  if(mbps) {
    await p.send('Network.enable');
    await p.send('Network.setCacheDisabled',{cacheDisabled:true});
    await p.send('Network.emulateNetworkConditions',{offline:false,latency:50,downloadThroughput:mbps*1e6/8,uploadThroughput:mbps*1e6/8});
  }
  const runs=[];
  for(let i=0;i<Number(process.env.TOWN_BENCH_RUNS || 3);i++) {
    await p.go(process.env.TOWN_BENCH_PATH || '/');
    await waitFor(()=>p.evaluate('!!window.__town'),'first rendered frame');
    const result=await p.evaluate(`(()=>{
      const w=window.__town, buffers=new Set(),geometries=new Set();let triangles=0,vertices=0;
      w.scene.traverse(o=>{if(!o.isMesh || geometries.has(o.geometry))return;const g=o.geometry;geometries.add(g);
        triangles+=(g.index?.count??g.attributes.position.count)/3;vertices+=g.attributes.position.count;
        for(const a of [...Object.values(g.attributes),g.index].filter(Boolean))buffers.add(a.array.buffer);
      });
      const resources=performance.getEntriesByType('resource');
      return {timing:w.timing,streaming:w.streaming?.stats,stages:w.street.prof,geometryBytes:[...buffers].reduce((s,b)=>s+b.byteLength,0),
        vertices,triangles,resources:resources.length,localTransferBytes:resources.filter(r=>r.name.startsWith(location.origin)).reduce((s,r)=>s+r.transferSize,0),
        renderer:w.renderer.getContext().getParameter(w.renderer.getContext().RENDERER)};
    })()`);
    await waitFor(()=>p.evaluate('!document.getElementById("loading")'),'loader dismissal');
    result.loaderGoneMs=await p.evaluate('Math.round(performance.now())');
    runs.push(result);console.log(JSON.stringify({run:i+1,...result}));
    await p.send('Page.navigate',{url:'about:blank'});
    await waitFor(()=>p.evaluate('location.href === "about:blank"'),'blank');
  }
  const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
  console.log(JSON.stringify({summary:{root,browserProvider:"headless-chromium",cacheMode:mbps?`cold cache, ${mbps} Mbps, 50 ms latency`:"shared session",runs:runs.length,medianBuildMs:median(runs.map(r=>r.timing.build)),medianFirstFrameMs:median(runs.map(r=>r.timing.total)),medianLoaderGoneMs:median(runs.map(r=>r.loaderGoneMs))}}));
  await p.close();
} finally {
  cdp?.ws.close();
  for (const record of tabs) await privateBrowser('close-tab', record).catch(error => console.error(error.message));
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
