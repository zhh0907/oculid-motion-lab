import {HALF_WIDTH,lidBounds,skinZ} from './eyelid-model.mjs?v=faces8';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function lidEdge(theta,state){
  const x=HALF_WIDTH*Math.cos(theta),b=lidBounds(x,state),y=Math.sin(theta)>=0?b.upper:b.lower;
  const anchor=.0068+.0006*state.side*x/HALF_WIDTH;
  return [x,y,Math.max(anchor,skinZ(x,y,state.globeYaw,state.globePitch,state.corneaCenter))];
}
export function attachedLidPoint(theta,q,state,boundary,normal){
  if(q===1)return [...boundary];
  const edge=lidEdge(theta,state),dx=boundary[0]-edge[0],dy=boundary[1]-edge[1];
  const x=edge[0]+dx*q,y=edge[1]+dy*q;
  const m0=0,m1=(boundary[2]-edge[2])*.65;
  const t2=q*q,t3=t2*q;
  let z=(2*t3-3*t2+1)*edge[2]+(t3-2*t2+q)*m0+(-2*t3+3*t2)*boundary[2]+(t3-t2)*m1;
  const s=Math.sin(theta),upper=Math.max(0,s),open=1-state.closure;
  z+=upper*open*(.00055*Math.exp(-(((q-.28)/.13)**2))-.0003*Math.exp(-(((q-.15)/.035)**2)))*Math.sin(Math.PI*q);
  z+=Math.max(0,-s)*.00023*Math.sin(Math.PI*q)*Math.exp(-(((q-.20)/.17)**2));
  if(x*x+y*y<.0138**2)z=Math.max(z,skinZ(x,y,state.globeYaw,state.globePitch,state.corneaCenter));
  return [x,y,z];
}
export function volumeCanthus(u,v,state,nasal=true){
  const sign=nasal?state.side:-state.side,width=nasal?.0025:.0013;
  const x=sign*(HALF_WIDTH-width*(1-u)),b=lidBounds(x,state),y=b.lower+(b.upper-b.lower)*v;
  const a=Math.acos(clamp(x/HALF_WIDTH,-1,1)),lo=lidEdge(-a,state),hi=lidEdge(a,state);
  const z=lo[2]*(1-v)+hi[2]*v+.0001*Math.sin(Math.PI*v)*Math.sin(Math.PI*u);
  return [x,y,z+.00002];
}
