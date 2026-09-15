import * as THREE from 'three';
import {buildBlueprint} from '../../../src/blueprint.js';
import {makeRng} from '../../../src/rng.js';
import {foundationSupportsVolume} from '../../../src/foundation-support.js';

const assert = (ok, message) => {if (!ok) throw new Error(message);};
const frame = {obb:{cx:0,cz:0,angle:0}};
const build = (bp, bottom) => {
  const root = buildBlueprint(makeRng('roof-joins'),frame,bp,0,[],bottom);
  root.updateMatrixWorld(true); return root;
};

export async function checkRoofJoins() {
  // The school stands outside compact Avon; only the extended miniature holds it.
  const site = await (await fetch('/data/avon-extended/site.json')).json();
  const school = site.buildings.find(b => b.id === 248254717);
  const root = build(school.blueprint);
  const ray = new THREE.Raycaster();
  let samples = 0;
  // Real intersections: the stepped north wings and the pale classroom roof.
  for (const [u0,u1,v0,v1] of [[12.4,14.6,59.4,66.6],[26.4,28.6,48.4,55.6],[-14.7,-14.3,-40,-15]]) {
    for (let u = u0; u < u1; u += .37) for (let v = v0; v < v1; v += .41) {
      ray.set(new THREE.Vector3(u,20,v),new THREE.Vector3(0,-1,0));
      const hits = ray.intersectObject(root,true);
      assert(hits.length && Math.abs(hits[0].point.y-4.02)<1e-4, 'Joined school roof has a hole or changed height');
      assert(hits.filter(h => Math.abs(h.distance-hits[0].distance)<1e-4).length === 1,
        `School roof still has coincident surfaces at ${u},${v}`);
      samples++;
    }
  }

  // A concave junction keeps its notch; a taller roof keeps its own level.
  const probe = build({volumes:[
    {u:[0,5],v:[0,3],height:4,roof:{type:'flat',lip:false}},
    {u:[2,5],v:[2,7],height:4,roof:{type:'flat',lip:false}},
    {u:[3,5],v:[3,5],height:7,roof:{type:'flat',lip:false}},
  ]});
  for (const [u,v,expected] of [[1.123,1.321,4.22],[3.123,2.321,4.22],[3.123,6.321,4.22],[4.123,4.321,7.22],[1.123,5.321,null]]) {
    ray.set(new THREE.Vector3(u,20,v),new THREE.Vector3(0,-1,0));
    const hits = ray.intersectObject(probe,true);
    if (expected === null) assert(!hits.length,'Roof union filled the courtyard notch');
    else {
      assert(Math.abs(hits[0].point.y-expected)<1e-4,'Roof union changed a distinct roof level');
      assert(hits.filter(h=>Math.abs(h.distance-hits[0].distance)<1e-4).length === 1,'Roof union left a double surface');
    }
  }

  const floral = site.buildings.find(b => b.id === 1090362840);
  const o=floral.obb,c=Math.cos(o.angle),s=Math.sin(o.angle);
  const footprint=floral.pts.map(([x,z])=>[(x-o.cx)*c+(z-o.cz)*s,-(x-o.cx)*s+(z-o.cz)*c]);
  const supported = build(floral.blueprint,vol=>foundationSupportsVolume(footprint,vol)?-.08:-1.2);
  const unsupported = build(floral.blueprint);
  let walls = 0;
  supported.traverse(o => {
    if (!o.userData.volumeWall) return;
    const bounds = new THREE.Box3().setFromObject(o);
    assert(bounds.min.y >= -.08001,'Floral World wall penetrates the supporting stone foundation');
    walls++;
  });
  assert(walls >= 6,'Checked the full Floral World and theater assembly');
  const rear = unsupported.getObjectByName('rear-wing').children.find(o=>o.userData.volumeWall);
  assert(Math.abs(new THREE.Box3().setFromObject(rear).min.y+1.2)<1e-4,'Unsupported walls must still extend below grade');
  const raised = supported.getObjectByName('park-sign-blade').children.find(o=>o.userData.volumeWall);
  assert(Math.abs(new THREE.Box3().setFromObject(raised).min.y-4.7)<1e-4,'Explicit raised sign support was changed');
  const notched=[[0,0],[10,0],[10,10],[6,10],[6,4],[4,4],[4,10],[0,10]];
  assert(foundationSupportsVolume(notched,{u:[0,4],v:[0,10]}),'A supported wing was rejected');
  assert(!foundationSupportsVolume(notched,{u:[-1,4],v:[0,10]}),'Walls beyond the foundation would float');
  assert(!foundationSupportsVolume(notched,{u:[1,9],v:[1,9]}),'A concave foundation notch must retain below-grade walls');
  return {schoolOverlapSamples:samples,foundationWalls:walls};
}
