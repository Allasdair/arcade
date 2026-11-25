// ===================== Solitaire solver and blind bot =====================
// 1) A perfect-knowledge solver (sees every card): proves a deal is winnable and finds a short solution.
//    Depth-first search with a transposition table, run in slices so the screen never freezes.
//    Stock cycling is collapsed: one solver move is "turn the stock as needed, then play waste card p", so no state
//    ever repeats by just drawing. The search stops as soon as auto-complete would finish the game.
//    mode 'fast'  : the pruned search (bank, par, hints). Sound pruning plus a few safe heuristics.
//    mode 'exact' : no pruning that could hide a win (used to confirm "can't be won from here").
// 2) A blind bot (sees only face-up cards, like a player): plays with sensible heuristics, guessing where a real
//    player would have to. Used to grade difficulty.

// ---------- solver state ----------
// {cols:[[...]x7], down:[7], deck:[...], wp, f:[4], resets, draw, passes}  (cols and deck are copied on write)
function solverState(st){ return {cols:st.cols.map(c=>c.slice()),down:st.down.slice(),deck:st.deck.slice(),wp:st.wp,f:st.f.slice(),resets:st.resets,draw:st.cfg.draw,passes:st.cfg.passes}; }
const H1=0x9E3779B1|0, H2=0x85EBCA77|0;
function colHash(col,down,m,seed){ let h=Math.imul(seed^down,m); for(let i=0;i<col.length;i++){ h=Math.imul(h^(col[i]+1+(i<down?64:0)),m); h^=h>>>15; } return h; }
// A 53-bit key. Column order doesn't matter (columns are hashed independently and added), so mirrored layouts merge.
function sKey(s,useWp){ let a=0,b=0; for(let i=0;i<7;i++){ a=(a+colHash(s.cols[i],s.down[i],H1,0x1234567))|0; b=(b+colHash(s.cols[i],s.down[i],H2,0x7654321))|0; }
  let x=Math.imul(0x2545F491,s.deck.length+1), y=Math.imul(0x6C8E9CF5,s.deck.length+3);
  for(let i=0;i<s.deck.length;i++){ x=Math.imul(x^(s.deck[i]+1),H1); x^=x>>>13; y=Math.imul(y^(s.deck[i]+7),H2); y^=y>>>16; }
  a=(a^x)|0; b=(b+y)|0;
  if(useWp){ a=Math.imul(a^(s.wp+101),H2); b=(b^Math.imul(s.wp+13,H1))|0; }
  if(s.passes){ a=(a+Math.imul(s.resets+1,0x27D4EB2F))|0; }
  return (a>>>0)*2097152+((b>>>0)&0x1FFFFF); }

const sFits=(c,o)=>(o%13)===(c%13)+1&&(((o/13)|0)===1||((o/13)|0)===2)!==(((c/13)|0)===1||((c/13)|0)===2);
function sRunOk(a,j){ for(let i=j+1;i<a.length;i++) if(!sFits(a[i],a[i-1])) return false; return true; }
function sSafe(s,c){ const r=c%13, su=(c/13)|0; if(s.f[su]!==r) return false; if(r<=1) return true;
  const red=su===1||su===2, o1=red?0:1, o2=red?3:2, same=red?(su===1?2:1):(su===0?3:0); return s.f[o1]>=r&&s.f[o2]>=r&&s.f[same]>=r-1; }
const sCanAuto=s=>s.deck.length===0&&s.down.every(n=>n===0);

// Reachable waste positions: [p (cards on the waste), cost in engine moves (draws + resets), resets after].
function talon(s){ const L=s.deck.length, d=s.draw, out=[], seen=new Set(); if(!L) return out;
  if(s.wp>0){ out.push([s.wp,0,s.resets]); seen.add(s.wp); }
  let p=s.wp, c=0; while(p<L){ p=Math.min(L,p+d); c++; if(!seen.has(p)){ seen.add(p); out.push([p,c,s.resets]); } }
  if(!s.passes||s.resets<s.passes-1){ c++; let q=0; while(q<L){ q=Math.min(L,q+d); c++; if(!seen.has(q)){ seen.add(q); out.push([q,c,s.resets+1]); } } }
  return out; }

