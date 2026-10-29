import {createEyeView} from './eye-rig.mjs?v=faces8';
import {Simulation,FPS,targetAt} from './simulation.mjs?v=faces8';
import {pointerTarget,normalizeRange} from './target-range.mjs?v=canthus3';
import {FingerCamera} from '../camera.js?v=review7';
import {angularError} from '../engine.js';
import {mountPatientPanel} from './patient-panel.mjs?v=faces8';
import {TrajectoryPlot} from './trajectory-plot.mjs?v=faces8';
import {EyePositionRails} from './eye-position-rails.mjs?v=faces8';
const $=id=>document.getElementById(id);
async function start(){
  const response=await fetch('./models-selected.json');if(!response.ok)throw Error('Model could not be loaded');
  const sim=new Simulation(await response.json());
  const view=createEyeView($('eyeFocus')),bare=createEyeView($('bareEyes'),{bare:true,background:'#e2e7df'});
  const finger=new FingerCamera({enabled:false,ready:true,refresh(){},constraints(){return {};}});
  let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,acc=0,last=performance.now(),wasTracked=false,pointer=[0,0,.7],fpsStart=last,frames=0;
  function range(){return $('rangePreset').value==='legacy'?null:normalizeRange({horizontal:+$('horizontalRange').value,up:+$('upRange').value,down:+$('downRange').value});}
  function settings(){return {targetRange:$('source').value==='camera'?null:range(),source:$('source').value,path:$('path').value,depth:+$('depth').value,cameraFov:+$('cameraFov').value,cameraY:+$('camY').value,depthAssumed:true,appearanceRenderer:'connected-head-v8'};}
  function changed(){acc=0;wasTracked=false;last=performance.now();}
  function reset(){sim.reset();changed();}
  const patients=mountPatientPanel(sim,changed);
  function orbitControls(enabled){view.setOrbit(enabled);$('orbitToggle').setAttribute('aria-pressed',String(enabled));$('viewHint').textContent=enabled?'Drag to rotate · Scroll to zoom':'Guide the gaze · Enable rotation to inspect';}
  $('orbitToggle').onclick=()=>orbitControls(!view.orbit.enabled);
  $('frontView').onclick=()=>{view.setView(0,0,.43);orbitControls(false);};
  $('surfaceView').onchange=()=>view.setMode($('surfaceView').value);
  $('faceType').onchange=()=>sim.setFaceType($('faceType').value);
  const trace=new TrajectoryPlot($('motionTrace'),$('traceView'),$('traceClear'),sim.trace);
  const rails=new EyePositionRails($('eyePositionRails'));
  function playback(){ $('pause').textContent=playing?'Pause':'Resume';$('stateLabel').textContent=playing?'Live binocular simulation':'Paused';}
  $('pause').onclick=()=>{playing=!playing;acc=0;playback();};$('reset').onclick=reset;
  function blink(){sim.blink();if(!playing){playing=true;playback();}}
  $('blink').onclick=blink;
  window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='b'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();blink();}});
  $('fullscreen').onclick=()=>{const p=document.fullscreenElement?document.exitFullscreen():$('eyeFocus').requestFullscreen();p?.catch(()=>{$('status').textContent='Fullscreen is unavailable. Use browser zoom instead.';});};
  $('compare').onchange=()=>{$('comparison').hidden=!$('compare').checked;};
  $('model').onchange=()=>{sim.select({model:$('model').value});changed();};
  $('path').onchange=reset;
  function rangeChanged(){
    for(const id of ['horizontalRange','upRange','downRange'])$(id+'Value').textContent=$(id).value+'°';
    $('rangeControls').hidden=$('rangePreset').value==='legacy';pointer=[0,0,+$('depth').value];reset();
  }
  $('rangePreset').onchange=rangeChanged;
  for(const id of ['horizontalRange','upRange','downRange'])$(id).oninput=rangeChanged;
  $('source').onchange=()=>{
    const source=$('source').value;if(source==='pointer')orbitControls(false);finger.stop();$('cameraPanel').hidden=source!=='camera';$('path').disabled=source!=='auto';$('rangeSection').hidden=source==='camera';
    $('sourceHint').textContent={auto:'The target follows the selected range; patient parameters stay fixed.',pointer:'Move the pointer over the face, or touch and drag.',camera:'Start the camera and guide the gaze with one index finger.'}[source];reset();
  };
  $('depth').oninput=()=>{$('depthValue').textContent=(+$('depth').value).toFixed(2)+' m';$('cameraDepth').value=$('depth').value;pointer[2]=+$('depth').value;reset();};
  $('eyeFocus').onpointermove=e=>{if($('source').value!=='pointer'||view.orbit.enabled)return;const r=$('eyeFocus').getBoundingClientRect(),u=(e.clientX-r.left-r.width/2)/r.width*2,v=-(e.clientY-r.top-r.height/2)/r.height*2;pointer=range()?pointerTarget(u,v,+$('depth').value,range()):[Math.max(-1,Math.min(1,u))*.35,Math.max(-1,Math.min(1,v))*.225,+$('depth').value];};
  $('eyeFocus').onpointerdown=e=>{$('eyeFocus').setPointerCapture(e.pointerId);$('eyeFocus').onpointermove(e);};
  function appearance(){
    Object.assign(sim.appearance,{openness:+$('openness').value,follow:+$('follow').value,blink:$('autoBlink').checked,pupilMm:+$('pupil').value,skin:$('skin').value,iris:$('iris').value,ptosisLeft:+$('ptosisLeft').value,ptosisRight:+$('ptosisRight').value});
    for(const id of ['openness','follow','ptosisLeft','ptosisRight'])$(id+'Value').textContent=Math.round(+$(id).value*100)+'%';
    $('pupilValue').textContent=(+$('pupil').value).toFixed(1)+' mm';reset();
  }
  for(const id of ['openness','follow','autoBlink','pupil','skin','iris','ptosisLeft','ptosisRight'])$(id).oninput=appearance;
  function download(text,type,extension){const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download='oculid-run.'+extension;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('exportJson').onclick=()=>download(JSON.stringify(sim.export(settings()),null,2),'application/json','json');
  $('exportCsv').onclick=()=>{
    const header='time_s,target_x_m,target_y_m,target_z_m,left_yaw_deg,left_pitch_deg,right_yaw_deg,right_pitch_deg,reference_left_yaw,reference_left_pitch,reference_right_yaw,reference_right_pitch,blink_closure,left_upper_m,left_lower_m,right_upper_m,right_lower_m,left_pupil_visible,right_pupil_visible,patient_id,patient_library_id,patient_template,patient_side';
    const rows=sim.rows.map(r=>[r.time,...r.target,...r.angles,...r.baseline,r.lids[0].closure,r.lids[0].upper,r.lids[0].lower,r.lids[1].upper,r.lids[1].lower,...r.lids.map(l=>l.pupilVisibility),sim.patient?.id||'',sim.libraryId||'',sim.patient?.template||'',sim.patient?.side||''].join(','));download([header,...rows].join('\n'),'text/csv','csv');
  };
  function tick(){
    let target;const source=$('source').value;
    if(source==='camera'){if(!finger.tracked){wasTracked=false;return;}if(!wasTracked){sim.reacquire();wasTracked=true;}target=finger.target();}
    else target=source==='pointer'?pointer:targetAt(sim.time,$('path').value,+$('depth').value,range());
    if(target)sim.step(target);
  }
  function draw(now){
    const dt=Math.min((now-last)/1000,.08);last=now;
    if(playing){acc+=dt;while(acc>=1/FPS){tick();acc-=1/FPS;}}
    const f=sim.frame();view.draw(f.angles,f.lids,sim.appearance);if($('compare').checked)bare.draw(f.angles,f.lids,sim.appearance);
    trace.draw(sim.trace,now);$('traceTime').textContent=f.time.toFixed(2)+' s';
    const tracked=$('source').value!=='camera'||finger.tracked;
    rails.update(f,{playing,tracked});
    $('leftError').textContent=tracked?angularError(f.angles.slice(0,2),f.ideal.slice(0,2)).toFixed(2)+'°':'—';
    $('rightError').textContent=tracked?angularError(f.angles.slice(2),f.ideal.slice(2)).toFixed(2)+'°':'—';$('vergence').textContent=(f.angles[0]-f.angles[2]).toFixed(2)+'°';
    $('visibility').textContent=f.lids.map(l=>Math.round(l.pupilVisibility*100)+'%').join(' / ');
    $('lidStatus').textContent=f.lids[0].closure>.05?({closing:'Closing · Upper lid descends',closed:'Closed · Eyes continue moving',opening:'Opening · Upper lid rises'}[f.lids[0].blinkPhase]||'Blinking'):'Lid follow '+Math.round(sim.appearance.follow*100)+'% · Opening '+Math.round(sim.appearance.openness*100)+'%';
    $('targetDot').style.left=Math.max(2,Math.min(98,50+Math.atan2(f.target[0],f.target[2])*180/Math.PI/(range()?.horizontal||35)*46))+'%';$('targetDepth').textContent=f.target[2].toFixed(2)+' m';
    const delta=Math.max(...view.rigs.flatMap((r,i)=>[Math.abs(r.yaw.rotation.y-bare.rigs[i].yaw.rotation.y),Math.abs(r.pitch.rotation.x-bare.rigs[i].pitch.rotation.x)]))*180/Math.PI;
    $('angleDelta').textContent='Δ '+delta.toFixed(6)+'°';
    $('status').textContent=tracked?`t ${f.time.toFixed(2)} s · L (${f.angles[0].toFixed(1)}, ${f.angles[1].toFixed(1)})° · R (${f.angles[2].toFixed(1)}, ${f.angles[3].toFixed(1)})° · yaw / pitch`:'Waiting for fingertip · Gaze and simulation time are held';
    $('exportJson').disabled=$('exportCsv').disabled=!sim.rows.length;$('bufferStatus').textContent=sim.rows.length>=FPS*120?'120-second buffer full. Export or restart.':`${(sim.rows.length/FPS).toFixed(1)} / 120 s · Synchronized gaze and eyelids`;
    frames++;if(now-fpsStart>1000){$('renderFps').textContent=Math.round(frames*1000/(now-fpsStart))+' fps';frames=0;fpsStart=now;}
    requestAnimationFrame(draw);
  }
  for(const id of ['pause','reset','blink'])$(id).disabled=false;playback();requestAnimationFrame(draw);
  window.oculid={sim,view,bare,finger,patients,trace,rails,reset,settings,get playing(){return playing;}};
}
start().catch(error=>{$('status').textContent='Could not start: '+error.message;console.error(error);});
