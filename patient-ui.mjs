import {createLibrary, validateLibrary, generatePatients, mergeLibraries, findPatient, PatientLayer, MODEL_VERSION} from './patient-model.mjs';

const STORAGE_KEY='oculid-motion-patients-v1';
const titles={conjugate:'Both eyes · One gaze direction',adduction:'One eye · Inward movement',abduction:'One eye · Outward movement'};
export function downloadJSON(value, filename) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function mountPatientControls({onChange}) {
  const $=id=>document.getElementById(id);
  const host=document.createElement('section');host.id='patientControls';host.className='group patient-controls';
  host.innerHTML=`<h2>Patient</h2>
    <p id="patientActive" class="patient-active"></p>
    <div id="patientLookup"><label for="patientNumber">Patient number</label><div class="row"><input id="patientNumber" type="text" list="patientIds" placeholder="e.g. 17" autocomplete="off"><button id="patientApply" type="button">Use patient</button></div><datalist id="patientIds"></datalist>
    <div class="row patient-navigation"><button id="patientPrevious" type="button" aria-label="Previous patient">← Previous</button><button id="patientNext" type="button" aria-label="Next patient">Next →</button><button id="patientDisable" type="button">Normal</button></div></div>
    <details id="patientGeneratePanel"><summary>Generate patients</summary>
      <label for="patientTemplate">Movement pattern</label><select id="patientTemplate"><option value="conjugate">Both eyes · One direction</option><option value="adduction">One eye · Inward</option><option value="abduction">One eye · Outward</option></select>
      <div class="patient-fields"><div><label id="patientSideLabel" for="patientSide">Limited gaze direction</label><select id="patientSide"><option value="left">Left</option><option value="right">Right</option></select></div>
      <div><label for="patientCount">How many?</label><input id="patientCount" type="number" min="1" max="1000" step="1" value="30"></div></div>
      <p class="help">Left/right is the simulated person’s side.</p>
      <button id="patientGenerate" type="button">Generate patients</button>
      <details id="patientSeedPanel"><summary>Custom random seed</summary><label for="patientSeed">Batch seed</label><div class="row"><input id="patientSeed" type="text" maxlength="100" autocomplete="off"><button id="patientNewSeed" type="button">New seed</button></div></details>
    </details>
    <p id="patientMessage" class="help" role="status" aria-live="polite"></p><p id="patientStorage" class="help"></p>
    <details id="patientFiles"><summary>Save &amp; export</summary>
      <p id="patientLibrarySummary" class="help"></p>
      <button id="patientExport" type="button">Download patient library</button>
      <label for="patientImport">Restore patient library</label><input id="patientImport" type="file" accept=".json,application/json">
      <p class="help">Export a backup to keep these patients on another device.</p>
      <button id="patientRunExport" type="button">Download current run (JSON)</button>
      <details><summary>Patient parameters</summary><pre id="patientDetails"></pre></details>
      <a href="./patient-guide.html" target="_blank" rel="noopener">Patient guide &amp; mathematics ↗</a>
    </details>
    <p class="patient-disclaimer">Candidate eye movements · No NIHSS score assigned</p>`;
  $('cameraControls').before(host);
  const badge=document.createElement('div');badge.id='patientBadge';badge.className='patient-badge';$('eyeFocus').append(badge);
  let library=createLibrary(crypto.randomUUID()), active=null, storageWarning='', corrupt=false;
  let stored=null;
  try {stored=localStorage.getItem(STORAGE_KEY);}
  catch {storageWarning='Browser storage is unavailable. Export JSON before closing this tab.';}
  if(stored)try {
      const raw=stored;
      const saved=JSON.parse(raw);library=validateLibrary(saved.library);
      active=saved.activeId?findPatient(library,saved.activeId):null;
      if(saved.activeId&&!active)throw Error('Saved active ID is missing.');
      storageWarning='Restored from this browser. Export JSON for a portable backup.';
  } catch(error) {
    // Do not overwrite an unreadable or incompatible library with an empty one.
    corrupt=true;active=null;
    storageWarning='Saved library could not be restored; it has not been overwritten. Import a valid backup to recover. '+error.message;
  }
  const layer=new PatientLayer(active);
  if(active)$('patientNumber').value=active.id;
  $('patientGeneratePanel').open=!library.patients.length;
  function message(value,error=false){$('patientMessage').textContent=value;$('patientMessage').classList.toggle('error',error);}
  function save() {
    if(corrupt)return;
    try {
      // Refuse to overwrite changes made by a different tab. Export remains available.
      const latest=localStorage.getItem(STORAGE_KEY);
      if(latest!==stored){storageWarning='Another tab changed the saved library. This tab has not overwritten it. Export this tab’s library, then reload to synchronize.';return;}
      const next=JSON.stringify({library,activeId:active?.id||null});
      localStorage.setItem(STORAGE_KEY,next);stored=next;storageWarning='Saved in this browser. Export JSON for a portable backup.';
    }
    catch { storageWarning='Browser storage is unavailable or full. Patients work in this tab only; export the library before closing.'; }
  }
  function render() {
    $('patientLookup').hidden=!library.patients.length;
    $('patientLibrarySummary').textContent=`${library.patients.length} fixed patients · Library ${library.libraryId}`;
    $('patientStorage').textContent=storageWarning;
    $('patientStorage').hidden=!storageWarning||/^(Saved in|Restored from)/.test(storageWarning);
    $('patientGenerate').disabled=corrupt;$('patientApply').disabled=corrupt||!library.patients.length;
    $('patientExport').disabled=corrupt||!library.patients.length;
    const index=active?library.patients.findIndex(p=>p.id===active.id):-1;
    $('patientPrevious').disabled=corrupt||index<=0;$('patientNext').disabled=corrupt||!library.patients.length||index>=library.patients.length-1;
    $('patientDisable').disabled=!active;
    $('patientActive').textContent=active?`${active.id} · ${titles[active.template]} · ${active.side}`:'Normal reference · No patient layer';
    badge.textContent=active?`Virtual patient ${active.id} · ${active.side}`:'Normal reference';
    $('patientDetails').textContent=active?JSON.stringify(active,null,2):'No patient selected.';
    $('patientIds').replaceChildren(...library.patients.map(p=>{const option=document.createElement('option');option.value=p.id;return option;}));
  }
  function activate(patient) {
    active=patient;layer.setPatient(patient);if(patient)$('patientNumber').value=patient.id;
    save();render();onChange();
  }
  function attempt(fn){try{fn();}catch(error){message(error.message,true);}}
  $('patientTemplate').onchange=()=>$('patientSideLabel').textContent=$('patientTemplate').value==='conjugate'?'Limited gaze direction':'Affected eye';
  $('patientNewSeed').onclick=()=>$('patientSeed').value=crypto.randomUUID();$('patientNewSeed').click();
  $('patientGenerate').onclick=()=>attempt(()=>{
    if(corrupt)throw Error('Restore a valid library before generating patients.');
    const oldCount=library.patients.length;
    library=generatePatients(library,{count:Number($('patientCount').value),template:$('patientTemplate').value,side:$('patientSide').value,seed:$('patientSeed').value});
    activate(library.patients[oldCount]);
    $('patientGeneratePanel').open=false;
    message(`Created ${library.patients[oldCount].id}–${library.patients.at(-1).id}. Saved in this library.`);
  });
  $('patientApply').onclick=()=>attempt(()=>{
    const patient=findPatient(library,$('patientNumber').value);if(!patient)throw Error('Patient ID not found. Generate or import its library first.');
    activate(patient);message('');
  });
  $('patientNumber').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('patientApply').click();}});
  $('patientDisable').onclick=()=>{activate(null);message('');};
  for(const [id,offset] of [['patientPrevious',-1],['patientNext',1]])$(id).onclick=()=>{
    const index=active?library.patients.findIndex(p=>p.id===active.id):-1;
    const patient=library.patients[index+offset];if(patient)activate(patient);
  };
  $('patientExport').onclick=()=>downloadJSON(library,`patients-${library.libraryId}.json`);
  $('patientImport').onchange=async()=>{
    const file=$('patientImport').files?.[0];if(!file)return;
    try {
      if(file.size>5*1024*1024)throw Error('Patient library must be smaller than 5 MiB.');
      const incoming=validateLibrary(JSON.parse(await file.text()));
      library=corrupt?incoming:mergeLibraries(library,incoming);corrupt=false;
      activate(active&&findPatient(library,active.id)||null);
      message(`Library restored: ${library.patients.length} fixed patients. Enter an ID to activate.`);
    }catch(error){message(error.message,true);}
    finally{$('patientImport').value='';}
  };
  render();
  return {layer, get active(){return active;}, get library(){return library;},
    get provenance(){return {libraryId:library.libraryId,patient:active?{...active}:null,modelVersion:MODEL_VERSION};}};
}
