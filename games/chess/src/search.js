// ===================== Chess search: evaluation, alpha-beta, strengths, hints, analysis =====================
// Our own engine (no GPL code): iterative deepening, principal-variation alpha-beta, quiescence on captures and
// promotions, a Zobrist transposition table, hash / MVV-LVA / killer / history ordering, null move, late-move
// reductions. Nodes 2 plies or more from the leaves are generators, so the page runs the search in ~8 ms slices
// (yield between children) and the screen never freezes. Leaves (depth ≤ 1 + quiescence) are plain functions.

const INF=32000, MATE=30000, MATE_IN=MATE-512, GEN_MIN=1; // nodes this far from the leaves (or more) are generators
const now=()=>performance.now();
// ---------- transposition table and move-ordering tables: one context per job ----------
// The page's own searches share the main context (2^18 entries); the post-game analysis has its own and starts each
// position fresh, so the same game always gets the same analysis.
const T_EXACT=1, T_LOWER=2, T_UPPER=3;
function mkCtx(bits){ const n=1<<bits; return {mask:n-1,K:new Int32Array(n),M:new Int32Array(n),S:new Int16Array(n),D:new Int8Array(n),F:new Int8Array(n),kill:new Int32Array(256),hist:new Int32Array(16*128)}; }
const CX_MAIN=mkCtx(18); let CX=CX_MAIN;
function ttClear(c){ c=c||CX; c.K.fill(0); c.M.fill(0); c.D.fill(0); c.F.fill(0); c.kill.fill(0); c.hist.fill(0); }
const toTT=(s,ply)=>s>=MATE_IN?s+ply:s<=-MATE_IN?s-ply:s, fromTT=(s,ply)=>s>=MATE_IN?s-ply:s<=-MATE_IN?s+ply:s;
function ttStore(p,d,f,s,m,ply){ const c=CX, i=p.hl&c.mask; if(c.K[i]===p.hh&&c.D[i]>d&&f!==T_EXACT) return; c.K[i]=p.hh; c.M[i]=m; c.S[i]=toTT(s,ply); c.D[i]=d; c.F[i]=f; }

// search state, shared by one search at a time
const SR={nodes:0,stop:false,slice:0,hard:0,qlim:99,seldepth:0};

