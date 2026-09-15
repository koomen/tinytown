// A deferred classic script runs before the document's module entries, even
// when their downloads fail. Keep those modules in the initial document load:
// dynamically importing them here lets the browser finish loading too early.
(() => {
  const entries = document.querySelectorAll('script[data-startup]');
  const params = new URLSearchParams(location.search);
  const diagnose = params.has('diagnose');
  const viewer = new URL(document.querySelector('script[src*="/main.js"]').src).searchParams.get('v') || 'unversioned';
  const fallbackURL = new URL(location.href);
  fallbackURL.searchParams.set('stream', '0');
  fallbackURL.searchParams.set('stream-fallback', '1');
  const errors = [];
  let phase, recoveryScheduled = false;
  let previous;
  if (params.has('stream-fallback')) try { previous = JSON.parse(sessionStorage.getItem('town-stream-failure')); } catch { /* storage unavailable */ }
  function failed(error) {
    const loading = document.getElementById('loading');
    if (!loading || loading.classList.contains('done')) return;
    console.error('Unable to load the town:', error);
    const what = loading.querySelector('.what');
    phase ||= what.textContent;
    const message = error?.message ? `${error.name || 'Error'}: ${error.message}` : String(error || 'Unknown startup error');
    if (!errors.includes(message) && errors.length < 5) errors.push(message);
    const report = { phase, loader: loading.dataset.loader || 'modules', viewer, errors: [...errors], browser: navigator.userAgent };
    window.__townLoadFailure = report;
    const details = loading.querySelector('.error-details');
    if (details) {
      details.hidden = false;
      details.open = diagnose;
      details.querySelector('pre').textContent = [
        `Stage: ${report.phase}`, `Loader: ${report.loader}`, `Viewer: ${viewer}`, ...report.errors,
        ...(previous ? [`Previous streaming failure: ${previous.errors?.join('; ')}`] : []), report.browser,
      ].join('\n\n');
    }
    // A fresh document releases the failed attempt's buffers and renderer.
    // The explicit stream=0 URL makes recovery a single attempt, even when
    // storage is blocked. ?diagnose keeps the original failure visible.
    if (report.loader === 'streaming' && params.get('stream') !== '0' && !params.has('stream-fallback') && !diagnose) {
      loading.classList.add('failed');
      what.textContent = 'Trying another way to load the town…';
      if (!recoveryScheduled) {
        recoveryScheduled = true;
        setTimeout(() => {
          try { sessionStorage.setItem('town-stream-failure', JSON.stringify(window.__townLoadFailure)); } catch { /* storage unavailable */ }
          location.replace(fallbackURL.href);
        }, 0);
      }
      return;
    }
    if (loading.classList.contains('failed')) return;
    loading.classList.add('failed');
    what.setAttribute('role', 'alert');
    what.textContent = 'Couldn’t load the town. Please try again.';
    const retry = loading.querySelector('.retry');
    retry.hidden = false;
    retry.addEventListener('click', () => location.reload(), { once: true });
    const original = loading.querySelector('.original');
    if (original && report.loader === 'streaming') { original.hidden = false; original.href = fallbackURL.href; }
  }
  // Dependency download/parse errors are reported on the entry script. Thrown
  // initialization errors (including top-level await) are reported on window.
  for (const entry of entries) entry.addEventListener('error', () => failed(`Unable to load ${entry.src}`));
  window.addEventListener('error', event => {
    if (event.error || event.message) failed(event.error || event.message);
  });
  window.addEventListener('unhandledrejection', event => failed(event.reason));
})();
