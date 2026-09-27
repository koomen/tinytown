// The few browser globals the generators (src/) and stream-export.js touch,
// for baking in plain Node: canvases and images from @napi-rs/canvas (Skia),
// a document that makes them, and image loading from the repository.
// Import this before anything that imports three.
//
// Sign textures ask for Georgia, Arial and Nunito. The bundled
// metric-compatible substitutes in fonts/ are registered under those names and
// are the only fonts Skia sees for them, so every OS bakes identical textures.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, Image, ImageData, Path2D, GlobalFonts } from '@napi-rs/canvas';

const web = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(web, '../..');

const FAMILIES = { gelasio: 'Georgia', arimo: 'Arial', nunito: 'Nunito' };
for (const file of readdirSync(join(web, 'fonts')).sort()) {
  const family = FAMILIES[file.split('-')[0]];
  if (family && file.endsWith('.woff2') && !GlobalFonts.registerFromPath(join(web, 'fonts', file), family)) {
    throw new Error(`Bake font ${file} failed to load`);
  }
}

// Page-relative ('data/x.png') and root-relative ('/data/x.png') URLs both
// name files under the repository, as they do from the viewer at '/'.
export function repoPath(url) {
  const path = decodeURIComponent(new URL(String(url), 'http://localhost/').pathname);
  return join(ROOT, path);
}

// What three's ImageLoader needs from an <img>: events, and a src that loads.
class ImageElement extends Image {
  #listeners = { load: [], error: [] };
  addEventListener(type, listener) { this.#listeners[type]?.push(listener); }
  removeEventListener(type, listener) {
    const list = this.#listeners[type];
    if (list?.includes(listener)) list.splice(list.indexOf(listener), 1);
  }
  get src() { return super.src; }
  set src(url) {
    const fire = (type, event) => setTimeout(() => {
      for (const listener of [...this.#listeners[type]]) listener.call(this, event);
    });
    if (typeof url !== 'string' || /^data:/i.test(url)) {
      super.onload = () => fire('load', { type: 'load' });
      super.onerror = error => fire('error', error);
      super.src = url;
      return;
    }
    let bytes;
    try { bytes = readFileSync(repoPath(url)); }
    catch (error) { fire('error', error); return; }
    super.onload = () => fire('load', { type: 'load' });
    super.onerror = error => fire('error', error);
    super.src = bytes;
  }
}

function createElement(name) {
  if (name === 'canvas') return new Canvas(300, 150);
  if (name === 'img') return new ImageElement();
  throw new Error(`node-dom: no <${name}> outside a browser`);
}

Object.assign(globalThis, {
  document: { createElement, createElementNS: (_, name) => createElement(name) },
  HTMLCanvasElement: Canvas,
  HTMLImageElement: Image,
  ImageData,
  Path2D,
  location: new URL('http://localhost/'),
});
