// Reproduce software equivalence; no network, browser or human-data inference.
import fs from 'node:fs';
import {MotionSession} from '../src/core/index.mjs';
import {DEMO_CASES} from '../demo-presets.mjs';
import {Simulation} from '../src/simulation.mjs';
const bundle=JSON.parse(fs.readFileSync(new URL('../models-selected.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/upstream-golden.json',import.meta.url)));
const runs=fixture.runs.map(run=>{
  const core=new MotionSession({model:run.model==='ideal'?null:bundle.models[run.model],patient:DEMO_CASES.find(c=>c.key===run.pattern)?.patient??null});
  const face=new Simulation(bundle);face.select({model:run.model,pattern:run.pattern});let maximum=0;
  for(const row of run.samples){
    const a=core.step(row.target).angles,b=face.step(row.target).angles;
    maximum=Math.max(maximum,...a.map((v,i)=>Math.abs(v-row.angles[i])),...a.map((v,i)=>Math.abs(v-b[i])));
  }
  return {model:run.model,pattern:run.pattern,samples:run.samples.length,maxAbsoluteDifferenceDegrees:maximum};
});
const result={protocol:'unification-regression-v1',samples:runs.reduce((n,r)=>n+r.samples,0),allExact:runs.every(r=>r.maxAbsoluteDifferenceDegrees===0),runs,scope:'Software equivalence only. No physical-camera or clinical validation.'};
console.log(JSON.stringify(result,null,2));if(!result.allExact)process.exitCode=1;
