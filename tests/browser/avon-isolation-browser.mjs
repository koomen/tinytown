// Build with ./town stage --target avon before running this check.
// Every clean URL loads its own scene through the same streamed renderer.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
const directory=new URL('../../runs/miniature-routes/',import.meta.url);
await mkdir(directory,{recursive:true});
const results=[];
await withBrowser(new URL('../../dist/avon/',import.meta.url).pathname,async page=>{
 const errors=[];
 let revision;
 page.events.add(m=>{
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));
 });
 const duringNavigation=expression=>page.evaluate(expression).catch(error=>{
  if(/Inspected target navigated|Execution context was destroyed|Cannot find context/.test(error.message))return false;
  throw error;
 });
 // The root document is the extended miniature (config.routes: '/' -> avon-extended).
 for(const [label,url,count] of [['root','/?time=day',1644],['alias','/avon?time=night',1644],
   ['extended','/avon-extended?time=day&focus=248675024&dist=180',1644],
   ['chautauqua','/chautauqua?time=day&quality=mobile&resolution=0.5',946]]) {
  await page.go(url);
  await waitFor(()=>duringNavigation(`!!window.__town && !document.getElementById('loading') && __town.siteData.buildings.length===${count}`),label+' ready');
  await waitFor(()=>page.evaluate('!__town.streaming || (!__town.streaming.stats.loading && __town.streaming.stats.desired.every(id=>__town.streaming.stats.resident.includes(id)))'),label+' tiles');
  const state=await page.evaluate(`({url:location.href,count:__town.siteData.buildings.length,size:__town.siteData.size,
   landscape:__town.street.landscape,stream:__town.streaming?.stats,lost:__town.renderer.getContext().isContextLost(),
   renderer:new URL(document.querySelector('script[src*="/main.js"]').src).pathname,
   icon:new URL(document.querySelector('link[rel="icon"][type="image/svg+xml"]').href).pathname,
   resources:performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname)})`);
  const loadedRevision=await page.evaluate("new URL(document.querySelector('script[src*=\"/main.js\"]').src).search");
  if(revision)assert.equal(loadedRevision,revision);else revision=loadedRevision;
  assert.equal(state.renderer,'/src/main.js');
  assert.ok(state.stream,'Every published miniature must stream');
  assert.ok(state.stream.residentBytes<=state.stream.budgetBytes);
  assert.equal(state.lost,false);
  if(state.stream)assert.deepEqual(state.stream.failures,[]);
  assert.equal(new URL(state.url).pathname,url.split('?')[0]);
  assert.equal(new URL(state.url).search,'?'+url.split('?')[1]);
  if(label==='alias'||label==='extended'||label==='root') {
   assert.equal(state.renderer,'/src/main.js');
   assert.ok(state.landscape.trees>9000);assert.ok(state.landscape.understory>3000);
   assert.ok(state.resources.includes('/data/avon-extended/stream/manifest.json'));
  } else {
   assert.equal(state.renderer,'/src/main.js');
   assert.ok(state.resources.includes('/data/chautauqua/stream/manifest.json'));
   assert.ok(!state.resources.includes('/data/chautauqua/site.json'));
   assert.ok(!state.resources.includes('/data/chautauqua/surfaces.json'));
   assert.equal(state.icon,'/sites/chautauqua/favicon.svg');
   assert.equal(await page.evaluate("fetch('/sites/chautauqua/favicon.svg').then(r=>r.status)"),200);
   assert.ok(!state.resources.some(p=>p.includes('/data/avon-extended/')));
  }
  const shot=await page.send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL(`${label}.png`,directory),Buffer.from(shot.data,'base64'));
  results.push(state);console.log('PASS',label,JSON.stringify({count:state.count,renderer:state.renderer,landscape:state.landscape}));
 }
 assert.deepEqual(errors,[]);
});
await writeFile(new URL('browser-checks.json',directory),JSON.stringify({results},null,2)+'\n');
