// Andriaccio's current cream channel lettering and the garden patio beside it.
// Native CanvasTextures and geometry stay in the ordinary bake/stream path.
import * as THREE from 'three';
import {box,mat,buildBush} from './kit.js';
import {makeRng} from './rng.js';
import {surfaceMaterial} from './materials.js';
import {buildOrnamentalPaving} from './ornamental-paving.js';

export function andriacciosSignMaterial(brand, aspect = 6) {
  if (!['andriaccios','andriaccios-takeout','andriaccios-open'].includes(brand)) return null;
  const canvas=document.createElement('canvas');
  canvas.width=Math.min(4096,Math.max(512,Math.round(512*aspect)));canvas.height=512;
  const c=canvas.getContext('2d');c.scale(canvas.width/1200,canvas.height/260);
  c.textAlign='center';c.textBaseline='alphabetic';
  if (brand==='andriaccios') {
    // The reference uses large cream italic serif letters, with a sweeping A.
    c.font='italic 700 207px Georgia, "Times New Roman", serif';
    c.lineJoin='round';c.lineWidth=2.6;c.strokeStyle='#92978a';
    c.strokeText('Andriaccio’s',608,197,1120);c.fillStyle='#ecebd8';c.fillText('Andriaccio’s',606,195,1120);
    c.strokeStyle='#ecebd8';c.lineWidth=12;c.lineCap='round';
    c.beginPath();c.moveTo(143,165);c.bezierCurveTo(91,200,41,219,37,190);c.bezierCurveTo(34,174,47,164,62,167);c.stroke();
  } else if (brand==='andriaccios-takeout') {
    c.fillStyle='#e8e0c9';c.fillRect(0,0,1200,260);
    c.fillStyle='#9b322d';c.font='italic 700 104px Georgia, serif';c.fillText('Andriaccio’s Restaurant',600,114,1138);
    c.fillStyle='#262c2a';c.font='900 98px Arial, sans-serif';c.fillText('• TAKE OUT •',600,231,920);
  } else {
    c.fillStyle='#23372f';c.beginPath();c.ellipse(600,130,583,123,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#61a6ad';c.lineWidth=10;c.beginPath();c.ellipse(600,130,560,105,0,0,Math.PI*2);c.stroke();
    c.strokeStyle='#bc5e67';c.lineWidth=8;c.font='italic 700 190px Arial, sans-serif';c.strokeText('OPEN',600,197,850);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.name=brand;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:.75,alphaTest:.45,side:THREE.DoubleSide});
  material.name=brand+'-native-lettering';material.userData.landmarkBrand=brand;
  return material;
}

