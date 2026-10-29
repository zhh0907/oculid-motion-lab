import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {blinkEnvelope,blinkAt,appearanceFrame,lidState,lidBounds,pupilVisibility,skinZ,EYE_RADIUS,EyelidDynamics,rotateEyePoint,insideCanthus} from '../src/eyelid-model.mjs';
import {lidSurface,faceSurface,faceNormal,canthusSurface} from '../src/periocular-shape.mjs';
import {DEFAULT_RANGE,angularTarget,pointerTarget} from '../src/target-range.mjs';
import {lookAngles} from '../engine.js';
import {Simulation,targetAt} from '../src/simulation.mjs';
const bundle=JSON.parse(fs.readFileSync(new URL('../models-selected.json',import.meta.url)));

test('all motion, camera, calibration and weight files match upstream SHA256',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../docs/upstream-manifest.json',import.meta.url)));
  for(const [name,hash]of Object.entries(manifest.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex'),hash,name);
  for(const [name,change]of Object.entries(manifest.storageNamespaceOnly)){
    const bytes=fs.readFileSync(new URL('../'+name,import.meta.url)).toString().replaceAll(change.to,change.from);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),change.upstreamSha256,name+' changes only its storage namespace');
  }
});
test('blink has a complete closure interval and recovers continuously',()=>{
  assert.equal(blinkEnvelope(-1),0);assert.equal(blinkEnvelope(0),0);assert.equal(blinkEnvelope(.1),1);assert.equal(blinkEnvelope(.32),0);
  for(let t=0;t<.5;t+=.001){const v=blinkEnvelope(t);assert.ok(v>=0&&v<=1);assert.ok(Math.abs(v-blinkEnvelope(t+.001))<.025);}
});
test('lids never invert; zero openness closes under every gaze and follow setting',()=>{
  for(let pitch=-45;pitch<=45;pitch+=5)for(const openness of [0,.3,1,1.4])for(const follow of [0,1,1.5])for(const closure of [0,.5,1]){
    const state=lidState(pitch,closure,{openness,follow,ptosisLeft:.25});
    for(let x=-.0116;x<=.0116;x+=.001){const b=lidBounds(x,state);assert.ok(b.upper>=b.lower-1e-12);if(closure===1||openness===0)assert.equal(b.upper,b.lower);}
  }
});
test('fully closed pupil is invisible and all open front pupils are visible',()=>{
  assert.equal(pupilVisibility(0,0,lidState(0,0),4),1);
  for(const yaw of [-40,0,40])for(const pitch of [-40,0,40])assert.equal(pupilVisibility(yaw,pitch,lidState(pitch,1),8),0);
});
test('eyelids track pitch; independent lid coverage affects only selected eye',()=>{
  assert.ok(lidState(25).upper>lidState(-25).upper);
  const a=appearanceFrame([0,0,0,0],0,{ptosisLeft:1,blink:false});assert.ok(a[0].upper<a[1].upper);assert.ok(a[0].pupilVisibility<a[1].pupilVisibility);
});
test('contact geometry stays in front of the globe',()=>{
  for(let x=-.0116;x<.0116;x+=.0005)for(let y=-.011;y<.011;y+=.0005)if(x*x+y*y<EYE_RADIUS**2)assert.ok(skinZ(x,y)>Math.sqrt(EYE_RADIUS**2-x*x-y*y));
});
test('blinking and lid appearance cannot alter controller trajectories',()=>{
  const a=new Simulation(bundle),b=new Simulation(bundle);b.appearance={...b.appearance,openness:.2,ptosisLeft:1,follow:1.5};
  for(let i=0;i<800;i++){if(i===100)b.blink();const p=targetAt(i/250,'circle');assert.deepEqual(a.step(p).angles,b.step(p).angles);}
});
test('upstream-generated golden angles match exactly for both GRUs, ideal, and all 4 patterns',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/upstream-golden.json',import.meta.url)));
  for(const run of fixture.runs){const sim=new Simulation(bundle);sim.select({model:run.model,pattern:run.pattern});for(const row of run.samples)assert.deepEqual(sim.step(row.target).angles,row.angles,run.model+'/'+run.pattern);}
});
test('reset, reacquisition, and exports preserve time and appearance provenance',()=>{
  const sim=new Simulation(bundle);sim.step([.1,0,.7]);sim.blink();sim.step([.1,0,.7]);const data=sim.export({source:'camera'});
  assert.equal(data.samples.length,2);assert.equal(data.samples[1].time,.004);assert.deepEqual(data.manualBlinks,[0]);assert.equal(data.settings.source,'camera');
  const held=[...sim.current.angles];sim.reacquire();assert.deepEqual(sim.current.angles,held);assert.equal(sim.previous,null);
  sim.reset();assert.equal(sim.time,0);assert.equal(sim.rows.length,0);assert.equal(sim.manualBlinks.length,0);
});
test('automatic blinks vary reproducibly; closing is faster than reopening',()=>{
  const events=[];let old=0;
  for(let t=0;t<35;t+=.004){const b=blinkAt(t);assert.deepEqual(b,blinkAt(t));if(b.closure>0&&old===0)events.push(t);old=b.closure;}
  assert.ok(events.length>5);const gaps=events.slice(1).map((v,i)=>Math.round((v-events[i])*100));assert.ok(new Set(gaps).size>3);
  const halfClose=.0425,halfOpen=.115+.205/2;assert.ok(Math.abs(blinkEnvelope(halfClose)-.5)<1e-12);assert.ok(Math.abs(blinkEnvelope(halfOpen)-.5)<1e-12);
});
test('gaze follow lags asymmetrically and does not advance while paused',()=>{
  const up=new EyelidDynamics(),down=new EyelidDynamics();up.sample([0,0,0,0],0);down.sample([0,0,0,0],0);
  const a=up.sample([0,30,0,30],.04,{blink:false}),b=down.sample([0,-30,0,-30],.04,{blink:false});
  assert.ok(a[0].gazePitch>0&&a[0].gazePitch<30);assert.ok(Math.abs(b[0].gazePitch)>a[0].gazePitch);
  assert.equal(a[0].globePitch,30);assert.deepEqual(up.sample([0,30,0,30],.04,{blink:false}),a);
  up.sample([0,-10,0,-10],0);assert.equal(up.followAngles[1],-10);up.reset();assert.equal(up.time,null);
});
test('nasal slide mirrors, corners stay anchored, and wide-gaze closure has no aperture',()=>{
  for(const yaw of [-60,0,60])for(const pitch of [-50,0,40])for(const closure of [0,.5,1]){
    const left=lidState(pitch,closure,{},0,yaw),right=lidState(pitch,closure,{},1,-yaw);
    assert.equal(left.nasalSweep,-right.nasalSweep);
    for(let i=0;i<=100;i++){const x=left.halfWidth*(i/50-1),a=lidBounds(x,left),b=lidBounds(-x,right);assert.ok(a.upper>=a.lower);assert.ok(Math.abs(a.upper-b.upper)<1e-12);if(closure===1)assert.equal(a.upper,a.lower);}
    assert.equal(lidBounds(left.halfWidth,left).upper,-.00055);
  }
});
test('periocular surface is finite, matches the face boundary and clears the rotating iris',()=>{
  for(const yaw of [-55,0,55])for(const pitch of [-50,0,40])for(const closure of [0,1]){
    const state=lidState(pitch,closure,{},0,yaw);
    for(let i=0;i<=64;i++)for(const q of [0,.1,.3,.7,1]){const p=lidSurface(i/64*2*Math.PI,q,state);assert.ok(p.every(Number.isFinite));if(q===1)assert.ok(Math.abs(p[2]-faceSurface(p[0]-.032,p[1]))<1e-7);}
    for(let i=0;i<32;i++)for(const r of [0,.003,.0057]){const a=i/32*2*Math.PI,p=rotateEyePoint([r*Math.cos(a),r*Math.sin(a),Math.sqrt(.01255**2-r*r)],yaw,pitch);assert.ok(skinZ(p[0],p[1],yaw,pitch)>p[2]);}
  }
  assert.ok(Math.abs(Math.hypot(...faceNormal(.03,.02))-1)<1e-12);
});
test('expanded targets reach independent up/down excursions without multiplying output angles',()=>{
  assert.deepEqual(lookAngles(angularTarget(42,30,.7),[0,0,0]).map(v=>Math.round(v)),[42,30]);
  assert.deepEqual(lookAngles(pointerTarget(-1,-1,.7),[0,0,0]).map(v=>Math.round(v)),[-42,-42]);
  assert.ok(Math.abs(lookAngles(targetAt(4,'horizontal',.7,DEFAULT_RANGE),[0,0,0])[0]+42)<1e-12);
  assert.ok(Math.abs(lookAngles(targetAt(Math.PI/2/.9,'vertical',.7,DEFAULT_RANGE),[0,0,0])[1]-30)<1e-12);
  assert.ok(Math.abs(lookAngles(targetAt(3*Math.PI/2/.9,'vertical',.7,DEFAULT_RANGE),[0,0,0])[1]+42)<1e-12);
  const sim=new Simulation(bundle);sim.select({model:'ideal'});for(const yaw of [-50,50])assert.deepEqual(sim.step(angularTarget(yaw,30,.7)).angles,sim.current.ideal);
  assert.ok(Math.abs(lookAngles(targetAt(4,'horizontal'),[0,0,0])[0])<28);
});

