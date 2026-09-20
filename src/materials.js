// Small shared procedural materials. No downloaded textures or extra render
// passes; the baker retains their surface identity and batches their colours.
import * as THREE from 'three';
import { NIGHT } from './lighting.js';

const cache = new Map();
export const usesPaneUV = kind => kind === 'glass' || kind === 'shop';
export const usesSurfaceUV = kind => usesPaneUV(kind) || kind === 'plowed';

export function surfaceMaterial(kind, color = 0xffffff, vertexColors = false, { nightWindows = 'varied' } = {}) {
  const allOn = usesPaneUV(kind) && nightWindows === 'all';
  const key = `${kind}|${color}|${vertexColors}|${allOn}`;
  if (cache.has(key)) return cache.get(key);
  const glass = usesPaneUV(kind);
  const m = new THREE.MeshStandardMaterial({color, vertexColors,
    roughness: kind === 'water' ? .38 : glass ? 0.38 : 0.92, metalness: glass ? 0.08 : 0,
    emissive: glass ? 0xd7b783 : 0, emissiveIntensity: glass ? 0.035 : 0});
  m.userData.surface = kind;
  if (allOn) m.userData.nightWindows = 'all';
  m.onBeforeCompile = shader => {
    shader.uniforms.nightAmount = NIGHT;
    const varyings = `varying vec3 vSurfacePos; varying vec3 vSurfaceNormal; ${glass ? 'varying vec2 vPaneUv;' : ''} ${kind === 'plowed' ? 'varying vec2 vFieldUv;' : ''}`;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${varyings}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 surfacePosition = vec4(transformed, 1.0);
        vec3 surfaceNormal = normal;
        #ifdef USE_INSTANCING
          surfacePosition = instanceMatrix * surfacePosition;
          mat3 im = mat3(instanceMatrix);
          surfaceNormal /= vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]));
          surfaceNormal = im * surfaceNormal;
        #endif
        vSurfacePos = (modelMatrix * surfacePosition).xyz;
        mat3 mm = mat3(modelMatrix);
        surfaceNormal /= vec3(dot(mm[0],mm[0]),dot(mm[1],mm[1]),dot(mm[2],mm[2]));
        vSurfaceNormal = normalize(mm * surfaceNormal);
        ${kind === 'plowed' ? 'vFieldUv = uv;' : ''}
        ${glass ? `vPaneUv = uv;
          if (uv.x < 2.0) {
            float id = 1.0 + floor(fract(sin(dot(modelMatrix[3].xyz,vec3(12.9898,37.719,78.233)))*43758.5453)*4096.0);
            vPaneUv.x += id*2.0;
          }` : ''}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      ${varyings}
      uniform float nightAmount;
      float surfaceHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float landNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(surfaceHash(i),surfaceHash(i+vec2(1,0)),f.x),
                   mix(surfaceHash(i+vec2(0,1)),surfaceHash(i+vec2(1,1)),f.x),f.y);
      }
      float course(vec2 p, vec2 size, float joint) {
        vec2 cell = p / size;
        cell.x += mod(floor(cell.y), 2.0) * 0.5;
        vec2 edge = min(fract(cell), 1.0-fract(cell));
        vec2 aa = max(fwidth(cell), vec2(0.001));
        vec2 fill = smoothstep(vec2(joint), vec2(joint)+aa, edge);
        float piece = 0.94 + 0.12 * surfaceHash(floor(cell));
        float detail = mix(0.81, piece, fill.x * fill.y);
        return mix(detail, 1.0, smoothstep(0.3,0.8,max(aa.x,aa.y)));
      }`);
    let treatment;
    if (glass) {
      treatment = `
        float id = floor(vPaneUv.x/2.0);
        vec2 uv = clamp(vec2(vPaneUv.x-id*2.0,vPaneUv.y),0.0,1.0);
        float choice = surfaceHash(vec2(id,17.0));
        float opening = surfaceHash(vec2(id,43.0));
        float tone = surfaceHash(vec2(id,91.0));
        float edge = smoothstep(0.0,0.09,min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y)));
        float sky = smoothstep(0.35,1.0,uv.y);
        diffuseColor.rgb *= mix(0.40,0.96,sky) * mix(0.63,1.0,edge) * mix(0.70,1.12,tone);
        // Broad, faint sky reflections; no repeated diagonal white slash.
        float reflection = smoothstep(0.15+opening*0.3,1.15,uv.y+uv.x*0.12);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.38,0.46,0.49),reflection*(0.04+tone*0.09));
        ${kind === 'glass' ? `
          if (choice > 0.54 && choice < 0.82) {
            float blind = smoothstep(0.0,0.025,uv.y-(0.18+opening*0.68));
            float folds = 0.96+0.04*cos(uv.y*105.0);
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.37,0.35,0.30)*folds,blind*edge*0.85);
          } else if (choice >= 0.82) {
            float left = 1.0-smoothstep(0.08+opening*0.14,0.12+opening*0.14,uv.x);
            float right = smoothstep(0.76+tone*0.12,0.81+tone*0.12,uv.x);
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.40,0.37,0.30),(left+right)*edge*0.70);
          }
          if(tone<0.12) diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.34,0.25,0.14),edge*0.26);`
          : 'diffuseColor.rgb *= mix(0.70,1.0,smoothstep(0.0,0.32,uv.y));'}`;
    } else if (kind === 'plowed') {
      treatment = `
        vec2 p=vSurfacePos.xz;
        float footprint=max(length(dFdx(p)),length(dFdy(p)));
        float broad=landNoise(p*.065+vec2(17,8));
        float clods=landNoise(p*5.0);
        float detail=1.0-smoothstep(.12,.8,footprint);
        // Fade subpixel furrows rather than aliasing into wide moire stripes.
        float rows=1.0-smoothstep(.2,.65,fwidth(vFieldUv.x));
        float furrow=cos(vFieldUv.x*6.2831853);
        diffuseColor.rgb *= .92+.16*broad+(clods-.5)*.23*detail+furrow*.13*rows;
      `;
    } else if (kind === 'terrain' || kind === 'riverbank' || kind === 'gravel') {
      treatment = `
        vec2 p=vSurfacePos.xz;
        float broad=landNoise(p*.035+vec2(17,8));
        float clumps=landNoise(p*1.7+vec2(4,19));
        float fine=landNoise(p*12.0);
        float footprint=max(length(dFdx(p)),length(dFdy(p)));
        float close=1.0-smoothstep(.08,.7,footprint);
        diffuseColor.rgb *= .94 + .12*broad + (clumps-.5)*.10 + (fine-.5)*.24*close;
        ${kind === 'terrain' ? `
          float dry=smoothstep(.57,.79,landNoise(p*.12+vec2(93,31)));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.25,.105),dry*.12);
          float blade=landNoise(p*vec2(30.0,8.0));
          diffuseColor.rgb*=1.0+(blade-.5)*.16*close;` : ''}`;
    } else if (kind === 'paving-brick' || kind === 'paving-stone') {
      // Horizontal pavers need world x/z coordinates; facade masonry uses
      // wall height and degenerates to stripes on an almost horizontal face.
      treatment = `
        vec2 p = vec2(dot(vSurfacePos.xz,vec2(.8572,-.5150)),dot(vSurfacePos.xz,vec2(.5150,.8572)));
        float masonry = course(p,vec2(${kind === 'paving-brick' ? '.23,.112' : '.60,.40'}),.022);
        diffuseColor.rgb *= masonry;
        float grain=landNoise(vSurfacePos.xz*17.0);
        float footprint=max(length(dFdx(p)),length(dFdy(p)));
        diffuseColor.rgb*=1.0+(grain-.5)*.06*(1.0-smoothstep(.03,.22,footprint));
      `;
    } else if (kind === 'water') {
      treatment = `
        vec2 p=vSurfacePos.xz;
        float pools=landNoise(p*.075);
        float flow=landNoise(p*vec2(.16,1.6));
        float ripple=landNoise(p*2.4+vec2(flow*2.0,pools));
        float footprint=max(length(dFdx(p)),length(dFdy(p)));
        float detail=1.0-smoothstep(.15,1.5,footprint);
        diffuseColor.rgb*=.86+.22*pools+(ripple-.5)*.045*detail;
        float reflection=smoothstep(.62,.94,flow)*.045;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.40,.40),reflection);
      `;
    } else {
      treatment = `
        vec3 n = normalize(vSurfaceNormal);
        vec3 across = normalize(vec3(n.z,0.0,-n.x)+vec3(0.0001,0.0,0.0));
        vec2 wallUV = vec2(dot(vSurfacePos,across),vSurfacePos.y);
        float broad = sin(vSurfacePos.x*0.39+vSurfacePos.z*0.27)*sin(vSurfacePos.y*0.48);
        diffuseColor.rgb *= 1.0 + broad*0.025;`;
      if (kind === 'brick' || kind === 'stone') treatment += `
        float masonry = course(wallUV,vec2(${kind === 'brick' ? '0.31,0.115' : '0.64,0.30'}),0.025);
        diffuseColor.rgb *= mix(masonry,1.0,smoothstep(0.45,0.85,abs(n.y)));`;
      if (kind === 'siding') treatment += `
        float row = fract(vSurfacePos.y/0.23), aa = max(fwidth(vSurfacePos.y/0.23),0.001);
        float seam = smoothstep(0.02,0.02+aa,row);
        float siding = mix(0.88,1.025,seam);
        diffuseColor.rgb *= mix(siding,1.0,max(smoothstep(0.3,0.8,aa),smoothstep(0.45,0.85,abs(n.y))));`;
      if (kind === 'vertical-wood') treatment += `
        float board = wallUV.x/0.19, aa = max(fwidth(board),0.001);
        float seam = smoothstep(0.035,0.035+aa,min(fract(board),1.0-fract(board)));
        float timber = mix(0.75,1.02,seam);
        diffuseColor.rgb *= mix(timber,1.0,max(smoothstep(0.3,0.8,aa),smoothstep(0.45,0.85,abs(n.y))));`;
      if (kind === 'shingles') treatment += `
        vec3 upSlope = normalize(cross(n,across));
        vec2 roofUV = vec2(dot(vSurfacePos,across),dot(vSurfacePos,upSlope));
        diffuseColor.rgb *= course(roofUV,vec2(0.52,0.29),0.022);
        diffuseColor.rgb *= 1.0+0.045*sin(roofUV.x*0.8)*sin(roofUV.y*0.7);`;
      if (kind === 'membrane') treatment += `
        vec2 panel = vSurfacePos.xz/vec2(1.1,5.4);
        vec2 edge = min(fract(panel),1.0-fract(panel));
        vec2 aa = max(fwidth(panel),vec2(0.001));
        vec2 joint = smoothstep(vec2(0.008),vec2(0.008)+aa,edge);
        float seam = mix(0.94,1.0,joint.x*joint.y);
        diffuseColor.rgb *= mix(seam,1.0,smoothstep(0.3,0.8,max(aa.x,aa.y)));`;
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n{${treatment}\n}`);
    if (kind === 'water') shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Water reflects a nearly level surface, not every terrain-grid facet.
      vec2 wp=vSurfacePos.xz;
      vec3 waveNormal=normalize(vec3((landNoise(wp*.7)-.5)*.018,1.0,(landNoise(wp*.8+vec2(28,63))-.5)*.018));
      normal=normalize(mat3(viewMatrix)*waveNormal);
    `);
    if (glass) shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float id = floor(vPaneUv.x/2.0);
        vec2 uv = clamp(vec2(vPaneUv.x-id*2.0,vPaneUv.y),0.0,1.0);
        float tone = surfaceHash(vec2(id,91.0));
        float choice = surfaceHash(vec2(id,17.0));
        float opening = surfaceHash(vec2(id,43.0));
        float edge = smoothstep(0.0,0.10,min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y)));
        // A building can keep every room lit; otherwise some rooms are asleep.
        float occupied = ${allOn ? '1.0' : `step(${kind === 'shop' ? '0.08' : '0.22'}, tone)`};
        float shade = 1.0;
        ${kind === 'glass' ? `
          if (choice > 0.54 && choice < 0.82) {
            shade = mix(1.0,0.38,smoothstep(0.0,0.025,uv.y-(0.18+opening*0.68)));
            shade *= 0.94+0.06*cos(uv.y*105.0);
          } else if (choice >= 0.82) {
            shade = 0.4+0.6*smoothstep(0.16,0.29,uv.x)*(1.0-smoothstep(0.71,0.84,uv.x));
          }` : ''}
        vec3 warm = mix(vec3(1.0,0.40,0.10),vec3(1.0,0.72,0.34),opening);
        vec3 room = warm * (0.8+tone*1.1) * mix(0.4,1.0,edge) * shade * occupied;
        totalEmissiveRadiance = mix(totalEmissiveRadiance,room,nightAmount);
      }`);
  };
  m.customProgramCacheKey = () => `surface-${kind}${allOn ? '-all-on' : ''}`;
  cache.set(key, m);
  return m;
}