// ---------- evaluation (side to move's view, centipawns) ----------
const PC=new Int8Array(16), PMIN=new Int8Array(16), PMAX=new Int8Array(16); // per colour*8+file: pawn count, lowest and highest rank
const ZW=new Int32Array(128), ZB=new Int32Array(128); let ZSTAMP=0; // squares next to the white / black king (stamped, never reused)
const MOB_N=[-24,-14,-6,0,4,8,11,13,15];
const PASSED=[0,4,8,14,26,44,70,0];
const cmd=s=>{ const f=s&7, r=s>>4; return Math.max(3-f,f-4)+Math.max(3-r,r-4); }; // centre distance 0–6
const kdist=(a,b)=>Math.max(Math.abs((a&7)-(b&7)),Math.abs((a>>4)-(b>>4)));
function stampZone(Z,k){ for(let i=0;i<8;i++){ const x=k+KD[i]; if(!(x&0x88)) Z[x]=ZSTAMP; } Z[k]=ZSTAMP; }
function evaluate(p){ const b=p.b, ph=p.ph>24?24:p.ph; let mg=p.mg, eg=p.eg;
  if(!(p.cnt[PAWN]|p.cnt[PAWN|8]|p.cnt[ROOK]|p.cnt[ROOK|8]|p.cnt[QUEEN]|p.cnt[QUEEN|8])&&insufficient(p)) return 0;
  for(let i=0;i<16;i++){ PC[i]=0; PMIN[i]=8; PMAX[i]=-1; }
  const wk=p.k[0], bk=p.k[1];
  ZSTAMP++; stampZone(ZW,wk); stampZone(ZB,bk);
  // pass 1: pawns per file
  for(let s=0;s<120;s++){ if(s&0x88){ s+=7; continue; } const pc=b[s]; if((pc&7)!==PAWN) continue; const i=(pc>>3)*8+(s&7), r=s>>4; PC[i]++; if(r<PMIN[i]) PMIN[i]=r; if(r>PMAX[i]) PMAX[i]=r; }
  if(p.cnt[BISHOP]>=2){ mg+=28; eg+=48; } if(p.cnt[BISHOP|8]>=2){ mg-=28; eg-=48; }
  let att0=0, att1=0; // weighted attacks by white on black's king zone, by black on white's
  for(let s=0;s<120;s++){ if(s&0x88){ s+=7; continue; } const pc=b[s]; if(!pc) continue; const t=pc&7, c=pc>>3, sg=c?-1:1;
    if(t===PAWN){ const f=s&7, r=s>>4, own=c*8, opp=(c^1)*8;
      if(PC[own+f]>1){ mg-=sg*6; eg-=sg*10; }
      if((f===0||!PC[own+f-1])&&(f===7||!PC[own+f+1])){ mg-=sg*10; eg-=sg*12; }
      let passed;
      if(c===0) passed=(PMAX[opp+f]<=r)&&(f===0||PMAX[opp+f-1]<=r)&&(f===7||PMAX[opp+f+1]<=r);
      else passed=(PMIN[opp+f]>=r)&&(f===0||PMIN[opp+f-1]>=r)&&(f===7||PMIN[opp+f+1]>=r);
      if(passed){ const rr=c?7-r:r, bonus=PASSED[rr], ahead=s+(c?-16:16); mg+=sg*bonus*0.6; eg+=sg*bonus*1.3;
        if(!(ahead&0x88)){ if(b[ahead]) eg-=sg*bonus*0.3; eg+=sg*(kdist(c?wk:bk,ahead)-kdist(c?bk:wk,ahead))*rr; } }
      continue; }
    if(t===KING) continue;
    const Z=c?ZW:ZB; let mob=0, za=0;
    if(t===KNIGHT){ for(let i=0;i<8;i++){ const x=s+ND[i]; if(x&0x88) continue; const q=b[x]; if(!q||(q>>3)!==c) mob++; if(Z[x]===ZSTAMP) za++; } mg+=sg*MOB_N[mob]; eg+=sg*MOB_N[mob]; }
    else { const D=t===BISHOP?BD:t===ROOK?RD:KD, n=t===QUEEN?8:4;
      for(let i=0;i<n;i++){ const d=D[i]; let x=s+d; while(!(x&0x88)){ if(Z[x]===ZSTAMP) za++; const q=b[x]; if(!q){ mob++; x+=d; continue; } if((q>>3)!==c) mob++; break; } }
      if(t===BISHOP){ mg+=sg*(mob-6)*4; eg+=sg*(mob-6)*4; }
      else if(t===ROOK){ mg+=sg*(mob-6)*2; eg+=sg*(mob-6)*3; const f=s&7;
        if(!PC[c*8+f]){ if(!PC[(c^1)*8+f]){ mg+=sg*22; eg+=sg*10; } else { mg+=sg*10; eg+=sg*5; } } }
      else { mg+=sg*(mob-12); eg+=sg*(mob-12)*1.5; } }
    if(za){ const w=za*(t===QUEEN?4:t===ROOK?3:2); if(c) att1+=w; else att0+=w; } }
  // king safety (middlegame): pawn shield, open files next to the king, attackers on the zone
  if(ph>4) for(let c=0;c<2;c++){ const k=c?bk:wk, sg=c?-1:1, f=k&7, up=c?-16:16, own=PAWN|c<<3; let sh=0, open=0;
    for(let df=-1;df<=1;df++){ const ff=f+df; if(ff<0||ff>7) continue; const s1=k+up+df, s2=s1+up;
      if(!(s1&0x88)&&b[s1]===own) sh+=2; else if(!(s2&0x88)&&b[s2]===own) sh+=1;
      if(!PC[c*8+ff]) open+=PC[(c^1)*8+ff]?1:2; }
    const home=c?(k>>4)>=6:(k>>4)<=1, a=c?att0:att1;
    mg+=sg*((home?sh*9:0)-open*12-Math.round(a*a*0.9)); }
  let sc=Math.round((mg*ph+eg*(24-ph))/24);
  // endgames: drive a lone king to the edge (K+B+N: to a corner of the bishop's colour); pawnless edges too small to win
  if(ph<=12) for(let c=0;c<2;c++){ const o=c^1, oP=p.cnt[PAWN|o<<3], oN=p.cnt[KNIGHT|o<<3]+p.cnt[BISHOP|o<<3]+p.cnt[ROOK|o<<3]+p.cnt[QUEEN|o<<3], sg=c?-1:1;
    const myP=p.cnt[PAWN|c<<3], myM=material(p,c);
    if(!oP&&((!oN&&myM>=5)||(!myP&&myM-material(p,o)>=4))){ const lk=c?wk:bk, k=c?bk:wk; let m=cmd(lk)*12+(14-(Math.abs((lk&7)-(k&7))+Math.abs((lk>>4)-(k>>4))))*5;
      if(!myP&&p.cnt[KNIGHT|c<<3]===1&&p.cnt[BISHOP|c<<3]===1&&myM===6){ let bs=0; for(let s=0;s<120;s++){ if(s&0x88){ s+=7; continue; } if(b[s]===(BISHOP|c<<3)) bs=s; }
        const light=((bs>>4)+(bs&7))&1; m+=(7-(light?Math.min(kdist(lk,7),kdist(lk,112)):Math.min(kdist(lk,0),kdist(lk,119))))*30; }
      sc+=sg*(m+200); }
    else if(!myP&&(c?sc<0:sc>0)&&myM-material(p,o)<4) sc=Math.round(sc/4); }
  sc+=p.side?-12:12; // tempo
  return p.side?-sc:sc; }
