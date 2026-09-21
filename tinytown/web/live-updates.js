// Short requests leave HTTP/1 connections available for maps and other tabs.
export function watchJSON(url, receive, {connected = () => {}, disconnected = () => {}, interval = 1000} = {}) {
  let stopped = false, timer, controller, previous;
  async function update() {
    if (stopped || controller) return;
    if (document.hidden) { timer = setTimeout(update, interval); return; }
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 10000);
    try {
      const response = await fetch(url, {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error(`Update failed (${response.status})`);
      const data = await response.json();
      if (!stopped) {
        connected();
        const signature = JSON.stringify(data);
        if (signature !== previous) { receive(data); previous = signature; }
      }
    } catch (error) { previous = undefined; if (!stopped) disconnected(error); }
    finally {
      clearTimeout(timeout); controller = null;
      if (!stopped) timer = setTimeout(update, interval);
    }
  }
  const visible = () => { if (!document.hidden && !controller) { clearTimeout(timer); update(); } };
  document.addEventListener('visibilitychange', visible);
  update();
  return () => { stopped = true; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visible); };
}
