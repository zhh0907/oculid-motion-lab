import {createEyeRig} from './src/eye-rig.mjs?v=face6';
import {appearanceFrame,EyelidDynamics} from './src/eyelid-model.mjs?v=canthus3';
import {simplifyUI} from './simplify-ui.js?v=simple2';
import {mountPatientControls,downloadJSON} from './patient-ui.mjs?v=simple2';
import {MODEL_VERSION,PLANT} from './patient-model.mjs';
import {FingerCamera} from './camera.js?v=review7';
import {ScreenCalibration} from './calibration.js';
import {rotateCameraRay} from './calibration-math.js';
import * as T from './vendor/three.module.js';
import {LearnedModel,desired,ray,angularError,rad} from './engine.js';
const $=id=>document.getElementById(id);
const lidDynamics=new EyelidDynamics();
const calibration=new ScreenCalibration();
const finger=new FingerCamera(calibration),isCamera=()=>$('source').value==='camera';
let wasTracked=false;
$('camY').oninput=()=>$('camYValue').textContent=Number($('camY').value).toFixed(2)+' m';
for(const id of ['cameraDepth','cameraFov','cameraSmooth'])$(id).oninput=()=>$(id+'Value').textContent=id==='cameraDepth'?Number($(id).value).toFixed(2)+' m':$(id).value+(id==='cameraFov'?'°':' ms');
const [{fps,models},report]=await Promise.all(['models-selected.json','report.json'].map(async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p+' unavailable');return r.json();}));
// Replay is optional: avoid downloading 37 MB before a phone can use the camera.
const records=[];
async function loadRecordings(){
 const response=await fetch('./recordings/index.json');if(!response.ok)throw Error('Replay index unavailable');
 const manifest=await response.json();
 if(manifest.schema!=='binocular-replay-files-v1'||!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Replay index is invalid');
 // Split files support GitHub browser uploads; values and record order are unchanged.
 const rows=await Promise.all(manifest.files.map(async name=>{
  if(!/^record-\d+\.json$/.test(name))throw Error('Invalid replay filename');
  const r=await fetch('./recordings/'+name);if(!r.ok)throw Error('Replay file unavailable: '+name);return r.json();
 }));
 records.push(...rows);
 records.forEach((r,i)=>$('record').add(new Option(`${r.task} · Subject ${r.subject} · ${r.time[0].toFixed(1)}s`,i)));
}
const learned=Object.fromEntries(Object.entries(models).map(([k,v])=>[k,new LearnedModel(v)]));
const labels={gru_expanded_520:'GRU · Expanded data (default)',gru_dynamics_long:'GRU · Long training'};
$('mode').replaceChildren(...Object.entries(labels).map(([key,title])=>new Option(title,key+'_new')),
 new Option('Geometric reference','ideal'),new Option('Recorded gaze (replay only)','gaze'));
$('mode').value='gru_expanded_520_new';
const scene=new T.Scene();scene.background=new T.Color('#101925');scene.add(new T.HemisphereLight(0xd5eaff,0x253245,2.6));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-1,2,2);scene.add(sun);
const grid=new T.GridHelper(4,40,0x3c5765,0x22323e);grid.position.y=-.42;scene.add(grid);
const external=new T.PerspectiveCamera(42,1,.01,20),chestCamera=new T.PerspectiveCamera(60,1.6,.01,10);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('view').prepend(renderer.domElement);
const chestRenderer=new T.WebGLRenderer({antialias:true});chestRenderer.setPixelRatio(Math.min(devicePixelRatio,2));$('chest').prepend(chestRenderer.domElement);
let orbit={az:.8,el:.30,d:2.1};
const pointers=new Map(),zoom=f=>orbit.d=Math.max(.4,Math.min(5,orbit.d*f));
const distance=()=>{const [a,b]=[...pointers.values()];return a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;};
renderer.domElement.onpointerdown=e=>{pointers.set(e.pointerId,[e.clientX,e.clientY]);renderer.domElement.setPointerCapture(e.pointerId);};
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,e=>pointers.delete(e.pointerId));
renderer.domElement.onpointermove=e=>{
 const previous=pointers.get(e.pointerId);if(!previous)return;
 const before=distance();pointers.set(e.pointerId,[e.clientX,e.clientY]);
 if(pointers.size===1){orbit.az-=(e.clientX-previous[0])*.008;orbit.el=Math.max(-.1,Math.min(1.3,orbit.el+(e.clientY-previous[1])*.006));}
 else{const after=distance();if(before>0&&after>0)zoom(before/after);}
};
renderer.domElement.onwheel=e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));};
$('zoomIn').onclick=()=>zoom(.8);$('zoomOut').onclick=()=>zoom(1.25);$('viewReset').onclick=()=>orbit={az:.8,el:.30,d:2.1};
// Keep wide result tables scrollable without widening a phone viewport.
const wrapTables=()=>document.querySelectorAll('table').forEach(table=>{if(!table.parentElement.classList.contains('table-scroll')){const box=document.createElement('div');box.className='table-scroll';table.before(box);box.append(table);}});
new MutationObserver(wrapTables).observe(document.querySelector('main>section'),{childList:true,subtree:true});wrapTables();
const sphere=(radius,color)=>new T.Mesh(new T.SphereGeometry(radius,32,24),new T.MeshStandardMaterial({color,roughness:.38}));
const target=sphere(.017,0xffb85e);scene.add(target);
const eyes=[],lines=[];
for(let i=0;i<2;i++){
 const rig=createEyeRig(i),{root,yaw,pitch}=rig;scene.add(root);eyes.push(rig);const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:i?0x649bde:0x50bfa4}));scene.add(line);lines.push(line);
}
const head=new T.Mesh(new T.SphereGeometry(1,32,24),new T.MeshStandardMaterial({color:0x53687b,transparent:true,opacity:.13,depthWrite:false}));head.scale.set(.082,.105,.07);head.position.set(0,-.012,-.07);scene.add(head);
const torso=new T.Mesh(new T.BoxGeometry(.22,.24,.085),new T.MeshStandardMaterial({color:0x283e53,metalness:.4,roughness:.6}));torso.position.set(0,-.27,-.07);scene.add(torso);
const cameraBody=new T.Mesh(new T.BoxGeometry(.045,.028,.025),new T.MeshStandardMaterial({color:0x6adac3}));scene.add(cameraBody);
const axes=new T.AxesHelper(.13);axes.position.set(-.18,-.38,0);scene.add(axes);
const eyeInset=$('eyeFocus');
const eyeRenderer=new T.WebGLRenderer({antialias:true});eyeRenderer.setPixelRatio(Math.min(devicePixelRatio,2));eyeInset.prepend(eyeRenderer.domElement);
const eyeCamera=new T.OrthographicCamera(-.065,.065,.041,-.041,.01,2);eyeCamera.position.set(0,0,.18);eyeCamera.lookAt(0,0,-.02);eyeCamera.layers.set(2);
eyes.forEach(e=>e.root.traverse(o=>o.layers.enable(2)));scene.children.filter(o=>o.isLight).forEach(o=>o.layers.enable(2));
let playing=true,frame=0,elapsed=0,acc=0,prevTarget=null,current=null,history=[],exportRows=[],runInfo=null;
const patients=mountPatientControls({onChange:()=>reset()});
const record=()=>records[+$('record').value||0],isData=()=>$('source').value==='data';
function reset(){lidDynamics.reset();frame=0;elapsed=0;acc=0;prevTarget=null;current=null;history=[];exportRows=[];runInfo=null;patients.layer.reset();Object.values(learned).forEach(m=>m.reset());}
function cameraProvenance(){$('provenance').textContent=calibration.enabled?'RGB fingertip tracking uses this computer’s calibration profile. Extrinsics are manually measured and depth is assumed; the eye-motion models have not been validated on real fingertip tracking.':'RGB fingertip tracking is active. Depth and camera intrinsics are assumed; the eye model was trained on VR target tasks and has not been validated for real fingertip following.';}
function updateControls(){const data=isData(),cam=isCamera();if(!cam)finger.stop();$('cameraControls').hidden=!cam;$('cameraPanel').hidden=!cam;$('speed').disabled=cam;$('recordControls').hidden=!data;$('syntheticControls').hidden=data||cam;$('speedControls').hidden=cam;$('scrub').hidden=!data;wasTracked=false;for(const id of ['x','y','z','path'])$(id).disabled=data||cam;$('calibrationPanel').hidden=!cam;$('record').disabled=!data;if(!data&&$('mode').value==='gaze')$('mode').value='gru_expanded_520_new';$('scrub').disabled=!data;$('provenance').textContent=data?`GazeBaseVR · ${record().file}. Continuous valid segment on a 250 Hz grid; human recordings include measurement noise.`:'Synthetic trajectories explore generalization; vertical and circular motion have not been validated against human behavior.';if(cam)cameraProvenance();for(const o of $('mode').options){o.hidden=o.value==='gaze'&&!data;o.disabled=data?!Array.isArray(record()[o.value]):o.value==='gaze';}if(data&&!Array.isArray(record()[$('mode').value]))$('mode').value='ideal';reset();calibration.refresh();}
for(const id of ['record','mode','path'])$(id).onchange=updateControls;
let previousSource=$('source').value;
const replayStatus=document.createElement('p');replayStatus.className='help';replayStatus.id='replayStatus';replayStatus.setAttribute('role','status');replayStatus.hidden=true;$('source').after(replayStatus);
$('source').onchange=async()=>{
 const selected=$('source').value;
 if(selected==='data'&&!records.length){
  $('source').value=previousSource;$('source').disabled=true;replayStatus.hidden=false;replayStatus.textContent='Loading human replay data. The first load may take a moment…';
  try{await loadRecordings();replayStatus.hidden=true;}
  catch(error){replayStatus.textContent='Replay data failed to load. Select Dataset replay again to retry. '+error.message;return;}
  finally{$('source').disabled=false;}
 }
 $('source').value=selected;previousSource=selected;updateControls();
};
window.addEventListener('calibrationchange',()=>{reset();calibration.refresh();if(isCamera())cameraProvenance();});
for(const id of ['x','y','z'])$(id).oninput=()=>{$(id+'v').textContent=(+$(id).value).toFixed(2);};
$('pause').onclick=()=>{playing=!playing;$('pause').textContent=playing?'Pause':'Resume';};$('reset').onclick=reset;
$('scrub').oninput=()=>{if(isData()){
 frame=Math.floor(+$('scrub').value/1000*(record().time.length-1));history=[];exportRows=[];runInfo=null;current=null;
 patients.layer.reset();lidDynamics.reset();
 // Reconstruct history-dependent patient state instead of applying a static angle offset.
 if(patients.active)for(let i=0;i<frame;i++)patients.layer.step(record()[$('mode').value][i],1/fps);
 step(false);
}};
function synthetic(t){const x=+$('x').value,y=+$('y').value,z=+$('z').value;switch($('path').value){case'horizontal':return[x+.2*Math.sin(t*1.2),y,z];case'vertical':return[x,y+.15*Math.sin(t*1.2),z];case'depth':return[x,y,Math.max(.22,z+.2*Math.sin(t))];case'circle':return[x+.2*Math.cos(t),y+.15*Math.sin(t),z];case'step':return[x+(Math.floor(t/2)%2?.2:-.2),y,z];default:return[x,y,z];}}
function step(advance=true){let p,e,a,ideal,human=null,t;const mode=$('mode').value;
 if(isCamera()){if(!finger.tracked){wasTracked=false;
   // No synthetic observations while the finger is absent. Freeze patient state as well.
   if(!current)current={p:[0,0,1],e:[[-.032,0,0],[.032,0,0]],a:[0,0,0,0],baseline:[0,0,0,0],ideal:[0,0,0,0],human:null,t:elapsed};
   return;
 }else if(!wasTracked){prevTarget=null;Object.values(learned).forEach(m=>m.reset());wasTracked=true;}}
 if(isData()&&frame===0&&current&&current.t>0){patients.layer.reset();history=[];exportRows=[];runInfo=null;}
 if(isData()){const r=record();frame=Math.min(frame,r.time.length-1);p=r.target[frame];e=r.eyes;ideal=r.ideal[frame];human=r.gaze[frame];a=r[mode==='ideal'?'ideal':mode][frame];t=r.time[frame]-r.time[0];if(advance)frame=(frame+1)%r.time.length;
 }else{t=elapsed;p=isCamera()?finger.target():synthetic(t);if(!p){if(current)return;p=[0,0,1];}e=[[-.032,0,0],[.032,0,0]];ideal=desired(p,e);const x=ideal.map(v=>v/30).concat(ideal.map((v,i)=>Math.max(-600,Math.min(600,prevTarget?(v-prevTarget[i])*fps:0))/300));prevTarget=ideal;a=mode.endsWith('_new')?learned[mode.slice(0,-4)].step(x):ideal;if(advance)elapsed+=1/fps;}
 const baseline=[...a];
 if(!runInfo)runInfo={...patients.provenance,source:$('source').value,controller:mode,fps,
   layerInitialState:patients.layer.snapshot(),plant:{...PLANT},
   coordinates:'degrees; +yaw = simulated person right; [left yaw,left pitch,right yaw,right pitch]',
   settings:Object.fromEntries(['path','x','y','z','cameraDepth','cameraFov','cameraSmooth','camY'].map(id=>[id,$(id).value])),
   recording:isData()?record().file:null,calibrationEnabled:calibration.enabled};
 a=patients.layer.step(baseline,1/fps);
 const lids=lidDynamics.sample(a,t);
 current={p,e,a,baseline,ideal,human,t,lids,patientId:patients.active?.id||null};history.push([t,ideal[0],a[0],human?.[0]]);if(history.length>fps*6)history.shift();if(exportRows.length<fps*120)exportRows.push([t,...p,...a,...ideal,...baseline]);}
