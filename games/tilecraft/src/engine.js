// ===================== Tilecraft engine =====================
// Boards, letters, bag, rules, scoring, end of game, modifiers, the move generator, the computer opponent,
// the Daily and 2-Player share codes. No DOM: game state is plain JSON, so saves resume exactly and share codes
// rebuild a game by replaying its moves. All randomness comes from seeds (cyrb128 -> sfc32, as in Sweep).

// ---------- letters (our own table, kickoff section 4; tools/letters.py reproduces it from ENABLE) ----------
// letter: [value, Small count, Medium count, Large count]
const LETTERS={E:[1,9,12,19],A:[1,6,9,13],I:[1,5,8,12],R:[1,5,7,11],O:[1,4,7,10],S:[1,3,5,7],N:[1,4,5,9],T:[1,4,5,8],L:[1,4,5,8],
 D:[2,3,4,6],U:[2,2,4,6],C:[2,2,3,5],G:[3,2,3,4],P:[3,2,3,4],M:[3,2,3,4],H:[3,1,2,4],B:[3,1,2,3],Y:[4,1,2,3],F:[4,1,2,2],
 K:[4,1,1,2],W:[5,1,1,2],V:[5,1,1,1],Z:[7,1,1,1],X:[7,1,1,1],J:[8,1,1,1],Q:[10,1,1,1]};
const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ', BLANK='?';
const VAL=new Int8Array(27); for(let i=0;i<26;i++) VAL[i]=LETTERS[ALPHA[i]][0];
const valOf=ch=>ch===BLANK||(ch>='a'&&ch<='z')?0:LETTERS[ch][0]; // a lowercase letter is a blank showing that letter
const RACK=7, FULL_RACK=40, SCORELESS_END=6;

// ---------- boards ----------
const SIZES={small:{n:11,tiles:70,blanks:2,col:1,name:'Small'},medium:{n:15,tiles:100,blanks:2,col:2,name:'Medium'},large:{n:19,tiles:150,blanks:3,col:3,name:'Large'}};
const SIZE_IDS=['small','medium','large'], SHAPE_IDS=['square','ring','cross','diamond'];
const SHAPE_NAMES={square:'Square',ring:'Ring',cross:'Cross',diamond:'Diamond'};
// premium squares: 0 none, 1 = 2× Letter, 2 = 3× Letter, 3 = 2× Word, 4 = 3× Word
const PREM_NAMES=['','2× Letter','3× Letter','2× Word','3× Word'], PREM_SHORT=['','2L','3L','2W','3W'];
const LM=[1,2,3,1,1], WM=[1,1,1,2,3];
const PREM_RANGE={4:[6,8],3:[14,18],2:[10,14],1:[20,26]}; // Medium square board; others scale by playable area

// ---------- seeded randomness ----------
function seedRng(str){ // cyrb128 -> sfc32
  let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0;i<str.length;i++){ const k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044813); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044813);
  let a=(h1^h2^h3^h4)>>>0, b=(h2^h1)>>>0, c=(h3^h1)>>>0, d=(h4^h1)>>>0;
  const r=()=>{ a>>>=0; b>>>=0; c>>>=0; d>>>=0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0; return (t>>>0)/4294967296; };
  for(let i=0;i<15;i++) r(); return r; }
const h32=str=>Math.floor(seedRng(str)()*4294967296)>>>0;
function shuffle(a,rng){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

// Board shapes, from Sweep's masks, kept symmetric under 90° rotation with the centre (the start square) playable.
// Ring is a wheel: an outer ring, a hub round the start square and four spokes joining them.
function shapeMask(shape,n){ const m=new Uint8Array(n*n).fill(1); if(shape==='square') return m; const c=(n-1)/2, R=c+.5;
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){ const dx=x-c, dy=y-c, u=dx/R, v=dy/R; let on=1;
    if(shape==='ring'){ const r=Math.hypot(u,v); on=r<=1.04&&(r>=.56||r<=.32||Math.abs(dx)<=1||Math.abs(dy)<=1); }
    else if(shape==='diamond') on=Math.abs(u)+Math.abs(v)<=1.04;
    else if(shape==='cross') on=Math.abs(u)<=.37||Math.abs(v)<=.37;
    m[y*n+x]=on?1:0; }
  return m; }
const cheb=(n,a,b)=>Math.max(Math.abs(a%n-b%n),Math.abs(((a/n)|0)-((b/n)|0)));
function premRange(t,playable){ const f=playable/225, lo=PREM_RANGE[t][0]*f, hi=PREM_RANGE[t][1]*f; return [Math.floor(lo),Math.ceil(hi)]; }
// 90° symmetry places premiums in sets of 4: the counts allowed are the multiples of 4 in the scaled range,
// or, when a small shaped board's range holds none, the nearest multiple of 4 (at least 4)
function premAllowed(t,playable){ const [L,H]=premRange(t,playable), o=[]; for(let k=4;k<=H;k+=4) if(k>=L) o.push(k); if(!o.length) o.push(Math.max(4,Math.round((L+H)/8)*4)); return o; }
function premTargets(playable,rng){ const out={}; for(const t of [4,3,2,1]){ const o=premAllowed(t,playable); out[t]=o[Math.floor(rng()*o.length)]; } return out; }
// can a premium of type t go on cell c, given what's placed?
function premOK(B,prem,tw,c,t){ const n=B.n, s=B.start, x=c%n, y=(c/n)|0;
  if(t===4){ if(cheb(n,c,s)<=4) return false; for(const e of tw) if(cheb(n,c,e)<4) return false; }
  if(t!==1&&cheb(n,c,s)<=1) return false;
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; const X=x+dx, Y=y+dy; if(X<0||Y<0||X>=n||Y>=n) continue; const p=prem[Y*n+X];
    if(t>=3&&p>=3) return false;                 // no two Word squares next to each other
    if(p===t&&(t===2||!dx||!dy)) return false; } // no same letter premium side by side (3× Letter not even diagonally)
  return true; }