// A move: {t:'tf'|'tt'|'wf'|'wt'|'ft', i, j, to, p, cost, res}. Applying returns a new state (copy on write) and the
// list of engine actions it stands for (draws as 'd', then the move, then any automatic safe moves).
function sApply(s,m,mode){ const n={cols:s.cols.slice(),down:s.down.slice(),deck:s.deck,wp:s.wp,f:s.f.slice(),resets:s.resets,draw:s.draw,passes:s.passes};
  const acts=[]; for(let k=1;k<m.cost;k++) acts.push('d');
  if(m.t==='wf'||m.t==='wt'){ n.deck=s.deck.slice(); const c=n.deck[m.p-1]; n.deck.splice(m.p-1,1); n.wp=m.p-1; n.resets=m.res;
    if(m.t==='wf'){ n.f[(c/13)|0]++; acts.push('wF'); } else { n.cols[m.to]=n.cols[m.to].concat([c]); acts.push('w'+m.to); } }
  else if(m.t==='ft'){ const c=m.i*13+n.f[m.i]-1; n.f[m.i]--; n.cols[m.to]=n.cols[m.to].concat([c]); acts.push('f'+m.i+m.to); }
  else { const col=n.cols[m.i], cards=col.slice(m.j); n.cols[m.i]=col.slice(0,m.j); acts.push('t'+m.i+'.'+m.j+(m.t==='tf'?'F':m.to));
    if(m.t==='tf') n.f[(cards[0]/13)|0]++; else n.cols[m.to]=n.cols[m.to].concat(cards); }
  sFlip(n); sAuto(n,acts,mode); return [n,acts]; }
function sFlip(n){ for(let i=0;i<7;i++) if(n.down[i]>0&&n.cols[i].length===n.down[i]) n.down[i]--; }
// Automatic safe moves to the foundations: tableau tops (both modes), and the waste top in fast mode.
function sAuto(n,acts,mode){ for(let again=true;again;){ again=false;
  for(let i=0;i<7;i++){ const col=n.cols[i]; if(col.length>n.down[i]){ const c=col[col.length-1]; if(sSafe(n,c)){ acts.push('t'+i+'.'+(col.length-1)+'F'); n.cols[i]=col.slice(0,-1); n.f[(c/13)|0]++; sFlip(n); again=true; } } }
  if(mode==='fast'&&n.wp>0){ const c=n.deck[n.wp-1]; if(sSafe(n,c)){ acts.push('wF'); n.deck=n.deck.slice(); n.deck.splice(n.wp-1,1); n.wp--; n.f[(c/13)|0]++; again=true; } } } }

