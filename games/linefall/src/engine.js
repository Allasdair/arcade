// ===================== Linefall engine =====================
// Pure: no DOM, no timers. step(st, inputs) advances one logic tick at 60 Hz. The same seed and input stream
// always give the same game, which the tests and bots rely on. All state is plain JSON (saves and resumes exactly).
const LF_HIDDEN=2, LF_HZ=60, G_ONE=65536, G_CAP=20*65536;
const LOCK_T=30, MAX_RESETS=15, ARE_T=6, CLEAR_T=18, CLEAR_FAST=12, GARB_T=600, FADE_T=300, FLASH_T=30;
const BOARDS={
  small:{id:'small',name:'Small',w:8,h:16,wf:0.9},
  medium:{id:'medium',name:'Medium',w:11,h:22,wf:1},
  large:{id:'large',name:'Large',w:14,h:24,wf:1.15}};
const BOARD_IDS=['small','medium','large'];
const SPEEDS={'1':{id:'1',name:'1×',g:1,m:1},'1.5':{id:'1.5',name:'1.5×',g:1.5,m:1.25},'2':{id:'2',name:'2×',g:2,m:1.5}};
const SPEED_IDS=['1','1.5','2'];
// Gravity in 1/65536 rows per tick, levels 1-30: seconds per row = (0.8-(L-1)*0.007)^(L-1). Stored as integers so
// every browser computes the identical game (Math.pow isn't guaranteed bit-identical across engines).
const GRAV=[1092,1377,1768,2311,3075,4169,5759,8107,11634,17026,25416,38709,60169,95483,154742,256187,433425,749597,1325716,2398490,
  4440685,8416894,16338541,32494431,66239768,138461250,296912395,653455479,1476707222,3428254680];
const gravOf=(level,speed)=>Math.min(G_CAP,Math.round(GRAV[Math.min(30,Math.max(1,level))-1]*SPEEDS[speed].g));

// ---------- pieces ----------
// Box pieces rotate inside an n×n box: clockwise (x,y)->(n-1-y,x) in screen coordinates (y down).
// The 3- and 5-block pieces rotate about their centre cell (0,0): clockwise (x,y)->(-y,x).
const boxStates=(n,c)=>{ const s=[c]; for(let r=1;r<4;r++) s.push(s[r-1].map(([x,y])=>[n-1-y,x])); return s; };
const genStates=c=>{ const s=[c]; for(let r=1;r<4;r++) s.push(s[r-1].map(([x,y])=>[-y,x])); return s; };
const PIECES={
  I:{st:boxStates(4,[[0,1],[1,1],[2,1],[3,1]]),kick:'I',n:4},
  O:{st:[0,1,2,3].map(()=>[[0,0],[1,0],[0,1],[1,1]]),kick:'O',n:2},
  T:{st:boxStates(3,[[1,0],[0,1],[1,1],[2,1]]),kick:'S',n:3},
  S:{st:boxStates(3,[[1,0],[2,0],[0,1],[1,1]]),kick:'S',n:3},
  Z:{st:boxStates(3,[[0,0],[1,0],[1,1],[2,1]]),kick:'S',n:3},
  J:{st:boxStates(3,[[0,0],[0,1],[1,1],[2,1]]),kick:'S',n:3},
  L:{st:boxStates(3,[[2,0],[0,1],[1,1],[2,1]]),kick:'S',n:3},
  I3:{st:genStates([[-1,0],[0,0],[1,0]]),kick:'G'},
  L3:{st:genStates([[0,-1],[0,0],[1,0]]),kick:'G'},
  I5:{st:genStates([[-2,0],[-1,0],[0,0],[1,0],[2,0]]),kick:'G'},
  L5:{st:genStates([[-2,0],[-1,0],[0,0],[1,0],[1,-1]]),kick:'G'},
  P:{st:genStates([[0,-1],[0,0],[1,0],[0,1],[1,1]]),kick:'G'},
  T5:{st:genStates([[-1,-1],[0,-1],[1,-1],[0,0],[0,1]]),kick:'G'},
  U:{st:genStates([[-1,-1],[-1,0],[0,0],[1,0],[1,-1]]),kick:'G'}};
