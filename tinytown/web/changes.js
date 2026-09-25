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
  const unfinished = record => (record.final_steps || []).filter(step => !step.done);
  const finalizing = record => record.status === 'approved' && unfinished(record).length > 0;
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
    document.querySelectorAll('.final-step input').forEach(input => input.disabled = pending || input.dataset.readonly === 'true');
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
    if (finalizing(record)) bottom.append(el('span', '', `${unfinished(record).length} steps left`));
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
    const followups = records.filter(finalizing);
    $('finalizing-section').hidden = !followups.length;
    $('finalizing-count').textContent = followups.length;
    $('finalizing-list').replaceChildren(...followups.map(card));
    const history = records.filter(r => !lanes.includes(r.status) && !finalizing(r));
    $('history-count').textContent = history.length; $('history-list').replaceChildren(...history.map(card));
    // Activity can grow without a status transition; detail refreshes never replace form drafts.
    if (selected && !pending) refreshDetail();
  }
  function setTab(name) {
    for (const tab of ['log', 'diff']) {const on = tab === name; $(`${tab}-tab`).setAttribute('aria-selected', String(on)); $(`${tab}-tab`).tabIndex = on ? 0 : -1; $(`${tab}-panel`).hidden = !on;}
  }
  function renderSteps(record) {
    const commit = record.integration?.commit;
    $('integration-status').textContent = commit ? `Committed to local main: ${commit.slice(0, 12)}. Check off remaining steps after completing them.` : record.status === 'approved' ? 'Applied by an older queue version; no main commit was recorded.' : 'Approval applies and commits the source change to local main. Remaining steps stay in the queue.';
    const key = JSON.stringify([record.id, record.status, record.final_steps, commit]);
    if ($('final-steps').dataset.key === key) return;
    $('final-steps').dataset.key = key;
    $('final-steps').replaceChildren(...(record.final_steps || []).map(step => {
      const label = el('label', 'final-step'), input = el('input'); input.type = 'checkbox'; input.checked = step.done;
      const readonly = ['queued', 'running', 'discarded'].includes(record.status) || step.id === 'apply' || (step.id === 'main' && (!!commit || record.status !== 'approved' || unfinished(record).some(s => s.id !== 'main')));
      input.dataset.readonly = String(readonly); input.disabled = pending || readonly;
      input.dataset.stepId = step.id;
      input.addEventListener('change', () => {const done = input.checked; mutate(() => api(`/api/changes/${encodeURIComponent(record.id)}/steps`, {step_id:step.id, done}));});
      label.append(input, el('span', '', step.text)); return label;
    }));
  }
  function renderDetail(record, initialize = false) {
    const body = document.querySelector('.detail-body'), scrollTop = body.scrollTop;
    detail = record;
    $('detail-title').textContent = title(record);
    $('detail-status').textContent = labels[record.status] || record.status;
    const building = record.kind === 'building';
    $('detail-meta').textContent = `${building ? `town author · ${record.site}` : `${record.agent === 'claude' ? 'Claude Code' : 'Codex'} · ${record.model || 'gpt-6-astra'}`} · Pass ${record.iteration || 1} · Updated ${date(record.updated_at)}`;
    $('detail-progress').textContent = progress(record); $('detail-progress').hidden = !progress(record);
    $('report-error').textContent = record.report_error ? `Worker update rejected: ${record.report_error}` : ''; $('report-error').hidden = !record.report_error;
    $('review-warning').textContent = record.review_warning ? `Checks incomplete: ${record.review_warning}` : ''; $('review-warning').hidden = !record.review_warning;
    $('detail-request').textContent = record.request || '';
    const attachments = (record.attachments || []).filter(item => typeof item.url === 'string' && item.url.startsWith(`/api/changes/${record.id}/attachments/`) && !item.url.includes('\\'));
    const imageKey = `${record.id}:${attachments.map(item => item.id).join(',')}`;
    if ($('detail-images').dataset.key !== imageKey) {renderImages($('detail-images'), attachments); $('detail-images').dataset.key = imageKey;}
    $('detail-attachment-controls').hidden = record.status === 'approved' || building;
    document.querySelector('#feedback-form .attachment-controls button#feedback-attach').hidden = building;
    $('feedback').placeholder = building ? 'Describe what looks wrong in the renders; the next repair pass reads it…' : 'Describe the adjustment…';
    renderBuildingJob(record);
    $('attachment-note').textContent = record.status === 'queued' ? 'Used when the worker starts' : 'Used on the next pass';
    $('detail-summary').textContent = record.summary || ''; $('summary-section').hidden = !record.summary;
    renderSteps(record);
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
    $('approve-force').hidden = !(review && building && Object.values(record.buildings || {}).some(b => b.refused));
    $('approve-change').textContent = building ? 'Accept & commit' : 'Approve & commit';
    $('approval-note').textContent = review && building ? 'Accept writes overrides.json, rebuilds the scene and commits to local main.' : review ? 'Approve applies and commits to local main. Review any incomplete checks.' : record.status === 'approved' ? record.integration?.commit ? 'Committed to local main.' : 'Applied; no commit recorded.' : record.status === 'discarded' ? 'Not applied. Restore to continue.' : '';
    if (initialize) {
      $('final-step-text').value = '';
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
    mutate(async () => { const request = form.elements.request.value.trim(); if (!request) throw new Error('Describe the change you would like to make.'); const record = await api('/api/changes', {request, preview:readPreview(form, true), attachments:createImages, agent:$('create-agent').value || undefined}); form.reset(); createImages = []; renderDraftImages('create'); openDetail(record.id, record); });
  });
  $('feedback-form').addEventListener('submit', event => {
    event.preventDefault(); const id = selected, feedback = $('feedback').value.trim();
    mutate(async () => {if (!feedback) throw new Error('Add feedback for the next pass.'); await api(`/api/changes/${encodeURIComponent(id)}/iterate`, {feedback, attachments:imageDrafts.get(id) || []}); drafts.delete(id); imageDrafts.delete(id); if (selected === id) {$('feedback').value = ''; renderDraftImages('feedback');}});
  });
  $('final-step-form').addEventListener('submit', event => {
    event.preventDefault(); const id = selected, text = $('final-step-text').value.trim();
    mutate(async () => {await api(`/api/changes/${encodeURIComponent(id)}/steps`, {text}); if (selected === id) $('final-step-text').value = '';});
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
  $('approve-force').addEventListener('click', () => {const id = selected; mutate(() => api(`/api/changes/${encodeURIComponent(id)}/approve`, {force:true}));});
  $('bake-change').addEventListener('click', () => mutate(async () => {const record = await api(`/api/changes/${encodeURIComponent(selected)}/bake`, {site:$('bake-site').value}); renderDetail(record);}));
  $('close-detail').addEventListener('click', () => $('detail-dialog').close());
  $('detail-dialog').addEventListener('close', () => {hideDrop(); if (selected) drafts.set(selected, $('feedback').value); selected = null; detail = null; ++detailVersion; $('preview-frame').removeAttribute('src'); history.replaceState(null, '', `${location.pathname}${location.search}`);});
  window.addEventListener('hashchange', followHash);
  for (const tab of ['log', 'diff']) { $(`${tab}-tab`).addEventListener('click', () => setTab(tab)); $(`${tab}-tab`).addEventListener('keydown', event => {if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {event.preventDefault(); const next = event.key === 'Home' ? 'log' : event.key === 'End' ? 'diff' : tab === 'log' ? 'diff' : 'log'; setTab(next); $(`${next}-tab`).focus();}}); }
  // --- Buildings: a derived index, building jobs and escalation --------------------------
  const groupLabels = {'needs-refs': 'Needs references', 'needs-author': 'Needs authoring', 'in-progress': 'In progress', ready: 'Ready to accept', 'needs-attention': 'Needs attention', accepted: 'Accepted', failed: 'Failed'};
  const buildingState = {site: '', group: '', q: '', offset: 0, limit: 100, selection: new Set(), rows: [], current: null, loading: 0};
  const safeUrl = (url, prefix) => typeof url === 'string' && url.startsWith(prefix) && !url.includes('\\') && !url.includes('..');
  function imageGrid(container, images, limit = 24) {
    container.replaceChildren(...(images || []).filter(item => safeUrl(item.url, '/api/buildings/')).slice(0, limit).map(item => {
      const figure = el('figure', item.kind === 'compare' ? 'compare' : ''), link = el('a'), img = el('img');
      link.href = item.url; link.target = '_blank'; link.rel = 'noopener'; img.src = item.url; img.alt = item.name; img.loading = 'lazy';
      link.append(img); figure.append(link, el('figcaption', '', item.name)); return figure;
    }));
  }
  const issueItems = issues => (issues || []).map(issue => el('li', '', `${issue.severity ? `[${issue.severity}] ` : ''}${issue.problem || ''}${issue.fix ? ` — ${issue.fix}` : ''}`));
  const scoresText = scores => scores && typeof scores === 'object' ? Object.entries(scores).map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : '';
  function showView(name) {
    const buildings = name === 'buildings';
    $('changes-view').hidden = buildings; $('buildings-view').hidden = !buildings;
    $(buildings ? 'view-buildings' : 'view-changes').setAttribute('aria-current', 'page');
    $(buildings ? 'view-changes' : 'view-buildings').removeAttribute('aria-current');
    if (buildings && buildingState.site) loadBuildings();
  }
  function setView(name) {
    const url = new URL(location.href);
    if (name === 'buildings') url.searchParams.set('view', 'buildings'); else url.searchParams.delete('view');
    history.pushState(null, '', url); showView(name);
  }
  async function loadBuildings() {
    if (!buildingState.site) return;
    const version = ++buildingState.loading;
    const query = new URLSearchParams({site: buildingState.site, offset: buildingState.offset, limit: buildingState.limit});
    if (buildingState.group) query.set('group', buildingState.group);
    if (buildingState.q) query.set('q', buildingState.q);
    try {
      const data = await api(`/api/buildings?${query}`);
      if (version === buildingState.loading) renderBuildings(data);
    } catch (error) { notice(error.message); }
  }
  function renderBuildings(data) {
    buildingState.rows = data.rows || [];
    const all = Object.values(data.counts || {}).reduce((a, b) => a + b, 0);
    const chip = (group, label, count) => {const button = el('button', '', `${label} ${count}`); button.type = 'button'; button.setAttribute('aria-pressed', String(buildingState.group === group)); button.onclick = () => {buildingState.group = group; buildingState.offset = 0; loadBuildings();}; return button;};
    $('building-groups').replaceChildren(chip('', 'All', all), ...(data.groups || []).filter(g => data.counts[g]).map(g => chip(g, groupLabels[g] || g, data.counts[g])));
    $('buildings-rows').replaceChildren(...buildingState.rows.map(row => {
      const tr = el('tr'), check = el('input'); check.type = 'checkbox'; check.checked = buildingState.selection.has(row.id); check.setAttribute('aria-label', `Select ${row.name || row.address || row.id}`);
      check.onchange = () => {check.checked ? buildingState.selection.add(row.id) : buildingState.selection.delete(row.id); updateSelection();};
      const name = el('button', 'link', row.name || row.address || row.id); name.type = 'button'; name.onclick = () => openBuilding(row.id);
      const who = el('td'); who.append(name, el('span', 'sub', [row.id, row.name && row.address, row.kind].filter(Boolean).join(' · ')));
      const state = el('td', '', groupLabels[row.group] || row.group); state.append(el('span', 'sub', row.status));
      const review = el('td', '', row.verdict || '—'); if (row.forced) review.append(el('span', 'badge warn', 'forced')); if (row.repairs) review.append(el('span', 'badge', `${row.repairs} repair${row.repairs === 1 ? '' : 's'}`));
      const job = el('td'); if (row.job) {const link = el('a', '', `#${row.job}`); link.href = `/changes#${row.job}`; job.append(link);} else job.textContent = '—';
      const box = el('td'); box.append(check); tr.append(box, who, state, review, job); return tr;
    }));
    if (!buildingState.rows.length) {const tr = el('tr'), td = el('td', 'muted', 'No buildings match.'); td.colSpan = 5; tr.append(td); $('buildings-rows').append(tr);}
    const end = Math.min(data.total, data.offset + buildingState.rows.length);
    $('buildings-page').textContent = data.total ? `${data.offset + 1}–${end} of ${data.total}` : '0 of 0';
    $('buildings-prev').disabled = data.offset <= 0; $('buildings-next').disabled = end >= data.total;
    updateSelection();
  }
  function updateSelection() {
    const count = buildingState.selection.size;
    $('building-selection').textContent = count ? `${count} selected` : 'None selected';
    for (const id of ['author-selected', 'reauthor-selected', 'clear-selection']) $(id).disabled = !count || pending;
    const page = buildingState.rows.map(r => r.id);
    $('select-page').checked = page.length > 0 && page.every(id => buildingState.selection.has(id));
  }
  async function queueBuildings(ids, mode) {
    const record = await api('/api/buildings/jobs', {site: buildingState.site, ids, mode});
    buildingState.selection.clear(); updateSelection(); loadBuildings();
    if ($('building-dialog').open) $('building-dialog').close();
    setView('changes'); openDetail(record.id, record);
  }
  async function openBuilding(id) {
    try {
      const info = await api(`/api/buildings/${encodeURIComponent(buildingState.site)}/${encodeURIComponent(id)}`);
      buildingState.current = info;
      $('building-title').textContent = info.name || info.address || `Structure ${info.id}`;
      $('building-status').textContent = `${groupLabels[info.group] || info.group} · ${info.status}`;
      $('building-meta').textContent = [info.id, info.name && info.address, info.kind, info.repairs ? `${info.repairs} repair${info.repairs === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
      const publication = info.accepted_review?.publication || {};
      $('building-warning').textContent = publication.forced ? `Published after ${publication.repair_attempts ?? 'its'} repairs with a failed inspection (${publication.reason || 'forced'}).` : info.review?.repairs_exhausted ? 'Repair rounds are spent and the inspection still fails; accepting needs “Approve anyway”.' : '';
      $('building-warning').hidden = !$('building-warning').textContent;
      const review = info.review || info.accepted_review?.review || {};
      $('building-review').textContent = review.summary ? `${review.verdict || ''}${review.verdict ? ': ' : ''}${review.summary}` : 'No review recorded.';
      $('building-issues').replaceChildren(...issueItems(review.issues));
      $('building-scores').textContent = scoresText(review.scores);
      $('building-cues').replaceChildren(...(info.cues || []).map(cue => el('li', '', cue))); $('building-cues-section').hidden = !(info.cues || []).length;
      imageGrid($('building-images'), info.images); $('building-images-empty').hidden = !!(info.images || []).length;
      $('building-feedback').replaceChildren(...(info.feedback || []).slice(-8).map(entry => el('li', '', `${date(entry.at)} — ${entry.text}`))); $('building-feedback-section').hidden = !(info.feedback || []).length;
      // A standalone preview renders the current draft in place of the accepted blueprint.
      $('building-preview').href = '#';
      $('building-preview').onclick = event => {event.preventDefault(); mutate(async () => {const result = await api('/api/previews', info.preview); if (safeUrl(result.url, '/previews/')) window.open(result.url, '_blank', 'noopener');});};
      $('building-author').disabled = !!info.job || info.status === 'accepted';
      $('building-reauthor').disabled = !!info.job;
      $('escalate-note').value = '';
      if (!$('building-dialog').open) $('building-dialog').showModal();
    } catch (error) { notice(error.message); }
  }
  function renderBuildingJob(record) {
    const section = $('building-job-section');
    section.hidden = record.kind !== 'building';
    if (section.hidden) return;
    const key = JSON.stringify([record.id, record.status, record.iteration, record.buildings, record.updated_at]);
    if ($('building-job-list').dataset.key === key) return;
    $('building-job-list').dataset.key = key;
    const ids = record.building_ids || [];
    $('building-job-list').replaceChildren(...ids.map((id, index) => {
      const entry = (record.buildings || {})[id] || {}, box = el('div', 'building-job');
      const head = el('div', 'building-job-head'), name = el('strong', '', id);
      const state = el('span', 'muted', [entry.status || 'waiting', entry.commit ? `accepted in ${entry.commit.slice(0, 10)}` : '', (entry.steps || []).join(' › ')].filter(Boolean).join(' · '));
      const actions = el('div');
      if (record.status === 'pending_approval' && !entry.commit && entry.status === 'reviewed') {
        const approve = el('button', '', 'Accept'); approve.onclick = () => mutate(() => api(`/api/changes/${encodeURIComponent(record.id)}/approve`, {buildings:[id]})); actions.append(approve);
      }
      if (record.status === 'pending_approval' && !entry.commit && entry.refused) {
        const force = el('button', '', 'Accept anyway'); force.onclick = () => mutate(() => api(`/api/changes/${encodeURIComponent(record.id)}/approve`, {buildings:[id], force:true})); actions.append(force);
      }
      const open = el('button', '', 'Details'); open.onclick = () => {buildingState.site = record.site; $('buildings-site').value = record.site; openBuilding(id);}; actions.append(open);
      head.append(name, state, actions); box.append(head);
      if (entry.error) box.append(el('p', 'notice', entry.error));
      if (entry.refused) box.append(el('p', 'review-warning', `Accept refused: ${entry.refused}`));
      if (index < 12) {
        const images = el('div', 'building-images'), review = el('p', 'prose muted'), issues = el('ul', 'issues');
        box.append(review, issues, images);
        api(`/api/buildings/${encodeURIComponent(record.site)}/${encodeURIComponent(id)}`).then(info => {
          const r = info.review || {}; review.textContent = r.summary ? `${r.verdict || ''}: ${r.summary}` : '';
          issues.replaceChildren(...issueItems(r.issues)); imageGrid(images, info.images, 6);
        }).catch(() => {});
      }
      if (['pending_approval', 'failed', 'cancelled'].includes(record.status) && !entry.commit) {
        const more = el('details'), summary = el('summary', '', 'Feedback for this building'), form = el('form'), text = el('textarea'), submit = el('button', '', 'Repair with feedback');
        text.rows = 2; text.maxLength = 30000; text.required = true; text.placeholder = 'What looks wrong in the renders?'; submit.type = 'submit';
        form.append(text, submit); form.onsubmit = event => {event.preventDefault(); const feedback = text.value.trim(); if (feedback) mutate(() => api(`/api/changes/${encodeURIComponent(record.id)}/iterate`, {feedback, buildings:[id]}));};
        more.append(summary, form); box.append(more);
      }
      return box;
    }));
  }
  $('view-changes').addEventListener('click', event => {event.preventDefault(); setView('changes');});
  $('view-buildings').addEventListener('click', event => {event.preventDefault(); setView('buildings');});
  window.addEventListener('popstate', () => showView(new URLSearchParams(location.search).get('view') === 'buildings' ? 'buildings' : 'changes'));
  $('buildings-site').addEventListener('change', event => {buildingState.site = event.target.value; buildingState.offset = 0; buildingState.selection.clear(); try {localStorage.setItem('town-buildings-site', buildingState.site);} catch {} loadBuildings();});
  let searchTimer;
  $('buildings-search').addEventListener('input', event => {clearTimeout(searchTimer); searchTimer = setTimeout(() => {buildingState.q = event.target.value.trim(); buildingState.offset = 0; loadBuildings();}, 200);});
  $('buildings-filter').addEventListener('submit', event => event.preventDefault());
  $('buildings-prev').addEventListener('click', () => {buildingState.offset = Math.max(0, buildingState.offset - buildingState.limit); loadBuildings();});
  $('buildings-next').addEventListener('click', () => {buildingState.offset += buildingState.limit; loadBuildings();});
  $('select-page').addEventListener('change', event => {for (const row of buildingState.rows) event.target.checked ? buildingState.selection.add(row.id) : buildingState.selection.delete(row.id); loadBuildings();});
  $('clear-selection').addEventListener('click', () => {buildingState.selection.clear(); loadBuildings();});
  $('author-selected').addEventListener('click', () => mutate(() => queueBuildings([...buildingState.selection], 'author')));
  $('reauthor-selected').addEventListener('click', () => mutate(() => queueBuildings([...buildingState.selection], 'reauthor')));
  $('building-author').addEventListener('click', () => mutate(() => queueBuildings([buildingState.current.id], 'author')));
  $('building-reauthor').addEventListener('click', () => mutate(() => queueBuildings([buildingState.current.id], 'reauthor')));
  $('escalate-form').addEventListener('submit', event => {
    event.preventDefault();
    mutate(async () => {
      const record = await api('/api/buildings/escalate', {site: buildingState.site, id: buildingState.current.id, note: $('escalate-note').value, agent: $('escalate-agent').value || undefined});
      $('building-dialog').close(); setView('changes'); openDetail(record.id, record);
    });
  });
  $('close-building').addEventListener('click', () => $('building-dialog').close());
  async function initialize() {
    const results = await Promise.allSettled([api('/api/changes'), api('/api/sites'), api('/api/agents')]);
    if (results[0].status === 'fulfilled') updateBoard(results[0].value); else notice(results[0].reason.message);
    if (results[1].status === 'fulfilled') for (const select of [$('create-site'), $('detail-site'), $('bake-site'), $('buildings-site')]) for (const site of results[1].value.sites || []) {const option = el('option', '', site.title || site.name); option.value = site.name; select.append(option);}
    else notice(results[1].reason.message);
    if (results[2].status === 'fulfilled') for (const select of [$('create-agent'), $('escalate-agent')]) for (const agent of results[2].value.agents || []) {const option = el('option', '', `${agent.name === 'claude' ? 'Claude Code' : 'Codex'} · ${agent.model}`); option.value = agent.name; option.selected = agent.name === results[2].value.default; select.append(option);}
    let savedSite = ''; try {savedSite = localStorage.getItem('town-buildings-site') || '';} catch {}
    const siteOptions = [...$('buildings-site').options].map(option => option.value);
    buildingState.site = siteOptions.includes(savedSite) ? savedSite : siteOptions[0] || '';
    $('buildings-site').value = buildingState.site;
    showView(new URLSearchParams(location.search).get('view') === 'buildings' ? 'buildings' : 'changes');
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
