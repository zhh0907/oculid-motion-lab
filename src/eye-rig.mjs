import * as T from '../vendor/three.module.js';
import {DEFAULT_APPEARANCE,lidBounds,skinZ,rotateEyePoint,EYE_RADIUS,HALF_WIDTH} from './eyelid-model.mjs?v=anatomical2';
import {faceSurface,faceNormal,lidSurface,OUTER_X,OUTER_Y} from './periocular-shape.mjs?v=anatomical2';

const N=112,RINGS=20;
function cap(radius,extent,bulge=0){
  const p=[],uv=[],indices=[];
  for(let j=0;j<=24;j++)for(let i=0;i<=96;i++){
    const r=extent*j/24,a=i/96*Math.PI*2,x=r*Math.cos(a),y=r*Math.sin(a);
    p.push(x,y,Math.sqrt(radius*radius-r*r)+bulge*(1-(r/extent)**2));uv.push(.5+x/extent/2,.5+y/extent/2);
    if(j<24&&i<96){const k=j*97+i;indices.push(k,k+98,k+1,k,k+97,k+98);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
let skinMaps;
function textures(){
  if(skinMaps)return skinMaps;
  const size=512,color=document.createElement('canvas'),bump=document.createElement('canvas');color.width=color.height=bump.width=bump.height=size;
  const ctx=color.getContext('2d'),bc=bump.getContext('2d'),pixels=ctx.createImageData(size,size),height=bc.createImageData(size,size);let seed=9713;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,n=random(),m=.3*Math.sin(x*.053)*Math.sin(y*.041),v=247+m+(n-.5)*2;
    pixels.data.set([v,v-2-(n>.985?13:0),v-3-(n>.985?16:0),255],i);
    const h=127+(n-.5)*36;height.data.set([h,h,h,255],i);
  }
  ctx.putImageData(pixels,0,0);bc.putImageData(height,0,0);
  for(let i=0;i<1350;i++){const x=random()*size,y=random()*size,r=.25+random()*.65;ctx.fillStyle=`rgba(108,65,45,${.018+random()*.035})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  const map=new T.CanvasTexture(color),bumpMap=new T.CanvasTexture(bump);map.colorSpace=T.SRGBColorSpace;
  for(const t of [map,bumpMap]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;}
  return skinMaps={map,bumpMap};
}
function skinMaterial(color,vertexColors=false){return new T.MeshPhysicalMaterial({color,...textures(),bumpScale:.000004,roughness:.67,clearcoat:.12,clearcoatRoughness:.45,vertexColors,side:T.DoubleSide});}
function addFace(scene){
  const g=new T.PlaneGeometry(.16,.10,140,90),p=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){p.setZ(i,faceSurface(p.getX(i),p.getY(i)));uv.setXY(i,p.getX(i)/.04,p.getY(i)/.04);}
  const kept=[],idx=g.index.array;
  for(let k=0;k<idx.length;k+=3){const a=idx[k],b=idx[k+1],c=idx[k+2],x=(p.getX(a)+p.getX(b)+p.getX(c))/3,y=(p.getY(a)+p.getY(b)+p.getY(c))/3;
    if(![-.032,.032].some(cx=>((x-cx)/.0324)**2+(y/.0264)**2<1))kept.push(a,b,c);
  }g.setIndex(kept);g.computeVertexNormals();
  for(let i=0;i<p.count;i++)g.attributes.normal.setXYZ(i,...faceNormal(p.getX(i),p.getY(i)));
  const face=new T.Mesh(g,skinMaterial(DEFAULT_APPEARANCE.skin));scene.add(face);return face;
}
function studioEnvironment(renderer){
  const room=new T.Scene();room.background=new T.Color('#8c9190');
  for(const [x,y,z,w,h,strength]of [[-.8,1.1,2,1.1,.7,5],[1,.25,2,.35,.6,2]]){
    const box=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(strength,strength,strength),side:T.DoubleSide}));box.position.set(x,y,z);box.lookAt(0,0,0);room.add(box);
  }
  const gen=new T.PMREMGenerator(renderer),target=gen.fromScene(room,.04,.1,5);gen.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target;
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
  const sclera=new T.Mesh(new T.SphereGeometry(EYE_RADIUS,64,48),new T.MeshPhysicalMaterial({color:'#ddd9d1',roughness:.28,clearcoat:1,clearcoatRoughness:.16}));pitch.add(sclera);
  const iris=new T.Mesh(cap(.01255,.0057),irisMaterial(o.iris,o.pupilMm));pitch.add(iris);
  const cornea=new T.Mesh(cap(.01265,.006,.0008),new T.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:.11,roughness:.025,clearcoat:1,clearcoatRoughness:.025,envMapIntensity:1.5,depthWrite:false}));pitch.add(cornea);
  const glints=[[-.12,.19,.974,.00048,.72],[.22,.06,.974,.0002,.38]].map(([x,y,z,r,opacity])=>{
    const normal=new T.Vector3(x,y,z).normalize(),mesh=new T.Mesh(new T.CircleGeometry(r,24),new T.MeshBasicMaterial({color:'#fffaf0',transparent:true,opacity,depthWrite:false}));mesh.scale.set(.7,1,1);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);root.add(mesh);return {mesh,normal};
  });
  const surround=new T.Group();root.add(surround);surround.visible=!bare;
  const pos=new Float32Array((N+1)*(RINGS+1)*3),uv=new Float32Array((N+1)*(RINGS+1)*2),color=new Float32Array(pos.length),indices=[];
  for(let j=0;j<=RINGS;j++)for(let i=0;i<=N;i++){const k=j*(N+1)+i;if(j<RINGS&&i<N)indices.push(k,k+N+1,k+N+2,k,k+N+2,k+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setAttribute('color',new T.BufferAttribute(color,3));geometry.setIndex(indices);
  const material=skinMaterial(o.skin,true);surround.add(new T.Mesh(geometry,material));
  // A real narrow wet margin instead of an outline painted around the aperture.
  const rimGeo=new T.BufferGeometry(),rimPos=new Float32Array((N+1)*6),rimIndices=[];
  for(let i=0;i<N;i++){const k=i*2;rimIndices.push(k,k+1,k+3,k,k+3,k+2);}
  rimGeo.setAttribute('position',new T.BufferAttribute(rimPos,3));rimGeo.setIndex(rimIndices);
  const rimMaterial=new T.MeshPhysicalMaterial({color:'#b27c6d',roughness:.28,clearcoat:1,side:T.DoubleSide});surround.add(new T.Mesh(rimGeo,rimMaterial));
  function hairs(count,color,opacity){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(count*18),3));const mesh=new T.LineSegments(g,new T.LineBasicMaterial({color,transparent:true,opacity}));surround.add(mesh);return mesh;}
  const upperLashes=hairs(58,'#3c2c24',.78),lowerLashes=hairs(30,'#695040',.45),brow=hairs(150,'#4c3729',.46);
  const ducts=[];
  for(const sign of [-1,1]){const nasal=sign===(index?-1:1),duct=new T.Mesh(new T.SphereGeometry(nasal?.00115:.0007,20,16),new T.MeshStandardMaterial({color:nasal?'#b37d73':o.skin,roughness:.46}));duct.scale.set(1,.5,.24);duct.position.set(sign*.0122,-sign*(index?-1:1)*.00055,.0085);surround.add(duct);ducts.push(duct);}
  const hair=(g,i,point,dx,dy,dz)=>{for(let j=0;j<3;j++){const a=j/3,b=(j+1)/3;g.attributes.position.setXYZ(i*6+j*2,point[0]+dx*a,point[1]+dy*a*a,point[2]+dz*Math.sin(a*Math.PI/2));g.attributes.position.setXYZ(i*6+j*2+1,point[0]+dx*b,point[1]+dy*b*b,point[2]+dz*Math.sin(b*Math.PI/2));}};
  let previous='';
  function update(angles,state,options={}){
    yaw.rotation.set(0,angles[0]*Math.PI/180,0);pitch.rotation.set(-angles[1]*Math.PI/180,0,0);
    const center=new T.Vector3(...rotateEyePoint([0,0,.0056],angles[0],angles[1])),direction=center.clone().normalize();
    for(const {mesh,normal}of glints){mesh.position.copy(center).addScaledVector(normal,.00793);mesh.visible=normal.dot(direction)>.64;}
    const opts={...o,...options};material.color.set(opts.skin);iris.material.uniforms.irisColor.value.set(opts.iris);iris.material.uniforms.pupil.value=opts.pupilMm/11.4;
    if(!state)return;
    const signature=[state.restUpper,state.restLower,state.closure,state.apexShift,state.globeYaw,state.globePitch].join(',');if(signature===previous)return;previous=signature;
    for(let i=0;i<=N;i++){
      const theta=i/N*Math.PI*2,s=Math.sin(theta);
      for(let j=0;j<=RINGS;j++){
        const q=j/RINGS,k=j*(N+1)+i,point=lidSurface(theta,q,state),wx=point[0]+(index?.032:-.032);
        geometry.attributes.position.setXYZ(k,...point);uv[k*2]=wx/.04;uv[k*2+1]=point[1]/.04;
        const red=.065*Math.exp(-q*15)*Math.abs(s),shade=.018*Math.exp(-(((q-.27)/.18)**2))*Math.max(0,-s);
        color[k*3]=1-shade;color[k*3+1]=1-red-shade;color[k*3+2]=1-red*.9-shade;
      }
      const edge=lidSurface(theta,0,state),thickness=.00013*Math.abs(s);
      rimGeo.attributes.position.setXYZ(i*2,edge[0],edge[1],edge[2]+.000025);
      rimGeo.attributes.position.setXYZ(i*2+1,edge[0],edge[1]+Math.sign(s)*thickness,edge[2]+.00006);
    }
    for(const [mesh,count,upper]of [[upperLashes,58,true],[lowerLashes,30,false]])for(let i=0;i<count;i++){
      const f=(i+.5+.25*Math.sin(i*1.67))/count,theta=(upper?1:-1)*(.075+f*.85)*Math.PI,point=lidSurface(theta,0,state),length=(upper?.0018:.0009)*( .65+.35*Math.sin(f*Math.PI))*(.65+.35*Math.sin(i*4.31));
      const dx=Math.cos(theta)*length*.65,dy=(upper?1:-1)*length*(upper?1-1.45*state.closure:1),dz=length*(upper?.55:.25);
      point[2]+=.00012;hair(mesh.geometry,i,point,dx,dy,dz);
    }
    for(let i=0;i<150;i++){
      const f=(i+.5)/150,theta=(.11+f*.78)*Math.PI,x=.023*Math.cos(theta),y=.014+.0045*Math.sin(theta)+.00028*Math.sin(i*2.4)+(state.browLift||0)*Math.sin(theta);
      const point=[x,y,faceSurface(x+(index?.032:-.032),y)+.00012];
      const taper=Math.pow(Math.sin(f*Math.PI),.6),length=(.0007+.00055*(.5+.5*Math.sin(i*5.1)))*taper;
      hair(brow.geometry,i,point,-state.side*length*.72,length*.8,.00004);
    }
    for(const attr of ['position','uv','color'])geometry.attributes[attr].needsUpdate=true;geometry.computeVertexNormals();
    // Matching normals and UVs at the rim remove the old circular patch seams.
    for(let i=0;i<=N;i++){const k=RINGS*(N+1)+i;geometry.attributes.normal.setXYZ(k,...faceNormal(pos[k*3]+(index?.032:-.032),pos[k*3+1]));}
    geometry.attributes.normal.needsUpdate=true;geometry.computeBoundingSphere();
    rimGeo.attributes.position.needsUpdate=true;rimGeo.computeVertexNormals();rimGeo.computeBoundingSphere();
    for(const mesh of [upperLashes,lowerLashes,brow]){mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeBoundingSphere();}
  }
  return {root,yaw,pitch,surround,update,setBare(value){surround.visible=!value;},get skinGeometry(){return geometry;}};
}
export function createEyeView(host,{bare=false,background='#192627'}={}){
  const scene=new T.Scene();scene.background=new T.Color(background);
  scene.add(new T.HemisphereLight('#fff1e6','#506064',1.35));
  const key=new T.DirectionalLight('#fff2e6',2.15);key.position.set(-.14,.16,.35);scene.add(key);
  const fill=new T.DirectionalLight('#d7e5ed',.7);fill.position.set(.15,.01,.3);scene.add(fill);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;host.prepend(renderer.domElement);
  const environment=studioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.35;
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',bare?'相同角度的裸眼对照':'包含动态眼睑、湿润睑缘及眼周褶皱的双眼模拟');
  const camera=new T.OrthographicCamera(-.072,.072,.036,-.036,.001,2);camera.position.set(0,0,.2);camera.lookAt(0,0,0);
  const rigs=[0,1].map(i=>{const rig=createEyeRig(i,{bare});rig.root.position.x=i?.032:-.032;scene.add(rig.root);return rig;});
  const face=bare?null:addFace(scene);let oldW=0,oldH=0;
  function draw(angles,states,options={}){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    if(w!==oldW||h!==oldH){oldW=w;oldH=h;renderer.setSize(w,h,false);const halfY=Math.max(.024,.072/(w/h));camera.left=-halfY*w/h;camera.right=halfY*w/h;camera.top=halfY;camera.bottom=-halfY;camera.updateProjectionMatrix();}
    if(face)face.material.color.set(options.skin||DEFAULT_APPEARANCE.skin);
    rigs.forEach((rig,i)=>rig.update(angles.slice(i*2,i*2+2),states[i],options));renderer.render(scene,camera);
  }
  return {draw,rigs,renderer,scene,camera};
}