function placePremiums(B,rng){ const n=B.n, c=(n-1)/2, reps=[];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){ const dx=x-c, dy=y-c; if(dx>=1&&dy>=0){ const orb=[[dx,dy],[-dy,dx],[-dx,-dy],[dy,-dx]].map(([a,b])=>(b+c)*n+(a+c)); if(orb.every(i=>B.mask[i])) reps.push(orb); } }
  const target=premTargets(B.playable,rng);
  for(let attempt=0;attempt<200;attempt++){ const prem=new Uint8Array(n*n), tw=[]; let failed=0;
    for(const t of [4,3,2,1]){ let need=target[t]/4; for(const orb of shuffle(reps.slice(),rng)){ if(!need) break;
        if(orb.some(i=>prem[i])) continue; const set=[]; let good=true;
        for(const i of orb){ if(!premOK(B,prem,tw,i,t)){ good=false; break; } prem[i]=t; set.push(i); if(t===4) tw.push(i); }
        if(good) need--; else { for(const i of set){ prem[i]=0; if(t===4) tw.pop(); } } }
      if(need){ failed=t; break; } }
    if(!failed) return {prem,target};
    if(attempt%40===39) target[failed]=Math.max(0,target[failed]-4); } // a tight shape can't take that many: one orbit fewer
  return {prem:new Uint8Array(n*n),target}; }
const BOARDS=new Map();
function makeBoard(size,shape,seed){ const key=size+'|'+shape+'|'+seed; if(BOARDS.has(key)) return BOARDS.get(key);
  const n=SIZES[size].n, mask=shapeMask(shape,n), start=((n*n)>>1);
  const B={size,shape,seed,n,N:n*n,mask,start,playable:mask.reduce((a,b)=>a+b,0)};
  const r=placePremiums(B,seedRng('TCB1|'+size+'|'+shape+'|'+seed)); B.prem=r.prem; B.target=r.target;
  if(BOARDS.size>40) BOARDS.clear(); BOARDS.set(key,B); return B; }
const boardOf=cfg=>makeBoard(cfg.size,cfg.shape,cfg.boardSeed);

// ---------- modifiers and game setup ----------
const DEF_MODS={norepeat:false,timer:0,minLen:2,maxLen:0,blanks:null,swaps:true,rare:false};
const MAXLEN_OPTS=[0,7,6,5], BLANK_OPTS=[null,0,2,4], TIMER_OPTS=[0,30,60,90,120];
function bagTiles(size,mods){ const col=SIZES[size].col, out=[];
  for(const L of ALPHA) for(let k=0;k<LETTERS[L][col];k++) out.push(L);
  if(mods.rare) for(const L of 'JQXZ') out.push(L);
  const nb=mods.blanks==null?SIZES[size].blanks:mods.blanks; for(let k=0;k<nb;k++) out.push(BLANK); return out; }
// cfg: {size, shape, boardSeed, bagSeed, mods, players:[{name, ai}], solo, turns, first, preset}
function normCfg(c){ const o=Object.assign({size:'medium',shape:'square',boardSeed:1,bagSeed:1,players:[{name:'You',ai:null},{name:'Computer',ai:'normal'}],solo:false,turns:0,first:'toss'},c);
  o.mods=Object.assign({},DEF_MODS,c&&c.mods||{}); if(o.solo) o.players=o.players.slice(0,1); return o; }
function newGame(c){ const cfg=normCfg(c), B=boardOf(cfg), np=cfg.players.length;
  const st={v:1,cfg,cells:new Array(B.N).fill(''),bag:shuffle(bagTiles(cfg.size,cfg.mods),seedRng('TCG1|bag|'+cfg.bagSeed)),racks:[],scores:new Array(np).fill(0),
    turn:0,moves:[],scoreless:0,over:false,result:null,played:[]};
  if(cfg.preset){ // puzzles and set-ups: tiles already on the board, a given rack
    for(const [i,ch] of cfg.preset.cells) st.cells[i]=ch;
    const want=(cfg.preset.racks||[]).map(r=>r.split(''));
    for(const r of want) for(const t of r){ const k=st.bag.indexOf(t); if(k>=0) st.bag.splice(k,1); }
    for(const [,ch] of cfg.preset.cells){ const t=ch>='a'?BLANK:ch, k=st.bag.lastIndexOf(t); if(k>=0) st.bag.splice(k,1); }
    for(let p=0;p<np;p++) st.racks[p]=want[p]||[]; }
  if(cfg.first==='toss') st.turn=np>1&&seedRng('TCG1|toss|'+cfg.bagSeed)()<.5?1:0; else st.turn=cfg.first|0;
  for(let p=0;p<np;p++){ if(!st.racks[p]) st.racks[p]=[]; draw(st,p); }
  return st; }
function draw(st,p){ const r=st.racks[p]; while(r.length<RACK&&st.bag.length) r.push(st.bag.shift()); }
const cloneState=st=>JSON.parse(JSON.stringify(st));
const boardEmpty=st=>!st.cells.some(c=>c);
const rackSum=r=>r.reduce((a,t)=>a+valOf(t),0);
const turnsTaken=(st,p)=>st.moves.filter(m=>m.p===p).length;
// the tiles a player can't see: the bag plus the other racks
function unseen(st,p){ const o=st.bag.slice(); st.racks.forEach((r,q)=>{ if(q!==p) o.push(...r); }); return o.sort(); }

// ---------- rules: checking a play ----------
// tiles: [[cellIndex, letter, isBlank], ...]. Returns {ok, err, words:[{w,cells,sc,ok}], main, score, full}.
function wordThrough(B,get,i,d){ const n=B.n, step=d?n:1, inLine=d?(a=>a>=0&&a<B.N):(a=>a>=0&&a<B.N&&((a/n)|0)===((i/n)|0));
  let s=i; while(inLine(s-step)&&get(s-step)) s-=step; const cells=[]; let e=s; while(inLine(e)&&get(e)){ cells.push(e); e+=step; } return cells; }
