// Phenomenological horizontal impairment candidates, NOT a diagnostic model.
export const MODEL_VERSION = 'horizontal-capacity-v1';
export const LIBRARY_SCHEMA = 'gaze-patients-v1';
export const TEMPLATES = Object.freeze(['conjugate', 'adduction', 'abduction']);
export const CAPACITY_RANGE = Object.freeze([0.12, 0.88]);
export const MAX_PATIENTS = 5000;
export const PLANT = Object.freeze({tauSeconds: 0.12, feedback: 2, driveDegrees: 45, maxStepSeconds: 1 / 500});

function assert(ok, message) { if (!ok) throw new Error(message); }
function exactKeys(value, keys, name) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `Invalid ${name}.`);
  assert(Object.keys(value).sort().join(',') === [...keys].sort().join(','), `Unexpected fields in ${name}.`);
}
export function validatePatient(p) {
  exactKeys(p, ['id', 'modelVersion', 'template', 'side', 'capacity', 'responseScale', 'batchSeed', 'stratum'], 'patient');
  assert(/^P\d{6}$/.test(p.id) && Number(p.id.slice(1)) >= 1, 'Invalid patient ID.');
  assert(p.modelVersion === MODEL_VERSION, 'Unsupported patient model version.');
  assert(TEMPLATES.includes(p.template) && ['left', 'right'].includes(p.side), 'Invalid template or side.');
  assert(Number.isFinite(p.capacity) && p.capacity >= CAPACITY_RANGE[0] && p.capacity <= CAPACITY_RANGE[1], 'Capacity is outside this model’s exploration range.');
  assert(p.responseScale === 1, 'This version fixes responseScale at 1.');
  assert(typeof p.batchSeed === 'string' && p.batchSeed.length > 0 && p.batchSeed.length <= 100, 'Invalid batch seed.');
  assert(Number.isInteger(p.stratum) && p.stratum >= 0 && p.stratum < 3, 'Invalid sampling stratum.');
  const lower = CAPACITY_RANGE[0] + p.stratum * (CAPACITY_RANGE[1] - CAPACITY_RANGE[0]) / 3;
  const upper = CAPACITY_RANGE[0] + (p.stratum + 1) * (CAPACITY_RANGE[1] - CAPACITY_RANGE[0]) / 3;
  assert(p.capacity >= lower - 1e-9 && p.capacity <= upper + 1e-9, 'Capacity and sampling stratum disagree.');
  return Object.freeze({id:p.id, modelVersion:p.modelVersion, template:p.template, side:p.side,
    capacity:p.capacity, responseScale:p.responseScale, batchSeed:p.batchSeed, stratum:p.stratum});
}
export function createLibrary(libraryId) {
  return validateLibrary({schema:LIBRARY_SCHEMA, modelVersion:MODEL_VERSION, libraryId, nextNumber:1, patients:[]});
}
export function validateLibrary(bank) {
  exactKeys(bank, ['schema', 'modelVersion', 'libraryId', 'nextNumber', 'patients'], 'patient library');
  assert(bank.schema === LIBRARY_SCHEMA && bank.modelVersion === MODEL_VERSION, 'Unsupported patient library version.');
  assert(typeof bank.libraryId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(bank.libraryId), 'Invalid library identity.');
  assert(Array.isArray(bank.patients) && bank.patients.length <= MAX_PATIENTS, 'Invalid patient count.');
  const patients = bank.patients.map(validatePatient);
  assert(new Set(patients.map(p => p.id)).size === patients.length, 'Duplicate patient IDs.');
  const max = patients.reduce((n,p) => Math.max(n, Number(p.id.slice(1))), 0);
  assert(Number.isInteger(bank.nextNumber) && bank.nextNumber > max && bank.nextNumber <= 999999, 'Invalid next patient number.');
  return Object.freeze({schema:LIBRARY_SCHEMA, modelVersion:MODEL_VERSION, libraryId:bank.libraryId,
    nextNumber:bank.nextNumber, patients:Object.freeze(patients)});
}
function seededRandom(text) {
  let state = 2166136261;
  for (let i=0;i<text.length;i++) state = Math.imul(state ^ text.charCodeAt(i), 16777619) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let n = state; n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
export function generatePatients(bank, {count, template, side, seed}) {
  bank = validateLibrary(bank);
  assert(Number.isInteger(count) && count >= 1 && count <= 1000, 'Choose an integer count from 1 to 1000.');
  assert(bank.patients.length + count <= MAX_PATIENTS && bank.nextNumber + count <= 999999, 'Patient library is full. Export it before starting a separate library.');
  assert(TEMPLATES.includes(template) && ['left', 'right'].includes(side), 'Choose a template and side.');
  assert(typeof seed === 'string' && seed.trim().length > 0 && seed.length <= 100, 'Enter a seed of 1–100 characters.');
  seed = seed.trim();
  const rng = seededRandom(`${MODEL_VERSION}|${template}|${side}|${seed}|${count}`);
  // Equal quotas (difference at most 1), shuffled so patient numbers do not encode severity.
  const buckets=[0,1,2];
  for(let i=2;i>0;i--){const j=Math.floor(rng()*(i+1));[buckets[i],buckets[j]]=[buckets[j],buckets[i]];}
  const strata = Array.from({length:count}, (_,i) => buckets[i % 3]);
  for (let i=strata.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [strata[i],strata[j]]=[strata[j],strata[i]]; }
  const added = strata.map((stratum,i) => ({id:`P${String(bank.nextNumber+i).padStart(6,'0')}`,
    modelVersion:MODEL_VERSION, template, side, capacity:CAPACITY_RANGE[0] + (stratum + rng()) / 3 * (CAPACITY_RANGE[1]-CAPACITY_RANGE[0]),
    responseScale:1, batchSeed:seed, stratum}));
  return validateLibrary({...bank, nextNumber:bank.nextNumber+count, patients:[...bank.patients,...added]});
}
export function mergeLibraries(bank, incoming) {
  bank = validateLibrary(bank); incoming = validateLibrary(incoming);
  if (!bank.patients.length) return incoming;
  assert(bank.libraryId === incoming.libraryId, 'This is a different library. Import it in a separate browser profile or site; existing IDs will not be replaced.');
  const all = new Map(bank.patients.map(p => [p.id,p]));
  for (const p of incoming.patients) {
    assert(!all.has(p.id) || JSON.stringify(all.get(p.id)) === JSON.stringify(p), `Conflicting configuration for ${p.id}; nothing was imported.`);
    all.set(p.id,p);
  }
  return validateLibrary({...bank, nextNumber:Math.max(bank.nextNumber,incoming.nextNumber), patients:[...all.values()].sort((a,b)=>a.id.localeCompare(b.id))});
}
export function findPatient(bank, id) {
  const raw=String(id).trim().toUpperCase();
  const key=/^\d{1,6}$/.test(raw)?`P${raw.padStart(6,'0')}`:raw;
  return bank.patients.find(p => p.id===key) || null;
}

// Coordinates: +yaw = simulated person's right. Eyes are [left yaw,pitch,right yaw,pitch].
// Anatomical templates map to signed drive channels, not to screen pixels or target half-planes.
export function affectedChannels(patient) {
  if (!patient) return [];
  if (patient.template==='conjugate') return [[0,patient.side==='left'?-1:1],[2,patient.side==='left'?-1:1]];
  const left=patient.side==='left', index=left?0:2;
  return [[index, (patient.template==='adduction'?1:-1) * (left?1:-1)]];
}

export class PatientLayer {
  constructor(patient=null) { this.setPatient(patient); }
  setPatient(patient) { this.patient=patient?validatePatient(patient):null; this.reset(); }
  reset() { this.yaw=[0,0]; }
  snapshot() { return {yaw:[...this.yaw]}; }
  restoreState(state) {
    assert(state && Array.isArray(state.yaw) && state.yaw.length===2 && state.yaw.every(Number.isFinite), 'Invalid layer state.');
    this.yaw=[...state.yaw];
  }
  step(reference, dt) {
    assert(Array.isArray(reference) && reference.length===4 && reference.every(Number.isFinite), 'Expected four finite reference angles.');
    assert(Number.isFinite(dt) && dt>0 && dt<=0.1, 'Simulation step must be in (0, 0.1] seconds.');
    if (!this.patient) return [...reference];
    const output=[...reference], p=this.patient;
    const steps=Math.ceil(dt/PLANT.maxStepSeconds), h=dt/steps;
    const alpha=1-Math.exp(-h/(PLANT.tauSeconds*p.responseScale));
    const capacity=PLANT.driveDegrees*p.capacity;
    for (const [index,direction] of affectedChannels(p)) {
      let q=this.yaw[index/2];
      for(let j=0;j<steps;j++) {
        // Feed-forward position drive plus bounded, proportional error correction; no wind-up.
        const requested=reference[index]+PLANT.feedback*(reference[index]-q);
        const signed=direction*requested;
        const delivered=signed>0?direction*capacity*Math.tanh(signed/capacity):requested;
        // Overdamped spring/viscous plant in angle-equivalent drive units.
        q+=alpha*(delivered-q);
      }
      this.yaw[index/2]=q; output[index]=q;
    }
    return output;
  }
}
