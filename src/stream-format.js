// Compact scene container: a small Three.js ObjectLoader JSON header followed
// by aligned typed arrays. Geometry numbers never pass through JSON parsing.
export const STREAM_VERSION = 4; // Large maps fetch coarse regions independently.
const MAGIC = 0x324e5754;
const TYPES = { Float32Array, Float64Array, Uint32Array, Uint16Array, Int16Array, Uint8Array, Int8Array, Int32Array };

export function packSceneJSON(json) {
  const chunks = [];
  let size = 0;
  const header = new TextEncoder().encode(JSON.stringify(json, function(key, value) {
    if (!ArrayBuffer.isView(value)) return value;
    if (!TYPES[value.constructor.name]) throw new Error('Unsupported streaming array');
    const pad = (8-size%8)%8;
    if (pad) { chunks.push(new Uint8Array(pad)); size += pad; }
    const stride = value.BYTES_PER_ELEMENT * (this.itemSize || 1);
    const descriptor = { $array: value.constructor.name, offset: size, length: value.length, stride };
    const bytes = new Uint8Array(value.buffer,value.byteOffset,value.byteLength), encoded = new Uint8Array(bytes.length);
    const count = bytes.length/stride;
    for(let lane=0;lane<stride;lane++) {
      let previous=0;
      for(let i=0;i<count;i++){const b=bytes[i*stride+lane];encoded[lane*count+i]=b^previous;previous=b;}
    }
    chunks.push(encoded);
    size += value.byteLength;
    return descriptor;
  }));
  const prefix = new Uint8Array(8), view = new DataView(prefix.buffer);
  view.setUint32(0, MAGIC, true); view.setUint32(4, header.length, true);
  return new Blob([prefix, header, new Uint8Array((8-header.length%8)%8), ...chunks]);
}

export function unpackSceneJSON(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8 || view.getUint32(0,true) !== MAGIC) throw new Error('Invalid streamed scene');
  const length = view.getUint32(4,true), start = 8 + Math.ceil(length/8)*8;
  if (start > buffer.byteLength) throw new Error('Truncated streamed scene');
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,8,length)), (key,value) => {
    if (!value || !Object.hasOwn(value,'$array')) return value;
    const Type = TYPES[value.$array], {offset,length,stride} = value;
    if (!Type || !Number.isSafeInteger(offset) || offset<0 || offset%8 ||
        !Number.isSafeInteger(length) || length<0 || start+offset+length*Type.BYTES_PER_ELEMENT>buffer.byteLength ||
        !Number.isInteger(stride) || stride<1 || stride>128 || length*Type.BYTES_PER_ELEMENT%stride) {
      throw new Error('Invalid streamed array');
    }
    const bytes=new Uint8Array(buffer,start+offset,length*Type.BYTES_PER_ELEMENT),encoded=bytes.slice(),count=bytes.length/stride;
    for(let lane=0;lane<stride;lane++) {
      let previous=0;
      for(let i=0;i<count;i++){previous^=encoded[lane*count+i];bytes[i*stride+lane]=previous;}
    }
    return new Type(buffer,start+offset,length);
  });
}

// A base may span several individually hostable parts of one gzip stream.
export const STREAM_PART_BYTES = 20 * 1024 * 1024;
export function streamAssetRecords(manifest) {
  const parts=manifest.base.parts;
  if(parts && (!Array.isArray(parts) || !parts.length || parts.reduce((n,p)=>n+p.bytes,0)!==manifest.base.bytes)) throw new Error('Invalid stream base parts');
  return [...(parts || [manifest.base]),...(manifest.regions || []),...manifest.tiles];
}

export function compressedPartsStream(chunks) {
  if(!Array.isArray(chunks) || !chunks.length || chunks.some(p=>!(p instanceof Uint8Array))) throw new Error('Invalid stream parts');
  let part=0,offset=0;
  return new ReadableStream({pull(controller) {
    while(part<chunks.length && offset===chunks[part].length) {chunks[part]=null;part++;offset=0;}
    if(part===chunks.length){controller.close();return;}
    const bytes=chunks[part],end=Math.min(offset+8192,bytes.length);
    controller.enqueue(bytes.subarray(offset,end));offset=end;
  }});
}
