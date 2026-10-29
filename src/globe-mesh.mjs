import * as T from '../vendor/three.module.js';
import {DEFAULT_APPEARANCE,EYE_RADIUS} from './eyelid-model.mjs?v=faces8';
import {IRIS_DEPTH,IRIS_RADIUS,CORNEA_RADIUS,CORNEA_CENTRE} from './eye-anatomy.mjs';
import {socketUniforms,updateSocket,shadeSclera} from './ocular-shading.mjs?v=canthus3';

function revolution(rows,columns,point){
  const p=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
    const a=i/columns*Math.PI*2;p.push(...point(j/rows,a));uv.push(.5+.5*Math.cos(a)*j/rows,.5+.5*Math.sin(a)*j/rows);
    if(j<rows&&i<columns){const k=j*(columns+1)+i;indices.push(k,k+1,k+columns+2,k,k+columns+2,k+columns+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function irisTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const context=c.getContext('2d'),d=context.createImageData(512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const xx=(x-256)/256,yy=(y-256)/256,r=Math.hypot(xx,yy),a=Math.atan2(yy,xx);
    const fibers=.13*Math.sin(a*173+3*Math.sin(a*31)+r*42)+.07*Math.sin(a*291-r*29)+.04*Math.sin(a*79+r*104);
    const crypt=.08*Math.sin(a*53)*Math.exp(-(((r-.48)/.12)**2)),limbus=1-.65*Math.max(0,(r-.86)/.14);
    const light=Math.max(.12,(.82+fibers+crypt)*limbus),k=(y*512+x)*4;
    d.data.set([255*light,251*light,236*light,255],k);
  }
  context.putImageData(d,0,0);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;
}
let sharedIris;
export function createGlobeRig(index=0,{bare=false,...initial}={}){
  const root=new T.Group(),yaw=new T.Group(),pitch=new T.Group();root.add(yaw);yaw.add(pitch);
  const options={...DEFAULT_APPEARANCE,...initial},socket=socketUniforms();
  const theta0=Math.asin(IRIS_RADIUS/EYE_RADIUS);
  // The white globe has a genuine front opening. The iris is behind it, not
  // painted on a white sphere or pasted in front of the cornea.
  const scleraGeometry=revolution(64,128,(t,a)=>{const theta=theta0+t*(Math.PI-theta0),r=EYE_RADIUS*Math.sin(theta);return [r*Math.cos(a),r*Math.sin(a),EYE_RADIUS*Math.cos(theta)];});
  // The angular parametrisation has the opposite winding to radial surfaces.
  const si=scleraGeometry.index.array;for(let i=0;i<si.length;i+=3)[si[i+1],si[i+2]]=[si[i+2],si[i+1]];scleraGeometry.computeVertexNormals();
  const sclera=new T.Mesh(scleraGeometry,new T.MeshPhysicalMaterial({color:'#d5d2c5',roughness:.30,clearcoat:.65,clearcoatRoughness:.19}));
  shadeSclera(sclera.material,socket);sclera.receiveShadow=true;pitch.add(sclera);
  const irisGeometry=revolution(18,160,(t,a)=>[t*IRIS_RADIUS*Math.cos(a),t*IRIS_RADIUS*Math.sin(a),IRIS_DEPTH]);
  const ii=irisGeometry.index.array;for(let i=0;i<ii.length;i+=3)[ii[i+1],ii[i+2]]=[ii[i+2],ii[i+1]];
  sharedIris??=irisTexture();
  const iris=new T.Mesh(irisGeometry,new T.MeshPhysicalMaterial({color:options.iris,map:sharedIris,roughness:.72,side:T.DoubleSide}));iris.receiveShadow=true;pitch.add(iris);
  const cavity=new T.Mesh(new T.SphereGeometry(.005,40,24),new T.MeshStandardMaterial({color:'#020302',roughness:1,side:T.DoubleSide}));cavity.position.z=.0037;pitch.add(cavity);
  const corneaGeometry=revolution(32,128,(t,a)=>{const r=t*.00605;return [r*Math.cos(a),r*Math.sin(a),CORNEA_CENTRE+Math.sqrt(CORNEA_RADIUS**2-r*r)];});
  // Radial caps point outward after reversing the ring winding.
  const ci=corneaGeometry.index.array;for(let i=0;i<ci.length;i+=3)[ci[i+1],ci[i+2]]=[ci[i+2],ci[i+1]];corneaGeometry.computeVertexNormals();
  const cornea=new T.Mesh(corneaGeometry,new T.MeshPhysicalMaterial({color:'#ffffff',transmission:1,thickness:.00045,ior:1.376,roughness:.025,envMapIntensity:1,depthWrite:false}));pitch.add(cornea);
  let lastPupil=-1,mode='skin';
  function update(angles,state,appearance={}){
    const o={...options,...appearance};yaw.rotation.set(0,angles[0]*Math.PI/180,0);pitch.rotation.set(-angles[1]*Math.PI/180,0,0);
    updateSocket(socket,root,state,bare);
    const pupil=Math.max(2,Math.min(8,o.pupilMm))/2000;
    if(pupil!==lastPupil){
      lastPupil=pupil;const pos=irisGeometry.attributes.position,uv=irisGeometry.attributes.uv;
      for(let j=0;j<=18;j++)for(let i=0;i<=160;i++){
        const t=j/18,a=i/160*Math.PI*2,r=pupil+(IRIS_RADIUS-pupil)*t,k=j*161+i;
        const relief=.00016*Math.sin(Math.PI*t)*(.55+.45*Math.sin(a*61+t*18));
        pos.setXYZ(k,r*Math.cos(a),r*Math.sin(a),IRIS_DEPTH+relief);uv.setXY(k,.5+.5*r/IRIS_RADIUS*Math.cos(a),.5+.5*r/IRIS_RADIUS*Math.sin(a));
      }
      pos.needsUpdate=uv.needsUpdate=true;irisGeometry.computeVertexNormals();irisGeometry.computeBoundingSphere();
    }
    iris.material.color.set(mode==='skin'?o.iris:'#8f989a');
  }
  function setMode(value){mode=value;for(const mesh of [sclera,iris,cavity])mesh.material.wireframe=value==='wire';iris.material.map=value==='skin'?sharedIris:null;iris.material.needsUpdate=true;cornea.visible=value==='skin';}
  return {root,yaw,pitch,update,setMode,sclera,iris,cornea,cavity,skinGeometry:new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([],3)),cornerGeometries:[],setBare(){},get inspection(){return {irisDepth:IRIS_DEPTH,pupilRadius:lastPupil,corneaTip:CORNEA_CENTRE+CORNEA_RADIUS,irisVertices:irisGeometry.attributes.position.count};}};
}
