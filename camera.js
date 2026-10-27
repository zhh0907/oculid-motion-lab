import {cameraOrientation} from './camera-orientation.js';
import {pixelToPlane} from './camera-math.js';
const $=id=>document.getElementById(id);
export class FingerCamera{
 constructor(calibration){this.calibration=calibration;this.stream=null;this.worker=null;this.point=null;this.seen=0;this.token=0;this.busy=false;this.video=$('cameraVideo');this.canvas=$('cameraOverlay');$('cameraStart').onclick=()=>this.start();$('cameraStop').onclick=()=>this.stop();window.addEventListener('pagehide',()=>this.stop());}
 status(s){$('cameraStatus').textContent=s;}
 get active(){return !!this.stream;}
 get tracked(){return (!this.calibration.enabled||this.calibration.ready)&&this.active&&this.point&&performance.now()-this.seen<350;}
 target(){if(this.calibration.enabled)return this.point?this.calibration.target(this.point):[0,0,this.calibration.profile.targetDepthM];return this.point?pixelToPlane(...this.point,+$('cameraDepth').value,this.video.videoWidth/this.video.videoHeight,+$('cameraFov').value,+$('camY').value):[0,0,1];}
 stop(){this.token++;cancelAnimationFrame(this.raf);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.worker?.terminate();this.worker=null;this.video.srcObject=null;this.point=null;this.seen=0;this.busy=false;this.canvas.getContext('2d').clearRect(0,0,this.canvas.width,this.canvas.height);$('cameraStart').disabled=false;$('cameraFacing').disabled=false;$('cameraStop').disabled=true;this.status('Camera is off. Click “Start camera” to allow access.');this.calibration.refresh();}
 async start(){
  this.stop();const token=this.token;$('cameraStart').disabled=true;$('cameraFacing').disabled=true;this.status('Requesting camera permission…');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Use a camera-capable browser on localhost or HTTPS.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},facingMode:{ideal:$('cameraFacing').value},...this.calibration.constraints()}});
   if(token!==this.token){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;const orientation=cameraOrientation($('cameraFacing').value,stream.getVideoTracks()[0].getSettings());this.facing=orientation.facing;$('cameraPreview').style.transform=orientation.previewMirrored?'scaleX(-1)':'none';$('cameraPreview').dataset.facing=this.facing;this.video.srcObject=stream;if(matchMedia('(max-width:760px)').matches)$('eyeFocus').scrollIntoView({block:'start'});await this.video.play();if(token!==this.token)return;this.calibration.lastRayError=false;this.calibration.refresh();
   stream.getVideoTracks()[0].onended=()=>{this.stop();this.status('Camera disconnected. Reconnect it and start again.');};
   $('cameraStop').disabled=false;this.status('Loading the local hand detector…');
   const worker=this.worker=new Worker('./hand-worker.js');
   worker.onerror=e=>this.fail(e.message,token);
   worker.onmessage=({data})=>{
    if(token!==this.token)return;
    if(data.type==='error'){this.fail(data.message,token);return;}
    if(data.type==='ready'){this.status('Ready. Show one hand with the index fingertip visible.');this.loop(token);return;}
    this.busy=false;const lm=data.landmarks;this.draw(lm);
    if(lm){const p=lm[8],now=performance.now(),tau=+$('cameraSmooth').value/1000;const alpha=this.tracked&&tau>0?1-Math.exp(-(now-this.seen)/1000/tau):1;this.point=this.point?this.point.map((v,i)=>v+alpha*([p.x,p.y][i]-v)):[p.x,p.y];this.seen=now;this.status(`Tracking index fingertip · Image position u ${p.x.toFixed(3)}, v ${p.y.toFixed(3)} · Depth is assumed`);}
    else{this.seen=0;this.status('No hand detected. Holding eye position. Please show one hand.');}
   };
   worker.postMessage({type:'init'});
  }catch(e){this.fail(e.name==='NotAllowedError'?'Camera permission denied. Allow access in the browser and try again.':e.name==='NotFoundError'?'No camera found. Connect a device and try again.':e.message,token);}
 }
 fail(message,token){if(token!==this.token)return;this.stop();this.status('Camera error: '+message);}
 loop(token){let last=-1;const tick=async()=>{if(token!==this.token)return;this.raf=requestAnimationFrame(tick);if(this.busy||this.video.readyState<2||last===this.video.currentTime)return;this.busy=true;last=this.video.currentTime;try{const image=await createImageBitmap(this.video);if(token!==this.token){image.close();return;}this.worker.postMessage({type:'frame',image,timestamp:performance.now()},[image]);}catch(e){this.fail(e.message,token);}};tick();}
 draw(lm){const c=this.canvas;c.width=this.video.videoWidth;c.height=this.video.videoHeight;const g=c.getContext('2d');if(!lm)return;g.strokeStyle='#65d9c1';g.lineWidth=3;for(const chain of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]){g.beginPath();chain.forEach((i,j)=>g[j?'lineTo':'moveTo'](lm[i].x*c.width,lm[i].y*c.height));g.stroke();}const p=lm[8];g.fillStyle='#ffc56b';g.beginPath();g.arc(p.x*c.width,p.y*c.height,9,0,Math.PI*2);g.fill();}
}
