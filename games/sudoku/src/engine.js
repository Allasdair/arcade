// ===================== Sudoku engine =====================
// Pure: no DOM, no timers. The game state is plain JSON, so saves resume exactly.
// Cells are numbered row by row (0 … N·N−1). Digits are 1 … N; 0 is an empty cell. Notes are bit masks (bit d−1 = digit d).
// Every variant is just a list of "houses" (rows, columns, regions and, in Diagonal, the two main diagonals):
// like Sweep's neighbour lists, the rules, the solver, the generator and the hints all run on that one list.

// ---------- seeded RNG (as in Sweep): cyrb128 → sfc32 ----------
function cyrb128(str){ let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0,k;i<str.length;i++){ k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044179); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044179);
  return [(h1^h2^h3^h4)>>>0,(h2^h1)>>>0,(h3^h1)>>>0,(h4^h1)>>>0]; }
function sfc32(a,b,c,d){ return function(){ a>>>=0;b>>>=0;c>>>=0;d>>>=0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0; return (t>>>0)/4294967296; }; }
const rngFor=str=>{ const s=cyrb128(String(str)); return sfc32(s[0],s[1],s[2],s[3]); };
function shuffleIn(a,r){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

// ---------- variants ----------
// Mini: digits 1–6 in 2×3 boxes (2 rows tall, 3 columns wide). Diagonal: Classic plus both main diagonals.
// Jigsaw: Classic rules with 9 irregular connected regions of 9 cells (a regions string: one region digit per cell).
const VARIANTS={mini:{N:6,bw:3,bh:2,name:'Mini 6×6'},classic:{N:9,bw:3,bh:3,name:'Classic'},diag:{N:9,bw:3,bh:3,diag:1,name:'Diagonal'},jigsaw:{N:9,bw:3,bh:3,jig:1,name:'Jigsaw'}};
const VKEYS=['mini','classic','diag','jigsaw'];
const GRADES=['easy','normal','hard','expert'], GRADE_NAMES={easy:'Easy',normal:'Normal',hard:'Hard',expert:'Expert'};
const gradesFor=v=>v==='mini'?['easy','normal']:GRADES;
function stdRegions(N,bw,bh){ let s=''; for(let r=0;r<N;r++) for(let c=0;c<N;c++) s+=String(Math.floor(r/bh)*(N/bw)+Math.floor(c/bw)); return s; }
const popc=m=>{ let n=0; while(m){ m&=m-1; n++; } return n; };
const POP=new Uint8Array(1<<9); for(let m=1;m<512;m++) POP[m]=POP[m>>1]+(m&1);
const lowDigit=m=>{ let d=1; while(!(m&1)){ m>>=1; d++; } return d; };
const digitsOf=m=>{ const o=[]; for(let d=1;m;d++,m>>=1) if(m&1) o.push(d); return o; };

// geometry: houses, the houses of each cell, peers, a "sees" table and house intersections (for locked candidates)
const GEO={};
function geom(variant,regions){ const V=VARIANTS[variant], key=variant+'|'+(V.jig?regions:''); if(GEO[key]) return GEO[key];
  const N=V.N, NN=N*N, reg=V.jig?regions:stdRegions(N,V.bw,V.bh), houses=[];
  for(let r=0;r<N;r++) houses.push({type:'row',i:r,cells:Array.from({length:N},(_,c)=>r*N+c)});
  for(let c=0;c<N;c++) houses.push({type:'col',i:c,cells:Array.from({length:N},(_,r)=>r*N+c)});
  for(let b=0;b<N;b++){ const cells=[]; for(let k=0;k<NN;k++) if(+reg[k]===b) cells.push(k); houses.push({type:'box',i:b,cells}); }
  if(V.diag){ houses.push({type:'diag',i:0,cells:Array.from({length:N},(_,k)=>k*N+k)}); houses.push({type:'diag',i:1,cells:Array.from({length:N},(_,k)=>k*N+(N-1-k))}); }
  const cellHouses=Array.from({length:NN},()=>[]); houses.forEach((h,hi)=>h.cells.forEach(c=>cellHouses[c].push(hi)));
  const sees=new Uint8Array(NN*NN), peers=[];
  for(let c=0;c<NN;c++){ const s=new Set(); for(const hi of cellHouses[c]) for(const p of houses[hi].cells) if(p!==c) s.add(p); peers.push([...s].sort((a,b)=>a-b)); for(const p of s) sees[c*NN+p]=1; }
  // pairs of houses sharing 2+ cells: the digit's spots in house a all inside the overlap clear it from the rest of house b
  const inter=[]; for(let a=0;a<houses.length;a++) for(let b=0;b<houses.length;b++){ if(a===b) continue; const B=new Set(houses[b].cells), I=houses[a].cells.filter(c=>B.has(c));
    if(I.length>=2&&I.length<N) inter.push({a,b,cells:I,rest:houses[b].cells.filter(c=>!I.includes(c))}); }
  const g={variant,N,NN,reg,houses,cellHouses,peers,sees,inter,full:(1<<N)-1,jig:!!V.jig,diag:!!V.diag,boxW:V.bw,boxH:V.bh};
  GEO[key]=g; return g; }

// ---------- puzzles as strings: one character per cell, '0' empty ----------
const toVals=s=>[...s].map(Number), toStr=a=>a.join('');
const givenCount=s=>[...s].filter(ch=>ch!=='0').length;

// ---------- game state ----------
// cfg: notes (false = the Notes button is off), check (mistake check), limit (mistakes allowed; the next one fails), parTime
const defCfg=o=>Object.assign({notes:true,check:true,limit:0},o||{});
// p: {variant, regions, givens, sol, seed, notes (optional pre-filled notes, for technique puzzles), fixed (optional pre-placed digits)}
function newGame(p,cfg){ const g=geom(p.variant,p.regions), NN=g.NN; const sol=p.sol||toStr(solveExact(g,toVals(p.givens)).sol);
  return {v:1,variant:p.variant,regions:p.regions||null,seed:String(p.seed||''),givens:p.givens,sol,cfg:defCfg(cfg),
    vals:toVals(p.givens),notes:p.notes?p.notes.slice():new Array(NN).fill(0),
    hist:[],moves:0,mistakes:0,hints:0,time:0,won:false,lost:false,fillUsed:false,notesUsed:!!p.notes,undos:0}; }
const geoOf=st=>geom(st.variant,st.regions);
const isGiven=(st,c)=>st.givens[c]!=='0';
const solOf=(st,c)=>+st.sol[c];
const isWrong=(st,c)=>st.vals[c]&&st.vals[c]!==+st.sol[c];
const filled=st=>st.vals.every(v=>v);
const HIST_MAX=3000;
function pushHist(st,ent){ st.hist.push(ent); if(st.hist.length>HIST_MAX) st.hist.shift(); }
const checkWon=st=>{ st.won=st.vals.every((v,c)=>v===+st.sol[c]); return st.won; };

// the legal candidates of a cell from the digits placed (what "Fill notes" puts in)
function legalMask(g,vals,c){ if(vals[c]) return 0; let m=g.full; for(const p of g.peers[c]) if(vals[p]) m&=~(1<<(vals[p]-1)); return m; }
// cells that break the rules: two equal digits in one house (the rules, not the solution)
function conflicts(st){ const g=geoOf(st), out=new Set();
  for(const h of g.houses){ const seen={}; for(const c of h.cells){ const v=st.vals[c]; if(!v) continue; if(seen[v]!=null){ out.add(c); out.add(seen[v]); } else seen[v]=c; } }
  return out; }
// houses completed by a move at cell c: full and clash-free
function completedAt(st,c){ const g=geoOf(st), out=[];
  for(const hi of g.cellHouses[c]){ const h=g.houses[hi]; let ok=true, seen=0; for(const k of h.cells){ const v=st.vals[k]; if(!v||(seen&(1<<v))){ ok=false; break; } seen|=1<<v; } if(ok) out.push(hi); }
  return out; }
// how many of each digit are placed (a pad digit greys out once all N are placed)
function digitCounts(st){ const g=geoOf(st), n=new Array(g.N+1).fill(0); for(const v of st.vals) if(v) n[v]++; return n; }

// ---------- actions (each returns null if nothing changed) ----------
// Place digit d in cell c. Placing the digit already there erases it. A wrong digit with mistake check on counts a mistake.
// o.autoNotes: remove d from the notes of every cell in the same houses (not an assist).
function place(st,c,d,o){ o=o||{}; if(st.won||st.lost||isGiven(st,c)||d<1||d>geoOf(st).N) return null; const g=geoOf(st);
  if(st.vals[c]===d) return erase(st,c);
  const ch=[[c,st.vals[c],st.notes[c]]]; st.vals[c]=d; st.notes[c]=0;
  if(o.autoNotes){ const bit=1<<(d-1); for(const p of g.peers[c]) if(st.notes[p]&bit){ ch.push([p,st.vals[p],st.notes[p]]); st.notes[p]&=~bit; } }
  let wrong=d!==+st.sol[c], counted=false;
  if(wrong&&st.cfg.check){ st.mistakes++; counted=true; }
  pushHist(st,{a:'p',ch}); st.moves++;
  const done=completedAt(st,c); checkWon(st);
  if(counted&&st.cfg.limit&&st.mistakes>st.cfg.limit) st.lost=true;
  return {c,d,wrong,counted,done,won:st.won,lost:st.lost}; }
// toggle the pencil mark d in an empty cell
function toggleNote(st,c,d){ if(st.won||st.lost||isGiven(st,c)||st.vals[c]||!st.cfg.notes) return null; const bit=1<<(d-1);
  pushHist(st,{a:'n',ch:[[c,0,st.notes[c]]]}); st.notes[c]^=bit; st.moves++; st.notesUsed=true; return {c,d,on:!!(st.notes[c]&bit)}; }
// set a cell's notes to exactly mask (used by hints that clear notes)
function setNotes(st,list){ const ch=[]; for(const [c,m] of list){ if(st.vals[c]||st.notes[c]===m) continue; ch.push([c,0,st.notes[c]]); st.notes[c]=m; }
  if(!ch.length) return null; pushHist(st,{a:'h',ch}); st.moves++; return {n:ch.length}; }
function erase(st,c){ if(st.won||st.lost||isGiven(st,c)) return null; if(!st.vals[c]&&!st.notes[c]) return null;
  pushHist(st,{a:'e',ch:[[c,st.vals[c],st.notes[c]]]}); if(st.vals[c]) st.vals[c]=0; else st.notes[c]=0; st.moves++; return {c}; }
// Fill notes: every empty cell gets all its legal candidates (not an assist: it saves tedium and makes no deduction)
function fillNotes(st){ if(st.won||st.lost||!st.cfg.notes) return null; const g=geoOf(st), ch=[];
  for(let c=0;c<g.NN;c++){ if(st.vals[c]) continue; const m=legalMask(g,st.vals,c); if(m!==st.notes[c]){ ch.push([c,0,st.notes[c]]); st.notes[c]=m; } }
  if(!ch.length) return null; pushHist(st,{a:'f',ch}); st.moves++; st.fillUsed=true; st.notesUsed=true; return {n:ch.length}; }
// unlimited undo; free (it's just editing). Mistakes already counted stay counted.
function undo(st){ if(st.won||st.lost||!st.hist.length) return null; const e=st.hist.pop();
  for(let k=e.ch.length-1;k>=0;k--){ const [c,v,n]=e.ch[k]; st.vals[c]=v; st.notes[c]=n; } st.undos++; st.moves++; return {a:e.a,cells:e.ch.map(x=>x[0])}; }
const canUndo=st=>!st.won&&!st.lost&&st.hist.length>0;

// ---------- compact puzzle strings (the bank) ----------
// Givens are 180°-symmetric, so a bit mask over the first half of the cells says which are given (6 bits per character),
// then the given digits in cell order, three per two characters (base 9). Jigsaw puzzles start with their layout's index.
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64I={}; [...B64].forEach((ch,i)=>B64I[ch]=i);
function encPuzzle(givens,layout){ const NN=givens.length, half=Math.ceil(NN/2); let o=layout!=null?B64[layout]:'', acc=0, nb=0;
  for(let i=0;i<half;i++){ acc=acc*2+(givens[i]!=='0'?1:0); nb++; if(nb===6){ o+=B64[acc]; acc=0; nb=0; } }
  if(nb){ acc<<=6-nb; o+=B64[acc]; }
  const ds=[...givens].filter(ch=>ch!=='0').map(ch=>+ch-1); while(ds.length%3) ds.push(0);
  for(let i=0;i<ds.length;i+=3){ const v=ds[i]*81+ds[i+1]*9+ds[i+2]; o+=B64[v>>6]+B64[v&63]; }
  return o; }
function decPuzzle(s,NN,jig){ let p=0, layout=null; if(jig) layout=B64I[s[p++]]; const half=Math.ceil(NN/2), mask=[];
  for(let i=0;i<half;i+=6){ const v=B64I[s[p++]]; for(let b=0;b<6&&i+b<half;b++) mask.push((v>>(5-b))&1); }
  const on=new Array(NN).fill(0); for(let i=0;i<half;i++) if(mask[i]){ on[i]=1; on[NN-1-i]=1; }
  const ds=[]; while(p<s.length){ const v=B64I[s[p]]*64+B64I[s[p+1]]; p+=2; ds.push((v/81|0)+1,((v/9|0)%9)+1,(v%9)+1); }
  let k=0, g=''; for(let c=0;c<NN;c++) g+=on[c]?ds[k++]:'0';
  return {givens:g,layout}; }