test('corner tissue stays inside the aperture, joins both lids and mirrors in the gaze plane',()=>{
  for(const yaw of [-55,0,55])for(const pitch of [-50,0,40])for(const closure of [0,.5,1])for(const nasal of [false,true]){
    const left=lidState(pitch,closure,{},0,yaw),right=lidState(pitch,closure,{},1,-yaw);
    for(let i=0;i<=12;i++)for(let j=0;j<=12;j++){
      const u=i/12,v=j/12,a=canthusSurface(u,v,left,nasal),b=canthusSurface(u,v,right,nasal),bounds=lidBounds(a[0],left);
      assert.ok(a.every(Number.isFinite));assert.ok(b.every(Number.isFinite));assert.ok(Math.abs(a[0]+b[0])<1e-12);assert.ok(Math.abs(a[1]-b[1])<1e-12);
      assert.ok(a[1]>=bounds.lower-1e-12&&a[1]<=bounds.upper+1e-12);
      // The scan is naturally asymmetric in depth. Each side must join its own
      // face/lid surface, while the 2D aperture and gaze convention stay mirrored.
      if(j===0||j===12)for(const [point,state]of [[a,left],[b,right]]){const theta=Math.acos(point[0]/state.halfWidth)*(j===0?-1:1),edge=lidSurface(theta,0,state);assert.ok(Math.abs(point[2]-edge[2])<.000020);}
      if(closure===1)assert.ok(Math.abs(a[1]-bounds.lower)<1e-12);
      if(u>.1&&u<.9&&v>.1&&v<.9&&closure<1)assert.equal(insideCanthus(a[0],a[1],left),true);
    }
  }
  assert.equal(insideCanthus(0,0,lidState(0)),false);
  assert.equal(pupilVisibility(0,0,lidState(0),4),1);
});
test('wider targets preserve limited cases and untouched motion channels',()=>{
  for(const pattern of ['conjugate','adduction','abduction']){
    const sim=new Simulation(bundle);sim.select({model:'ideal',pattern});const target=angularTarget(pattern==='adduction'?48:-48,25,.7);
    for(let i=0;i<1000;i++)sim.step(target);const {angles,baseline}=sim.current;
    assert.ok(Math.abs(angles[0])<6);assert.ok(Math.abs(baseline[0])>45);assert.equal(angles[1],baseline[1]);assert.equal(angles[3],baseline[3]);if(pattern!=='conjugate')assert.equal(angles[2],baseline[2]);
  }
});
