// Raised, irregular limestone faces and radial arch stones on both elevations.
// The solid arched core carries the structure; these shallow facets give the
// historic masonry a readable relief even at the diorama's viewing distance.
import * as THREE from 'three';
import {box} from './kit.js';
import {surfaceMaterial} from './materials.js';

export function bridgeStonework(length,width,height,count,pier,rise,deck,wall,trim) {
  const group=new THREE.Group();group.name='bridge-stonework';
  const opening=(length-(count+1)*pier)/count,radius=opening/2,spring=height-deck-rise;
  const centers=Array.from({length:count},(_,i)=>-length/2+pier+radius+i*(opening+pier));
  const positions=[],colors=[],base=new THREE.Color(wall);
  let seed=731;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const face=(ring,side,shade)=>{
    const x=ring.reduce((a,p)=>a+p[0],0)/ring.length,y=ring.reduce((a,p)=>a+p[1],0)/ring.length;
    const z=side*(width/2+.035),peak=z+side*(.06+random()*.065);
    const color=base.clone().multiplyScalar(shade);
    for(let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length];
      const tri=side>0?[[x,y,peak],[...a,z],[...b,z]]:[[x,y,peak],[...b,z],[...a,z]];
      for(const p of tri) {positions.push(...p);colors.push(color.r,color.g,color.b);}
    }
  };
  for(const side of [-1,1]) {
    for(let y=0,row=0;y<height-.65;y+=.46,row++) {
      const top=Math.min(y+.42,height-.65),cutY=Math.max(0,y-.08-spring);
      const half=y<spring+rise+.5 ? (y<spring?radius+.50:Math.sqrt(Math.max(0,1-(cutY/(rise+.5))**2))*(radius+.5)) : 0;
      const gaps=half>0?centers.map(x=>[x-half,x+half]):[];
      let start=-length/2;
      const ranges=[];
      for(const [a,b] of gaps) {if(a>start)ranges.push([start,Math.min(a,length/2)]);start=Math.max(start,b);}
      if(start<length/2)ranges.push([start,length/2]);
      for(const [left,right] of ranges) {
        let x=left;
        while(x<right-.10) {
          const end=Math.min(right,x+.8+random()*.65),ch=.045+random()*.04;
          if(end-x>.14)face([[x+.025+ch,y+.015],[end-.025-ch,y+.015],[end-.025,y+.015+ch],
            [end-.025,top-ch],[end-.025-ch,top],[x+.025+ch,top],[x+.025,top-ch],[x+.025,y+.015+ch]],side,.84+random()*.30);
          x=end;
        }
      }
    }
    for(const center of centers) {
      for(const edge of [-1,1]) for(let y=0;y<spring;y+=.46) {
        const x=center+edge*radius,top=Math.min(spring,y+.42);
        const left=Math.min(x,x+edge*.5),right=Math.max(x,x+edge*.5);
        face([[left+.02,y+.015],[right-.02,y+.015],[right-.02,top],[left+.02,top]],side,.92+random()*.2);
      }
      // Each voussoir is one wedge with its long joints radial to the arch.
      for(let i=0;i<19;i++) {
        const a=i*Math.PI/19+.006,b=(i+1)*Math.PI/19-.006;
        face([[center+radius*Math.cos(a),spring+rise*Math.sin(a)],
          [center+(radius+.5)*Math.cos(a),spring+(rise+.5)*Math.sin(a)],
          [center+(radius+.5)*Math.cos(b),spring+(rise+.5)*Math.sin(b)],
          [center+radius*Math.cos(b),spring+rise*Math.sin(b)]],side,.93+random()*.20);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const masonry=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  masonry.name='bridge-limestone-faces';masonry.castShadow=masonry.receiveShadow=true;group.add(masonry);
  for(const [y,h,out] of [[height-.53,.24,.12],[height-.28,.22,.24],[height-.04,.18,.32]]) {
    const cap=box(length+out,h,width+out*2,trim,0,y,0);
    cap.material=surfaceMaterial('stone',trim);cap.name='bridge-stone-coping';group.add(cap);
  }
  // Low, battered footings widen the piers without closing the arches.
  for(let i=0;i<=count;i++) {
    const x=-length/2+pier/2+i*(opening+pier);
    const shape=new THREE.Shape([new THREE.Vector2(-pier/2-.32,-.8),new THREE.Vector2(pier/2+.32,-.8),
      new THREE.Vector2(pier/2+.12,1.05),new THREE.Vector2(-pier/2-.12,1.05)]);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:width+.6,bevelEnabled:false});geo.translate(x,0,-width/2-.3);
    const foot=new THREE.Mesh(geo,surfaceMaterial('stone',wall));foot.name='bridge-pier-footing';foot.castShadow=foot.receiveShadow=true;group.add(foot);
  }
  return group;
}
