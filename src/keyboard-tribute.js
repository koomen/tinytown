import * as THREE from 'three';
import {box,mat} from './kit.js';

// A life-size keyboard and a small bouquet; local floor is the porch deck.
export function buildKeyboardTribute() {
  const root=new THREE.Group(); root.name='keyboard-with-flowers';
  const add=(mesh,name)=>{mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
  function rod(a,b,r,color,name) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),mat(color));
    mesh.position.copy(start.add(end).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    return add(mesh,name);
  }
  for(const z of [-.12,.12]) {
    rod([-.38,.035,z],[.32,.84,z],.025,'#363b3c','keyboard-x-stand');
    rod([.38,.035,z],[-.32,.84,z],.025,'#363b3c','keyboard-x-stand');
  }
  for(const x of [-.38,.38]) add(box(.10,.055,.42,'#343839',x,.028,0),'stand-foot');
  add(box(1.50,.12,.36,'#383d40',0,.9,0),'keyboard-body');
  // A0 through C8: 52 white keys and 36 black keys.
  const width=.025, left=-.65;
  for(let i=0;i<52;i++) add(box(width-.0015,.025,.205,'#efeee4',left+(i+.5)*width,.971,.055),'white-key');
  for(let i=0;i<51;i++) if([0,2,3,5,6].includes(i%7))
    add(box(.016,.038,.12,'#222829',left+(i+1)*width,.998,.012),'black-key');
  add(box(.13,.006,.055,'#627a76',.15,.964,-.125),'keyboard-display');
  for(let i=0;i<4;i++) add(box(.023,.01,.025,'#8b9290',-.32+i*.05,.966,-.125),'keyboard-control');
  root.add(buildRoseBouquet());
  return root;
}

