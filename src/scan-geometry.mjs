import * as T from '../vendor/three.module.js';
import {FACE_REFERENCE} from './face-reference.mjs';

// This bundled GLB is a single uncompressed, static mesh. Retaining its actual
// surface preserves the nose's overhangs, ears and head silhouette. The sampled
// height/UV field is used only to attach our independently animated eye tissue.
const response=await fetch(new URL('../vendor/face/LeePerrySmith.glb',import.meta.url));
if(!response.ok)throw Error('Face reference could not be loaded');
const buffer=await response.arrayBuffer(),header=new DataView(buffer);
if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2)throw Error('Invalid face reference');
const jsonLength=header.getUint32(12,true);
const gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength)));
const binaryOffset=20+jsonLength+8;
function readAccessor(id){
  const a=gltf.accessors[id],view=gltf.bufferViews[a.bufferView];
  const Type={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];
  const count={SCALAR:1,VEC2:2,VEC3:3}[a.type];
  if(!Type||!count||view.byteStride)throw Error('Unsupported face reference layout');
  return new Type(buffer,binaryOffset+(view.byteOffset||0)+(a.byteOffset||0),a.count*count).slice();
}
export function createScanGeometry(){
  const primitive=gltf.meshes[0].primitives[0],p=readAccessor(primitive.attributes.POSITION);
  const {scale,centre}=FACE_REFERENCE.alignment;
  for(let i=0;i<p.length;i+=3){p[i]=(p[i]-centre[0])*scale;p[i+1]=(p[i+1]-centre[1])*scale;p[i+2]=(p[i+2]-centre[2])*scale+.008;}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p,3));
  g.setAttribute('normal',new T.BufferAttribute(readAccessor(primitive.attributes.NORMAL),3));
  g.setAttribute('uv',new T.BufferAttribute(readAccessor(primitive.attributes.TEXCOORD_0),2));
  const indices=readAccessor(primitive.indices),kept=[];
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    const z=(p[a+2]+p[b+2]+p[c+2])/3;
    // Keep crossing triangles underneath the animated patch. A centroid cut
    // leaves triangular gaps wherever the original scan is more coarsely tiled.
    const opening=z>-.025&&[-.032,.032].some(cx=>[a,b,c].every(k=>((p[k]-cx)/.0315)**2+(p[k+1]/.0255)**2<1));
    if(!opening)kept.push(indices[i],indices[i+1],indices[i+2]);
  }
  g.setIndex(kept);g.computeBoundingSphere();return g;
}
