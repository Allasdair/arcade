// ===================== Sudoku solver =====================
// 1. The logic solver: applies techniques in order of difficulty, always the easiest one that makes progress, on
//    candidates (notes) for every cell, until the grid is solved or nothing applies. It never guesses. Its output
//    grades a puzzle (the hardest technique used), sets par time and gives hints (the next logical step).
// 2. The exact solver: bit masks with backtracking; counts solutions and stops at 2 (uniqueness), or fills a grid.
// 3. The generator: a full grid, then givens removed in 180°-symmetric pairs while the logic solver can still finish
//    within the target grade. Kept only if its hardest technique is exactly the target grade. Runs in slices.

// ---------- techniques ----------
// lv: 0 Easy · 1 Normal · 2 Hard · 3 Expert. w: seconds a casual player takes to spot one (for par time).
const TECH=[
 {id:'hs',name:'Hidden single',lv:0,w:8},{id:'ns',name:'Naked single',lv:0,w:10},
 {id:'pt',name:'Pointing',lv:1,w:30},{id:'cl',name:'Claiming',lv:1,w:32},{id:'np',name:'Naked pair',lv:1,w:40},{id:'hp',name:'Hidden pair',lv:1,w:50},
 {id:'nt',name:'Naked triple',lv:2,w:75},{id:'ht',name:'Hidden triple',lv:2,w:90},{id:'xw',name:'X-Wing',lv:2,w:100},{id:'xy',name:'XY-Wing',lv:2,w:110},
 {id:'sf',name:'Swordfish',lv:3,w:150},{id:'xyz',name:'XYZ-Wing',lv:3,w:150},{id:'nq',name:'Naked quad',lv:3,w:150},{id:'hq',name:'Hidden quad',lv:3,w:170},{id:'sc',name:'Simple colouring',lv:3,w:180}];
const TECH_BY={}; TECH.forEach((t,i)=>{ TECH_BY[t.id]=t; t.k=i; });
// Par time: Σ steps × w × a generous slack (casual pace), Mini singles a little quicker. One place to loosen it.
const PAR={slack:1.4,mini:.6,round:30};
const HNAME={row:'row',col:'column',box:'box',diag:'diagonal'};
const hname=(g,h)=>h.type==='box'&&g.jig?'region':HNAME[h.type];

// candidates from the digits placed
function candsOf(g,vals){ const cand=new Uint16Array(g.NN); for(let c=0;c<g.NN;c++) cand[c]=legalMask(g,vals,c); return cand; }
function applyPlace(g,vals,cand,c,d){ vals[c]=d; cand[c]=0; const bit=~(1<<(d-1)); for(const p of g.peers[c]) cand[p]&=bit; }
function applyStep(g,vals,cand,s){ if(s.place) applyPlace(g,vals,cand,s.place[0],s.place[1]); else for(const [c,m] of s.elim) cand[c]&=~m; }
function* combos(arr,k,start,pre){ start=start||0; pre=pre||[]; if(pre.length===k){ yield pre; return; }
  for(let i=start;i<=arr.length-(k-pre.length);i++){ pre.push(arr[i]); yield* combos(arr,k,i+1,pre); pre.pop(); } }
// houses in hint order: boxes first (the most natural place to spot a single), then rows, columns and diagonals
const hOrder=g=>g._ho||(g._ho=g.houses.map((h,i)=>i).sort((a,b)=>(g.houses[a].type==='box'?0:1)-(g.houses[b].type==='box'?0:1)||a-b));

// --- singles ---
function tHidden(g,vals,cand){ for(const hi of hOrder(g)){ const cells=g.houses[hi].cells; let once=0, twice=0;
    for(const c of cells){ const m=cand[c]; twice|=once&m; once|=m; } const sg=once&~twice; if(!sg) continue;
    const d=lowDigit(sg), bit=1<<(d-1); for(const c of cells) if(cand[c]&bit) return {t:'hs',place:[c,d],houses:[hi],d}; }
  return null; }