export function facadeMaterial(color, kind = 'house', label = '', material = null) {
  const c = new THREE.Color(color), name = String(label);
  const brick = /brick/.test(name) || (c.r > c.g * 1.7 && c.g > c.b * 1.12);
  const type = material || (brick ? 'brick' : /stone|limestone/.test(name) ? 'stone' : kind === 'house' ? 'siding' : 'plaster');
  if (type === 'brick') c.lerp(new THREE.Color(0xa17864), 0.16);
  return surfaceMaterial(type, c.getHex());
}

// A real opening, so the glass can sit behind the trim without being hidden
// by a solid backing slab. The outline itself stays dimensionally unchanged.
export function frameGeometry(outline, opening, depth = 0.28) {
  const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(...p)));
  shape.holes.push(new THREE.Path([...opening].reverse().map(p => new THREE.Vector2(...p))));
  const geo = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false});
  geo.translate(0,0,-depth/2);
  return geo;
}

export function paneUV(geo) {
  geo.computeBoundingBox();
  const {min,max} = geo.boundingBox, p = geo.attributes.position;
  const uv = new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++) {
    uv[i*2]=(p.getX(i)-min.x)/Math.max(0.001,max.x-min.x);
    uv[i*2+1]=(p.getY(i)-min.y)/Math.max(0.001,max.y-min.y);
  }
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return geo;
}
