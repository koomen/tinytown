import * as THREE from 'three';
import { IsoControls } from '../../../src/isocontrols.js';

export function checkTerrainNavigation() {
  const canvas = document.createElement('canvas');
  const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 2000);
  const controls = new IsoControls(camera, canvas);
  const ground = (x, z) => x * 0.05 + z * 0.03;
  controls.groundHeight = ground;
  controls.set({ target: new THREE.Vector3(0, 4, 0), distance: 30 });
  try {
    for (const move of [new THREE.Vector3(-200, 0, -200), new THREE.Vector3(20, 0, -30)]) {
      controls.pan(move); controls.update();
      const p = controls.target;
      if (Math.abs(p.y - ground(p.x, p.z) - 4) > 1e-6)
        throw new Error('Panning lost the target height above the terrain');
      if (Math.abs(camera.position.distanceTo(p) - 30) > 1e-6)
        throw new Error('Following the terrain changed the zoom distance');
    }
    return { terrainClearance: 4, distance: controls.distance };
  } finally { controls.dispose(); }
}
