// 2048 engine — pure: no DOM, no timers. Our own code (not derived from Cirulli's 2048).
// move(G,dir) returns a new state plus the list of slides, merges and the spawn, so the UI can animate
// from it and the bots can play at full speed. A state is plain JSON, so it saves and restores exactly.

// ---------- seeded RNG: cyrb128 -> sfc32 (as in Sweep's League), with the state kept in the game ----------
function seedState(str){
  let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0;i<str.length;i++){ const k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044813); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044813);
  const rs=[(h1^h2^h3^h4)>>>0,(h2^h1)>>>0,(h3^h1)>>>0,(h4^h1)>>>0];
  for(let i=0;i<15;i++) rnext(rs); return rs;
}
function rnext(rs){ let a=rs[0]>>>0,b=rs[1]>>>0,c=rs[2]>>>0,d=rs[3]>>>0;
  let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0;
  rs[0]=a>>>0; rs[1]=b>>>0; rs[2]=c>>>0; rs[3]=d>>>0; return (t>>>0)/4294967296; }
const seedRng=str=>{ const rs=seedState(str); return ()=>rnext(rs); };

// ---------- boards ----------
// Square boards, plus shaped boards built from masks (1 = playable cell, 0 = wall).
// Cross and Diamond use Sweep's mask formulas; Ring and Swiss Cheese follow the 2048 kickoff exactly.
const BOARDS=['3','4','5','6','cross','ring','diamond','swiss'];
const SHAPED=['cross','ring','diamond','swiss'];
const BOARD_NAMES={'3':'3×3','4':'4×4','5':'5×5','6':'6×6',cross:'Cross',ring:'Ring',diamond:'Diamond',swiss:'Swiss Cheese'};
function sweepMask(name,W,H){ const m=new Array(W*H).fill(1);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const u=(x+.5)/W*2-1, v=(y+.5)/H*2-1;
    if(name==='diamond') m[y*W+x]=Math.abs(u)+Math.abs(v)<=1.04?1:0;
    else if(name==='cross') m[y*W+x]=(Math.abs(u)<=.37||Math.abs(v)<=.37)?1:0; }
  return m; }
function makeMask(board,seed){
  if(/^[3-6]$/.test(board)){ const n=+board; return {W:n,H:n,mask:new Array(n*n).fill(1)}; }
  if(board==='cross') return {W:6,H:6,mask:sweepMask('cross',6,6)};       // corner 2×2 blocks removed: 20 cells
  if(board==='diamond') return {W:7,H:7,mask:sweepMask('diamond',7,7)};   // 25 cells
  if(board==='ring'){ const m=new Array(36).fill(1); for(const i of [14,15,20,21]) m[i]=0; return {W:6,H:6,mask:m}; } // centre 2×2 removed: 32 cells
  if(board==='swiss'){ // 5×5 with 2–3 seeded holes; never leaves a row or column segment of a single cell
    const r=seedRng(`T2048SW|${seed}`);
    for(let a=0;a<500;a++){ const m=new Array(25).fill(1), n=2+(r()*2|0);
      for(let h=0;h<n;h++){ let i; do i=r()*25|0; while(!m[i]); m[i]=0; }
      if(segmentsOk(5,5,m)) return {W:5,H:5,mask:m}; }
    const m=new Array(25).fill(1); m[0]=m[24]=0; return {W:5,H:5,mask:m}; }
  throw new Error('unknown board '+board);
}
function segmentsOk(W,H,mask){ for(const L of linesFor(W,H,mask)) for(const seg of L) if(seg.length<2) return false; return true; }

// LINES[dir] = segments, each an array of cell indices ordered from the side the tiles move toward.
// dir: 0 up, 1 right, 2 down, 3 left. Walls split a row or column into segments that slide on their own.
const LCACHE=new Map();
function linesFor(W,H,mask){ const key=W+'x'+H+':'+mask.join(''); let L=LCACHE.get(key); if(L) return L;
  L=[0,1,2,3].map(dir=>{ const segs=[];
    const outer=dir%2===0?W:H, inner=dir%2===0?H:W;
    for(let o=0;o<outer;o++){ let seg=[];
      for(let k=0;k<inner;k++){ let x,y;
        if(dir===0){ x=o; y=k; } else if(dir===2){ x=o; y=H-1-k; } else if(dir===3){ x=k; y=o; } else { x=W-1-k; y=o; }
        const i=y*W+x; if(mask[i]) seg.push(i); else { if(seg.length) segs.push(seg); seg=[]; } }
      if(seg.length) segs.push(seg); }
    return segs; });
  if(LCACHE.size>64) LCACHE.clear(); LCACHE.set(key,L); return L; }

