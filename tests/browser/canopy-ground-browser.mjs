import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
await withBrowser(fileURLToPath(new URL('../../',import.meta.url)),async page=>{
  await page.go('/tinytown/web/stream-export.html');
  await waitFor(()=>page.evaluate('typeof window.exportStream === "function"'),'geometry modules');
  console.log('PASS canopy ground',await page.evaluate("import('/tests/browser/checks/canopy-ground.js').then(m=>m.checkCanopyGround())"));
});