function evalPlay(st,tiles){ const B=boardOf(st.cfg), n=B.n, mods=st.cfg.mods, R={ok:false,err:'',words:[],main:null,score:0,full:false};
  if(!tiles||!tiles.length){ R.err='Place some tiles'; return R; }
  const pos=new Map();
  for(const [i,ch,bl] of tiles){ if(i<0||i>=B.N||!B.mask[i]||st.cells[i]||pos.has(i)||!/^[A-Z]$/.test(ch)){ R.err='Place tiles on empty squares'; return R; } pos.set(i,bl?ch.toLowerCase():ch); }
  const get=i=>pos.get(i)||st.cells[i];
  const xs=new Set(tiles.map(t=>t[0]%n)), ys=new Set(tiles.map(t=>(t[0]/n)|0));
  let dir; if(tiles.length===1){ const i=tiles[0][0], x=i%n; dir=(x>0&&st.cells[i-1])||(x<n-1&&st.cells[i+1])?0:1; }
  else if(ys.size===1) dir=0; else if(xs.size===1) dir=1; else { R.err='Place tiles in one row or column'; return R; }
  const idx=tiles.map(t=>t[0]).sort((a,b)=>a-b), step=dir?n:1;
  for(let k=idx[0];k<=idx[idx.length-1];k+=step) if(!get(k)){ R.err='Leave no gaps'; return R; }
  const main=wordThrough(B,get,idx[0],dir), ws=[];
  if(main.length>=2) ws.push(main);
  for(const i of idx){ const c=wordThrough(B,get,i,1-dir); if(c.length>=2) ws.push(c); }
  if(boardEmpty(st)){ if(!pos.has(B.start)){ R.err='The first word must cover the star'; return R; } }
  else if(!ws.some(w=>w.some(c=>!pos.has(c)))){ R.err='Connect to the tiles on the board'; return R; }
  if(main.length<2){ R.err='Words need at least 2 letters'; return R; }
  let total=0;
  for(const cells of ws){ let s=0, wm=1, w=''; for(const c of cells){ const ch=get(c), v=valOf(ch); w+=ch.toUpperCase();
      if(pos.has(c)){ s+=v*LM[B.prem[c]]; wm*=WM[B.prem[c]]; } else s+=v; }
    const o={w,cells,sc:s*wm,ok:isWord(w)}; R.words.push(o); total+=o.sc; }
  R.main=R.words[0]; R.full=tiles.length===RACK; R.score=total+(R.full?FULL_RACK:0);
  const bad=R.words.filter(o=>!o.ok); if(bad.length){ R.err='Not in the word list: {0}|'+bad.map(o=>o.w).join(', '); return R; }
  if(R.main.w.length<(mods.minLen||2)){ R.err='The main word needs at least {0} letters|'+mods.minLen; return R; }
  if(mods.maxLen){ const long=R.words.filter(o=>o.w.length>mods.maxLen); if(long.length){ R.err='Words can be at most {0} letters|'+mods.maxLen; R.words.forEach(o=>{ if(o.w.length>mods.maxLen) o.ok=false; }); return R; } }
  if(mods.norepeat&&st.played.includes(R.main.w)){ R.err='Already played: {0}|'+R.main.w; R.main.ok=false; return R; }
  R.ok=true; return R; }
// errors carry a value after '|' so the interface can translate the sentence and fill in {0}
const errText=e=>{ const [t,v]=String(e).split('|'); return {t,v:v||''}; };

// ---------- applying moves ----------
// mv: {t:'p', tiles:[[i,'A',0],...]} play · {t:'x', tiles:['A','?']} swap · {t:'-'} pass ({why:'time'} when the timer ran out)
function canSwap(st){ return st.cfg.mods.swaps!==false&&st.bag.length>=RACK; }
function applyMove(st,mv){ if(st.over) return {ok:false,err:'The game is over'};
  const p=st.turn, rack=st.racks[p]; let rec;
  if(mv.t==='p'){ const R=evalPlay(st,mv.tiles); if(!R.ok) return R;
    const need=rack.slice(); for(const [,ch,bl] of mv.tiles){ const k=need.indexOf(bl?BLANK:ch); if(k<0) return {ok:false,err:'Those tiles aren\'t on the rack'}; need.splice(k,1); }
    for(const [i,ch,bl] of mv.tiles) st.cells[i]=bl?ch.toLowerCase():ch;
    st.racks[p]=need; draw(st,p); st.scores[p]+=R.score; st.played.push(R.main.w);
    st.scoreless=R.score>0?0:st.scoreless+1;
    rec={p,t:'p',tiles:mv.tiles.map(t=>[t[0],t[1],t[2]?1:0]),sc:R.score,w:R.main.w,ws:R.words.slice(1).map(o=>o.w),full:R.full?1:0,
      wsq:mv.tiles.filter(t=>boardOf(st.cfg).prem[t[0]]>=3).length};
    R.rec=rec; st.moves.push(rec); endCheck(st); return R; }
  if(mv.t==='x'){ if(!canSwap(st)) return {ok:false,err:st.cfg.mods.swaps===false?'Swaps are off in this game':'Swaps need at least 7 tiles in the bag'};
    const ts=mv.tiles||[]; if(!ts.length||ts.length>RACK) return {ok:false,err:'Choose tiles to swap'};
    const need=rack.slice(); for(const t of ts){ const k=need.indexOf(t); if(k<0) return {ok:false,err:'Those tiles aren\'t on the rack'}; need.splice(k,1); }
    st.racks[p]=need; draw(st,p);
    // returned tiles go back into the bag at seeded positions, so a replay rebuilds the same bag
    const rng=seedRng('TCG1|swap|'+st.cfg.bagSeed+'|'+st.moves.length);
    for(const t of ts) st.bag.splice(Math.floor(rng()*(st.bag.length+1)),0,t);
    st.scoreless++; rec={p,t:'x',tiles:ts.slice(),sc:0}; st.moves.push(rec); endCheck(st); return {ok:true,rec,score:0}; }
  st.scoreless++; rec={p,t:'-',sc:0}; if(mv.why) rec.why=mv.why; st.moves.push(rec); endCheck(st); return {ok:true,rec,score:0}; }
function endCheck(st){ const np=st.racks.length, last=st.moves[st.moves.length-1], p=last.p;
  let end=false, out=-1;
  if(!st.bag.length&&!st.racks[p].length){ end=true; out=p; }
  if(st.scoreless>=SCORELESS_END) end=true;
  if(st.cfg.solo&&st.cfg.turns&&st.moves.length>=st.cfg.turns) end=true;
  if(!end){ st.turn=(p+1)%np; return; }
  st.over=true; const adj=new Array(np).fill(0);
  if(!st.cfg.solo){ let gain=0; for(let q=0;q<np;q++){ const s=rackSum(st.racks[q]); if(q!==out){ adj[q]-=s; gain+=s; } } if(out>=0) adj[out]+=gain; }
  const final=st.scores.map((s,q)=>s+adj[q]);
  let winner=-1; if(np>1){ const best=Math.max(...final), at=final.map((s,q)=>s===best?q:-1).filter(q=>q>=0); winner=at.length===1?at[0]:-1; }
  st.result={adj,final,winner,out,reason:out>=0?'out':st.scoreless>=SCORELESS_END?'scoreless':'turns'}; }
