import {IRIS_DEPTH} from './eye-anatomy.mjs';
import {HALF_WIDTH,rotateEyePoint} from './eyelid-model.mjs?v=faces8';

// Orthographic pupil-centre projection, using the recessed iris plane.
// It is a geometric relative position, not a measurement from rendered pixels.
export function horizontalEyePosition(yaw,pitch){
  return rotateEyePoint([0,0,IRIS_DEPTH],yaw,pitch)[0]/HALF_WIDTH;
}
export function eyeRailState(frame){
  return [0,1].map(i=>({
    position:horizontalEyePosition(frame.angles[2*i],frame.angles[2*i+1]),
    reference:horizontalEyePosition(frame.baseline[2*i],frame.baseline[2*i+1]),
    visibility:frame.lids[i].pupilVisibility
  }));
}
export class EyePositionRails {
  constructor(host){
    this.host=host;
    host.innerHTML=`<div class="rail-heading"><h2 id="railsTitle">Live eye position</h2><span id="railsStatus"></span></div>
      <div class="eye-rails">${['L','R'].map((name,i)=>`<div class="eye-rail eye-rail-${i}">
        <div class="rail-eye-heading"><span>${name} eye</span><output id="railValue${i}">0.00</output><span id="railVisibility${i}" class="rail-visibility"></span></div>
        <svg id="railSvg${i}" viewBox="0 0 400 82" role="img" aria-label="${name} eye horizontal position">
          <path class="rail-axis" d="M30 42H370 M30 32V52 M200 34V50 M370 32V52"/>
          <circle id="railReference${i}" class="rail-reference" cx="200" cy="42" r="6"/>
          <g id="railMarker${i}" class="rail-marker" transform="translate(200 42)">
            <circle class="rail-dot" r="6"/>
          </g>
          <text x="30" y="77" text-anchor="start">−1</text><text x="200" y="77" text-anchor="middle">0</text><text x="370" y="77" text-anchor="end">+1</text>
        </svg></div>`).join('')}</div>
      <p class="rail-key" title="Relative position from simulation geometry; positive is frontal screen-right. Dashed markers indicate pupil occlusion."><span><i class="rail-key-dot"></i>Current</span><span><i class="rail-key-reference"></i>Normal reference</span><span>0 = Eye centre</span></p>`;
    this.status=host.querySelector('#railsStatus');
    this.eyes=[0,1].map(i=>Object.fromEntries(['Marker','Reference','Value','Visibility','Svg'].map(key=>[key.toLowerCase(),host.querySelector(`#rail${key}${i}`)])));
  }
  update(frame,{playing=true,tracked=true}={}){
    const state=eyeRailState(frame);
    this.status.textContent=!tracked?'Waiting for fingertip':playing?'Live':'Paused';
    state.forEach((eye,i)=>{
      const nodes=this.eyes[i],x=30+(eye.position+1)*170,referenceX=30+(eye.reference+1)*170,occluded=eye.visibility<.999;
      nodes.marker.setAttribute('transform',`translate(${x} 42)`);
      nodes.marker.classList.toggle('is-occluded',occluded);
      nodes.reference.setAttribute('cx',referenceX);
      nodes.value.textContent=(Math.abs(eye.position)<.005?0:eye.position).toFixed(2);
      nodes.visibility.textContent=eye.visibility===0?'Pupil hidden':occluded?'Partly hidden':'';
      nodes.svg.setAttribute('aria-label',`${i?'R':'L'} eye: relative horizontal position ${nodes.value.textContent}${occluded?', pupil occluded':''}`);
    });
    this.state=state;
  }
}
