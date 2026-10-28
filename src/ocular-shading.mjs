import * as T from '../vendor/three.module.js';

// Render-only contact darkening, evaluated in the stationary eye socket frame.
// It is an analytic approximation, not a ray-traced tear film or tissue model.
export const socketGLSL=`
uniform vec3 socketOrigin;
uniform vec4 socketLids;
uniform vec2 socketShape;
uniform float socketEnabled;
varying vec3 socketWorld;
float lidContactShade(){
  vec2 p=(socketWorld-socketOrigin).xy;
  float u=clamp(p.x/.0132,-1.,1.);
  float t=clamp(u-socketShape.x/.0132*(1.-u*u),-1.,1.);
  float profile=pow(max(0.,1.-t*t),.72),tilt=-socketShape.y*u*.00055;
  float lo=socketLids.y*profile*(1.+.08*socketShape.y*u)+tilt;
  float hi=max(lo,socketLids.x*profile*(1.-.11*socketShape.y*u)+tilt);
  float seam=mix(lo,hi,.1);
  hi=mix(hi,seam,socketLids.z);lo=mix(lo,seam,socketLids.z);
  float upper=smoothstep(-.00025,.0020,hi-p.y);
  float lower=smoothstep(-.00015,.00085,p.y-lo);
  float corner=1.-smoothstep(.0058,.0108,abs(p.x));
  return mix(1.,(.50+.50*upper)*(.84+.16*lower)*(.85+.15*corner),socketEnabled);
}
`;

export function socketUniforms(){return {socketOrigin:{value:new T.Vector3()},socketLids:{value:new T.Vector4()},socketShape:{value:new T.Vector2()},socketEnabled:{value:1}};}
export function updateSocket(uniforms,root,state,bare){
  root.getWorldPosition(uniforms.socketOrigin.value);
  uniforms.socketEnabled.value=bare?0:1;
  if(state){uniforms.socketLids.value.set(state.restUpper,state.restLower,state.closure,0);uniforms.socketShape.value.set(state.apexShift,state.side);}
}
export function shadeSclera(material,uniforms){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 socketWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsocketWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=socketGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float limb=smoothstep(.0055,.012,abs((socketWorld-socketOrigin).x))*socketEnabled;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.92,.67,.62),limb*.36);
      diffuseColor.rgb*=lidContactShade();`);
  };
  material.customProgramCacheKey=()=> 'socket-contact-v3';
}
