// node tests/viewer-cache-browser.mjs — reproduce an old viewer/new data mix,
// then verify that a new document bypasses the old cached module URLs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, waitFor } from '../../tinytown/browser.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const html=await readFile(root+'/index.html','utf8');
const map=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
const revision=new URL(map.imports['./src/main.js'],'http://localhost').searchParams.get('v');
assert.match(revision,/^[a-f0-9]{16}$/);
const oldMap={imports:Object.fromEntries(Object.entries(map.imports).filter(([k])=>!k.startsWith('./src/')))};
const oldHTML=html.replace(/(<script type="importmap">)[\s\S]*?(<\/script>)/,`$1${JSON.stringify(oldMap)}$2`)
  .replace(/((?:src|href)="\.\/src\/[^"?]+)\?[^\"]*"/g,'$1"');
// The pre-streaming viewer contract: every data response goes to generateSite.
const oldViewer=`
  import {siteRequest} from './site-data.js';
  import {generateSite} from './site.js';
  const {data}=await siteRequest;
  document.querySelector('#loading .what').textContent='shaping the ground';
  await generateSite(data);
`;
let legacy=true;
const requests=[];
await withBrowser(root,async page=>{
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  await page.go('/?diagnose');
  await waitFor(()=>page.evaluate('!!window.__townLoadFailure'),'mixed-release failure');
  const failure=await page.evaluate('__townLoadFailure');
  assert.equal(failure.phase,'shaping the ground');assert.equal(failure.loader,'streaming');
  assert.ok(failure.errors.some(s=>s.includes('x0')),JSON.stringify(failure));
  console.log('PASS reproduced the reported terrain error with the legacy viewer and new streaming data');

  legacy=false;requests.length=0;
  await page.go('/avon?stream=1');
  await waitFor(()=>page.evaluate('!!window.__town?.streaming && !document.getElementById("loading")'),'versioned viewer');
  await waitFor(()=>page.evaluate('__town.streaming.stats.resident.length>0 && !__town.streaming.stats.loading'),'versioned worker details');
  assert.equal(await page.evaluate('!!window.__townLoadFailure'),false);
  const runtime=requests.filter(u=>u.pathname.startsWith('/src/'));
  assert.ok(runtime.length>20);
  for(const url of runtime)assert.equal(url.searchParams.get('v'),revision,url.href);
  for(const name of ['main.js','site-data.js','stream-worker.js','stream-format.js','stream-debug.css'])
    assert.ok(runtime.some(u=>u.pathname==='/src/'+name),name);
  assert.equal(runtime.filter(u=>u.pathname==='/src/site-data.js').length,1,'early entry and viewer must share one data module');
  assert.equal(requests.filter(u=>u.pathname.endsWith('/manifest.json')).length,1,'only one map request');
  assert.ok(!requests.some(u=>u.pathname.endsWith('/site.json')),'no accidental full-map download');
  console.log('PASS one viewer revision bypasses stale scripts, including dynamic imports, worker dependencies, and demo styles');
},{route:async(req,res)=>{
  const url=new URL(req.url,'http://localhost');requests.push(url);
  if(url.pathname==='/'&&legacy){res.setHeader('Content-Type','text/html');res.end(oldHTML);return true;}
  if(url.pathname==='/src/main.js'&&!url.search){
    res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','public, max-age=31536000');res.end(oldViewer);return true;
  }
  if(!legacy&&url.pathname.startsWith('/src/')&&!url.search){
    res.setHeader('Content-Type','text/javascript');res.end('throw new Error("Stale runtime module requested");');return true;
  }
  return false;
}});
