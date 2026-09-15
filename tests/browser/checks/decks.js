import * as THREE from 'three';
import {buildBlueprint} from '../../../src/blueprint.js';
import {makeRng} from '../../../src/rng.js';

export function checkDecks() {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const bounds = o => new THREE.Box3().setFromObject(o);
  const build = (roof, railSides, sideRailGaps) => {
    const root = buildBlueprint(makeRng('deck'), {obb:{cx:0,cz:0,angle:0}}, {
      volumes:[], porches:[{style:'open',face:'+v',u:[-3,3],wall:0,
        d:3,floorH:3,posts:3,roof,railing:true,railSides,sideRailGaps}],
    }, 0, []);
    root.updateMatrixWorld(true); return root;
  };
  const deck = build('none'), supports = [], rails = [];
  deck.traverse(o => {
    if (o.name === 'deck-support') supports.push(bounds(o));
    if (o.name === 'deck-rail-post') rails.push(bounds(o));
  });
  const floor = bounds(deck.getObjectByName('porch-floor'));
  assert(Math.abs(floor.min.y - 2.78) < 1e-5 && Math.abs(floor.max.y - 3) < 1e-5,
    'Raised deck must have a thin floor, not a solid foundation');
  assert(supports.length === 3 && supports.every(b=>b.min.y<0 && Math.abs(b.max.y-floor.min.y)<1e-5),
    'Every deck support must reach from grade to the floor underside');
  assert(rails.length === 3 && rails.every(b=>Math.abs(b.min.y-3)<1e-5 && b.max.y<4),
    'Deck railing posts should stop at railing height');
  assert(bounds(deck).max.y<4,'Uncovered deck has an unwanted overhead roof');
  const ray = new THREE.Raycaster(new THREE.Vector3(1,1,5),new THREE.Vector3(0,0,-1));
  assert(!ray.intersectObject(deck,true).length,'Space underneath the raised deck must remain open');
  assert(bounds(build('hip')).max.y>6,'Existing covered porches must retain their roof');
  const openEnd = build('none',['front','left']);
  ray.set(new THREE.Vector3(5,3.9,1.13),new THREE.Vector3(-1,0,0));
  const fullHits=ray.intersectObject(deck,true), openHits=ray.intersectObject(openEnd,true);
  assert(fullHits.length && openHits.length && openHits[0].distance>fullHits[0].distance+5,
    'A wraparound deck connection must omit the selected end railing');
  const stairGap = build('none',undefined,{right:{at:.2,w:1}});
  ray.set(new THREE.Vector3(5,3.9,.6),new THREE.Vector3(-1,0,0));
  assert(ray.intersectObject(stairGap,true)[0].distance>7,'Side stair opening is blocked by railing');
  ray.set(new THREE.Vector3(5,3.9,2),new THREE.Vector3(-1,0,0));
  assert(ray.intersectObject(stairGap,true)[0].distance<3,'Stair opening removed the rest of the end railing');
  const stairs = buildBlueprint(makeRng('stairs'), {obb:{cx:0,cz:0,angle:0}}, {
    volumes:[], details:[
      {type:'stair',construction:'open',u:-15.8,v:6.8,dir:[1,0],length:2.2,height:1.475,y:1.475,w:1},
      {type:'stair',construction:'open',u:-13.6,v:8,dir:[-1,0],length:2.2,height:1.475,w:1},
      {type:'landing',u:-16.45,v:7.4,w:1.3,length:2.2,height:1.475,railSides:['front','back','left']},
    ],
  }, 0, []);
  stairs.updateMatrixWorld(true);
  const treads=[],stringers=[],landingSupports=[];
  stairs.traverse(o=>{
    if(o.name==='stair-tread')treads.push(bounds(o));
    if(o.name==='stair-stringer')stringers.push(o);
    if(o.name==='stair-landing-support')landingSupports.push(bounds(o));
  });
  assert(treads.length===16 && treads.every(b=>Math.abs(b.max.y-b.min.y-.065)<1e-5),
    'Open flights must have separate thin treads');
  assert(stringers.length===4,'Each open flight must have two supporting stringers');
  assert(Math.abs(treads[7].max.y-2.95)<1e-5 && Math.abs(treads[7].max.x+13.58)<1e-5,
    'Upper flight must join the deck at full height, descending eastward');
  assert(Math.abs(treads[15].max.y-1.475)<1e-5 && Math.abs(treads[15].min.x+15.82)<1e-5,
    'Lower flight must join the landing, descending back westward');
  assert(landingSupports.length===4 && landingSupports.every(b=>b.min.y<0 && Math.abs(b.max.y-1.295)<1e-5),
    'Landing supports must reach grade and meet its thin floor');
  ray.set(new THREE.Vector3(-14.7,.4,10),new THREE.Vector3(0,0,-1));
  assert(!ray.intersectObject(stairs,true).length,'Open space below both stair flights is filled');
  ray.set(new THREE.Vector3(-15.6,2.375,7.4),new THREE.Vector3(-1,0,0));
  assert(ray.intersectObject(stairs,true)[0].distance>1.4,'Landing turn is blocked by a railing');
  const solid=buildBlueprint(makeRng('solid'),{obb:{cx:0,cz:0,angle:0}},
    {volumes:[],details:[{type:'stair',u:0,v:0,dir:[0,-1],length:2.2,height:1.475,w:1}]},0,[]);
  solid.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(2,.3,-1.5),new THREE.Vector3(-1,0,0));
  assert(ray.intersectObject(solid,true).length,'Existing masonry stairs must remain solid');
  return {supports:supports.length,railPosts:rails.length,openTreads:treads.length,stringers:stringers.length};
}