function tNaked(g,vals,cand){ for(let c=0;c<g.NN;c++) if(!vals[c]&&POP[cand[c]]===1) return {t:'ns',place:[c,lowDigit(cand[c])],houses:[],d:lowDigit(cand[c])}; return null; }
// --- locked candidates: pointing (from a box) and claiming (from a row, column or diagonal) ---
function tLocked(g,vals,cand,want){ for(const it of g.inter){ const A=g.houses[it.a], kind=A.type==='box'?'pt':'cl'; if(kind!==want) continue;
    let mIn=0, mOut=0, mRest=0; for(const c of it.cells) mIn|=cand[c];
    if(!it.aRest) it.aRest=A.cells.filter(c=>!it.cells.includes(c));
    for(const c of it.aRest) mOut|=cand[c]; for(const c of it.rest) mRest|=cand[c];
    let ds=mIn&~mOut&mRest; if(!ds) continue; const d=lowDigit(ds), bit=1<<(d-1);
    // the digit must not already be placed in house a
    if(A.cells.some(c=>vals[c]===d)) continue;
    const elim=it.rest.filter(c=>cand[c]&bit).map(c=>[c,bit]); return {t:kind,elim,houses:[it.a,it.b],cells:it.cells.filter(c=>cand[c]&bit),d}; }
  return null; }
// --- naked subsets: k cells of a house that can only hold k digits ---
function tNakedSub(g,vals,cand,k){ const id=k===2?'np':k===3?'nt':'nq';
  for(const hi of hOrder(g)){ const cells=g.houses[hi].cells, E=cells.filter(c=>!vals[c]&&POP[cand[c]]>=2&&POP[cand[c]]<=k); if(E.length<k) continue;
    const empty=cells.filter(c=>!vals[c]); if(empty.length<=k) continue;
    for(const cb of combos(E,k)){ let u=0; for(const c of cb) u|=cand[c]; if(POP[u]!==k) continue;
      const elim=[]; for(const c of empty) if(!cb.includes(c)&&(cand[c]&u)) elim.push([c,cand[c]&u]);
      if(elim.length) return {t:id,elim,houses:[hi],cells:cb.slice(),mask:u}; } }
  return null; }
// --- hidden subsets: k digits that can only go in the same k cells of a house ---
function tHiddenSub(g,vals,cand,k){ const id=k===2?'hp':k===3?'ht':'hq';
  for(const hi of hOrder(g)){ const cells=g.houses[hi].cells, pos=[], D=[];
    for(let d=1;d<=g.N;d++){ const bit=1<<(d-1); let pm=0; cells.forEach((c,j)=>{ if(cand[c]&bit) pm|=1<<j; }); pos[d]=pm; if(POP[pm]>=2&&POP[pm]<=k) D.push(d); }
    if(D.length<k) continue;
    for(const cb of combos(D,k)){ let u=0, dm=0; for(const d of cb){ u|=pos[d]; dm|=1<<(d-1); } if(POP[u]!==k) continue;
      const tc=cells.filter((c,j)=>u&(1<<j)), elim=[]; for(const c of tc) if(cand[c]&~dm) elim.push([c,cand[c]&~dm]);
      if(elim.length) return {t:id,elim,houses:[hi],cells:tc,mask:dm}; } }
  return null; }
// --- fish: X-Wing (2) and Swordfish (3), on rows and columns ---
function tFish(g,vals,cand,n){ const N=g.N, id=n===2?'xw':'sf';
  for(let d=1;d<=N;d++){ const bit=1<<(d-1);
    for(const byRow of [true,false]){ const pm=[], base=[];
      for(let a=0;a<N;a++){ let m=0; for(let b=0;b<N;b++){ const c=byRow?a*N+b:b*N+a; if(cand[c]&bit) m|=1<<b; } pm[a]=m; if(POP[m]>=2&&POP[m]<=n) base.push(a); }
      if(base.length<n) continue;
      for(const cb of combos(base,n)){ let u=0; for(const a of cb) u|=pm[a]; if(POP[u]!==n) continue;
        const elim=[], cover=[]; for(let b=0;b<N;b++) if(u&(1<<b)){ cover.push(b); for(let a=0;a<N;a++){ if(cb.includes(a)) continue; const c=byRow?a*N+b:b*N+a; if(cand[c]&bit) elim.push([c,bit]); } }
        if(elim.length){ const cells=[]; for(const a of cb) for(const b of cover){ const c=byRow?a*N+b:b*N+a; if(cand[c]&bit) cells.push(c); }
          return {t:id,elim,d,cells,houses:cb.map(a=>byRow?a:N+a),cover:cover.map(b=>byRow?N+b:b),byRow}; } } } }
  return null; }
