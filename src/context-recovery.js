// Context loss can be recovered by WebGL. An OS-level tab termination cannot
// run JavaScript; do not attempt automatic reloads that could form a crash loop.
export function installContextRecovery(canvas, { pause, resume }) {
  let notice = null;
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    pause();
    if (notice) return;
    notice = document.createElement('div');
    notice.className = 'render-error';
    notice.setAttribute('role', 'alert');
    const message = document.createElement('p');
    message.textContent = 'The browser paused the scene. You can reload it if it doesn’t resume.';
    const retry = document.createElement('button');
    retry.textContent = 'Reload scene';
    retry.addEventListener('click', () => location.reload());
    notice.append(message, retry);
    document.body.append(notice);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    notice?.remove();
    notice = null;
    resume();
  });
}
