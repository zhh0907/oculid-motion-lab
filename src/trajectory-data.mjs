export const TRACE_SECONDS=20;
export const TRACE_HZ=50;

// Independent of the 120-second export buffer: the live graph never stops.
export class TrajectoryHistory {
  constructor(){this.capacity=TRACE_SECONDS*TRACE_HZ+8;this.clear();}
  clear(){this.buffer=new Array(this.capacity);this.start=0;this.length=0;this.lastTime=-Infinity;this.segment=0;this.breakNext=true;this.revision=(this.revision||0)+1;this.generation=(this.generation||0)+1;}
  markGap(){this.breakNext=true;}
  push(frame){
    if(frame.time<this.lastTime)this.clear();
    if(!this.breakNext&&frame.time-this.lastTime<1/TRACE_HZ-1e-8)return;
    if(this.breakNext){this.segment++;this.breakNext=false;}
    const row={time:frame.time,angles:[...frame.angles],baseline:[...frame.baseline],segment:this.segment};
    if(this.length===this.capacity){this.buffer[this.start]=row;this.start=(this.start+1)%this.capacity;}
    else{this.buffer[(this.start+this.length)%this.capacity]=row;this.length++;}
    this.lastTime=frame.time;this.revision++;
  }
  samples(){return Array.from({length:this.length},(_,i)=>this.buffer[(this.start+i)%this.capacity]);}
}

export function traceWindow(rows){
  const end=Math.max(TRACE_SECONDS,rows.at(-1)?.time||0),start=end-TRACE_SECONDS;
  return {start,end,rows:rows.filter(r=>r.time>=start)};
}
