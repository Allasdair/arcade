// Snake engine — pure: no DOM, no timers. Steps a game from a state and an input.
// Arena shapes adapted from Sweep v1.2.1 (github.com/Allasdair/sweep, MIT), recomputed with 4-way regions.
'use strict';

// ---------- seeded RNG: cyrb128 -> sfc32 (same algorithm as Sweep's seedRng), with saveable state ----------
function hash128(str){
  let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0;i<str.length;i++){ const k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044813); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044813);
  return [(h1^h2^h3^h4)>>>0,(h2^h1)>>>0,(h3^h1)>>>0,(h4^h1)>>>0];
}
function rngNext(r){ // r = {s:[a,b,c,d]}; mutates r.s
  let [a,b,c,d]=r.s; a>>>=0; b>>>=0; c>>>=0; d>>>=0;
  let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0;
  r.s=[a>>>0,b>>>0,c>>>0,d>>>0]; return (t>>>0)/4294967296;
}
function rngNew(str){ const r={s:hash128(str)}; for(let i=0;i<15;i++) rngNext(r); return r; }
const rngFn=str=>{ const r=rngNew(str); return ()=>rngNext(r); };

// ---------- arenas ----------
const ARENAS=['open','ring','cross','diamond','hourglass','swiss','islands'];
const SHAPED=ARENAS.slice(1);
const ARENA_NAMES={open:'Open',ring:'Ring',cross:'Cross',diamond:'Diamond',hourglass:'Hourglass',swiss:'Swiss Cheese',islands:'Twin Islands'};
const SIZE_NAMES={s:'Small',m:'Medium',l:'Large'};
const OPEN_W={s:15,m:20,l:25}, SHAPE_W={s:17,m:21,l:25};
const SPEEDS={slow:6,normal:9,fast:13}, SPEED_NAMES={slow:'Slow',normal:'Normal',fast:'Fast'};
const SPEED_CAP=SPEEDS.fast+3, SPEEDUP_PER_FOOD=.1;
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]]; // 0 up, 1 right, 2 down, 3 left
const START_LEN=3, START_AHEAD=4, BONUS_GROW=5, BONUS_SECS=5;

