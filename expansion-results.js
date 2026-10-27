const r=await (await fetch('./expansion_comparison.json',{cache:'no-store'})).json();
const names={baseline:'Original-data baseline',expanded:'Expanded binocular',mixed:'Binocular + monocular mix',pretrain:'Monocular pretraining → binocular fine-tuning'};
const schedules={constant:'Constant',decay:'Decay'};
const domains={VR_R1S1:'Original-session binocular test',VR_other_sessions:'Other-session binocular test',External_right_eye:'External right-eye test (only 3 subjects)'};
const keys=['angle_mae_deg','velocity_20ms_mae_deg_s','horizontal_vergence_mae_deg'];
const panel=document.createElement('div');panel.className='panel';panel.id='expansionResults';
const h=document.createElement('h2');h.textContent='Data expansion · 24 runs × 520 epochs';panel.append(h);
const intro=document.createElement('p');intro.className='muted';intro.textContent='Four data regimes × two learning-rate schedules × three random seeds. Values are means ± sample SD; lower is better. Selection was frozen before testing: expanded binocular data, decaying learning rate, seed '+r.selected.seed+'; epoch '+r.selected.best_epoch+'. Select the new version in the controller menu. All previous models are retained.';panel.append(intro);
const finding=document.createElement('p');finding.textContent='Findings: expanding binocular data brings small gains; the original-session angular improvement is inconclusive. Mixing external monocular data helps the external test but does not consistently outperform on binocular tests. Pretraining yields lower velocity errors, but is not best on every metric.';panel.append(finding);
for(const [domain,title] of Object.entries(domains)){
 const h3=document.createElement('h3');h3.textContent=title;panel.append(h3);
 const wrap=document.createElement('div');wrap.style.overflowX='auto';
 const table=document.createElement('table');
 table.innerHTML='<tr><th>Data regime</th><th>Learning rate</th><th>Angular error °</th><th>20 ms velocity error °/s</th><th>Vergence error °</th></tr>';
 for(const recipe of Object.keys(schedules))for(const regime of Object.keys(names)){
  const x=r.overall.find(x=>x.domain===domain&&x.recipe===recipe&&x.regime===regime);
  const row=document.createElement('tr');
  for(const value of [names[regime],schedules[recipe],...keys.map(k=>k in x.mean?x.mean[k].toFixed(4)+' ± '+x.sd[k].toFixed(4):'N/A')]){
   const cell=document.createElement('td');cell.textContent=value;row.append(cell);
  }
  table.append(row);
 }
 wrap.append(table);panel.append(wrap);
}
const note=document.createElement('p');note.className='muted';note.textContent='Preparation, training and batch evaluation took '+(r.training_elapsed_seconds/3600).toFixed(2)+' hours. Valid binocular training samples increased from about 21.04M to 52.16M; time samples are not independent observations. The 284 / 61 / 62 subject split is fixed, with all test-subject sessions excluded from training. External data uses 5 training, 2 validation and 3 test subjects, supervising only the right eye. Test reuse makes this exploratory; real fingertip following and human-like robot behavior remain unvalidated.';panel.append(note);
document.getElementById('comparisonPanels').append(panel);