// per-player summary of a finished (or running) game, for results, records and achievements
function gameStats(st,p){ const o={best:null,longest:'',fullRacks:0,words:0,rare:new Set(),wordSq2:false,swaps:0,plays:0,bestWord:null};
  for(const m of st.moves){ if(m.p!==p) continue; if(m.t==='x') o.swaps++; if(m.t!=='p') continue; o.plays++;
    if(!o.best||m.sc>o.best.sc) o.best={sc:m.sc,w:m.w}; o.fullRacks+=m.full; if(m.wsq>=2) o.wordSq2=true;
    for(const w of [m.w,...m.ws]){ o.words++; if(w.length>o.longest.length) o.longest=w; }
    for(const t of m.tiles) if(!t[2]&&'QZXJ'.includes(t[1])) o.rare.add(t[1]); }
  o.bestWord=o.best?o.best.w:''; o.rare=[...o.rare].sort().join(''); return o; }

// ---------- move generator (Appel & Jacobson, anchor-based search over the DAWG) ----------
// A generator function: it yields between units of work, so the interface can run it in ~8 ms slices per frame.
// Moves: {s: cell where the main word starts, d: 0 across / 1 down, w: main word, m: bitmask of the word's letters
// that are placed tiles, b: bitmask of placed blanks, sc: score, n: tiles placed}.
const ALL26=(1<<26)-1, BOTH=[0,1], REAL=[0], BL=[1], NONE=[];
// A generated move keeps its word packed into two numbers (5 bits a letter); the string is built only when asked for.
class Move{ constructor(s,d,m,b,sc,n,len,p1,p2){ this.s=s; this.d=d; this.m=m; this.b=b; this.sc=sc; this.n=n; this.len=len; this.p1=p1; this.p2=p2; this._w=null; }
  get w(){ if(this._w===null){ let w=''; for(let k=0;k<this.len;k++) w+=ALPHA[k<10?Math.floor(this.p1/Math.pow(32,9-k))%32:Math.floor(this.p2/Math.pow(32,this.len-1-k))%32]; this._w=w; } return this._w; } }
const mkMove=o=>{ const m=new Move(o.s,o.d,o.m,o.b||0,o.sc||0,o.n||0,o.w.length,0,0); m._w=o.w; return m; };
function crossChecks(B,Lg,Vg,d,maxLen){ const n=B.n, N=B.N, cc=new Int32Array(N), cs=new Int16Array(N).fill(-1), D=DAWG||dawg();
  const ps=d?1:n; // perpendicular step: across words are crossed by down words
  for(let i=0;i<N;i++){ if(Lg[i]>=0||!B.mask[i]) continue; const x=i%n, y=(i/n)|0;
    const ok=d?(j=>j>=0&&j<N&&((j/n)|0)===y):(j=>j>=0&&j<N);
    let a=i, pre=[]; while(ok(a-ps)&&Lg[a-ps]>=0){ a-=ps; pre.unshift(a); }
    let b=i, suf=[]; while(ok(b+ps)&&Lg[b+ps]>=0){ b+=ps; suf.push(b); }
    if(!pre.length&&!suf.length){ cc[i]=ALL26; continue; }
    let sc=0; for(const j of pre) sc+=Vg[j]; for(const j of suf) sc+=Vg[j]; cs[i]=sc;
    if(maxLen&&pre.length+1+suf.length>maxLen){ cc[i]=0; continue; }
    let node=D.root; for(const j of pre){ const e=dEdge(node,Lg[j]); if(e<0){ node=-1; break; } node=D.C[e]; }
    if(node<=0){ cc[i]=0; continue; }
    let m=0; for(let e=node;;e++){ const l=D.L[e]; if(!suf.length){ if(D.F[e]&1) m|=1<<l; }
      else { let nd=D.C[e], fin=0, good=true; for(const j of suf){ const f=dEdge(nd,Lg[j]); if(f<0){ good=false; break; } nd=D.C[f]; fin=D.F[f]&1; } if(good&&fin) m|=1<<l; }
      if(D.F[e]&2) break; }
    cc[i]=m; }
  return {cc,cs}; }
