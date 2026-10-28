import {HALF_WIDTH,rotateEyePoint} from './eyelid-model.mjs?v=canthus3';

// Orthographic pupil-centre projection, using the existing iris surface radius.
// It is a geometric relative position, not a measurement from rendered pixels.
export function horizontalEyePosition(yaw,pitch){
  return rotateEyePoint([0,0,.01255],yaw,pitch)[0]/HALF_WIDTH;
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
    host.innerHTML=`<div class="rail-heading"><h2 id="railsTitle">实时眼位滑轨</h2><span id="railsStatus"></span></div>
      <div class="eye-rails">${['L','R'].map((name,i)=>`<div class="eye-rail eye-rail-${i}">
        <div class="rail-eye-heading"><span>${name} 眼</span><output id="railValue${i}">0.000</output><span id="railVisibility${i}" class="rail-visibility"></span></div>
        <svg id="railSvg${i}" viewBox="0 0 400 100" role="img" aria-label="${name} 眼的实时水平位置">
          <path class="rail-axis" d="M30 42H370 M30 32V52 M200 34V50 M370 32V52"/>
          <path class="rail-minor" d="M115 38V46 M285 38V46"/>
          <circle id="railReference${i}" class="rail-reference" cx="200" cy="42" r="6"/>
          <g id="railMarker${i}" class="rail-marker" transform="translate(200 42)">
            <circle class="rail-eye-white" r="10"/><circle class="rail-iris" r="6.5"/>
            <circle class="rail-pupil" r="3"/><circle class="rail-glint" cx="-2" cy="-2" r="1.2"/>
          </g>
          <text x="30" y="77" text-anchor="start">−1</text><text x="200" y="77" text-anchor="middle">0</text><text x="370" y="77" text-anchor="end">+1</text>
          <text x="30" y="96" text-anchor="start">← 画面左</text><text x="370" y="96" text-anchor="end">画面右 →</text>
        </svg></div>`).join('')}</div>
      <p class="rail-key"><span><i class="rail-key-eye"></i>当前眼位</span><span><i class="rail-key-reference"></i>正常参考</span><span>0＝眼角中点</span></p>
      <p class="hint">由仿真几何计算的相对位置，与上方眼球同步；虚线眼球表示瞳孔被遮挡。</p>`;
    this.status=host.querySelector('#railsStatus');
    this.eyes=[0,1].map(i=>Object.fromEntries(['Marker','Reference','Value','Visibility','Svg'].map(key=>[key.toLowerCase(),host.querySelector(`#rail${key}${i}`)])));
  }
  update(frame,{playing=true,tracked=true}={}){
    const state=eyeRailState(frame);
    this.status.textContent=`${!tracked?'等待食指 · 位置保持':playing?'实时同步':'已暂停'} · ${frame.time.toFixed(2)} s`;
    state.forEach((eye,i)=>{
      const nodes=this.eyes[i],x=30+(eye.position+1)*170,referenceX=30+(eye.reference+1)*170,occluded=eye.visibility<.999;
      nodes.marker.setAttribute('transform',`translate(${x} 42)`);
      nodes.marker.classList.toggle('is-occluded',occluded);
      nodes.reference.setAttribute('cx',referenceX);
      nodes.value.textContent=(Math.abs(eye.position)<.0005?0:eye.position).toFixed(3);
      nodes.visibility.textContent=eye.visibility===0?'瞳孔被遮挡':occluded?'部分遮挡':'';
      nodes.svg.setAttribute('aria-label',`${i?'R':'L'} 眼：相对水平位置 ${nodes.value.textContent}${occluded?'，瞳孔有遮挡':''}`);
    });
    this.state=state;
  }
}
