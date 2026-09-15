// Bestor's four allegories are low stone carvings, including their attributes.
// Everything is mesh geometry so the figures and letters survive sector baking.
import * as THREE from 'three';
import { mat } from './kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function shapeFrom(commands) {
  const shape = new THREE.Shape();
  for (const [op, ...args] of commands) shape[op](...args);
  return shape;
}
const M = (x,y) => ['moveTo',x,y], L = (x,y) => ['lineTo',x,y];
const Q = (x,y,u,v) => ['quadraticCurveTo',x,y,u,v];

function carving(group, material) {
  const add = (geometry, name, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.z = z; group.add(mesh); return mesh;
  };
  return {
    shape(name, commands, z = .025, depth = .032) {
      return add(new THREE.ExtrudeGeometry(shapeFrom(commands), {
        depth, bevelEnabled:true, bevelSize:.011, bevelThickness:.01,
        bevelSegments:1, curveSegments:5, steps:1,
      }), name, z);
    },
    oval(name, x, y, rx, ry, z = .06, rz = .05) {
      const mesh = add(new THREE.SphereGeometry(1,12,10), name, z);
      mesh.position.x = x; mesh.position.y = y; mesh.scale.set(rx,ry,rz); return mesh;
    },
    line(name, points, radius = .014, z = .077) {
      const curve = new THREE.CatmullRomCurve3(points.map(([x,y]) => new THREE.Vector3(x,y,0)));
      const mesh = add(new THREE.TubeGeometry(curve,Math.max(8,points.length*5),radius,5,false),name,z);
      mesh.scale.z = .55; return mesh;
    },
  };
}

function robe(c, kind) {
  const scholar = kind === 'KNOWLEDGE', male = kind === 'RELIGION';
  c.shape('fountain-relief-robe', [M(-.11,2.55),Q(-.28,2.5,-.36,2.33),
    Q(-.4,1.9,-.28,1.5),Q(-.32,.83,-.43,.29),Q(-.33,.19,-.18,.24),
    Q(-.03,.18,.09,.23),Q(.28,.16,.42,.25),Q(.31,.85,.25,1.42),
    Q(.4,1.91,.29,2.37),Q(.21,2.5,.09,2.54),L(-.11,2.55)], .023,.045);
  // The front tunic swells out of the background; broad overlapping drapery
  // makes a carved figure instead of the former freestanding cone silhouette.
  c.shape('fountain-relief-tunic', [M(-.13,2.44),Q(.02,2.29,.19,2.47),
    Q(.24,1.99,.15,1.74),Q(.13,1.01,.32,.28),Q(.13,.2,-.08,.26),
    Q(-.17,.85,-.15,1.35),Q(-.25,1.91,-.13,2.44)],.061,.035);
  c.oval('fountain-relief-tunic-fold',-.015,2.02,.167,.41,.072,.045);
  c.oval('fountain-relief-tunic-fold',-.06,.94,.098,.62,.081,.035);
  c.oval('fountain-relief-tunic-fold',.13,.78,.084,.48,.083,.029);
  c.shape('fountain-relief-mantle', [M(-.13,2.51),Q(-.39,2.42,-.43,2.24),
    Q(-.48,1.61,-.4,1.12),Q(-.34,.9,-.24,.78),Q(-.31,1.3,-.24,1.66),
    Q(-.26,2.13,-.05,2.39),L(-.13,2.51)],.064,.037);
  c.shape('fountain-relief-mantle', [M(.08,2.52),Q(.37,2.46,.43,2.19),
    Q(.43,1.67,.47,1.16),Q(.32,1.34,.2,1.66),Q(.23,2.13,.08,2.52)],.063,.027);
  for (const [i,points] of [
    [[-.15,1.73],[-.12,1.24],[-.14,.72],[-.18,.31]],
    [[-.02,1.71],[.015,1.23],[.04,.7],[.035,.27]],
    [[.11,1.64],[.13,1.15],[.18,.67],[.22,.29]],
    [[-.32,1.12],[-.32,.7],[-.37,.33]],
  ].entries()) c.line('fountain-relief-drapery',points,i===1?.018:.012,.114);
  c.line('fountain-relief-neckline',[[-.14,2.43],[-.05,2.34],[.04,2.33],[.16,2.43]],.016,.118);
  if (!scholar && !male) {
    c.line('fountain-relief-sash',[[-.26,1.76],[-.13,1.7],[.05,1.69],[.25,1.76]],.026,.125);
    c.line('fountain-relief-drapery',[[-.31,1.36],[-.18,1.2],[.05,1.16],[.23,1.32]],.023,.119);
  }
  c.oval('fountain-relief-foot',-.12,.218,.105,.05,.094,.044);
  c.oval('fountain-relief-foot',.145,.208,.102,.047,.096,.044);
}

