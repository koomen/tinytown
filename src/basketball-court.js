import * as THREE from 'three';
import {mat} from './kit.js';
import {ribbonStrip} from './landmark-ribbon.js';
import {drapeTriangles} from './landmark-drape.js';
import {buildBasketballHoop} from './basketball-hoop.js';

// The authored end-edge indices establish the court's playing direction. All
// dimensions fit the mapped pad, including compact elementary-school courts.
export function buildBasketballCourt(feature,grade=()=>0,grid=null) {
  const root=new THREE.Group();root.name='basketball-court';
  const [i,j]=feature.basketball.endEdge,a=feature.pts[i],b=feature.pts[j];
  const center=feature.pts.reduce((p,q)=>[p[0]+q[0]/4,p[1]+q[1]/4],[0,0]);
  const width=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/width,uz=(b[1]-a[1])/width;
  const vx=-uz,vz=ux,point=(u,v)=>[center[0]+ux*u+vx*v,center[1]+uz*u+vz*v];
  const depths=feature.pts.map(p=>(p[0]-center[0])*vx+(p[1]-center[1])*vz);
  const hw=width/2-.85,hl=(Math.max(...depths)-Math.min(...depths))/2-1;
  const line=(points,name='basketball-line',closed=false)=>{
    const strip=ribbonStrip(points.map(p=>point(...p)),.075,closed);
    const d=drapeTriangles(strip.positions,strip.indices,grade,grid,.155);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));
    g.setIndex(d.indices);g.computeVertexNormals();const m=new THREE.Mesh(g,mat(0xe6e7d9));
    m.name=name;m.userData.streamCoarse=true;m.userData.castShadow=false;root.add(m);
  };
  const arc=(cx,cz,r,start,end,n=48)=>Array.from({length:n+1},(_,i)=>{
    const a=start+(end-start)*i/n;return [cx+r*Math.cos(a),cz+r*Math.sin(a)];
  });
  line([[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]],'basketball-boundary',true);
  line([[-hw,0],[hw,0]],'basketball-center-line');
  line(arc(0,0,1.35,0,Math.PI*2),'basketball-center-circle');
  for(const side of [-1,1]) {
    const baseline=side*hl,key=side*(hl-4.2),rim=side*(hl-1.13),r=Math.min(5.55,hw-.6);
    line([[-1.8,baseline],[-1.8,key],[1.8,key],[1.8,baseline]],'basketball-key');
    line(arc(0,key,1.8,0,Math.PI*2),'basketball-free-throw-circle');
    const three=arc(0,rim,r,side<0?0:Math.PI,side<0?Math.PI:Math.PI*2);
    line([[three[0][0],baseline],...three,[three.at(-1)[0],baseline]],'basketball-three-point-line');
    const at=point(0,side*(hl+.35));
    root.add(buildBasketballHoop({id:`${feature.id}-${side}`,pts:[at,center],style:feature.basketball.hoopStyle},grade));
  }
  root.userData.court={center,halfWidth:hw,halfLength:hl};
  return root;
}