const STD7=['I','O','T','S','Z','J','L'], P3=['I3','L3'], P5=['I5','L5','P','T5','U'];
for(const k in PIECES){ const p=PIECES[k]; p.id=k; p.size=p.st[0].length;
  p.bb=p.st.map(c=>{ const xs=c.map(v=>v[0]), ys=c.map(v=>v[1]); return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)}; }); }
const SETS={
  classic:{id:'classic',name:'Classic',m:1,base:STD7},
  kind:{id:'kind',name:'Kind',m:0.8,base:['I','O','T','J','L']},
  junior:{id:'junior',name:'Junior',m:0.75,base:[...STD7,...P3]},
  pentomix:{id:'pentomix',name:'Pentomix',m:1.2,base:STD7,p5:1},
  chaos:{id:'chaos',name:'Chaos',m:1.3,base:STD7,p3:1,p5:1}};
const SET_IDS=['classic','kind','junior','pentomix','chaos'];

// Kick tables, converted to y-down (a table's +y "up" becomes -1 here). Key: from-state + to-state.
const yd=t=>{ const o={}; for(const k in t) o[k]=t[k].map(([x,y])=>[x,-y]); return o; };
const KICK_S=yd({'01':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'10':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '12':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'21':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '23':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],'32':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '30':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'03':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '02':[[0,0]],'20':[[0,0]],'13':[[0,0]],'31':[[0,0]]});
const KICK_I=yd({'01':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'10':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  '12':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],'21':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  '23':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'32':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '30':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'03':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  '02':[[0,0]],'20':[[0,0]],'13':[[0,0]],'31':[[0,0]]});
const KICK_G=[[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,-1],[-2,0],[2,0]]; // clockwise; mirrored in x for counter-clockwise
function kicksFor(t,from,to,dir){ const k=PIECES[t].kick;
  if(k==='O') return [[0,0]];
  if(k==='G') return dir>0?KICK_G:KICK_G.map(([x,y])=>[-x,y]);
  return (k==='I'?KICK_I:KICK_S)[''+from+to]; }

// ---------- seeded RNG: cyrb128 -> sfc32 (as in Sweep's League), state kept as plain numbers ----------
function rngFrom(str){
  let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0;i<str.length;i++){ const k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044813); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044813);
  const R={a:(h1^h2^h3^h4)>>>0,b:(h2^h1)>>>0,c:(h3^h1)>>>0,d:(h4^h1)>>>0}; for(let i=0;i<15;i++) rnd(R); return R; }
function rnd(R){ let a=R.a>>>0,b=R.b>>>0,c=R.c>>>0,d=R.d>>>0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0;
  R.a=a>>>0; R.b=b>>>0; R.c=c>>>0; R.d=d>>>0; return (t>>>0)/4294967296; }
