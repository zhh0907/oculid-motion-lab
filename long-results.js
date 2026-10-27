const r=await (await fetch('./long_comparison.json',{cache:'no-store'})).json();
const names={mlp:'MLP',lstm:'LSTM',gru:'GRU',gru_dynamics:'GRU + dynamics loss'};
const panel=document.createElement('div');panel.className='panel';
const keys=['angle_mae_deg','velocity_20ms_mae_deg_s','horizontal_vergence_mae_deg'];
panel.innerHTML='<h2>Longer training · 12 / 36 / 120 epochs</h2><p class="muted">Architecture, data, loss and optimizer are held fixed. Checkpoints within each budget are selected only by validation MSE. Values are means ± SD across seeds; lower is better.</p><div style="overflow-x:auto"><table><tr><th>Model</th><th>Epoch budget</th><th>Mean angular error °</th><th>20 ms velocity error °/s</th><th>Vergence error °</th></tr>'+r.overall.map(x=>'<tr><td>'+names[x.method]+'</td><td>'+x.budget+'</td>'+keys.map(k=>'<td>'+x.mean[k].toFixed(3)+' ± '+x.std[k].toFixed(3)+'</td>').join('')+'</tr>').join('')+'</table></div><p class="muted">Experiment time: '+(r.elapsed_seconds/60).toFixed(1)+' minutes. Longer-trained models are additional options; original versions remain available. Camera detection and the monocular depth assumption are unchanged. Test reuse makes these results exploratory.</p>';
document.getElementById('comparisonPanels').append(panel);

const selected=document.createElement('p');selected.className='muted';selected.textContent='Checkpoints selected on validation data: '+Object.entries(r.selected).map(([k,v])=>names[k.replace('_long','')]+'; seed '+v.seed+'; epoch '+v.epoch).join('; ')+'. No seed ensemble is used.';panel.append(selected);
