import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeHeadGLB,buildHeadTopology} from '../src/head-topology.mjs';
import {lidEdge} from '../src/lid-volume.mjs';
import {lidState,skinZ} from '../src/eyelid-model.mjs';
import {IRIS_DEPTH,CORNEA_RADIUS,CORNEA_CENTRE} from '../src/eye-anatomy.mjs';
const bytes=fs.readFileSync(new URL('../vendor/face/LeePerrySmith.glb',import.meta.url));
const topology=buildHeadTopology(decodeHeadGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));

test('both eyelids are topologically welded to the head, without duplicate overlapping borders',()=>{
  const edges=new Map(),adjacency=new Map();
  for(let i=0;i<topology.indices.length;i+=3)for(let j=0;j<3;j++){
    const a=topology.indices[i+j],b=topology.indices[i+(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
    edges.set(key,(edges.get(key)||0)+1);if(!adjacency.has(a))adjacency.set(a,new Set());adjacency.get(a).add(b);
  }
  for(const patch of topology.patches){
    assert.ok(patch.count>=160);
    for(let i=0;i<patch.count;i++){
      const a=patch.boundary[i],b=patch.boundary[(i+1)%patch.count];assert.equal(edges.get(a<b?`${a},${b}`:`${b},${a}`),2);
      if(i)assert.ok(patch.angles[i]<patch.angles[i-1]);
    }
  }
  const reached=new Set(),stack=[topology.patches[0].start];
  while(stack.length){const v=stack.pop();if(reached.has(v))continue;reached.add(v);for(const next of adjacency.get(v)||[])stack.push(next);}
  for(const patch of topology.patches)for(const v of [...patch.boundary,patch.start,patch.innerStart])assert.ok(reached.has(v),'eyelid must belong to the same connected skin surface');
});
test('3D lid edge clears the turning globe and iris lies behind the cornea',()=>{
  assert.ok(IRIS_DEPTH<CORNEA_CENTRE+CORNEA_RADIUS-.002);
  for(const yaw of [-50,0,50])for(const pitch of [-40,0,35])for(const closed of [0,.5,1]){
    const state=lidState(pitch,closed,{},0,yaw);
    for(let i=0;i<160;i++){const p=lidEdge(i/160*2*Math.PI,state);assert.ok(p.every(Number.isFinite));assert.ok(p[2]>=skinZ(p[0],p[1],yaw,pitch)-1e-12);}
  }
});
