import {createEyeView} from './src/eye-rig.mjs?v=faces8';
import {EyelidDynamics} from './src/eyelid-model.mjs?v=faces8';
import * as T from './vendor/three.module.js';
import {FingerCamera} from './camera.js?v=review7';
import {DEMO_CASES,DEMO_FPS,DEMO_MODEL,DEMO_EYES,DemoSimulation,demoTarget} from './demo-presets.mjs?v=demo1';
const $=id=>document.getElementById(id);
const choices=[...document.querySelectorAll('[data-case]')];
choices.forEach(b=>b.disabled=true);
const caseText={
  conjugate:['Both eyes: left gaze limitation','Both eyes fall short when looking toward the simulated person’s left. Rightward movement is preserved.'],
  adduction:['Left eye: adduction limitation','The left eye turns inward toward the nose only slightly; the other eye continues following the target.'],
  abduction:['Left eye: abduction limitation','The left eye turns outward only slightly; the other eye continues following the target.']
};
const phaseText={'看向正中':'Look straight ahead','缓慢向左':'Slowly look left','保持左侧':'Hold left','回到正中':'Return to centre','保持正中':'Hold centre','缓慢向右':'Slowly look right','保持右侧':'Hold right'};

function eyeView(id){
  const view=createEyeView($(id)),lids=new EyelidDynamics();
  view.setView(0,0,.43);view.setOrbit(false);
  return (angles,time=0)=>view.draw(angles,lids.sample(angles,time),{faceType:$('faceType').value});
}

async function start(){
  const response=await fetch('./models-selected.json',{cache:'no-store'});if(!response.ok)throw Error('Model file unavailable');
  const bundle=await response.json();if(bundle.fps!==DEMO_FPS||!bundle.models?.[DEMO_MODEL])throw Error('Model version mismatch');
  const sim=new DemoSimulation(bundle.models[DEMO_MODEL]);
  const drawPatient=eyeView('eyeFocus'),drawReference=eyeView('referenceEyes');
  // Fixed camera projection for the simple demo; this is not a calibrated examination.
  const cameraConfig={enabled:false,ready:true,refresh(){},constraints(){return {};}};
  const finger=new FingerCamera(cameraConfig);
  let input='auto',playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,acc=0,last=performance.now();
  const zero=[0,0,0,0];
  function playback(){
    $('pauseDemo').textContent=playing?'Pause':'Play';
    $('inputLabel').textContent=input==='auto'?'Automatic left–right tracking':'Camera fingertip tracking';
    $('demoStatus').textContent=playing?(input==='auto'?'Automatic loop. Pause to inspect, or switch to fingertip tracking.':'Move one index finger. Gaze holds when tracking is lost.'):'Eye motion paused. Press Play to continue.';
  }
  function reset(){sim.reset();acc=0;last=performance.now();drawPatient(zero);drawReference(zero);}
  function choose(key){
    sim.select(key);acc=0;last=performance.now();
    choices.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.case===key)));
    $('caseDescription').textContent=caseText[key][1];$('caseBadge').textContent=sim.case.number+' · '+caseText[key][0];
    drawPatient(zero);drawReference(zero);playback();
  }
  choices.forEach(b=>{b.disabled=false;b.onclick=()=>choose(b.dataset.case);});
  $('pauseDemo').disabled=false;$('restartDemo').disabled=false;$('cameraStart').disabled=false;
  $('pauseDemo').onclick=()=>{playing=!playing;acc=0;playback();};
  $('restartDemo').onclick=()=>{reset();playback();};
  $('cameraStart').onclick=async()=>{
    input='live';playing=true;reset();$('cameraPanel').hidden=false;$('cameraStatus').hidden=false;$('cameraStop').hidden=false;playback();
    await finger.start();
    if(!finger.active){input='auto';reset();$('cameraPanel').hidden=true;$('cameraStop').hidden=true;playback();}
  };
  $('cameraStop').onclick=()=>{
    finger.stop();input='auto';reset();$('cameraPanel').hidden=true;$('cameraStatus').hidden=true;$('cameraStop').hidden=true;playback();
  };
  function tick(){
    if(input==='live'){
      if(!finger.tracked)return;
      const target=finger.target();if(target)sim.step(target);
    }else sim.step(demoTarget(sim.time).target);
  }
  function render(){
    const current=sim.current;drawPatient(current?.output||zero,current?.time||0);drawReference(current?.baseline||zero,current?.time||0);
    const x=current?.target[0]||0,z=current?.target[2]||.7;
    const degrees=Math.atan2(x,z)*180/Math.PI;
    // Fixed frontal view: anatomical right is screen-left. No angle magnification.
    $('targetDot').style.left=`${Math.max(4,Math.min(96,50-degrees/35*46))}%`;
    const phase=input==='live'?(finger.tracked?'Following fingertip':'Waiting for fingertip'):phaseText[demoTarget(current?.time||0).phase];
    if($('phase').textContent!==phase)$('phase').textContent=phase;
    $('cameraStart').hidden=input==='live';
  }
  function animate(now){
    if(playing){acc+=Math.min((now-last)/1000,.05);while(acc>=1/DEMO_FPS){tick();acc-=1/DEMO_FPS;}}
    last=now;render();requestAnimationFrame(animate);
  }
  choose(DEMO_CASES[0].key);playback();requestAnimationFrame(animate);
  window.demo=Object.freeze({sim,finger,choose,reset,get input(){return input;},get playing(){return playing;},get current(){return sim.current;}});
}
start().catch(error=>{$('demoStatus').textContent='Demo could not load. Refresh to retry: '+error.message;$('demoStatus').classList.add('error');});
