// Brown steel / green rail / tan molded-slide play equipment, reconstructed
// from the Avon Elementary Street View photographs supplied by the user.
import * as THREE from 'three';
import {box,mat} from './kit.js';

const C={post:0x634934,rail:0x294a3b,deck:0x384b40,slide:0xbba582,roof:0x536a60};
const up=new THREE.Vector3(0,1,0);
function bar(root,a,b,r,color=C.rail,name='school-playground-bar') {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat(color));
  m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(up,d.normalize());
  m.name=name;root.add(m);return m;
}
function tube(root,points,r,color=C.rail,name='school-playground-curved-rail') {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*4),r,7,false),mat(color));
  m.name=name;root.add(m);return m;
}
function post(root,ground,x,z,top,r=.085,color=C.post) {
  const bottom=ground(x,z)-.025,m=bar(root,[x,bottom,z],[x,top,z],r,color,'playground-support');
  m.userData.foot=[x,bottom,z];return m;
}
function guard(root,a,b,y) {
  for(const h of [.12,.93])bar(root,[a[0],y+h,a[1]],[b[0],y+h,b[1]],.035);
  const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.17);
  for(let i=0;i<=n;i++) {
    const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    bar(root,[x,y+.12,z],[x,y+.93,z],.022);
  }
}
function platform(root,ground,{x,z,height,width=1.65,depth=1.65,open=[],postHeight=height+1.1}) {
  const deck=box(width,.12,depth,C.deck,x,height-.06,z);deck.name='school-playground-platform';root.add(deck);
  for(const u of [-1,1])for(const v of [-1,1])post(root,ground,x+u*width/2,z+v*depth/2,postHeight);
  for(const side of [-1,1]) {
    if(!open.includes(side<0?'front':'back'))guard(root,[x-width/2,z+side*depth/2],[x+width/2,z+side*depth/2],height);
    if(!open.includes(side<0?'left':'right'))guard(root,[x+side*width/2,z-depth/2],[x+side*width/2,z+depth/2],height);
  }
}

