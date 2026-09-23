// Deterministic landmark details. Geometry consumes surveyed/map coordinates;
// no random recreation grounds or guessed stream courses are introduced here.
import * as THREE from 'three';
import { mat, box } from './kit.js';
import { ribbonStrip } from './landmark-ribbon.js';
import { drapeTriangles } from './landmark-drape.js';
import { buildPlaygroundEquipment } from './playground.js';
import { buildPerimeter } from './perimeter.js';
import { buildBaseball } from './baseball.js';
import { buildParkSign } from './park-sign.js';
import { buildAmphitheaterGarden } from './amphitheater-garden.js';
import { buildOrnamentalPaving } from './ornamental-paving.js';
import { buildSchoolSign, buildSchoolForecourt } from './school-entrance.js';
import { quickleesSignMaterial } from './quicklees-signs.js';
import { buildFootballField, buildRunningTrack } from './football-field.js';
import { buildDock, buildMooredBoats } from './boats.js';
import { andriacciosSignMaterial, buildAndriacciosGround } from './andriaccios-sign.js';
import { buildGateBarrier } from './gate-barrier.js';
import { surfaceMaterial } from './materials.js';
import { buildRoadWaterBridges } from './road-water-bridges.js';
import { buildTennisCourt } from './tennis-court.js';
import { buildStadiumBleachers } from './stadium-bleachers.js';
import { buildBasketballHoop } from './basketball-hoop.js';
import { buildBasketballCourt } from './basketball-court.js';
import { buildCornfield } from './cornfield.js';
import { buildCroplandSurface } from './cropland.js';

export function signBrand(text = '') {
  const value = String(text).toLowerCase().replace(/[^a-z]/g, '');
  return value === 'tomwahls' ? 'tom-wahls' : value === 'mcdonalds' ? 'mcdonalds-wordmark' : value === 'barilla' ? 'barilla' : null;
}