// ---------- game state ----------
const WIN_TILE=2048;
function newGame(opt={}){
  const board=String(opt.board||'4'), seed=opt.seed||randSeed();
  const {W,H,mask}=makeMask(board,seed);
  const G={v:1,board,W,H,mask,b:new Array(W*H).fill(0),ids:new Array(W*H).fill(0),nid:1,score:0,moves:0,
    seed,rs:seedState((opt.daily?'T2048D1|'+opt.daily:'T2048G1|'+seed)),daily:opt.daily||null,
    max:0,won:false,keep:false,over:false,undos:0,prev:null,cornerAt:-1,cornerRun:0,cornerBest:0,merges:0};
  const s1=spawn(G), s2=spawn(G); G.start=[s1,s2]; G.max=Math.max(s1.v,s2.v);
  return G;
}
function randSeed(){ let s=''; const c='abcdefghijklmnopqrstuvwxyz0123456789';
  const u=(typeof crypto!=='undefined'&&crypto.getRandomValues)?crypto.getRandomValues(new Uint8Array(10)):Array.from({length:10},()=>Math.random()*256|0);
  for(const x of u) s+=c[x%36]; return s; }
const clone=G=>JSON.parse(JSON.stringify(G));
const empties=G=>{ const e=[]; for(let i=0;i<G.b.length;i++) if(G.mask[i]&&!G.b[i]) e.push(i); return e; };
// One new tile on a random empty playable cell: 2 (90%) or 4 (10%). Two RNG draws, always in this order.
function spawn(G){ const e=empties(G); if(!e.length) return null;
  const at=e[Math.floor(rnext(G.rs)*e.length)], v=rnext(G.rs)<.9?2:4, id=G.nid++;
  G.b[at]=v; G.ids[at]=id; return {id,at,v}; }

// Slide one direction. Returns {moved:false} for a move that changes nothing (no spawn, no move count).
function move(G0,dir,opt={}){
  if(G0.over) return {moved:false,G:G0};
  const G=clone(G0), L=linesFor(G.W,G.H,G.mask)[dir], slides=[], merges=[];
  const snap={b:G0.b.slice(),ids:G0.ids.slice(),nid:G0.nid,score:G0.score,moves:G0.moves,rs:G0.rs.slice(),max:G0.max,won:G0.won,keep:G0.keep,
    cornerAt:G0.cornerAt,cornerRun:G0.cornerRun,cornerBest:G0.cornerBest,merges:G0.merges};
  let moved=false, gained=0;
  for(const seg of L){
    const tiles=[]; for(const i of seg) if(G0.b[i]) tiles.push({i,v:G0.b[i],id:G0.ids[i]});
    for(const i of seg){ G.b[i]=0; G.ids[i]=0; }
    let k=0, last=null; // last = the tile placed at seg[k-1], if it can still merge this move
    for(const t of tiles){
      if(last&&last.v===t.v&&!last.merged){ const at=seg[k-1], v=t.v*2, id=G.nid++;
        G.b[at]=v; G.ids[at]=id; gained+=v; slides.push({id:t.id,from:t.i,to:at});
        merges.push({id,a:last.id,b:t.id,at,v}); last.merged=true; last.v=v; moved=true; }
      else { const to=seg[k++]; G.b[to]=t.v; G.ids[to]=t.id; if(to!==t.i){ moved=true; slides.push({id:t.id,from:t.i,to}); }
        last={v:t.v,merged:false,id:t.id}; }
    }
  }
  if(!moved) return {moved:false,G:G0};
  G.score+=gained; G.moves++; G.merges+=merges.length; G.prev=opt.noUndo?null:snap;
  let newWin=false;
  for(const m of merges){ if(m.v>G.max) G.max=m.v; if(m.v>=WIN_TILE&&!G.won){ G.won=true; newWin=true; } }
  const sp=spawn(G); if(sp&&sp.v>G.max) G.max=sp.v;
  trackCorner(G);
  G.over=!canMove(G);
  return {moved:true,G,slides,merges,spawn:sp,gained,newWin,over:G.over,dir};
}
// Undo: one step back. Restores the board, score and spawn RNG, so repeating the move gives the same spawn.
function undo(G0){ if(!G0.prev||G0.daily) return null; const G=clone(G0), p=G0.prev;
  Object.assign(G,{b:p.b.slice(),ids:p.ids.slice(),nid:p.nid,score:p.score,moves:p.moves,rs:p.rs.slice(),max:p.max,won:p.won,keep:p.keep,
    cornerAt:p.cornerAt,cornerRun:p.cornerRun,cornerBest:p.cornerBest,merges:p.merges});
  G.prev=null; G.over=false; G.undos++; return G; }