// keep the largest region connected by up/down/left/right moves (the snake can't move diagonally)
function largestRegion4(m,W,H){
  const seen=new Int32Array(W*H).fill(-1); let best=-1,bestN=0,id=0;
  for(let i=0;i<W*H;i++){ if(!m[i]||seen[i]>=0) continue; let n=0; const st=[i]; seen[i]=id;
    while(st.length){ const c=st.pop(); n++; const x=c%W, y=(c/W)|0;
      for(const [dx,dy] of DIRS){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const j=ny*W+nx; if(m[j]&&seen[j]<0){ seen[j]=id; st.push(j); } } }
    if(n>bestN){ bestN=n; best=id; } id++; }
  for(let i=0;i<W*H;i++) if(m[i]&&seen[i]!==best) m[i]=0;
  return m;
}
function shapeMask(name,W,H,rng){
  const m=new Uint8Array(W*H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const u=(x+.5)/W*2-1, v=(y+.5)/H*2-1; let on=1;
    if(name==='ring'){ const r=Math.hypot(u,v); on=r<=1.02&&r>=.5; }
    else if(name==='diamond') on=Math.abs(u)+Math.abs(v)<=1.04;
    else if(name==='cross') on=Math.abs(u)<=.37||Math.abs(v)<=.37;
    else if(name==='hourglass') on=Math.abs(u)<=Math.abs(v)*.95+.24;
    else if(name==='islands'){ const r1=Math.hypot((u+.5)*1.05,v), r2=Math.hypot((u-.5)*1.05,v); on=r1<=.52||r2<=.52||(Math.abs(v)<=.16&&Math.abs(u)<=.55); }
    m[y*W+x]=on?1:0;
  }
  if(name==='swiss'){ const holes=Math.max(3,Math.round(W*H/42));
    for(let h=0;h<holes;h++){ const cx=1+rng()*(W-2), cy=1+rng()*(H-2), r=.9+rng()*.9;
      for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(Math.hypot(x+.5-cx,y+.5-cy)<=r) m[y*W+x]=0; } }
  return largestRegion4(m,W,H);
}
function makeArena(id,size,seed){
  if(!ARENAS.includes(id)) id='open'; if(!OPEN_W[size]) size='m';
  const W=id==='open'?OPEN_W[size]:SHAPE_W[size], H=W;
  const mask=id==='open'?new Uint8Array(W*H).fill(1):shapeMask(id,W,H,rngFn(String(seed)+'|arena'));
  let cells=0; for(let i=0;i<mask.length;i++) cells+=mask[i];
  return {id,size,W,H,mask,cells};
}
// start: the middle of the longest straight run, facing along it, with START_AHEAD clear cells ahead
function startPos(A){
  const {W,H,mask}=A; let best=null;
  const consider=(len,s,horiz,line)=>{ if(len<START_LEN+START_AHEAD) return;
    const cen=horiz?Math.abs(line-(H-1)/2):Math.abs(line-(W-1)/2), score=len*100-cen*2+(horiz?1:0);
    if(!best||score>best.score) best={len,s,horiz,line,score}; };
  for(let y=0;y<H;y++){ let s=-1; for(let x=0;x<=W;x++){ const on=x<W&&mask[y*W+x]; if(on&&s<0) s=x; if(!on&&s>=0){ consider(x-s,s,true,y); s=-1; } } }
  for(let x=0;x<W;x++){ let s=-1; for(let y=0;y<=H;y++){ const on=y<H&&mask[y*W+x]; if(on&&s<0) s=y; if(!on&&s>=0){ consider(y-s,s,false,x); s=-1; } } }
  if(!best) throw new Error('arena too small');
  const e=best.s+best.len-1, mid=best.s+Math.floor((best.len-1)/2);
  const head=Math.max(best.s+START_LEN-1,Math.min(e-START_AHEAD,mid+1));
  const at=p=>best.horiz?best.line*W+p:p*W+best.line;
  const body=[]; for(let k=0;k<START_LEN;k++) body.push(at(head-k));
  return {body,dir:best.horiz?1:2};
}

// ---------- game state ----------
const tps=st=>SPEEDS[st.speed]+(st.speedup?Math.min(SPEEDUP_PER_FOOD*st.foods,SPEED_CAP-SPEEDS[st.speed]):0);
const lengthOf=st=>st.body.length+st.grow;
const scoreOf=st=>st.foods+BONUS_GROW*st.bonusEaten;
function rebuild(st){ // derived, unsaved fields
  const A=makeArena(st.arena,st.size,st.seed); st.W=A.W; st.H=A.H; st.mask=A.mask; st.cells=A.cells;
  st.occ=new Uint16Array(A.W*A.H); for(const c of st.body) st.occ[c]++;
  st.rngObj={s:st.rng}; return st;
}
function newGame(o){
  const seed=String(o.seed!=null?o.seed:(Date.now().toString(36)+Math.random().toString(36).slice(2,8)));
  const A=makeArena(o.arena||'open',o.size||'m',seed), sp=startPos(A);
  const st={v:1,arena:A.id,size:A.size,speed:SPEEDS[o.speed]?o.speed:'normal',walls:o.walls==='wrap'?'wrap':'solid',speedup:!!o.speedup,
    seed,daily:o.daily||null,practice:!!o.practice,
    body:sp.body,dir:sp.dir,queue:[],grow:0,food:-1,bonus:null,rng:null,nextBonus:0,
    foods:0,bonusEaten:0,wraps:0,ticks:0,started:false,over:false,perfect:false,cause:null};
  const r=rngNew(seed+'|food'); st.rng=r.s; rebuild(st);
  st.nextBonus=8+Math.floor(rand(st)*5);
  spawnFood(st); return st;
}
function rand(st){ const v=rngNext(st.rngObj); st.rng=st.rngObj.s; return v; }
function randomEmpty(st,exclude){ // deterministic: k-th empty playable cell in index order
  const n=st.mask.length; let cnt=0;
  for(let i=0;i<n;i++) if(st.mask[i]&&!st.occ[i]&&i!==exclude) cnt++;
  if(!cnt) return -1; let k=Math.floor(rand(st)*cnt);
  for(let i=0;i<n;i++) if(st.mask[i]&&!st.occ[i]&&i!==exclude){ if(!k--) return i; }
  return -1;
}
function spawnFood(st){ st.food=randomEmpty(st,st.bonus?st.bonus.i:-1); }