function render(){if(!current)step(false);$('patientRunExport').disabled=!exportRows.length;$('export').disabled=!exportRows.length;const {p,e,a,ideal,t}=current;const lids=current.lids||appearanceFrame(a,t);target.position.set(...p);target.visible=!isCamera()||!!finger.tracked;
 for(let i=0;i<2;i++){eyes[i].root.position.set(...e[i]);eyes[i].yaw.rotation.set(0,rad(a[2*i]),0);eyes[i].pitch.rotation.set(-rad(a[2*i+1]),0,0);eyes[i].update(a.slice(2*i,2*i+2),lids[i]);const d=ray(a.slice(2*i,2*i+2)),len=Math.hypot(...p.map((v,j)=>v-e[i][j]))+.08;const points=[new T.Vector3(...e[i]),new T.Vector3(...e[i].map((v,j)=>v+d[j]*len))];lines[i].geometry.setFromPoints(points);}
 chestCamera.position.set(0,-+$('camY').value,0);chestCamera.up.set(0,1,0);chestCamera.lookAt(0,chestCamera.position.y,1);
 if(isCamera()&&calibration.enabled){const c=calibration.profile.camera,d=rotateCameraRay([0,0,1],c),up=rotateCameraRay([0,1,0],c);chestCamera.position.set(c.x,c.y,c.z);chestCamera.up.set(...up);chestCamera.lookAt(c.x+d[0],c.y+d[1],c.z+d[2]);}
 cameraBody.position.copy(chestCamera.position);cameraBody.quaternion.copy(chestCamera.quaternion);
 const focus=new T.Vector3(0,-.07,.35);external.position.set(focus.x+orbit.d*Math.sin(orbit.az)*Math.cos(orbit.el),focus.y+orbit.d*Math.sin(orbit.el),focus.z+orbit.d*Math.cos(orbit.az)*Math.cos(orbit.el));external.lookAt(focus);
 const w=$('view').clientWidth,h=$('view').clientHeight;if(w&&h){renderer.setSize(w,h,false);external.aspect=w/h;external.updateProjectionMatrix();renderer.render(scene,external);}
 const cw=$('chest').clientWidth,ch=$('chest').clientHeight;if(cw&&ch)chestRenderer.setSize(cw,ch,false);chestCamera.aspect=isCamera()&&finger.video.videoWidth?finger.video.videoWidth/finger.video.videoHeight:(cw&&ch?cw/ch:1.6);chestCamera.fov=isCamera()?+$('cameraFov').value:60;$('chest').querySelector('.caption').textContent=isCamera()&&calibration.enabled?'Virtual camera · Calibrated projection (undistorted)':`Virtual chest camera · Vertical FOV ${chestCamera.fov}°`;chestCamera.updateProjectionMatrix();
 if(isCamera()&&calibration.enabled){const i=calibration.profile.intrinsics,n=chestCamera.near,f=chestCamera.far;chestCamera.projectionMatrix.set(2*i.fx/i.width,0,1-2*i.cx/i.width,0,0,2*i.fy/i.height,2*i.cy/i.height-1,0,0,0,-(f+n)/(f-n),-2*f*n/(f-n),0,0,-1,0);chestCamera.projectionMatrixInverse.copy(chestCamera.projectionMatrix).invert();}
 cameraBody.visible=false;lines.forEach(l=>l.visible=false);if(cw&&ch)chestRenderer.render(scene,chestCamera);cameraBody.visible=true;lines.forEach(l=>l.visible=true);
 const ea=eyeInset.clientWidth/eyeInset.clientHeight,ey=Math.max(.033,.055/ea);eyeCamera.left=-ey*ea;eyeCamera.right=ey*ea;eyeCamera.top=ey;eyeCamera.bottom=-ey;if(calibration.enabled&&document.fullscreenElement===eyeInset){const s=calibration.profile.screen;eyeCamera.left=-s.widthM/2;eyeCamera.right=s.widthM/2;eyeCamera.top=s.heightM/2;eyeCamera.bottom=-s.heightM/2;}eyeCamera.updateProjectionMatrix();eyeRenderer.setSize(eyeInset.clientWidth,eyeInset.clientHeight,false);eyeRenderer.domElement.style.transform=isCamera()&&!calibration.enabled&&finger.facing==='environment'?'scaleX(-1)':'';eyeRenderer.render(scene,eyeCamera);
 chestCamera.updateMatrixWorld();const cp=new T.Vector3(...p).project(chestCamera),inFrame=Math.abs(cp.x)<=1&&Math.abs(cp.y)<=1&&cp.z>=-1&&cp.z<=1;
 $('leftError').textContent=angularError(a.slice(0,2),ideal.slice(0,2)).toFixed(2)+'°';$('rightError').textContent=angularError(a.slice(2),ideal.slice(2)).toFixed(2)+'°';$('vergence').textContent=(a[0]-a[2]).toFixed(2)+'°';$('visible').textContent=inFrame?'Yes':'No';$('visible').style.color=inFrame?'#6adac3':'#ffae7d';
 $('status').textContent=`t = ${t.toFixed(2)} s · Left yaw/pitch (${a[0].toFixed(1)}, ${a[1].toFixed(1)})° / Right (${a[2].toFixed(1)}, ${a[3].toFixed(1)})° · 4 angles total; torsion = 0`;
 if(isCamera()&&!finger.tracked){for(const id of ['leftError','rightError','vergence'])$(id).textContent='—';$('visible').textContent='Not tracked';$('status').textContent='Waiting for fingertip · Holding eye position · Yaw / pitch only';}
 if(isData())$('scrub').value=frame/(record().time.length-1)*1000;drawPlot();}