const nonPawn=(p,c)=>p.cnt[KNIGHT|c<<3]+p.cnt[BISHOP|c<<3]+p.cnt[ROOK|c<<3]+p.cnt[QUEEN|c<<3]>0;

// ---------- draws inside the search: any repetition since the last irreversible move, or fifty moves ----------
function drawish(p){ if(p.half>=100) return true; const h=p.hist, L=h.length, lim=Math.max(0,L-2*p.half);
  for(let i=L-4;i>=lim;i-=4) if(h[i]===p.hl&&h[i+1]===p.hh) return true;
  return p.cnt[PAWN]+p.cnt[PAWN|8]+p.cnt[ROOK]+p.cnt[ROOK|8]+p.cnt[QUEEN]+p.cnt[QUEEN|8]===0&&insufficient(p); }

// ---------- move ordering ----------
const OV=[0,1,3,3,5,9,20];
function scoreMoves(p,ms,ttm,ply){ const sc=new Int32Array(ms.length), b=p.b, k1=CX.kill[ply*2], k2=CX.kill[ply*2+1];
  for(let i=0;i<ms.length;i++){ const m=ms[i]; if(m===ttm){ sc[i]=1e7; continue; } const pr=mPromo(m);
    if(mFlags(m)&F_CAP){ const v=mFlags(m)&F_EP?PAWN:b[mTo(m)]&7; sc[i]=1e6+OV[v]*100-OV[b[mFrom(m)]&7]+(pr===QUEEN?900:0); }
    else if(pr===QUEEN) sc[i]=9e5; else if(m===k1) sc[i]=8e5; else if(m===k2) sc[i]=7e5; else sc[i]=CX.hist[b[mFrom(m)]*128+mTo(m)]; }
  return sc; }
function pick(ms,sc,i){ let bi=i; for(let j=i+1;j<ms.length;j++) if(sc[j]>sc[bi]) bi=j; if(bi!==i){ const t=ms[i]; ms[i]=ms[bi]; ms[bi]=t; const u=sc[i]; sc[i]=sc[bi]; sc[bi]=u; } return ms[i]; }

