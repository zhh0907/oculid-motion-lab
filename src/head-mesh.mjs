import * as T from '../vendor/three.module.js';
import {decodeHeadGLB,buildHeadTopology} from './head-topology.mjs';
import {attachedLidPoint,lidEdge,volumeCanthus} from './lid-volume.mjs';
import {DEFAULT_APPEARANCE,lidState,skinZ} from './eyelid-model.mjs?v=faces8';
import {skinMaterial,skinTint,skinTone} from './skin-material.mjs?v=faces8';
import {morphHeadPoint,FACE_PROFILE_VERSION} from './face-profiles.mjs';

const response=await fetch(new URL('../vendor/face/LeePerrySmith.glb',import.meta.url));
if(!response.ok)throw Error('3D head mesh unavailable');
const source=decodeHeadGLB(await response.arrayBuffer());

function surfaceSampler(geometry){
  const p=geometry.attributes.position.array,idx=geometry.index.array,buckets=new Map(),cell=.004;
  for(let k=0;k<idx.length;k+=3){const ids=[idx[k],idx[k+1],idx[k+2]],x=ids.map(i=>p[i*3]),y=ids.map(i=>p[i*3+1]);
    if(Math.max(...ids.map(i=>p[i*3+2]))<-.03)continue;
    for(let ix=Math.floor(Math.min(...x)/cell);ix<=Math.floor(Math.max(...x)/cell);ix++)for(let iy=Math.floor(Math.min(...y)/cell);iy<=Math.floor(Math.max(...y)/cell);iy++){const key=ix+','+iy;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(ids);}
  }
  return (x,y)=>{let best=null,depth=-Infinity;for(const ids of buckets.get(Math.floor(x/cell)+','+Math.floor(y/cell))||[]){
    const [a,b,c]=ids.map(i=>[p[i*3],p[i*3+1],p[i*3+2]]),d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)continue;
    const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d,w=1-u-v;
    if(Math.min(u,v,w)<-1e-6)continue;const z=u*a[2]+v*b[2]+w*c[2];if(z>depth){depth=z;best={ids,weights:[u,v,w]};}
  }return best;};
}
function tubeHairGeometry(count){
  const g=new T.BufferGeometry(),indices=[];g.setAttribute('position',new T.BufferAttribute(new Float32Array(count*15*3),3));
  for(let i=0;i<count;i++)for(let j=0;j<4;j++)for(let s=0;s<3;s++){const a=i*15+j*3+s,b=i*15+j*3+(s+1)%3;indices.push(a,b,b+3,a,b+3,a+3);}
  g.setIndex(indices);return g;
}
function hair(g,index,root,dx,dy,dz,width){
  const p=g.attributes.position,n=Math.hypot(dx,dy)||1,nx=-dy/n,ny=dx/n;
  for(let j=0;j<=4;j++){const t=j/4,r=width*(1-t)+.000002;for(let k=0;k<3;k++){const a=k/3*Math.PI*2;p.setXYZ(index*15+j*3+k,root[0]+dx*t+nx*r*Math.cos(a),root[1]+dy*(t*.65+t*t*.35)+ny*r*Math.cos(a),root[2]+dz*Math.sin(t*Math.PI/2)+r*Math.sin(a));}}
}
export function createHeadSkin(){
  const group=new T.Group(),data=buildHeadTopology(source),g=new T.BufferGeometry();
  const p=new T.BufferAttribute(data.positions,3);g.setAttribute('position',p);g.setIndex(new T.BufferAttribute(data.indices,1));
  const uv=new Float32Array(p.count*2),color=new Float32Array(p.count*3);g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setAttribute('color',new T.BufferAttribute(color,3));
  // Compute anchor normals using only the retained scan. Uninitialised lid
  // vertices at the origin must never contribute to the boundary normals.
  const animated=new Uint8Array(p.count);
  for(const patch of data.patches){animated.fill(1,patch.start,patch.start+patch.count*patch.rings);animated.fill(1,patch.innerStart,patch.innerStart+patch.count);}
  const staticIndices=[];for(let i=0;i<data.indices.length;i+=3)if(!animated[data.indices[i]]&&!animated[data.indices[i+1]]&&!animated[data.indices[i+2]])staticIndices.push(data.indices[i],data.indices[i+1],data.indices[i+2]);
  g.setIndex(staticIndices);g.computeVertexNormals();const normals=g.attributes.normal.array.slice();g.setIndex(new T.BufferAttribute(data.indices,1));
  for(const patch of data.patches){patch.anchors=patch.boundary.map(k=>[p.getX(k)-patch.cx,p.getY(k),p.getZ(k)]);patch.normals=patch.boundary.map(k=>[normals[k*3],normals[k*3+1],normals[k*3+2]]);}
  const material=skinMaterial(DEFAULT_APPEARANCE.skin,true),clay=new T.MeshStandardMaterial({color:'#abb2ae',roughness:.82,side:T.DoubleSide});
  const mesh=new T.Mesh(g,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name='Connected head and eyelids';group.add(mesh);
  const marginGeometries=[],cornerGeometries=[],margins=[],corners=[];
  for(const patch of data.patches){
    const mg=new T.BufferGeometry(),mi=[];mg.setAttribute('position',new T.BufferAttribute(new Float32Array((patch.count+1)*6),3));
    for(let i=0;i<patch.count;i++)mi.push(i*2,i*2+1,i*2+3,i*2,i*2+3,i*2+2);mg.setIndex(mi);
    const mm=new T.Mesh(mg,new T.MeshPhysicalMaterial({color:'#a57565',roughness:.3,clearcoat:.8,side:T.DoubleSide}));mm.name='Volumetric wet lid margin';group.add(mm);margins.push(mm);marginGeometries.push(mg);
    for(const nasal of [true,false]){const cg=new T.BufferGeometry(),ci=[];cg.setAttribute('position',new T.BufferAttribute(new Float32Array(25*13*3),3));
      for(let y=0;y<12;y++)for(let x=0;x<24;x++){const k=y*25+x;ci.push(k,k+1,k+26,k,k+26,k+25);}cg.setIndex(ci);
      const cm=new T.Mesh(cg,new T.MeshPhysicalMaterial({color:nasal?'#b47c70':'#b98e79',roughness:.48,clearcoat:.2,side:T.DoubleSide}));cm.name='3D canthus';group.add(cm);corners.push({mesh:cm,eye:patch.eye,nasal});cornerGeometries.push(cg);
    }
  }
  let previous='',mode='skin',brows=[],browMesh=null,restReady=false,basePositions=null,femaleOffsets=null,faceType='male';
  const lashSpecs=data.patches.flatMap(p=>[[p.eye,true,70],[p.eye,false,32]]),lashGeometry=tubeHairGeometry(204),lashMesh=new T.Mesh(lashGeometry,new T.MeshStandardMaterial({color:'#382b25',roughness:.9,side:T.DoubleSide}));group.add(lashMesh);
  function update(states,appearance={}){
    const o={...DEFAULT_APPEARANCE,...appearance};material.color.copy(skinTone(o.skin));
    for(const corner of corners)if(mode==='skin')corner.mesh.material.color.set(corner.nasal?'#b47c70':o.skin);
    faceType=o.faceType==='female'?'female':'male';
    const signature=JSON.stringify([faceType,states.map(s=>[s.restUpper,s.restLower,s.closure,s.apexShift,s.globeYaw,s.globePitch])]);if(signature===previous)return;previous=signature;
    // Always deform from the canonical mesh, never from the previous profile.
    if(basePositions)p.array.set(basePositions);
    for(const patch of data.patches){const state=states[patch.eye];
      if(!patch.rest){
        const neutral=lidState(0,0,{},patch.eye),n=patch.count,r=patch.rings;
        patch.neutralEdges=patch.angles.map(t=>lidEdge(t,neutral));
        let rest=new Float64Array((r+1)*n*3),next=new Float64Array(rest.length);
        for(let j=0;j<=r;j++)for(let i=0;i<n;i++)rest.set(attachedLidPoint(patch.angles[i],j/r,neutral,patch.anchors[i],patch.normals[i]),(j*n+i)*3);
        // Fair the interior of the stitched surface while both boundary loops
        // remain exactly fixed. This removes radial creases inherited from an
        // irregular scan cut, without placing a second sheet over the face.
        for(let iteration=0;iteration<160;iteration++){
          next.set(rest);
          for(let j=1;j<r;j++)for(let i=0;i<n;i++){
            const k=(j*n+i)*3,a=(j*n+(i+n-1)%n)*3,b=(j*n+(i+1)%n)*3;
            for(let d=0;d<3;d++)next[k+d]=.2*rest[k+d]+.32*(rest[a+d]+rest[b+d])+.08*(rest[k-n*3+d]+rest[k+n*3+d]);
            const x=next[k],y=next[k+1];if(x*x+y*y<.0138**2)next[k+2]=Math.max(next[k+2],skinZ(x,y));
          }
          [rest,next]=[next,rest];
        }
        patch.rest=rest;
      }
      for(let j=0;j<patch.rings;j++)for(let i=0;i<patch.count;i++){
        const k=(j*patch.count+i)*3,edge=lidEdge(patch.angles[i],state),weight=(1-j/patch.rings)**2;
        const point=[0,1,2].map(d=>patch.rest[k+d]+(edge[d]-patch.neutralEdges[i][d])*weight);
        const q=j/patch.rings,s=Math.sin(patch.angles[i]),open=1-state.closure;
        if(restReady)point[2]+=Math.max(0,s)*open*open*(.00042*Math.exp(-(((q-.13)/.065)**2))-.00065*Math.exp(-(((q-.33)/.06)**2))+.00022*Math.exp(-(((q-.46)/.13)**2)))*weight;
        if(point[0]**2+point[1]**2<.0138**2)point[2]=Math.max(point[2],skinZ(point[0],point[1],state.globeYaw,state.globePitch,state.corneaCenter));
        p.setXYZ(patch.start+j*patch.count+i,point[0]+patch.cx,point[1],point[2]);
      }
      for(let i=0;i<patch.count;i++){const point=lidEdge(patch.angles[i],state);p.setXYZ(patch.innerStart+i,point[0]*.988+patch.cx,point[1]*.988,point[2]-.00085);}
      const mg=marginGeometries[patch.eye];
      for(let i=0;i<=patch.count;i++){const theta=patch.angles[i%patch.count],point=lidEdge(theta,state),width=.00020*Math.abs(Math.sin(theta));
        mg.attributes.position.setXYZ(i*2,point[0]+patch.cx,point[1],point[2]+.000015);
        mg.attributes.position.setXYZ(i*2+1,point[0]*.993+patch.cx,point[1]+Math.sign(Math.sin(theta))*width,point[2]-.00014);
      }
      mg.attributes.position.needsUpdate=true;mg.computeVertexNormals();mg.computeBoundingSphere();margins[patch.eye].visible=state.closure<.99&&state.restUpper>state.restLower;
    }
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),cx=x<0?-.032:.032,tint=skinTint(x-cx,y,x<0?1:-1);
      const lip=Math.exp(-(((y+.073)/.008)**2))*Math.exp(-((x/.028)**4));
      color.set([tint[0],tint[1]*(1-.19*lip),tint[2]*(1-.12*lip)],i*3);
      // Wrap microscopic detail around the skull rather than stretching a
      // frontal projection into horizontal bands at the temples and ears.
      uv.set([Math.atan2(x,p.getZ(i)+.065)*2,y/.04],i*2);
      if(faceType==='female'&&femaleOffsets)p.setXYZ(i,x+femaleOffsets[i*3],y+femaleOffsets[i*3+1],p.getZ(i)+femaleOffsets[i*3+2]);
    }
    for(const a of ['position','uv','color'])g.attributes[a].needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
    for(const {mesh:cm,eye,nasal}of corners){const s=states[eye];cm.visible=s.closure<.99&&s.restUpper>s.restLower;
      for(let y=0;y<=12;y++)for(let x=0;x<=24;x++){const point=volumeCanthus(x/24,y/12,s,nasal);cm.geometry.attributes.position.setXYZ(y*25+x,point[0]+data.patches[eye].cx,point[1],point[2]);}
      cm.geometry.attributes.position.needsUpdate=true;cm.geometry.computeVertexNormals();cm.geometry.computeBoundingSphere();
    }
    let k=0;for(const [eye,upper,count]of lashSpecs)for(let i=0;i<count;i++){
      const f=(i+.5)/count,theta=(upper?1:-1)*(.14+.72*f)*Math.PI,point=lidEdge(theta,states[eye]);point[0]+=data.patches[eye].cx;point[2]+=.00007;
      const l=(upper?.0020:.0009)*(.60+.40*Math.sin(f*Math.PI))*(.72+.28*Math.sin(i*5.7));
      hair(lashGeometry,k++,point,Math.cos(theta)*l*.65,(upper?1:-1)*l*(upper?1-1.4*states[eye].closure:1),l*.65,upper?.000028:.000019);
    }
    lashGeometry.attributes.position.needsUpdate=true;lashGeometry.computeVertexNormals();lashGeometry.computeBoundingSphere();
    if(browMesh){const normals=g.attributes.normal;
      for(let i=0;i<brows.length;i++){const b=brows[i],root=[0,0,0],n=[0,0,0];for(let j=0;j<3;j++)for(let d=0;d<3;d++){root[d]+=p.array[b.ids[j]*3+d]*b.weights[j];n[d]+=normals.array[b.ids[j]*3+d]*b.weights[j];}for(let d=0;d<3;d++)root[d]+=.00012*n[d];hair(browMesh.geometry,i,root,...b.direction.map(v=>v*(faceType==='female'?.78:1)),b.width*(faceType==='female'?.68:1));}
      browMesh.geometry.attributes.position.needsUpdate=true;browMesh.geometry.computeVertexNormals();browMesh.geometry.computeBoundingSphere();
    }
  }
  const neutral=[lidState(0,0,{},0),lidState(0,0,{},1)];update(neutral);
  // Fair a collar on BOTH sides of the welded junction. Sharing positions
  // alone is C0 continuity; relaxing this collar removes the old scan cut's
  // normal discontinuity as well. The aperture and globe remain constrained.
  const neighbours=Array.from({length:p.count},()=>new Set());
  for(let i=0;i<data.indices.length;i+=3){const a=data.indices[i],b=data.indices[i+1],c=data.indices[i+2];for(const [u,v]of [[a,b],[b,c],[c,a]]){neighbours[u].add(v);neighbours[v].add(u);}}
  const weights=new Float32Array(p.count),working=p.array.slice();
  for(let i=0;i<p.count;i++){
    if(p.getZ(i)<-.025)continue;
    const r=Math.min(...[-.032,.032].map(cx=>Math.hypot((p.getX(i)-cx)/.024,p.getY(i)/.019)));
    if(r>.65&&r<1.55)weights[i]=Math.exp(-(((r-1)/.29)**4));
  }
  for(let iteration=0;iteration<45;iteration++)for(const rate of [.45,-.47]){
    working.set(p.array);
    for(let i=0;i<p.count;i++){const w=weights[i];if(!w||!neighbours[i].size)continue;for(let d=0;d<3;d++){let mean=0;for(const j of neighbours[i])mean+=p.array[j*3+d];working[i*3+d]+=rate*w*(mean/neighbours[i].size-p.array[i*3+d]);}}
    p.array.set(working);
  }
  for(const patch of data.patches){
    patch.anchors=patch.boundary.map(k=>[p.getX(k)-patch.cx,p.getY(k),p.getZ(k)]);
    for(let j=0;j<patch.rings;j++)for(let i=0;i<patch.count;i++){const k=patch.start+j*patch.count+i;patch.rest.set([p.getX(k)-patch.cx,p.getY(k),p.getZ(k)],(j*patch.count+i)*3);}
  }
  p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  const sample=surfaceSampler(g);
  for(let eye=0;eye<2;eye++)for(let i=0;i<650;i++){
    const f=(i+.5)/650,side=eye?-1:1,x=data.patches[eye].cx+side*(.019-.042*f);
    const y=.014+.0048*Math.sin((.12+.83*f)*Math.PI)+.0016*Math.sin(i*2.399)*(1-.7*f),binding=sample(x,y);if(!binding)continue;
    const length=(.0016+.0011*(.5+.5*Math.sin(i*5.73)))*Math.sin(Math.PI*f)**.23;
    brows.push({...binding,direction:[-side*length*(.18+.7*f),length*(1-.82*f),.00018],width:.000040+.000018*(.5+.5*Math.sin(i*2.7))});
  }
  browMesh=new T.Mesh(tubeHairGeometry(brows.length),new T.MeshStandardMaterial({color:'#382c25',roughness:1,side:T.DoubleSide}));browMesh.name='Individual 3D eyebrow hairs';group.add(browMesh);restReady=true;previous='';update(neutral);
  basePositions=p.array.slice();
  femaleOffsets=new Float32Array(basePositions.length);
  for(let i=0;i<p.count;i++){const start=i*3,xyz=Array.from(basePositions.slice(start,start+3)),morphed=morphHeadPoint(...xyz,'female');for(let d=0;d<3;d++)femaleOffsets[start+d]=morphed[d]-xyz[d];}
  for(const {mesh:cm}of corners)cm.userData.skinMaterial=cm.material;
  for(const mm of margins)mm.userData.skinMaterial=mm.material;
  function setMode(value){mode=value;mesh.material=value==='skin'?material:clay;clay.wireframe=value==='wire';for(const h of [browMesh,lashMesh])h.visible=value==='skin';for(const cm of [...corners.map(c=>c.mesh),...margins])cm.material=value==='skin'?cm.userData.skinMaterial:clay;}
  return {group,mesh,geometry:g,data,cornerGeometries,update,setMode,get mode(){return mode;},get faceType(){return faceType;},inspection:{sharedBoundaryVertices:data.patches.map(p=>p.count),photographicFaceTexture:false,eyelidThicknessMetres:.00085,eyebrowHairs:brows.length,faceProfileVersion:FACE_PROFILE_VERSION}};
}
