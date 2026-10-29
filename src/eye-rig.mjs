import * as T from '../vendor/three.module.js';
import {createGlobeRig} from './globe-mesh.mjs?v=volume7';
import {createHeadSkin} from './head-mesh.mjs?v=volume7';
export {createHeadSkin};
export const createEyeRig=createGlobeRig;
function studioEnvironment(renderer){
  const room=new T.Scene();room.background=new T.Color('#79817f');
  for(const [x,y,z,w,h,strength]of [[-.8,1.1,2,1.1,.7,4],[1,.25,2,.35,.6,2]]){
    const box=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(strength,strength,strength),side:T.DoubleSide}));box.position.set(x,y,z);box.lookAt(0,0,0);room.add(box);
  }
  const gen=new T.PMREMGenerator(renderer),target=gen.fromScene(room,.04,.1,5);gen.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target;
}
export function createEyeView(host,{bare=false,background='#192627'}={}){
  const scene=new T.Scene();scene.background=new T.Color(background);
  scene.add(new T.HemisphereLight('#fff1e6','#51575c',.65));
  const key=new T.DirectionalLight('#fff1e4',2.8);key.position.set(-.16,.18,.32);scene.add(key);
  const fill=new T.DirectionalLight('#dfeaf4',.85);fill.position.set(.19,-.015,.20);scene.add(fill);
  const rim=new T.DirectionalLight('#e8f1f5',1);rim.position.set(.05,.15,-.18);scene.add(rim);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;host.prepend(renderer.domElement);
  if(!bare){
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-.14;key.shadow.camera.right=.14;
    key.shadow.camera.top=.15;key.shadow.camera.bottom=-.18;key.shadow.camera.near=.04;key.shadow.camera.far=.85;
    key.shadow.bias=-.00010;key.shadow.normalBias=.00015;key.shadow.radius=4;key.shadow.blurSamples=8;
  }
  const environment=studioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.25;
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',bare?'同步三维眼球对照':'一体化三维头部、动态眼睑与分层眼球，可旋转观察');
  const camera=new T.PerspectiveCamera(18,1,.005,3),target=new T.Vector3(0,-.018,-.025);
  const orbit={yaw:bare?0:.28,pitch:.04,distance:.43,enabled:!bare},pointers=new Map();
  function orient(){camera.position.set(target.x+orbit.distance*Math.sin(orbit.yaw)*Math.cos(orbit.pitch),target.y+orbit.distance*Math.sin(orbit.pitch),target.z+orbit.distance*Math.cos(orbit.yaw)*Math.cos(orbit.pitch));camera.lookAt(target);}
  orient();
  const rigs=[0,1].map(i=>{const r=createGlobeRig(i,{bare});r.root.position.x=i?.032:-.032;scene.add(r.root);return r;});
  const head=bare?null:createHeadSkin();if(head){scene.add(head.group);rigs.forEach((r,i)=>{r.skinGeometry=head.geometry;r.cornerGeometries=head.cornerGeometries.slice(i*2,i*2+2);});}
  const canvas=renderer.domElement;
  if(!bare){canvas.tabIndex=0;canvas.title='拖动或方向键旋转；滚轮或 +/- 缩放';}
  canvas.addEventListener('pointerdown',e=>{if(!orbit.enabled)return;e.preventDefault();e.stopPropagation();pointers.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!orbit.enabled)return;const previous=pointers.get(e.pointerId);if(!previous)return;e.preventDefault();e.stopPropagation();orbit.yaw=Math.max(-1.45,Math.min(1.45,orbit.yaw+(e.clientX-previous[0])*.007));orbit.pitch=Math.max(-.45,Math.min(.55,orbit.pitch+(e.clientY-previous[1])*.006));pointers.set(e.pointerId,[e.clientX,e.clientY]);orient();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>pointers.delete(e.pointerId));
  canvas.addEventListener('wheel',e=>{if(!orbit.enabled)return;e.preventDefault();orbit.distance=Math.max(.25,Math.min(1.15,orbit.distance*Math.exp(e.deltaY*.0007)));orient();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(!orbit.enabled)return;const moves={ArrowLeft:[-.07,0],ArrowRight:[.07,0],ArrowUp:[0,-.05],ArrowDown:[0,.05]};if(moves[e.key]){e.preventDefault();orbit.yaw=Math.max(-1.45,Math.min(1.45,orbit.yaw+moves[e.key][0]));orbit.pitch=Math.max(-.45,Math.min(.55,orbit.pitch+moves[e.key][1]));orient();}else if(['+','=','-'].includes(e.key)){e.preventDefault();orbit.distance=Math.max(.25,Math.min(1.15,orbit.distance*(e.key==='-'?1.1:.9)));orient();}});
  let oldW=0,oldH=0,mode='skin';
  function draw(angles,states,appearance={}){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    if(w!==oldW||h!==oldH){oldW=w;oldH=h;renderer.setSize(w,h,false);const halfY=Math.max(bare?.024:.06,(bare?.072:.088)/(w/h));camera.aspect=w/h;camera.fov=2*Math.atan(halfY/.43)*180/Math.PI;camera.updateProjectionMatrix();}
    rigs.forEach((r,i)=>r.update(angles.slice(i*2,i*2+2),states[i],appearance));head?.update(states,appearance);renderer.render(scene,camera);
  }
  return {draw,rigs,head,renderer,scene,camera,orbit,
    setOrbit(enabled){orbit.enabled=enabled;pointers.clear();canvas.style.cursor=enabled?'grab':'crosshair';},
    setView(yaw=0,pitch=0,distance=.43){Object.assign(orbit,{yaw,pitch,distance});orient();},
    setMode(value){mode=value;head?.setMode(value);rigs.forEach(r=>r.setMode(value));},get mode(){return mode;}};
}
