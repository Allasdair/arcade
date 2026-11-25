// ===================== Mahjong solver, blind bot and grading =====================
// The solver sees every tile. Depth-first search with a table of positions already seen and a node limit.
// Moves: when every remaining tile of a kind is free they all go at once (always safe, no branching); otherwise
// pairs that free the most tiles come first. It is a generator so the page can run it in ~8 ms slices.

// Zobrist keys per position index (enough for 144 tiles), fixed so results repeat.
const ZK=(()=>{ const r=seedRng('MJZOB1'), a=new Uint32Array(320); for(let i=0;i<320;i++) a[i]=Math.floor(r()*4294967296); return a; })();

// Incremental free-tile counters for fast search.
function makeCounters(L,gone){ const n=L.n, cov=new Int16Array(n), lc=new Int16Array(n), rc=new Int16Array(n);
  for(let i=0;i<n;i++){ if(gone[i]) continue; for(const j of L.above[i]) if(!gone[j]) cov[i]++; for(const j of L.left[i]) if(!gone[j]) lc[i]++; for(const j of L.right[i]) if(!gone[j]) rc[i]++; }
  return {cov,lc,rc}; }
function rmTile(L,C,t){ for(const b of L.below[t]) C.cov[b]--; for(const r of L.right[t]) C.lc[r]--; for(const l of L.left[t]) C.rc[l]--; }
function addTile(L,C,t){ for(const b of L.below[t]) C.cov[b]++; for(const r of L.right[t]) C.lc[r]++; for(const l of L.left[t]) C.rc[l]++; }
const cFree=(C,gone,i)=>!gone[i]&&C.cov[i]===0&&(C.lc[i]===0||C.rc[i]===0);

// per-layout extras, built once: the tiles to re-check after a removal, and the tiles each tile is under (transitively)
function solverGeom(L){ if(L._sg) return L._sg; const nb=[], over=[];
  for(let i=0;i<L.n;i++) nb.push([...new Set([...L.below[i],...L.left[i],...L.right[i]])]);
  for(let i=0;i<L.n;i++){ const o=new Set(), st=[...L.above[i]]; while(st.length){ const j=st.pop(); if(o.has(j)) continue; o.add(j); for(const k of L.above[j]) st.push(k); } over.push(o); }
  return L._sg={nb,over}; }
// solveGen(L, faces, gone, opts) → {win, line:[[a,b],…], nodes, timeout}
function* solveGen(L,faces,gone0,opts){ opts=opts||{}; const limit=opts.limit||250000, every=opts.every||150;
  const n=L.n, gone=gone0.slice(), C=makeCounters(L,gone), keyOf=faces.map(matchKey), G=solverGeom(L);
  const remain=new Int16Array(36); let left=0; for(let i=0;i<n;i++) if(!gone[i]){ remain[keyOf[i]]++; left++; }
  const members=[]; for(let k=0;k<36;k++) members.push([]); for(let i=0;i<n;i++) members[keyOf[i]].push(i);
  let h1=0, h2=0; for(let i=0;i<n;i++) if(gone[i]){ h1^=ZK[i]; h2^=ZK[i+160]; }
  // opts.ref: a known winning line from a nearby position (the generator's order, or the last solve). Its order
  // guides the search, so positions reached by sensible play are usually solved in a few dozen nodes.
  let rank=null; if(opts.ref){ rank=new Int16Array(n).fill(n); opts.ref.forEach((p,k)=>{ rank[p[0]]=k; rank[p[1]]=k; }); }
  const dead=new Set(), line=[]; let nodes=0, timeout=false, cap=0, noise=0; const rng=seedRng('solve|'+(opts.seed||0));
  const take=(a,b)=>{ gone[a]=gone[b]=1; rmTile(L,C,a); rmTile(L,C,b); remain[keyOf[a]]-=2; left-=2; h1^=ZK[a]^ZK[b]; h2^=ZK[a+160]^ZK[b+160]; line.push([a,b]); };
  const put=(a,b)=>{ line.pop(); h1^=ZK[a]^ZK[b]; h2^=ZK[a+160]^ZK[b+160]; left+=2; remain[keyOf[a]]+=2; addTile(L,C,b); addTile(L,C,a); gone[a]=gone[b]=0; };
  // a quick proof of a dead end: the last two tiles of a kind where one sits (somewhere) on top of the other
  // (or, with four left, every way of pairing them puts one tile of a pair on top of the other)
  const stack=(a,b)=>G.over[a].has(b)||G.over[b].has(a);
  const hopeless=()=>{ for(let k=0;k<36;k++){ const r=remain[k]; if(r!==2&&r!==4) continue; const t=[]; for(const i of members[k]) if(!gone[i]) t.push(i);
      if(r===2){ if(stack(t[0],t[1])) return true; }
      else if((stack(t[0],t[1])||stack(t[2],t[3]))&&(stack(t[0],t[2])||stack(t[1],t[3]))&&(stack(t[0],t[3])||stack(t[1],t[2]))) return true; } return false; };
  // tiles freed by removing a and b (used for ordering), plus a small lift for high tiles
  // ordering score: tiles freed by removing a and b, more if a freed tile finds a free partner; high tiles first
  const freeKeys=new Int16Array(36);
  const gain=(a,b,groups)=>{ gone[a]=gone[b]=1; rmTile(L,C,a); rmTile(L,C,b); let g=0;
    for(const t of G.nb[a]) if(cFree(C,gone,t)){ g+=4; const gk=groups.get(keyOf[t]); if(gk&&gk.some(x=>x!==a&&x!==b&&x!==t)) g+=3; }
    for(const t of G.nb[b]) if(cFree(C,gone,t)){ g+=4; const gk=groups.get(keyOf[t]); if(gk&&gk.some(x=>x!==a&&x!==b&&x!==t)) g+=3; }
    addTile(L,C,b); addTile(L,C,a); gone[a]=gone[b]=0; return g+L.pos[a][2]+L.pos[b][2]; };
  function* rec(){ if(left===0) return true;
    if(++nodes>cap){ timeout=true; return false; } if(nodes%every===0) yield nodes;
    const key=h1*2097152+(h2>>>11); if(dead.has(key)) return false;
    if(hopeless()){ dead.add(key); return false; }
    const groups=new Map(); for(let i=0;i<n;i++) if(cFree(C,gone,i)){ const k=keyOf[i]; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(i); }
    // safe: every remaining tile of a kind is free → remove them all, no branching
    for(const [k,g] of groups){ if(g.length>=2&&g.length===remain[k]){
      if(g.length===2){ take(g[0],g[1]); const r=yield* rec(); if(r) return true; put(g[0],g[1]); }
      else { take(g[0],g[1]); take(g[2],g[3]); const r=yield* rec(); if(r) return true; put(g[2],g[3]); put(g[0],g[1]); }
      if(!timeout) dead.add(key); return false; } }
    const moves=[]; for(const g of groups.values()) for(let x=0;x<g.length;x++) for(let y=x+1;y<g.length;y++) moves.push([g[x],g[y]]);
    if(!moves.length){ dead.add(key); return false; }
    if(moves.length>1){ const sc=moves.map(m=>(rank?-(rank[m[0]]+rank[m[1]])*8:0)+gain(m[0],m[1],groups)+(noise?rng()*noise:0)); const idx=moves.map((m,i)=>i).sort((p,q)=>sc[q]-sc[p]||p-q); const mv=idx.map(i=>moves[i]); moves.length=0; moves.push(...mv); }
    for(const [a,b] of moves){ take(a,b); const r=yield* rec(); if(r) return true; put(a,b); if(timeout) return false; }
    dead.add(key); return false; }
  // restarts with a little noise in the move order cut the long tail of unlucky searches; the table of dead
  // positions carries over (a position goes in it only once every move from it has been searched)
  const shares=[.04,.06,.1,.15,.25,.4]; let win=false;
  for(let r=0;r<shares.length;r++){ cap=r===shares.length-1?limit:Math.min(limit,nodes+Math.round(limit*shares[r])); noise=r?2+r*2:0; timeout=false;
    win=yield* rec(); if(win||!timeout) break; line.length=0; }
  return {win,line:win?line.slice():null,nodes:Math.min(nodes,limit),timeout:!win&&timeout}; }
