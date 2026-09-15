// Split mapped fence segments into short terrain-following panels, preserving
// explicit gate openings even when the source way runs through a gate node.
export function perimeterPanels(points, openings = [], spacing = 3) {
  const panels = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i-1], b = points[i], dx = b[0]-a[0], dz = b[1]-a[1], length = Math.hypot(dx,dz);
    if (length < .01) continue;
    let intervals = [[0,length]];
    for (const opening of openings) {
      const ox=opening.point[0]-a[0], oz=opening.point[1]-a[1];
      const along=(ox*dx+oz*dz)/length, across=Math.abs(ox*dz-oz*dx)/length, radius=opening.width/2;
      if (across >= radius) continue;
      const half=Math.sqrt(radius*radius-across*across), lo=along-half, hi=along+half;
      intervals=intervals.flatMap(([s,e])=>hi<=s || lo>=e ? [[s,e]] : [[s,Math.min(e,lo)],[Math.max(s,hi),e]].filter(([u,v])=>v-u>.01));
    }
    for (const [s,e] of intervals) {
      const count=Math.ceil((e-s)/spacing);
      for(let j=0;j<count;j++) {
        const u=s+(e-s)*j/count, v=s+(e-s)*(j+1)/count;
        panels.push([[a[0]+dx*u/length,a[1]+dz*u/length],[a[0]+dx*v/length,a[1]+dz*v/length]]);
      }
    }
  }
  return panels;
}
