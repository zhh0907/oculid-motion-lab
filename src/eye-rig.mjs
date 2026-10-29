import * as T from '../vendor/three.module.js';
import {DEFAULT_APPEARANCE,rotateEyePoint,EYE_RADIUS} from './eyelid-model.mjs?v=canthus3';
import {faceNormal,faceUV,lidSurface,canthusSurface} from './periocular-shape.mjs?v=face6';
import {skinMaterial,skinTint,skinTone} from './skin-material.mjs?v=face6';
import {socketGLSL,socketUniforms,updateSocket,shadeSclera} from './ocular-shading.mjs?v=canthus3';
import {createScanGeometry} from './scan-geometry.mjs?v=face6';

const N=160,RINGS=32;
function cap(radius,extent,bulge=0){
  const p=[],uv=[],indices=[];
  for(let j=0;j<=24;j++)for(let i=0;i<=96;i++){
    const r=extent*j/24,a=i/96*Math.PI*2,x=r*Math.cos(a),y=r*Math.sin(a);
    p.push(x,y,Math.sqrt(radius*radius-r*r)+bulge*(1-(r/extent)**2));uv.push(.5+x/extent/2,.5+y/extent/2);
    if(j<24&&i<96){const k=j*97+i;indices.push(k,k+98,k+1,k,k+97,k+98);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function addFace(scene){
  const g=createScanGeometry(),p=g.attributes.position;
  const tint=new Float32Array(p.count*3),micro=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),cx=x<0?-.032:.032;
    micro.set([x/.04,y/.04],i*2);tint.set(skinTint(x-cx,y,x<0?1:-1),i*3);
  }
  g.setAttribute('color',new T.BufferAttribute(tint,3));
  g.setAttribute('uv1',new T.BufferAttribute(micro,2));
  const face=new T.Mesh(g,skinMaterial(DEFAULT_APPEARANCE.skin,true));face.castShadow=face.receiveShadow=true;scene.add(face);return face;
}
function studioEnvironment(renderer){
  const room=new T.Scene();room.background=new T.Color('#8c9190');
  for(const [x,y,z,w,h,strength]of [[-.8,1.1,2,1.1,.7,5],[1,.25,2,.35,.6,2]]){
    const box=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(strength,strength,strength),side:T.DoubleSide}));box.position.set(x,y,z);box.lookAt(0,0,0);room.add(box);
  }
  const gen=new T.PMREMGenerator(renderer),target=gen.fromScene(room,.04,.1,5);gen.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target;
}
function irisMaterial(color,pupilMm,socket){
  return new T.ShaderMaterial({uniforms:{...socket,irisColor:{value:new T.Color(color)},pupil:{value:pupilMm/11.4}},vertexShader:`varying vec2 vUv;varying vec3 socketWorld;void main(){vUv=uv;socketWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:socketGLSL+`varying vec2 vUv;uniform vec3 irisColor;uniform float pupil;
    void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);
      float fibers=sin(a*131.+sin(a*37.)*3.+r*18.)*.10+sin(a*241.-r*24.)*.07+sin(a*61.+r*41.)*.06;
      float collarette=.5+.5*sin(a*31.+r*39.);vec3 col=irisColor*(.62+fibers+.38*sin(r*3.));
      col=mix(col,vec3(.28,.14,.055),.28*(1.-smoothstep(pupil+.07,pupil+.27,r))*collarette);
      col*=1.-.68*smoothstep(.86,1.,r);col=mix(vec3(.004,.006,.006),col,smoothstep(pupil-.008,pupil+.012,r));
      col*=.86+.14*(p.y*.5+.5);col*=lidContactShade();gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}
export function createEyeRig(index=0,{bare=false,...initial}={}){
  const o={...DEFAULT_APPEARANCE,...initial},root=new T.Group(),yaw=new T.Group(),pitch=new T.Group();root.add(yaw);yaw.add(pitch);
  const socket=socketUniforms();let bareMode=bare;
  const sclera=new T.Mesh(new T.SphereGeometry(EYE_RADIUS,64,48),new T.MeshPhysicalMaterial({color:'#ddd9d1',roughness:.28,clearcoat:1,clearcoatRoughness:.16}));pitch.add(sclera);
  shadeSclera(sclera.material,socket);
  const iris=new T.Mesh(cap(.01255,.0057),irisMaterial(o.iris,o.pupilMm,socket));pitch.add(iris);
  const cornea=new T.Mesh(cap(.01265,.006,.0008),new T.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:.11,roughness:.025,clearcoat:1,clearcoatRoughness:.025,envMapIntensity:1.5,depthWrite:false}));pitch.add(cornea);
  const glints=[[-.12,.19,.974,.00048,.72],[.22,.06,.974,.0002,.38]].map(([x,y,z,r,opacity])=>{
    const normal=new T.Vector3(x,y,z).normalize(),mesh=new T.Mesh(new T.CircleGeometry(r,24),new T.MeshBasicMaterial({color:'#fffaf0',transparent:true,opacity,depthWrite:false}));mesh.scale.set(.7,1,1);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);root.add(mesh);return {mesh,normal};
  });
  const surround=new T.Group();root.add(surround);surround.visible=!bare;
  const pos=new Float32Array((N+1)*(RINGS+1)*3),uv=new Float32Array((N+1)*(RINGS+1)*2),micro=new Float32Array(uv.length),color=new Float32Array(pos.length),indices=[];
  for(let j=0;j<=RINGS;j++)for(let i=0;i<=N;i++){const k=j*(N+1)+i;if(j<RINGS&&i<N)indices.push(k,k+N+1,k+N+2,k,k+N+2,k+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setAttribute('color',new T.BufferAttribute(color,3));geometry.setIndex(indices);
  geometry.setAttribute('uv1',new T.BufferAttribute(micro,2));
  const material=skinMaterial(o.skin,true);material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;
  const skinMesh=new T.Mesh(geometry,material);skinMesh.castShadow=skinMesh.receiveShadow=true;surround.add(skinMesh);
  // A real narrow wet margin instead of an outline painted around the aperture.
  const rimGeo=new T.BufferGeometry(),rimPos=new Float32Array((N+1)*6),rimIndices=[];
  for(let i=0;i<N;i++){const k=i*2;rimIndices.push(k,k+1,k+3,k,k+3,k+2);}
  rimGeo.setAttribute('position',new T.BufferAttribute(rimPos,3));rimGeo.setIndex(rimIndices);
  const rimMaterial=new T.MeshPhysicalMaterial({color:'#b88678',roughness:.26,clearcoat:1,clearcoatRoughness:.16,side:T.DoubleSide});
  const rimMesh=new T.Mesh(rimGeo,rimMaterial);surround.add(rimMesh);
  function hairs(count,color,opacity){
    const g=new T.BufferGeometry(),idx=[];g.setAttribute('position',new T.BufferAttribute(new Float32Array(count*30),3));
    for(let i=0;i<count;i++)for(let j=0;j<4;j++){const k=i*10+j*2;idx.push(k,k+1,k+3,k,k+3,k+2);}g.setIndex(idx);
    const mesh=new T.Mesh(g,new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false}));surround.add(mesh);return mesh;
  }
  // Natural eyebrows come from the scan; only the moving lashes need geometry.
  const upperLashes=hairs(72,'#392a22',.9),lowerLashes=hairs(36,'#695040',.6);
  // Caruncle, crescent fold and lateral commissure share the lid boundaries.
  const corners=[true,false].map(nasal=>{
    const across=32,rows=16,g=new T.BufferGeometry(),p=new Float32Array((across+1)*(rows+1)*3),colors=new Float32Array(p.length),idx=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=across;i++){
      const k=j*(across+1)+i,u=i/across,v=j/rows;
      const red=nasal?new T.Color('#ac786e'):new T.Color(o.skin);
      // More mucosal colour at the inner fold, skin tone toward the attachment.
      red.lerp(new T.Color(o.skin),Math.pow(u,2)*.7);
      const shadow=1-.12*Math.exp(-(((u-.12)/.065)**2))*Math.sin(v*Math.PI);
      colors.set([red.r*shadow,red.g*shadow,red.b*shadow],k*3);
      if(i<across&&j<rows)idx.push(k,k+1,k+across+2,k,k+across+2,k+across+1);
    }
    g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('color',new T.BufferAttribute(colors,3));g.setIndex(idx);
    const mesh=new T.Mesh(g,new T.MeshPhysicalMaterial({vertexColors:true,roughness:nasal?.48:.65,clearcoat:nasal?.18:.035,clearcoatRoughness:.4,side:T.DoubleSide}));surround.add(mesh);
    return {mesh,across,rows,nasal};
  });
  const hair=(g,i,point,dx,dy,dz,width=.000032)=>{
    const n=Math.hypot(dx,dy)||1,nx=-dy/n,ny=dx/n;
    for(let j=0;j<=4;j++){
      const t=j/4,w=width*(1-t)**.7+.000002,x=point[0]+dx*t,y=point[1]+dy*(t*.5+t*t*.5),z=point[2]+dz*Math.sin(t*Math.PI/2);
      g.attributes.position.setXYZ(i*10+j*2,x+nx*w,y+ny*w,z);g.attributes.position.setXYZ(i*10+j*2+1,x-nx*w,y-ny*w,z);
    }
  };
  let previous='';
  function update(angles,state,options={}){
    yaw.rotation.set(0,angles[0]*Math.PI/180,0);pitch.rotation.set(-angles[1]*Math.PI/180,0,0);
    const center=new T.Vector3(...rotateEyePoint([0,0,.0056],angles[0],angles[1])),direction=center.clone().normalize();
    for(const {mesh,normal}of glints){mesh.position.copy(center).addScaledVector(normal,.00793);mesh.visible=normal.dot(direction)>.64;}
    const opts={...o,...options};material.color.copy(skinTone(opts.skin));iris.material.uniforms.irisColor.value.set(opts.iris);iris.material.uniforms.pupil.value=opts.pupilMm/11.4;
    updateSocket(socket,root,state,bareMode);
    if(!state)return;
    const open=1-state.closure;
    rimMesh.visible=open>.015&&state.restUpper>state.restLower;
    rimMaterial.clearcoat=.85*open;rimMaterial.roughness=.28+.35*(1-open);
    rimMaterial.color.set('#b88678').lerp(new T.Color(opts.skin),1-open);
    const signature=[state.restUpper,state.restLower,state.closure,state.apexShift,state.globeYaw,state.globePitch,state.browLift,opts.skin].join(',');if(signature===previous)return;previous=signature;
    for(let i=0;i<=N;i++){
      const theta=i/N*Math.PI*2,s=Math.sin(theta);
      for(let j=0;j<=RINGS;j++){
        const q=j/RINGS,k=j*(N+1)+i,point=lidSurface(theta,q,state),wx=point[0]+(index?.032:-.032);
        geometry.attributes.position.setXYZ(k,...point);const mapped=faceUV(wx,point[1]);uv[k*2]=mapped[0];uv[k*2+1]=mapped[1];micro[k*2]=wx/.04;micro[k*2+1]=point[1]/.04;
        const red=.09*Math.exp(-q*17)*Math.abs(s),tint=skinTint(point[0],point[1],state.side);
        const crease=.10*Math.max(0,s)*(1-state.closure)**2*Math.exp(-(((q-.205-.025*Math.cos(theta))/.027)**2));
        color[k*3]=tint[0]-crease*.65;color[k*3+1]=tint[1]-red-crease;color[k*3+2]=tint[2]-red*.9-crease;
      }
      const edge=lidSurface(theta,0,state),thickness=.00021*Math.abs(s)*(.25+.75*open);
      rimGeo.attributes.position.setXYZ(i*2,edge[0],edge[1],edge[2]+.000025);
      rimGeo.attributes.position.setXYZ(i*2+1,edge[0],edge[1]+Math.sign(s)*thickness,edge[2]+.00006);
    }
    for(const {mesh,across,rows,nasal}of corners){
      mesh.visible=state.closure<.999&&state.restUpper>state.restLower;
      const skin=new T.Color(opts.skin),pink=new T.Color('#ac786e'),caruncle=new T.Color('#9c625d');
      for(let j=0;j<=rows;j++)for(let i=0;i<=across;i++){
        const u=i/across,v=j/rows,k=j*(across+1)+i;
        mesh.geometry.attributes.position.setXYZ(k,...canthusSurface(u,v,state,nasal));
        const c=nasal?pink.clone().lerp(skin,u*u*.7):skin.clone(),shade=1-.12*Math.exp(-(((u-.12)/.065)**2))*Math.sin(v*Math.PI);
        if(nasal)c.lerp(caruncle,.42*Math.exp(-(((u-.52)/.24)**2)-(((v-.46)/.34)**2)));
        mesh.geometry.attributes.color.setXYZ(k,c.r*shade,c.g*shade,c.b*shade);
      }
      mesh.geometry.attributes.color.needsUpdate=true;mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
    }
    for(const [mesh,count,upper]of [[upperLashes,72,true],[lowerLashes,36,false]])for(let i=0;i<count;i++){
      const f=(i+.5+.25*Math.sin(i*1.67))/count,theta=(upper?1:-1)*(.15+f*.70)*Math.PI,point=lidSurface(theta,0,state),length=(upper?.00165:.0008)*( .65+.35*Math.sin(f*Math.PI))*(.65+.35*Math.sin(i*4.31));
      const dx=(Math.cos(theta)*.8-state.side*.25+Math.sin(i*1.7)*.2)*length,dy=(upper?1:-1)*length*(upper?1-1.45*state.closure:1),dz=length*(upper?.55:.25);
      point[2]+=.00012;hair(mesh.geometry,i,point,dx,dy,dz,upper?.000028:.000020);
    }
    for(const attr of ['position','uv','uv1','color'])geometry.attributes[attr].needsUpdate=true;geometry.computeVertexNormals();
    // Matching normals and UVs at the rim remove the old circular patch seams.
    for(let i=0;i<=N;i++){const k=RINGS*(N+1)+i;geometry.attributes.normal.setXYZ(k,...faceNormal(pos[k*3]+(index?.032:-.032),pos[k*3+1]));}
    geometry.attributes.normal.needsUpdate=true;geometry.computeBoundingSphere();
    rimGeo.attributes.position.needsUpdate=true;rimGeo.computeVertexNormals();rimGeo.computeBoundingSphere();
    for(const mesh of [upperLashes,lowerLashes]){mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeBoundingSphere();}
  }
  return {root,yaw,pitch,surround,update,setBare(value){bareMode=value;surround.visible=!value;socket.socketEnabled.value=value?0:1;},get skinGeometry(){return geometry;},get cornerGeometries(){return corners.map(c=>c.mesh.geometry);}};
}
export function createEyeView(host,{bare=false,background='#192627'}={}){
  const scene=new T.Scene();scene.background=new T.Color(background);
  scene.add(new T.HemisphereLight('#fff1e6','#78625a',.85));
  const key=new T.DirectionalLight('#fff3e9',2.5);key.position.set(-.10,.16,.35);scene.add(key);
  const fill=new T.DirectionalLight('#e2e9ee',1.2);fill.position.set(.18,-.02,.30);scene.add(fill);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;host.prepend(renderer.domElement);
  if(!bare){
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-.115;key.shadow.camera.right=.115;
    key.shadow.camera.top=.10;key.shadow.camera.bottom=-.13;key.shadow.camera.near=.08;key.shadow.camera.far=.65;
    key.shadow.bias=-.00018;key.shadow.normalBias=.00025;key.shadow.radius=4;key.shadow.blurSamples=8;
  }
  const environment=studioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.26;
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',bare?'相同角度的裸眼对照':'包含动态眼睑、湿润睑缘及眼周褶皱的双眼模拟');
  // A long-lens, frontal perspective retains a useful examination view while
  // allowing the nose, sockets and cheeks to have genuine depth cues.
  const camera=new T.PerspectiveCamera(12,1,.01,2);camera.position.set(0,bare?0:-.009,.42);camera.lookAt(0,bare?0:-.009,0);
  const rigs=[0,1].map(i=>{const rig=createEyeRig(i,{bare});rig.root.position.x=i?.032:-.032;scene.add(rig.root);return rig;});
  const face=bare?null:addFace(scene);let oldW=0,oldH=0;
  function draw(angles,states,options={}){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    if(w!==oldW||h!==oldH){oldW=w;oldH=h;renderer.setSize(w,h,false);const halfY=Math.max(bare?.024:.045,(bare?.072:.078)/(w/h));camera.aspect=w/h;camera.fov=2*Math.atan(halfY/.42)*180/Math.PI;camera.updateProjectionMatrix();}
    if(face)face.material.color.copy(skinTone(options.skin||DEFAULT_APPEARANCE.skin));
    rigs.forEach((rig,i)=>rig.update(angles.slice(i*2,i*2+2),states[i],options));renderer.render(scene,camera);
  }
  return {draw,rigs,renderer,scene,camera};
}
