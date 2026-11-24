// Builds the campaign puzzles by working backwards from full rows: remove pieces that could have dropped
// straight in, then keep what's left as the starting layout. Every candidate is replayed through the real
// engine (spawn, rotate, move, hard drop) and kept only if it ends in a Clean Sweep.
// node tests/gen_puzzles.js  -> prints PUZZLES for src/levels.js
const L=require('./lib.js').load(['engine.js']);
function tryGen(R,W,H,rows,pool,k){
  const B=Array.from({length:rows},()=>new Array(W).fill(1)); const removed=[];
  for(let n=0;n<k;n++){ let done=false;
    for(let a=0;a<400&&!done;a++){ const t=pool[L.rint(R,pool.length)], r=L.rint(R,4), st=L.PIECES[t].st[r], bb=L.PIECES[t].bb[r];
      const x=L.rint(R,W-(bb.x1-bb.x0))-bb.x0, y=L.rint(R,rows-(bb.y1-bb.y0))-bb.y0;
      const cells=st.map(([cx,cy])=>[x+cx,y+cy]); if(cells.some(([X,Y])=>X<0||X>=W||Y<0||Y>=rows||!B[Y][X])) continue;
      const own=new Set(cells.map(([X,Y])=>Y*W+X)); for(const [X,Y] of cells) B[Y][X]=0;
      let ok=true; for(const [X,Y] of cells) for(let yy=Y-1;yy>=0;yy--) if(!own.has(yy*W+X)&&B[yy][X]){ ok=false; break; }
      let sup=false; for(const [X,Y] of cells){ const b=Y+1; if(own.has(b*W+X)) continue; if(b>=rows||B[b][X]) sup=true; }
      if(!ok||!sup){ for(const [X,Y] of cells) B[Y][X]=1; continue; }
      removed.push({t,r,x,y}); done=true; }
    if(!done) return null; }
  if(B.some(row=>row.every(v=>v))) return null;              // no row may start full
  if(B.some(row=>row.filter(v=>v).length<2)) return null;    // every row keeps some structure
  if(new Set(removed.map(p=>p.t)).size<Math.min(4,k-1)) return null; // a variety of pieces
  const prefill=[]; for(let i=rows-1;i>=0;i--) prefill.push(B[i].map(v=>v?'#':'.').join(''));
  const order=removed.reverse(); return {prefill,pieces:order.map(p=>p.t),sol:order.map(p=>[p.r,p.x])};
}
function replay(board,P){ const st=L.newGame({board,seed:'pz',fixed:P.pieces,prefill:P.prefill,hold:false,goal:{type:'puzzle'}}); let i=0, moves=0, guard=0;
  while(st.phase!=='over'&&st.phase!=='done'&&guard++<20000){ let ins=[];
    if(st.phase==='play'&&st.cur){ const [r,x]=P.sol[i++]; const d=(r-st.cur.r+4)%4;
      if(d===1) ins.push(['p','cw']); else if(d===2) ins.push(['p','cw'],['p','cw']); else if(d===3) ins.push(['p','ccw']);
      L.step(st,ins); moves+=ins.length; ins=[]; const dx=x-st.cur.x; for(let j=0;j<Math.abs(dx);j++) ins.push(['p',dx<0?'l1':'r1']); moves+=Math.abs(dx); ins.push(['p','hard']); }
    L.step(st,ins); }
  return {ok:st.result&&st.result.ok,moves}; }
const specs=[['p1','small',['I','O','T','S','Z','J','L'],4,5],['p2','small',['I','O','T','J','L','I3','L3'],4,7],['p3','small',['I','O','T','J','L','S','Z','I5','L5','P','T5','U'],5,7]];
const out={};
for(const [id,board,pool,rows,k] of specs){ const W=L.BOARDS[board].w; const R=L.rngFrom('LFPZ1|'+id); let best=null;
  for(let a=0;a<200000&&!best;a++){ const P=tryGen(R,W,0,rows,pool,k); if(!P) continue;
    if(id==='p3'&&!P.pieces.some(t=>t.length>1&&t!=='I3'&&t!=='L3')) continue;
    if(id==='p2'&&!P.pieces.some(t=>t==='I3'||t==='L3')) continue;
    const rr=replay(board,P); if(rr.ok){ P.par=rr.moves; best=P; } }
  out[id]=best; console.error(id,best?`ok ${best.pieces.join(' ')} par ${best.par}`:'FAILED'); if(best) console.error(best.prefill.slice().reverse().join('\n')); }
console.log('const PUZZLES='+JSON.stringify(out)+';');
