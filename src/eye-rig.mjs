import * as T from '../vendor/three.module.js';
import {DEFAULT_APPEARANCE,lidBounds,skinZ,EYE_RADIUS,HALF_WIDTH} from './eyelid-model.mjs';

const N=96,RINGS=16;
function cap(radius,extent,bulge=0){
  const p=[],uv=[],indices=[];
  for(let j=0;j<=24;j++)for(let i=0;i<=96;i++){
    const r=extent*j/24,a=i/96*Math.PI*2,x=r*Math.cos(a),y=r*Math.sin(a);
    p.push(x,y,Math.sqrt(radius*radius-r*r)+bulge*(1-(r/extent)**2));uv.push(.5+x/extent/2,.5+y/extent/2);
    if(j<24&&i<96){const k=j*97+i;indices.push(k,k+98,k+1,k,k+97,k+98);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function skinTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d'),d=c.createImageData(128,128);let seed=921;
  for(let i=0;i<d.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=210+(seed%45);d.data.set([n,n,n,255],i);}
  c.putImageData(d,0,0);const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(5,5);return texture;
}
let pores;
function faceZ(x,y){return .007-.002*(x/.08)**2-.001*(y/.045)**2+.008*Math.exp(-x*x/.00008)*Math.exp(-((y+.015)**2)/.0008);}
function addFace(scene){
  const g=new T.PlaneGeometry(.16,.10,100,64),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,faceZ(p.getX(i),p.getY(i)));
  // The surrounding face has two actual holes; it must not cover the aperture.
  const kept=[],idx=g.index.array;
  for(let k=0;k<idx.length;k+=3){const a=idx[k],b=idx[k+1],c=idx[k+2],x=(p.getX(a)+p.getX(b)+p.getX(c))/3,y=(p.getY(a)+p.getY(b)+p.getY(c))/3;
    if(![-.032,.032].some(cx=>((x-cx)/.0315)**2+(y/.0255)**2<1))kept.push(a,b,c);
  }g.setIndex(kept);
  g.computeVertexNormals();pores ||= skinTexture();
  const material=new T.MeshStandardMaterial({color:DEFAULT_APPEARANCE.skin,roughness:.76,bumpMap:pores,bumpScale:.000055});
  const face=new T.Mesh(g,material);scene.add(face);
  const hairs=[];
  for(const side of [-1,1])for(let i=0;i<75;i++){
    const q=i/74,x=side*(.017+q*.031),y=.016+.003*Math.sin(q*Math.PI)-q*.001;
    const z=.0115-.001*q;
    hairs.push(x,y,z,x+side*.0012,y+.0013+.0007*Math.sin(i*2.7),z+.0001);
  }
  const brow=new T.BufferGeometry();brow.setAttribute('position',new T.Float32BufferAttribute(hairs,3));scene.add(new T.LineSegments(brow,new T.LineBasicMaterial({color:'#50372a',transparent:true,opacity:.7})));
  return face;
}
function irisMaterial(color,pupilMm){
  return new T.ShaderMaterial({uniforms:{irisColor:{value:new T.Color(color)},pupil:{value:pupilMm/11.4}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform vec3 irisColor;uniform float pupil;
    void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);
      float fibers=sin(a*131.+sin(a*37.)*3.+r*18.)*.10+sin(a*241.-r*24.)*.07+sin(a*61.+r*41.)*.06;
      float collarette=.5+.5*sin(a*31.+r*39.);vec3 col=irisColor*(.62+fibers+.38*sin(r*3.));
      col=mix(col,vec3(.28,.14,.055),.28*(1.-smoothstep(pupil+.07,pupil+.27,r))*collarette);
      col*=1.-.68*smoothstep(.86,1.,r);col=mix(vec3(.004,.006,.006),col,smoothstep(pupil-.008,pupil+.012,r));
      col*=.86+.14*(p.y*.5+.5);gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}
export function createEyeRig(index=0,{bare=false,...initial}={}){
  const o={...DEFAULT_APPEARANCE,...initial},root=new T.Group(),yaw=new T.Group(),pitch=new T.Group();root.add(yaw);yaw.add(pitch);
  const sclera=new T.Mesh(new T.SphereGeometry(EYE_RADIUS,64,48),new T.MeshPhysicalMaterial({color:'#e5ddd1',roughness:.22,clearcoat:1,clearcoatRoughness:.1}));pitch.add(sclera);
  const iris=new T.Mesh(cap(.01215,.0057),irisMaterial(o.iris,o.pupilMm));pitch.add(iris);
  const cornea=new T.Mesh(cap(.0123,.006,.0009),new T.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.24,roughness:.035,metalness:0,clearcoat:1,clearcoatRoughness:.025,depthWrite:false}));pitch.add(cornea);
  const surround=new T.Group();root.add(surround);surround.visible=!bare;
  const pos=new Float32Array((N+1)*(RINGS+1)*3),uv=new Float32Array((N+1)*(RINGS+1)*2),indices=[];
  for(let j=0;j<=RINGS;j++)for(let i=0;i<=N;i++){let k=j*(N+1)+i;uv[2*k]=i/N;uv[2*k+1]=j/RINGS;if(j<RINGS&&i<N)indices.push(k,k+N+1,k+N+2,k,k+N+2,k+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setIndex(indices);
  pores ||= skinTexture();
  const material=new T.MeshStandardMaterial({color:o.skin,roughness:.76,bumpMap:pores,bumpScale:.000055,side:T.DoubleSide});
  const skin=new T.Mesh(geometry,material);surround.add(skin);
  const makeCurve=(color,width=.00018)=>{
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array((N+1)*3),3));
    const line=new T.Line(g,new T.LineBasicMaterial({color}));surround.add(line);return line;
  };
  const rim=makeCurve('#8e4b43'),crease=makeCurve('#916450'),lower=makeCurve('#ac7562');
  const lashGeo=new T.BufferGeometry();lashGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(38*6),3));
  const lashes=new T.LineSegments(lashGeo,new T.LineBasicMaterial({color:'#38231e',transparent:true,opacity:.7}));surround.add(lashes);
  const duct=new T.Mesh(new T.SphereGeometry(.001,16,12),new T.MeshStandardMaterial({color:'#ac635b',roughness:.35}));duct.scale.set(1,.57,.4);duct.position.set((index?-1:1)*.0107,-.00025,.0054);surround.add(duct);
  let previous='';
  function update(angles,state,options={}){
    yaw.rotation.set(0,angles[0]*Math.PI/180,0);pitch.rotation.set(-angles[1]*Math.PI/180,0,0);
    const opts={...o,...options};material.color.set(opts.skin);iris.material.uniforms.irisColor.value.set(opts.iris);iris.material.uniforms.pupil.value=opts.pupilMm/11.4;
    if(!state)return;
    const signature=[state.upper,state.lower,state.side].join(',');if(signature===previous)return;previous=signature;
    for(let i=0;i<=N;i++){
      const a=i/N*Math.PI*2,c=Math.cos(a),s=Math.sin(a),x=HALF_WIDTH*c;
      const bounds=lidBounds(x,state),y=s>=0?bounds.upper:bounds.lower;
      for(let j=0;j<=RINGS;j++){
        const q=j/RINGS,u=q*q*(3-2*q),xx=x+(c*.033-x)*q,yy=y+(s*.027-y)*q;
        const edge=skinZ(x,y),outer=faceZ(xx+(index?.032:-.032),yy);
        let z=edge*(1-u)+outer*u;
        // Use the enclosing globe surface wherever it protrudes through interpolation.
        if(xx*xx+yy*yy<EYE_RADIUS**2)z=Math.max(z,skinZ(xx,yy));
        z+=.0008*Math.sin(q*Math.PI)*Math.max(0,s);
        const k=(j*(N+1)+i)*3;pos[k]=xx;pos[k+1]=yy;pos[k+2]=z;
      }
      rim.geometry.attributes.position.setXYZ(i,x,y,skinZ(x,y)+.00008);
      const cy=y+(s>=0?.0023:-.0013)*Math.pow(Math.abs(s),.7);
      const cx=x*1.045;
      const cz=Math.max(skinZ(cx,cy),pos[((N+1)+i)*3+2])+.00012;
      crease.geometry.attributes.position.setXYZ(i,cx,s>=0?cy:y,cz);
      lower.geometry.attributes.position.setXYZ(i,x,s<0?y-.00035:y,skinZ(x,y)+.0001);
    }
    for(let i=0;i<38;i++){
      const x=-HALF_WIDTH*.94+2*HALF_WIDTH*.94*i/37,b=lidBounds(x,state),z=skinZ(x,b.upper),h=.00075+.00035*Math.sin(i*1.7);
      lashGeo.attributes.position.setXYZ(i*2,x,b.upper,z+.0001);
      lashGeo.attributes.position.setXYZ(i*2+1,x+x*.045,b.upper+h,z+.0008);
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    for(const line of [rim,crease,lower,lashes]){line.geometry.attributes.position.needsUpdate=true;line.geometry.computeBoundingSphere();}
  }
  return {root,yaw,pitch,surround,update,setBare(value){surround.visible=!value;},get skinGeometry(){return geometry;}};
}

