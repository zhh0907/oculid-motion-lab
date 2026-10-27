import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibrary,generatePatients,validateLibrary,mergeLibraries,findPatient,PatientLayer,affectedChannels,CAPACITY_RANGE} from '../patient-model.mjs';
import {desired} from '../engine.js';

const bank=()=>createLibrary('test-library');
const batch=(options={})=>generatePatients(bank(),{count:30,template:'conjugate',side:'left',seed:'fixed-test',...options});
const patient=(template='conjugate',side='left',capacity=.25)=>{
  const p=batch({template,side}).patients[0];
  return {...p,capacity,stratum:Math.min(2,Math.floor((capacity-CAPACITY_RANGE[0])/(CAPACITY_RANGE[1]-CAPACITY_RANGE[0])*3))};
};
function settle(p, reference, steps=1500){const layer=new PatientLayer(p);let out;for(let i=0;i<steps;i++)out=layer.step(reference,.004);return out;}

test('30 patients cover three strata equally, are seeded, frozen and have unique IDs without scores',()=>{
  const a=batch(),b=batch();assert.deepEqual(a,b);
  assert.equal(new Set(a.patients.map(p=>p.id)).size,30);
  assert.deepEqual([0,1,2].map(s=>a.patients.filter(p=>p.stratum===s).length),[10,10,10]);
  assert.ok(a.patients.every(p=>p.capacity>=.12&&p.capacity<=.88&&p.responseScale===1));
  assert.ok(Object.isFrozen(a.patients[0]));assert.ok(!JSON.stringify(a).match(/nihss|score/i));
  assert.notDeepEqual(a,batch({seed:'different'}));
  assert.equal(findPatient(a,'17').id,'P000017');assert.equal(findPatient(a,'p000017').id,'P000017');
  for(const count of [1,2,4,29,31]){const b=batch({count}),counts=[0,1,2].map(s=>b.patients.filter(p=>p.stratum===s).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);}
});
test('append and JSON round trip preserve identities; imports are atomic on conflicts',()=>{
  const a=batch(),b=generatePatients(a,{count:30,template:'abduction',side:'right',seed:'batch-2'});
  assert.deepEqual(b.patients.slice(0,30),a.patients);assert.equal(b.patients[30].id,'P000031');
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(b))),b);
  assert.deepEqual(mergeLibraries(b,a),b);assert.deepEqual(mergeLibraries(createLibrary('new-browser'),b),b);
  const bad=JSON.parse(JSON.stringify(a));bad.patients[0].capacity+=.00001;
  assert.throws(()=>mergeLibraries(a,bad),/Conflicting/);assert.equal(a.patients.length,30);
  assert.throws(()=>mergeLibraries(a,{...a,libraryId:'other'}),/different library/);
  assert.throws(()=>validateLibrary({...a,nextNumber:1}),/next patient/);
  assert.throws(()=>validateLibrary({...a,patients:[a.patients[0],a.patients[0]]}),/Duplicate/);
  assert.throws(()=>validateLibrary({...a,modelVersion:'unknown'}),/version/);
  for(const count of [0,-1,1.5,1001,NaN])assert.throws(()=>batch({count}));
  assert.throws(()=>batch({seed:''}));assert.throws(()=>batch({side:'up'}));
});
test('laterality uses anatomical eyes and signed directions, not display orientation',()=>{
  assert.deepEqual(affectedChannels(patient('conjugate','left')),[[0,-1],[2,-1]]);
  assert.deepEqual(affectedChannels(patient('adduction','left')),[[0,1]]);
  assert.deepEqual(affectedChannels(patient('adduction','right')),[[2,-1]]);
  assert.deepEqual(affectedChannels(patient('abduction','left')),[[0,-1]]);
  assert.deepEqual(affectedChannels(patient('abduction','right')),[[2,1]]);
});
test('reference is exact identity; only affected horizontal axes change',()=>{
  const r=[30,18,28,-12];assert.deepEqual(new PatientLayer().step(r,.004),r);
  const out=settle(patient('adduction','left'),r);
  assert.ok(out[0]<r[0]-10);assert.deepEqual(out.slice(1),r.slice(1));
  const outward=settle(patient('abduction','left'),[-30,18,-28,-12]);
  assert.ok(outward[0]>-20);assert.equal(outward[2],-28);
  assert.ok(Math.abs(settle(patient('abduction','left'),r)[0]-r[0])<1e-8);
});
test('lower capacity causes greater static directional limitation without an angle clamp',()=>{
  const small=settle(patient('conjugate','left',.2),[-30,0,-30,0]);
  const medium=settle(patient('conjugate','left',.5),[-30,0,-30,0]);
  const large=settle(patient('conjugate','left',.8),[-30,0,-30,0]);
  assert.ok(Math.abs(small[0])<Math.abs(medium[0])&&Math.abs(medium[0])<Math.abs(large[0]));
  assert.equal(small[0],small[2]);
  const a=settle(patient(),[-12,0,-12,0]),b=settle(patient(),[-25,0,-25,0]);
  assert.notEqual(a[0],b[0]);
});
test('left/right reflection is symmetric and arbitrary 3D targets remain finite',()=>{
  const left=new PatientLayer(patient('adduction','left')),right=new PatientLayer(patient('adduction','right'));
  const eyes=[[-.032,0,0],[.032,0,0]];
  for(let i=0;i<5000;i++){
    const reference=desired([.45*Math.sin(i*.009),.35*Math.cos(i*.013),.6+.35*Math.sin(i*.005)],eyes);
    const a=left.step(reference,.004),b=right.step([-reference[2],reference[3],-reference[0],reference[1]],.004);
    assert.ok(a.every(Number.isFinite));assert.equal(a[1],reference[1]);assert.equal(a[3],reference[3]);
    assert.ok(Math.abs(a[0]+b[2])<1e-10);assert.ok(Math.abs(a[2]+b[0])<1e-10);
  }
});
test('same patient + same input/state produces identical sequence including resumed exports',()=>{
  const p=patient(),a=new PatientLayer(p),b=new PatientLayer(p),samples=[];
  for(let i=0;i<800;i++)samples.push([25*Math.sin(i*.03),i%11,20*Math.sin(i*.03),-i%7]);
  const first=samples.map(r=>a.step(r,.004));assert.deepEqual(first,samples.map(r=>b.step(r,.004)));
  a.reset();assert.deepEqual(first,samples.map(r=>a.step(r,.004)));
  b.restoreState(JSON.parse(JSON.stringify(a.snapshot())));
  for(const r of samples.slice(0,100))assert.deepEqual(a.step(r,.004),b.step(r,.004));
});
test('state is continuous at target reversals and substepping converges',()=>{
  const p=patient(),layer=new PatientLayer(p);
  let q;for(let i=0;i<500;i++)q=layer.step([25,0,25,0],.004);
  const prev=q[0],now=layer.step([0,0,0,0],.004)[0];
  assert.ok(now>0&&now<prev,'directional impairment affects the return from right, too');
  const a=new PatientLayer(p),b=new PatientLayer(p);
  for(let i=0;i<200;i++){
    const r=[-30,2,-28,3];const x=a.step(r,.004);let y;for(let j=0;j<4;j++)y=b.step(r,.001);
    assert.ok(Math.abs(x[0]-y[0])<.15);
  }
  for(const dt of [0,-1,.2,NaN])assert.throws(()=>layer.step([0,0,0,0],dt));
  assert.throws(()=>layer.step([NaN,0,0,0],.004));
});