// Local recreations of the distinctive signs, carried by ordinary CanvasTexture
// so the same bake/stream serialization as other blueprint signs applies.
export function brandSignMaterial(brand, aspect = 3) {
  const restaurant = andriacciosSignMaterial(brand, aspect);
  if (restaurant) return restaurant;
  const storefront = quickleesSignMaterial(brand, aspect);
  if (storefront) return storefront;
  if (!['tom-wahls', 'mcdonalds', 'mcdonalds-wordmark', 'barilla'].includes(brand)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(256, Math.min(2048, Math.round(512 * aspect))); canvas.height = 512;
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  c.scale(W / 1000, H / 500);
  if (brand === 'mcdonalds') {
    // The arches are drawn as paired parabolic ribbons, not a typeset M.
    c.fillStyle = '#ffc72c'; c.beginPath();
    c.moveTo(185, 460); c.bezierCurveTo(185, -95, 482, -95, 500, 323);
    c.bezierCurveTo(518, -95, 815, -95, 815, 460); c.lineTo(713, 460);
    c.bezierCurveTo(713, 62, 556, 30, 548, 460); c.lineTo(452, 460);
    c.bezierCurveTo(444, 30, 287, 62, 287, 460); c.closePath(); c.fill();
  } else if (brand === 'mcdonalds-wordmark') {
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 230px Arial, sans-serif'; c.fillText("McDonald’s",500,265,960);
  } else if (brand === 'barilla') {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(500,250,492,235,0,0,Math.PI*2); c.fill();
    c.fillStyle = '#c81829'; c.beginPath(); c.ellipse(500,250,475,216,0,0,Math.PI*2); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'italic 900 240px Georgia, serif'; c.fillText('Barilla', 500, 263, 790);
  } else {
    // The photographed Avon rooftop sign is a tapered rounded paddle with
    // two stacked rows of black italic letters and a thin pink neon rim.
    c.fillStyle = '#ecebe3'; c.beginPath(); c.moveTo(110,125);
    c.quadraticCurveTo(105,22,235,20); c.lineTo(765,20);
    c.quadraticCurveTo(895,20,880,145); c.lineTo(700,478);
    c.lineTo(300,478); c.closePath(); c.fill();
    c.strokeStyle = '#c47c87'; c.lineWidth = 8; c.stroke();
    c.fillStyle = '#202321'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'italic 900 160px Arial, sans-serif'; c.fillText('TOM',500,130,610);
    c.fillText('WAHL’S',500,280,700);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({map:texture, roughness:.75, alphaTest:.45, side:THREE.DoubleSide});
  material.userData.landmarkBrand = brand;
  return material;
}

function surface(points, grade, color, lift = .09, grid = null, holes = []) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p[0], -p[1])));
  for (const ring of holes) shape.holes.push(new THREE.Path(ring.map(([x,z]) => new THREE.Vector2(x,-z))));
  const geometry = new THREE.ShapeGeometry(shape), pos = geometry.attributes.position;
  for (let i=0; i<pos.count; i++) { const x=pos.getX(i), z=-pos.getY(i); pos.setXYZ(i,x,grade(x,z)+lift,z); }
  if(grid) {
    const data=drapeTriangles(Array.from({length:pos.count},(_,i)=>[pos.getX(i),pos.getZ(i)]),Array.from(geometry.index.array),grade,grid,lift);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');geometry.setIndex(data.indices);
  }
  geometry.computeVertexNormals(); const mesh=new THREE.Mesh(geometry,mat(color));mesh.name='landmark-surface';return mesh;
}
function ribbon(points, width, grade, color, closed = false, lift = .12, grid = null) {
  const {positions,indices}=ribbonStrip(points,width,closed);
  const data=drapeTriangles(positions,indices,grade,grid,lift);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setIndex(data.indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat(color));mesh.name='landmark-ribbon';return mesh;
}
export function buildLandmarks(features = [], {grade = () => 0, grid = null,
  waterGrade = null,roadCrossings = []} = {}) {
  const root = new THREE.Group(); root.name='mapped-landmarks';
  for(const f of features) {
    if(!f.pts?.length) continue;
    if(f.kind==='cropland') {
      root.add(buildCroplandSurface(f,grade,grid));
      if(f.crop?.type==='corn')root.add(buildCornfield(f,grade));
      continue;
    }
    const g=new THREE.Group();g.name=`landmark-${f.kind}-${f.id}`;g.userData.source=f.source;
    if(f.kind==='garden' && f.garden?.type==='carnahan-jackson') {
      g.userData.streamKind='landmark';
      g.add(buildAmphitheaterGarden(f,grade));
    }
    if(f.kind==='paving') g.add(buildOrnamentalPaving(f,grade,grid));
    if(f.kind==='basketball-hoop') g.add(buildBasketballHoop(f,grade));
    if(f.kind==='bleachers') {
      g.userData.streamKind='landmark';
      g.add(buildStadiumBleachers(f,grade,grid));
    }
    if(f.kind==='barrier') g.add(buildPerimeter(f,grade));
    if(f.kind==='park-sign') g.add(buildParkSign(f,grade));
    if(f.kind==='school-sign') g.add(buildSchoolSign(f,grade));
    if(f.kind==='school-forecourt') g.add(buildSchoolForecourt(f,grade,grid));
    if(f.kind==='andriaccios-ground') g.add(buildAndriacciosGround(f,grade,grid));
    if(f.kind==='gate-barrier') {
      g.userData.streamKind='landmark';
      g.add(buildGateBarrier(f,{grade}));
    }
    if(f.kind==='track') g.add(f.athletics ? buildRunningTrack(f,grade,grid)
      : ribbon(f.pts,f.width || 4,grade,f.color || '#b0a18a',f.closed,.12,grid));
    if(f.kind==='gravel') {
      const gravel=surface(f.pts,grade,f.color || '#85867e',.12,grid);
      gravel.material=surfaceMaterial('gravel',f.color||'#85867e');g.add(gravel);
    }
    if(f.kind==='water') {
      const waterSample=Number.isFinite(f.level)?()=>f.level:
        waterGrade?(x,z)=>waterGrade(x,z)-.12:grade;
      const bankGrade=waterGrade&&!Number.isFinite(f.level)
        ?(x,z)=>Math.min(grade(x,z),waterGrade(x,z)-.085):grade;
      // Thin gravel/silt margins give the mapped water a visible shoreline.
      // They share the exact terrain triangulation, including rural cells.
      const breadth=([x,z])=>(f.width||3)*(1+.055*Math.sin(x*.11+z*.071)+.035*Math.sin(z*.19-x*.063));
      const margin=([x,z])=>1.7+.7*Math.sin(x*.21+z*.16)+.45*Math.sin(z*.32-x*.15);
      const bank=ribbon(f.pts,f.closed?1.5:p=>breadth(p)+margin(p),bankGrade,'#817b62',!!f.closed,.065,grid);
      bank.material=surfaceMaterial('riverbank','#817b62');g.add(bank);
      const water=f.closed ? surface(f.pts,waterSample,'#466763',.12,Number.isFinite(f.level)?null:grid)
        : ribbon(f.pts,breadth,waterSample,'#466763',false,.12,grid);
      water.material=surfaceMaterial('water','#466763');g.add(water);
    }
    if(f.kind==='beach')g.add(surface(f.pts,grade,'#d6c39a',.13,grid));
    if(f.kind==='pier') {
      if(f.dock?.planked) {
        g.userData.streamKind='landmark';
        g.add(buildDock(f,{grade}));
      } else {
        const deck=Number.isFinite(f.level)?()=>f.level:grade;
        g.add(f.closed?surface(f.pts,deck,'#b3a388',.1,null):ribbon(f.pts,f.width||2,deck,'#b3a388',false,.1,null));
        for(const [x,z] of f.pts)g.add(box(.18,1.3,.18,'#827860',x,deck(x,z)-.35,z));
      }
    }
    if(f.kind==='pitch') {
      if(f.sport==='tennis' && f.tennis) {
        g.userData.streamKind='landmark';
        g.add(buildTennisCourt(f,grade,grid));root.add(g);continue;
      }
      const court = ['tennis','basketball','volleyball','pickleball'].includes(f.sport);
      const playingSurfaces=f.baseball?.surfaces || [];
      // Nested surveyed patches cut holes in their parent surface. Coplanar
      // grass/dirt overlays flicker at map distance and after stream merging.
      g.add(surface(f.pts,grade,f.color || (court ? '#87938b' : '#739460'),.09,grid,
        playingSurfaces.length ? [playingSurfaces[0].pts] : []));
      if(f.sport==='american_football' && f.football) {
        g.userData.streamKind='landmark';
        g.add(buildFootballField(f,grade,grid));
      }
      if(f.sport==='basketball' && f.basketball) g.add(buildBasketballCourt(f,grade,grid));
      if(court && !f.basketball) g.add(ribbon(f.pts,.12,grade,'#e9e4cf',true,.15,grid));
      // Base positions must be independently surveyed in the data; a field
      // polygon alone does not establish home plate or the infield direction.
      for (const [i, patch] of playingSurfaces.entries()) {
        const mesh = surface(patch.pts,grade,patch.color,.13,grid,
          playingSurfaces[i+1] ? [playingSurfaces[i+1].pts] : []);
        mesh.name = `baseball-${patch.role}`;g.add(mesh);
      }
      if(f.bases?.length===4) {
        if (!f.baseball?.surfaces && f.infield !== 'grass') g.add(surface(f.bases,grade,'#bd9570',.13,grid));
        else if (!f.baseball?.surfaces) for (const [x,z] of [...f.bases,[(f.bases[0][0]+f.bases[2][0])/2,(f.bases[0][1]+f.bases[2][1])/2]]) {
          const ring=Array.from({length:16},(_,i)=>[x+Math.cos(i*Math.PI/8)*1.5,z+Math.sin(i*Math.PI/8)*1.5]);
          g.add(surface(ring,grade,'#bd9570',.14,grid));
        }
        const home=f.bases[0],first=f.bases[1],third=f.bases[3];
        const extend=(base,length)=>{
          const d=Math.hypot(base[0]-home[0],base[1]-home[1]);
          return length ? home.map((v,i)=>v+(base[i]-v)*length/d) : base;
        };
        const line=ribbon([extend(third,f.baseball?.foulLengths?.[1]),home,extend(first,f.baseball?.foulLengths?.[0])],.13,grade,'#eee7cf',false,playingSurfaces.length ? .23 : .16,grid);
        line.name='baseball-foul-lines';g.add(line);
        const angle=-Math.atan2(first[1]-home[1],first[0]-home[0]);
        for(const [x,z] of f.bases) {
          const base=box(.48,.05,.48,'#f6f0df',x,grade(x,z)+(playingSurfaces.length ? .25 : .18),z);
          if(playingSurfaces.length)base.rotation.y=angle;
          base.name='baseball-base';g.add(base);
        }
        if(f.baseball?.pitcher) {
          const [x,z]=f.baseball.pitcher;
          const rubber=box(.61,.045,.15,'#f6f0df',x,grade(x,z)+.25,z);
          rubber.rotation.y=-Math.atan2(third[1]-first[1],third[0]-first[0]);
          rubber.name='baseball-pitching-rubber';g.add(rubber);
        }
      }
      if(f.sport==='baseball' && f.baseball) g.add(buildBaseball(f,grade));
    }
    if(f.kind==='playground') {
      const color=f.color||'#c0aa80',pad=surface(f.pts,grade,color,.09,grid);
      if(f.surface==='gravel')pad.material=surfaceMaterial('gravel',color);
      g.add(pad);
      g.add(buildPlaygroundEquipment(f.equipment,grade));
    }
    // Authored installations can retain their small markings and hardware in
    // the distant map as well as the source preview.
    if(f.streamCoarse) {
      g.userData.streamKind='landmark';
      g.traverse(o=>{if(o.isMesh)o.userData.streamCoarse=true;});
    }
    root.add(g);
  }
  for(const model of buildMooredBoats(features).children.slice()) root.add(model);
  for(const bridge of buildRoadWaterBridges(roadCrossings,grade,grid))root.add(bridge);
  return root;
}