// Each petal is a thin curved surface, opening from a cupped base into a
// softly rolled lip. The nested cups leave real shadowed gaps around the bud.
function rosePetal(radius, height, angle, spread, curl) {
  const vertices=[],indices=[],nu=16,nv=18;
  for(let j=0;j<=nv;j++) {
    const t=j/nv;
    for(let i=0;i<=nu;i++) {
      const u=i/nu*2-1;
      const fullness=Math.sin(t*Math.PI/2);
      const a=angle+u*spread*(.15+.85*fullness);
      const lip=Math.pow(t,6);
      const r=radius*(.20+.80*Math.sin(t*1.38))+curl*lip+.002*u*u*fullness;
      const roundedTop=.48+.52*Math.sqrt(Math.max(0,1-u*u));
      const y=height*t*roundedTop-curl*.45*lip;
      vertices.push(Math.cos(a)*r,y,Math.sin(a)*r);
      if(i<nu&&j<nv){const k=j*(nu+1)+i;indices.push(k,k+1,k+nu+1,k+1,k+nu+2,k+nu+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);g.computeVertexNormals();return g;
}

export function buildRoseBouquet() {
  const bouquet=new THREE.Group();bouquet.name='laid-rose-bouquet';
  // Keyboard front is +z: the blooms point toward -z, the cut ends toward +z.
  bouquet.rotation.y=Math.PI/10;
  const cutCenter=new THREE.Vector3(),headCenter=new THREE.Vector3(),stemCurves=[];
  const variation=n=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v)};
  const petals=['#f1e5d7','#f7eee2','#f4e5d8','#e9d3c3'].map(color=>new THREE.MeshPhysicalMaterial({
    color,roughness:.72,metalness:0,side:THREE.DoubleSide, sheen:.25,sheenColor:new THREE.Color('#fff3e7'),sheenRoughness:.8,
  }));
  const leafMat=new THREE.MeshStandardMaterial({color:'#36563e',roughness:.8,side:THREE.DoubleSide});
  const stemMat=mat('#58734a');
  function add(mesh,name,parent=bouquet){mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function stem(points,index) {
    const curve=new THREE.LineCurve3(points[0],points[points.length-1]);
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,1,.003,8,false),stemMat);
    mesh.userData.roseIndex=index;add(mesh,'cut-rose-stem');
    return curve;
  }
  function leaf(point,index) {
    const size=.044+variation(index+2)*.038,width=.19+variation(index+7)*.14;
    const positions=[],indices=[],segments=10;
    for(let j=0;j<=segments;j++) {
      const t=j/segments,w=Math.sin(Math.PI*t)*size*width;
      const curl=-Math.sin(Math.PI*t)*(.004+variation(index+12)*.006);
      positions.push(size*t,curl,-w,size*t,curl-.004,0,size*t,curl,w);
      if(j<segments){const k=j*3;indices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5)}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    const m=new THREE.Mesh(g,leafMat);m.position.copy(point);
    m.rotation.set((variation(index+17)-.5)*.28,(variation(index+23)>.5?1:-1)*(.6+variation(index+31)*1.7),(variation(index+39)-.5)*.18);
    add(m,'rose-leaf');
  }
  for(let i=0;i<12;i++) {
    const row=i%4,layer=Math.floor(i/4);
    // A slight, straight fan into a compact cluster. The rose heads overlap,
    // so their spacing never forces the stems into large bends or a wide fan.
    const end=new THREE.Vector3(-.46-(row%2)*.022-layer*.009,1.027+layer*.009,(row-1.5)*.010);
    // A compact sunflower spiral fills a round cross-section without rows.
    // The center blooms project a little farther for a gently domed bouquet.
    const angle=i*Math.PI*(3-Math.sqrt(5)),radius=.061*Math.sqrt((i+.5)/12);
    const head=new THREE.Vector3(.226+.018*(1-radius/.061)+.004*Math.sin(i*1.7),
      1.106+Math.sin(angle)*radius,.003+Math.cos(angle)*radius);
    cutCenter.add(end);headCenter.add(head);
    const axis=head.clone().sub(end).normalize();
    // The straight stem continues inside the calyx, sharing the bloom's axis.
    const curve=stem([end,head],i);
    stemCurves.push(curve);
    leaf(curve.getPoint(.43+variation(i+61)*.35),i*3);
    if(variation(i+78)>.48)leaf(curve.getPoint(.57+variation(i+94)*.25),i*3+1);
    const rose=new THREE.Group();rose.name='rose-bloom';rose.position.copy(head);
    rose.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
    rose.rotateY(i*2.399);
    rose.userData.roseIndex=i;rose.userData.stemAxis=axis.toArray();
    const scale=.92+(i%4)*.055;rose.scale.setScalar(scale);bouquet.add(rose);
    // Outer petals open gently; the central petals remain tightly furled.
    for(let ring=0;ring<4;ring++) {
      const count=[8,7,6,5][ring],radius=[.043,.032,.020,.008][ring];
      for(let j=0;j<count;j++) {
        const theta=j*Math.PI*2/count+ring*.73+i*.17;
        const m=new THREE.Mesh(rosePetal(radius,[.052,.064,.071,.074][ring],theta,[.80,.86,.94,1.20][ring],[.007,.004,.002,.0005][ring]),petals[ring]);
        m.position.y=ring*.002;add(m,'rose-petal',rose);
      }
    }
    const calyx=new THREE.Mesh(new THREE.ConeGeometry(.024,.033,7),stemMat);
    calyx.rotation.z=Math.PI;calyx.position.y=-.01;add(calyx,'rose-calyx',rose);
  }
  // One snug band sized directly around the gathered stems, without a bow.
  const crossSection=stemCurves.map(c=>c.getPoint((-.23-c.v1.x)/(c.v2.x-c.v1.x)));
  const rimPoints=[];
  for(const p of crossSection)for(let j=0;j<16;j++){
    const a=j*Math.PI/8;rimPoints.push([p.y+Math.cos(a)*.004,p.z+Math.sin(a)*.004]);
  }
  rimPoints.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=points=>{const h=[];for(const p of points){while(h.length>1&&turn(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p)}return h};
  const lower=half(rimPoints),upper=half([...rimPoints].reverse());
  const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];
  const outline=new THREE.CatmullRomCurve3(hull.map(([y,z])=>new THREE.Vector3(0,y,z)),true,'centripetal');
  const tie=new THREE.Mesh(new THREE.TubeGeometry(outline,80,.0015,8,true),mat('#d6c5ad'));
  tie.scale.x=3;tie.position.x=-.23;add(tie,'bouquet-ribbon');
  // Roll the complete arrangement around its actual stem centerline, keeping
  // every stem, leaf, bloom and ribbon attached to the same rigid bouquet.
  cutCenter.multiplyScalar(1/12);headCenter.multiplyScalar(1/12);
  const pivot=cutCenter.clone().add(headCenter).multiplyScalar(.5);
  const roll=new THREE.Group();roll.name='bouquet-long-axis-roll';roll.position.copy(pivot);
  const contents=new THREE.Group();contents.position.copy(pivot).negate();
  for(const part of [...bouquet.children])contents.add(part);
  roll.add(contents);
  roll.quaternion.setFromAxisAngle(headCenter.clone().sub(cutCenter).normalize(),Math.PI);
  const rest=new THREE.Group();rest.name='bouquet-resting-angle';rest.position.copy(pivot);
  roll.position.set(0,0,0);rest.add(roll);bouquet.add(rest);
  // Seat both the stem bundle and blooms on the actual key surfaces. The band
  // and lower stems can bridge the height difference between black/white keys.
  const keyHeight=(x,z)=>{
    let y=.96;
    if(x>=-.65&&x<=.65&&z>=-.0475&&z<=.1575)y=.9835;
    if(z>=-.048&&z<=.072)for(let i=0;i<51;i++)
      if([0,2,3,5,6].includes(i%7)&&Math.abs(x-(-.65+(i+1)*.025))<=.008)y=1.017;
    return y;
  };
  const point=new THREE.Vector3();
  function contacts(){
    bouquet.updateMatrixWorld(true);
    let cutGap=Infinity,headGap=Infinity,allGap=Infinity;
    bouquet.traverse(m=>{
      if(!m.isMesh)return;
      const p=m.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);
        const gap=point.y-keyHeight(point.x,point.z);allGap=Math.min(allGap,gap);
        if(m.name==='cut-rose-stem'||m.name==='bouquet-ribbon')cutGap=Math.min(cutGap,gap);
        if(m.name==='rose-petal'||m.name==='rose-calyx')headGap=Math.min(headGap,gap);
      }
      if(m.name==='cut-rose-stem'){
        point.copy(m.geometry.parameters.path.getPoint(0)).applyMatrix4(m.matrixWorld);
        cutGap=Math.min(cutGap,point.y-.003-keyHeight(point.x,point.z));
      }
    });
    return {cutGap,headGap,allGap};
  }
  for(let i=0;i<4;i++){
    const {cutGap,headGap}=contacts();
    rest.rotation.z+=(cutGap-headGap)/(headCenter.x-cutCenter.x);
  }
  bouquet.position.y=.001-contacts().allGap;
  return bouquet;
}