function* moveGen(st,rack,opt){ opt=opt||{};
  const B=boardOf(st.cfg), n=B.n, N=B.N, D=DAWG||dawg(), cells=st.cells, mods=st.cfg.mods;
  const minLen=Math.max(2,mods.minLen||2), maxLen=mods.maxLen||0, played=mods.norepeat?new Set(st.played):null;
  const Lg=new Int8Array(N).fill(-1), Vg=new Int8Array(N); let empty=true;
  for(let i=0;i<N;i++) if(cells[i]){ empty=false; const ch=cells[i]; Lg[i]=ch.toUpperCase().charCodeAt(0)-65; Vg[i]=valOf(ch); }
  const cnt=new Int8Array(27); for(const t of rack) cnt[t===BLANK?26:t.charCodeAt(0)-65]++;
  const out=[], wl=new Int8Array(24), wp=new Uint8Array(24), wb=new Uint8Array(24), prem=B.prem, mask=B.mask;
  let d=0, line=0, sPos=0, aPos=0, wlen=0, np=0, cc=null, cs=null, at=null;
  const record=()=>{ if(!np||wlen<minLen||(maxLen&&wlen>maxLen)) return;
    let sum=0, wm=1, cross=0, m=0, b=0, p1=0, p2=0;
    for(let k=0;k<wlen;k++){ const i=at(sPos+k), l=wl[k]; if(k<10) p1=p1*32+l; else p2=p2*32+l;
      if(wp[k]){ const v=wb[k]?0:VAL[l], p=prem[i]; sum+=v*LM[p]; wm*=WM[p]; if(cs[i]>=0) cross+=(cs[i]+v*LM[p])*WM[p]; m|=1<<k; if(wb[k]) b|=1<<k;
        if(np===1&&d===1){ const x=i%n; if((x>0&&Lg[i-1]>=0)||(x<n-1&&Lg[i+1]>=0)) return; } } // a single tile with an across word is found across
      else sum+=Vg[i]; }
    if(wlen<10) p1*=Math.pow(32,10-wlen);
    const mv=new Move(at(sPos),d,m,b,sum*wm+cross+(np===RACK?FULL_RACK:0),np,wlen,p1,p2);
    if(played&&played.has(mv.w)) return;
    out.push(mv); };
  const ext=(node,fin,pos)=>{ const inb=pos<n&&mask[at(pos)], i=inb?at(pos):-1;
    if(inb&&Lg[i]>=0){ const e=dEdge(node,Lg[i]); if(e<0) return; wl[wlen]=Lg[i]; wp[wlen]=0; wb[wlen]=0; wlen++; ext(D.C[e],D.F[e]&1,pos+1); wlen--; return; }
    if(fin&&pos>aPos) record();
    if(!inb||!node||wlen>=DICT_MAXLEN) return; const chk=cc[i]; if(!chk) return;
    for(let e=node;;e++){ const l=D.L[e];
      if((chk>>l)&1){ wl[wlen]=l; wp[wlen]=1; wlen++; np++;
        if(cnt[l]>0){ cnt[l]--; wb[wlen-1]=0; ext(D.C[e],D.F[e]&1,pos+1); cnt[l]++; }
        if(cnt[26]>0){ cnt[26]--; wb[wlen-1]=1; ext(D.C[e],D.F[e]&1,pos+1); cnt[26]++; }
        wlen--; np--; }
      if(D.F[e]&2) break; } };
  // The anchor square is tried one letter at a time, and the left parts are a generator: the units of work between
  // yields stay small (well under a millisecond on a desktop), so the interface can keep each slice short.
  let work=0;
  const one=(e,l,src)=>{ cnt[src]--; wl[wlen]=l; wp[wlen]=1; wb[wlen]=src===26?1:0; wlen++; np++; const r0=out.length;
    ext(D.C[e],D.F[e]&1,aPos+1); wlen--; np--; cnt[src]++; work+=2+out.length-r0; };
  const throughP=node=>{ const chk=cc[at(aPos)]; if(!chk||!node) return;
    for(let e=node;;e++){ const l=D.L[e]; if((chk>>l)&1){ if(cnt[l]>0) one(e,l,l); if(cnt[26]>0) one(e,l,26); } if(D.F[e]&2) break; } };
  function* through(node){ const chk=cc[at(aPos)]; if(!chk||!node) return;
    for(let e=node;;e++){ const l=D.L[e];
      if((chk>>l)&1){ if(cnt[l]>0) one(e,l,l); if(cnt[26]>0) one(e,l,26); if(opt.slice&&work>300){ work=0; yield 0; } }
      if(D.F[e]&2) break; } }
  const leftP=(node,k,limit)=>{ sPos=aPos-k; throughP(node); if(k>=limit||!node) return;
    for(let e=node;;e++){ const l=D.L[e]; wl[wlen]=l; wp[wlen]=1; wlen++; np++;
      if(cnt[l]>0){ cnt[l]--; wb[wlen-1]=0; leftP(D.C[e],k+1,limit); cnt[l]++; }
      if(cnt[26]>0){ cnt[26]--; wb[wlen-1]=1; leftP(D.C[e],k+1,limit); cnt[26]++; }
      wlen--; np--; if(D.F[e]&2) break; } };
  // the first two left letters are a generator (so it can pause between them); deeper left parts are plain recursion
  function* left(node,k,limit){ sPos=aPos-k; yield* through(node); if(k>=limit||!node) return;
    for(let e=node;;e++){ const l=D.L[e]; wl[wlen]=l; wp[wlen]=1; wlen++; np++;
      for(const src of (cnt[l]>0?(cnt[26]>0?BOTH:REAL):(cnt[26]>0?BL:NONE))){ const c=src?26:l; cnt[c]--; wb[wlen-1]=src;
        if(k+1<3) yield* left(D.C[e],k+1,limit); else { leftP(D.C[e],k+1,limit); sPos=aPos-k; work+=1; if(opt.slice&&work>300){ work=0; yield 0; } }
        cnt[c]++; }
      wlen--; np--; if(D.F[e]&2) break; } }
  const tiles=rack.length;
  for(d=0;d<2;d++){ ({cc,cs}=crossChecks(B,Lg,Vg,d,maxLen));
    const isAnchor=new Uint8Array(N), adj=new Uint8Array(N); // adj: an empty square next to a tile (never part of a left part)
    for(let i=0;i<N;i++){ if(Lg[i]>=0||!mask[i]) continue; const x=i%n, y=(i/n)|0;
      adj[i]=empty?(i===B.start?1:0):(x>0&&Lg[i-1]>=0)||(x<n-1&&Lg[i+1]>=0)||(y>0&&Lg[i-n]>=0)||(y<n-1&&Lg[i+n]>=0)?1:0;
      isAnchor[i]=adj[i]&&cc[i]?1:0; }
    for(line=0;line<n;line++){ at=d?(p=>p*n+line):(p=>line*n+p);
      for(let p=0;p<n;p++){ const i=at(p); if(!isAnchor[i]) continue; aPos=p; wlen=0; np=0;
        if(p>0&&Lg[at(p-1)]>=0){ let s=p-1; while(s>0&&Lg[at(s-1)]>=0) s--; let node=D.root;
          for(let q=s;q<p;q++){ const e=dEdge(node,Lg[at(q)]); if(e<0){ node=0; break; } node=D.C[e]; wl[wlen]=Lg[at(q)]; wp[wlen]=0; wb[wlen]=0; wlen++; }
          if(node){ sPos=s; yield* through(node); } }
        else { let limit=0; for(let q=p-1;q>=0;q--){ const j=at(q); if(!mask[j]||Lg[j]>=0||adj[j]) break; limit++; }
          yield* left(D.root,0,Math.min(limit,tiles-1)); }
        work+=4; if(opt.slice&&work>300){ work=0; yield 0; } } } }
  return out; }