// --- XY-Wing: a two-digit pivot {x,y} sees {x,z} and {y,z}; z comes out of cells that see both pincers ---
function tXY(g,vals,cand){ const NN=g.NN, S=g.sees;
  for(let p=0;p<NN;p++){ const pc=cand[p]; if(vals[p]||POP[pc]!==2) continue; const pe=g.peers[p].filter(c=>!vals[c]&&POP[cand[c]]===2&&POP[cand[c]&pc]===1);
    for(let i=0;i<pe.length;i++) for(let j=i+1;j<pe.length;j++){ const a=pe[i], b=pe[j], ca=cand[a], cb=cand[b];
      if((ca&pc)===(cb&pc)) continue; const z=ca&~pc; if(!z||z!==(cb&~pc)) continue;
      const elim=[]; for(let c=0;c<NN;c++) if(c!==a&&c!==b&&c!==p&&(cand[c]&z)&&S[c*NN+a]&&S[c*NN+b]) elim.push([c,z]);
      if(elim.length) return {t:'xy',elim,cells:[p,a,b],d:lowDigit(z),houses:[]}; } }
  return null; }
// --- XYZ-Wing: a three-digit pivot {x,y,z} sees {x,z} and {y,z}; z comes out of cells that see all three ---
function tXYZ(g,vals,cand){ const NN=g.NN, S=g.sees;
  for(let p=0;p<NN;p++){ const pc=cand[p]; if(vals[p]||POP[pc]!==3) continue; const pe=g.peers[p].filter(c=>!vals[c]&&POP[cand[c]]===2&&(cand[c]&~pc)===0);
    for(let i=0;i<pe.length;i++) for(let j=i+1;j<pe.length;j++){ const a=pe[i], b=pe[j], ca=cand[a], cb=cand[b];
      if((ca|cb)!==pc) continue; const z=ca&cb; if(POP[z]!==1) continue;
      const elim=[]; for(let c=0;c<NN;c++) if(c!==a&&c!==b&&c!==p&&(cand[c]&z)&&S[c*NN+a]&&S[c*NN+b]&&S[c*NN+p]) elim.push([c,z]);
      if(elim.length) return {t:'xyz',elim,cells:[p,a,b],d:lowDigit(z),houses:[]}; } }
  return null; }
// --- simple colouring (single-digit chains): conjugate pairs coloured in two colours ---
// Wrap: two cells of one colour see each other, so that colour is false. Trap: a cell seeing both colours can't hold d.
function tColour(g,vals,cand){ const NN=g.NN, S=g.sees;
  for(let d=1;d<=g.N;d++){ const bit=1<<(d-1), adj=new Map();
    for(const h of g.houses){ const cs=h.cells.filter(c=>cand[c]&bit); if(cs.length!==2) continue; const [a,b]=cs;
      if(!adj.has(a)) adj.set(a,new Set()); if(!adj.has(b)) adj.set(b,new Set()); adj.get(a).add(b); adj.get(b).add(a); }
    const col=new Map();
    for(const start of adj.keys()){ if(col.has(start)) continue; const comp=[start]; col.set(start,0);
      for(let q=0;q<comp.length;q++){ const x=comp[q]; for(const y of adj.get(x)) if(!col.has(y)){ col.set(y,1-col.get(x)); comp.push(y); } }
      if(comp.length<3) continue;
      const side=[comp.filter(c=>col.get(c)===0),comp.filter(c=>col.get(c)===1)];
      for(let k=0;k<2;k++){ const s=side[k]; let clash=false; for(let i=0;i<s.length&&!clash;i++) for(let j=i+1;j<s.length;j++) if(S[s[i]*NN+s[j]]){ clash=true; break; }
        if(clash) return {t:'sc',elim:s.map(c=>[c,bit]),d,cells:comp,colA:side[0],colB:side[1],rule:'wrap',houses:[]}; }
      const elim=[]; for(let c=0;c<NN;c++){ if(!(cand[c]&bit)||col.has(c)) continue; if(side[0].some(a=>S[c*NN+a])&&side[1].some(b=>S[c*NN+b])) elim.push([c,bit]); }
      if(elim.length) return {t:'sc',elim,d,cells:comp,colA:side[0],colB:side[1],rule:'trap',houses:[]}; } }
  return null; }
