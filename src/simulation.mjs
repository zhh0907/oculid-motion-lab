import {LearnedModel,desired} from '../engine.js';
import {PatientLayer,validatePatient,MODEL_VERSION} from '../patient-model.mjs';
import {DEMO_CASES,DEMO_EYES,demoTarget} from '../demo-presets.mjs';
import {appearanceFrame,EyelidDynamics,DEFAULT_APPEARANCE,LID_VERSION} from './eyelid-model.mjs?v=canthus3';
import {normalizeRange,angularTarget} from './target-range.mjs?v=canthus3';
import {TrajectoryHistory} from './trajectory-data.mjs?v=patients4';
export const FPS=250;
export function targetAt(time,path='horizontal',depth=.7,range=null){
  if(range&&path!=='depth'){
    const r=normalizeRange(range);let yaw=0,pitch=0;
    if(path==='horizontal')yaw=demoTarget(time).target[0]/.36*r.horizontal;
    if(path==='step')yaw=(Math.floor(time/2)%2?1:-1)*r.horizontal;
    if(path==='vertical'||path==='circle'){const a=Math.sin(time*(path==='circle'?.8:.9));pitch=a*(a>=0?r.up:r.down);}
    if(path==='circle')yaw=Math.cos(time*.8)*r.horizontal;
    return angularTarget(yaw,pitch,depth);
  }
  if(path==='horizontal')return demoTarget(time).target.map((v,i)=>i===2?depth:v);
  if(path==='vertical')return [0,.2*Math.sin(time*.9),depth];
  if(path==='circle')return [.28*Math.cos(time*.8),.16*Math.sin(time*.8),depth];
  if(path==='depth')return [0,0,Math.max(.22,depth+.3*Math.sin(time*.8))];
  if(path==='step')return [Math.floor(time/2)%2?.28:-.28,0,depth];
  return [0,0,depth];
}
export class Simulation{
  constructor(bundle){if(bundle.fps!==FPS)throw Error('Expected upstream 250 Hz model');this.bundle=bundle;this.modelKey='gru_expanded_520';this.caseKey='normal';this.caseSide='left';this.patientProfile=null;this.libraryId=null;this.appearance={...DEFAULT_APPEARANCE};this.trace=new TrajectoryHistory();this.reset();}
  reset(){this.model=this.modelKey==='ideal'?null:new LearnedModel(this.bundle.models[this.modelKey]);this.patient=this.patientProfile;this.layer=new PatientLayer(this.patient);this.initialLayerState=this.layer.snapshot();this.lidDynamics=new EyelidDynamics();this.time=0;this.previous=null;this.current=null;this.rows=[];this.manualTime=-Infinity;this.manualBlinks=[];this.trace.clear();}
  select({model=this.modelKey,pattern,side=this.caseSide}={}){
    if(model!=='ideal'&&!this.bundle.models[model])throw Error('Unknown model');
    if(!['left','right'].includes(side))throw Error('Unknown side');
    if(pattern!==undefined){
      const entry=DEMO_CASES.find(c=>c.key===pattern);
      if(pattern!=='normal'&&!entry)throw Error('Unknown pattern');
      // The three original left-side examples retain their original identities.
      // Right-side examples have separate IDs; saved patient IDs never change.
      this.patientProfile=entry?validatePatient(side==='left'?entry.patient:{...entry.patient,id:`P${Number(entry.patient.id.slice(1))+3}`,side,batchSeed:entry.patient.batchSeed+'-right'}):null;
      this.caseKey=pattern;this.caseSide=side;this.libraryId=null;
    }
    this.modelKey=model;this.reset();
  }
  selectPatient(patient,libraryId){
    const profile=validatePatient(patient);
    if(typeof libraryId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(libraryId))throw Error('Invalid library identity');
    this.patientProfile=profile;this.libraryId=libraryId;this.caseKey='patient';this.caseSide=profile.side;this.reset();
  }
  reacquire(){this.previous=null;this.model?.reset();this.trace.markGap();}
  blink(){this.manualTime=this.current?.time??this.time;this.manualBlinks.push(this.manualTime);}
  step(target){
    if(!Array.isArray(target)||target.length!==3||!target.every(Number.isFinite)||target[2]<=0)throw Error('Invalid target');
    const ideal=desired(target,DEMO_EYES),x=ideal.map(v=>v/30).concat(ideal.map((v,i)=>Math.max(-600,Math.min(600,this.previous?(v-this.previous[i])*FPS:0))/300));
    const baseline=this.model?this.model.step(x):[...ideal];this.previous=ideal;
    const angles=this.layer.step(baseline,1/FPS),lids=this.lidDynamics.sample(angles,this.time,this.appearance,this.manualTime);
    this.current={time:this.time,target:[...target],ideal,baseline,angles,lids};if(this.rows.length<FPS*120)this.rows.push(this.current);this.trace.push(this.current);this.time+=1/FPS;return this.current;
  }
  frame(){const c=this.current;return c?{...c,lids:appearanceFrame(c.angles,c.time,this.appearance,this.manualTime,this.lidDynamics.followAngles)}:{time:0,target:[0,0,.7],angles:[0,0,0,0],ideal:[0,0,0,0],baseline:[0,0,0,0],lids:appearanceFrame([0,0,0,0],0,this.appearance)};}
  export(settings={}){return {schema:'oculid-run-v1',lidVersion:LID_VERSION,fps:FPS,coordinates:'metres; degrees; [left yaw,left pitch,right yaw,right pitch]; +Z forward; +yaw subject-right; +pitch up; no torsion',model:this.modelKey,pattern:this.caseKey,patient:this.patient,patientLibraryId:this.libraryId,patientModelVersion:MODEL_VERSION,patientInitialState:this.initialLayerState,appearance:{...this.appearance},manualBlinks:[...this.manualBlinks],settings,visibilityDefinition:'front orthographic sampled pupil fraction; not a tracker confidence',limitSeconds:120,bufferFull:this.rows.length>=FPS*120,samples:this.rows};}
}
