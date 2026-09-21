// Offline dashboard interaction test using the repository's private browser.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withBrowser, waitFor, REPO_ROOT} from '../../tinytown/browser.mjs';

let changes = [], stream, lastMutation, log = 'Agent activity', imageCount = 0, screenshots = true;
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGPUCpjGwMDAxAAGAAx+ARQMYvN+AAAAAElFTkSuQmCC';
const imageInput = (selector, kind = 'paste', name = 'screen.png') => `(() => {
  const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob('${png}'), c => c.charCodeAt(0))], '${name}', {type:'image/png'}));
  const node = document.querySelector('${selector}')${kind === 'frame-drop' ? '.contentDocument.body' : ''};
  ${kind === 'file' ? "node.files = transfer.files; node.dispatchEvent(new Event('change', {bubbles:true}));" : ['dragenter', 'dragover', 'dragleave', 'drop', 'frame-drop'].includes(kind) ? `return node.dispatchEvent(new DragEvent('${kind === 'frame-drop' ? 'drop' : kind}', {dataTransfer:transfer, bubbles:true, cancelable:true}));` : "node.dispatchEvent(new ClipboardEvent('paste', {clipboardData:transfer, bubbles:true, cancelable:true}));"}
})()`;
const broadcast = () => stream?.write(`event: changes\ndata: ${JSON.stringify({changes, workers:2})}\n\n`);
async function route(req, res) {
  if (req.url === '/changes') {res.setHeader('Content-Type', 'text/html'); res.end(await readFile(new URL('../../tinytown/web/changes.html', import.meta.url))); return true;}
  if (req.url === '/previews/worker-selected/') {res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Preview</title><body>Preview area</body>'); return true;}
  if (!req.url.startsWith('/api/')) return false;
  if (req.url === '/api/events') {res.writeHead(200, {'Content-Type':'text/event-stream'}); stream = res; broadcast(); return true;}
  if (req.url === '/api/health') {res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({screenshots})); return true;}
  if (req.method === 'GET' && req.url.includes('/attachments/')) {res.setHeader('Content-Type', 'image/png'); res.end(Buffer.from(png, 'base64')); return true;}
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    assert.equal(req.headers['x-tinytown'], 'changes');
    lastMutation = {url:req.url, body:JSON.parse(body)};
    if (req.url === '/api/previews') {res.end(JSON.stringify({id:'preview-1', url:'/previews/preview-1/'})); return true;}
    if (req.url === '/api/changes') changes.push({id:'test-1', number:1, title:'A greener main street', ...lastMutation.body, attachments:[], status:'queued', iteration:1, created_at:new Date().toISOString(), updated_at:new Date().toISOString()});
    else if (req.url.endsWith('/iterate')) {changes[0].status = 'queued'; changes[0].iteration++;}
    else if (req.url.endsWith('/bake')) changes[0].bake = {id:'abcdef123456',site:lastMutation.body.site,status:'queued'};
    else if (req.url.endsWith('/approve')) changes[0].status = 'approved';
    else if (req.url.endsWith('/discard')) changes[0].status = 'discarded';
    else if (req.url.endsWith('/retry')) changes[0].status = 'queued';
    for (const item of lastMutation.body.attachments || []) {
      const id = `image-${++imageCount}`;
      changes[0].attachments.push({id, name:item.name, bytes:68, url:`/api/changes/test-1/attachments/${id}`});
    }
    res.end(JSON.stringify(changes[0])); broadcast(); return true;
  }
  res.end(JSON.stringify(req.url === '/api/sites' ? {sites:[{name:'test-town', title:'Test town'}]} : req.url === '/api/changes' ? {changes, workers:2} : {...changes[0], log, diff:'diff --git a/tree.js b/tree.js'})); return true;
}
await withBrowser(REPO_ROOT, async ({go, evaluate, send}) => {
  await go('/changes');
  await waitFor(() => evaluate(`document.querySelector('#connection')?.textContent === 'Live'`), 'dashboard connection', 15000);
  assert.equal(await evaluate(`document.querySelectorAll('.lane-empty').length`), 3);
  await evaluate(`document.querySelector('#create-site').value = 'test-town'; document.querySelector('#create-form').elements.target.value = 'Town hall'; document.querySelector('#create-preview').click()`);
  await waitFor(() => evaluate(`!document.querySelector('#standalone-preview-link').hidden`), 'standalone preview', 10000);
  assert.equal(lastMutation.url, '/api/previews');
  assert.equal(lastMutation.body.target, 'Town hall');
  assert.equal(changes.length, 0, 'creating a preview does not enqueue an agent');
  await waitFor(() => evaluate(`!document.querySelector('#create-preview').disabled`), 'preview request finished', 10000);
  await evaluate(imageInput('#request'));
  await waitFor(() => evaluate(`document.querySelectorAll('#create-images img').length === 1 && !document.querySelector('#create-attach').disabled`), 'paste screenshot', 10000);
  assert.equal(await evaluate(imageInput('.topbar', 'dragenter')), false, 'accept files over the page header');
  assert.equal(await evaluate(`document.querySelector('.drop-overlay').hidden`), false);
  assert.equal(await evaluate(`document.querySelector('.drop-overlay').textContent`), 'Drop screenshots for the new change');
  await evaluate(imageInput('.topbar h1', 'dragenter'));
  await evaluate(imageInput('.topbar h1', 'dragleave'));
  assert.equal(await evaluate(`document.querySelector('.drop-overlay').hidden`), false, 'crossing children keeps the drop hint visible');
  assert.equal(await evaluate(imageInput('.topbar', 'drop', 'page-drop.png')), false, 'file drops must not navigate away');
  await waitFor(() => evaluate(`document.querySelectorAll('#create-images img').length === 2 && !document.querySelector('#create-attach').disabled`), 'page-wide screenshot drop', 10000);
  assert.equal(await evaluate(`document.querySelector('.drop-overlay').hidden`), true);
  await evaluate(`document.querySelector('#create-images button[aria-label="Remove page-drop.png"]').click()`);
  await evaluate(imageInput('.board', 'dragenter'));
  await evaluate(imageInput('.board', 'dragleave'));
  assert.equal(await evaluate(`document.querySelector('.drop-overlay').hidden`), true, 'leaving the page clears the drop hint');
  assert.equal(await evaluate(`(() => {const data = new DataTransfer(); data.setData('text/plain', 'ordinary text'); return document.querySelector('#request').dispatchEvent(new DragEvent('drop', {dataTransfer:data, bubbles:true, cancelable:true}));})()`), true, 'ordinary text drags are not intercepted');
  await evaluate(imageInput('#create-files', 'file', 'remove.png'));
  await waitFor(() => evaluate(`document.querySelectorAll('#create-images img').length === 2 && !document.querySelector('#create-attach').disabled`), 'file screenshot', 10000);
  await evaluate(`document.querySelector('#create-images button[aria-label="Remove remove.png"]').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('#create-images img').length`), 1);
  screenshots = false;
  await evaluate(`document.querySelector('#request').value = 'Add trees <script>unsafe</script>'; document.querySelector('#create-form').requestSubmit()`);
  await waitFor(() => evaluate(`document.querySelector('#notice').textContent.includes('Restart') && !document.querySelector('#create-attach').disabled`), 'old server does not lose images', 10000);
  assert.equal(changes.length, 0);
  assert.equal(await evaluate(`document.querySelectorAll('#create-images img').length`), 1);
  screenshots = true;
  await evaluate(`document.querySelector('#create-form').requestSubmit()`);
  await waitFor(() => evaluate(`document.querySelector('#detail-dialog').open && document.querySelector('#detail-title').textContent === '#1 · A greener main street'`), 'created change', 10000);
  assert.equal(await evaluate(`location.hash`), '#1');
  assert.equal(await evaluate(`document.querySelector('#map-link').getAttribute('href')`), '/previews/test-1/map/');
  assert.equal(await evaluate(`document.querySelector('#map-link').hidden`), false, 'whole map is available before a worker attaches a close-up');
  assert.equal(await evaluate(`document.querySelector('#detail-request').textContent`), 'Add trees <script>unsafe</script>');
  assert.equal(lastMutation.body.attachments.length, 1);
  assert.ok(lastMutation.body.attachments[0].data.startsWith('data:image/png;base64,'));
  assert.equal(await evaluate(`document.querySelectorAll('#detail-images img').length`), 1);
  await waitFor(() => evaluate(`document.querySelector('#detail-images img').naturalWidth === 2`), 'stored screenshot renders', 10000);
  assert.equal(await evaluate(`document.querySelectorAll('#create-images img').length`), 0);
  Object.assign(changes[0], {status:'running', worker_status:'Checking roof <script>text</script>', progress:40}); broadcast();
  await waitFor(() => evaluate(`document.querySelector('#detail-progress').textContent === 'Checking roof <script>text</script> · 40%'`), 'worker live progress', 10000);
  assert.equal(await evaluate(`document.querySelector('#running-list .change-card p').textContent`), 'Checking roof <script>text</script> · 40%');
  await evaluate(`document.querySelector('#bake-change').click()`);
  await waitFor(() => evaluate(`document.querySelector('#bake-status').textContent === 'Bake queued'`), 'bake queued', 10000);
  assert.equal(lastMutation.url, '/api/changes/test-1/bake');
  assert.equal(lastMutation.body.site, 'test-town');
  assert.equal(await evaluate(`document.querySelector('#bake-change').disabled`), true);
  changes[0].bake.status = 'ready'; changes[0].baked = {id:'abcdef123456',site:'test-town',stale:true}; broadcast();
  await waitFor(() => evaluate(`document.querySelector('#bake-status').textContent === 'Source changed since this bake'`), 'stale bake remains viewable', 10000);
  assert.equal(await evaluate(`document.querySelector('#bake-change').textContent`), 'Bake again');
  const closeTop = await evaluate(`document.querySelector('#close-detail').getBoundingClientRect().top`);
  for (const lines of [5, 30, 200]) {
    log = Array.from({length:lines}, (_, i) => `Activity line ${i}`).join('\n'); broadcast();
    await waitFor(() => evaluate(`document.querySelector('#log-panel').textContent.endsWith('Activity line ${lines-1}')`), 'growing activity', 10000);
    assert.equal(await evaluate(`document.querySelector('#close-detail').getBoundingClientRect().top`), closeTop, 'growing logs must not move Close');
  }
  assert.equal(await evaluate(`document.querySelector('#log-panel').clientHeight <= 290 && document.querySelector('#log-panel').scrollHeight > 290`), true);
  await evaluate(`document.querySelector('#log-panel').scrollTop = 70; document.querySelector('.detail-body').scrollTop = 40`);
  const bodyTop = await evaluate(`document.querySelector('.detail-body').scrollTop`);
  log += '\nPreserve reading position'; broadcast();
  await waitFor(() => evaluate(`document.querySelector('#log-panel').textContent.includes('Preserve reading position')`), 'append while reading', 10000);
  assert.equal(await evaluate(`document.querySelector('#log-panel').scrollTop`), 70);
  assert.equal(await evaluate(`document.querySelector('.detail-body').scrollTop`), bodyTop);
  assert.equal(await evaluate(`document.querySelector('#close-detail').getBoundingClientRect().top`), closeTop);
  await evaluate(`document.querySelector('#log-panel').scrollTop = document.querySelector('#log-panel').scrollHeight`);
  log += '\nFollow tail'; broadcast();
  await waitFor(() => evaluate(`document.querySelector('#log-panel').textContent.endsWith('Follow tail')`), 'follow new lines', 10000);
  assert.equal(await evaluate(`(() => {const log = document.querySelector('#log-panel'); return log.scrollHeight - log.clientHeight - log.scrollTop < 2;})()`), true);
  await evaluate(imageInput('.detail-header', 'dragenter'));
  assert.equal(await evaluate(`document.querySelector('#detail-dialog .drop-overlay').textContent`), 'Drop screenshots for change #1');
  assert.equal(await evaluate(`document.querySelector('#close-detail').getBoundingClientRect().top`), closeTop, 'drop hint must not move the dialog');
  await evaluate(imageInput('.detail-header', 'drop', 'running.png'));
  await waitFor(() => evaluate(`document.querySelectorAll('#detail-images img').length === 2 && !document.querySelector('#detail-attach').disabled`), 'append screenshot while running', 10000);
  assert.equal(lastMutation.url, '/api/changes/test-1/attachments');
  assert.equal(lastMutation.body.attachments.length, 1, 'a drop is attached exactly once');
  assert.equal(await evaluate(`document.querySelectorAll('#create-images img').length`), 0, 'modal drops belong to the open change');
  assert.equal(changes[0].status, 'running');
  assert.equal(await evaluate(`document.querySelector('#attachment-note').textContent`), 'Used on the next pass');
  changes[0].preview_url = '/previews/worker-selected/'; broadcast();
  await waitFor(() => evaluate(`document.querySelector('#preview-link').getAttribute('href') === '/previews/worker-selected/'`), 'worker selected preview', 10000);
  await waitFor(() => evaluate(`document.querySelector('#preview-frame').contentDocument?.body?.textContent === 'Preview area'`), 'embedded preview loaded', 10000);
  assert.equal(await evaluate(imageInput('#preview-frame', 'frame-drop', 'preview-drop.png')), false, 'dropping on the preview must not navigate it');
  await waitFor(() => evaluate(`document.querySelectorAll('#detail-images img').length === 3 && !document.querySelector('#detail-attach').disabled`), 'screenshot drop over embedded preview', 10000);
  assert.equal(lastMutation.url, '/api/changes/test-1/attachments');
  assert.equal(lastMutation.body.attachments[0].name, 'preview-drop.png');
  changes[0].status = 'pending_approval'; changes[0].review_warning = 'Chromium review unavailable'; changes[0].updated_at = new Date().toISOString(); broadcast();
  await waitFor(() => evaluate(`!document.querySelector('#feedback-form').hidden`), 'review transition', 10000);
  assert.equal(await evaluate(`document.querySelector('#review-warning').textContent`), 'Checks incomplete: Chromium review unavailable');
  assert.equal(await evaluate(`!document.querySelector('#approve-change').hidden && !document.querySelector('#discard-change').hidden`), true, 'blocked checks retain approval and discard');
  assert.equal(await evaluate(`document.querySelector('#pending_approval-list h3').textContent`), '#1 · A greener main street');
  await evaluate(`document.querySelector('#feedback').value = 'Keep the crossing clear'`);
  await evaluate(imageInput('#feedback', 'drop', 'adjustment.png'));
  await waitFor(() => evaluate(`document.querySelectorAll('#feedback-images img').length === 1 && !document.querySelector('#feedback-attach').disabled`), 'feedback screenshot', 10000);
  changes[0].summary = 'Trees added'; broadcast();
  await waitFor(() => evaluate(`document.querySelector('#detail-summary').textContent === 'Trees added'`), 'live detail update', 10000);
  assert.equal(await evaluate(`document.querySelector('#feedback').value`), 'Keep the crossing clear');
  assert.equal(await evaluate(`document.querySelectorAll('#feedback-images img').length`), 1);
  await evaluate(`document.querySelector('#close-detail').click()`);
  await waitFor(() => evaluate(`location.hash === ''`), 'close with screenshot draft', 10000);
  await evaluate(`location.hash = 'test-1'`);
  await waitFor(() => evaluate(`document.querySelector('#detail-dialog').open && document.querySelectorAll('#feedback-images img').length === 1`), 'restore screenshot draft', 10000);
  assert.equal(await evaluate(`document.querySelector('#feedback').value`), 'Keep the crossing clear');
  await evaluate(`document.querySelector('#feedback-form').requestSubmit()`);
  await waitFor(() => evaluate(`document.querySelector('#detail-status').textContent === 'Queued'`), 'iteration queued', 10000);
  assert.equal(lastMutation.body.feedback, 'Keep the crossing clear');
  assert.equal(lastMutation.body.attachments[0].name, 'adjustment.png');
  assert.equal(await evaluate(`document.querySelectorAll('#feedback-images img').length`), 0);
  changes[0].status = 'pending_approval'; broadcast();
  await waitFor(() => evaluate(`!document.querySelector('#approve-change').hidden`), 'second review', 10000);
  await evaluate(`document.querySelector('#approve-change').click()`);
  await waitFor(() => evaluate(`document.querySelector('#detail-status').textContent === 'Approved'`), 'approval', 10000);
  assert.equal(lastMutation.url, '/api/changes/test-1/approve');
  changes[0].status = 'failed'; broadcast();
  await waitFor(() => evaluate(`document.querySelector('#detail-status').textContent === 'Failed' && !document.querySelector('#feedback-form').hidden`), 'failed repair feedback', 10000);
  await evaluate(`document.querySelector('#feedback').value = 'Repair the geometry first'; document.querySelector('#feedback-form').requestSubmit()`);
  await waitFor(() => evaluate(`document.querySelector('#detail-status').textContent === 'Queued'`), 'repair queued', 10000);
  assert.equal(lastMutation.body.feedback, 'Repair the geometry first');
  changes[0].status = 'pending_approval'; broadcast();
  await waitFor(() => evaluate(`!document.querySelector('#discard-change').hidden`), 'discard action', 10000);
  await evaluate(`document.querySelector('#discard-change').click()`);
  await waitFor(() => evaluate(`document.querySelector('#detail-status').textContent === 'Discarded'`), 'discarded', 10000);
  assert.equal(lastMutation.url, '/api/changes/test-1/discard');
  assert.equal(await evaluate(`document.querySelector('#approve-change').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('#retry-change').textContent`), 'Restore');
  await evaluate(`document.querySelector('#retry-change').click()`);
  await waitFor(() => evaluate(`document.querySelector('#detail-status').textContent === 'Queued'`), 'restore discarded', 10000);
  await evaluate(`document.querySelector('#close-detail').click()`);
  await waitFor(() => evaluate(`location.hash === ''`), 'close clears deep link', 10000);
  await evaluate(`location.hash = 'test-1'`);
  await waitFor(() => evaluate(`document.querySelector('#detail-dialog').open && document.querySelector('#detail-title').textContent === '#1 · A greener main street'`), 'hashchange opens detail', 10000);
  await go('/changes#test-1');
  await waitFor(() => evaluate(`document.querySelector('#detail-dialog')?.open && document.querySelector('#detail-title').textContent === '#1 · A greener main street'`), 'initial deep link', 10000);
  await go('/changes#1');
  await waitFor(() => evaluate(`document.querySelector('#detail-dialog')?.open && document.querySelector('#detail-title').textContent === '#1 · A greener main street'`), 'numbered deep link', 10000);
  await evaluate(`location.hash = ''`);
  await waitFor(() => evaluate(`!document.querySelector('#detail-dialog').open`), 'empty hash closes detail', 10000);
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'mobile layout must not overflow');
  await evaluate(`location.hash = 'test-1'`);
  await waitFor(() => evaluate(`document.querySelector('#detail-dialog').open`), 'mobile modal', 10000);
  assert.equal(await evaluate(`document.querySelector('#detail-dialog').getBoundingClientRect().bottom <= innerHeight && document.querySelector('#close-detail').getBoundingClientRect().top > 0`), true);
  changes.push({id:'test-3', number:3, title:'Third', status:'queued'}, {id:'test-2', number:2, title:'Second', status:'queued'}); broadcast();
  await waitFor(() => evaluate(`document.querySelectorAll('#queued-list .change-card').length === 3`), 'ordered queue', 10000);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#queued-list h3')].map(el => el.textContent)`), ['#1 · A greener main street', '#2 · Second', '#3 · Third']);
  console.log('PASS page-wide screenshot drops, numbered changes/links/order, review despite blocked checks, stable modal, and mobile layout');
}, {route});
