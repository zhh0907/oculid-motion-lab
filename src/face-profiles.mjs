// Two authored appearance presets derived from the same licensed base mesh.
// These are shape choices, not measurements or a classifier of biological sex.
export const FACE_TYPES=Object.freeze(['male','female']);
export const FACE_PROFILE_VERSION='head-shapes-v1';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const bell=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
export function morphHeadPoint(x,y,z,type='male'){
  if(type!=='female')return [x,y,z];
  // Keep the aperture, canthi and globe-contact tissue exactly in place.
  const socket=Math.min(...[-.032,.032].map(cx=>Math.hypot((x-cx)/.020,y/.018)));
  const free=smooth(1.05,1.8,socket),front=smooth(-.070,-.012,z);
  const lower=1-smooth(-.075,-.026,y),jaw=bell(y,-.078,.042);
  const chin=bell(x,0,.030)*bell(y,-.108,.025)*front;
  const nose=bell(x,0,.021)*bell(y,-.038,.027)*front;
  const cheek=bell(Math.abs(x),.046,.022)*bell(y,-.029,.025)*front;
  const brow=bell(Math.abs(x),.033,.026)*bell(y,.026,.018)*front;
  const forehead=bell(y,.069,.045),neck=1-smooth(-.145,-.110,y);
  const dx=-x*(.17*jaw+.075*chin+.035*forehead+.13*neck)-.11*x*nose+Math.sign(x)*.0015*cheek;
  const dy=.0065*lower*front+.0020*nose+.0015*brow+.002*forehead;
  const lips=bell(x,0,.022)*(.0024*bell(y,-.068,.004)+.0030*bell(y,-.078,.004))*front;
  const dz=-.0045*nose-.0030*chin-.0050*brow+.0030*cheek
    +lips+.0018*forehead*front;
  return [x+free*dx,y+free*dy,z+free*dz];
}
