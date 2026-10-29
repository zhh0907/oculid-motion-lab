import {HALF_WIDTH,lidBounds,skinZ,canthusInnerX} from './eyelid-model.mjs?v=canthus3';
import {FACE_REFERENCE as face} from './face-reference.mjs';
export const OUTER_X=.033,OUTER_Y=.027;
const softMax=(a,b,k=.0004)=>(a+b+Math.sqrt((a-b)**2+k*k))/2;
const gauss=(x,center,width)=>Math.exp(-(((x-center)/width)**2));
export function faceSurface(x,y){
  // Catmull-Rom reconstruction of the scan's frontal surface. This includes
  // nasal sidewalls, orbital recesses and cheek/temple curvature, in metres.
  const gx=Math.max(1,Math.min(face.nx-3,(x-face.xmin)/(face.xmax-face.xmin)*(face.nx-1)));
  const gy=Math.max(1,Math.min(face.ny-3,(y-face.ymin)/(face.ymax-face.ymin)*(face.ny-1)));
  const ix=Math.floor(gx),iy=Math.floor(gy),u=gx-ix,v=gy-iy;
  const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
  const a=face.micrometres;
  const row=j=>{const k=j*face.nx+ix;return cubic(a[k-1],a[k],a[k+1],a[k+2],u);};
  return cubic(row(iy-1),row(iy),row(iy+1),row(iy+2),v)*1e-6;
}
export function faceUV(x,y){
  const gx=Math.max(0,Math.min(face.nx-1.00001,(x-face.xmin)/(face.xmax-face.xmin)*(face.nx-1)));
  const gy=Math.max(0,Math.min(face.ny-1.00001,(y-face.ymin)/(face.ymax-face.ymin)*(face.ny-1)));
  const ix=Math.floor(gx),iy=Math.floor(gy),u=gx-ix,v=gy-iy,k=iy*face.nx+ix;
  const sample=a=>(a[k]*(1-u)+a[k+1]*u)*(1-v)+(a[k+face.nx]*(1-u)+a[k+face.nx+1]*u)*v;
  return [sample(face.u)/65535,sample(face.v)/65535,sample(face.valid)];
}
export function lidSurface(theta,q,state){
  const c=Math.cos(theta),s=Math.sin(theta),x=HALF_WIDTH*c,b=lidBounds(x,state),y=s>=0?b.upper:b.lower;
  const rootX=state.side>0?-.032:.032;
  const nasal=(state.nasalSweep||0)*q*(1-q)*2.4*Math.abs(s);
  const xx=x+(OUTER_X*c-x)*q+nasal;
  const yy=y+(OUTER_Y*s-y)*q+(state.cheekLift||0)*Math.max(0,-s)*Math.sin(q*Math.PI);
  const base=faceSurface(xx+rootX,yy);
  // Fit the tissue locally to the globe, not to a radial cone extruded from
  // the aperture. A cone creates the artificial triangular corner pinches.
  const contact=skinZ(xx,yy,state.globeYaw,state.globePitch,state.corneaCenter);
  let z=xx*xx+yy*yy<.014**2?softMax(base,contact,.0007):base;
  // A narrow lid roll, a recessed supratarsal fold, and a softer lower-lid
  // transition. All relief fades before the face boundary and corner anchors.
  const upper=Math.max(0,s),lower=Math.max(0,-s),open=1-state.closure;
  z+=upper*(.00028*gauss(q,.07,.06)-.00021*open*open*gauss(q,.205+.025*c,.025)+.00023*open*gauss(q,.31,.105));
  z+=lower*(.00019*gauss(q,.052,.045)-.00010*gauss(q,.20,.05)+.00014*gauss(q,.34,.13));
  const temporal=Math.max(0,-c*state.side),cornerFade=Math.sin(q*Math.PI)**2;
  z-=.00007*temporal**8*cornerFade*gauss(Math.abs(s),.17,.05);
  // Contact follows the moving cornea even when the lid's gaze response lags.
  if(xx*xx+yy*yy<.0138**2)z=Math.max(z,contact);
  return [xx,yy,z];
}

// The corner is a surface spanning the actual upper/lower lid boundaries.
// It collapses with the aperture instead of leaving a floating pink sphere.
export function canthusSurface(u,v,state,nasal=true){
  const sign=nasal?state.side:-state.side;
  const x=sign*(canthusInnerX(v,nasal)*(1-u)+HALF_WIDTH*u),bounds=lidBounds(x,state);
  const y=bounds.lower+(bounds.upper-bounds.lower)*v;
  const theta=Math.acos(x/HALF_WIDTH),top=lidSurface(theta,0,state),bottom=lidSurface(-theta,0,state);
  const open=Math.min(1,Math.max(0,(bounds.upper-bounds.lower)/.002));
  const envelope=Math.sin(Math.PI*v)*Math.sin(Math.PI*u/2)*open;
  const caruncle=nasal?.00014*gauss(u,.57,.25)*gauss(v,.44,.33):0;
  const fold=nasal?.00010*gauss(u,.14+.09*Math.sin(Math.PI*v),.075)*Math.sin(Math.PI*v):0;
  const z=bottom[2]+(top[2]-bottom[2])*v+(-.00004+caruncle+fold)*envelope+.000018;
  return [x,y,z];
}
export function faceNormal(x,y){
  const e=.00001,dx=(faceSurface(x+e,y)-faceSurface(x-e,y))/(2*e),dy=(faceSurface(x,y+e)-faceSurface(x,y-e))/(2*e),n=Math.hypot(dx,dy,1);
  return [-dx/n,-dy/n,1/n];
}
