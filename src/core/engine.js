// Exactly two DOF per eye: yaw around Y, then pitch around local X (no roll).
export const rad=x=>x*Math.PI/180, deg=x=>x*180/Math.PI;
export function lookAngles(p,e){const [x,y,z]=p.map((v,i)=>v-e[i]);return [deg(Math.atan2(x,z)),deg(Math.atan2(y,Math.hypot(x,z)))];}
export function ray(a){const [h,v]=a.map(rad);return [Math.sin(h)*Math.cos(v),Math.sin(v),Math.cos(h)*Math.cos(v)];}
export function desired(p,eyes){return eyes.flatMap(e=>lookAngles(p,e));}
export function angularError(a,b){const u=ray(a),v=ray(b);return deg(Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0)))));}
export class GRU {
 constructor(w){this.w=w;this.reset();}
 reset(){this.h=Array(32).fill(0);}
 step(x){const w=this.w,h=this.h; const affine=(m,v,b)=>m.map((row,i)=>row.reduce((s,z,j)=>s+z*v[j],b[i]));
  const a=affine(w['gru.weight_ih_l0'],x,w['gru.bias_ih_l0']); const b=affine(w['gru.weight_hh_l0'],h,w['gru.bias_hh_l0']);const sig=x=>1/(1+Math.exp(-x));
  this.h=h.map((old,i)=>{const r=sig(a[i]+b[i]),z=sig(a[i+32]+b[i+32]);const n=Math.tanh(a[i+64]+r*b[i+64]);return (1-z)*n+z*old;});
  const out=affine(w['head.weight'],this.h,w['head.bias']);return out.map((v,i)=>x[i]*30+20*Math.tanh(v));
 }
}
export class Rule {
 constructor(config,fps){this.c=config;this.fps=fps;this.reset();}
 reset(){this.q=[];this.y=null;}
 step(target){this.q.push([...target]);if(!this.y)this.y=[...target];const d=this.q[Math.max(0,this.q.length-1-this.c.delay)];const a=1-Math.exp(-1/this.fps/this.c.tau),limit=this.c.vmax/this.fps;this.y=this.y.map((v,i)=>v+Math.max(-limit,Math.min(limit,(d[i]-v)*a)));if(this.q.length>this.c.delay+2)this.q.shift();return [...this.y];}
}
const affine=(m,v,b)=>m.map((r,i)=>r.reduce((s,z,j)=>s+z*v[j],b[i]));
export class LearnedModel {
 constructor(spec){this.spec=spec;this.w=spec.weights;this.gru=spec.kind==='gru'?new GRU(this.w):null;this.reset();}
 reset(){this.h=Array(32).fill(0);this.c=Array(32).fill(0);this.gru?.reset();}
 step(x){if(this.gru)return this.gru.step(x);let h;const w=this.w;
  if(this.spec.kind==='mlp'){h=affine(w['net.0.weight'],x,w['net.0.bias']).map(Math.tanh);h=affine(w['net.2.weight'],h,w['net.2.bias']).map(Math.tanh);}
  else{const a=affine(w['lstm.weight_ih_l0'],x,w['lstm.bias_ih_l0']),b=affine(w['lstm.weight_hh_l0'],this.h,w['lstm.bias_hh_l0']);const u=a.map((v,i)=>v+b[i]),sig=v=>1/(1+Math.exp(-v));
   this.c=this.c.map((v,i)=>sig(u[i+32])*v+sig(u[i])*Math.tanh(u[i+64]));this.h=this.c.map((v,i)=>sig(u[i+96])*Math.tanh(v));h=this.h;
  }
  return affine(w['head.weight'],h,w['head.bias']).map((v,i)=>x[i]*30+20*Math.tanh(v));
 }
}
