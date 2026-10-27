import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {blinkEnvelope,appearanceFrame,lidState,lidBounds,pupilVisibility,skinZ,EYE_RADIUS} from '../src/eyelid-model.mjs';
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
