import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEMO_CASES,DEMO_MODEL,DEMO_FPS,DEMO_PERIOD,DemoSimulation,demoTarget} from '../demo-presets.mjs';
import {affectedChannels} from '../patient-model.mjs';
const model=JSON.parse(fs.readFileSync(new URL('../models-selected.json',import.meta.url))).models[DEMO_MODEL];

test('Exactly three immutable, strongly limited, anatomically distinct cases; no score labels',()=>{
  assert.deepEqual(DEMO_CASES.map(c=>c.key),['conjugate','adduction','abduction']);
  assert.equal(new Set(DEMO_CASES.map(c=>c.patient.id)).size,3);
  for(const c of DEMO_CASES){assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.patient));assert.equal(c.patient.capacity,.12);assert.equal(c.patient.side,'left');assert.equal('score' in c.patient,false);}
  assert.deepEqual(DEMO_CASES.map(c=>affectedChannels(c.patient)),[[[0,-1],[2,-1]],[[0,1]],[[0,-1]]]);
});

test('Slow auto target is continuous through holds and cycle boundaries',()=>{
  let previous=demoTarget(0).target,maxSpeed=0;
  for(let i=1;i<=DEMO_PERIOD*DEMO_FPS*2;i++){
    const {target}=demoTarget(i/DEMO_FPS);assert.equal(target[1],0);assert.equal(target[2],.7);
    maxSpeed=Math.max(maxSpeed,Math.abs(target[0]-previous[0])*DEMO_FPS);previous=target;
    assert.ok(Math.abs(target[0])<=.36+1e-12);
  }
  assert.ok(maxSpeed<.338);assert.deepEqual(demoTarget(0),demoTarget(DEMO_PERIOD));
  assert.throws(()=>demoTarget(-1));
});

test('All cases are clearly abnormal at the intended hold, with preserved other channels and continuous output',()=>{
  const measurements=[];
  for(const c of DEMO_CASES){
    const sim=new DemoSimulation(model);sim.select(c.key);let previous=null,peakSpeed=0,left,right;
    for(let i=0;i<DEMO_PERIOD*DEMO_FPS;i++){
      const frame=sim.step(demoTarget(i/DEMO_FPS).target);
      assert.ok(frame.output.every(Number.isFinite));
      const affected=affectedChannels(c.patient).map(([index])=>index);
      for(let j=0;j<4;j++)if(!affected.includes(j))assert.equal(frame.output[j],frame.baseline[j]);
      if(previous)peakSpeed=Math.max(peakSpeed,...frame.output.map((v,j)=>Math.abs(v-previous[j])*DEMO_FPS));
      previous=frame.output;
      if(i===Math.round(4.5*DEMO_FPS))left=frame;
      if(i===Math.round(11*DEMO_FPS))right=frame;
    }
    const frame=c.key==='adduction'?right:left,other=c.key==='adduction'?left:right;
    for(const [index]of affectedChannels(c.patient)){
      assert.ok(Math.abs(frame.baseline[index]-frame.output[index])>15,`${c.key} is not obvious enough`);
      assert.ok(Math.abs(frame.output[index])<=5.41,`${c.key} impaired hold`);
      assert.ok(Math.abs(other.output[index]-other.baseline[index])<.1,`${c.key} reverse hold`);
    }
    assert.ok(peakSpeed<120,`Unexpected discontinuity in ${c.key}: ${peakSpeed}`);
    measurements.push({case:c.key,reference:frame.baseline.filter((_,i)=>i%2===0),output:frame.output.filter((_,i)=>i%2===0),maxSpeed:peakSpeed});
  }
  console.log('Demo measurements:',JSON.stringify(measurements));
});

test('Re-selecting a fixed case reproduces arbitrary 3D inputs, without altering the case parameters',()=>{
  const sim=new DemoSimulation(model);
  for(const c of DEMO_CASES){
    const run=()=>Array.from({length:500},(_,i)=>sim.step([.3*Math.sin(i/80),.18*Math.cos(i/100),.6+.2*Math.sin(i/120)]).output);
    sim.select(c.key);const first=run();sim.select(c.key);assert.deepEqual(run(),first);assert.equal(sim.case,c);
  }
  assert.throws(()=>sim.select('normal'));assert.throws(()=>sim.step([0,0,-1]));
});