export function buildAndriacciosGround(feature,grade=()=>0,grid=null) {
  const root=new THREE.Group();root.name='andriaccios-patio-and-forecourt';
  const [x,z]=feature.pts[0],a=feature.angle||0,c=Math.cos(a),s=Math.sin(a),rng=makeRng('andriaccios-patio');
  const world=(u,v)=>[x+c*u+s*v,z-s*u+c*v];
  const height=(u,v)=>grade(...world(u,v));
  const surface=(id,points,color,kind='paving-stone',lift=.13)=>{
    const g=buildOrnamentalPaving({id,closed:true,pts:points.map(p=>world(...p)),surface:kind,color,lift},grade,grid);
    g.traverse(m=>{if(m.isMesh)m.userData.andriacciosGroundLift=lift;});root.add(g);
  };
  const part=(mesh,u,v,y)=>{const p=world(u,v);mesh.position.set(p[0],y,p[1]);mesh.rotation.y=a;root.add(mesh);return mesh;};
  const beam=(p,q,y,h,w,color,name)=>{
    const p1=world(...p),p2=world(...q),m=box(Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),h,w,color,(p1[0]+p2[0])/2,y,(p1[1]+p2[1])/2);
    m.rotation.y=-Math.atan2(p2[1]-p1[1],p2[0]-p1[0]);m.name=name;root.add(m);return m;
  };
  // Match the small wedge-shaped lot between Route 394 and the side road.
  const apron=[[0.1671,-28.8051],[2.767,-26.6095],[25.9708,4.6728],[29.8,10.7833],[23.37,17.7585],[-25.2345,11.2312],[-25.7383,4.6458],[-20.2074,-9.2769],[-0.5123,-28.407]];
  // Fill the forecourt up to its curb, retaining a narrow setback from the
  // mapped public road. Stall ends must fit the taper of this triangular lot.
  const apronCenter=apron.reduce((p,q)=>[p[0]+q[0]/apron.length,p[1]+q[1]/apron.length],[0,0]);
  const pavedApron=apron.map(([u,v])=>{const dx=u-apronCenter[0],dz=v-apronCenter[1],L=Math.hypot(dx,dz);return[u+.5*dx/L,v+.5*dz/L];});
  surface('andriaccios-asphalt',pavedApron,'#66665c','gravel',.075);
  surface('andriaccios-garden-patio',[[-16.3,7.8],[17.4,7.8],[17.4,-5.4],[23,-5.4],[23,12.6],[-16.3,12.6]],'#b49a7c','paving-stone',.15);
  // The parking marks follow the front wall and leave a clear travel aisle.
  for (const u of [-10.9,-8.2,-5.5,-2.8,-.1,2.6,5.3,8,10.7]) {
    const p=world(u,-16.1),q=world(u,-11.4);
    const line=buildOrnamentalPaving({id:'andriaccios-parking-line',pts:[p,q],width:.095,surface:'paving-stone',color:'#d0cdbb',lift:.091},grade,grid);
    line.traverse(m=>{if(m.isMesh)m.userData.andriacciosGroundLift=.091;});root.add(line);
  }
  for (const u of [-9.55,-6.85,-4.15,-1.45,1.25,3.95,6.65,9.35]) {
    const v=-10.7,m=box(1.6,.14,.25,'#bfc0ac');m.name='andriaccios-wheel-stop';part(m,u,v,height(u,v)+.12);
  }
  // A low stone planter and clipped shrubs occupy the road-point island.
  const iu=2.5301,iv=-28.0321;
  surface('andriaccios-roadside-island',[[iu-3.1,iv-1.7],[iu+3,iv-1.7],[iu+3.5,iv+1.5],[iu-3.4,iv+1.5]],'#6f8155','terrain',.115);
  for (const [p,q] of [[[iu-3.1,iv+1.55],[iu+3.1,iv+1.55]],[[iu-3.1,iv-1.55],[iu+3.1,iv-1.55]]]) {
    const bottom=Math.min(height(...p),height(...q))-.14,top=Math.max(height(...p),height(...q))+.55,m=beam(p,q,(top+bottom)/2,top-bottom,.3,'#b5aa8e','andriaccios-island-wall');m.material=surfaceMaterial('stone','#b5aa8e');
  }
  for(const u of [-2.4,-1.2,0,1.2,2.4]) {
    const shrub=buildBush(rng);shrub.scale.set(.65,1.3,.65);part(shrub,iu+u,iv,height(iu+u,iv)+.13);
  }
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.032,.052,8.7,8),mat('#bfc2ae'));
  pole.name='andriaccios-bare-flagpole';part(pole,iu+1.4,iv,height(iu+1.4,iv)+4.30);
  // Timber pergola flanks the restaurant's eastern take-out wing. Six open
  // bays and spaced rafters keep the garden entrance visible from the road.
  const floor=Math.max(...[[-4.6,17.6],[-4.6,22.6],[11.9,17.6],[11.9,22.6]].map(([v,u])=>height(u,v)))+.15;
  for (const u of [17.7,22.6]) for(const v of [-4.5,1,6.5,12]) {
    const y0=height(u,v)-.16,top=floor+2.8,p=box(.20,top-y0,.20,'#4e4639');p.name='andriaccios-pergola-post';part(p,u,v,(top+y0)/2);
  }
  for (const u of [17.7,22.6]) beam([u,-4.85],[u,12.35],floor+2.7,.24,.19,'#4e4639','andriaccios-pergola-beam');
  for(let v=-4.85;v<12.6;v+=.65)beam([17.35,v],[22.95,v],floor+2.91,.16,.085,'#645642','andriaccios-pergola-rafter');
  const open=new THREE.Mesh(new THREE.PlaneGeometry(1.18,.53),andriacciosSignMaterial('andriaccios-open',2.2));
  part(open,20.15,-4.88,floor+2.52);open.rotation.y=a+Math.PI;open.name='andriaccios-patio-open-sign';
  // Screen fence, with a wide entry at the front of the pergola.
  const fence=(p,q)=>{
    const length=Math.hypot(q[0]-p[0],q[1]-p[1]),n=Math.ceil(length/.24);
    for(let i=0;i<=n;i++){
      const t=i/n,u=p[0]+(q[0]-p[0])*t,v=p[1]+(q[1]-p[1])*t,bottom=height(u,v)+.07;
      const board=box(.20,1.45,.05,'#a99c75');part(board,u,v,bottom+.725);board.rotation.y=a-Math.atan2(q[1]-p[1],q[0]-p[0]);
    }
  };
  fence([-16.3,12.6],[23,12.6]);fence([23,-1],[23,12.6]);
  // Four compact cafe tables and chairs; their feet follow the patio grade.
  for(const [u,v] of [[20,0],[20,5.2],[20,10],[-8.5,10]]) {
    const y=height(u,v)+.15;
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.56,.56,.07,16),mat('#3d4540'));part(top,u,v,y+.76);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,.72,7),mat('#3d4540'));part(leg,u,v,y+.36);
    for(const sign of [-1,1]) {
      const cv=v+sign*.86,cy=height(u,cv)+.15;
      part(box(.46,.055,.45,'#49524a'),u,cv,cy+.43);
      part(box(.46,.42,.055,'#49524a'),u,cv+sign*.22,cy+.66);
      for(const dx of [-.18,.18])for(const dz of [-.17,.17])part(box(.034,.41,.034,'#303c34'),u+dx,cv+dz,cy+.205);
    }
  }
  for(const [u,v] of [[18,-5.3],[22.2,-5.3],[22.1,3],[22.1,8],[-12,11.5],[-3,11.5]]) {
    const y=height(u,v)+.15,pot=new THREE.Mesh(new THREE.CylinderGeometry(.33,.24,.45,10),mat('#967657'));part(pot,u,v,y+.225);
    const bush=buildBush(rng);bush.scale.set(.42,.58,.42);part(bush,u,v,y+.43);
  }
  // A red fabric shade triangle recalls the sheltered rear garden in the
  // official patio photo; keep its corners above the pergola walkway.
  const sailPoints=[[11.5,8.5,3.15],[16.8,12,3.45],[4.5,12,3.0]].map(([u,v,y])=>{const p=world(u,v);return[p[0],height(u,v)+y,p[1]];});
  for(const point of sailPoints) {
    const ground=grade(point[0],point[2])-.12;
    const post=box(.075,point[1]-ground,.075,'#76674f',point[0],(point[1]+ground)/2,point[2]);
    post.name='andriaccios-shade-support';root.add(post);
  }
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sailPoints.flat(),3));sg.computeVertexNormals();
  const sail=new THREE.Mesh(sg,new THREE.MeshStandardMaterial({color:'#af5140',roughness:.95,side:THREE.DoubleSide}));sail.name='andriaccios-patio-shade-sail';root.add(sail);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return root;
}
