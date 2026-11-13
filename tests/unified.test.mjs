import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MotionSession,LearnedModel,PatientLayer,createLibrary,generatePatients} from '../src/index.mjs';
import {LearnedModel as LegacyModel} from '../engine.js';
import {PatientLayer as LegacyPatient} from '../patient-model.mjs';
import {DEMO_CASES} from '../demo-presets.mjs';
import {planMigration,commitMigration,MIGRATION_KEYS} from '../src/migration.mjs';
const bundle=JSON.parse(fs.readFileSync(new URL('../models-selected.json',import.meta.url)));
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const bank=()=>generatePatients(createLibrary('legacy-test'),{count:3,template:'adduction',side:'left',seed:'merge'});
const saved=library=>JSON.stringify({library,activeId:library.patients[0].id});

test('public library imports without browser globals; old paths expose the same classes',()=>{
  assert.equal(LearnedModel,LegacyModel);assert.equal(PatientLayer,LegacyPatient);
  assert.equal(typeof globalThis.document,'undefined');
});
test('headless public session matches all 3,600 independently generated upstream samples',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/upstream-golden.json',import.meta.url)));let count=0;
  for(const run of fixture.runs){
    const sim=new MotionSession({model:run.model==='ideal'?null:bundle.models[run.model],patient:DEMO_CASES.find(c=>c.key===run.pattern)?.patient??null});
    for(const row of run.samples){assert.deepEqual(sim.step(row.target).angles,row.angles);count++;}
  }
  assert.equal(count,3600);
});
test('headless session reset reproduces and reacquisition preserves patient plant/time',()=>{
  const sim=new MotionSession({model:bundle.models.gru_expanded_520,patient:bank().patients[0]});
  const run=()=>Array.from({length:60},(_,i)=>sim.step([Math.sin(i/20)*.4,.1,.7]));
  const first=run();sim.reset();assert.deepEqual(run(),first);
  const state=sim.layer.snapshot(),time=sim.time;sim.reacquire();assert.equal(sim.time,time);assert.deepEqual(sim.layer.snapshot(),state);assert.equal(sim.previous,null);
});
test('patient migration is reviewed, lossless, idempotent and leaves the source intact',()=>{
  const s=storage(),k=MIGRATION_KEYS.patients,raw=saved(bank());s.setItem(k.from,raw);
  const plan=planMigration(s,'patients');assert.equal(s.getItem(k.to),null);commitMigration(s,plan);
  assert.equal(s.getItem(k.from),raw);assert.deepEqual(JSON.parse(s.getItem(k.to)),JSON.parse(raw));
  commitMigration(s,planMigration(s,'patients'));assert.equal(JSON.parse(s.getItem(k.to)).library.patients.length,3);
});
test('migration refuses different libraries, conflicting IDs, corrupt data and stale snapshots without overwriting',()=>{
  const s=storage(),k=MIGRATION_KEYS.patients,original=saved(bank());s.setItem(k.from,original);
  s.setItem(k.to,saved({...bank(),libraryId:'different'}));let before=s.getItem(k.to);assert.throws(()=>planMigration(s,'patients'),/different library/);assert.equal(s.getItem(k.to),before);
  const changed=structuredClone(bank());changed.patients[0].capacity+=.00001;s.setItem(k.to,saved(changed));before=s.getItem(k.to);assert.throws(()=>planMigration(s,'patients'),/Conflicting/);assert.equal(s.getItem(k.to),before);
  s.setItem(k.to,'broken JSON');assert.throws(()=>planMigration(s,'patients'));assert.equal(s.getItem(k.to),'broken JSON');
  s.setItem(k.to,original);const plan=planMigration(s,'patients');s.setItem(k.to,JSON.stringify({...JSON.parse(original),activeId:null}));before=s.getItem(k.to);assert.throws(()=>commitMigration(s,plan),/changed in another tab/);assert.equal(s.getItem(k.to),before);
  s.setItem(k.from,'broken source');assert.throws(()=>planMigration(s,'patients'));assert.equal(s.getItem(k.from),'broken source');
});
test('calibration import preserves measurements and requires rebinding; existing calibration survives',()=>{
  const s=storage(),k=MIGRATION_KEYS.calibration;
  const profile={version:1,type:'screen-camera',screen:{widthM:.53,heightM:.3},camera:{x:0,y:.16,z:0,yaw:0,pitch:0,roll:0},intrinsics:{width:640,height:480,fx:500,fy:500,cx:320,cy:240,distortion:[0,0,0,0,0]},targetDepthM:.7};
  const raw=JSON.stringify({profile,enabled:true,deviceId:'old-camera',deviceLabel:'Old'});s.setItem(k.from,raw);
  commitMigration(s,planMigration(s,'calibration'));assert.deepEqual(JSON.parse(s.getItem(k.to)),{profile,enabled:false,deviceId:'',deviceLabel:''});assert.equal(s.getItem(k.from),raw);
  const before=s.getItem(k.to);assert.throws(()=>planMigration(s,'calibration'),/already exists/);assert.equal(s.getItem(k.to),before);
});
test('portable library import and failed storage writes never remove legacy data',()=>{
  const s=storage(),k=MIGRATION_KEYS.patients;commitMigration(s,planMigration(s,'patients',JSON.stringify(bank())));assert.deepEqual(JSON.parse(s.getItem(k.to)).library,bank());
  const old=saved(bank());const broken={getItem:key=>key===k.from?old:null,setItem(){throw Error('quota');}};
  assert.throws(()=>commitMigration(broken,planMigration(broken,'patients')),/quota/);assert.equal(broken.getItem(k.from),old);
});
