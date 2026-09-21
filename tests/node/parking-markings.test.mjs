import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {planParkingMarkings} from "../../src/parking-markings.js";
import {shiftLandmark} from "../../src/landmark-frame.js";
const lot={id:1,pts:[[-20,-10],[20,-10],[20,10],[-20,10]]};
const row={id:"test",kind:"parking-row",parkingLotId:1,pts:[[-6,0],[6,0]],spacing:3,depth:5.4,paint:true};
test("paint marks every bay, including unoccupied stalls, and requires opt-in",()=>{
 const lines=planParkingMarkings([{...row,occupancy:0}],{lots:[lot]});
 assert.equal(lines.length,5);
 assert.deepEqual(lines[0].pts,[[-6,-2.7],[-6,2.7]]);
 assert.deepEqual(lines.at(-1).pts,[[6,-2.7],[6,2.7]]);
 const backed=planParkingMarkings([{...row,backLine:true,face:-1}],{lots:[lot]});
 assert.equal(backed.length,6);
 assert.deepEqual(backed.at(-1).pts,[[-6,-2.7],[6,-2.7]]);
 assert.equal(planParkingMarkings([{...row,paint:false}],{lots:[lot]}).length,0);
 assert.equal(planParkingMarkings([row],{lots:[]}).length,0);
});
test("stripes stay out of access roads and islands, including their edges",()=>{
 assert.equal(planParkingMarkings([row],{lots:[lot],roadEdge:(x,z)=>Math.abs(x)-1}).length,4);
 const island=[[-1,-1],[1,-1],[1,1],[-1,1]];
 assert.equal(planParkingMarkings([row],{lots:[{...lot,holes:[island]}]}).length,4);
 const nearEdge={...row,pts:[[-6,7.4],[6,7.4]]};
 assert.equal(planParkingMarkings([nearEdge],{lots:[lot]}).length,0);
});
test("angled stripes follow car orientation and survive preview recentering",()=>{
 const angled={...row,yawOffset:Math.PI/6};
 const lines=planParkingMarkings([angled],{lots:[lot]});
 assert.ok(Math.abs(lines[0].pts[1][0]-lines[0].pts[0][0]-2.7)<1e-9);
 const shifted=planParkingMarkings([shiftLandmark(angled,90,-45)],{lots:[{...lot,pts:lot.pts.map(([x,z])=>[x-90,z+45])}]});
 for(let i=0;i<lines.length;i++)for(let j=0;j<2;j++){
  assert.ok(Math.abs(shifted[i].pts[j][0]+90-lines[i].pts[j][0])<1e-9);
  assert.ok(Math.abs(shifted[i].pts[j][1]-45-lines[i].pts[j][1])<1e-9);
 }
});
test("all requested Avon lots have substantial surveyed paint coverage",()=>{
 // Live previews build authored source without changing the shared generated scene.
 const site=JSON.parse(execFileSync(process.env.PIPELINE_PYTHON || "python3", ["-B", "-c",
  "import json; from tinytown.paths import SitePaths; from tinytown.site import build; print(json.dumps(build(SitePaths('avon-extended'), write=False)))"
 ], {cwd:fileURLToPath(new URL("../../",import.meta.url)),maxBuffer:32*1024*1024}));
 const rows=site.landmarks.filter(r=>String(r.id).startsWith("avon-parking-"));
 const lines=planParkingMarkings(rows,{lots:site.areas.filter(a=>a.kind==="parking")});
 for(const id of [248362379,249547654,248362381,"avon-inn-parking",248362384]) {
  assert.ok(lines.filter(l=>l.parkingLotId===id).length>=15,`Missing paint for ${id}`);
 }
 for(const row of rows)assert.ok(lines.some(l=>l.rowId===row.id),`Row outside its lot: ${row.id}`);
});