function drawPlot(){const c=$('plot'),w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;c.width=w*devicePixelRatio;c.height=h*devicePixelRatio;const ctx=c.getContext('2d');ctx.scale(devicePixelRatio,devicePixelRatio);ctx.fillStyle='#91a2b8';ctx.font='10px Segoe UI';for(const y of [-30,0,30]){const yy=h/2-y*h/80;ctx.strokeStyle='#293649';ctx.beginPath();ctx.moveTo(30,yy);ctx.lineTo(w,yy);ctx.stroke();ctx.fillText(y+'°',0,yy-3);}if(history.length<2)return;const end=history.at(-1)[0],start=end-6;['#ffc56b','#6adac3','#be9cff'].forEach((col,j)=>{ctx.strokeStyle=col;ctx.lineWidth=1.4;ctx.beginPath();let pen=false;for(const r of history){if(r[j+1]==null){pen=false;continue;}const x=30+(r[0]-start)/6*(w-30),y=h/2-r[j+1]*h/80;if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true;}ctx.stroke();});}
function exportRun(){return {schema:'gaze-patient-run-v1',modelVersion:MODEL_VERSION,run:runInfo,
  samples:exportRows.map((r,i)=>({sample:i,timeSeconds:r[0],dtSeconds:1/fps,target:r.slice(1,4),
    outputAngles:r.slice(4,8),idealAngles:r.slice(8,12),referenceAngles:r.slice(12,16)})),
  limitSeconds:120,bufferFull:exportRows.length>=fps*120};}
$('patientRunExport').onclick=()=>downloadJSON(exportRun(),`gaze-run-${patients.active?.id||'reference'}.json`);
$('export').onclick=()=>{const txt='time_s,target_x_m,target_y_m,target_z_m,left_yaw_deg,left_pitch_deg,right_yaw_deg,right_pitch_deg,ideal_left_yaw,ideal_left_pitch,ideal_right_yaw,ideal_right_pitch,reference_left_yaw,reference_left_pitch,reference_right_yaw,reference_right_pitch,patient_id,library_id,patient_model_version\n'+exportRows.map(r=>[...r,patients.active?.id||'reference',patients.library.libraryId,MODEL_VERSION].join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv'}));a.download=`eye_trace_${patients.active?.id||'reference'}_${$('mode').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
updateControls();let last=performance.now();function animate(now){if(playing){acc+=Math.min((now-last)/1000,.1)*(isCamera()?1:+$('speed').value);while(acc>=1/fps){step();acc-=1/fps;}}last=now;render();requestAnimationFrame(animate);}requestAnimationFrame(animate);
simplifyUI();
window.lab={scene,eyes,records,report,finger,patients,exportRun,get current(){return current;}};
