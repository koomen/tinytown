// Coarse elevation rasters cannot describe the ground beneath an open bridge.
// Give the span a level bed and blend its approach embankments into the source
// terrain. Roads, water and ground all sample this same field.
export function bridgeGrade(buildings, sample) {
  const spans=buildings.filter(b=>b.blueprint?.bridge).map(b=>{
    const o=b.obb,spec=b.blueprint.bridge,a=o.angle+(spec.axis==='v'?Math.PI/2:0);
    const c=Math.cos(a),s=Math.sin(a),length=spec.axis==='v'?o.d:o.w,width=spec.axis==='v'?o.w:o.d;
    const heights=[];
    for(let i=-4;i<=4;i++) heights.push(sample(o.cx+c*length*i/8,o.cz+s*length*i/8));
    heights.sort((a,b)=>a-b);
    return {id:String(b.id),cx:o.cx,cz:o.cz,c,s,length,width,base:heights[4],height:spec.height??6,
      blend:Math.max(12,Math.min(35,length*.45)),ramp:spec.approachLength??Math.max(25,(spec.height??6)*7),
      approachWidth:spec.approachWidth??width,plateau:spec.approachPlateau??0,
      approaches:spec.approaches!==false,
      retaining:spec.type==='steel-girder' && spec.wingWalls,
      pier:spec.pierWidth??Math.min(1.6,length*.08),supportWidth:spec.abutmentWidth??width};
  });
  const floors=new Map(spans.map(b=>[b.id,b.base]));
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const grade=(x,z)=>{
    let y=sample(x,z);
    for(const b of spans) {
      const dx=x-b.cx,dz=z-b.cz,u=dx*b.c+dz*b.s,v=-dx*b.s+dz*b.c;
      const end=Math.abs(u)-b.length/2,side=Math.max(0,Math.abs(v)-b.width/2);
      const distance=Math.hypot(Math.max(0,end),side);
      if(distance<b.blend) y+=(b.base-y)*(1-smooth(distance/b.blend));
      const approachSide=Math.max(0,Math.abs(v)-b.approachWidth/2);
      // Hide the rise inside the abutments, then spread it into a bank behind
      // the splayed wings. A height jump at the outer bridge edge becomes a
      // sawtooth cliff when sampled on the rotated terrain grid.
      let bank= end>=0 ? 1 : 0;
      if(b.retaining) {
        const wings=b.retaining,t=smooth((Math.abs(v)-b.supportWidth/2)/(wings.length??5));
        const start=b.length/2-b.pier+Math.min(.6,b.pier*.25)+(wings.splay??1.6)*t;
        const finish=b.length/2-Math.min(.5,b.pier*.25)+6*t;
        bank=smooth((Math.abs(u)-start)/(finish-start));
      }
      if(b.approaches && bank>0 && end<b.ramp+b.plateau && approachSide<8) {
        const top=b.base+b.height;
        // Keep grass below the deck inside the span; meet the rail approaches
        // at full height exactly at the ends, without coplanar top surfaces.
        const inset=b.retaining ? .12*(1-smooth((end+.5)/.5)) : 0;
        const target=top-inset+(sample(x,z)-top)*smooth((end-b.plateau)/b.ramp);
        y+=(target-y)*bank*(1-smooth(approachSide/8));
      }
    }
    return y;
  };
  return {sample:grade,floors};
}
