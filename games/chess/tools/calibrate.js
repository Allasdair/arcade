// Self-play between strengths. node tools/calibrate.js [games per pairing] [first level] [last level] [seed]
// Plays each level against the one below (colours alternate) and prints win rates and an Elo estimate.
// Ratings in search.js (STRENGTHS[n].elo) are anchored so level 1 ≈ 400 and use these measured differences.
const {load}=require('../tests/lib.js'); const X=load(['engine.js','search.js','book.js']);
if(process.env.STR){ const o=JSON.parse(process.env.STR); for(const k in o) Object.assign(X.STRENGTHS[k],o[k]); }
const N=+(process.argv[2]||20), A=+(process.argv[3]||1), B=+(process.argv[4]||8), SEED=process.argv[5]||'cal';
function play(wl,bl,seed){ const p=X.fromFEN(X.START_FEN), r=X.rngFor(seed); X.ttClear();
  for(let ply=0;ply<240;ply++){ const st=X.gameStatus(p); if(st.over) return st.result==='1-0'?1:st.result==='0-1'?0:.5;
    const lv=p.side?bl:wl; X.ttClear(); const res=X.computerMove(p,lv,r); X.makeMove(p,res.move); }
  const e=X.evaluate(p)*(p.side?-1:1); return Math.abs(e)>600?(e>0?1:0):.5; } // adjudicate long games by evaluation
const rows=[];
for(let lo=A;lo<B;lo++){ const hi=lo+1; let score=0, w=0, d=0, l=0; const t0=Date.now();
  for(let g=0;g<N;g++){ const hw=g%2===0, s=play(hw?hi:lo,hw?lo:hi,SEED+'|'+lo+'|'+g), hs=hw?s:1-s; score+=hs; if(hs===1) w++; else if(hs===.5) d++; else l++; }
  const pct=score/N, elo=pct>=1?400:pct<=0?-400:Math.round(-400*Math.log10(1/pct-1));
  rows.push({pair:`${hi} v ${lo}`,w,d,l,pct:Math.round(pct*100),elo,sec:Math.round((Date.now()-t0)/1000)}); console.log(JSON.stringify(rows[rows.length-1])); }
