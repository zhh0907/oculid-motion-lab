import {createLibrary,validateLibrary,generatePatients,mergeLibraries,findPatient} from '../patient-model.mjs';
export const PATIENT_STORAGE_KEY='oculid-motion-patients-v1';

// Same portable format and storage key as the inherited complete workspace.
export class PatientBank {
  constructor(storage,libraryId){
    this.storage=storage;this.library=createLibrary(libraryId);this.active=null;this.saved=null;this.corrupt=false;this.warning='';
    try{this.saved=storage.getItem(PATIENT_STORAGE_KEY);}catch{this.warning='浏览器无法保存，请在关闭前导出患者库。';}
    if(this.saved)try{
      const value=JSON.parse(this.saved),library=validateLibrary(value.library),active=value.activeId?findPatient(library,value.activeId):null;
      if(value.activeId&&!active)throw Error('找不到已保存的患者编号');
      this.library=library;this.active=active;
    }catch{this.corrupt=true;this.warning='已保存的患者库无法读取，原数据未覆盖。请导入有效备份恢复。';}
  }
  save(){
    if(this.corrupt)return;
    try{
      if(this.storage.getItem(PATIENT_STORAGE_KEY)!==this.saved){this.warning='另一页面已修改患者库。本页未覆盖它；请先导出本页患者，再刷新同步。';return;}
      const value=JSON.stringify({library:this.library,activeId:this.active?.id||null});
      this.storage.setItem(PATIENT_STORAGE_KEY,value);this.saved=value;this.warning='';
    }catch{this.warning='患者可在本页使用，但保存失败。请关闭前导出患者库。';}
  }
  activate(id){
    const patient=id===null?null:findPatient(this.library,id);
    if(id!==null&&!patient)throw Error('找不到该编号，请先生成或导入对应的患者库。');
    this.active=patient;this.save();return patient;
  }
  generate(options){
    if(this.corrupt)throw Error('请先导入有效备份，恢复现有患者库。');
    const oldCount=this.library.patients.length,next=generatePatients(this.library,options);
    this.library=next;this.active=next.patients[oldCount];this.save();
    return next.patients.slice(oldCount);
  }
  import(value){
    const incoming=validateLibrary(value),next=this.corrupt?incoming:mergeLibraries(this.library,incoming);
    this.active=this.active?findPatient(next,this.active.id):null;this.library=next;this.corrupt=false;this.save();
  }
}