// Move generation. Order: foundation moves, then moves that turn a face-down card (most face-down first), then the rest,
// with talon moves ranked by how many stock turns they need.
function sMoves(s,mode,rnd){ const fast=mode==='fast', A=[], B=[], C=[], tal=talon(s);
  // tableau → foundation
  for(let i=0;i<7;i++){ const col=s.cols[i]; if(col.length>s.down[i]){ const c=col[col.length-1]; if(s.f[(c/13)|0]===c%13) A.push({t:'tf',i,j:col.length-1,cost:1,o:100+s.down[i]}); } }
  // waste (any reachable position) → foundation
  for(const [p,cost,res] of tal){ const c=s.deck[p-1]; if(s.f[(c/13)|0]===c%13) A.push({t:'wf',p,cost:cost+1,res,o:100-cost*4}); }
  let kingWaits=false; // is there a King that would use an empty column?
  for(let i=0;i<7;i++){ const col=s.cols[i]; for(let j=s.down[i];j<col.length;j++) if(col[j]%13===12&&(j>0)) { kingWaits=true; break; } }
  if(!kingWaits) for(const [p] of tal) if(s.deck[p-1]%13===12){ kingWaits=true; break; }
  const firstEmpty=s.cols.findIndex(c=>!c.length);
  // can something land on card x (from the talon, another column's run, or a foundation)?
  const lands=(x,skipCol)=>{ for(const [p] of tal) if(sFits(s.deck[p-1],x)) return true;
    for(let k=0;k<7;k++){ if(k===skipCol) continue; const col=s.cols[k]; for(let j=s.down[k];j<col.length;j++) if(sFits(col[j],x)&&sRunOk(col,j)) return true; }
    for(let q=0;q<4;q++) if(s.f[q]>0&&sFits(q*13+s.f[q]-1,x)) return true; return false; };
  // tableau → tableau
  for(let i=0;i<7;i++){ const col=s.cols[i], dn=s.down[i];
    for(let j=dn;j<col.length;j++){ if(!sRunOk(col,j)) continue; const c=col[j], king=c%13===12;
      const uncovers=j===dn&&dn>0, empties=j===0;
      if(fast&&!uncovers){ if(empties){ if(!kingWaits) continue; }
        else { const x=col[j-1]; if(!(s.f[(x/13)|0]===x%13||lands(x,i))) continue; } }
      for(let k=0;k<7;k++){ if(k===i) continue; const to=s.cols[k];
        if(!to.length){ if(!king||j===0||k!==firstEmpty) continue; }
        else if(!sFits(c,to[to.length-1])) continue;
        const m={t:'tt',i,j,to:k,cost:1,o:uncovers?80+dn*2:40}; (uncovers?B:C).push(m); } } }
  // waste → tableau
  for(const [p,cost,res] of tal){ const c=s.deck[p-1];
    for(let k=0;k<7;k++){ const to=s.cols[k]; if(!to.length){ if(c%13!==12||k!==firstEmpty) continue; } else if(!sFits(c,to[to.length-1])) continue;
      C.push({t:'wt',p,to:k,cost:cost+1,res,o:62-cost*4}); } }
  // foundation → tableau (fast: only when something could then land on it)
  for(let q=0;q<4;q++){ if(!s.f[q]) continue; const c=q*13+s.f[q]-1; if(c%13===12) continue;
    for(let k=0;k<7;k++){ const to=s.cols[k]; if(!to.length||!sFits(c,to[to.length-1])) continue; if(fast&&!lands(c,-1)) continue; C.push({t:'ft',i:q,to:k,cost:1,o:20}); } }
  // one list by priority: cheap foundation moves, uncovering moves, cheap waste plays, then the rest. Playing a waste
  // card that needs a long run through the stock sinks down the list, which keeps solutions (and so par) short.
  const all=A.concat(B,C); if(rnd) for(const m of all) m.o+=rnd()*14;
  return all.sort((a,b)=>b.o-a.o); }
// A lower bound on the moves still needed: every talon card moves at least once, and every column with
// face-down cards needs at least one move to uncover them.
function sLB(s){ let n=s.deck.length; for(let i=0;i<7;i++) if(s.down[i]>0) n++; return n; }