// the order the solver tries them (easiest first)
const FINDERS=[['hs',tHidden],['ns',tNaked],['pt',(g,v,c)=>tLocked(g,v,c,'pt')],['cl',(g,v,c)=>tLocked(g,v,c,'cl')],
 ['np',(g,v,c)=>tNakedSub(g,v,c,2)],['hp',(g,v,c)=>tHiddenSub(g,v,c,2)],['nt',(g,v,c)=>tNakedSub(g,v,c,3)],['ht',(g,v,c)=>tHiddenSub(g,v,c,3)],
 ['xw',(g,v,c)=>tFish(g,v,c,2)],['xy',tXY],['sf',(g,v,c)=>tFish(g,v,c,3)],['xyz',tXYZ],['nq',(g,v,c)=>tNakedSub(g,v,c,4)],['hq',(g,v,c)=>tHiddenSub(g,v,c,4)],['sc',tColour]];
// the next step: the easiest technique (up to level maxLv) that makes progress. skip: technique ids to leave out.
function findStep(g,vals,cand,maxLv,skip){ if(maxLv==null) maxLv=3;
  for(const [id,f] of FINDERS){ if(TECH_BY[id].lv>maxLv) break; if(skip&&skip.includes(id)) continue; const s=f(g,vals,cand); if(s) return s; }
  return null; }
const broken=(g,vals,cand)=>{ for(let c=0;c<g.NN;c++) if(!vals[c]&&!cand[c]) return true; return false; };

// Solve by logic alone. Returns {solved, grade (0–3, the hardest level used), hardest (technique id), counts, steps, vals}.
// o.trace: keep every step (for technique puzzles). o.cand: start from these candidates instead of the legal ones.
function logicSolve(g,vals0,maxLv,o){ o=o||{}; const vals=vals0.slice(), cand=o.cand?Uint16Array.from(o.cand):candsOf(g,vals), counts={}, trace=o.trace?[]:null;
  let grade=0, hardest='', steps=0, ok=true;
  for(;;){ if(vals.every(v=>v)) break; if(broken(g,vals,cand)){ ok=false; break; }
    const s=findStep(g,vals,cand,maxLv); if(!s){ ok=false; break; }
    if(trace) trace.push({s,vals:vals.slice(),cand:Array.from(cand)});
    applyStep(g,vals,cand,s); steps++; counts[s.t]=(counts[s.t]||0)+1; const t=TECH_BY[s.t]; if(t.lv>grade||!hardest){ grade=Math.max(grade,t.lv); } if(!hardest||t.k>TECH_BY[hardest].k) hardest=s.t; }
  return {solved:ok&&vals.every(v=>v),grade,hardest,counts,steps,vals,trace}; }
// par time in seconds, rounded up to 30 s
function parSeconds(variant,counts){ let s=0; for(const id in counts){ const t=TECH_BY[id]; s+=counts[id]*t.w*(variant==='mini'&&t.lv===0?PAR.mini:1); }
  return Math.max(60,Math.ceil(s*PAR.slack/PAR.round)*PAR.round); }

