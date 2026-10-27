// Configurable target excursions, not physiological limits or output gain.
export const DEFAULT_RANGE=Object.freeze({horizontal:42,up:30,down:42});
const bound=(n,fallback,max)=>Number.isFinite(n)?Math.max(5,Math.min(max,n)):fallback;
export function normalizeRange(value={}){return {horizontal:bound(value.horizontal,42,50),up:bound(value.up,30,40),down:bound(value.down,42,50)};}
export function angularTarget(yaw,pitch,depth){
  if(![yaw,pitch,depth].every(Number.isFinite)||depth<=0||Math.abs(yaw)>=85||Math.abs(pitch)>=85)throw Error('Invalid angular target');
  const h=yaw*Math.PI/180,v=pitch*Math.PI/180;
  return [depth*Math.tan(h),depth/Math.cos(h)*Math.tan(v),depth];
}
export function pointerTarget(u,v,depth,range=DEFAULT_RANGE){
  const r=normalizeRange(range),x=Math.max(-1,Math.min(1,u)),y=Math.max(-1,Math.min(1,v));
  return angularTarget(x*r.horizontal,y*(y>=0?r.up:r.down),depth);
}