function head(c, kind) {
  const male = kind === 'RELIGION', x = kind === 'KNOWLEDGE' ? .035 : -.025;
  c.oval('fountain-relief-neck',x,2.53,.068,.13,.079,.051);
  c.oval('fountain-relief-hair',x,2.8,.15,.194,.045,.065);
  c.oval('fountain-relief-face',x-.006,2.775,.107,.153,.102,.071);
  c.oval('fountain-relief-nose',x-.02,2.785,.019,.045,.163,.031);
  c.line('fountain-relief-brow',[[x-.082,2.835],[x-.055,2.841],[x-.029,2.836]],.01,.164);
  c.line('fountain-relief-brow',[[x+.019,2.836],[x+.045,2.84],[x+.075,2.833]],.009,.16);
  c.line('fountain-relief-mouth',[[x-.033,2.708],[x-.005,2.711],[x+.027,2.707]],.006,.169);
  for (const s of [-1,1]) {
    const end=kind==='KNOWLEDGE'?2.66:2.55;
    c.line('fountain-relief-hair',[[x+s*.11,2.89],[x+s*.144,2.78],[x+s*.125,end+.06],[x+s*.145,end]],.024,.097);
  }
  c.line('fountain-relief-hair',[[x-.116,2.877],[x-.055,2.964],[x+.045,2.972],[x+.133,2.882]],.027,.116);
  if (male) {
    c.shape('fountain-relief-beard',[M(x-.10,2.74),Q(x-.11,2.56,x-.04,2.46),
      L(x+.025,2.43),Q(x+.13,2.57,x+.105,2.745),Q(x+.055,2.64,x,2.655),Q(x-.065,2.66,x-.10,2.74)],.112,.043);
    for (const dx of [-.045,0,.045]) c.line('fountain-relief-beard-lock',[[x+dx,2.63],[x+dx+.012,2.57],[x+dx-.008,2.5]],.011,.172);
  }
}

function art(c) {
  c.shape('fountain-art-sleeve',[M(-.3,2.36),Q(-.49,2.06,-.42,1.88),Q(-.37,1.82,-.22,1.88),
    L(-.12,2.02),L(-.18,2.1),L(-.31,2.04),L(-.25,2.28),L(-.3,2.36)],.094,.037);
  c.line('fountain-art-brush',[[-.3,2.2],[-.21,2.39],[-.15,2.61]],.019,.156);
  c.line('fountain-art-forearm',[[-.26,2.01],[-.285,2.15],[-.225,2.3]],.036,.153);
  c.oval('fountain-art-brush-tip',-.145,2.633,.024,.062,.158,.017);
  c.oval('fountain-art-hand',-.225,2.326,.06,.081,.149,.05);
  c.shape('fountain-art-sleeve',[M(.27,2.3),Q(.4,2.02,.39,1.72),L(.34,1.55),L(.25,1.6),
    L(.27,1.86),Q(.21,2.12,.21,2.26),L(.27,2.3)],.096,.038);
  // Broad painter's palette hanging at the right hip, with a real thumb hole.
  const outline=shapeFrom([M(.25,1.53),Q(.38,1.6,.48,1.44),Q(.57,1.2,.39,.94),
    Q(.19,1.06,.16,1.3),Q(.14,1.45,.25,1.53)]);
  const hole=new THREE.Path();hole.absellipse(.322,1.421,.032,.047,0,Math.PI*2,true);outline.holes.push(hole);
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.034,bevelEnabled:true,
    bevelSize:.014,bevelThickness:.01,bevelSegments:1,curveSegments:6}),c.material);
  mesh.position.z=.132;mesh.name='fountain-art-palette';c.group.add(mesh);
  c.oval('fountain-art-hand',.31,1.59,.054,.083,.169,.044);
}

