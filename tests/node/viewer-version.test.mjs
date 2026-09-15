import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('changing any runtime dependency invalidates all entry, preload, and import URLs',()=>{
  const root=mkdtempSync(join(tmpdir(),'town-version-'));
  const repo=fileURLToPath(new URL('../..',import.meta.url));
  // Prints the viewer revision; exits non-zero (with the stale message on stderr) when --check fails.
  const run=check=>execFileSync('python3',['-B','-c',
    'import sys; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from tinytown.bake import stamp_viewer, viewer_revision\n'+
    'ok = stamp_viewer(Path(sys.argv[2]), check=sys.argv[3]=="check"); print(viewer_revision(Path(sys.argv[2]))); sys.exit(0 if ok else 1)',
    repo,root,check?'check':'write'],{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split('\n').at(-1);
  try {
    mkdirSync(join(root,'src'));
    for(const name of ['main.js','site-data.js','bootstrap.js','dependency.js'])writeFileSync(join(root,'src',name),'// original');
    writeFileSync(join(root,'index.html'),`<script type="importmap">{"imports":{"three":"https://example.com/three.js"}}</script>
      <link rel="modulepreload" href="./src/main.js"><script defer src="./src/bootstrap.js"></script>
      <script type="module" src="./src/site-data.js"></script><script type="module" src="./src/main.js"></script>`);
    const first=run(false);assert.equal(run(true),first);
    writeFileSync(join(root,'src/dependency.js'),'// updated');
    assert.throws(()=>run(true),/Viewer URLs are stale/);
    const second=run(false);assert.notEqual(first,second);assert.equal(run(true),second);
    const html=readFileSync(join(root,'index.html'),'utf8');
    assert.ok(!html.includes(first));
    assert.equal((html.match(new RegExp('v='+second,'g'))||[]).length,8);
    assert.match(html,/https:\/\/example.com\/three.js/);
    writeFileSync(join(root,'src/new-dependency.js'),'// new dependency');
    assert.throws(()=>run(true),/Viewer URLs are stale/);
    run(false);
    assert.match(readFileSync(join(root,'index.html'),'utf8'),/\.\/src\/new-dependency.js\?v=/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
