// Four individual stalk silhouettes, shared by all the upright billboards.
import * as THREE from 'three';

const noise = n => (Math.sin(n * 127.1 + 311.7) * 43758.5453 % 1 + 1) % 1;
let material;

function atlas() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const c=canvas.getContext('2d');
  for(let variant=0;variant<4;variant++) {
    c.save();c.translate(variant*128,0);c.beginPath();c.rect(0,0,128,256);c.clip();
    const stem=64,top=22;
    const stalk=c.createLinearGradient(61,0,67,0);
    stalk.addColorStop(0,'#436928');stalk.addColorStop(.6,'#8ca04d');stalk.addColorStop(1,'#5c8034');
    c.strokeStyle=stalk;c.lineWidth=3;
    c.beginPath();c.moveTo(stem,254);c.quadraticCurveTo(stem-3,133,stem,top+20);c.stroke();
    for(let j=0;j<11;j++) {
      const seed=variant*47+j,side=j%2?1:-1;
      const y=223-j*16+(noise(seed)-.5)*10;
      const length=30+Math.sin(j/11*Math.PI)*24+(noise(seed+8)-.5)*8;
      const tipY=y+(j<5?15:0)+(noise(seed+17)-.5)*13;
      const arch=y-16-noise(seed+23)*13,tipX=stem+side*length;
      const shade=c.createLinearGradient(0,arch,0,tipY+4);
      shade.addColorStop(0,'#91a653');shade.addColorStop(.38,variant%2?'#719442':'#7b9947');shade.addColorStop(1,'#3f682d');
      c.fillStyle=shade;c.beginPath();c.moveTo(stem,y);
      c.bezierCurveTo(stem+side*length*.3,arch-8,tipX-side*6,arch,tipX,tipY);
      c.bezierCurveTo(tipX-side*10,arch+12,stem+side*length*.4,y+4,stem,y);c.fill();
      c.strokeStyle='#9cab5a';c.lineWidth=.65;c.beginPath();c.moveTo(stem,y);
      c.bezierCurveTo(stem+side*length*.35,arch+3,tipX-side*7,arch+4,tipX,tipY);c.stroke();
    }
    // Slender branched tassel; the whole card contains exactly one stalk.
    c.strokeStyle='#c6b578';c.lineWidth=1.3;c.beginPath();c.moveTo(stem,top+31);c.lineTo(stem,top-11);
    for(let j=0;j<6;j++)for(const side of [-1,1]) {
      const x=stem+side*(14-j*1.6),y=top+17-j*4;
      c.moveTo(stem,y+9);c.quadraticCurveTo(x,y+4,x,y-5);
    }
    c.stroke();c.restore();
  }
  const pixels=c.getImageData(0,0,512,256);
  for(let i=0;i<pixels.data.length;i+=4) {
    for(let k=0;k<3;k++)pixels.data[i+k]=Math.round(pixels.data[i+k]/12)*12;
    pixels.data[i+3]=Math.round(pixels.data[i+3]/32)*32;
  }
  c.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.name='individual-corn-stalks';
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}

// Reinstalled after ObjectLoader, which deliberately does not serialize code.
export function restoreCornSpriteMaterial(m) {
  m.userData.cornSprite=true;
  m.alphaTest=.2;
  // Filter premultiplied leaf colors, then divide out coverage in the shader.
  // Otherwise black transparent texels darken the distant field's mipmaps.
  if(m.map && !m.map.premultiplyAlpha) {m.map.premultiplyAlpha=true;m.map.needsUpdate=true;}
  m.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
        attribute vec4 cornPlant;
        varying float vCornTone;
        float cornRandom(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }`)
      .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        objectNormal=vec3(0.0,1.0,0.0);`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 center=cornPlant.xyz*.01;
        float height=cornPlant.w*.01;
        vec3 right=normalize(vec3(viewMatrix[0][0],0.0,viewMatrix[2][0])+vec3(0.000001,0.0,0.0));
        // Convert the camera's horizontal right vector into the field's frame.
        right=vec3(dot(right,modelMatrix[0].xyz),0.0,dot(right,modelMatrix[2].xyz));
        transformed=center+right*position.x*height*.43+vec3(0.0,position.y*height,0.0);
        float seed=cornRandom(center.xz);
        vCornTone=.88+cornRandom(center.zx+17.0)*.18;
        #ifdef USE_MAP
          float u=seed>.5?1.0-vMapUv.x:vMapUv.x;
          vMapUv.x=(u*.98+.01+floor(seed*4.0))*.25;
        #endif`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying float vCornTone;')
      .replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb/=max(diffuseColor.a,.001);')
      .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=vCornTone;');
  };
  m.customProgramCacheKey=()=> 'individual-upright-corn-v2';
  return m;
}

export function cornSpriteMaterial() {
  if(!material)material=restoreCornSpriteMaterial(new THREE.MeshStandardMaterial({
    map:atlas(),roughness:1,side:THREE.DoubleSide,alphaTest:.2,transparent:false,depthWrite:true,
  }));
  return material;
}

export function cornSpriteGeometry(plants) {
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,.5,1,0,-.5,1,0],3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0,0,1,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
  geometry.setIndex([0,1,2,0,2,3]);
  geometry.setAttribute('cornPlant',new THREE.InstancedBufferAttribute(plants,4));
  geometry.instanceCount=plants.length/4;
  // Shader-positioned cards need real field bounds for frustum/stream culling.
  const box=new THREE.Box3(),p=new THREE.Vector3();
  for(let i=0;i<plants.length;i+=4) {
    const x=plants[i]*.01,y=plants[i+1]*.01,z=plants[i+2]*.01,h=plants[i+3]*.01,r=h*.43/2;
    box.expandByPoint(p.set(x-r,y,z-r));box.expandByPoint(p.set(x+r,y+h,z+r));
  }
  geometry.boundingBox=box;geometry.boundingSphere=box.getBoundingSphere(new THREE.Sphere());
  return geometry;
}