export function createEyeView(host,{bare=false,background='#192627'}={}){
  const scene=new T.Scene();scene.background=new T.Color(background);
  scene.add(new T.HemisphereLight('#fff1e2','#354346',2.25));
  const key=new T.DirectionalLight('#fff1e0',2.8);key.position.set(-.1,.2,.3);scene.add(key);
  const fill=new T.DirectionalLight('#c9e2e8',.7);fill.position.set(.15,.02,.3);scene.add(fill);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;host.prepend(renderer.domElement);
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',bare?'相同角度的裸眼对照':'包含眼睑、虹膜及角膜高光的双眼模拟');
  const camera=new T.OrthographicCamera(-.072,.072,.036,-.036,.001,2);camera.position.set(0,0,.2);camera.lookAt(0,0,0);
  const rigs=[0,1].map(i=>{const rig=createEyeRig(i,{bare});rig.root.position.x=i?.032:-.032;scene.add(rig.root);return rig;});
  const face=bare?null:addFace(scene);
  let oldW=0,oldH=0;
  function draw(angles,states,options={}){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    if(w!==oldW||h!==oldH){oldW=w;oldH=h;renderer.setSize(w,h,false);const halfY=Math.max(.024,.072/(w/h));camera.left=-halfY*w/h;camera.right=halfY*w/h;camera.top=halfY;camera.bottom=-halfY;camera.updateProjectionMatrix();}
    if(face)face.material.color.set(options.skin||DEFAULT_APPEARANCE.skin);
    rigs.forEach((rig,i)=>rig.update(angles.slice(i*2,i*2+2),states[i],options));renderer.render(scene,camera);
  }
  return {draw,rigs,renderer,scene,camera};
}

