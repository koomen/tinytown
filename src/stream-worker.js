self.onmessage = async ({data:{bytes,parts,rawBytes}}) => {
  try {
    // Workers have no document import map. Carry the viewer revision through
    // their dependency URL too, including when Safari retains old scripts.
    const formatURL=new URL('./stream-format.js',import.meta.url);
    formatURL.search=new URL(import.meta.url).search;
    const {unpackSceneJSON,compressedPartsStream}=await import(formatURL.href);
    if (!Number.isSafeInteger(rawBytes) || rawBytes<8 || rawBytes>256*1024*1024) throw new Error('Invalid streamed scene size');
    // Keep the inflater's input chunks small, including in WebKit, and write
    // straight into the final buffer. Blob + Response.arrayBuffer can retain
    // another full inflated scene while assembling its result.
    const input=compressedPartsStream(parts || [bytes]);
    const reader=input.pipeThrough(new DecompressionStream('gzip')).getReader();
    const output=new Uint8Array(rawBytes);
    let written=0,reported=0;
    try {
      for(;;) {
        const {done,value}=await reader.read();if(done)break;
        if(written+value.length>output.length)throw new Error('Oversized streamed scene');
        output.set(value,written);written+=value.length;
        if(written-reported>=1024*1024){self.postMessage({progress:written/rawBytes});reported=written;}
      }
    } finally { await reader.cancel(); }
    if(written!==rawBytes)throw new Error('Truncated streamed scene');
    const json=unpackSceneJSON(output.buffer);
    // Transfer ownership; neither the scene nor its geometry is copied back
    // to the UI thread. The worker is terminated as soon as this arrives.
    self.postMessage({json},[output.buffer]);
  } catch(error) { self.postMessage({error:error.message}); }
};