function religion(c) {
  c.shape('fountain-religion-sleeve',[M(-.3,2.39),Q(-.46,2.19,-.42,1.97),
    Q(-.33,1.88,-.18,2.09),L(.02,2.29),L(-.025,2.37),L(-.3,2.2),L(-.3,2.39)],.103,.04);
  // The stone tablet is held against the chest, with incised-looking short rows.
  c.shape('fountain-religion-tablet',[M(-.035,2.29),Q(.16,2.32,.35,2.23),L(.35,1.54),
    L(-.045,1.59),L(-.035,2.29)],.142,.047);
  c.line('fountain-religion-tablet-edge',[[.008,2.23],[.01,1.65],[.3,1.61]],.012,.2);
  const shadow=carving(c.group,c.dark);
  for(let row=0;row<5;row++) for(let part=0;part<3;part++) {
    const x=.043+part*.085,y=2.13-row*.1;
    shadow.line('fountain-religion-tablet-script',[[x,y],[x+.045,y-.005]],.005,.203);
  }
  c.oval('fountain-religion-hand',-.02,2.286,.068,.046,.209,.034);
  c.line('fountain-religion-forearm',[[.38,1.78],[.39,1.55],[.23,1.52]],.05,.144);
  c.oval('fountain-religion-hand',.22,1.559,.071,.054,.216,.034);
}

function knowledge(c) {
  c.shape('fountain-knowledge-sleeve',[M(-.3,2.42),Q(-.45,2.16,-.44,1.83),
    Q(-.42,1.64,-.32,1.52),Q(-.27,1.65,-.27,1.93),L(-.25,2.19),L(-.3,2.42)],.102,.038);
  c.line('fountain-knowledge-torch-staff',[[-.33,1.98],[-.33,2.45],[-.33,2.81]],.024,.169);
  c.shape('fountain-knowledge-torch-bowl',[M(-.395,2.79),L(-.425,2.95),L(-.238,2.95),
    L(-.272,2.79),Q(-.327,2.75,-.395,2.79)],.146,.043);
  c.line('fountain-knowledge-torch-rim',[[-.425,2.917],[-.33,2.9],[-.24,2.917]],.018,.203);
  c.shape('fountain-knowledge-torch-flame',[M(-.414,2.957),Q(-.463,3.061,-.381,3.16),
    Q(-.365,3.05,-.339,3.08),Q(-.344,3.18,-.284,3.247),Q(-.301,3.12,-.262,3.074),
    Q(-.233,3.024,-.267,2.951),L(-.414,2.957)],.153,.039);
  c.oval('fountain-knowledge-hand',-.327,2.438,.064,.092,.207,.035);
  c.line('fountain-knowledge-forearm',[[.32,1.98],[.38,1.74],[.3,1.55]],.056,.125);
  c.shape('fountain-knowledge-scroll',[M(.3,1.55),L(.42,1.57),L(.5,1.16),Q(.4,1.12,.35,1.21),L(.3,1.55)],.143,.033);
  c.oval('fountain-knowledge-hand',.308,1.588,.059,.074,.191,.037);
}

function music(c) {
  c.shape('fountain-music-sleeve',[M(-.3,2.39),Q(-.48,2.17,-.42,1.93),
    Q(-.36,1.88,-.2,2.17),L(.08,2.27),L(.065,2.36),L(-.23,2.3),L(-.3,2.39)],.107,.039);
  c.line('fountain-music-forearm',[[.35,2.09],[.42,1.94],[.32,1.87]],.049,.141);
  // Lyre with an open bowl, outward curving horns, crossbar and seven strings.
  c.line('fountain-music-lyre',[[.18,2.858],[.14,2.55],[.12,2.3],[.17,2.13],
    [.3,2.08],[.46,2.18],[.48,2.38],[.435,2.68],[.45,2.858]],.034,.195);
  c.line('fountain-music-lyre-crossbar',[[.15,2.758],[.305,2.718],[.45,2.758]],.024,.2);
  for(let i=0;i<7;i++) {
    const x=.19+i*.036;
    c.line('fountain-music-lyre-string',[[x,2.73],[x,2.22]],.006,.185);
  }
  c.oval('fountain-music-hand',.105,2.301,.067,.046,.221,.034);
  c.oval('fountain-music-hand',.317,2.116,.074,.045,.233,.035);
}

export const ALLEGORIES = ['ART','RELIGION','KNOWLEDGE','MUSIC'];