// ---------- quiescence: captures and promotions ----------
function qs(p,a,b,ply,qd){ SR.nodes++; if(ply>SR.seldepth) SR.seldepth=ply;
  const stand=evaluate(p); if(stand>=b) return stand; if(qd>=SR.qlim) return stand;
  if(stand>a) a=stand;
  const ms=genMoves(p,[],true), sc=scoreMoves(p,ms,0,Math.min(ply,127)), c=p.side;
  for(let i=0;i<ms.length;i++){ const m=pick(ms,sc,i);
    // delta pruning: even winning this piece can't lift alpha
    if(!mPromo(m)){ const v=mFlags(m)&F_EP?PAWN:p.b[mTo(m)]&7; if(stand+VAL_EG[v]+180<a) continue; }
    makeMove(p,m); if(attacked(p,p.k[c],c^1)){ unmakeMove(p); continue; }
    const s=-qs(p,-b,-a,ply+1,qd+1); unmakeMove(p);
    if(s>a){ a=s; if(s>=b) return s; } }
  return a; }

// ---------- depth 1 and 0 (plain function) ----------
function ab(p,d,a,b,ply){ if(d<=0||ply>=100) return qs(p,a,b,ply,0); SR.nodes++;
  if(drawish(p)) return 0;
  const c=p.side, chk=attacked(p,p.k[c],c^1);
  const i0=p.hl&CX.mask; let ttm=0;
  if(CX.K[i0]===p.hh){ ttm=CX.M[i0]; if(CX.D[i0]>=d){ const s=fromTT(CX.S[i0],ply), f=CX.F[i0]; if(f===T_EXACT||(f===T_LOWER&&s>=b)||(f===T_UPPER&&s<=a)) return s; } }
  const ms=genMoves(p,[]), sc=scoreMoves(p,ms,ttm,Math.min(ply,127)), a0=a;
  const fut=!chk&&a>-MATE_IN&&evaluate(p)+220<=a;
  let best=-INF, bm=0, n=0;
  for(let i=0;i<ms.length;i++){ const m=pick(ms,sc,i); makeMove(p,m); if(attacked(p,p.k[c],c^1)){ unmakeMove(p); continue; } n++;
    const quiet=!(mFlags(m)&F_CAP)&&!mPromo(m);
    if(fut&&quiet&&n>1&&!attacked(p,p.k[c^1],c)){ unmakeMove(p); continue; }
    const s=attacked(p,p.k[c^1],c)?-ab(p,1,-b,-a,ply+1):-qs(p,-b,-a,ply+1,0); unmakeMove(p);
    if(s>best){ best=s; bm=m; if(s>a){ a=s; if(s>=b){ if(quiet) killer(m,ply,1,p); break; } } } }
  if(!n) return chk?-MATE+ply:0;
  if(best===-INF) best=a0; // all quiet moves pruned
  ttStore(p,d,best>=b?T_LOWER:best>a0?T_EXACT:T_UPPER,best,bm,ply); return best; }
function killer(m,ply,d,p){ const k=Math.min(ply,127)*2; if(CX.kill[k]!==m){ CX.kill[k+1]=CX.kill[k]; CX.kill[k]=m; } const h=p.b[mFrom(m)]*128+mTo(m); CX.hist[h]=Math.min(5e5,CX.hist[h]+d*d); }

