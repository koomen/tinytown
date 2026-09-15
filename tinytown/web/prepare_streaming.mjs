// node tinytown/web/prepare_streaming.mjs data/<site> [--check]
// Exports the existing models into camera-sector chunks; no research, image
// generation, or model calls. `town bake <site>` drives this.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamAssetRecords } from '../../src/stream-format.js';
import { assertStreamAssetSizes } from './stream-asset-limits.mjs';

const web = dirname(fileURLToPath(import.meta.url));
const root = resolve(web, '../..');
// The exporter is fingerprinted byte-for-byte into every stream manifest.
const EXPORTER = ['stream-export.js', 'stream-export.html'];
const argument = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (!argument) throw new Error('Usage: prepare_streaming.mjs data/<site> [--check]');
const directory = resolve(root, argument);
if (!directory.startsWith(join(root, 'data') + sep)) throw new Error('Expected a site under data/');
const output = join(directory, 'stream');
const digest = data => createHash('sha256').update(data).digest('hex');
async function fingerprints() {
  // Renderer/UI edits do not invalidate baked geometry. Include the generator
  // and all its local dependencies, plus the container/export implementation.
  const sources = ['site.js','bake.js','kit.js','blueprint.js','materials.js','palette.js','rng.js',
    'massing.js','stream-format.js','surface-assets.js','polygon-distance.js','terrain-grid.js'];
  const available = await readdir(join(root, 'src'));
  // Include all generator helpers without relying on the list staying current.
  for (const file of available) if (file.endsWith('.js') && !['main.js','site-data.js','streaming.js',
    'stream-policy.js','stream-debug.js','stream-loader.js','stream-worker.js','bootstrap.js','isocontrols.js','quality.js','context-recovery.js','render-loop.js','loading-progress.js','lighting.js'].includes(file)) {
    if (!sources.includes(file)) sources.push(file);
  }
  const files = Object.fromEntries(sources.filter(f=>available.includes(f)).map(f=>['src/'+f, join(root,'src',f)]));
  for (const name of EXPORTER) files[relative(root, join(web, name)).split(sep).join('/')] = join(web, name);
  const source = createHash('sha256');
  for (const label of Object.keys(files).sort()) {
    source.update(label+'\0'); source.update(await readFile(files[label]));
  }
  return { inputSha256:digest(await readFile(join(directory,'site.json'))), sourceSha256:source.digest('hex') };
}
const inputs = await fingerprints();

// The existing manifest, when its fingerprints match the current inputs and
// every chunk it names verifies; otherwise null. Exports are not byte-reproducible
// (gzip output varies), so re-exporting current assets would only churn them.
async function currentManifest() {
  try {
    const manifest = JSON.parse(await readFile(join(output,'manifest.json')));
    if (JSON.stringify(inputs) !== JSON.stringify({inputSha256:manifest.inputSha256,sourceSha256:manifest.sourceSha256})) return null;
    for (const record of streamAssetRecords(manifest)) {
      const bytes = await readFile(join(output,record.file));
      if (digest(bytes)!==record.sha256 || bytes.length!==record.bytes) return null;
    }
    return manifest;
  } catch { return null; }
}
if (process.argv.includes('--check')) {
  const manifest = JSON.parse(await readFile(join(output,'manifest.json')));
  assertStreamAssetSizes(manifest);
  if (JSON.stringify(inputs) !== JSON.stringify({inputSha256:manifest.inputSha256,sourceSha256:manifest.sourceSha256})) throw new Error('Streaming assets need rebuilding');
  for (const record of streamAssetRecords(manifest)) {
    const bytes = await readFile(join(output,record.file));
    if (digest(bytes)!==record.sha256 || bytes.length!==record.bytes) throw new Error(`Invalid asset ${record.file}`);
  }
  console.log(`Streaming assets current: ${manifest.tiles.length} tiles`);
} else if (!process.argv.includes('--force') && await currentManifest()) {
  console.log(`Streaming assets current: ${(await currentManifest()).tiles.length} tiles (pass --force to re-export)`);
} else {
  // Only an actual build needs the browser harness; --check runs anywhere Node does.
  const { withBrowser, waitFor } = await import('../browser.mjs');
  await mkdir(output, {recursive:true});
  const staging = await mkdtemp(join(output,'.prepare-'));
  try {
    await withBrowser(root, async page => {
      page.events.add(m => { if (m.method === 'Runtime.consoleAPICalled') console.log(m.params.args.map(a=>a.value??a.description).join(' ')); });
      await page.go('/' + relative(root, join(web, 'stream-export.html')).split(sep).join('/'));
      await waitFor(()=>page.evaluate('typeof window.exportStream === "function"'), 'exporter');
      const siteURL = '/'+relative(root,directory).split(sep).join('/')+'/site.json';
      const manifest = await page.evaluate(`window.exportStream(${JSON.stringify(siteURL)}, ${JSON.stringify(directory.split(sep).at(-1))}, async (file,bytes)=>{
        const r=await fetch('/__stream_asset/'+file,{method:'POST',body:bytes});
        if(!r.ok)throw new Error('Could not write '+file+' (HTTP '+r.status+'): '+await r.text());
      })`);
      const mb = n => (n/1048576).toFixed(1)+' MiB';
      console.log(`Base: ${mb(manifest.base.bytes)} download, ${mb(manifest.base.memoryBytes)} geometry/textures`);
      console.log(`${manifest.tiles.length} detail tiles: ${mb(manifest.tiles.reduce((n,t)=>n+t.bytes,0))} total download`);
      if(manifest.regions)console.log(`${manifest.regions.length} landscape regions: ${mb(manifest.regions.reduce((n,t)=>n+t.bytes,0))} loaded as needed`);
      assertStreamAssetSizes(manifest);
      if (JSON.stringify(await fingerprints())!==JSON.stringify(inputs)) throw new Error('Source changed during preparation; rerun');
      Object.assign(manifest, inputs);
      for (const record of streamAssetRecords(manifest)) await rename(join(staging,record.file),join(output,record.file));
      await writeFile(join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
      await rename(join(staging,'manifest.json'),join(output,'manifest.json'));
      // Only one asset revision per site; chunks the new manifest no longer names go.
      const current = new Set(streamAssetRecords(manifest).map(record => record.file));
      for (const file of await readdir(output)) {
        if (/^(base(?:-part-\d+)?|(?:detail|region)--?\d+_-?\d+)-[a-f0-9]{16}\.bin\.gz$/.test(file) && !current.has(file)) await rm(join(output, file));
      }

    }, {route:async (req,res)=>{
      if (!req.url.startsWith('/__stream_asset/')) return false;
      const file=req.url.slice('/__stream_asset/'.length);
      if (req.method!=='POST' || !/^(base(?:-part-\d+)?|(?:detail|region)--?\d+_-?\d+)-[a-f0-9]{16}\.bin\.gz$/.test(file)) { res.writeHead(400); res.end(); return true; }
      const chunks=[]; for await (const chunk of req) chunks.push(chunk);
      try {await writeFile(join(staging,file),Buffer.concat(chunks));res.end('ok');}
      catch(error) {console.error(`Stream asset write failed: ${error.message}`);res.writeHead(500);res.end(error.message);}
      return true;
    }});
  } finally { await rm(staging,{recursive:true,force:true}); }
}
