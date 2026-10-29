import {createLibrary,validateLibrary,generatePatients,mergeLibraries,findPatient} from '../patient-model.mjs';
export const PATIENT_STORAGE_KEY='oculid-motion-patients-v1';

// Same portable format and storage key as the inherited complete workspace.
export class PatientBank {
  constructor(storage,libraryId){
    this.storage=storage;this.library=createLibrary(libraryId);this.active=null;this.saved=null;this.corrupt=false;this.warning='';
    try{this.saved=storage.getItem(PATIENT_STORAGE_KEY);}catch{this.warning='Browser storage is unavailable. Export the library before closing.';}
    if(this.saved)try{
      const value=JSON.parse(this.saved),library=validateLibrary(value.library),active=value.activeId?findPatient(library,value.activeId):null;
      if(value.activeId&&!active)throw Error('Saved patient ID was not found');
      this.library=library;this.active=active;
    }catch{this.corrupt=true;this.warning='The saved library could not be read and has been preserved. Import a valid backup to recover it.';}
  }
  save(){
    if(this.corrupt)return;
    try{
      if(this.storage.getItem(PATIENT_STORAGE_KEY)!==this.saved){this.warning='Another tab changed the library. Export the patients from this tab, then reload to synchronize. Saved data was not overwritten.';return;}
      const value=JSON.stringify({library:this.library,activeId:this.active?.id||null});
      this.storage.setItem(PATIENT_STORAGE_KEY,value);this.saved=value;this.warning='';
    }catch{this.warning='Patients are available in this tab, but saving failed. Export the library before closing.';}
  }
  activate(id){
    const patient=id===null?null:findPatient(this.library,id);
    if(id!==null&&!patient)throw Error('Patient ID not found. Generate or import the matching library first.');
    this.active=patient;this.save();return patient;
  }
  generate(options){
    if(this.corrupt)throw Error('Import a valid backup to restore the library first.');
    const oldCount=this.library.patients.length,next=generatePatients(this.library,options);
    this.library=next;this.active=next.patients[oldCount];this.save();
    return next.patients.slice(oldCount);
  }
  import(value){
    const incoming=validateLibrary(value),next=this.corrupt?incoming:mergeLibraries(this.library,incoming);
    this.active=this.active?findPatient(next,this.active.id):null;this.library=next;this.corrupt=false;this.save();
  }
}
