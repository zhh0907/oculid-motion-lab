// Geometry-only preparation: weld the scan, open two sockets, and use the
// original boundary vertices as the outer vertices of the animated lids.
export const HEAD_ALIGNMENT={scale:.053622558219310126,centre:[-.11942615999999998,1.663294495,1.809395865]};
export function decodeHeadGLB(buffer){
  const h=new DataView(buffer),n=h.getUint32(12,true);
  if(h.getUint32(0,true)!==0x46546c67)throw Error('Invalid head GLB');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,n))),offset=28+n;
  const read=id=>{const a=json.accessors[id],v=json.bufferViews[a.bufferView],Type={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType],size={SCALAR:1,VEC3:3,VEC2:2}[a.type];if(v.byteStride)throw Error('Interleaved head data not supported');return new Type(buffer,offset+(v.byteOffset||0)+(a.byteOffset||0),a.count*size).slice();};
  const p=json.meshes[0].primitives[0];return {positions:read(p.attributes.POSITION),indices:read(p.indices)};
}
export function buildHeadTopology(source,rings=18){
  const map=new Map(),remap=[],indices=[];let positions=[];
  for(let i=0;i<source.positions.length;i+=3){
    const p=Array.from(source.positions.slice(i,i+3),(v,j)=>(v-HEAD_ALIGNMENT.centre[j])*HEAD_ALIGNMENT.scale+(j===2?.008:0));
    const key=p.map(v=>Math.round(v*1e7)).join(',');let k=map.get(key);
    if(k===undefined){k=positions.length/3;map.set(key,k);positions.push(...p);}remap.push(k);
  }
  const original=Array.from(source.indices,k=>remap[k]),refined=subdivide(positions,original);positions=refined.positions;
  for(let i=0;i<refined.indices.length;i+=3){
    const ids=refined.indices.slice(i,i+3);if(new Set(ids).size!==3)continue;
    const [x,y,z]=[0,1,2].map(d=>ids.reduce((s,k)=>s+positions[k*3+d],0)/3);
    if(z>-.025&&[-.032,.032].some(cx=>((x-cx)/.024)**2+(y/.019)**2<1))continue;
    indices.push(...ids);
  }
  const edges=new Map();
  for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
    const a=indices[i+j],b=indices[i+(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
    if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});
  }
  const next=new Map([...edges.values()].filter(e=>e.count===1).map(e=>[e.a,e.b])),loops=[];
  while(next.size){const start=next.keys().next().value,loop=[];let p=start;
    do{loop.push(p);const q=next.get(p);next.delete(p);if(q===undefined)throw Error('Non-manifold head boundary');p=q;}while(p!==start&&loop.length<10000);
    loops.push(loop);
  }
  const patches=[-.032,.032].map((cx,eye)=>{
    const candidates=loops.filter(loop=>{const c=[0,1,2].map(d=>loop.reduce((s,k)=>s+positions[k*3+d],0)/loop.length);return Math.abs(c[0]-cx)<.012&&Math.abs(c[1])<.012&&c[2]>-.025;});
    if(candidates.length!==1)throw Error(`Expected one socket boundary for eye ${eye}`);
    const coarse=candidates[0],boundary=[],splits=Math.ceil(160/coarse.length);
    for(let i=0;i<coarse.length;i++){
      const a=coarse[i],b=coarse[(i+1)%coarse.length],chain=[a];
      for(let j=1;j<splits;j++){const id=positions.length/3,t=j/splits;positions.push(...[0,1,2].map(d=>positions[a*3+d]*(1-t)+positions[b*3+d]*t));chain.push(id);}
      boundary.push(...chain);chain.push(b);
      let found=false;
      for(let k=0;k<indices.length&&!found;k+=3)for(let r=0;r<3;r++)if(indices[k+r]===a&&indices[k+(r+1)%3]===b){
        const c=indices[k+(r+2)%3],fan=[];for(let j=0;j<splits;j++)fan.push(chain[j],chain[j+1],c);
        indices.splice(k,3,...fan);found=true;break;
      }
      if(!found)throw Error('Missing socket edge during subdivision');
    }
    const count=boundary.length,start=positions.length/3;
    // The cut follows irregular scan triangles. Raw polar angles can reverse
    // along a concave edge, folding the inner eyelid back over itself. Use a
    // monotonic arc-length parameter while retaining every boundary vertex.
    const lengths=boundary.map((a,i)=>{const b=boundary[(i+1)%count];return Math.hypot((positions[b*3]-positions[a*3])/.024,(positions[b*3+1]-positions[a*3+1])/.019);});
    const perimeter=lengths.reduce((a,b)=>a+b,0),startAngle=Math.atan2(positions[boundary[0]*3+1]/.019,(positions[boundary[0]*3]-cx)/.024);
    let travelled=0;const angles=lengths.map(length=>{const a=startAngle-travelled/perimeter*Math.PI*2;travelled+=length;return a;});
    for(let j=0;j<rings;j++)for(let i=0;i<count;i++)positions.push(0,0,0);
    const at=(j,i)=>j===rings?boundary[i%count]:start+j*count+i%count;
    for(let j=0;j<rings;j++)for(let i=0;i<count;i++)indices.push(at(j,i),at(j,i+1),at(j+1,i+1),at(j,i),at(j+1,i+1),at(j+1,i));
    // The second row is a real inner surface: eyelid thickness remains visible
    // in profile, instead of an infinitely thin opening in a sheet.
    const innerStart=positions.length/3;
    for(let i=0;i<count;i++){positions.push(0,0,0);const n=(i+1)%count;indices.push(start+n,start+i,innerStart+i,start+n,innerStart+i,innerStart+n);}
    return {eye,cx,boundary,angles,count,start,innerStart,rings};
  });
  return {positions:new Float32Array(positions),indices:new Uint32Array(indices),patches};
}
function subdivide(vertices,triangles){
  const neighbours=Array.from({length:vertices.length/3},()=>new Set()),edges=new Map();
  for(let i=0;i<triangles.length;i+=3)for(let j=0;j<3;j++){
    const a=triangles[i+j],b=triangles[i+(j+1)%3],opposite=triangles[i+(j+2)%3],key=a<b?`${a},${b}`:`${b},${a}`;
    neighbours[a].add(b);neighbours[b].add(a);if(!edges.has(key))edges.set(key,{a,b,opposite:[]});edges.get(key).opposite.push(opposite);
  }
  const boundary=Array.from({length:neighbours.length},()=>[]);
  for(const e of edges.values())if(e.opposite.length===1){boundary[e.a].push(e.b);boundary[e.b].push(e.a);}
  const positions=vertices.slice(),indices=[];
  for(let i=0;i<neighbours.length;i++){
    const n=neighbours[i].size,beta=n===3?3/16:3/(8*n);
    for(let d=0;d<3;d++){
      if(boundary[i].length===2)positions[i*3+d]=.75*vertices[i*3+d]+.125*(vertices[boundary[i][0]*3+d]+vertices[boundary[i][1]*3+d]);
      else if(n)positions[i*3+d]=(1-n*beta)*vertices[i*3+d]+beta*[...neighbours[i]].reduce((s,j)=>s+vertices[j*3+d],0);
    }
  }
  for(const e of edges.values()){
    e.id=positions.length/3;
    for(let d=0;d<3;d++)positions.push(e.opposite.length===2?.375*(vertices[e.a*3+d]+vertices[e.b*3+d])+.125*(vertices[e.opposite[0]*3+d]+vertices[e.opposite[1]*3+d]):.5*(vertices[e.a*3+d]+vertices[e.b*3+d]));
  }
  const mid=(a,b)=>edges.get(a<b?`${a},${b}`:`${b},${a}`).id;
  for(let i=0;i<triangles.length;i+=3){const [a,b,c]=triangles.slice(i,i+3),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);indices.push(a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca);}
  return {positions,indices};
}
