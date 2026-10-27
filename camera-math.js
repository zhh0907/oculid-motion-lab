// Camera faces world +Z with +Y up; image-right is world -X.
export function pixelToPlane(u,v,depth,aspect,fov,below){
 const k=depth*Math.tan(fov*Math.PI/360);
 return [(1-2*u)*k*aspect,(1-2*v)*k-below,depth];
}