// ---------- depth ≥ 2 (generator: yields when the 8 ms slice is used up) ----------
function* gab(p,d,a,b,ply,pv){ SR.nodes++; if(ply>=100) return qs(p,a,b,ply,0);
  if(ply&&drawish(p)) return 0;
  const c=p.side, chk=attacked(p,p.k[c],c^1); if(chk) d++;
  const i0=p.hl&CX.mask; let ttm=0;
  if(CX.K[i0]===p.hh){ ttm=CX.M[i0]; if(!pv&&CX.D[i0]>=d){ const s=fromTT(CX.S[i0],ply), f=CX.F[i0]; if(f===T_EXACT||(f===T_LOWER&&s>=b)||(f===T_UPPER&&s<=a)) return s; } }
  if(!pv&&!chk&&d>=3&&nonPawn(p,c)&&b<MATE_IN&&evaluate(p)>=b){ makeNull(p); const nd=d-1-(d>6?3:2);
    const s=nd>=GEN_MIN?-(yield* gab(p,nd,-b,-b+1,ply+1,false)):-ab(p,nd,-b,-b+1,ply+1); unmakeNull(p);
    if(SR.stop) return 0; if(s>=b) return s>=MATE_IN?b:s; }
  const ms=genMoves(p,[]), sc=scoreMoves(p,ms,ttm,Math.min(ply,127)), a0=a;
  const fut=d===1&&!chk&&!pv&&a>-MATE_IN&&evaluate(p)+220<=a; // futility: at the last ply, quiet moves can't lift alpha
  let best=-INF, bm=0, n=0;
  for(let i=0;i<ms.length;i++){ const m=pick(ms,sc,i); makeMove(p,m); if(attacked(p,p.k[c],c^1)){ unmakeMove(p); continue; } n++;
    const quiet=!(mFlags(m)&F_CAP)&&!mPromo(m), gives=attacked(p,p.k[c^1],c), nd=d-1;
    if(fut&&quiet&&n>1&&!gives){ unmakeMove(p); continue; }
    const r=d>=3&&n>3&&quiet&&!chk&&!gives?(n>10&&d>4?2:1):0;
    let s;
    if(n===1) s=nd>=GEN_MIN?-(yield* gab(p,nd,-b,-a,ply+1,pv)):-ab(p,nd,-b,-a,ply+1);
    else { const rd=nd-r; s=rd>=GEN_MIN?-(yield* gab(p,rd,-a-1,-a,ply+1,false)):-ab(p,rd,-a-1,-a,ply+1);
      if(!SR.stop&&s>a&&(r||(pv&&s<b))) s=nd>=GEN_MIN?-(yield* gab(p,nd,-b,-a,ply+1,pv)):-ab(p,nd,-b,-a,ply+1); }
    unmakeMove(p); if(SR.stop) return 0;
    if(s>best){ best=s; bm=m; if(s>a){ a=s; if(s>=b){ if(quiet) killer(m,ply,d,p); break; } } }
    if(now()>=SR.slice){ yield 0; if(now()>=SR.hard) SR.stop=true; } }
  if(!n) return chk?-MATE+ply:0;
  ttStore(p,d,best>=b?T_LOWER:best>a0?T_EXACT:T_UPPER,best,bm,ply); return best; }

// ---------- root ----------
// one iteration: every root move, best first. With `all`, each move gets a usable score (window best−300 … ∞)
function* groot(p,d,root,all){ const c=p.side; let a=-INF, best=-INF, bm=root[0].m;
  for(let i=0;i<root.length;i++){ const R=root[i]; makeMove(p,R.m); let s;
    const lo=all?Math.max(-INF,(best>-INF?best:-INF)-300):a;
    if(i===0||all) s=d-1>=GEN_MIN?-(yield* gab(p,d-1,-INF,-lo,1,true)):-ab(p,d-1,-INF,-lo,1);
    else { s=d-1>=GEN_MIN?-(yield* gab(p,d-1,-a-1,-a,1,false)):-ab(p,d-1,-a-1,-a,1);
      if(!SR.stop&&s>a) s=d-1>=GEN_MIN?-(yield* gab(p,d-1,-INF,-a,1,true)):-ab(p,d-1,-INF,-a,1); }
    unmakeMove(p); if(SR.stop&&i>0) return {best,bm,partial:true}; if(SR.stop) return null;
    R.s=s; R.d=d; if(s>best){ best=s; bm=R.m; } if(s>a) a=s;
    if(now()>=SR.slice){ yield 0; if(now()>=SR.hard) SR.stop=true; } }
  return {best,bm}; }
