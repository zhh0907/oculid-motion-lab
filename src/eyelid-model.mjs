// Metres, seconds, degrees. Appearance is downstream of gaze and never changes it.
export const LID_VERSION = 'procedural-lids-v1';
export const DEFAULT_APPEARANCE = Object.freeze({openness:1,follow:1,blink:true,blinkPeriod:4.6,ptosisLeft:0,ptosisRight:0,pupilMm:4.6,skin:'#bf8b71',iris:'#6c7148'});
export const EYE_RADIUS=.012;
export const HALF_WIDTH=.0116;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export function blinkEnvelope(elapsed){
  if(elapsed<0||elapsed>=.32)return 0;
  if(elapsed<.085)return smooth(elapsed/.085);
  if(elapsed<.115)return 1;
  return 1-smooth((elapsed-.115)/.205);
}
export function closureAt(time,options={},manualTime=-Infinity){
  const o={...DEFAULT_APPEARANCE,...options};
  const period=clamp(o.blinkPeriod,1,15);
  const phase=time-1.7;
  const automatic=o.blink&&phase>=0?blinkEnvelope(phase%period):0;
  return Math.max(automatic,blinkEnvelope(time-manualTime));
}
export function lidState(pitch,closure=0,options={},eyeIndex=0){
  const o={...DEFAULT_APPEARANCE,...options};
  const open=clamp(o.openness,0,1.4),follow=clamp(o.follow,0,1.5);
  const gaze=Math.sin(clamp(pitch,-45,45)*Math.PI/180);
  const upper=(.0048+.008*gaze*follow)*open;
  const lower=(-.0037+.004*gaze*follow)*open;
  const ptosis=clamp(eyeIndex?o.ptosisRight:o.ptosisLeft,0,1);
  const top=Math.max(lower,upper-ptosis*.006);
  const closed=clamp(closure,0,1);
  // Upper lid traverses 80% of the aperture; lower lid traverses 20%.
  const seam=lower+(top-lower)*.2;
  return {upper:closed===1?seam:top+(seam-top)*closed,lower:closed===1?seam:lower+(seam-lower)*closed,closure:closed,halfWidth:HALF_WIDTH,side:eyeIndex? -1:1};
}
export function lidBounds(x,state){
  const u=clamp(x/state.halfWidth,-1,1);
  const profile=Math.pow(Math.max(0,1-u*u),.66);
  const tilt=-state.side*u*.00065;
  return {upper:state.upper*profile+tilt,lower:state.lower*profile+tilt};
}
export function skinZ(x,y){
  // The contact surface clears both the globe and the simplified corneal bulge.
  const r2=x*x+y*y;
  return Math.sqrt(Math.max(0,EYE_RADIUS*EYE_RADIUS-r2))+.0015*Math.exp(-r2/.000035)+.00055;
}
export function rotateEyePoint(point,yaw,pitch){
  const h=yaw*Math.PI/180,v=pitch*Math.PI/180,[x,y,z]=point;
  const yy=y*Math.cos(v)+z*Math.sin(v),zz=-y*Math.sin(v)+z*Math.cos(v);
  return [x*Math.cos(h)+zz*Math.sin(h),yy,-x*Math.sin(h)+zz*Math.cos(h)];
}
export function pupilVisibility(yaw,pitch,state,pupilMm=4.6){
  // Front orthographic geometric estimate, NOT a camera eye-tracker confidence.
  let visible=0,total=0;
  const radius=clamp(pupilMm,2,8)/2000;
  for(let ring=0;ring<6;ring++)for(let i=0;i<32;i++){
    const r=radius*Math.sqrt((ring+.5)/6),theta=i/32*Math.PI*2;
    const [x,y,z]=rotateEyePoint([r*Math.cos(theta),r*Math.sin(theta),Math.sqrt(.01215**2-r*r)],yaw,pitch);
    const b=lidBounds(x,state);total++;
    if(z>0&&Math.abs(x)<state.halfWidth&&y>b.lower&&y<b.upper)visible++;
  }
  return visible/total;
}
export function appearanceFrame(angles,time,options={},manualTime=-Infinity){
  if(angles.length!==4||!angles.every(Number.isFinite)||!Number.isFinite(time))throw Error('Invalid gaze sample');
  const closure=closureAt(time,options,manualTime);
  return [0,1].map(i=>{
    const state=lidState(angles[2*i+1],closure,options,i);
    return {...state,pupilVisibility:pupilVisibility(angles[2*i],angles[2*i+1],state,options.pupilMm)};
  });
}