function runGen(g){ let r; do r=g.next(); while(!r.done); return r.value; }
const allMoves=(st,rack,o)=>runGen(moveGen(st,rack,o));
// turn a generated move into the tiles applyMove takes
function moveTiles(st,mv){ const n=boardOf(st.cfg).n, step=mv.d?n:1, t=[];
  for(let k=0;k<mv.w.length;k++) if((mv.m>>k)&1) t.push([mv.s+k*step,mv.w[k],(mv.b>>k)&1]); return t; }
const moveKey=mv=>mv.s+'|'+mv.d+'|'+mv.w+'|'+mv.m+'|'+mv.b;
const tieCmp=(a,b)=>a.s-b.s||a.d-b.d||a.p1-b.p1||a.p2-b.p2||a.m-b.m||a.b-b.b;

// ---------- the computer opponent ----------
// Leave values: what the tiles kept are worth on later turns, from self-play (node tests/sim.js leave 2000): a ridge
// regression of the next turn's best score on the tiles kept (32,842 turns of Hard vs Hard on Medium), centred on the
// average tile in the bag, plus a duplicate penalty and vowel-balance terms. Centred beat the raw fit against Hard.
const LEAVE={A:0.9,B:-1.4,C:-1.4,D:-0.2,E:0.8,F:-0.3,G:-0.9,H:-0.9,I:-0.8,J:-0.6,K:-2.5,L:-0.7,M:1.4,N:-1.1,O:-0.9,P:-0.9,Q:-4.9,R:-0.9,S:2.8,T:-0.9,U:-0.6,V:-1.7,W:0.4,X:0.7,Y:0.8,Z:-0.2,'?':13.0};
const LEAVE_DUP=-4.3, LEAVE_VOWEL=[-3.3,0.3,0.0,0.0,-1.8,-2.4,-5.1]; // by round(6 × vowels ÷ tiles kept), for 3+ tiles
function leaveValue(tiles){ if(!tiles.length) return 0; let v=0, vow=0; const seen={};
  for(const t of tiles){ v+=LEAVE[t]; if(seen[t]) v+=LEAVE_DUP; seen[t]=(seen[t]||0)+1; if('AEIOU'.includes(t)) vow++; }
  if(tiles.length>=3) v+=LEAVE_VOWEL[Math.round(vow*6/tiles.length)]||0; return v; }
function leaveAfter(rack,mv){ const r=rack.slice(); for(let k=0;k<mv.w.length;k++) if((mv.m>>k)&1){ const t=(mv.b>>k)&1?BLANK:mv.w[k], j=r.indexOf(t); if(j>=0) r.splice(j,1); } return r; }
// the tiles to keep when swapping: the subset with the best leave (blanks and S stay, clunky letters go)
function bestSwap(rack){ let best=null, bv=-1e9; const n=rack.length;
  for(let m=0;m<(1<<n)-1;m++){ const keep=[], give=[]; for(let k=0;k<n;k++) ((m>>k)&1?keep:give).push(rack[k]); const v=leaveValue(keep);
    if(v>bv||(v===bv&&best&&give.join('')<best.join(''))){ bv=v; best=give; } }
  return {tiles:best,value:bv}; }
const AI_IDS=['easy','normal','hard','expert'], AI_NAMES={easy:'Easy',normal:'Normal',hard:'Hard',expert:'Expert'};
const sortMoves=ms=>ms.sort((a,b)=>b.sc-a.sc||tieCmp(a,b));
const pick=(ms,rng)=>ms[Math.floor(rng()*ms.length)];
// Choose a move for player p from the list of every legal move. Only p's rack, the board and the unseen pool are used.
function aiChoose(st,p,level,moves){ const rack=st.racks[p], rng=seedRng('TCAI1|'+st.cfg.bagSeed+'|'+st.moves.length+'|'+p+'|'+level);
  const swap=()=>canSwap(st)?{t:'x',tiles:bestSwap(rack).tiles}:{t:'-'};
  if(!moves.length) return swap();
  const asc=moves.slice().sort((a,b)=>a.sc-b.sc||tieCmp(a,b));
  const band=(ms,lo,hi)=>{ const a=Math.floor(lo*ms.length), b=Math.max(a+1,Math.floor(hi*ms.length)); return ms.slice(a,b); };
  const play=mv=>({t:'p',tiles:moveTiles(st,mv),mv});
  if(level==='easy'){ const short=asc.filter(m=>m.len<=5); if(!short.some(m=>m.sc>=6)&&canSwap(st)) return swap();
    const ms=short.length?short:asc; return play(pick(band(ms,.3,.6),rng)); }
  if(level==='normal') return play(pick(band(asc,.6,.85),rng));
  const top=sortMoves(moves.slice());
  if(level==='hard') return play(rng()<.8?top[0]:pick(top.slice(0,3),rng));
  const e=expertChoice(st,p,top); return e.swap?swap():play(e); }
function expertChoice(st,p,top){ const rack=st.racks[p], other=st.racks.length>1&&!st.cfg.solo;
  const bagN=st.bag.length;
  // endgame: with the bag empty the other rack is exactly the unseen tiles, so look one reply ahead and block
  if(other&&!bagN){ const opp=unseen(st,p), oppSum=rackSum(opp); let best=null, bv=-1e9;
    for(const mv of top.slice(0,10)){ const left=leaveAfter(rack,mv), sim=cloneState(st); for(const [i,ch,bl] of moveTiles(st,mv)) sim.cells[i]=bl?ch.toLowerCase():ch;
      let v; if(!left.length) v=mv.sc+2*oppSum; else { const rep=allMoves(sim,opp); let r=0; for(const m of rep) if(m.sc>r) r=m.sc; v=mv.sc-r-2*rackSum(left); }
      if(v>bv){ bv=v; best=mv; } }
    return best; }
  let best=null, bv=-1e9; const floor=top[0].sc-45;
  for(const mv of top){ if(mv.sc<floor) break; const v=mv.sc+(bagN?leaveValue(leaveAfter(rack,mv)):-rackSum(leaveAfter(rack,mv))); if(v>bv){ bv=v; best=mv; } }
  // late game, bag nearly out: avoid opening a 3× Word lane for the reply
  if(other&&bagN&&bagN<=RACK){ const B=boardOf(st.cfg); let bb=null, bbv=-1e9;
    for(const mv of top.slice(0,8)){ const v=mv.sc+leaveValue(leaveAfter(rack,mv))-6*opensTW(st,B,mv); if(v>bbv){ bbv=v; bb=mv; } } if(bbv>bv-4) best=bb; }
  // a weak rack with no worthwhile play: swap, keeping the best tiles
  if(canSwap(st)&&best.sc<18){ const sw=bestSwap(rack); if(sw.value-3>bv) return {swap:true}; }
  return best; }
