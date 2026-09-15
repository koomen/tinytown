// The school identity supplied by the user, shared by the sign and midfield.
// Use the normal loading manager so offline scene export waits for the pixels.
import * as THREE from 'three';

export const AVON_EMBLEM_IMAGE='/data/avon-extended/textures/avon-braves-emblem.png';
const images=new Map();

export function loadAvonEmblem(onLoad,image=AVON_EMBLEM_IMAGE) {
  const existing=images.get(image);
  if(existing) {
    if(existing.image)onLoad(existing.image);else existing.callbacks.push(onLoad);
    return;
  }
  const entry={callbacks:[onLoad]};images.set(image,entry);
  new THREE.ImageLoader().load(image,loaded=>{
    entry.image=loaded;
    for(const callback of entry.callbacks)callback(loaded);
    entry.callbacks=[];
  },undefined,()=>images.delete(image));
}