// Iterative deepening. o: {depth, time (ms, soft), hard (ms), all, qlim}. Returns {move, score, depth, nodes, root, pv}.
function* thinkGen(p,o){ o=o||{}; const t0=now(), maxD=o.depth||64, soft=o.time||0, hard=o.hard||(soft?soft*2:o.depth?20000:4000);
  SR.stop=false; SR.nodes=0; SR.seldepth=0; SR.qlim=o.qlim!=null?o.qlim:99; SR.hard=t0+hard; CX.kill.fill(0); if(o.fresh) ttClear(); else for(let i=0;i<CX.hist.length;i++) CX.hist[i]>>=2;
  const lm=legalMoves(p); if(!lm.length) return {move:0,score:inCheck(p)?-MATE:0,depth:0,nodes:0,root:[]};
  const i0=p.hl&CX.mask, ttm=CX.K[i0]===p.hh?CX.M[i0]:0;
  const root=lm.map(m=>({m,s:-INF,d:0})); const so=scoreMoves(p,lm,ttm,0); root.forEach((r,i)=>r.o=so[i]); root.sort((x,y)=>y.o-x.o);
  let res={move:root[0].m,score:0,depth:0};
  if(lm.length===1&&!o.all) return {move:lm[0],score:0,depth:0,nodes:0,root,forced:true};
  for(let d=1;d<=maxD;d++){ const r=yield* groot(p,d,root,!!o.all);
    if(!r){ break; }
    if(r.partial){ res={move:r.bm,score:r.best,depth:d-1}; break; }
    res={move:r.bm,score:r.best,depth:d}; root.sort((x,y)=>(y.d-x.d)||(y.s-x.s));
    if(SR.stop) break;
    if(Math.abs(r.best)>=MATE_IN&&MATE-Math.abs(r.best)<=d-1&&!o.all) break; // stop once a shorter mate is ruled out by depth
    if(soft&&now()-t0>soft*0.5) break; }
  res.nodes=SR.nodes; res.root=root; res.ms=now()-t0; res.pv=pvLine(p,res.move,8);
  ttStore(p,res.depth,T_EXACT,res.score,res.move,0);
  return res; }
// run a generator search to the end (Node tests, calibration); slices still happen, they just don't wait
function runGen(gen){ let r; SR.slice=Infinity; do{ r=gen.next(); }while(!r.done); return r.value; }
function think(p,o){ return runGen(thinkGen(p,o)); }
function pvLine(p,first,n){ const out=[], made=[]; let m=first;
  while(m&&out.length<n){ const lm=legalMoves(p); if(!lm.includes(m)) break; out.push(m); makeMove(p,m); made.push(m); const i=p.hl&CX.mask; m=CX.K[i]===p.hh?CX.M[i]:0; }
  for(let i=0;i<made.length;i++) unmakeMove(p); return out; }

// ---------- the 8 strengths ----------
// Weaker levels use depth caps, evaluation noise and a set chance to pick a weaker move. Ratings are labels from the
// self-play round-robin (tools/calibrate.js), anchored at level 1 ≈ 400.
const STRENGTHS=[null,
 {name:'Pebble',elo:400,depth:1,qlim:0,noise:200,blunder:.25,book:0},
 {name:'Twig',elo:650,depth:2,qlim:1,noise:200,blunder:.20,book:0},
 {name:'Lantern',elo:900,depth:3,qlim:3,noise:230,blunder:.16,book:4},
 {name:'Brook',elo:1150,depth:4,qlim:99,noise:175,blunder:.10,book:6},
 {name:'Falcon',elo:1400,depth:5,egDepth:6,qlim:99,noise:155,blunder:.08,book:10},
 {name:'Tower',elo:1650,depth:6,qlim:99,noise:120,blunder:.06,book:99},
 {name:'Sage',elo:1900,time:1000,qlim:99,noise:90,blunder:.04,book:99},
 {name:'Titan',elo:2150,time:2000,qlim:99,noise:0,blunder:0,book:99}];
const gauss=r=>{ let u=0; for(let i=0;i<4;i++) u+=r(); return (u-2)*1.7; };
// the computer's move: book first (varied), then the search; weak levels pick among root scores with noise and blunders
function* computerMoveGen(p,level,rnd,o){ const L=STRENGTHS[level]; o=o||{};
  const ply=p.undo.length+(o.ply0||0);
  if(L.book&&!p.c960&&ply<L.book*2){ const bm=bookPick(p,rnd); if(bm) return {move:bm,book:true,score:0}; }
  const weak=L.noise>0||L.blunder>0, eg=p.ph<=6;
  const tm=o.time!=null?o.time:L.time||0;
  const res=yield* thinkGen(p,{depth:L.time?64:(eg&&L.egDepth?L.egDepth:L.depth),time:tm,hard:L.time?tm*2:(o.hard||4000),all:weak,qlim:L.qlim});
  if(!weak||res.forced) return res;
  const root=res.root.filter(r=>r.d===res.depth||res.depth===0);
  if(rnd()<L.blunder){ const r=root[Math.floor(rnd()*root.length)]; return {move:r.m,score:r.s,blunder:true}; }
  let bi=root[0], bs=-Infinity; for(const r of root){ const v=(Math.abs(r.s)>=MATE_IN?r.s:r.s+gauss(rnd)*L.noise); if(v>bs){ bs=v; bi=r; } }
  return {move:bi.m,score:bi.s}; }