const rint=(R,n)=>Math.floor(rnd(R)*n);
function shuffle(a,R){ for(let i=a.length-1;i>0;i--){ const j=rint(R,i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const randSeed=()=>'LF'+Date.now().toString(36)+Math.floor(Math.random()*1e9).toString(36);
function fnv(arr){ let h=2166136261; for(const v of arr){ h^=v&255; h=Math.imul(h,16777619); h^=(v>>>8)&255; h=Math.imul(h,16777619); } return (h>>>0).toString(16).padStart(8,'0'); }

// ---------- game config ----------
const DEF_CFG={board:'medium',speed:'1',set:'classic',hold:true,next:5,ghost:true,garbage:false,fading:false,startLevel:1,
  das:160,arr:33,sdf:20,fast:false,goal:{type:'endless'},seed:'',fixed:null,prefill:null};
// Score multiplier for a setup (first estimates; tune with the bot sims)
function scoreMult(c){ let m=SPEEDS[c.speed].m*SETS[c.set].m;
  if(!c.hold) m*=1.1; if(c.next===1) m*=1.05; if(!c.ghost) m*=1.1; if(c.garbage) m*=1.25; if(c.fading) m*=1.3; return m; }
const dasTicks=c=>Math.max(1,Math.round(c.das*LF_HZ/1000)), arrTicks=c=>Math.round(c.arr*LF_HZ/1000);

function newGame(cfg){
  const c=Object.assign({},DEF_CFG,cfg); if(!c.seed) c.seed=randSeed();
  const B=BOARDS[c.board], W=B.w, H=B.h, R=H+LF_HIDDEN;
  const st={v:1,cfg:c,W,H,R,b:new Array(W*R).fill(0),bt:new Array(W*R).fill(0),
    rng:rngFrom(c.seed+'|p'),grng:rngFrom(c.seed+'|g'),sub:{p3:[],p5:[]},queue:[],cur:null,hold:null,held:false,
    phase:'are',timer:1,clearRows:[],tick:0,gacc:0,lockT:0,resets:0,lowY:-99,lastRot:false,lastKick:0,lastRotDir:0,
    inp:{left:false,right:false,soft:false},dir:0,das:0,arrT:0,buf:{rot:0,hold:false},
    score:0,lines:0,level:c.startLevel,combo:-1,b2b:false,serial:0,lastClear:-9999,gT:GARB_T,ev:[],result:null,
    stats:{pieces:0,quads:0,quints:0,twists:0,minis:0,sweeps:0,holds:0,maxH:0,b2bMax:0,b2bRun:0,comboMax:0,softRows:0,hardRows:0,
      moves:0,rots:0,reversals:0,aboveHalf:false,garbage:0,startH:0,maxAboveStart:0,twistLines:0,singles:0,doubles:0,triples:0}};
  if(c.fixed) st.queue=c.fixed.slice();
  if(c.prefill){ // rows from the bottom: strings, '#' = garbage block, '.' = empty
    const rows=c.prefill; for(let i=0;i<rows.length;i++){ const y=R-1-i; for(let x=0;x<W;x++) if(rows[i][x]==='#'){ st.b[y*W+x]=255; st.stats.garbage++; } } }
  st.stats.startH=stackH(st); st.stats.maxH=st.stats.startH;
  fillQueue(st); return st;
}
function fillQueue(st){ if(st.cfg.fixed) return; const S=SETS[st.cfg.set];
  while(st.queue.length<8){ const bag=S.base.slice();
    if(S.p3){ if(!st.sub.p3.length) st.sub.p3=shuffle(P3.slice(),st.rng); bag.push(st.sub.p3.pop()); }
    if(S.p5){ if(!st.sub.p5.length) st.sub.p5=shuffle(P5.slice(),st.rng); bag.push(st.sub.p5.pop()); }
    st.queue.push(...shuffle(bag,st.rng)); } }
const previews=st=>st.queue.slice(0,st.cfg.next);

// ---------- board helpers ----------
const cellsOf=(t,r,x,y)=>PIECES[t].st[r].map(([cx,cy])=>[x+cx,y+cy]);
function fits(st,t,r,x,y){ const W=st.W,R=st.R;
  for(const [cx,cy] of PIECES[t].st[r]){ const X=x+cx, Y=y+cy; if(X<0||X>=W||Y>=R) return false; if(Y>=0&&st.b[Y*W+X]) return false; } return true; }
function spawnPos(st,t){ const p=PIECES[t], bb=p.bb[0];
  const x=p.kick==='G'?Math.floor((st.W-1)/2):Math.floor((st.W-p.n)/2);
  return {x,y:(LF_HIDDEN-1)-bb.y1}; }
function stackH(st,skip){ const W=st.W; for(let y=0;y<st.R;y++){ if(skip&&skip.includes(y)) continue; for(let x=0;x<W;x++) if(st.b[y*W+x]){
  let h=st.R-y; if(skip) for(const s of skip) if(s>y) h--; return h; } } return 0; }
function dropDist(st){ const c=st.cur; let d=0; while(fits(st,c.t,c.r,c.x,c.y+d+1)) d++; return d; }
function ghostY(st){ return st.cur?st.cur.y+dropDist(st):0; }
function cellVisible(st,i){ if(!st.cfg.fading) return true; return st.tick-st.bt[i]<FADE_T||st.tick-st.lastClear<FLASH_T||st.phase==='over'||st.phase==='done'; }
const evt=(st,e,o)=>st.ev.push(Object.assign({e},o||{}));

// ---------- spawning and hold ----------
function spawn(st,t){
  const p=spawnPos(st,t); st.cur={t,r:0,x:p.x,y:p.y}; st.lockT=0; st.resets=0; st.lowY=p.y; st.lastRot=false; st.lastKick=0; st.lastRotDir=0; st.gacc=0; st.gr=false;
  if(!fits(st,t,0,p.x,p.y)){ topOut(st); return false; }
  // initial rotation / hold buffered during the entry delay
  const b=st.buf; st.buf={rot:0,hold:false};
  if(b.hold&&st.cfg.hold&&!st.held){ doHold(st); return true; }
  if(b.rot) rotate(st,b.rot);
  if(fits(st,t,st.cur.r,st.cur.x,st.cur.y+1)){ st.cur.y++; st.lowY=st.cur.y; } // appears one row into view
  st.phase='play'; evt(st,'spawn',{t});
  if(st.dir&&st.das>=dasTicks(st.cfg)&&arrTicks(st.cfg)===0) while(tryMove(st,st.dir,true));
  return true;
}
function spawnNext(st){ fillQueue(st); const t=st.queue.shift();
  if(t==null){ finish(st,true,'goal'); return false; }
  st.held=false; return spawn(st,t); }
function doHold(st){ if(!st.cfg.hold||st.held||!st.cur) return false;
  const t=st.cur.t; st.stats.holds++; evt(st,'hold');
  if(st.hold==null){ st.hold=t; st.held=true; fillQueue(st); const n=st.queue.shift(); spawn(st,n); }
  else { const h=st.hold; st.hold=t; st.held=true; spawn(st,h); }
  st.held=true; return true; }

// ---------- movement ----------
function moved(st){ if(st.lockT>0&&st.resets<MAX_RESETS){ st.lockT=0; st.resets++; } }
function lower(st){ if(st.cur.y>st.lowY){ st.lowY=st.cur.y; st.resets=0; st.lockT=0; } }
function tryMove(st,dx,quiet){ const c=st.cur; if(!c||!fits(st,c.t,c.r,c.x+dx,c.y)) return false;
  c.x+=dx; st.lastRot=false; st.stats.moves++; moved(st); if(!quiet) evt(st,'move'); return true; }
function rotate(st,dir){ const c=st.cur; if(!c) return false; const p=PIECES[c.t]; if(p.kick==='O') return false;
  const to=(c.r+dir+4)%4, ks=kicksFor(c.t,c.r,to,dir);
  for(let i=0;i<ks.length;i++){ const [kx,ky]=ks[i]; if(fits(st,c.t,to,c.x+kx,c.y+ky)){
    c.x+=kx; c.y+=ky; c.r=to; st.lastRot=true; st.lastKick=i; st.stats.rots++;
    if(st.lastRotDir===-dir) st.stats.reversals++; st.lastRotDir=dir;
    moved(st); lower(st); evt(st,'rot',{dir,kick:i}); return true; } }
  return false; }
function hardDrop(st){ const c=st.cur; const d=dropDist(st); const from=c.y; c.y+=d;
  if(d>0) st.lastRot=false; st.score+=2*d; st.stats.hardRows+=d; evt(st,'hard',{from,to:c.y,t:c.t,r:c.r,x:c.x}); lockPiece(st); }

// ---------- locking, clears, scoring ----------
const LINE_PTS=[0,100,300,500,800,1200], TWIST_PTS=[400,800,1200,1600], MINI_PTS=[100,200,400];
function lockPiece(st){
  const c=st.cur, W=st.W; let over=false, allHidden=true; st.serial=(st.serial%250)+1;
  for(const [x,y] of cellsOf(c.t,c.r,c.x,c.y)){ if(y<0){ over=true; continue; } if(y>=LF_HIDDEN) allHidden=false; st.b[y*W+x]=st.serial; st.bt[y*W+x]=st.tick; }
  st.stats.pieces++;
  // Twist (T only): last action a rotation and 3 of the 4 diagonal corners filled (walls and floor count)
  let twist=false, mini=false;
  if(c.t==='T'&&st.lastRot){ const occ=(x,y)=>x<0||x>=W||y>=st.R||(y>=0&&!!st.b[y*W+x]);
    const cs=[occ(c.x,c.y),occ(c.x+2,c.y),occ(c.x,c.y+2),occ(c.x+2,c.y+2)], n=cs.filter(Boolean).length;
    if(n>=3){ twist=true; const front=[[0,1],[1,3],[2,3],[0,2]][c.r]; if(!(cs[front[0]]&&cs[front[1]])&&st.lastKick!==4) mini=true; } }
  const rows=[]; for(let y=0;y<st.R;y++){ let full=true; for(let x=0;x<W;x++) if(!st.b[y*W+x]){ full=false; break; } if(full) rows.push(y); }
  const n=rows.length, lvl=st.level, cfg=st.cfg;
  let base=0, kind='';
  if(twist){ if(mini&&n<3){ base=MINI_PTS[n]; kind='mini'; } else { base=TWIST_PTS[Math.min(3,n)]; kind='twist'; } }
  else base=LINE_PTS[n];
  const difficult=n>=4||(twist&&n>0); let b2b=false;
  if(n>0){ if(difficult){ if(st.b2b){ base*=1.5; b2b=true; st.stats.b2bRun++; st.stats.b2bMax=Math.max(st.stats.b2bMax,st.stats.b2bRun); } st.b2b=true; }
    else { st.b2b=false; st.stats.b2bRun=0; } st.combo++; }
  else st.combo=-1;
  let extra=0; if(st.combo>0){ extra+=50*st.combo; st.stats.comboMax=Math.max(st.stats.comboMax,st.combo); }
  let sweep=false; if(n>0){ let left=0; for(let y=0;y<st.R;y++){ if(rows.includes(y)) continue; for(let x=0;x<W;x++) if(st.b[y*W+x]) left++; } if(!left){ sweep=true; extra+=n>=4?3000:1000; st.stats.sweeps++; } }
  const pts=Math.round((base+extra)*lvl*BOARDS[cfg.board].wf*scoreMult(cfg)); st.score+=pts;
  if(twist&&kind==='twist') st.stats.twists++; if(mini) st.stats.minis++; if(twist&&n>0) st.stats.twistLines++;
  if(n===4) st.stats.quads++; if(n>=5) st.stats.quints++; if(n===1) st.stats.singles++; if(n===2) st.stats.doubles++; if(n===3) st.stats.triples++;
  // garbage remaining (Dig) and stack height, measured as the board will be after the clear
  if(n>0){ let g=0; for(let y=0;y<st.R;y++){ if(rows.includes(y)) continue; for(let x=0;x<W;x++) if(st.b[y*W+x]===255) g++; } st.stats.garbage=g; }
  const h=stackH(st,rows); st.stats.maxH=Math.max(st.stats.maxH,h); if(h>st.H/2) st.stats.aboveHalf=true;
  st.stats.maxAboveStart=Math.max(st.stats.maxAboveStart,h-st.stats.startH);
  st.lines+=n; const newLvl=cfg.startLevel+Math.floor(st.lines/10); const lvlUp=newLvl>st.level; st.level=newLvl;
  evt(st,'lock',{t:c.t,cells:cellsOf(c.t,c.r,c.x,c.y)});
  if(n>0){ evt(st,'clear',{rows,n,twist:kind==='twist',mini,b2b,combo:st.combo,sweep,pts}); st.lastClear=st.tick; }
  else if(twist) evt(st,'twist0',{mini,pts});
  if(lvlUp) evt(st,'level',{level:st.level});
  st.cur=null;
  if(over||allHidden){ topOut(st); return; }
  if(n>0){ st.clearRows=rows; st.phase='clear'; st.timer=cfg.fast?CLEAR_FAST:CLEAR_T; }
  else { st.phase='are'; st.timer=ARE_T; }
  // goals that end on a lock
  const g=cfg.goal;
  if(g.type==='sprint'&&st.lines>=g.lines){ collapse(st); finish(st,true,'goal'); }
  else if(g.type==='dig'&&st.stats.garbage===0){ collapse(st); finish(st,true,'goal'); }
  else if(g.type==='puzzle'&&!st.queue.length){ collapse(st); const empty=st.b.every(v=>!v); finish(st,empty,empty?'goal':'pieces'); }
}
function collapse(st){ const rows=st.clearRows; if(!rows.length) return; const W=st.W;
  const keep=[], keepT=[]; for(let y=0;y<st.R;y++) if(!rows.includes(y)){ keep.push(st.b.slice(y*W,y*W+W)); keepT.push(st.bt.slice(y*W,y*W+W)); }
  const add=st.R-keep.length; st.b=new Array(add*W).fill(0).concat(...keep); st.bt=new Array(add*W).fill(0).concat(...keepT); st.clearRows=[]; }
function addGarbage(st){ const W=st.W;
  for(let x=0;x<W;x++) if(st.b[x]){ st.b=st.b.slice(W); st.b.push(...new Array(W).fill(255)); topOut(st); return; }
  const gap=rint(st.grng,W), row=new Array(W).fill(255); row[gap]=0;
  st.b=st.b.slice(W).concat(row); st.bt=st.bt.slice(W).concat(new Array(W).fill(st.tick));
  if(st.cur){ if(!fits(st,st.cur.t,st.cur.r,st.cur.x,st.cur.y)){ st.cur.y--; st.lowY--; if(!fits(st,st.cur.t,st.cur.r,st.cur.x,st.cur.y)){ topOut(st); return; } } else st.lowY--; }
  const h=stackH(st); st.stats.maxH=Math.max(st.stats.maxH,h); if(h>st.H/2) st.stats.aboveHalf=true;
  evt(st,'garbage',{gap}); }
function topOut(st){ st.cur=null; const g=st.cfg.goal;
  // Score Attack and Daily Blitz: topping out ends the run early with the score so far
  finish(st,g.type==='blitz','topout'); }
function finish(st,ok,why){ st.phase=why==='topout'?'over':'done'; st.result={ok,why,ticks:st.tick,h:stackH(st),score:st.score,lines:st.lines,level:st.level,stats:Object.assign({},st.stats)};
  evt(st,why==='topout'?'over':'done',{ok}); }

// ---------- input ----------
// inputs: [['p'|'r', key], ...] applied at the tick boundary in order.
// Held keys: left, right, soft. One-shots on press: cw, ccw, hard, hold, l1/r1 (one cell, no repeat: swipe pad).
function input(st,ty,k){ const play=st.phase==='play'&&st.cur;
  if(k==='left'||k==='right'){ const d=k==='left'?-1:1;
    if(ty==='p'){ st.inp[k]=true; st.dir=d; st.das=0; st.arrT=0; if(play) tryMove(st,d); }
    else { st.inp[k]=false; if(st.dir===d){ const o=k==='left'?'right':'left'; if(st.inp[o]){ st.dir=-d; st.das=0; st.arrT=0; } else st.dir=0; } }
    return; }
  if(k==='soft'){ st.inp.soft=ty==='p'; return; }
  if(ty!=='p') return;
  if(k==='l1'||k==='r1'){ if(play) tryMove(st,k==='l1'?-1:1); return; }
  if(k==='cw'||k==='ccw'){ const d=k==='cw'?1:-1; if(play) rotate(st,d); else if(st.phase==='are'||st.phase==='clear') st.buf.rot=d; return; }
  if(k==='hold'){ if(play) doHold(st); else if(st.phase==='are'||st.phase==='clear') st.buf.hold=true; return; }
  if(k==='hard'){ if(play) hardDrop(st); return; }
}

// ---------- one tick ----------
function step(st,inputs){
  st.ev=[]; if(st.phase==='over'||st.phase==='done') return st;
  st.tick++;
  if(inputs) for(const [ty,k] of inputs){ input(st,ty,k); if(st.phase==='over'||st.phase==='done') return st; }
  const c=st.cfg, dT=dasTicks(c), aT=arrTicks(c);
  if(st.dir&&st.das<dT&&st.phase!=='play') st.das++; // DAS charges during the entry delay
  if(c.garbage&&st.gT>0) st.gT--;
  if(c.garbage&&st.gT<=0&&st.phase!=='clear'){ st.gT=GARB_T; addGarbage(st); if(st.phase==='over') return st; }
  if(st.phase==='clear'){ if(--st.timer<=0){ collapse(st); st.phase='are'; st.timer=ARE_T; } }
  else if(st.phase==='are'){ if(--st.timer<=0) spawnNext(st); }
  else if(st.phase==='play'){
    if(st.dir){ if(st.das<dT){ st.das++; if(st.das===dT){ if(aT===0) while(tryMove(st,st.dir,true)); else tryMove(st,st.dir); } }
      else if(aT===0) while(tryMove(st,st.dir,true)); else if(++st.arrT>=aT){ st.arrT=0; tryMove(st,st.dir); } }
    let g=gravOf(st.level,c.speed);
    if(st.inp.soft) g=c.sdf==='inf'?G_CAP:Math.min(G_CAP,Math.max(g*c.sdf,Math.round(c.sdf*G_ONE/LF_HZ)));
    st.gacc+=g; const cu=st.cur;
    while(st.gacc>=G_ONE){ st.gacc-=G_ONE;
      if(fits(st,cu.t,cu.r,cu.x,cu.y+1)){ cu.y++; st.lastRot=false; lower(st); if(st.inp.soft){ st.score+=1; st.stats.softRows++; } }
      else { st.gacc=0; break; } }
    if(!fits(st,cu.t,cu.r,cu.x,cu.y+1)){ if(!st.gr){ st.gr=true; evt(st,'land'); } st.lockT++; if(st.lockT>=LOCK_T) lockPiece(st); }
    else st.gr=false;
  }
  const g=c.goal; if((g.type==='survive'||g.type==='score'||g.type==='blitz')&&st.tick>=g.ticks&&st.phase!=='over'&&st.phase!=='done') finish(st,true,'time');
  return st;
}
const fingerprint=st=>fnv([...st.b,st.score&65535,st.score>>>16,st.lines,st.tick&65535,st.tick>>>16]);
const snapshot=st=>{ const o=Object.assign({},st); o.ev=[]; return JSON.parse(JSON.stringify(o)); };

// ===================== bot (tests and tuning only, never shown to players) =====================
// A placement search over every rotation and column (and the hold piece when allowed), scored with weighted
// features. It plays through step() with real inputs, so it plays by the real rules.
const BOT_W=[-4.500158825082766,3.4181268101392694,-3.2178882868487753,-9.348695305445199,-7.899265427351652,-3.3855972247263626];
const popc=v=>{ v=v-((v>>>1)&0x55555555); v=(v&0x33333333)+((v>>>2)&0x33333333); return (((v+(v>>>4))&0x0f0f0f0f)*0x01010101)>>>24; };
const MASKS={}; // per piece per rotation: {rows:[mask...], w, h, x0, y0}
for(const k in PIECES){ MASKS[k]=PIECES[k].st.map((c,r)=>{ const bb=PIECES[k].bb[r], h=bb.y1-bb.y0+1, rows=new Array(h).fill(0);
  for(const [x,y] of c) rows[y-bb.y0]|=1<<(x-bb.x0); return {rows,w:bb.x1-bb.x0+1,h,x0:bb.x0,y0:bb.y0,key:rows.join(',')}; }); }
const rowsOf=st=>{ const W=st.W, o=new Array(st.R).fill(0); for(let y=0;y<st.R;y++){ let m=0; for(let x=0;x<W;x++) if(st.b[y*W+x]) m|=1<<x; o[y]=m; } return o; };
function placements(rows,W,t){ const out=[], seen=new Set(), R=rows.length, full=(1<<W)-1;
  MASKS[t].forEach((m,r)=>{ if(seen.has(m.key)) return; seen.add(m.key);
    for(let sx=0;sx+m.w<=W;sx++){ let y=-m.h; const ok=yy=>{ for(let j=0;j<m.h;j++){ const Y=yy+j; if(Y>=R) return false; if(Y>=0&&(rows[Y]&(m.rows[j]<<sx))) return false; } return true; };
      while(ok(y+1)) y++; if(y<0&&!ok(y)) continue;
      const nr=rows.slice(); let over=false; for(let j=0;j<m.h;j++){ const Y=y+j; if(Y<0){ over=true; continue; } nr[Y]|=m.rows[j]<<sx; }
      let cleared=0; const kept=[]; for(let i=0;i<R;i++){ if(nr[i]===full) cleared++; else kept.push(nr[i]); }
      const after=new Array(cleared).fill(0).concat(kept);
      out.push({t,r,x:sx-m.x0,y:y-m.y0,rows:after,cleared,over:over||y+m.h<=LF_HIDDEN,land:R-(y+m.h/2)}); } });
  return out; }
function evalRows(rows,W,cleared,land,w,quad){ const R=rows.length, full=(1<<W)-1, col=1<<(W-1); let rt=0, ct=0, holes=0, wells=0, cover=0, top=R, inCol=0;
  for(let i=0;i<R;i++) if(rows[i]){ top=i; break; }
  // Quad mode (strong bot): while the stack is low, keep the right-hand column open as a well and save clears for Quads
  const safe=quad&&R-top<(R-LF_HIDDEN)*0.45; const depth=new Array(W).fill(0);
  for(let i=0;i<R;i++){ let row=rows[i]; if(safe){ if(row&col) inCol++; if(i>=top) row|=col; }
    rt+=popc(((row|(1<<W))^((row<<1)|1))&((1<<(W+1))-1));
    ct+=popc((i?(safe&&i-1>=top?rows[i-1]|col:rows[i-1]):0)^row);
    holes+=popc(~row&cover&full); cover|=row;
    const wl=~row&((row<<1)|1)&((row>>>1)|(1<<(W-1)))&full;
    for(let x=0;x<W;x++){ if(wl&(1<<x)){ depth[x]++; wells+=depth[x]; } else depth[x]=0; } }
  ct+=popc((safe?rows[R-1]|col:rows[R-1])^full);
  let v=w[0]*land+w[1]*cleared+w[2]*rt+w[3]*ct+w[4]*holes+w[5]*wells;
  if(quad){ if(cleared>=4) v+=80; else if(cleared>0&&safe) v-=12*cleared; v-=14*inCol; }
  return v; }
function botChoose(st,o){ const W=st.W, rows=rowsOf(st), w=o.w||BOT_W, cands=[st.cur.t];
  const canHold=o.hold&&st.cfg.hold&&!st.held; let holdT=null;
  if(canHold){ holdT=st.hold!=null?st.hold:st.queue[0]; if(holdT&&holdT!==st.cur.t) cands.push(holdT); }
  let best=null;
  for(const t of cands){ const nextT=t===st.cur.t?(st.queue[0]):(st.hold!=null?st.queue[0]:st.queue[1]);
    for(const p of placements(rows,W,t)){ if(p.over) continue;
      let v=evalRows(p.rows,W,p.cleared,p.land,w,o.quad);
      if(o.look&&nextT){ let b2=-1e9; for(const q of placements(p.rows,W,nextT)){ if(q.over) continue; const v2=evalRows(q.rows,W,q.cleared,q.land,w,o.quad); if(v2>b2) b2=v2; } v=v*0.5+b2; }
      if(o.noise) v+=o.noise*(rnd(o.R)-0.5)*20;
      if(!best||v>best.v) best={v,t,r:p.r,x:p.x,hold:t!==st.cur.t}; } }
  return best; }
// Drive one game: returns the final state. o = {kind:'casual'|'strong', maxTicks}
const BOT_KINDS={casual:{hold:false,look:false,noise:0.6,think:40,miss:0.06},strong:{hold:true,look:true,noise:0,think:18,miss:0,quad:true},
  flat:{hold:true,look:true,noise:0,think:18,miss:0,quad:false}};
function botPlay(cfg,kind,maxTicks,onTick,botSeed){ const st=newGame(cfg), o=Object.assign({R:rngFrom((cfg.seed||'')+'|bot'+kind+'|'+(botSeed||0))},BOT_KINDS[kind]); let plan=null, wait=0, stage=0, serial=-1;
  maxTicks=maxTicks||LF_HZ*60*30;
  while(st.phase!=='over'&&st.phase!=='done'&&st.tick<maxTicks){ let ins=[];
    if(st.phase==='play'&&st.cur){
      if(serial!==st.stats.pieces){ serial=st.stats.pieces; plan=null; stage=0; wait=o.quad!=null&&gravOf(st.level,st.cfg.speed)>=G_ONE/2?4:o.think; }
      if(wait>0) wait--;
      else if(stage===0){ plan=botChoose(st,o); if(plan&&o.miss&&rnd(o.R)<o.miss) plan.x+=rnd(o.R)<0.5?-1:1; if(!plan){ ins=[['p','hard']]; } else if(plan.hold){ ins=[['p','hold']]; stage=0; plan=null; wait=1; } else stage=1; }
      else if(stage===1){ const d=(plan.r-st.cur.r+4)%4; if(d===1) ins=[['p','cw']]; else if(d===2) ins=[['p','cw'],['p','cw']]; else if(d===3) ins=[['p','ccw']]; stage=2; }
      else if(stage===2){ const dx=plan.x-st.cur.x; for(let i=0;i<Math.abs(dx);i++) ins.push(['p',dx<0?'l1':'r1']); ins.push(['p','hard']); stage=3; } }
    step(st,ins); if(onTick) onTick(st); }
  return st; }
