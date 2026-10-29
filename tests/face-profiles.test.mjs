import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {morphHeadPoint,FACE_TYPES} from '../src/face-profiles.mjs';
import {Simulation} from '../src/simulation.mjs';

test('face presets alter facial volume while preserving the protected eye openings',()=>{
  assert.deepEqual(FACE_TYPES,['male','female']);
  const jaw=[.057,-.080,.005],nose=[0,-.038,.036];
  assert.deepEqual(morphHeadPoint(...jaw,'male'),jaw);
  assert.ok(morphHeadPoint(...jaw,'female')[0]<jaw[0]-.006);
  assert.ok(morphHeadPoint(...nose,'female')[2]<nose[2]-.002);
  for(const cx of [-.032,.032])for(let i=0;i<64;i++){
    const theta=i/64*Math.PI*2,p=[cx+.014*Math.cos(theta),.010*Math.sin(theta),.008];
    assert.deepEqual(morphHeadPoint(...p,'female'),p);
  }
});

test('switching face shape preserves the complete motion sequence and exports its timeline',()=>{
  const bundle=JSON.parse(fs.readFileSync(new URL('../models-selected.json',import.meta.url))),a=new Simulation(bundle),b=new Simulation(bundle);
  for(const sim of [a,b])sim.select({pattern:'adduction'});
  const patient=a.patient;
  for(let i=0;i<600;i++){
    if(i===100||i===400)a.setFaceType('female');if(i===250)a.setFaceType('male');
    const target=[.4*Math.sin(i*.03),.13*Math.cos(i*.07),.6+.15*Math.sin(i*.02)];
    assert.deepEqual(a.step(target),b.step(target));assert.equal(a.patient,patient);
  }
  const run=a.export();assert.deepEqual(run.faceChanges.map(e=>e.faceType),['male','female','male','female']);
  assert.equal(run.appearance.faceType,'female');assert.equal(run.faceChanges[0].time,0);
  assert.ok(Math.abs(run.faceChanges[1].time-.4)<1e-10);assert.equal(run.samples.length,600);
  assert.throws(()=>a.setFaceType('unknown'),/Unknown/);a.reset();assert.deepEqual(a.faceChanges,[{time:0,faceType:'female'}]);
});