// how many empty 3× Word squares a move leaves reachable (next to a tile, on an open line)
function opensTW(st,B,mv){ const c=st.cells.slice(), n=B.n; for(const [i,ch] of moveTiles(st,mv)) c[i]=ch; let k=0;
  for(let i=0;i<B.N;i++){ if(B.prem[i]!==4||c[i]) continue; const x=i%n, y=(i/n)|0; if((x>0&&c[i-1])||(x<n-1&&c[i+1])||(y>0&&c[i-n])||(y<n-1&&c[i+n])) k++; }
  let k0=0; for(let i=0;i<B.N;i++){ if(B.prem[i]!==4||st.cells[i]) continue; const x=i%n, y=(i/n)|0, s=st.cells; if((x>0&&s[i-1])||(x<n-1&&s[i+1])||(y>0&&s[i-n])||(y<n-1&&s[i+n])) k0++; }
  return Math.max(0,k-k0); }
// a full computer turn, synchronously (tests, sims and the solver)
function aiTurn(st,level){ const p=st.turn, mv=aiChoose(st,p,level,allMoves(st,st.racks[p])); return applyMove(st,mv.t==='p'?{t:'p',tiles:mv.tiles}:mv); }
// a hint: a good move, picked from the top 5 by score (not always the best)
function hintFrom(st,moves,salt){ if(!moves.length) return null; const top=sortMoves(moves.slice()).slice(0,5); return top[Math.floor(seedRng('TCH1|'+st.cfg.bagSeed+'|'+st.moves.length+'|'+salt)()*top.length)]; }

// ---------- Daily ----------
// TCD1|YYYY-MM-DD makes the board (Medium, generated premiums) and the whole bag order. Solo, 10 turns.
const DAILY_TURNS=10;
function dailyCfg(date){ const r=seedRng('TCD1|'+date), bs=Math.floor(r()*4294967296)>>>0, gs=Math.floor(r()*4294967296)>>>0;
  return {size:'medium',shape:'square',boardSeed:bs,bagSeed:gs,mods:Object.assign({},DEF_MODS),players:[{name:'You',ai:null}],solo:true,turns:DAILY_TURNS,first:0}; }
// Par: the solver plays the same 10 turns with the Expert's choices (best score + leave each turn)
function* parGen(cfg){ const st=newGame(cfg); while(!st.over){ const moves=yield* moveGen(st,st.racks[0],{slice:true}); const mv=aiChoose(st,0,'expert',moves); applyMove(st,mv.t==='p'?{t:'p',tiles:mv.tiles}:mv); yield 0; } return st.scores[0]; }
const dailyPar=date=>runGen(parGen(dailyCfg(date)));
const parStars=(score,par)=>score>=par?3:score>=Math.ceil(par*.85)?2:score>=Math.ceil(par*.6)?1:0;
function gameFingerprint(st){ let h=2166136261; const add=s=>{ for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } };
  const B=boardOf(st.cfg); add(Array.from(B.prem).join('')); add(Array.from(B.mask).join('')); add(st.bag.join('')); add(st.racks.map(r=>r.join('')).join('|')); return (h>>>0).toString(16).padStart(8,'0'); }

// ---------- 2-Player share codes ----------
// TCF1.<base64url>: version, a random 6-byte game id, the rules (board size, shape, board seed, bag seed, modifiers),
// both names and the full move list. Every device rebuilds the game by replaying every move from the seeds, so a missed
// or repeated code can't break it. A 16-bit checksum catches damaged codes; replay catches impossible moves.
const B64U='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const toB64U=b=>{ let s=''; for(let i=0;i<b.length;i+=3){ const n=(b[i]<<16)|((b[i+1]||0)<<8)|(b[i+2]||0);
  s+=B64U[n>>18&63]+B64U[n>>12&63]+(i+1<b.length?B64U[n>>6&63]:'')+(i+2<b.length?B64U[n&63]:''); } return s; };