// ---------- the exact solver (bit masks, backtracking, fewest candidates first) ----------
// limit: stop after this many solutions (2 = the uniqueness check). rng: try digits in a shuffled order (to fill a grid).
// nodes: give up after this many nodes (returns count −1).
function solveExact(g,vals0,limit,rng,nodes){ limit=limit||2; nodes=nodes||2e6; const NN=g.NN, H=g.houses.length, hm=new Int32Array(H), vals=vals0.slice(), CH=g.cellHouses;
  for(let c=0;c<NN;c++){ const v=vals[c]; if(!v) continue; const b=1<<(v-1); for(const h of CH[c]){ if(hm[h]&b) return {count:0,sol:null,nodes:0}; hm[h]|=b; } }
  let count=0, sol=null, n=0;
  const order=Array.from({length:g.N},(_,i)=>i+1);
  function rec(){ if(++n>nodes) return true; let best=-1, bm=0, bp=99;
    for(let c=0;c<NN;c++){ if(vals[c]) continue; let u=0; for(const h of CH[c]) u|=hm[h]; const m=g.full&~u, p=POP[m]; if(p===0) return false; if(p<bp){ bp=p; best=c; bm=m; if(p===1) break; } }
    if(best<0){ count++; if(!sol) sol=vals.slice(); return count>=limit; }
    const ds=rng?shuffleIn(order.slice(),rng):order;
    for(const d of ds){ const b=1<<(d-1); if(!(bm&b)) continue; vals[best]=d; for(const h of CH[best]) hm[h]|=b;
      const stop=rec(); vals[best]=0; for(const h of CH[best]) hm[h]&=~b; if(stop) return true; }
    return false; }
  rec(); return {count:n>nodes?-1:count,sol,nodes:n}; }
const countSolutions=(g,vals)=>solveExact(g,vals,2).count;

// ---------- Jigsaw regions: random connected 9-cell regions ----------
// Start from the 3×3 boxes and swap cells between neighbouring regions while both stay connected.
function regionConnected(N,reg,r){ const cells=[]; for(let k=0;k<N*N;k++) if(reg[k]===r) cells.push(k); if(!cells.length) return false;
  const seen=new Set([cells[0]]), q=[cells[0]];
  while(q.length){ const k=q.pop(), x=k%N, y=(k/N)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=N||ny>=N) continue; const j=ny*N+nx; if(reg[j]===r&&!seen.has(j)){ seen.add(j); q.push(j); } } }
  return seen.size===cells.length; }
function genRegions(rng,swaps){ const N=9, reg=[...stdRegions(9,3,3)].map(Number); swaps=swaps||260; let done=0, tries=0;
  while(done<swaps&&tries<swaps*60){ tries++; const a=Math.floor(rng()*81), ax=a%N, ay=(a/N)|0; const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[ax+dx,ay+dy]).filter(([x,y])=>x>=0&&y>=0&&x<N&&y<N).map(([x,y])=>y*N+x).filter(j=>reg[j]!==reg[a]);
    if(!nb.length) continue; const b=nb[Math.floor(rng()*nb.length)], ra=reg[a], rb=reg[b];
    // a pair of cells swaps regions: a goes to rb, and some cell c of rb next to ra goes to ra
    const cands=[]; for(let c=0;c<81;c++) if(reg[c]===rb&&c!==b){ const cx=c%N, cy=(c/N)|0; if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{ const x=cx+dx, y=cy+dy; return x>=0&&y>=0&&x<N&&y<N&&reg[y*N+x]===ra&&y*N+x!==a; })) cands.push(c); }
    if(!cands.length) continue; const c=cands[Math.floor(rng()*cands.length)];
    reg[a]=rb; reg[c]=ra; if(regionConnected(N,reg,ra)&&regionConnected(N,reg,rb)) done++; else { reg[a]=ra; reg[c]=rb; } }
  return reg.join(''); }
// a finer difficulty measure than the grade, for steering: the work beyond singles
const diffScore=r=>{ let s=0; for(const id in r.counts){ const t=TECH_BY[id]; if(t.lv) s+=r.counts[id]*t.w; } return s; };
// a full grid for a geometry (Jigsaw layouts can be slow for some digit orders, so restart with a node budget)
function fullGrid(g,rng){ for(let k=0;k<40;k++){ const s=solveExact(g,new Array(g.NN).fill(0),1,rng,20000); if(s.sol) return s.sol; } return null; }
// a Jigsaw layout that has full grids: retried until the exact solver fills one quickly
function genLayout(rng){ for(let k=0;k<200;k++){ const r=genRegions(rng), g=geom('jigsaw',r), s=solveExact(g,new Array(81).fill(0),1,rng,20000); if(s.count===1) return r; } return null; }

// ---------- the generator ----------
// Givens per variant and grade: [fewest, most]. Mini puzzles are Easy or Normal only. The diagonals in Diagonal add
// constraints, so its puzzles need fewer givens. (Tuned to where each grade appears naturally: see HANDOFF.md.)
const GIVENS={classic:{easy:[36,45],normal:[27,35],hard:[24,31],expert:[22,30]},jigsaw:{easy:[36,45],normal:[27,35],hard:[24,31],expert:[22,30]},
  diag:{easy:[30,40],normal:[22,30],hard:[19,26],expert:[17,24]},mini:{easy:[14,18],normal:[10,15]}};
