import {HALF_WIDTH,lidBounds,skinZ} from './eyelid-model.mjs?v=anatomical2';
export const OUTER_X=.033,OUTER_Y=.027;
const softMax=(a,b,k=.0004)=>(a+b+Math.sqrt((a-b)**2+k*k))/2;
const gauss=(x,center,width)=>Math.exp(-(((x-center)/width)**2));
export function faceSurface(x,y){
  const nose=.0065*gauss(x,0,.011)*gauss(y,-.015,.031);
  const brow=.0015*(gauss(x,-.032,.024)+gauss(x,.032,.024))*gauss(y,.018,.009);
  const cheek=.001*(gauss(x,-.037,.025)+gauss(x,.037,.025))*gauss(y,-.022,.014);
  return .0100-.0016*(x/.08)**2-.0012*(y/.05)**2+nose+brow+cheek;
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
  // Pretarsal roll and an actual shallow crease that unfolds during closure.
  const upper=Math.max(0,s),lower=Math.max(0,-s),open=1-state.closure;
  z+=upper*(.00036*gauss(q,.105,.075)+.00025*open*open*gauss(q,.31,.085));
  z+=lower*(.00020*gauss(q,.075,.045)-.00008*gauss(q,.31,.13));
  // Contact follows the moving cornea even when the lid's gaze response lags.
  if(xx*xx+yy*yy<.0138**2)z=Math.max(z,contact);
  return [xx,yy,z];
}
export function faceNormal(x,y){
  const e=.00001,dx=(faceSurface(x+e,y)-faceSurface(x-e,y))/(2*e),dy=(faceSurface(x,y+e)-faceSurface(x,y-e))/(2*e),n=Math.hypot(dx,dy,1);
  return [-dx/n,-dy/n,1/n];
}
