import {LearnedModel,desired} from './engine.js';
import {PatientLayer} from './patient-model.mjs';

export const MOTION_FPS=250;
export const DEFAULT_EYES=Object.freeze([Object.freeze([-.032,0,0]),Object.freeze([.032,0,0])]);

// One feature/prediction path for the homepage, complete workspace and demo.
// No appearance, browser, storage or rendering dependencies.
export function motionStep(target,{model=null,previous=null,fps=MOTION_FPS,eyes=DEFAULT_EYES}={}){
  if(!Array.isArray(target)||target.length!==3||!target.every(Number.isFinite)||target[2]<=0)throw Error('Invalid target');
  if(!Number.isFinite(fps)||fps<10)throw Error('Invalid sample rate');
  const ideal=desired(target,eyes);
  const features=ideal.map(v=>v/30).concat(ideal.map((v,i)=>Math.max(-600,Math.min(600,previous?(v-previous[i])*fps:0))/300));
  return {ideal,baseline:model?model.step(features):[...ideal]};
}

/** Headless session. Pass model weights or null for ideal geometry. */
export class MotionSession{
  constructor({model=null,patient=null,fps=MOTION_FPS,eyes=DEFAULT_EYES}={}){
    if(fps!==MOTION_FPS)throw Error('Expected 250 Hz model');
    this.fps=fps;this.eyes=eyes.map(e=>[...e]);this.model=model?new LearnedModel(model):null;
    this.layer=new PatientLayer(patient);this.reset();
  }
  reset(){this.model?.reset();this.layer.reset();this.time=0;this.previous=null;this.current=null;}
  reacquire(){this.model?.reset();this.previous=null;}
  step(target){
    const {ideal,baseline}=motionStep(target,{model:this.model,previous:this.previous,fps:this.fps,eyes:this.eyes});
    this.previous=ideal;
    this.current={time:this.time,target:[...target],ideal,baseline,angles:this.layer.step(baseline,1/this.fps)};
    this.time+=1/this.fps;return this.current;
  }
}