// On the phone, Classic generates these in slices (falling back to the bank); the rest always come from the bank.
const GEN_ON_PHONE={classic:['easy','normal','hard'],diag:['easy','normal','hard'],jigsaw:['easy','normal','hard'],mini:['easy']};
// A step function: call next() until it returns {done:true, value}. Each logic solve is one step, so it slices well.
// Givens come out in 180°-symmetric pairs, each removal kept only while the logic solver still finishes within the
// target grade. Near the target count it steers: a removal that needs the target grade is preferred.
function* genPuzzle(variant,grade,seed,regions){ const rng=rngFor('SUDG|'+seed), V=VARIANTS[variant];
  if(V.jig&&!regions){ regions=genLayout(rng); if(!regions) return null; yield 0; }
  const g=geom(variant,regions), NN=g.NN, target=GRADES.indexOf(grade), [lo,hi]=GIVENS[variant][grade];
  // the full grid: small node budgets with restarts, one per slice (some Jigsaw layouts are slow for some digit orders)
  let full=null; for(let k=0;k<60&&!full;k++){ full=solveExact(g,new Array(NN).fill(0),1,rng,2500).sol; yield 0; } if(!full) return null;
  const vals=full.slice(); let pairs=[]; for(let c=0;c<Math.floor(NN/2);c++) pairs.push([c,NN-1-c]); if(NN%2) pairs.push([(NN-1)/2]); // the centre of an odd grid stands alone
  shuffleIn(pairs,rng); const tc=lo+Math.floor(rng()*(hi-lo+1)); let count=NN;
  const done=r=>({variant,grade,regions:regions||null,givens:toStr(vals),sol:toStr(full),count,hardest:r.hardest,counts:r.counts,par:parSeconds(variant,r.counts),seed:String(seed)});
  for(;;){ const steer=count<=hi+6&&target>0; let pick=-1, pickR=null, any=-1, anyR=null;
    for(let i=0;i<pairs.length;i++){ const pr=pairs[i]; if(count-pr.length<lo) continue; const keep=pr.map(c=>vals[c]); for(const c of pr) vals[c]=0;
      const r=logicSolve(g,vals,target); yield 1; pr.forEach((c,k)=>vals[c]=keep[k]);
      if(!r.solved) continue;
      if(!steer){ any=i; anyR=r; break; }
      if(r.grade===target&&count-pr.length<=hi){ pick=i; pickR=r; break; }
      // otherwise keep the removal that needs the most (and hardest) non-single steps
      const sc=diffScore(r); if(any<0||sc>anyR.sc){ any=i; anyR=r; r.sc=sc; } }
    if(pick<0){ pick=any; pickR=anyR; } if(pick<0) return null;
    const pr=pairs[pick]; for(const c of pr) vals[c]=0; count-=pr.length; pairs.splice(pick,1);
    if(count<=tc&&pickR.grade===target) return done(pickR);
    if(count<=hi&&pickR.grade===target&&target>0) return done(pickR); }
  }
// run the generator to the end (Node and tests); tries seed, seed#1, seed#2 … until one fits
function makePuzzle(variant,grade,seed,regions,tries){ tries=tries||400;
  for(let k=0;k<tries;k++){ const it=genPuzzle(variant,grade,k?seed+'#'+k:seed,regions); let r; do{ r=it.next(); }while(!r.done); if(r.value) return r.value; }
  return null; }
// grade a puzzle: the logic solver at full strength
function gradeOf(g,givens){ const r=logicSolve(g,toVals(givens),3); return {solved:r.solved,grade:GRADES[r.grade],hardest:r.hardest,counts:r.counts,steps:r.steps}; }