// Sweep a rounded, open U-shaped chute along a continuous centreline. A curved
// slide stays open on top, and the two straight chutes share the same profile.
function moldedSlide(root,points,width,name) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
  const rows=44,cols=12,positions=[],indices=[],lips=[[],[]];
  for(let i=0;i<=rows;i++) {
    const t=i/rows,p=curve.getPoint(t),tangent=curve.getTangent(t);
    const across=new THREE.Vector3(tangent.z,0,-tangent.x).normalize();
    const wall=.30*(1-.58*Math.pow(t,6));
    for(let j=0;j<=cols;j++) {
      const a=(j/cols-.5)*Math.PI,u=Math.sin(a)*width/2,y=(1-Math.cos(a))*wall;
      const q=p.clone().addScaledVector(across,u);q.y+=y;positions.push(q.x,q.y,q.z);
      if(j===0)lips[0].push(q);if(j===cols)lips[1].push(q);
      if(i<rows&&j<cols){const k=i*(cols+1)+j;indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setIndex(indices);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat(C.slide,{side:THREE.DoubleSide,roughness:.72}));m.name=name;root.add(m);
  for(const lip of lips)tube(root,lip.filter((_,i)=>i%4===0||i===rows).map(p=>p.toArray()),.045,C.slide,'school-slide-lip');
}
function steps(root,ground,{x,z,height,length=2.3,width=.95}) {
  const end=z-length,bottom=ground(x,end)+.08,n=Math.ceil((height-bottom)/.19);
  for(let i=0;i<n;i++) {
    const t=(i+.5)/n,y=height+(bottom-height)*i/n;
    const tread=box(width,.09,length/n+.025,C.deck,x,y-.045,z-length*t);tread.name='school-playground-step';root.add(tread);
  }
  for(const side of [-1,1]) {
    const u=x+side*width/2;
    bar(root,[u,height-.12,z],[u,bottom-.05,end],.06);
    tube(root,[[u,height+.88,z+.1],[u,height+.88,z-.1],[u,bottom+.85,end],[u,bottom+.6,end-.1]],.035);
    post(root,ground,u,end,bottom+.85,.035,C.rail);
  }
}

export function buildSchoolPlayset(ground) {
  const root=new THREE.Group();root.name='school-playset';
  platform(root,ground,{x:0,z:0,height:2.05,open:['left','right','front','back'],postHeight:3.93});
  guard(root,[-.825,-.825],[-.45,-.825],2.05);guard(root,[.45,-.825],[.825,-.825],2.05);
  platform(root,ground,{x:1.85,z:0,height:2.05,open:['left','right']});
  root.add(box(.22,.12,1.65,C.deck,.925,1.99,0));
  for(const z of [-.825,.825])guard(root,[.825,z],[1.025,z],2.05);
  platform(root,ground,{x:-2.5,z:0,height:1.12,width:1.5,depth:1.65,open:['front','right','left']});
  // Four small risers connect the lower activity platform to the main deck.
  for(let i=0;i<5;i++)root.add(box(.2,.11,1.1,C.deck,-1.66+i*.185,1.23+i*.18,0));
  for(const z of [-.58,.58])bar(root,[-1.75,2.02,z],[-.825,2.96,z],.035);
  steps(root,ground,{x:-2.5,z:-.825,height:1.12});

  // One green pyramidal canopy, with the distinctive brown posts curling out
  // above its eaves. The other platforms are uncovered in the reference.
  const eave=3.72,rise=.78,r=1.06;
  const canopy=new THREE.Mesh(new THREE.ConeGeometry(r*Math.SQRT2,rise,4),mat(C.roof));
  canopy.rotation.y=Math.PI/4;canopy.position.y=eave+rise/2;canopy.name='school-playground-canopy';root.add(canopy);
  for(const sx of [-1,1])for(const sz of [-1,1]) {
    const x=sx*.825,z=sz*.825;
    tube(root,[[x,3.8,z],[x,4.03,z],[x+sx*.12,4.2,z+sz*.1],[x+sx*.3,4.3,z+sz*.19]],.087,C.post);
    bar(root,[sx*r,eave,sz*r],[0,eave+rise,0],.028,0x677c71,'school-canopy-seam');
  }

  // Curved front slide with a high molded entry hood and a gentle sideways bend.
  const finish=ground(-.8,4.75)+.18;
  moldedSlide(root,[[0,2.05,.825],[0,2.05,1.1],[-.35,1.82,1.65],[-.85,1.24,2.35],
    [-1.12,.6+finish*.4,3.3],[-1.05,finish+.12,4.15],[-.8,finish,4.75]],.92,'school-curved-slide');
  const entry=new THREE.Shape();entry.moveTo(-.53,0);entry.lineTo(-.53,.48);
  entry.quadraticCurveTo(-.53,.7,-.28,.7);entry.lineTo(.28,.7);entry.quadraticCurveTo(.53,.7,.53,.48);
  entry.lineTo(.53,0);entry.lineTo(.38,0);entry.lineTo(.38,.44);entry.quadraticCurveTo(.38,.54,.25,.54);
  entry.lineTo(-.25,.54);entry.quadraticCurveTo(-.38,.54,-.38,.44);entry.lineTo(-.38,0);entry.closePath();
  const hood=new THREE.Mesh(new THREE.ExtrudeGeometry(entry,{depth:.43,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,curveSegments:6}),mat(C.slide));
  hood.position.set(0,2.04,.85);hood.name='school-slide-hood';root.add(hood);

  // Adjacent tan wave slides point toward the school, with a common landing.
  for(const z of [-.43,.43]) {
    const end=ground(7.6,z)+.19;
    moldedSlide(root,[[2.675,2.05,z],[3.0,2.03,z],[3.8,1.70,z],[4.75,1.22,z],
      [5.45,.92,z],[6.3,end+.22,z],[7.0,end+.04,z],[7.6,end,z]],.88,'school-double-slide');
  }
  for(const z of [-.82,.82])post(root,ground,4.25,z,1.35,.055);
  for(const z of [-.8,.8])tube(root,[[2.5,2.05,z],[2.5,2.72,z],[2.85,2.74,z],[3.1,2.3,z]],.035);

  // Wavy overhead bars, vertical climbing ladder and a low activity panel.
  for(const z of [-.5,.5]) {
    post(root,ground,-5.55,z,2.45);
    const points=Array.from({length:13},(_,i)=>[-5.55+2.3*i/12,2.18+.12*Math.sin(i*Math.PI/6),z]);
    tube(root,points,.042);
  }
  for(let i=0;i<=8;i++) {
    const x=-5.55+2.3*i/8,y=2.18+.12*Math.sin(i*Math.PI/4);
    bar(root,[x,y,-.5],[x,y,.5],.028,C.rail,'school-monkey-bar');
  }
  for(let i=1;i<=5;i++)bar(root,[-5.55,ground(-5.55,-.5)+i*.34,-.5],[-5.55,ground(-5.55,.5)+i*.34,.5],.03);
  for(const x of [-.45,.45])bar(root,[x,ground(x,-.92),-.92],[x,2.05,-.92],.032);
  for(let i=1;i<=6;i++)bar(root,[-.45,i*.29,-.92],[.45,i*.29,-.92],.028);
  const panel=box(.09,.7,1.05,C.slide,1.02,.62,0);panel.name='school-activity-panel';
  // The tan panel is underneath the deck; keep the double-slide entry open.
  root.add(panel);
  return root;
}

export function buildSchoolSwings(ground) {
  const root=new THREE.Group();root.name='school-swing-row';
  const count=4,bay=1.75,spring=2.35,rise=.55,half=count*bay/2;
  for(let i=0;i<=count;i++)post(root,ground,-half+i*bay,0,spring,.065);
  for(let i=0;i<count;i++) {
    const x=-half+(i+.5)*bay;
    const arch=Array.from({length:13},(_,j)=>{
      const a=Math.PI-j*Math.PI/12;return [x+Math.cos(a)*bay/2,spring+Math.sin(a)*rise,0];
    });
    tube(root,arch,.065,C.post,'school-swing-arch');
    const y=ground(x,0)+.53;
    for(const side of [-1,1]) {
      const u=x+side*.27,top=spring+rise*Math.sqrt(1-(.27/(bay/2))**2);
      bar(root,[u,y+.07,0],[u,top-.06,0],.013,0xaaa99b,'school-swing-chain');
      const hanger=new THREE.Mesh(new THREE.TorusGeometry(.045,.012,5,10),mat(0xaaa99b));
      hanger.position.set(u,top-.06,0);root.add(hanger);
    }
    // A shallow sag across a rubber belt seat, with enough thickness to read
    // from either side after the miniature is baked.
    const belt=new THREE.Shape();belt.moveTo(-.29,.07);belt.quadraticCurveTo(0,-.04,.29,.07);
    belt.lineTo(.29,.03);belt.quadraticCurveTo(0,-.08,-.29,.03);belt.closePath();
    const seat=new THREE.Mesh(new THREE.ExtrudeGeometry(belt,{depth:.27,bevelEnabled:false,curveSegments:8}),mat(0x29382f));
    seat.position.set(x,y,-.135);seat.name='school-swing-seat';root.add(seat);
  }
  return root;
}

export function buildRoundPicnicTable(ground) {
  const root=new THREE.Group();root.name='school-round-picnic-table';
  post(root,ground,0,0,.78,.09,C.rail);
  const disk=(r,height,y,name)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,height,24),mat(C.rail));m.position.y=y;m.name=name;root.add(m);};
  disk(.65,.07,.78,'picnic-table-top');
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2,x=Math.cos(a),z=Math.sin(a);
    bar(root,[0,.3,0],[x*.95,.3,z*.95],.045);
    post(root,ground,x*.95,z*.95,.45,.035,C.rail);
    const seat=box(.72,.065,.33,C.rail,x*.98,.47,z*.98);seat.rotation.y=Math.PI/2-a;seat.name='picnic-table-seat';root.add(seat);
  }
  return root;
}
