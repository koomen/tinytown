import assert from 'node:assert/strict';
import {withBrowser,waitFor} from '../../tinytown/browser.mjs';
await withBrowser(process.cwd(),async page=>{
  await page.go('/tinytown/web/stream-export.html');
  await waitFor(()=>page.evaluate('typeof exportStream === "function"'),'modules');
  console.log('PASS landscape',await page.evaluate("import('/tests/browser/checks/landscape.js').then(m=>m.checkLandscape())"));
  console.log('PASS rural pavement',await page.evaluate("import('/tests/browser/checks/rural-surfaces.js').then(m=>m.checkRuralSurfaces())"));
  await page.go('/avon?stream=0&quality=desktop&time=day');
  await waitFor(()=>page.evaluate('!!window.__town?.street && !document.getElementById("loading")'),'desktop fallback');
  const fallback=await page.evaluate(`(()=>{
    let trees=0;const geometries=new Set();
    __town.street.group.traverse(o=>{if(o.isInstancedMesh&&o.userData.instanceVegetation){trees+=o.count;geometries.add(o.geometry);}});
    return {streaming:!!__town.streaming,mobile:__town.quality.memoryOptimized,trees,geometries:geometries.size};
  })()`);
  assert.equal(fallback.streaming,false);assert.equal(fallback.mobile,false);
  assert.ok(fallback.trees>100 && fallback.geometries<fallback.trees/2,'Desktop fallback must share tree geometry too');
  console.log('PASS desktop fallback instancing',fallback);
});
