import * as THREE from 'three';

// Join intersecting rectangular roof slabs at the same level. Each exposed
// patch has one owner, including its rim; internal sides are omitted. Keeping
// the original material per patch preserves authored roof colours.
export function joinFlatRoofs(meshes) {
  const slabs = meshes.map(mesh => {
    mesh.updateMatrix();
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);
    return {mesh, min: bounds.min, max: bounds.max};
  });
  const overlaps = (a, b) => a.mesh.userData.flatRoofPart === b.mesh.userData.flatRoofPart
    && Math.abs(a.min.y - b.min.y) < 1e-5 && Math.abs(a.max.y - b.max.y) < 1e-5
    && Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 1e-5
    && Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 1e-5;
  const visited = new Set();
  for (const first of slabs) {
    if (visited.has(first)) continue;
    const group = [first]; visited.add(first);
    for (let i = 0; i < group.length; i++) for (const slab of slabs) {
      if (!visited.has(slab) && overlaps(group[i], slab)) {
        visited.add(slab); group.push(slab);
      }
    }
    if (group.length < 2) continue;
    const xs = [...new Set(group.flatMap(s => [s.min.x, s.max.x]))].sort((a,b) => a-b);
    const zs = [...new Set(group.flatMap(s => [s.min.z, s.max.z]))].sort((a,b) => a-b);
    const nx = xs.length - 1, nz = zs.length - 1, owners = new Int32Array(nx * nz).fill(-1);
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const u = (xs[x] + xs[x+1]) / 2, v = (zs[z] + zs[z+1]) / 2;
      group.forEach((s, i) => {
        if (u > s.min.x && u < s.max.x && v > s.min.z && v < s.max.z) owners[z*nx+x] = i;
      });
    }
    const positions = group.map(() => []);
    const owner = (x,z) => x < 0 || z < 0 || x >= nx || z >= nz ? -1 : owners[z*nx+x];
    const quad = (out,a,b,c,d) => out.push(...a,...b,...c,...a,...c,...d);
    const lo = first.min.y, hi = first.max.y;
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const i = owner(x,z); if (i < 0) continue;
      const out = positions[i], u0 = xs[x], u1 = xs[x+1], v0 = zs[z], v1 = zs[z+1];
      quad(out,[u0,hi,v0],[u0,hi,v1],[u1,hi,v1],[u1,hi,v0]);
      quad(out,[u0,lo,v0],[u1,lo,v0],[u1,lo,v1],[u0,lo,v1]);
      if (owner(x-1,z) < 0) quad(out,[u0,lo,v0],[u0,lo,v1],[u0,hi,v1],[u0,hi,v0]);
      if (owner(x+1,z) < 0) quad(out,[u1,lo,v1],[u1,lo,v0],[u1,hi,v0],[u1,hi,v1]);
      if (owner(x,z-1) < 0) quad(out,[u1,lo,v0],[u0,lo,v0],[u0,hi,v0],[u1,hi,v0]);
      if (owner(x,z+1) < 0) quad(out,[u0,lo,v1],[u1,lo,v1],[u1,hi,v1],[u0,hi,v1]);
    }
    group.forEach(({mesh},i) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions[i],3));
      geo.computeVertexNormals();
      // The original rounded boxes belong to the shared construction cache.
      mesh.geometry = geo;
      mesh.position.set(0,0,0); mesh.rotation.set(0,0,0); mesh.scale.set(1,1,1);
    });
  }
}
