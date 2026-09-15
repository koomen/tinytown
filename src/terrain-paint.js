import {fbm} from './noise.js';

// Terrain outside town uses cells up to 12 m across. Bridge refinement adds
// narrow rows/columns through that grid, so coloring each new vertex with
// metre-scale noise reveals the refinement as a cross. Use broad meadow
// variation there, with the detail level tied to geography rather than the
// particular vertices a bridge happens to add.
export function terrainPaintNoise(x, z, site) {
  const center=site.townCenter??{x:0,z:0};
  const distance=Math.max(Math.abs(x-center.x)-260,Math.abs(z-center.z)-400);
  const rural=site.size.w<=900 && site.size.h<=900 ? 0 : Math.max(0,Math.min(1,distance/250));
  const mix=rural*rural*(3-2*rural);
  const detail=1-mix;
  let texture=0,grain=0,meadow=0;
  if(detail>0) {
    texture=detail*fbm(x*.2+3,z*.2+5);
    grain=detail*(fbm(x*1.3,z*1.3)-.5)*.025;
    meadow=detail*(fbm(x*.045+21,z*.045+9)-.5);
  }
  if(mix>0) {
    // Even the second octave spans several rural cells in both directions.
    texture+=mix*fbm(x*.008+3,z*.008+5);
    meadow+=mix*(fbm(x*.0045+21,z*.0045+9)-.5);
  }
  return {texture,grain,meadow};
}
