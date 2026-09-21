import * as THREE from 'three';
import {buildMappedParking,planParkingRows,buildParkingPaint} from '../../../src/mapped-parking.js';
import {shiftLandmark} from '../../../src/landmark-frame.js';
import {coarseModel} from '../../../tinytown/web/stream-export.js';

export function checkMappedParking(){
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const lot={id:'north',pts:[[-30,-20],[30,-20],[30,20],[-30,20]]};
  const rows=[{id:'row-a',kind:'parking-row',parkingLotId:'north',pts:[[-26,-10],[26,-10]],occupancy:1},
    {id:'row-b',kind:'parking-row',parkingLotId:'north',pts:[[-26,10],[26,10]],occupancy:1,face:-1}];
  const surfaceY=(x,z)=>.075*x-.04*z,roadEdge=(x,z)=>Math.abs(z)-3;
  const options={lots:[lot],surfaceY,roadEdge},cars=planParkingRows(rows,options);
  assert(cars.length>20,'Marked rows should contain cars');
  assert(planParkingRows(rows,{lots:[],surfaceY,roadEdge}).length===0,'Missing mapped lot must not populate');
  assert(JSON.stringify(cars)===JSON.stringify(planParkingRows([...rows].reverse(),options)),'Row order changed parked cars');
  const shifted=planParkingRows(rows.map(r=>shiftLandmark(r,80,-90)),{lots:[{...lot,pts:lot.pts.map(([x,z])=>[x-80,z+90])}],surfaceY:(x,z)=>surfaceY(x+80,z-90),roadEdge:(x,z)=>roadEdge(x+80,z-90)});
  assert(shifted.length===cars.length,'Recentering lost cars');
  for(let i=0;i<cars.length;i++){
    const car=cars[i];assert(Math.abs(car.x-80-shifted[i].x)<1e-8&&Math.abs(car.z+90-shifted[i].z)<1e-8,'Recentering moved a car');
    assert(car.footprint.every(([x,z])=>x>-30&&x<30&&z>-20&&z<20&&roadEdge(x,z)>.2),'Car blocks circulation or leaves pavement');
    assert(car.wheels.every(w=>w.clearance>=.0149&&w.clearance<.02),'Car does not rest on the sloping pavement');
  }
  const duplicate={...rows[0],id:'duplicate'};
  assert(planParkingRows([rows[0],duplicate],options).length===planParkingRows([rows[0]],options).length,'Overlapping authored rows created overlapping cars');
  const models=buildMappedParking(rows,options);models.updateMatrixWorld(true);
  const foldedGrade=(x,z)=>.08*Math.abs(x)+.03*z;
  const paint=buildParkingPaint(rows.map(r=>({...r,paint:true})),{lots:[lot],surfaceY:foldedGrade,
    grid:{xs:[-30,0,30],zs:[-20,0,20]}});
  assert(paint.children.length>20,'Surveyed stall paint missing');
  for(const stripe of paint.children) {
    const positions=stripe.geometry.attributes.position,normals=stripe.geometry.attributes.normal;
    for(let i=0;i<positions.count;i++) {
      assert(Math.abs(positions.getY(i)-foldedGrade(positions.getX(i),positions.getZ(i))-.025)<1e-5,'Paint detached from paved grade');
      assert(normals.getY(i)>0,'Paint faces away from overhead camera');
    }
  }
  for(const car of models.children){
    assert(car.userData.streamKind==='landmark','Cars need individual streaming sectors');
    assert(coarseModel(car).children.length===6,'Coarse view lost the existing car silhouette');
    const p=car.userData.parking,q=new THREE.Quaternion().fromArray(p.quaternion);
    for(const [side,end] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
      const contact=new THREE.Vector3(side*.82,0,end*1.15).multiplyScalar(1.3).applyQuaternion(q).add(car.position);
      assert(contact.y-surfaceY(contact.x,contact.z)>.0149,'A wheel penetrates the pavement');
    }
  }
  return{cars:cars.length,wheelContacts:cars.length*4};
}
