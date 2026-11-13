import {validateLibrary,mergeLibraries,findPatient} from './core/patient-model.mjs';
import {validateProfile} from '../calibration-math.js';
import {PATIENT_STORAGE_KEY} from './patient-bank.mjs';

export const MIGRATION_KEYS=Object.freeze({
  patients:{from:'binocular-motion-patients-v1',to:PATIENT_STORAGE_KEY},
  calibration:{from:'binocular-screen-calibration-v1',to:'oculid-screen-calibration-v1'}
});
function patientStore(raw){
  const value=JSON.parse(raw),library=validateLibrary(value.library),activeId=value.activeId??null;
  if(activeId&&!findPatient(library,activeId))throw Error('Saved patient ID is missing');
  return {library,activeId};
}
// Planning never writes. A commit compares both snapshots before a single write.
// Source keys are never removed; incompatible identities are never renumbered.
export function planMigration(storage,kind,sourceText){
  const keys=MIGRATION_KEYS[kind];if(!keys)throw Error('Unknown migration type');
  const sourceSnapshot=storage.getItem(keys.from),destinationSnapshot=storage.getItem(keys.to);
  const raw=sourceText??sourceSnapshot;if(!raw)throw Error('No legacy data found in this browser. Import an exported JSON file.');
  let value,summary;
  if(kind==='patients'){
    const parsed=JSON.parse(raw),source=patientStore(parsed.library?raw:JSON.stringify({library:parsed,activeId:null}));
    const destination=destinationSnapshot?patientStore(destinationSnapshot):null;
    const library=destination?mergeLibraries(destination.library,source.library):source.library;
    value={library,activeId:destination?.activeId??source.activeId};
    summary=`${library.patients.length} patients · Library ${library.libraryId}. Existing patient identities are preserved.`;
  }else{
    const parsed=JSON.parse(raw),profile=validateProfile(parsed.profile??parsed);
    if(destinationSnapshot)throw Error('A calibration already exists in Oculid. Use the workspace calibration import to review and replace it.');
    value={profile,enabled:false,deviceId:'',deviceLabel:''};
    summary='Screen and camera measurements copied. Bind the camera and enable calibration in the full workspace.';
  }
  return {kind,sourceSnapshot,destinationSnapshot,value,summary};
}
export function commitMigration(storage,plan){
  const keys=MIGRATION_KEYS[plan.kind];if(!keys)throw Error('Unknown migration type');
  if(storage.getItem(keys.from)!==plan.sourceSnapshot||storage.getItem(keys.to)!==plan.destinationSnapshot)throw Error('Saved data changed in another tab. Review the migration again. Nothing was overwritten.');
  // Revalidate the proposed payload, including file imports, before writing.
  const checked=planMigration(storage,plan.kind,JSON.stringify(plan.value));
  storage.setItem(keys.to,JSON.stringify(checked.value));
  return checked.summary;
}
