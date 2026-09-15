import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
await withBrowser(fileURLToPath(new URL('../../',import.meta.url)),async page=>{
  await page.go('/tinytown/web/stream-export.html');
  await waitFor(()=>page.evaluate('typeof window.exportStream === "function"'),'geometry modules');
  console.log('PASS arcades',await page.evaluate("import('/tests/browser/checks/arcades.js').then(m=>m.checkArcades())"));
  console.log('PASS existing doors',await page.evaluate("import('/tests/browser/checks/doors.js').then(m=>m.checkDoorHeads())"));
  console.log('PASS existing decks',await page.evaluate("import('/tests/browser/checks/decks.js').then(m=>m.checkDecks())"));
});