const fromB64U=s=>{ const out=[]; let buf=0,bits=0; for(const ch of s){ const v=B64U.indexOf(ch); if(v<0) throw new Error('char'); buf=(buf<<6)|v; bits+=6; if(bits>=8){ bits-=8; out.push((buf>>bits)&255); } } return Uint8Array.from(out); };
const cleanName=t=>[...String(t||'').replace(/[\u0000-\u001f\u007f<>&"'`]/g,'')].slice(0,16).join('').trim();
function bitW(){ const b=[]; let cur=0, n=0; return {put(v,bits){ for(let k=bits-1;k>=0;k--){ cur=(cur<<1)|((v>>k)&1); if(++n===8){ b.push(cur); cur=0; n=0; } } }, bytes(){ return n?b.concat([cur<<(8-n)]):b; }}; }
function bitR(b,p){ let bi=p*8; return {get(bits){ let v=0; for(let k=0;k<bits;k++){ const by=b[bi>>3]; if(by===undefined) throw new Error('short'); v=(v<<1)|((by>>(7-(bi&7)))&1); bi++; } return v; }}; }
const fnv16=b=>{ let h=2166136261; for(const v of b){ h^=v; h=Math.imul(h,16777619); } return (h^(h>>>16))&0xffff; };
function encodeGame(g){ // g: {id:[6 bytes], cfg, names:[a,b], moves}
  const c=g.cfg, m=c.mods, b=[1,...g.id];
  b.push(SIZE_IDS.indexOf(c.size)|(SHAPE_IDS.indexOf(c.shape)<<2)|(m.norepeat?16:0)|(m.swaps===false?32:0)|(m.rare?64:0));
  b.push(((m.minLen||2)-2)|(Math.max(0,MAXLEN_OPTS.indexOf(m.maxLen||0))<<2)|(Math.max(0,BLANK_OPTS.indexOf(m.blanks==null?null:m.blanks))<<4));
  for(const s of [c.boardSeed,c.bagSeed]) b.push(s>>>24&255,s>>>16&255,s>>>8&255,s&255);
  for(const nm of g.names){ const u=new TextEncoder().encode(cleanName(nm)); b.push(u.length,...u); }
  const w=bitW(), N=SIZES[c.size].n**2; w.put(g.moves.length,10);
  for(const mv of g.moves){ if(mv.t==='p'){ const t=mv.tiles.slice().sort((a,b)=>a[0]-b[0]), n=SIZES[c.size].n, d=t.length>1&&(t[1][0]-t[0][0])%n===0&&t[1][0]-t[0][0]>=n?1:0;
      w.put(0,2); w.put(d,1); w.put(t[0][0],9); w.put(t.length-1,3); for(const [,ch,bl] of t){ w.put(ch.charCodeAt(0)-65,5); w.put(bl?1:0,1); } }
    else if(mv.t==='x'){ w.put(1,2); w.put(mv.tiles.length-1,3); for(const ch of mv.tiles) w.put(ch===BLANK?26:ch.charCodeAt(0)-65,5); }
    else w.put(2,2); }
  b.push(...w.bytes()); const ck=fnv16(b); b.push(ck>>8,ck&255);
  return 'TCF1.'+toB64U(Uint8Array.from(b)); }
const findCode=text=>{ const m=String(text||'').match(/TCF1\.([A-Za-z0-9_-]{20,})/); return m?m[0]:null; };
function decodeGame(text){ const code=findCode(text); if(!code) throw new Error('nocode');
  const all=fromB64U(code.slice(5)); if(all.length<24) throw new Error('short');
  const b=all.slice(0,-2); if(fnv16(b)!==((all[all.length-2]<<8)|all[all.length-1])) throw new Error('checksum');
  let p=0; if(b[p++]!==1) throw new Error('version');
  const id=[...b.slice(p,p+6)]; p+=6; const f1=b[p++], f2=b[p++];
  const size=SIZE_IDS[f1&3], shape=SHAPE_IDS[(f1>>2)&3]; if(!size||!shape) throw new Error('rules');
  const mods=Object.assign({},DEF_MODS,{norepeat:!!(f1&16),swaps:!(f1&32),rare:!!(f1&64),minLen:(f2&3)+2,maxLen:MAXLEN_OPTS[(f2>>2)&3],blanks:BLANK_OPTS[(f2>>4)&3]});
  const seed=()=>((b[p++]<<24)|(b[p++]<<16)|(b[p++]<<8)|b[p++])>>>0, boardSeed=seed(), bagSeed=seed();
  const names=[]; for(let k=0;k<2;k++){ const l=b[p++]; if(l===undefined||l>64) throw new Error('names'); names.push(cleanName(new TextDecoder().decode(b.slice(p,p+l)))); p+=l; }
  const r=bitR(b,p), n=SIZES[size].n, count=r.get(10), moves=[];
  for(let k=0;k<count;k++){ const t=r.get(2);
    if(t===0){ const d=r.get(1), s=r.get(9), cnt=r.get(3)+1, tiles=[]; if(s>=n*n) throw new Error('move');
      let i=s; for(let j=0;j<cnt;j++){ const l=r.get(5), bl=r.get(1); if(l>25) throw new Error('move'); tiles.push([i,ALPHA[l],bl]); i+=d?n:1; }
      moves.push({t:'p',d,s,tiles}); }
    else if(t===1){ const cnt=r.get(3)+1, tiles=[]; for(let j=0;j<cnt;j++){ const l=r.get(5); if(l>26) throw new Error('move'); tiles.push(l===26?BLANK:ALPHA[l]); } moves.push({t:'x',tiles}); }
    else if(t===2) moves.push({t:'-'}); else throw new Error('move'); }
  return {id:id.map(v=>v.toString(16).padStart(2,'0')).join(''),idBytes:id,cfg:twoPlayerCfg({size,shape,boardSeed,bagSeed,mods},names),names,moves}; }
function twoPlayerCfg(c,names){ return normCfg({size:c.size,shape:c.shape,boardSeed:c.boardSeed,bagSeed:c.bagSeed,mods:Object.assign({},c.mods,{timer:0}),
  players:[{name:names[0]||'Player 1',ai:null},{name:names[1]||'Player 2',ai:null}],solo:false,first:0}); }
// Rebuild a game from its moves. A play's tiles in a code are laid along the line skipping occupied squares.
function replay(cfg,moves){ const st=newGame(cfg), n=boardOf(cfg).n;
  for(let k=0;k<moves.length;k++){ const mv=moves[k]; let m=mv;
    if(mv.t==='p'&&mv.s!==undefined){ const tiles=[]; let i=mv.s; for(const [,ch,bl] of mv.tiles){ while(i<st.cells.length&&st.cells[i]) i+=mv.d?n:1; tiles.push([i,ch,bl]); i+=mv.d?n:1; } m={t:'p',tiles}; }
    const r=applyMove(st,m); if(!r.ok) throw new Error('invalid move '+(k+1)); }
  return st; }
// the moves of a live game in code form (a play keeps its tiles; encodeGame works out start and direction)
const codeMoves=st=>st.moves.map(m=>m.t==='p'?{t:'p',tiles:m.tiles}:m.t==='x'?{t:'x',tiles:m.tiles}:{t:'-'});
// Check a pasted code against this device's copy of the game. me: the local player's seat (0 or 1), or null for a new game.
function importCheck(text,local){ let g; try{ g=decodeGame(text); }catch(e){ return {ok:false,why:e.message==='nocode'?'nocode':'bad'}; }
  if(local&&local.deleted&&local.deleted.includes(g.id)) return {ok:false,why:'deleted',g};
  const have=local&&local.games?local.games.find(x=>x.id===g.id):null;
  let st; try{ st=replay(g.cfg,g.moves); }catch(e){ return {ok:false,why:'invalid',g}; }
  const me=have?have.me:1;
  if(have&&g.moves.length<=have.n) return {ok:false,why:g.moves.length<have.n?'older':'same',g};
  if(!st.over&&st.turn!==me) return {ok:false,why:'notyours',g};
  if(!have&&!g.moves.length) return {ok:false,why:'notyours',g};
  return {ok:true,g,st,me,isNew:!have}; }

if(typeof module!=='undefined') module.exports={};