// makeSolver(engineState, {mode, limit, improve}) → {step(nodes), status, solution, cost, nodes}
//   status: 'run' | 'win' (solution found) | 'fail' (searched everything: no win) | 'limit' (gave up)
// A depth-first search can get lost in one bad corner, so the node budget is spent on a few restarts with the
// move order shuffled a little (1/16, 1/16, 1/8, 1/4, then the rest). Reordering never hides a win, so a restart
// that runs out of moves (not of budget) still proves there is none. With `improve`, a branch-and-bound pass then
// looks for a shorter solution (used for par).
function makeSolver(st,o){ o=Object.assign({mode:'fast',limit:300000,improve:0,seed:'s'},o||{});
  const mode=o.mode, s0=solverState(st), useWp=!(s0.draw===1&&!s0.passes&&mode==='fast');
  const acts0=[]; sAuto(s0,acts0,mode);
  const S={status:'run',solution:null,cost:Infinity,nodes:0,phase:1,mode,done:false};
  if(sCanAuto(s0)){ S.status='win'; S.solution=acts0; S.cost=acts0.length; S.done=true; S.step=()=>S.status; return S; }
  const tries=[1/16,1/16,1/8,1/4,1/2].map(f=>Math.max(2000,Math.floor(o.limit*f))); let tryN=0, tryEnd=0, rnd=null;
  let seen, stack, budget2=o.improve;
  const begin=()=>{ seen=new Map(); stack=[{s:s0,ms:sMoves(s0,mode,rnd),k:0,g:acts0.length,acts:acts0}]; seen.set(sKey(s0,useWp),acts0.length); };
  const nextTry=()=>{ rnd=(tryN||o.jitter)?rngFor(o.seed+'|'+tryN):null; tryEnd=S.nodes+tries[tryN]; tryN++; begin(); };
  nextTry();
  S.step=function(n){ if(S.done) return S.status;
    while(n-->0){
      if(!stack.length){ if(S.phase===1){ S.status='fail'; } S.done=true; return S.status; }
      if(S.phase===1&&S.nodes>=tryEnd){ if(tryN>=tries.length||S.nodes>=o.limit){ S.status='limit'; S.done=true; return S.status; } nextTry(); continue; }
      if(S.phase===2&&budget2--<=0){ S.done=true; return S.status; }
      const fr=stack[stack.length-1];
      if(fr.k>=fr.ms.length){ stack.pop(); continue; }
      const m=fr.ms[fr.k++]; const [c,acts]=sApply(fr.s,m,mode); const g=fr.g+acts.length; S.nodes++;
      if(g+sLB(c)>=S.cost) continue;
      const key=sKey(c,useWp), prev=seen.get(key);
      if(prev!==undefined&&(S.phase===1||prev<=g)) continue; seen.set(key,g);
      if(sCanAuto(c)){ const sol=[]; for(const f of stack) sol.push(...f.acts); sol.push(...acts);
        if(sol.length<S.cost){ S.solution=sol; S.cost=sol.length; } S.status='win';
        if(S.phase===1){ if(budget2>0){ S.phase=2; rnd=null; begin(); continue; } S.done=true; return S.status; }
        continue; }
      stack.push({s:c,ms:sMoves(c,mode,rnd),k:0,g,acts}); }
    return S.status; };
  return S; }
// Run a solver to the end (Node and tools only).
function solveAll(st,o){ const S=makeSolver(st,o); while(!S.done) S.step(1e9); return S; }
// The actions of a solution, without the starting automatic moves already applied on the table.
// (A solution always begins with any safe moves available at the start; the game doesn't make those for you.)

// Is this position still winnable? 'yes' | 'no' | 'unknown'. A sliced job: call .step(nodes) until .result is set.
// Fast search first; if it runs out of moves, the exact search confirms (it stays 'unknown' rather than guess).
function makeWinCheck(st,limit){ limit=limit||150000; const J={result:null,nodes:0}; let S=makeSolver(st,{mode:'fast',limit});
  J.step=n=>{ if(J.result) return J.result; const r=S.step(n); J.nodes=S.nodes+(J.exact?J.exact.nodes:0);
    if(J.exact){ if(r==='win') J.result='yes'; else if(r==='fail') J.result='no'; else if(r==='limit') J.result='unknown'; return J.result; }
    if(r==='win'){ J.result='yes'; J.solution=S.solution; } else if(r==='limit') J.result='unknown'; else if(r==='fail'){ J.exact=S=makeSolver(st,{mode:'exact',limit:limit*2}); }
    return J.result; };
  return J; }