// ---------- input ----------
const opp=d=>(d+2)%4;
function enqueue(st,d){
  if(st.over||!(d>=0&&d<4)) return false;
  if(!st.started){ st.started=true; if(d===opp(st.dir)||d===st.dir) return true; }
  const last=st.queue.length?st.queue[st.queue.length-1]:st.dir;
  if(d===last||d===opp(last)||st.queue.length>=2) return false;
  st.queue.push(d); return true;
}
function turnRel(st,side){ // side: -1 left, +1 right, relative to the latest queued heading
  const last=st.queue.length?st.queue[st.queue.length-1]:st.dir;
  if(!st.started){ st.started=true; }
  return enqueue(st,(last+(side<0?3:1))%4);
}

// ---------- one tick ----------
function nextCell(st,d){
  const x=st.body[0]%st.W, y=(st.body[0]/st.W)|0; let nx=x+DIRS[d][0], ny=y+DIRS[d][1], wrapped=false;
  if(nx<0||ny<0||nx>=st.W||ny>=st.H){ if(st.walls!=='wrap') return {i:-1}; nx=(nx+st.W)%st.W; ny=(ny+st.H)%st.H; wrapped=true; }
  const i=ny*st.W+nx; return st.mask[i]?{i,wrapped}:{i:-1};
}
function step(st){
  const ev=[]; if(st.over||!st.started) return ev;
  if(st.queue.length) st.dir=st.queue.shift();
  st.ticks++;
  const {i:ni,wrapped}=nextCell(st,st.dir);
  if(ni<0){ st.over=true; st.cause='wall'; ev.push({t:'die',cause:'wall'}); return ev; }
  const tail=st.body[st.body.length-1];
  if(st.occ[ni]&&!(ni===tail&&st.grow===0)){ st.over=true; st.cause='self'; ev.push({t:'die',cause:'self'}); return ev; }
  if(wrapped){ st.wraps++; ev.push({t:'wrap'}); }
  let ate=null;
  if(ni===st.food){ st.grow+=1; st.foods++; ate='food'; }
  else if(st.bonus&&ni===st.bonus.i){ st.grow+=BONUS_GROW; st.bonusEaten++; st.bonus=null; ate='bonus'; }
  st.body.unshift(ni); st.occ[ni]++;
  let tailFrom=-1; if(st.grow>0) st.grow--; else { tailFrom=st.body.pop(); st.occ[tailFrom]--; }
  ev.push({t:'move',tailFrom});
  if(st.bonus&&--st.bonus.ttl<=0){ ev.push({t:'bonus_gone',i:st.bonus.i}); st.bonus=null; }
  if(ate==='food'){ ev.push({t:'eat',i:ni}); spawnFood(st);
    if(--st.nextBonus<=0&&!st.bonus){ const b=randomEmpty(st,st.food); if(b>=0){ st.bonus={i:b,ttl:Math.round(BONUS_SECS*tps(st)),max:Math.round(BONUS_SECS*tps(st))}; ev.push({t:'bonus_spawn',i:b}); }
      st.nextBonus=8+Math.floor(rand(st)*5); } }
  if(ate==='bonus') ev.push({t:'bonus_eat',i:ni});
  if(st.food<0&&st.body.length<st.cells) spawnFood(st);
  if(st.body.length>=st.cells){ st.over=true; st.perfect=true; st.grow=0; ev.push({t:'perfect'}); }
  return ev;
}

