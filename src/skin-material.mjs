import * as T from '../vendor/three.module.js';

// A shared 40 mm texture space keeps the face and animated lids continuous.
// All irregularity is seeded once: the texture never changes between frames.
let maps;
export function skinTone(color){return new T.Color(color);}
const smooth=t=>t*t*(3-2*t);
function field(size,random){
  const a=Float32Array.from({length:size*size},random);
  return (x,y)=>{
    x=((x%1)+1)%1*size;y=((y%1)+1)%1*size;
    const i=Math.floor(x),j=Math.floor(y),u=smooth(x-i),v=smooth(y-j);
    const at=(dx,dy)=>a[((j+dy)%size)*size+(i+dx)%size];
    return (at(0,0)*(1-u)+at(1,0)*u)*(1-v)+(at(0,1)*(1-u)+at(1,1)*u)*v;
  };
}
function skinTextures(){
  if(maps)return maps;
  let seed=9713;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const size=1024,canvases=Array.from({length:3},()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;});
  const [albedo,height,rough]=canvases.map(c=>c.getContext('2d'));
  const layers=[7,23,79,237].map(n=>field(n,random)),data=canvases.map(()=>albedo.createImageData(size,size));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,a=layers[0](u,v)-.5,b=layers[1](u,v)-.5,c=layers[2](u,v)-.5,d=layers[3](u,v)-.5,k=(y*size+x)*4;
    // Broad pigmentation, mid-scale capillary colour, fine skin relief.
    data[0].data.set([245+4*a+4*b+3*c,240+7*a+6*b+3*c,236+8*a+7*b+3*c,255],k);
    const h=136+10*c+9*d;data[1].data.set([h,h,h,255],k);
    const r=208+16*b+15*c;data[2].data.set([r,r,r,255],k);
  }
  [albedo,height,rough].forEach((ctx,i)=>ctx.putImageData(data[i],0,0));
  // Pores are small depressions with a soft shoulder, not dark freckles.
  for(let i=0;i<23000;i++){
    const x=random()*size,y=random()*size,r=.45+random()*1.45;
    const g=height.createRadialGradient(x,y,0,x,y,r*1.7);g.addColorStop(0,'rgba(45,45,45,.48)');g.addColorStop(.5,'rgba(90,90,90,.18)');g.addColorStop(1,'rgba(170,170,170,0)');
    height.fillStyle=g;height.fillRect(x-r*2,y-r*2,r*4,r*4);
    albedo.fillStyle=`rgba(106,68,54,${.025+random()*.04})`;albedo.beginPath();albedo.ellipse(x,y,r*.65,r,random()*Math.PI,0,Math.PI*2);albedo.fill();
  }
  // Broken, branching micro-furrows replace pixel noise with skin-like relief.
  height.lineWidth=.6;height.strokeStyle='rgba(65,65,65,.14)';
  for(let i=0;i<4300;i++){
    const x=random()*size,y=random()*size,l=2+random()*7,a=random()*Math.PI;
    height.beginPath();height.moveTo(x,y);height.quadraticCurveTo(x+Math.cos(a+.5)*l*.5,y+Math.sin(a+.5)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);height.stroke();
  }
  const [map,bumpMap,roughnessMap]=canvases.map(c=>{const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;});
  map.colorSpace=T.SRGBColorSpace;maps={map,bumpMap,roughnessMap};return maps;
}
export function skinMaterial(color,vertexColors=false){
  const material=new T.MeshPhysicalMaterial({color:skinTone(color),...skinTextures(),bumpScale:.000065,roughness:.72,clearcoat:.06,clearcoatRoughness:.5,sheen:.12,sheenColor:'#bb806c',sheenRoughness:.85,vertexColors,side:T.DoubleSide});
  // Small warm grazing fill approximates thin tissue; all facial shape and
  // directional shading come from mesh geometry, never a face photograph.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.035,.012,.006)*pow(1.-max(0.,dot(normal,geometryViewDir)),3.);`);
  };
  material.customProgramCacheKey=()=> 'volume-skin-v7';
  return material;
}

// Low-frequency colouring follows anatomy; unlike baked lighting, it works
// under both the studio lights and the orbitable workspace lighting.
export function skinTint(x,y,side=1){
  const g=(v,c,w)=>Math.exp(-(((v-c)/w)**2)),nasal=x*side;
  const warm=.065*g(nasal,.012,.005)*g(y,-.001,.006);
  const under=.10*g(x,0,.013)*g(y,-.008,.0045);
  const crease=.035*g(x,0,.011)*g(y,.008,.0028);
  const cheek=.04*g(x,-side*.009,.017)*g(y,-.027,.016);
  return [1-under*.5-crease*.5,1-warm-under-crease-cheek,1-warm*.85-under*.45-crease*.8-cheek*.7];
}