function canMove(G){ for(let i=0;i<G.b.length;i++) if(G.mask[i]&&!G.b[i]) return true;
  const L=linesFor(G.W,G.H,G.mask); for(const d of [0,3]) for(const seg of L[d]) for(let k=1;k<seg.length;k++) if(G.b[seg[k]]===G.b[seg[k-1]]) return true;
  return false; }
const canDir=(G,dir)=>{ for(const seg of linesFor(G.W,G.H,G.mask)[dir]){ let gap=false;
  for(let k=0;k<seg.length;k++){ const v=G.b[seg[k]]; if(!v){ gap=true; continue; } if(gap) return true; if(k&&G.b[seg[k-1]]===v) return true; } } return false; };
// Corner Keeper: how many moves in a row the highest tile has stayed in the same corner.
function corners(G){ const W=G.W,H=G.H; return [0,W-1,(H-1)*W,H*W-1].filter(i=>G.mask[i]); }
function trackCorner(G){ let at=-1; for(const c of corners(G)) if(G.b[c]===G.max){ at=c; break; }
  if(at>=0&&at===G.cornerAt) G.cornerRun++; else if(at>=0){ G.cornerAt=at; G.cornerRun=1; } else { G.cornerAt=-1; G.cornerRun=0; }
  if(G.cornerRun>G.cornerBest) G.cornerBest=G.cornerRun; }

// ---------- Daily Board: the same board and spawns for everyone, seeded from the date ----------
const DAILY_BOARD='4';
const newDaily=date=>newGame({board:DAILY_BOARD,daily:date,seed:'daily-'+date});
// Fingerprint: the start tiles plus the spawns after a fixed sequence of moves.
function dailyPrint(date,n=60){ let G=newDaily(date), h=2166136261; const add=v=>{ h^=v&255; h=Math.imul(h,16777619); };
  for(const s of G.start){ add(s.at); add(s.v); }
  const seq=[3,2,1,2]; for(let k=0,step=0;k<n&&step<4*n;step++){ const r=move(G,seq[step%4],{noUndo:true}); if(!r.moved) continue; G=r.G; k++; if(r.spawn){ add(r.spawn.at); add(r.spawn.v); } if(G.over) break; }
  return (h>>>0).toString(16).padStart(8,'0'); }