// ---------- fixed-timestep frame: at most 2 ticks per frame, never advances while hidden ----------
const MAX_TICKS_PER_FRAME=2;
function frame(st,acc,frameSec,hidden){
  if(hidden||!st.started||st.over) return {acc:0,ticks:0,ev:[]};
  acc+=Math.max(0,Math.min(frameSec,.5)); let n=0; const ev=[];
  while(n<MAX_TICKS_PER_FRAME&&!st.over){ const dt=1/tps(st); if(acc<dt) break; acc-=dt; ev.push(...step(st)); n++; }
  const dt=1/tps(st); if(acc>=dt) acc=dt*.999; // drop the backlog: a stutter never jumps the snake ahead
  return {acc,ticks:n,ev};
}

// ---------- snapshot / restore ----------
const SNAP_KEYS=['v','arena','size','speed','walls','speedup','seed','daily','practice','body','dir','queue','grow','food','bonus','rng','nextBonus','foods','bonusEaten','wraps','ticks','started','over','perfect','cause'];
function snapshot(st){ const o={}; for(const k of SNAP_KEYS) o[k]=st[k]; return JSON.parse(JSON.stringify(o)); }
function restore(snap){ const st=JSON.parse(JSON.stringify(snap)); return rebuild(st); }

// ---------- Daily Run ----------
const DAILY_POOL=[['open','m'],['open','l'],['open','s'],['ring','m'],['cross','m'],['diamond','m'],['hourglass','m'],['swiss','m'],['islands','m']];
function dailyConfig(date){
  const seed='SNDR1|'+date, r=rngFn(seed+'|cfg'), [arena,size]=DAILY_POOL[Math.floor(r()*DAILY_POOL.length)];
  const walls=r()<.4?'wrap':'solid', x=r(), speed=x<.25?'slow':x<.8?'normal':'fast';
  return {arena,size,speed,walls,speedup:false,seed,daily:date};
}
function dailyPrint(date){ // fingerprint: settings + mask + the first 32 values of the food stream
  const c=dailyConfig(date), A=makeArena(c.arena,c.size,c.seed), r=rngNew(c.seed+'|food');
  let h=2166136261; const add=v=>{ h^=v&255; h=Math.imul(h,16777619); };
  for(const ch of [c.arena,c.size,c.speed,c.walls].join('|')) add(ch.charCodeAt(0));
  for(let i=0;i<A.mask.length;i++) add(A.mask[i]);
  for(let i=0;i<32;i++) add(Math.floor(rngNext(r)*256));
  return (h>>>0).toString(16).padStart(8,'0');
}

// ---------- stars ----------
const STAR_PCT=[.10,.20,.35];
const starTargets=cells=>STAR_PCT.map(p=>Math.max(START_LEN+1,Math.ceil(cells*p)));
const starsFor=(len,cells,perfect)=>perfect?3:starTargets(cells).filter(t=>len>=t).length;

if(typeof module!=='undefined') module.exports={hash128,rngNew,rngNext,rngFn,ARENAS,SHAPED,ARENA_NAMES,SIZE_NAMES,OPEN_W,SHAPE_W,SPEEDS,SPEED_NAMES,SPEED_CAP,DIRS,
  START_LEN,START_AHEAD,BONUS_GROW,largestRegion4,shapeMask,makeArena,startPos,tps,lengthOf,scoreOf,newGame,rebuild,randomEmpty,spawnFood,enqueue,turnRel,opp,
  nextCell,step,frame,MAX_TICKS_PER_FRAME,snapshot,restore,DAILY_POOL,dailyConfig,dailyPrint,STAR_PCT,starTargets,starsFor};
