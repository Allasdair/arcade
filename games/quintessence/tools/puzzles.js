// The three puzzle levels (Sweep's puzzle level at 10): a fixed board with refills off.
// "Clear all the Frost": a full search confirms there's a solution and finds the minimum number of moves.
//   node tools/puzzles.js        → finds and prints the puzzles (tools/grade.js calls findPuzzle itself)
const L=require('../tests/lib.js'); const X=L.load(['engine.js','bot.js']);
// minimum moves to clear all frost (up to maxD), and how many first moves start a shortest solution
function solve(st,maxD){ let best=Infinity, firsts=new Set(), nodes=0;
  const rec=(s,d,first)=>{ nodes++; if(nodes>400000) return; if(X.countOb(s,'fr')===0){ if(d<best){ best=d; firsts=new Set(); } if(d===best) firsts.add(first); return; }
    if(d>=maxD||d>=best) return; for(const [a,b] of X.listSwaps(s)){ const c=X.cloneSt(s); X.doSwap(c,a,b,false); rec(c,d+1,first==null?a+','+b:first); } };
  rec(st,0,null); return {min:best,firsts:firsts.size,nodes}; }
function puzzleCfg(ne,W,H,pieces,map){ return {W,H,ne,seed:'puzzle',pieces,map,goals:[{t:'frost'}],limit:0,refill:false}; }
function findPuzzle(ne,tag,want){ want=want||3; const W=7, H=7;
  for(let att=0;att<4000;att++){ const r=X.rngFor('puz|'+tag+'|'+att);
    // frost: 4 to 6 cells in the lower half
    const m=[]; for(let y=0;y<H;y++) m.push('.'.repeat(W).split('')); const nf=4+Math.floor(r()*3);
    for(let k=0;k<nf;k++){ const x=Math.floor(r()*W), y=3+Math.floor(r()*4); m[y][x]=r()<.25?'F':'f'; }
    const map=m.map(row=>row.join(''));
    const g=X.newGame({W,H,ne,seed:'puz|'+tag+'|'+att,map});
    const pieces=[]; for(let y=0;y<H;y++){ let s=''; for(let x=0;x<W;x++){ const e=g.pe[y*W+x]; s+=e>=0&&e<6?String(e):'.'; } pieces.push(s); }
    const st=X.newGame(puzzleCfg(ne,W,H,pieces,map)); if(X.countOb(st,'fr')<4) continue;
    const res=solve(st,want); if(res.min===want&&res.firsts<=3){ return {W,H,ne,pieces,map,min:res.min,firsts:res.firsts,att,nodes:res.nodes}; } }
  return null; }
if(require.main===module){ for(const ne of [4,5,6]){ const t=Date.now(); const p=findPuzzle(ne,'camp'+ne); console.log(ne,Date.now()-t,'ms',JSON.stringify(p)); } }
module.exports={findPuzzle,solve,puzzleCfg};
