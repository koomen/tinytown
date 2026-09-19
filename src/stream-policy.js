import {axisFraction} from './terrain-grid.js';
// Pure selection policy, shared by the viewer and budget/boundary tests.
export function useStreaming(params, siteName) {
  const requested=params.get('stream');
  const authoring=['bp','isolate','stage','procedural','notrees','nobake'].some(key=>params.has(key));
  return !authoring && requested!=='0' && (['avon-extended','chautauqua'].includes(siteName) || requested==='1');
}

// Use the projected span of a nominal 100 m sector, as a fraction of the
// viewport height. At the usual 26° FOV, central detail loads out to ~1800 m
// and stays until ~2075 m. Peripheral sectors simplify sooner, spreading the
// transition across the view instead of dropping every tile at one distance.
export function detailVisible({cameraDepth, depthRadius=0, projectionScale, focusDistance, viewDistance, resident=false}) {
  // A sector's center can pass behind the eye while its foreground buildings
  // remain visible. Reject only bounds entirely behind the camera. Sectors
  // crossing the eye plane need nearby detail; distant thresholds stay intact.
  if (cameraDepth+depthRadius<=0 || focusDistance>=Math.min(240,viewDistance*0.75+40)) return false;
  const projectedSpan=100*projectionScale/(2*Math.max(1,cameraDepth));
  const threshold=0.12*(1+focusDistance/240);
  // Separate enter/leave thresholds keep small zoom reversals from reloading
  // a tile that just switched to its silhouette.
  return projectedSpan>=threshold/(resident?1.15:1);
}

// Reserve detail for the sector under the target before overlapping neighbor
// bounds consume the budget. Elsewhere prefer nearby and already resident tiles.
export function selectDetailTiles(candidates, { budgetBytes, maxTiles }) {
  const ordered = candidates.filter(t=>t.visible).sort((a,b)=>
    Number(!!b.focused)-Number(!!a.focused) ||
    a.distance*(a.resident ? 0.8 : 1)-b.distance*(b.resident ? 0.8 : 1) || a.id.localeCompare(b.id));
  const selected = [];
  let bytes = 0;
  for (const tile of ordered) {
    if (selected.length >= maxTiles) break;
    if (bytes + tile.memoryBytes > budgetBytes) continue;
    selected.push(tile.id); bytes += tile.memoryBytes;
  }
  return selected;
}

// The exported grid samples the same triangle planes used by the continuous
// terrain. Preserve its diagonal when following the ground with the camera.
export function groundSampler({size, offset, ground:{nx,nz,heights,xs,zs}}) {
  return (x,z) => {
    const fx = xs ? axisFraction(xs,x-offset.x) : Math.max(0,Math.min(nx-1e-6,((x-offset.x)/size.w+0.5)*nx));
    const fz = zs ? axisFraction(zs,z-offset.z) : Math.max(0,Math.min(nz-1e-6,((z-offset.z)/size.d+0.5)*nz));
    const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,k=j*(nx+1)+i;
    const a=heights[k],b=heights[k+1],d=heights[k+nx+1],c=heights[k+nx+2];
    return u+v<=1 ? a+(b-a)*u+(d-a)*v : c+(d-c)*(1-u)+(b-c)*(1-v);
  };
}
