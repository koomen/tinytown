import {fileURLToPath} from 'node:url';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';

const root = fileURLToPath(new URL('../../',import.meta.url));
await withBrowser(root,async page => {
  await page.go('/tinytown/web/stream-export.html');
  await waitFor(()=>page.evaluate('typeof window.exportStream === "function"'),'geometry modules');
  const result = await page.evaluate(`(async()=>{
    const {checkRoofJoins}=await import('/tests/browser/checks/roof-joins.js');
    const {checkGasStation,checkLaundromatWalls}=await import('/tests/browser/checks/surfaces.js');
    const {checkFidelityGeometry}=await import('/tests/browser/checks/fidelity.js');
    const {checkPolygonBlueprint}=await import('/tests/browser/checks/polygon.js');
    const roofs=await checkRoofJoins();
    await checkGasStation();await checkLaundromatWalls();checkFidelityGeometry();await checkPolygonBlueprint();
    return roofs;
  })()`);
  console.log('PASS roof joins, foundation clearance, existing wall and polygon geometry',JSON.stringify(result));
});
