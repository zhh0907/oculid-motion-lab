// Screen frame: origin at display center; X to the viewer's right, Y up,
// Z toward the viewer. Native, unmirrored camera pixels use x right / y down.
export const profileVersion=1;
// Offset from the selected display edge/corner, in the display plane.
export function screenMountPosition(direction,gapMm,widthMm,heightMm){
 const directions={nw:[-1,1],n:[0,1],ne:[1,1],w:[-1,0],e:[1,0],sw:[-1,-1],s:[0,-1],se:[1,-1]};
 const d=directions[direction];
 if(!d||![gapMm,widthMm,heightMm].every(Number.isFinite)||gapMm<0||gapMm>1000||widthMm<100||widthMm>3000||heightMm<100||heightMm>2000)throw Error('mount');
 const offset=gapMm/Math.hypot(...d);
 return {x:d[0]*(widthMm/2+offset)/1000,y:d[1]*(heightMm/2+offset)/1000};
}
export function validateProfile(p){
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 if(p?.version!==profileVersion||p?.type!=='screen-camera')throw Error('schema');
 const s=p.screen,i=p.intrinsics,c=p.camera;
 if(!s||!finite(s.widthM,.1,3)||!finite(s.heightM,.1,2))throw Error('screen');
 if(!i||!Number.isInteger(i.width)||!Number.isInteger(i.height)||!finite(i.width,160,8192)||!finite(i.height,120,8192)||!finite(i.fx,10,100000)||!finite(i.fy,10,100000)||!finite(i.cx,0,i.width)||!finite(i.cy,0,i.height))throw Error('intrinsics');
 if(!Array.isArray(i.distortion)||i.distortion.length!==5||!i.distortion.every(v=>finite(v,-10,10)))throw Error('distortion');
 if(!c||!['x','y','z'].every(k=>finite(c[k],-2,2))||!['yaw','pitch','roll'].every(k=>finite(c[k],-80,80)))throw Error('pose');
 if(!finite(p.targetDepthM,.1,5)||p.targetDepthM<=c.z+.05)throw Error('depth');
 return p;
}
export function undistortPixel(u,v,i){
 const xd=(u*i.width-i.cx)/i.fx,yd=(v*i.height-i.cy)/i.fy;
 const [k1,k2,p1,p2,k3]=i.distortion;let x=xd,y=yd;
 for(let n=0;n<30;n++){
  const r2=x*x+y*y,radial=1+k1*r2+k2*r2*r2+k3*r2*r2*r2;
  if(!Number.isFinite(radial)||Math.abs(radial)<1e-8)throw Error('ray');
  const nx=(xd-2*p1*x*y-p2*(r2+2*x*x))/radial,ny=(yd-p1*(r2+2*y*y)-2*p2*x*y)/radial;
  if(!Number.isFinite(nx+ny)||Math.abs(nx)+Math.abs(ny)>50)throw Error('ray');
  if(Math.hypot(nx-x,ny-y)<1e-10){x=nx;y=ny;break;}x=nx;y=ny;
 }
 const r2=x*x+y*y,radial=1+k1*r2+k2*r2*r2+k3*r2*r2*r2;
 const error=Math.hypot((x*radial+2*p1*x*y+p2*(r2+2*x*x)-xd)*i.fx,(y*radial+p1*(r2+2*y*y)+2*p2*x*y-yd)*i.fy);
 if(error>.1)throw Error('ray');
 return [x,y];
}
export function rotateCameraRay(ray,c){
 const [a,b,g]=[c.yaw,-c.pitch,c.roll].map(v=>v*Math.PI/180);
 // Roll around screen Z, then pitch around X, then yaw around Y.
 let [x,y,z]=ray;
 [x,y]=[Math.cos(g)*x-Math.sin(g)*y,Math.sin(g)*x+Math.cos(g)*y];
 [y,z]=[Math.cos(b)*y-Math.sin(b)*z,Math.sin(b)*y+Math.cos(b)*z];
 return [Math.cos(a)*x+Math.sin(a)*z,y,-Math.sin(a)*x+Math.cos(a)*z];
}
export function calibratedTarget(u,v,p){
 const [x,y]=undistortPixel(u,v,p.intrinsics),d=rotateCameraRay([-x,-y,1],p.camera),c=p.camera;
 if(d[2]<=1e-6)throw Error('ray');
 const t=(p.targetDepthM-c.z)/d[2];
 if(t<=0||t>30)throw Error('ray');
 return [c.x+t*d[0],c.y+t*d[1],p.targetDepthM];
}
export function frameMatches(p,width,height){return p.intrinsics.width===width&&p.intrinsics.height===height;}