export function buildAllegory(label, stone, tower, shaft, bottom) {
  const group = new THREE.Group();group.name='fountain-relief';group.userData.allegory=label;
  group.position.set(0,bottom+.035,tower/2);
  group.scale.set(tower/1.5,shaft/3.524,tower/1.5);
  const material=mat(new THREE.Color(stone).multiplyScalar(.975));
  const c=carving(group,material);
  Object.assign(c,{group,material,dark:mat(new THREE.Color(stone).multiplyScalar(.61))});
  robe(c,label);head(c,label);
  ({ART:art,RELIGION:religion,KNOWLEDGE:knowledge,MUSIC:music})[label](c);
  return group;
}

// Small Roman capitals rendered as solid strokes with restrained serifs.
// Inset-colored geometry is more durable than a canvas decal in baked scenes.
const LETTERS={
  A:[[[0,0],[.5,1],[1,0]],[[.22,.42],[.78,.42]]],
  R:[[[0,0],[0,1],[.69,1],[1,.86],[1,.63],[.68,.51],[0,.51]],[[.52,.51],[1,0]]],
  T:[[[0,1],[1,1]],[[.5,1],[.5,0]]],
  E:[[[1,1],[0,1],[0,0],[1,0]],[[0,.52],[.8,.52]]],
  L:[[[0,1],[0,0],[1,0]]],
  I:[[[.5,0],[.5,1]]],
  G:[[[1,.85],[.76,1],[.25,1],[0,.78],[0,.22],[.25,0],[.76,0],[1,.19],[1,.48],[.55,.48]]],
  O:[[[.25,0],[.75,0],[1,.22],[1,.78],[.75,1],[.25,1],[0,.78],[0,.22],[.25,0]]],
  N:[[[0,0],[0,1],[1,0],[1,1]]],
  K:[[[0,0],[0,1]],[[1,1],[0,.46],[1,0]]],
  W:[[[0,1],[.22,0],[.5,.65],[.78,0],[1,1]]],
  D:[[[0,0],[0,1],[.6,1],[1,.75],[1,.25],[.6,0],[0,0]]],
  M:[[[0,0],[0,1],[.5,.38],[1,1],[1,0]]],
  U:[[[0,1],[0,.2],[.24,0],[.76,0],[1,.2],[1,1]]],
  S:[[[1,.85],[.75,1],[.25,1],[0,.8],[0,.65],[1,.35],[1,.2],[.75,0],[.25,0],[0,.15]]],
  C:[[[1,.85],[.75,1],[.25,1],[0,.78],[0,.22],[.25,0],[.75,0],[1,.15]]],
};

export function buildInscription(label, width, height, color) {
  const geometries=[], letterW=height*.57, advance=letterW+height*.29;
  const total=(label.length-1)*advance+letterW, scale=Math.min(1,width/total);
  const stroke=height*.075;
  const segment=(a,b,x) => {
    const from=new THREE.Vector3((x+a[0]*letterW-total/2)*scale,(a[1]-.5)*height,0);
    const to=new THREE.Vector3((x+b[0]*letterW-total/2)*scale,(b[1]-.5)*height,0);
    const delta=to.clone().sub(from),geometry=new THREE.BoxGeometry(stroke*scale,delta.length()+stroke*.35,.005);
    geometry.applyMatrix4(new THREE.Matrix4().compose(from.add(to).multiplyScalar(.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()),new THREE.Vector3(1,1,1)));
    geometries.push(geometry);
  };
  [...label].forEach((letter,i)=>{
    for(const points of LETTERS[letter]) {
      for(let j=1;j<points.length;j++)segment(points[j-1],points[j],i*advance);
      for(const p of [points[0],points.at(-1)]) if(p[1]===0||p[1]===1) {
        segment([p[0]-.12,p[1]],[p[0]+.12,p[1]],i*advance);
      }
    }
  });
  const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(merged,mat(color));mesh.name='fountain-inscription';mesh.userData.text=label;
  return mesh;
}

export function buildPalmette(stone) {
  const group=new THREE.Group();group.name='fountain-palmette';
  const c=carving(group,mat(new THREE.Color(stone).multiplyScalar(.965)));
  for(let i=-2;i<=2;i++) {
    const x=i*.024;
    c.line('fountain-palmette-leaf',[[0,-.052],[x*.9,.005],[x,.062-Math.abs(i)*.01]],.007,0);
  }
  c.line('fountain-palmette-border',[[-.057,-.045],[-.068,.009],[0,.091],[.068,.009],[.057,-.045]],.006,0);
  return group;
}