// ---------- hints: the next logical step ----------
// Candidates: the legal ones, narrowed by the player's own notes wherever those notes still hold the right digit
// (wrong notes are ignored, never trusted). A wrong digit is pointed out first.
function hintCands(st){ const g=geoOf(st), cand=candsOf(g,st.vals);
  for(let c=0;c<g.NN;c++){ const n=st.notes[c]; if(st.vals[c]||!n) continue; const b=1<<(+st.sol[c]-1); if(n&b) cand[c]&=n; }
  return cand; }
function hintStep(st){ const g=geoOf(st);
  for(let c=0;c<g.NN;c++) if(st.vals[c]&&st.vals[c]!==+st.sol[c]&&!isGiven(st,c)){ const s={t:'wrong',cells:[c],place:null,d:st.vals[c],houses:[]}; s.text=hintText(g,s); return s; }
  const vals=st.vals.slice(), cand=hintCands(st);
  // a wrong digit hidden by conflicts aside, the logic solver always has a step for a bank or generated puzzle
  let s=findStep(g,vals,cand,3);
  if(!s){ // safety net: reveal the cell with the fewest candidates
    let best=-1; for(let c=0;c<g.NN;c++) if(!vals[c]&&(best<0||POP[cand[c]]<POP[cand[best]])) best=c;
    if(best<0) return null; s={t:'reveal',place:[best,+st.sol[best]],houses:[],d:+st.sol[best]}; }
  s.text=hintText(g,s); s.cand=Array.from(cand); return s; }
const dl=m=>digitsOf(m).join(', ');
function hintText(g,s){ const H=k=>hname(g,g.houses[s.houses[k]]);
  switch(s.t){
  case 'wrong': return `This ${s.d} is wrong.`;
  case 'reveal': return `This cell is ${s.d}.`;
  case 'hs': return `Hidden single: ${s.d} can only go here in this ${H(0)}.`;
  case 'ns': return `Naked single: ${s.d} is the only digit left for this cell.`;
  case 'pt': return `Pointing: in this box, ${s.d} can only go in this ${H(1)}, so it comes out of the rest of the ${H(1)}.`.replace(' box,',g.jig?' region,':' box,');
  case 'cl': return `Claiming: in this ${H(0)}, ${s.d} can only go in this ${H(1)}, so it comes out of the rest of the ${H(1)}.`;
  case 'np': return `Naked pair: these 2 cells can only hold ${dl(s.mask)}, so those digits come out of the rest of the ${H(0)}.`;
  case 'nt': return `Naked triple: these 3 cells can only hold ${dl(s.mask)}, so those digits come out of the rest of the ${H(0)}.`;
  case 'nq': return `Naked quad: these 4 cells can only hold ${dl(s.mask)}, so those digits come out of the rest of the ${H(0)}.`;
  case 'hp': return `Hidden pair: ${dl(s.mask)} can only go in these 2 cells of the ${H(0)}, so their other notes come out.`;
  case 'ht': return `Hidden triple: ${dl(s.mask)} can only go in these 3 cells of the ${H(0)}, so their other notes come out.`;
  case 'hq': return `Hidden quad: ${dl(s.mask)} can only go in these 4 cells of the ${H(0)}, so their other notes come out.`;
  case 'xw': return s.byRow?`X-Wing on ${s.d}: in these 2 rows, ${s.d} can only go in the same 2 columns, so it comes out of the rest of those columns.`:`X-Wing on ${s.d}: in these 2 columns, ${s.d} can only go in the same 2 rows, so it comes out of the rest of those rows.`;
  case 'sf': return s.byRow?`Swordfish on ${s.d}: in these 3 rows, ${s.d} can only go in the same 3 columns, so it comes out of the rest of those columns.`:`Swordfish on ${s.d}: in these 3 columns, ${s.d} can only go in the same 3 rows, so it comes out of the rest of those rows.`;
  case 'xy': return `XY-Wing: whichever digit the middle cell holds, one end must be ${s.d}, so ${s.d} comes out of cells that see both ends.`;
  case 'xyz': return `XYZ-Wing: one of these three cells must be ${s.d}, so ${s.d} comes out of cells that see all three.`;
  case 'sc': return s.rule==='wrap'?`Simple colouring on ${s.d}: two cells of one colour see each other, so ${s.d} comes out of every cell of that colour.`:`Simple colouring on ${s.d}: one of the two colours holds ${s.d}, so it comes out of cells that see both colours.`;
  } return ''; }
