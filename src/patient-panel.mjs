import {PatientBank} from './patient-bank.mjs?v=faces8';
const titles={conjugate:'Conjugate gaze limitation',adduction:'One-eye adduction limitation',abduction:'One-eye abduction limitation'};
const sides={left:'Left',right:'Right'};
export function mountPatientPanel(sim,onChange){
  const $=id=>document.getElementById(id);
  // Access itself may throw when browser storage has been disabled.
  let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');}};}
  const bank=new PatientBank(storage,crypto.randomUUID());
  function message(text,error=false){$('patientMessage').textContent=text;$('patientMessage').classList.toggle('error',error);}
  function render(){
    const active=bank.active,profile=sim.patient;
    $('patternSide').disabled=$('pattern').value==='normal';
    $('patternSideLabel').textContent=$('pattern').value==='conjugate'?'Limited direction':'Affected eye';
    $('patientLookup').hidden=!bank.library.patients.length;
    $('patientCountLabel').textContent=`Patient library · ${bank.library.patients.length}`;
    $('patientGenerate').disabled=bank.corrupt||$('pattern').value==='normal';
    $('patientExport').disabled=bank.corrupt||!bank.library.patients.length;
    $('patientApply').disabled=bank.corrupt||!bank.library.patients.length;
    const index=active?bank.library.patients.findIndex(p=>p.id===active.id):-1;
    $('patientPrevious').disabled=bank.corrupt||index<=0;
    $('patientNext').disabled=bank.corrupt||index>=bank.library.patients.length-1||!bank.library.patients.length;
    $('patientStorage').textContent=bank.warning;$('patientStorage').hidden=!bank.warning;
    $('patientActive').textContent=profile?`${active?active.id:'Example'} · ${titles[profile.template]} · ${sides[profile.side]}${profile.template==='conjugate'?' direction':' eye'}`:'Normal reference · No limitation';
    $('activePatientBadge').textContent=active?active.id:profile?'Example':'Normal reference';
    if(active)$('patientNumber').value=active.id;
    $('patientIds').replaceChildren(...bank.library.patients.map(p=>{const o=document.createElement('option');o.value=p.id;return o;}));
  }
  function useActive(){
    if(bank.active){sim.selectPatient(bank.active,bank.library.libraryId);$('pattern').value=bank.active.template;$('patternSide').value=bank.active.side;}
    else{sim.select({pattern:'normal'});$('pattern').value='normal';}
    render();onChange();
  }
  function attempt(action){try{action();}catch(error){message(error.message,true);}}
  function preset(){bank.activate(null);sim.select({pattern:$('pattern').value,side:$('patternSide').value});message('');render();onChange();}
  $('pattern').onchange=$('patternSide').onchange=preset;
  $('patientNormal').onclick=()=>{$('pattern').value='normal';preset();};
  $('patientGenerate').onclick=()=>attempt(()=>{
    const added=bank.generate({template:$('pattern').value,side:$('patternSide').value,count:Number($('patientCount').value),seed:$('patientSeed').value.trim()||crypto.randomUUID()});
    useActive();$('patientGeneratePanel').open=false;message(`Created ${added[0].id}–${added.at(-1).id} with fixed parameters.`);
  });
  $('patientApply').onclick=()=>attempt(()=>{bank.activate($('patientNumber').value);useActive();message('');});
  $('patientNumber').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('patientApply').click();}});
  for(const [id,offset]of [['patientPrevious',-1],['patientNext',1]])$(id).onclick=()=>attempt(()=>{
    const index=bank.active?bank.library.patients.findIndex(p=>p.id===bank.active.id):-1,p=bank.library.patients[index+offset];
    if(p){bank.activate(p.id);useActive();message('');}
  });
  $('patientExport').onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(bank.library,null,2)],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download=`patients-${bank.library.libraryId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('patientImport').onchange=async()=>{
    const file=$('patientImport').files?.[0];if(!file)return;
    try{
      if(file.size>5*1024*1024)throw Error('Patient library must be smaller than 5 MiB.');
      bank.import(JSON.parse(await file.text()));useActive();message(`Imported ${bank.library.patients.length} patients. Enter an ID to recall one.`);
    }catch(error){message(error.message,true);}finally{$('patientImport').value='';}
  };
  if(bank.active){sim.selectPatient(bank.active,bank.library.libraryId);$('pattern').value=bank.active.template;$('patternSide').value=bank.active.side;}
  render();return {bank,render};
}
