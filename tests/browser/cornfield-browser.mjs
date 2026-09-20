import { withBrowser, waitFor } from '../../tinytown/browser.mjs';
await withBrowser(new URL('../../',import.meta.url).pathname,async page=>{
  await page.go('/tinytown/web/stream-export.html');
  await waitFor(()=>page.evaluate('typeof window.exportStream === "function"'),'geometry modules');
  console.log('PASS cornfield',await page.evaluate("import('/tests/browser/checks/cornfield.js').then(m=>m.checkCornfield())"));
});
