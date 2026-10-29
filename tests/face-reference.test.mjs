import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {faceSurface,faceUV,faceNormal} from '../src/periocular-shape.mjs';
import {FACE_REFERENCE as face} from '../src/face-reference.mjs';

test('reference scan and original texture match their attribution manifest',()=>{
  const provenance=JSON.parse(fs.readFileSync(new URL('../vendor/face/PROVENANCE.json',import.meta.url)));
  assert.equal(provenance.license,'CC BY 3.0');
  for(const [file,hash]of Object.entries(provenance.sha256)){
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../vendor/face/'+file,import.meta.url))).digest('hex'),hash);
  }
});
test('face projection has finite normals, valid texture coordinates and actual depth',()=>{
  for(const key of ['micrometres','u','v','valid'])assert.equal(face[key].length,face.nx*face.ny);
  for(let x=-.075;x<=.075;x+=.0015)for(let y=-.05;y<=.035;y+=.0015){
    assert.ok(Number.isFinite(faceSurface(x,y)));
    assert.ok(Math.abs(Math.hypot(...faceNormal(x,y))-1)<1e-10);
    const uv=faceUV(x,y);assert.ok(uv.every(v=>Number.isFinite(v)&&v>=-1e-12&&v<=1+1e-12));
  }
  // The front of the nose must project beyond the canthi and cheeks, rather
  // than becoming a flat texture if atlas generation or units are wrong.
  const nose=Math.max(...Array.from({length:40},(_,i)=>faceSurface(0,-i*.001)));
  assert.ok(nose-faceSurface(.02,0)>.02);
  assert.ok(nose-faceSurface(.045,-.02)>.02);
});
