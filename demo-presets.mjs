import {PatientLayer,validatePatient,MODEL_VERSION} from './patient-model.mjs';
import {LearnedModel,desired} from './engine.js';

export const DEMO_VERSION='three-patterns-v1';
export const DEMO_FPS=250;
export const DEMO_MODEL='gru_expanded_520';
export const DEMO_EYES=Object.freeze([Object.freeze([-.032,0,0]),Object.freeze([.032,0,0])]);
const definitions=[
  ['conjugate','双眼向左受限','向虚拟人的左侧看时，两眼都明显跟不上；向右看仍能转动。'],
  ['adduction','左眼内转受限','向虚拟人的右侧看时，左眼向鼻侧转动明显不足，另一眼继续跟随。'],
  ['abduction','左眼外转受限','向虚拟人的左侧看时，左眼向外侧转动明显不足，另一眼继续跟随。']
];
export const DEMO_CASES=Object.freeze(definitions.map(([template,title,description],i)=>Object.freeze({
  key:template,number:`0${i+1}`,title,description,
  patient:validatePatient({id:`P90000${i+1}`,modelVersion:MODEL_VERSION,template,side:'left',capacity:.12,
    responseScale:1,batchSeed:DEMO_VERSION,stratum:0})
})));

// One slow, continuous follow task, identical for all cases. Positions are metres.
// Quintic easing makes target velocity and acceleration zero at each hold boundary.
const phases=Object.freeze([
  [1,0,0,'看向正中'],[2.5,0,-.36,'缓慢向左'],[1.5,-.36,-.36,'保持左侧'],
  [2,-.36,0,'回到正中'],[.5,0,0,'保持正中'],[2.5,0,.36,'缓慢向右'],
  [1.5,.36,.36,'保持右侧'],[2,.36,0,'回到正中'],[.5,0,0,'保持正中']
]);
export const DEMO_PERIOD=phases.reduce((sum,p)=>sum+p[0],0);
export function demoTarget(time){
  if(!Number.isFinite(time)||time<0)throw Error('Expected nonnegative demo time.');
  let t=time%DEMO_PERIOD;
  for(const [duration,from,to,phase]of phases){
    if(t<duration){const a=t/duration,s=a*a*a*(10+a*(-15+6*a));return {target:[from+(to-from)*s,0,.7],phase};}
    t-=duration;
  }
  return {target:[0,0,.7],phase:'看向正中'};
}

export class DemoSimulation{
  constructor(model){this.reference=new LearnedModel(model);this.select('conjugate');}
  select(key){const selected=DEMO_CASES.find(c=>c.key===key);if(!selected)throw Error('Unknown demo case.');this.case=selected;this.layer=new PatientLayer(selected.patient);this.reset();}
  reset(){this.reference.reset();this.layer.reset();this.previous=null;this.time=0;this.current=null;}
  step(target){
    if(!Array.isArray(target)||target.length!==3||!target.every(Number.isFinite)||target[2]<=0)throw Error('Expected a finite target in front of the eyes.');
    const ideal=desired(target,DEMO_EYES);
    const x=ideal.map(v=>v/30).concat(ideal.map((v,i)=>Math.max(-600,Math.min(600,this.previous?(v-this.previous[i])*DEMO_FPS:0))/300));
    const baseline=this.reference.step(x);this.previous=ideal;
    this.current={time:this.time,target:[...target],ideal,baseline,output:this.layer.step(baseline,1/DEMO_FPS),caseKey:this.case.key};
    this.time+=1/DEMO_FPS;return this.current;
  }
}
