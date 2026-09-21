(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const labels = {queued: 'Queued', running: 'Running', pending_approval: 'Pending approval', approved: 'Approved', failed: 'Failed', cancelled: 'Cancelled', discarded: 'Discarded'};
  const lanes = ['queued', 'running', 'pending_approval'];
  let records = [], selected = null, detail = null, pending = false, detailVersion = 0;
  const drafts = new Map();
  const imageDrafts = new Map();
  let createImages = [], readingImages = false;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const date = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}); };
  const progress = (record) => [record.worker_status, Number.isFinite(record.progress) ? `${record.progress}%` : ''].filter(Boolean).join(' · ');
  const title = record => `${record.number ? `#${record.number} · ` : ''}${record.title || 'Untitled change'}`;
  function notice(message) { $('notice').textContent = message || ''; $('notice').hidden = !message; }
  async function api(path, body) {
    if (body?.attachments?.length && !(await api('/api/health')).screenshots) throw new Error('Restart the dashboard server to upload screenshots.');
    const response = await fetch(path, body === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json', 'X-TinyTown':'changes'}, body:JSON.stringify(body)});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }
  function setBusy() {
    document.querySelectorAll('button[type="submit"], .detail-actions button, #create-preview, .attachment-controls button, .attachment button').forEach(button => button.disabled = pending || readingImages);
  }
  function renderImages(container, images, remove) {
    container.replaceChildren(...images.map((item, index) => {
      const node = el('div', 'attachment'), img = el('img'); img.src = item.data || item.url; img.alt = item.name;
      if (remove) {node.append(img); const button = el('button', '', '×'); button.type = 'button'; button.setAttribute('aria-label', `Remove ${item.name}`); button.onclick = () => remove(index); node.append(button);}
      else {const link = el('a'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener'; link.append(img); node.append(link);}
      node.append(el('span', '', item.name)); return node;
    }));
  }
  function renderDraftImages(prefix) {
    const images = prefix === 'create' ? createImages : imageDrafts.get(selected) || [];
    renderImages($(`${prefix}-images`), images, index => {images.splice(index, 1); renderDraftImages(prefix);});
    setBusy();
  }
  async function attachFiles(prefix, files) {
    if (pending || readingImages || !files.length) return;
    const id = selected;
    if (prefix !== 'create' && (!id || detail?.status === 'approved')) return;
    const existing = prefix === 'create' ? createImages : [
      ...(detail?.attachments || []), ...(imageDrafts.get(id) || [])];
    readingImages = true; setBusy();
    try {
      if (existing.length + files.length > 8) throw new Error('Attach up to 8 screenshots per change.');
      if (files.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) throw new Error('Use PNG, JPEG, or WebP screenshots.');
      if (files.some(file => file.size > 10 * 1024 * 1024) || [...existing, ...files].reduce((sum, item) => sum + (item.bytes ?? item.size), 0) > 20 * 1024 * 1024) throw new Error('Screenshots must be at most 10 MB each and 20 MB total.');
      const images = await Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve({name:file.name, data:reader.result, bytes:file.size}); reader.onerror = () => reject(new Error(`Could not read ${file.name}`)); reader.readAsDataURL(file);
      })));
      if (prefix === 'create') {createImages.push(...images); renderDraftImages(prefix);}
      else if (prefix === 'feedback') {imageDrafts.set(id, [...(imageDrafts.get(id) || []), ...images]); if (selected === id) renderDraftImages(prefix);}
      else {readingImages = false; await mutate(() => api(`/api/changes/${encodeURIComponent(id)}/attachments`, {attachments:images}));}
    } catch (error) {
      notice(error.message);
      if ($('detail-dialog').open) {$('detail-error').textContent = error.message; $('detail-error').hidden = false;}
    } finally {readingImages = false; setBusy();}
  }
  function bindAttachments(prefix, zone) {
    $(`${prefix}-attach`).onclick = () => $(`${prefix}-files`).click();
    $(`${prefix}-files`).onchange = event => {const files = [...event.target.files]; event.target.value = ''; attachFiles(prefix, files);};
    zone.addEventListener('paste', event => {
      const files = [...(event.clipboardData?.files || [])];
      if (files.length) {event.preventDefault(); event.stopPropagation(); attachFiles(prefix, files);}
    });
  }
  const dropOverlay = el('div', 'drop-overlay');
  dropOverlay.hidden = true; dropOverlay.setAttribute('role', 'status');
  const dropLabel = el('span'); dropOverlay.append(dropLabel);
  document.body.append(dropOverlay);
  let dragDepth = 0;
  const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
  const dropDestination = event => !$('detail-dialog').open ? 'create' : event.target.closest?.('#feedback-form') ? 'feedback' : 'detail';
  function hideDrop() {dragDepth = 0; dropOverlay.hidden = true; document.body.classList.remove('file-dragging');}
  function showDrop(event) {
    const destination = dropDestination(event);
    const host = $('detail-dialog').open ? $('detail-dialog') : document.body;
    if (dropOverlay.parentNode !== host) host.append(dropOverlay);
    const unavailable = pending || readingImages || (destination !== 'create' && detail?.status === 'approved');
    event.dataTransfer.dropEffect = unavailable ? 'none' : 'copy';
    dropLabel.textContent = pending || readingImages ? 'Upload in progress…' : unavailable ? 'This change has already been applied' : destination === 'create' ? 'Drop screenshots for the new change' : destination === 'feedback' ? 'Drop screenshots with your feedback' : `Drop screenshots for change #${detail?.number || selected}`;
    dropOverlay.hidden = false; document.body.classList.add('file-dragging');
  }
  function bindPageDrop(target) {
    target.addEventListener('dragenter', event => {if (hasFiles(event)) {event.preventDefault(); ++dragDepth; showDrop(event);}}, true);
    target.addEventListener('dragover', event => {if (hasFiles(event)) {event.preventDefault(); showDrop(event);}}, true);
    target.addEventListener('dragleave', () => {if (--dragDepth <= 0) hideDrop();}, true);
    target.addEventListener('drop', event => {
      if (!hasFiles(event)) return;
      event.preventDefault(); event.stopPropagation();
      const destination = dropDestination(event), files = [...event.dataTransfer.files];
      hideDrop(); attachFiles(destination, files);
    }, true);
    target.addEventListener('dragend', hideDrop, true);
    target.addEventListener('keydown', event => {if (event.key === 'Escape') hideDrop();}, true);
  }
  bindPageDrop(document);
  // A drop directly onto the live preview belongs to the open change too.
  $('preview-frame').addEventListener('load', () => {try {if ($('preview-frame').contentDocument) bindPageDrop($('preview-frame').contentDocument);} catch { /* Same-origin previews only. */ }});
  window.addEventListener('blur', hideDrop);
  function card(record) {
    const button = el('button', 'change-card'); button.type = 'button';
    button.setAttribute('aria-label', `${title(record)} — ${labels[record.status] || record.status}`);
    const top = el('div', 'card-top'); top.append(el('span', '', labels[record.status]), el('span', '', date(record.created_at)));
    button.append(top, el('h3', '', title(record)), el('p', '', record.error || record.review_warning || (record.status === 'running' && progress(record)) || record.summary || record.request));
    const bottom = el('div', 'card-bottom'); bottom.append(el('span', '', `Pass ${record.iteration || 1}`)); if (record.preview_url) bottom.append(el('span', '', 'Preview')); button.append(bottom);
    button.addEventListener('click', () => openDetail(record.id)); return button;
  }
  function updateBoard(data) {
    records = [...(data.changes || [])].sort((a, b) => (a.number || 0) - (b.number || 0));
    const active = records.filter(r => r.status === 'running').length;
    $('worker-count').textContent = `${active}/${data.workers ?? 2}`;
    for (const status of lanes) {
      const items = records.filter(r => r.status === status);
      $(`${status}-count`).textContent = items.length;
      const container = $(`${status}-list`); container.replaceChildren(...items.map(card));
      if (!items.length) container.append(el('div', 'lane-empty', 'None'));
    }
    const history = records.filter(r => !lanes.includes(r.status));
    $('history-count').textContent = history.length; $('history-list').replaceChildren(...history.map(card));
    // Activity can grow without a status transition; detail refreshes never replace form drafts.
    if (selected && !pending) refreshDetail();
  }
  function setTab(name) {
    for (const tab of ['log', 'diff']) {const on = tab === name; $(`${tab}-tab`).setAttribute('aria-selected', String(on)); $(`${tab}-tab`).tabIndex = on ? 0 : -1; $(`${tab}-panel`).hidden = !on;}
  }
  function renderDetail(record, initialize = false) {
    const body = document.querySelector('.detail-body'), scrollTop = body.scrollTop;
    detail = record;
    $('detail-title').textContent = title(record);
    $('detail-status').textContent = labels[record.status] || record.status;
    $('detail-meta').textContent = `${record.model || 'gpt-6-astra'} · Pass ${record.iteration || 1} · Updated ${date(record.updated_at)}`;
    $('detail-progress').textContent = progress(record); $('detail-progress').hidden = !progress(record);
    $('report-error').textContent = record.report_error ? `Worker update rejected: ${record.report_error}` : ''; $('report-error').hidden = !record.report_error;
    $('review-warning').textContent = record.review_warning ? `Checks incomplete: ${record.review_warning}` : ''; $('review-warning').hidden = !record.review_warning;
    $('detail-request').textContent = record.request || '';
    const attachments = (record.attachments || []).filter(item => typeof item.url === 'string' && item.url.startsWith(`/api/changes/${record.id}/attachments/`) && !item.url.includes('\\'));
    const imageKey = `${record.id}:${attachments.map(item => item.id).join(',')}`;
    if ($('detail-images').dataset.key !== imageKey) {renderImages($('detail-images'), attachments); $('detail-images').dataset.key = imageKey;}
    $('detail-attachment-controls').hidden = record.status === 'approved';
    $('attachment-note').textContent = record.status === 'queued' ? 'Used when the worker starts' : 'Used on the next pass';
    $('detail-summary').textContent = record.summary || ''; $('summary-section').hidden = !record.summary;
    $('detail-error').textContent = record.error || ''; $('detail-error').hidden = !record.error;
    const log = $('log-panel'), oldLog = log.textContent;
    const atEnd = initialize || log.scrollTop + log.clientHeight >= log.scrollHeight - 35, logTop = log.scrollTop;
    const nextLog = typeof record.log === 'string' ? record.log || 'No activity yet.' : (record.log || []).map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('\n') || 'No activity yet.';
    if (nextLog !== oldLog) {
      if (log.firstChild && nextLog.startsWith(oldLog)) log.firstChild.appendData(nextLog.slice(oldLog.length));
      else log.textContent = nextLog;
      log.scrollTop = atEnd ? log.scrollHeight : logTop;
    }
    const diff = record.diff || 'No changes yet.';
    if ($('diff-panel').textContent !== diff) $('diff-panel').textContent = diff;
    $('file-count').textContent = record.files?.length ? `(${record.files.length})` : '';
    $('map-link').href = `/previews/${encodeURIComponent(record.id)}/map/`;
    const url = record.preview_url;
    const safePreview = typeof url === 'string' && url.startsWith('/previews/') && !url.includes('\\');
    $('preview-link').hidden = !safePreview; $('preview-frame').hidden = !safePreview; $('preview-empty').hidden = !!safePreview;
    if (safePreview) {
      $('preview-link').href = url;
      if ($('preview-frame').getAttribute('src') !== url) $('preview-frame').src = url;
    } else $('preview-frame').removeAttribute('src');
    const baking = ['queued', 'running'].includes(record.bake?.status);
    $('bake-change').disabled = baking; $('bake-site').disabled = baking;
    $('bake-change').textContent = record.baked ? 'Bake again' : 'Bake world';
    $('bake-status').textContent = baking ? `Bake ${record.bake.status}` : record.baked ? record.baked.stale ? 'Source changed since this bake' : 'Bake ready' : 'No bake yet';
    $('bake-error').textContent = record.bake?.error || ''; $('bake-error').hidden = !record.bake?.error;
    $('bake-details').hidden = !record.bake_log;
    const bakeLog = $('bake-log'), bakeTop = bakeLog.scrollTop, bakeEnd = bakeTop + bakeLog.clientHeight >= bakeLog.scrollHeight - 35;
    if (bakeLog.textContent !== (record.bake_log || '')) {bakeLog.textContent = record.bake_log || ''; bakeLog.scrollTop = bakeEnd ? bakeLog.scrollHeight : bakeTop;}
    const review = record.status === 'pending_approval';
    $('feedback-form').hidden = !['pending_approval', 'failed', 'cancelled'].includes(record.status); $('approve-change').hidden = !review;
    $('retry-change').hidden = !['failed', 'cancelled', 'discarded'].includes(record.status);
    $('retry-change').textContent = record.status === 'discarded' ? 'Restore' : 'Retry';
    $('cancel-change').hidden = !['queued', 'running'].includes(record.status);
    $('discard-change').hidden = !['queued', 'running', 'pending_approval', 'failed', 'cancelled'].includes(record.status);
    $('approval-note').textContent = review ? record.review_warning ? 'Review the unchecked changes before applying.' : 'Approve applies to your checkout. Discard keeps it unchanged.' : record.status === 'approved' ? 'Applied.' : record.status === 'discarded' ? 'Not applied. Restore to continue.' : '';
    if (initialize) {
      $('feedback').value = drafts.get(record.id) || '';
      $('bake-site').value = record.bake?.site || record.baked?.site || record.preview?.site || $('bake-site').options[0]?.value || '';
      $('bake-details').open = false;
      renderDraftImages('feedback');
      const form = $('preview-form'); form.elements.site.value = record.preview?.site || ''; form.elements.target.value = record.preview?.target || ''; form.elements.radius.value = record.preview?.radius || 60;
      $('detail-preview-options').open = false;
      setTab('log');
    }
    body.scrollTop = initialize ? 0 : scrollTop;
  }
  async function refreshDetail(initialize = false) {
    const id = selected, version = ++detailVersion;
    if (!id) return;
    try { const record = await api(`/api/changes/${encodeURIComponent(id)}`); if (selected === id && version === detailVersion) renderDetail(record, initialize); }
    catch (error) { if (selected === id) notice(error.message); }
  }
  function openDetail(id, created) {
    const record = created || records.find(r => r.id === id) || records.find(r => String(r.number) === id);
    id = record?.id || id;
    if (selected === id && $('detail-dialog').open) return;
    if (selected) drafts.set(selected, $('feedback').value);
    selected = id; detail = null;
    history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(record?.number || id)}`);
    renderDetail(record || {id, title:'Loading change…', status:'queued'}, true);
    if (!$('detail-dialog').open) $('detail-dialog').showModal();
    refreshDetail(!record);
  }
  function followHash() {
    if (!location.hash) {if ($('detail-dialog').open) $('detail-dialog').close(); return;}
    try {openDetail(decodeURIComponent(location.hash.slice(1)));}
    catch {notice('This change link contains an invalid ID.');}
  }
  function readPreview(form, optional = false) {
    const site = form.elements.site.value, target = form.elements.target.value.trim();
    if (optional && !site && !target) return undefined;
    if (!site || !target) throw new Error('Choose a town and enter a building, address, or landmark for the preview.');
    const radius = Number(form.elements.radius.value || 60);
    if (!Number.isFinite(radius) || radius < 10 || radius > 200) throw new Error('Choose a preview radius between 10 and 200 meters.');
    return {site, target, radius};
  }
  async function mutate(action) {
    if (pending || readingImages) return;
    pending = true; notice('');
    setBusy();
    try { await action(); updateBoard(await api('/api/changes')); if (selected) await refreshDetail(); }
    catch (error) { notice(error.message); if ($('detail-dialog').open) {$('detail-error').textContent = error.message; $('detail-error').hidden = false;} }
    finally { pending = false; setBusy(); }
  }
  $('create-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget;
    mutate(async () => { const request = form.elements.request.value.trim(); if (!request) throw new Error('Describe the change you would like to make.'); const record = await api('/api/changes', {request, preview:readPreview(form, true), attachments:createImages}); form.reset(); createImages = []; renderDraftImages('create'); openDetail(record.id, record); });
  });
  $('feedback-form').addEventListener('submit', event => {
    event.preventDefault(); const id = selected, feedback = $('feedback').value.trim();
    mutate(async () => {if (!feedback) throw new Error('Add feedback for the next pass.'); await api(`/api/changes/${encodeURIComponent(id)}/iterate`, {feedback, attachments:imageDrafts.get(id) || []}); drafts.delete(id); imageDrafts.delete(id); if (selected === id) {$('feedback').value = ''; renderDraftImages('feedback');}});
  });
  bindAttachments('create', $('create-form'));
  bindAttachments('feedback', $('feedback-form'));
  bindAttachments('detail', document.querySelector('.detail-body'));
  $('create-preview').addEventListener('click', () => mutate(async () => {
    const result = await api('/api/previews', readPreview($('create-form')));
    if (typeof result.url !== 'string' || !result.url.startsWith('/previews/') || result.url.includes('\\')) throw new Error('The server returned an invalid preview URL.');
    $('standalone-preview-link').href = result.url;
    $('standalone-preview-link').hidden = false;
    $('standalone-preview-link').focus();
  }));
  $('preview-form').addEventListener('submit', event => {event.preventDefault(); const id = selected; mutate(async () => {await api(`/api/changes/${encodeURIComponent(id)}/preview`, readPreview(event.target)); $('detail-preview-options').open = false;});});
  for (const action of ['approve', 'cancel', 'retry', 'discard']) $(`${action}-change`).addEventListener('click', () => {const id = selected; mutate(() => api(`/api/changes/${encodeURIComponent(id)}/${action}`, {}));});
  $('bake-change').addEventListener('click', () => mutate(async () => {const record = await api(`/api/changes/${encodeURIComponent(selected)}/bake`, {site:$('bake-site').value}); renderDetail(record);}));
  $('close-detail').addEventListener('click', () => $('detail-dialog').close());
  $('detail-dialog').addEventListener('close', () => {hideDrop(); if (selected) drafts.set(selected, $('feedback').value); selected = null; detail = null; ++detailVersion; $('preview-frame').removeAttribute('src'); history.replaceState(null, '', `${location.pathname}${location.search}`);});
  window.addEventListener('hashchange', followHash);
  for (const tab of ['log', 'diff']) { $(`${tab}-tab`).addEventListener('click', () => setTab(tab)); $(`${tab}-tab`).addEventListener('keydown', event => {if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {event.preventDefault(); const next = event.key === 'Home' ? 'log' : event.key === 'End' ? 'diff' : tab === 'log' ? 'diff' : 'log'; setTab(next); $(`${next}-tab`).focus();}}); }
  async function initialize() {
    const results = await Promise.allSettled([api('/api/changes'), api('/api/sites')]);
    if (results[0].status === 'fulfilled') updateBoard(results[0].value); else notice(results[0].reason.message);
    if (results[1].status === 'fulfilled') for (const select of [$('create-site'), $('detail-site'), $('bake-site')]) for (const site of results[1].value.sites || []) {const option = el('option', '', site.title || site.name); option.value = site.name; select.append(option);}
    else notice(results[1].reason.message);
    followHash();
    const {watchJSON} = await import('/tinytown/web/live-updates.js');
    watchJSON('/api/changes', updateBoard, {
      connected: () => {$('connection').textContent = 'Live'; $('connection').classList.add('live');},
      disconnected: () => {$('connection').textContent = 'Reconnecting…'; $('connection').classList.remove('live');},
    });
    // Refresh activity tails while a detail is open, even between queue events.
    window.setInterval(() => {if (selected && !pending && !document.hidden) refreshDetail();}, 4000);
    document.addEventListener('visibilitychange', () => {if (!document.hidden) api('/api/changes').then(updateBoard).catch(error => notice(error.message));});
  }
  initialize();
})();
