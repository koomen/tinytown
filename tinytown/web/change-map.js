const id = document.body.dataset.change;
const status = document.getElementById('status'), button = document.getElementById('bake');
const select = document.getElementById('site'), frame = document.getElementById('world'), error = document.getElementById('error');
let initialized = false;
function render(record) {
  const attempt = record.bake, baked = record.baked;
  const active = ['queued', 'running'].includes(attempt?.status);
  button.disabled = active;
  button.textContent = baked ? 'Bake again' : 'Bake world';
  select.disabled = active;
  if (!initialized) {
    select.value = attempt?.site || baked?.site || record.preview?.site || select.options[0]?.value;
    initialized = true;
  }
  status.textContent = active ? `Bake ${attempt.status}` : baked ? baked.stale ? 'Source changed since this bake' : 'Bake ready' : 'No bake yet';
  error.textContent = attempt?.error || ''; error.hidden = !error.textContent;
  if (baked) {
    const url = `/previews/${id}/map/${baked.id}/?site=${encodeURIComponent(baked.site)}&stream=1`;
    if (frame.getAttribute('src') !== url) frame.src = url;
    frame.hidden = false;
  }
}
button.onclick = async () => {
  button.disabled = true;
  try {
    const response = await fetch(`/api/changes/${id}/bake`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-TinyTown': 'changes'}, body: JSON.stringify({site: select.value})});
    const record = await response.json();
    if (!response.ok) throw new Error(record.error);
    render(record);
  } catch (cause) { error.textContent = cause.message; error.hidden = false; button.disabled = false; }
};
async function start() {
  try {
    const {watchJSON} = await import('/tinytown/web/live-updates.js');
    const response = await fetch('/api/sites');
    const data = await response.json();
    for (const site of data.sites) select.add(new Option(site.title || site.name, site.name));
    watchJSON(`/previews/${id}/map/events?poll=1`, render, {
      disconnected: () => { status.textContent = 'Reconnecting…'; },
    });
  } catch (cause) { error.textContent = cause.message; error.hidden = false; }
}
start();
