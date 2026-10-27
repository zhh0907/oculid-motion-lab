const $=id=>document.getElementById(id);
function fold(title,nodes,host){
  const d=document.createElement('details'),s=document.createElement('summary');
  d.className='secondary-tools';s.textContent=title;d.append(s);
  const first=nodes.find(Boolean);if(host)host.append(d);else first?.before(d);
  for(const n of nodes)if(n)d.append(n);
  return d;
}
const label=id=>document.querySelector('label[for="'+id+'"]');
export function simplifyUI(){
  const simulator=!!$('eyeFocus');
  if(simulator){
    const settings=$('settings');
    const sourceNodes=[label('source'),$('source'),$('replayStatus'),$('replayStatus').nextElementSibling];
    const modelNodes=[label('mode'),$('mode'),$('mode').nextElementSibling];
    const controls=$('cameraControls'),start=label('cameraDepth'),nodes=[];
    for(let n=start;n;){nodes.push(n);n=n.nextElementSibling;}
    const geometry=fold('Camera geometry & smoothing',nodes);
    const placement=label('camY')?.closest('.group');
    const playback=$('pause').closest('.group');
    const actions=$('pause').parentElement;actions.classList.add('session-actions');settings.append(actions);
    $('pause').textContent='Pause';$('reset').textContent='Restart';
    $('patientFiles').append($('export'));$('export').textContent='Download current run (CSV)';
    const advanced=fold('Advanced settings',[],settings);advanced.id='advancedControls';
    for(const n of [...sourceNodes,...modelNodes,$('recordControls'),$('syntheticControls'),geometry,$('calibrationPanel'),placement,$('speedControls'),...settings.querySelectorAll(':scope > .note')])if(n)advanced.append(n);
    playback.remove();
    settings.querySelector('.settings-heading')?.remove();
    settings.prepend($('patientControls'));settings.append(controls,actions,advanced);
    // Save tools belong after the primary camera workflow.
    settings.append($('patientFiles'));
    controls.querySelector('h2').textContent='Camera';
    $('cameraFacing').previousElementSibling.textContent='Camera';
    controls.querySelector('.help').textContent='Show one index finger to move the eyes.';
    $('cameraPanel').querySelector('.muted').textContent='Front: mirror preview. Rear: natural preview. Yellow marker follows your fingertip.';
    const section=$('comparisonPanels');
    const nodesResults=[...section.children].filter(e=>!['eyeFocus','cameraPanel','view','scrub'].includes(e.id));
    const charts=fold('Movement details',nodesResults);charts.id='movementDetails';
    const scene=$('view'),sceneFold=fold('Optional 3D scene',[scene]);
    sceneFold.id='sceneDetails';
    $('source').addEventListener('change',()=>{sceneFold.open=$('source').value!=='camera';});
  }else{
    const formatNodes=[label('recordFormat'),$('recordFormat'),$('formatHint'),$('previewFlip').closest('label')];
    const previewHint=$('previewFlip').closest('label').nextElementSibling;
    if(previewHint?.classList.contains('hint'))formatNodes.push(previewHint);
    fold('Recording & display settings',formatNodes);
    const importNodes=[label('videoFile'),$('videoFile'),$('inputMirrored').closest('label')];
    const hint=$('inputMirrored').closest('label').nextElementSibling;
    if(hint?.classList.contains('hint'))importNodes.push(hint);
    importNodes.push($('fileControls'));fold('Import a video',importNodes);
    const demoNodes=[];for(let n=label('demoScenario');n;){demoNodes.push(n);n=n.nextElementSibling;}
    fold('Synthetic demo',demoNodes);
    const ms=document.querySelector('.measurements');
    fold('Traces & movement evidence',[...ms.children].filter(n=>n.id!=='live'));
    const phaseHint=$('phase').nextElementSibling;if(phaseHint?.classList.contains('hint'))phaseHint.hidden=true;
    const recordHint=document.querySelector('.record-bar')?.nextElementSibling;if(recordHint?.classList.contains('hint'))recordHint.hidden=true;
    $('formatHint').textContent='Original downloads need no conversion. Available formats depend on this browser.';
    $('recordStop').textContent='Finish clip';
    document.querySelector('header p').textContent='Record → Image check → Examiner review';
  }
}
