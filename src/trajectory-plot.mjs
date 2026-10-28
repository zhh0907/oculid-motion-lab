import {traceWindow} from './trajectory-data.mjs?v=patients4';
const colours=['#247d68','#456bc0'];
export class TrajectoryPlot {
  constructor(canvas,select,clearButton,history){
    this.canvas=canvas;this.select=select;this.lastRevision=-1;this.lastPaint=-Infinity;this.extent=30;
    select.onchange=()=>{this.lastRevision=-1;this.lastPaint=-Infinity;};
    clearButton.onclick=()=>history.clear();
  }
  draw(history,now){
    const canvas=this.canvas,w=canvas.clientWidth,mode=this.select.value,xy=mode==='xy',vertical=mode==='vertical';
    const desiredHeight=xy?Math.min(350,w+25):230;
    if(canvas.style.height!==desiredHeight+'px')canvas.style.height=desiredHeight+'px';
    const h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    if(!w||!h)return;
    const size=`${w},${h},${dpr}`,changed=size!==this.size;
    if(!changed&&this.lastRevision===history.revision)return;
    if(!changed&&now-this.lastPaint<50)return;
    if(history.generation!==this.generation){this.extent=30;this.generation=history.generation;}
    this.size=size;this.lastRevision=history.revision;this.lastPaint=now;
    if(changed){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const {rows,start,end}=traceWindow(history.samples());
    for(const r of rows)for(const values of [r.angles,r.baseline])for(const index of xy?[0,1,2,3]:vertical?[1,3]:[0,2])this.extent=Math.max(this.extent,Math.ceil(Math.abs(values[index])/10)*10);
    const square=Math.min(w-64,h-60),left=xy?(w-square)/2+12:47,right=xy?left+square:w-17,top=25,bottom=xy?top+square:h-35,cx=(left+right)/2,cy=(top+bottom)/2;
    const scale=Math.min(right-left,bottom-top)/(2*this.extent);
    const x=xy?v=>cx+v*scale:t=>left+(t-start)/(end-start)*(right-left);
    const y=xy?v=>cy-v*scale:v=>bottom-(v+this.extent)/(this.extent*2)*(bottom-top);
    ctx.font='11px "Segoe UI",sans-serif';ctx.fillStyle='#6b8075';ctx.lineWidth=1;
    const grid=(x1,y1,x2,y2,zero=false)=>{ctx.strokeStyle=zero?'#a4b8ab':'#dde4dc';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
    const tick=this.extent<=40?10:20;
    for(let v=Math.ceil(-this.extent/tick)*tick;v<=this.extent;v+=tick){grid(left,y(v),right,y(v),v===0);ctx.fillText(`${v}°`,left-42,y(v)+4);}
    if(xy){
      const xtick=this.extent<=40?20:40;
      for(let v=Math.ceil(-this.extent/xtick)*xtick;v<=this.extent;v+=xtick){grid(x(v),top,x(v),bottom,v===0);ctx.textAlign='center';ctx.fillText(`${v}°`,x(v),bottom+19);}
    }else for(let t=Math.ceil(start/5)*5;t<=end;t+=5){grid(x(t),top,x(t),bottom);ctx.textAlign=t===start?'left':t===end?'right':'center';ctx.fillText(`${t.toFixed(0)} s`,x(t),h-16);}
    ctx.textAlign='left';ctx.fillStyle='#536e60';ctx.fillText(xy?'垂直角度 ↑':vertical?'垂直角度':'水平角度',left,14);
    ctx.textAlign='right';ctx.fillText(xy?'水平角度 →':'仿真时间 →',right,h-2);ctx.textAlign='left';
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    // Dashed normal reference first, then patient traces and current-position dots.
    for(const field of ['baseline','angles'])for(let eye=0;eye<2;eye++){
      ctx.strokeStyle=colours[eye];ctx.fillStyle=colours[eye];ctx.lineWidth=field==='baseline'?1.4:2;ctx.globalAlpha=field==='baseline'?.42:.95;ctx.setLineDash(field==='baseline'?[5,4]:[]);
      ctx.beginPath();let previous=null,last=null;
      for(const r of rows){
        const p=r[field],px=x(xy?p[eye*2]:r.time),py=y(p[eye*2+(xy||vertical?1:0)]);
        if(previous&&previous.segment===r.segment&&r.time-previous.time<.1)ctx.lineTo(px,py);else ctx.moveTo(px,py);
        previous=r;last=[px,py];
      }
      ctx.stroke();ctx.setLineDash([]);
      if(last){ctx.beginPath();ctx.arc(...last,field==='baseline'?3:3.6,0,2*Math.PI);if(field==='baseline')ctx.stroke();else ctx.fill();}
    }
    ctx.restore();ctx.globalAlpha=1;ctx.setLineDash([]);
    if(xy&&w>650&&rows.length){
      const latest=rows.at(-1);
      for(let eye=0;eye<2;eye++){
        const sx=eye?right+52:18;
        ctx.fillStyle=colours[eye];ctx.font='12px "Segoe UI",sans-serif';ctx.fillText(`${eye?'R':'L'} 眼 · 当前`,sx,80);
        ctx.font='16px "Segoe UI",sans-serif';ctx.fillText(`${latest.angles[eye*2].toFixed(1)}° / ${latest.angles[eye*2+1].toFixed(1)}°`,sx,108);
        ctx.font='11px "Segoe UI",sans-serif';ctx.fillStyle='#6b8075';ctx.fillText('正常参考 · 水平 / 垂直',sx,143);
        ctx.fillText(`${latest.baseline[eye*2].toFixed(1)}° / ${latest.baseline[eye*2+1].toFixed(1)}°`,sx,165);
      }
    }
    if(!rows.length){ctx.fillStyle='#7c8c81';ctx.textAlign='center';ctx.fillText('运动开始后显示轨迹',cx,cy-12);ctx.textAlign='left';}
    this.lastDraw={mode,count:rows.length,start,end,extent:this.extent,latest:rows.at(-1)||null};
  }
}