const dateStr=t=>{ const d=new Date(t); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// ---------- bots (tests and threshold tuning) ----------
// Bots work on bare value arrays (no ids, no cloning) so 1,000-game sims run in seconds. sim() uses the same
// segment rules and the same spawn RNG as move(); a test checks the two agree move for move.
function slideFast(b,segs){ const nb=b.slice(); let moved=false, gain=0;
  for(const seg of segs){ let k=0, lastV=0, lastFree=false;
    for(let j=0;j<seg.length;j++){ const v=b[seg[j]]; if(!v) continue;
      if(lastFree&&lastV===v){ nb[seg[k-1]]=v*2; gain+=v*2; lastFree=false; moved=true; }
      else { if(seg[k]!==seg[j]) moved=true; nb[seg[k++]]=v; lastV=v; lastFree=true; } }
    for(let j=k;j<seg.length;j++) nb[seg[j]]=0;
    // a merge also clears its source cell; any cells past k are empty
  }
  return {nb,moved,gain}; }
function evalFast(b,mask,L,crn){ let emp=0, mono=0, smooth=0, mx=0;
  for(let i=0;i<b.length;i++){ if(!mask[i]) continue; if(!b[i]) emp++; else if(b[i]>mx) mx=b[i]; }
  for(const d of [0,3]) for(const seg of L[d]){ let inc=0,dec=0;
    for(let k=1;k<seg.length;k++){ const x=b[seg[k-1]], y=b[seg[k]], a=x?Math.log2(x):0, c=y?Math.log2(y):0;
      if(a>c) dec+=a-c; else inc+=c-a; if(a&&c) smooth-=Math.abs(a-c); }
    mono-=Math.min(inc,dec); }
  let cb=0; for(const c of crn) if(b[c]===mx){ cb=Math.log2(mx); break; }
  return emp*2.7+mono+smooth*.1+cb*1.5; }
// Expectimax, depth 2: our move, a (sampled) spawn, our next move, then the heuristic.
function expectimaxDir(b,mask,L,crn){ let best=-1, bv=-Infinity;
  for(let d=0;d<4;d++){ const r=slideFast(b,L[d]); if(!r.moved) continue;
    const e=[]; for(let i=0;i<b.length;i++) if(mask[i]&&!r.nb[i]) e.push(i);
    let v; if(!e.length) v=evalFast(r.nb,mask,L,crn);
    else { const step=Math.ceil(e.length/6); let tot=0, w=0;
      for(let q=0;q<e.length;q+=step) for(const [tv,p] of [[2,.9],[4,.1]]){ const at=e[q]; r.nb[at]=tv; let m=-1e9;
        for(let d2=0;d2<4;d2++){ const r2=slideFast(r.nb,L[d2]); if(r2.moved) m=Math.max(m,evalFast(r2.nb,mask,L,crn)); }
        if(m===-1e9) m=evalFast(r.nb,mask,L,crn)-100; tot+=m*p; w+=p; r.nb[at]=0; }
      v=tot/w; }
    if(v>bv){ bv=v; best=d; } }
  return best; }
// Corner strategy: prefer left, then down, then right; up only when forced.
const cornerDir=(b,mask,L)=>{ for(const d of [3,2,1,0]) if(slideFast(b,L[d]).moved) return d; return -1; };
function sim(board,seed,kind='expectimax',limit=1e6){ const G=newGame({board,seed}), L=linesFor(G.W,G.H,G.mask), crn=corners(G);
  let b=G.b.slice(), score=0, moves=0, max=G.max;
  for(;moves<limit;){ const d=kind==='corner'?cornerDir(b,G.mask,L):expectimaxDir(b,G.mask,L,crn); if(d<0) break;
    const r=slideFast(b,L[d]); if(!r.moved) break; b=r.nb; score+=r.gain; moves++;
    const e=[]; for(let i=0;i<b.length;i++) if(G.mask[i]&&!b[i]) e.push(i);
    if(e.length){ const at=e[Math.floor(rnext(G.rs)*e.length)]; b[at]=rnext(G.rs)<.9?2:4; }
    for(const v of b) if(v>max) max=v;
    if(!canMove({b,mask:G.mask,W:G.W,H:G.H})) break; }
  return {max,score,moves,b}; }
// Single-step helpers on a full game state (used by tests).
const botCorner=G=>cornerDir(G.b,G.mask,linesFor(G.W,G.H,G.mask));
const botExpectimax=G=>expectimaxDir(G.b,G.mask,linesFor(G.W,G.H,G.mask),corners(G));
function playOut(G,bot,limit=1e6){ for(let n=0;n<limit&&!G.over;n++){ const d=bot(G); if(d<0) break; const r=move(G,d,{noUndo:true}); if(!r.moved) break; G=r.G; } return G; }

if(typeof module!=='undefined') module.exports={seedState,rnext,seedRng,BOARDS,SHAPED,BOARD_NAMES,makeMask,linesFor,segmentsOk,newGame,newDaily,move,undo,canMove,canDir,
  spawn,empties,clone,dailyPrint,dateStr,DAILY_BOARD,WIN_TILE,slideFast,sim,botExpectimax,botCorner,playOut,corners};