function computerMove(p,level,rnd,o){ return runGen(computerMoveGen(p,level,rnd,o)); }
// Offer a draw: accepted when the evaluation is roughly level and at least 20 moves have been played.
function acceptsDraw(p,plies,score){ return plies>=40&&Math.abs(score)<=60; }

// ---------- hints ----------
// The engine's best move, from a short search (about 0.6 s, at least 6 plies where that's quick).
function* hintGen(p){ return yield* thinkGen(p,{depth:12,time:600,hard:1500}); }

// ---------- post-game analysis ----------
// Each position is searched to a fixed depth. Win chance from the mover's view: W(cp) = 100/(1+e^(−cp/250)), mates
// count as ±100. A move's loss L = W(best) − W(after). Move accuracy = 100·e^(−L/15); a player's accuracy is the mean
// over their moves (forced moves skipped). Classes: best (the engine's move or L ≤ 1), good ≤ 5, inaccuracy ≤ 12,
// mistake ≤ 24, blunder above.
const AN_DEPTH=7, CX_AN=mkCtx(16);
const winPct=cp=>cp>=MATE_IN?100:cp<=-MATE_IN?0:100/(1+Math.exp(-cp/250));
const moveAcc=L=>100*Math.exp(-Math.max(0,L)/15);
function classify(L,isBest){ return isBest||L<=1?'best':L<=5?'good':L<=12?'inaccuracy':L<=24?'mistake':'blunder'; }
// one position at a time, resumable: state = {g, evals:[{s, m (uci)}], done}
function* analyseGen(g,state,o){ o=o||{}; const depth=o.depth||AN_DEPTH; state.evals=state.evals||[];
  while(state.evals.length<=g.moves.length){ const i=state.evals.length, p=posAt(g,i), st=gameStatus(p);
    let e;
    if(st.over) e={s:st.reason==='checkmate'?-MATE:0,m:'',over:1};
    else { const keep=CX; CX=CX_AN; const r=yield* thinkGen(p,{depth,hard:60000,time:0,fresh:true}); CX=keep; e={s:r.score,m:toUci(p,r.move),f:st.moves.length===1?1:0}; }
    state.evals.push(e); yield {i,n:g.moves.length+1}; }
  return analysisSummary(g,state); }
function analysisSummary(g,state){ const ev=state.evals, out=[], acc=[[],[]]; const p=fromFEN(g.start); if(g.c960>=0) p.c960=true; const first=p.side;
  for(let i=0;i<g.moves.length;i++){ const side=(first+i)&1, before=ev[i].s, after=-ev[i+1].s;
    const L=Math.max(0,winPct(before)-winPct(after)), isBest=ev[i].m===g.moves[i]||(after>=before-5);
    const cls=ev[i].f?'forced':classify(L,isBest); out.push({cls,loss:Math.round(L*10)/10,best:ev[i].m,before,after,side});
    if(!ev[i].f) acc[side].push(moveAcc(isBest?0:L)); }
  const mean=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;
  // evaluation graph from white's view, centipawns clamped to ±1000 (mate = ±1000)
  const graph=ev.map((e,i)=>{ const w=((first+i)&1)?-e.s:e.s; return Math.max(-1000,Math.min(1000,Math.abs(w)>=MATE_IN?Math.sign(w)*1000:w)); });
  return {moves:out,acc:[mean(acc[0]),mean(acc[1])],graph}; }