// ---------- the blind bot ----------
// Sees only what a player sees: face-up tableau cards, the waste top and the foundations (in Open deck, everything).
// rng drives its random choices; noise widens them. Returns {won, moves}. Every action counts as a player's move.
function botPlay(seed,cfg,rng,o){ o=Object.assign({noise:14,maxActions:1500},o||{}); const st=typeof seed==='string'?newGame(seed,cfg):seed, open=!!st.cfg.open;
  let idle=0, acts=0;
  const kingWaits=()=>{ for(let i=0;i<7;i++){ const col=st.cols[i]; for(let j=st.down[i];j<col.length;j++) if(rankOf(col[j])===12&&(j>0||st.down[i]>0)) return true; } const w=wasteTop(st); return w>=0&&rankOf(w)===12; };
  const hiddenLow=i=>{ let m=13; for(let k=0;k<st.down[i];k++) m=Math.min(m,rankOf(st.cols[i][k])); return m; };
  // can the waste top land on card x?
  const wasteFits=x=>{ const w=wasteTop(st); return w>=0&&fits(w,x); };
  while(acts++<o.maxActions){
    if(st.won||canAutoComplete(st)) return {won:true,moves:st.moves};
    let best=null, bs=-1e9;
    for(const mv of legalMoves(st)){ const f=mv.from, t=mv.to; let sc=null;
      if(f.k==='f') continue; // the bot never takes cards back down
      const col=f.k==='t'?st.cols[f.i]:null, uncov=f.k==='t'&&f.j===st.down[f.i]&&st.down[f.i]>0;
      if(t.k==='f'){ const c=cardsOf(st,f)[0]; sc=isSafe(st,c)?55:(uncov?52:f.k==='t'&&f.j>st.down[f.i]&&wasteFits(col[f.j-1])?34:26); if(uncov) sc+=st.down[f.i]; }
      else if(f.k==='w'){ const c=wasteTop(st); sc=st.cols[t.i].length?30:(rankOf(c)===12?24:null); }
      else if(uncov){ sc=40+st.down[f.i]*2+(open?(13-hiddenLow(f.i))*1.5:0); if(!st.cols[t.i].length&&o.kingPick) sc+=st.down[f.i]; }
      else if(f.j===0){ if(st.cols[t.i].length&&kingWaits()) sc=18; }
      else { const x=col[f.j-1]; if(toFound(st,x)) sc=15; else if(wasteFits(x)) sc=12; }
      if(sc==null) continue; sc+=rng()*o.noise; if(sc>bs){ bs=sc; best=mv; } }
    // (no move it makes can be undone by its next one: tableau moves uncover, empty a column for a King, or free a card)
    if(best){ move(st,best.from,best.to); if(o.rec) o.rec.push(encMove(best)); idle=0; continue; }
    // nothing to do but turn the stock; give up after a whole cycle with no progress
    const r=draw(st); if(!r) return {won:false,moves:st.moves}; if(o.rec) o.rec.push('d');
    idle++; if(idle>Math.ceil(st.deck.length/st.cfg.draw)+2) return {won:false,moves:st.moves}; }
  return {won:false,moves:st.moves}; }
// Grade a deal: the blind bot plays it `runs` times with different random choices.
// Returns the win rate, the average moves of its wins and its shortest win (a replayable action list).
function gradeRate(seed,cfg,runs){ runs=runs||20; let w=0, mv=0, best=null; for(let k=0;k<runs;k++){ const rec=[]; const r=botPlay(seed,cfg,rngFor(seed+'|bot|'+k),{rec}); if(r.won){ w++; mv+=r.moves; if(!best||rec.length<best.length) best=rec; } }
  return {rate:w/runs,avgMoves:w?mv/w:0,best}; }
const GRADES=['easy','medium','hard','expert'], GRADE_NAMES={easy:'Easy',medium:'Medium',hard:'Hard',expert:'Expert'};
const gradeOf=rate=>rate>=.75?'easy':rate>=.5?'medium':rate>=.25?'hard':'expert';