function runGen(g){ let r; do r=g.next(); while(!r.done); return r.value; }
const solve=(L,faces,gone,opts)=>runGen(solveGen(L,faces,gone,opts));
const solveState=(st,opts)=>solve(layoutOf(st),st.faces,st.gone,opts);

// ---------- blind bot ----------
// Sees only the face-up tiles (in Fog, only free tiles). Takes all 4 of a kind together when it can (it counts the
// tiles already removed); otherwise the pairs that free the most tiles; otherwise chooses at random.
function botPlay(L,faces,gone0,rng,opts){ opts=opts||{}; const gone=gone0.slice(), keyOf=faces.map(matchKey), removed=new Int16Array(36), total=new Int16Array(36);
  for(let i=0;i<L.n;i++){ total[keyOf[i]]++; if(gone[i]) removed[keyOf[i]]++; }
  let left=gone.reduce((a,g)=>a+(g?0:1),0), pairs=0;
  while(left>0){ const free=freeList(L,gone), groups=new Map();
    for(const i of free){ const k=keyOf[i]; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(i); }
    let pick=null;
    for(const [k,g] of groups) if(g.length===4||(g.length>=2&&g.length===total[k]-removed[k])){ pick=[g[0],g[1]]; break; }
    if(!pick){ const moves=[]; for(const g of groups.values()) for(let x=0;x<g.length;x++) for(let y=x+1;y<g.length;y++) moves.push([g[x],g[y]]);
      if(!moves.length) return {win:false,pairs,left};
      // how many tiles each pair frees: a player can see this from the shape of the stack
      let best=-1, top=[]; for(const m of moves){ gone[m[0]]=gone[m[1]]=1; let f=0;
        for(const t of new Set([...L.below[m[0]],...L.below[m[1]],...L.left[m[0]],...L.right[m[0]],...L.left[m[1]],...L.right[m[1]]])) if(isFree(L,gone,t)) f++;
        gone[m[0]]=gone[m[1]]=0; if(f>best){ best=f; top=[m]; } else if(f===best) top.push(m); }
      pick=best>0?top[Math.floor(rng()*top.length)]:moves[Math.floor(rng()*moves.length)]; }
    gone[pick[0]]=gone[pick[1]]=1; removed[keyOf[pick[0]]]+=2; left-=2; pairs++; }
  return {win:true,pairs,left:0}; }
// Grade: the bot plays the board 20 times without shuffles; its win rate sets the grade.
const GRADE_RUNS=20;
function gradeBoard(L,faces,seed,runs){ runs=runs||GRADE_RUNS; let w=0; const rng=seedRng('grade|'+seed);
  for(let r=0;r<runs;r++) if(botPlay(L,faces,new Array(L.n).fill(0),rng).win) w++;
  const rate=w/runs; return {rate,grade:gradeOf(rate)}; }
// sliced grading on the phone: yields between plays
function* gradeGen(L,faces,seed,runs){ runs=runs||GRADE_RUNS; let w=0; const rng=seedRng('grade|'+seed);
  for(let r=0;r<runs;r++){ if(botPlay(L,faces,new Array(L.n).fill(0),rng).win) w++; yield r; }
  const rate=w/runs; return {rate,grade:gradeOf(rate)}; }
