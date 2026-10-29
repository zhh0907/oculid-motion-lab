import {IRIS_DEPTH} from './eye-anatomy.mjs';
// Metres, seconds, degrees. Eyelids are downstream of gaze: no feedback to motion.
export const LID_VERSION = 'volumetric-lids-v7';
export const DEFAULT_APPEARANCE = Object.freeze({openness:1,follow:1,blink:true,blinkPeriod:4.6,ptosisLeft:0,ptosisRight:0,pupilMm:4.6,skin:'#b98e79',iris:'#503b2c'});
export const EYE_RADIUS=.0124;
export const HALF_WIDTH=.0132;
export const CANTHUS_WIDTH=Object.freeze({nasal:.0028,temporal:.0015});
export function canthusInnerX(v,nasal=true){return HALF_WIDTH-CANTHUS_WIDTH[nasal?'nasal':'temporal']*(1-.18*Math.sin(Math.PI*v));}
export function insideCanthus(x,y,state){
  const b=lidBounds(x,state),gap=b.upper-b.lower;
  if(gap<=0||y<=b.lower||y>=b.upper)return false;
  return Math.abs(x)>=canthusInnerX((y-b.lower)/gap,x*state.side>0);
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rad=x=>x*Math.PI/180;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const smoother=x=>{x=clamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
export function blinkEnvelope(elapsed,scale=1){
  const t=elapsed/scale;if(t<0||t>=.32)return 0;
  if(t<.085)return smoother(t/.085);
  if(t<.115)return 1;
  return 1-smoother((t-.115)/.205);
}
// Fixed, reproducible variation rather than a metronomic interval or frame RNG.
const intervals=Object.freeze([.88,1.18,.76,1.1,.96,1.27,.83,1.02]);
const durations=Object.freeze([1,.91,1.08,.96,1.04,.89,1.12,.97]);
export function blinkAt(time,options={},manualTime=-Infinity){
  const o={...DEFAULT_APPEARANCE,...options},period=clamp(o.blinkPeriod,1,15);
  let closure=0,event=-1,elapsed=-1,scale=1;
  if(o.blink&&time>=1.7){
    const cycle=intervals.reduce((a,b)=>a+b,0)*period;
    let t=(time-1.7)%cycle;
    for(let i=0;i<intervals.length;i++){if(t<period*intervals[i]){event=i;elapsed=t;scale=durations[i];closure=blinkEnvelope(t,scale);break;}t-=period*intervals[i];}
  }
  const manual=blinkEnvelope(time-manualTime);
  if(manual>closure){closure=manual;elapsed=time-manualTime;event=-2;scale=1;}
  return {closure,event,elapsed,scale,phase:closure===0?'open':elapsed<.085*scale?'closing':elapsed<.115*scale?'closed':'opening'};
}
export function closureAt(time,options={},manualTime=-Infinity){return blinkAt(time,options,manualTime).closure;}
export function lidState(pitch,closure=0,options={},eyeIndex=0,yaw=0){
  const o={...DEFAULT_APPEARANCE,...options},open=clamp(o.openness,0,1.4),follow=clamp(o.follow,0,1.5);
  const vertical=Math.sin(rad(clamp(pitch,-60,60))),horizontal=Math.sin(rad(clamp(yaw,-65,65)));
  const upper=(.0048+.0125*vertical*follow)*open;
  const lower=(-.0040+.0080*vertical*follow)*open;
  const ptosis=clamp(eyeIndex?o.ptosisRight:o.ptosisLeft,0,1),top=Math.max(lower,upper-ptosis*.006);
  const closed=clamp(closure,0,1),seam=lower+(top-lower)*.10,side=eyeIndex?-1:1;
  return {upper:closed===1?seam:top+(seam-top)*closed,lower:closed===1?seam:lower+(seam-lower)*closed,
    restUpper:top,restLower:lower,seam,closure:closed,halfWidth:HALF_WIDTH,side,
    // Horizontal displacement fades at fixed canthi; the lower lid also sweeps nasally.
    apexShift:.00145*horizontal*follow+side*.00065*closed,
    nasalSweep:side*.00115*closed,cheekLift:.00065*closed,
    creaseRelaxation:1-.78*closed,browLift:.00065*Math.max(0,vertical)*follow,
    gazeYaw:yaw,gazePitch:pitch,globeYaw:yaw,globePitch:pitch};
}
export function lidBounds(x,state){
  const u=clamp(x/state.halfWidth,-1,1),shift=state.apexShift||0;
  // Reparameterization preserves both corner anchors while translating the apex.
  const s=clamp(u-shift/state.halfWidth*(1-u*u),-1,1);
  const profile=Math.pow(Math.max(0,1-s*s),.72),tilt=-state.side*u*.00055;
  const asymmetry=1-.11*state.side*u;
  const lowerProfile=profile*(1+.08*state.side*u);
  const upperRest=(state.restUpper??state.upper)*profile*asymmetry+tilt;
  const lowerRest=(state.restLower??state.lower)*lowerProfile+tilt;
  const top=Math.max(lowerRest,upperRest),seam=lowerRest+(top-lowerRest)*.10;
  const closure=state.closure||0;
  if(closure===1)return {upper:seam,lower:seam};
  return {upper:top+(seam-top)*closure,lower:lowerRest+(seam-lowerRest)*closure};
}
export function skinZ(x,y,yaw=0,pitch=0,center=null){
  const r2=x*x+y*y,globe=Math.sqrt(Math.max(0,(EYE_RADIUS+.0002)**2-r2));
  // A moving corneal clearance envelope follows the real globe, not the delayed lid.
  const [cx,cy,cz]=center||rotateEyePoint([0,0,.0056],yaw,pitch),cap=.0079**2-(x-cx)**2-(y-cy)**2;
  const cornea=cap>0?cz+Math.sqrt(cap):0;
  return Math.max(globe,cornea)+.00038;
}
export function rotateEyePoint(point,yaw,pitch){
  const h=rad(yaw),v=rad(pitch),[x,y,z]=point;
  const yy=y*Math.cos(v)+z*Math.sin(v),zz=-y*Math.sin(v)+z*Math.cos(v);
  return [x*Math.cos(h)+zz*Math.sin(h),yy,-x*Math.sin(h)+zz*Math.cos(h)];
}
export function pupilVisibility(yaw,pitch,state,pupilMm=4.6){
  let visible=0,total=0;const radius=clamp(pupilMm,2,8)/2000;
  for(let ring=0;ring<6;ring++)for(let i=0;i<32;i++){
    const r=radius*Math.sqrt((ring+.5)/6),theta=i/32*Math.PI*2;
    const [x,y,z]=rotateEyePoint([r*Math.cos(theta),r*Math.sin(theta),IRIS_DEPTH],yaw,pitch);
    const b=lidBounds(x,state);total++;
    if(z>0&&Math.abs(x)<state.halfWidth&&y>b.lower&&y<b.upper&&!insideCanthus(x,y,state))visible++;
  }return visible/total;
}
export function appearanceFrame(angles,time,options={},manualTime=-Infinity,followAngles=angles){
  if(angles.length!==4||!angles.every(Number.isFinite)||!Number.isFinite(time))throw Error('Invalid gaze sample');
  const blink=blinkAt(time,options,manualTime);
  return [0,1].map(i=>{
    const state=lidState(followAngles[2*i+1],blink.closure,options,i,followAngles[2*i]);
    return {...state,globeYaw:angles[2*i],globePitch:angles[2*i+1],corneaCenter:rotateEyePoint([0,0,.0056],angles[2*i],angles[2*i+1]),blinkPhase:blink.phase,pupilVisibility:pupilVisibility(angles[2*i],angles[2*i+1],state,options.pupilMm)};
  });
}
export class EyelidDynamics{
  constructor(){this.reset();}
  reset(){this.time=null;this.followAngles=null;}
  sample(angles,time,options={},manualTime=-Infinity){
    if(this.time===null||time<this.time||time-this.time>.25)this.followAngles=[...angles];
    else if(time>this.time){const dt=time-this.time;this.followAngles=this.followAngles.map((v,i)=>{const tau=i%2?(angles[i]>v?.055:.028):.035;return v+(angles[i]-v)*(1-Math.exp(-dt/tau));});}
    this.time=time;return appearanceFrame(angles,time,options,manualTime,this.followAngles);
  }
}
