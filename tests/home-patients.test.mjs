import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation} from '../src/simulation.mjs';
import {PatientBank,PATIENT_STORAGE_KEY} from '../src/patient-bank.mjs';
import {TrajectoryHistory,traceWindow} from '../src/trajectory-data.mjs';
import {createLibrary,generatePatients,PatientLayer,affectedChannels} from '../patient-model.mjs';
const bundle=JSON.parse(fs.readFileSync(new URL('../models-selected.json',import.meta.url)));
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const options={count:30,template:'adduction',side:'right',seed:'integration-seed'};

test('all six obvious examples affect their intended channels and have distinct identities',()=>{
  const ids=new Set();
  for(const template of ['conjugate','adduction','abduction'])for(const side of ['left','right']){
    const sim=new Simulation(bundle);sim.select({model:'ideal',pattern:template,side});ids.add(sim.patient.id);
    const sign=affectedChannels(sim.patient)[0][1],target=[sign*.7,.15,.7];
    for(let i=0;i<500;i++)sim.step(target);
    const affected=affectedChannels(sim.patient).map(([axis])=>axis);
    sim.current.angles.forEach((v,i)=>{if(affected.includes(i))assert.ok(Math.abs(v)<6);else assert.equal(v,sim.current.baseline[i]);});
  }
  assert.equal(ids.size,6);
});

test('saved patients remain fixed across arbitrary paths, reset and controller changes; export reconstructs',()=>{
  const library=generatePatients(createLibrary('shared-bank'),options),p=library.patients[16],sim=new Simulation(bundle);
  sim.selectPatient(p,library.libraryId);const targets=Array.from({length:400},(_,i)=>[.4*Math.sin(i*.03),.2*Math.cos(i*.05),.5+.2*Math.sin(i*.01)]);
  const first=targets.map(t=>[...sim.step(t).angles]);
  sim.reset();assert.deepEqual(sim.patient,p);assert.ok(Object.isFrozen(sim.patient));assert.deepEqual(targets.map(t=>sim.step(t).angles),first);
  const exported=sim.export(),layer=new PatientLayer(exported.patient);layer.restoreState(exported.patientInitialState);
  for(const r of exported.samples)assert.deepEqual(layer.step(r.baseline,1/exported.fps),r.angles);
  assert.equal(exported.patientLibraryId,'shared-bank');assert.equal(exported.pattern,'patient');assert.ok(!('score' in exported.patient));
  sim.select({model:'ideal'});assert.deepEqual(sim.patient,p);assert.equal(sim.libraryId,'shared-bank');
  sim.select({pattern:'normal'});assert.equal(sim.patient,null);assert.equal(sim.libraryId,null);
});

test('homepage bank restores workspace storage, appends immutable profiles and imports legacy-format libraries',()=>{
  const storage=memory(),a=new PatientBank(storage,'bank');a.generate(options);a.activate('17');
  const saved=JSON.parse(storage.getItem(PATIENT_STORAGE_KEY));assert.equal(saved.activeId,'P000017');
  const b=new PatientBank(storage,'new-browser-id');assert.deepEqual(b.active,a.active);assert.deepEqual(b.library,a.library);
  const old=b.library.patients;b.generate({...options,seed:'second',side:'left'});assert.deepEqual(b.library.patients.slice(0,30),old);
  const c=new PatientBank(memory(),'empty');c.import(JSON.parse(JSON.stringify(b.library)));c.activate('17');assert.deepEqual(c.active,a.active);
  const before=c.library,conflict=JSON.parse(JSON.stringify(before));conflict.patients[0].capacity+=.00001;
  assert.throws(()=>c.import(conflict),/Conflicting/);assert.equal(c.library,before);
  assert.throws(()=>c.activate('999999'),/找不到/);assert.deepEqual(c.active,a.active);
});

test('unavailable, corrupt and stale storage preserve recoverable patient data',()=>{
  const storage=memory(),a=new PatientBank(storage,'bank');a.generate(options);
  const stale=new PatientBank(storage,'stale');a.generate({...options,seed:'next'});const saved=storage.getItem(PATIENT_STORAGE_KEY);
  stale.generate({...options,seed:'different'});assert.equal(storage.getItem(PATIENT_STORAGE_KEY),saved);assert.match(stale.warning,/另一页面/);
  storage.setItem(PATIENT_STORAGE_KEY,'{broken');const corrupt=new PatientBank(storage,'fallback');assert.equal(corrupt.corrupt,true);
  assert.throws(()=>corrupt.generate(options));corrupt.activate(null);assert.equal(storage.getItem(PATIENT_STORAGE_KEY),'{broken');
  corrupt.import(a.library);assert.equal(corrupt.corrupt,false);assert.deepEqual(corrupt.library,a.library);
  const unavailable=new PatientBank({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},'volatile');unavailable.generate(options);assert.equal(unavailable.library.patients.length,30);assert.ok(unavailable.warning);
});

test('trace is bounded, copies samples, separates reacquisition and rolls after 120 seconds',()=>{
  const trace=new TrajectoryHistory(),angles=[1,2,3,4];trace.push({time:0,angles,baseline:angles});angles[0]=99;assert.equal(trace.samples()[0].angles[0],1);
  trace.markGap();trace.push({time:.004,angles,baseline:angles});assert.notEqual(trace.samples()[0].segment,trace.samples()[1].segment);
  for(let i=2;i<40000;i++)trace.push({time:i/250,angles,baseline:angles});
  assert.ok(trace.length<=1008);const window=traceWindow(trace.samples());assert.ok(window.end>159);assert.ok(window.rows[0].time>=window.start);assert.ok(window.rows.length>990);
  trace.clear();assert.equal(trace.length,0);assert.equal(trace.samples().length,0);
});

test('live trace continues after export fills, and clearing it cannot reset the patient or recording',()=>{
  const sim=new Simulation(bundle);sim.select({model:'ideal',pattern:'conjugate',side:'right'});
  for(let i=0;i<30200;i++)sim.step([.3,.1,.7]);
  assert.equal(sim.rows.length,30000);assert.ok(sim.trace.lastTime>120);assert.ok(sim.trace.samples().at(-1).time>sim.rows.at(-1).time);
  const state=sim.layer.snapshot(),time=sim.time;sim.trace.clear();assert.deepEqual(sim.layer.snapshot(),state);assert.equal(sim.time,time);assert.equal(sim.rows.length,30000);
  sim.reacquire();sim.step([-.2,.1,.7]);assert.equal(sim.trace.length,1);
});
