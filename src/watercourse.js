// Round survey-polyline corners within a bounded distance of the mapped
// course. Endpoints stay exact so adjacent stream pieces still meet.
export function smoothWatercourse(points, width = 3) {
  const pts=points.filter((p,i)=>!i || Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-6);
  if(pts.length<3)return pts.map(p=>[...p]);
  const out=[[...pts[0]]];
  const addLine=p=>{
    const a=out.at(-1),n=Math.max(1,Math.ceil(Math.hypot(p[0]-a[0],p[1]-a[1])/3));
    for(let i=1;i<=n;i++)out.push([a[0]+(p[0]-a[0])*i/n,a[1]+(p[1]-a[1])*i/n]);
  };
  for(let i=1;i<pts.length-1;i++) {
    const a=pts[i-1],p=pts[i],b=pts[i+1],la=Math.hypot(p[0]-a[0],p[1]-a[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const cut=Math.min(la*.25,lb*.25,Math.max(2,width*.8));
    const start=[p[0]+(a[0]-p[0])*cut/la,p[1]+(a[1]-p[1])*cut/la];
    const end=[p[0]+(b[0]-p[0])*cut/lb,p[1]+(b[1]-p[1])*cut/lb];
    addLine(start);
    const n=Math.max(3,Math.ceil(cut/1.5));
    for(let j=1;j<=n;j++) {
      const t=j/n,r=1-t;out.push([r*r*start[0]+2*r*t*p[0]+t*t*end[0],r*r*start[1]+2*r*t*p[1]+t*t*end[1]]);
    }
  }
  addLine(pts.at(-1));return out;
}
