// Binary fractions leave exact trailing zero bits in Float32 coordinates,
// unlike decimal centimetres. Unfixed far vertices move at most 3.91 mm per axis;
// nearby tile geometry and resident street furniture never pass through here.
export const FAR_POSITION_STEP = 1 / 128;
export const farPositionKey=(x,y,z)=>`${x},${y},${z}`;
export function compactFarAttributes(attributes,{preservePosition=()=>false}={}) {
  return Object.fromEntries(Object.entries(attributes).map(([name,a])=>{
    if(name==='position') {
      const array=new Float32Array(a.array);
      for(let i=0;i<array.length;i+=3) if(!preservePosition(array[i],array[i+1],array[i+2])) {
        for(let j=0;j<3;j++) array[i+j]=Math.round(array[i+j]/FAR_POSITION_STEP)*FAR_POSITION_STEP;
      }
      return [name,{...a,array}];
    }
    if(name==='normal') {
      const divisor=!a.normalized?1:a.array instanceof Int16Array?32767:a.array instanceof Int8Array?127:a.array instanceof Uint16Array?65535:255;
      return [name,{...a,normalized:true,array:Int8Array.from(a.array,v=>Math.max(-127,Math.min(127,Math.round(v/divisor*127))))}];
    }
    return [name,a];
  }));
}
