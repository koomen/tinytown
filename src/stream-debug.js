// Optional controls for comparing the streamed view with the original loader.
import * as THREE from 'three';

export function createStreamDebug({scene,street,streaming,manifest,wake}) {
  if(!document.getElementById('stream-debug-style')) {
    const link=document.createElement('link');link.id='stream-debug-style';link.rel='stylesheet';
    const styleURL=new URL('./stream-debug.css',import.meta.url);styleURL.search=new URL(import.meta.url).search;
    link.href=styleURL.href;document.head.append(link);
  }
  const panel=document.createElement('aside');panel.id='stream-debug';panel.setAttribute('aria-label','Streaming demo controls');
  panel.innerHTML=`
    <details open>
      <summary><span class="stream-dot"></span>Streaming demo</summary>
      <div class="stream-body">
        <p class="stream-count"><strong data-count>0</strong> / ${manifest.tiles.length} detail tiles loaded</p>
        <p data-status>Loading nearby detail…</p>
        <div class="stream-memory"><span>Detail memory</span><span data-memory></span></div>
        <meter data-meter min="0" aria-label="Resident detail memory"></meter>
        <p class="stream-base">Base always loaded: <span data-base></span></p>
        <p class="stream-activity"><span data-loads>0</span> loaded · <span data-evictions>0</span> unloaded since opening</p>
        <div class="stream-actions">
          <button type="button" data-tiles aria-pressed="false">Show tiles</button>
          <button type="button" data-base-only aria-pressed="false">Base only</button>
        </div>
        <p class="stream-legend" hidden><span class="detail">Detail</span><span class="pending">Loading</span><span class="base">Base</span></p>
        <p class="stream-tip">Try “Base only” to see the difference in this view.</p>
        <a data-original>Open original version ↗</a>
      </div>
    </details>`;
  const original=new URL(location.href);original.searchParams.set('stream','0');original.searchParams.delete('tiles');
  panel.querySelector('[data-original]').href=original.href;
  document.body.append(panel);

  // Terrain-following outlines show the geographic ownership of each tile.
  // They do not cast shadows or enter the AO/depth passes (layer 1).
  const group=new THREE.Group();group.name='stream-tile-overlay';group.visible=false;
  const colors={detail:0x47efae,pending:0xffc45e,base:0x809eae};
  const bounds={x0:street.offset.x-street.size.w/2,x1:street.offset.x+street.size.w/2,
    z0:street.offset.z-street.size.d/2,z1:street.offset.z+street.size.d/2};
  const lines=new Map();
  for(const tile of manifest.tiles) {
    const [cx,cz]=tile.id.split('_').map(Number),size=manifest.cellSize;
    const x0=Math.max(bounds.x0,cx*size),x1=Math.min(bounds.x1,(cx+1)*size);
    const z0=Math.max(bounds.z0,cz*size),z1=Math.min(bounds.z1,(cz+1)*size);
    if(x1<=x0 || z1<=z0)continue;
    const corners=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],points=[];
    for(let edge=0;edge<4;edge++) {
      const a=corners[edge],b=corners[(edge+1)%4];
      for(let i=0;i<12;i++) {
        const x=a[0]+(b[0]-a[0])*i/12,z=a[1]+(b[1]-a[1])*i/12;
        points.push(new THREE.Vector3(x,street.surfaces.grade(x,z)+0.3,z));
      }
    }
    const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({color:colors.base,transparent:true,opacity:0.85,depthTest:false,depthWrite:false,toneMapped:false,fog:false}));
    line.layers.set(1);line.renderOrder=10;group.add(line);lines.set(tile.id,line);
  }
  scene.add(group);
  const fields=Object.fromEntries(['count','status','memory','meter','base','loads','evictions'].map(key=>[key,panel.querySelector(`[data-${key}]`)]));
  const tilesButton=panel.querySelector('[data-tiles]'),baseButton=panel.querySelector('[data-base-only]');
  const legend=panel.querySelector('.stream-legend');
  function toggleTiles() {
    group.visible=!group.visible;tilesButton.setAttribute('aria-pressed',String(group.visible));legend.hidden=!group.visible;wake();
  }
  tilesButton.addEventListener('click',toggleTiles);
  baseButton.addEventListener('click',()=>streaming.setDetailEnabled(!streaming.stats.detailEnabled));
  if(new URLSearchParams(location.search).get('tiles')==='1')toggleTiles();
  const mib=bytes=>(bytes/1048576).toFixed(1)+' MiB';
  let previous='';
  return {
    update() {
      const s=streaming.stats,signature=JSON.stringify(s);if(signature===previous)return;previous=signature;
      fields.count.textContent=s.resident.length;
      fields.status.textContent=!s.detailEnabled ? 'Base only — detail is unloaded.'
        : s.loading ? 'Loading nearby detail…'
        : s.failures.some(f=>s.desired.includes(f.id)) ? 'Some detail is unavailable; keeping the base.'
        : !s.resident.length ? 'Zoom in to load detail.' : 'Pan to load a different neighborhood.';
      fields.memory.textContent=`${mib(s.residentBytes)} / ${mib(s.budgetBytes)}`;
      fields.meter.max=s.budgetBytes;fields.meter.value=s.residentBytes;
      fields.base.textContent=mib(s.baseBytes);fields.loads.textContent=s.loads;fields.evictions.textContent=s.evictions;
      baseButton.setAttribute('aria-pressed',String(!s.detailEnabled));
      const resident=new Set(s.resident),pending=new Set(s.desired);
      if(s.loading)pending.add(s.loading);
      for(const [id,line] of lines)line.material.color.setHex(colors[resident.has(id)?'detail':pending.has(id)?'pending':'base']);
    },
    dispose() {
      panel.remove();group.removeFromParent();
      for(const line of lines.values()){line.geometry.dispose();line.material.dispose();}
    },
  };
}
