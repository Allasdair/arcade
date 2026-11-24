// ===================== SHIP FIGHT ENGINE =====================
// Rules, fleet placement, the three AI levels, modifiers and the Daily Hunt. No DOM, so `node tests/run.js` can load it.
// A sea is W×H cells, index i = y*W + x, with a mask (1 = water, 0 = land). Columns are letters, rows are numbers.
const COLS='ABCDEFGHIJKLMNOP';
const SEA=10, NCELL=100; // the classic sea
// ---------- modifiers ----------
// Ship types. Ids are unique within a fleet, so a ship is {id, x, y, v} (v=1 vertical).
const SHIPS={carrier:{name:'Carrier',len:5},dread:{name:'Dreadnought',len:4},cruiser:{name:'Cruiser',len:3},sub:{name:'Submarine',len:3},
  frigate:{name:'Frigate',len:3},destroyer:{name:'Destroyer',len:2},patrol:{name:'Patrol Boat',len:2}};
const FLEETS={
 light:{name:'Light',desc:'3 ships',ids:['dread','cruiser','destroyer']},
 standard:{name:'Standard',desc:'5 ships',ids:['carrier','dread','cruiser','sub','destroyer']},
 armada:{name:'Armada',desc:'7 ships',ids:['carrier','dread','cruiser','sub','frigate','destroyer','patrol']}};
// Sea shapes. mask(W,H,rng) returns 1 for water; omitted = all water.
const SHAPES={
 classic:{name:'Classic',desc:'10×10 open water',W:10,H:10},
 strait:{name:'Strait',desc:'A cramped 8×8',W:8,H:8},
 narrows:{name:'Narrows',desc:'Long and low, 12×8',W:12,H:8},
 ocean:{name:'Open Ocean',desc:'A wide 12×12',W:12,H:12},
 atoll:{name:'Atoll',desc:'A ring of water round an island',W:11,H:11,mask:(W,H)=>cellsMap(W,H,(x,y)=>{ const d=Math.hypot(x-5,y-5); return d>=1.9&&d<=6.3; })},
 cross:{name:'Cross',desc:'Four arms, no corners',W:12,H:12,mask:(W,H)=>cellsMap(W,H,(x,y)=>!((x<3||x>8)&&(y<3||y>8)))},
 isles:{name:'Archipelago',desc:'Islands scattered across the sea',W:10,H:10,mask:(W,H,rng)=>isles(W,H,rng)}};
const SHAPE_IDS=Object.keys(SHAPES), FLEET_IDS=Object.keys(FLEETS);
const CLASSIC={sea:'classic',fleet:'standard',touch:true};
function cellsMap(W,H,f){ const m=new Uint8Array(W*H); for(let y=0;y<H;y++) for(let x=0;x<W;x++) m[y*W+x]=f(x,y)?1:0; return m; }
// 5 small islands (1–3 cells), never on the edge and never touching each other, so every ship still fits
function isles(W,H,rng){ for(;;){ const m=new Uint8Array(W*H).fill(1); let n=0;
  for(let t=0;t<80&&n<5;t++){ const x=1+(rng()*(W-2)|0), y=1+(rng()*(H-2)|0), sz=1+(rng()*3|0), v=rng()<.5, c=[];
    for(let k=0;k<sz;k++){ const cx=v?x:x+k, cy=v?y+k:y; if(cx>=W-1||cy>=H-1){ c.length=0; break; } c.push(cy*W+cx); }
    if(!c.length) continue; let ok=true; for(const i of c){ const ix=i%W, iy=(i/W)|0; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(!m[(iy+dy)*W+ix+dx]) ok=false; }
    if(ok){ c.forEach(i=>m[i]=0); n++; } }
  if(n>=4) return m; } }
const shipDef=id=>SHIPS[id];
const shipLen=id=>SHIPS[id].len;
// Everything a game needs to know about its rules. mods = {sea, fleet, touch}. An Archipelago's islands are random,
// so they're kept with the game (mask) and passed back in when it's restored.
function makeRules(mods,rng=Math.random,mask){ const md=Object.assign({},CLASSIC,mods||{}); if(!SHAPES[md.sea]) md.sea='classic'; if(!FLEETS[md.fleet]) md.fleet='standard'; md.touch=md.touch!==false;
  const sh=SHAPES[md.sea], W=sh.W, H=sh.H, N=W*H, m=mask?Uint8Array.from(mask):sh.mask?sh.mask(W,H,rng):new Uint8Array(N).fill(1), fleet=FLEETS[md.fleet].ids.slice();
  const place={}; for(const L of new Set(fleet.map(shipLen))){ const a=[]; for(let v=0;v<2;v++) for(let y=0;y<(v?H-L+1:H);y++) for(let x=0;x<(v?W:W-L+1);x++){ const c=[]; let ok=true;
    for(let k=0;k<L;k++){ const i=v?(y+k)*W+x:y*W+x+k; if(!m[i]){ ok=false; break; } c.push(i); } if(ok) a.push(c); } place[L]=a; }
  let water=0; for(const v of m) water+=v;
  return {mods:md,W,H,N,mask:m,fleet,touch:md.touch,place,water,cells:fleet.reduce((a,id)=>a+shipLen(id),0)}; }
const CLASSIC_RULES=makeRules(CLASSIC);
const isClassic=R=>R.mods.sea==='classic'&&R.mods.fleet==='standard'&&R.touch;
const cellName=(i,W=SEA)=>COLS[i%W]+(Math.floor(i/W)+1);
function cellsOf(s,W=SEA){ const L=shipLen(s.id), out=[]; for(let k=0;k<L;k++) out.push(s.v?(s.y+k)*W+s.x:s.y*W+s.x+k); return out; }
function fits(s,R=CLASSIC_RULES){ const L=shipLen(s.id); if(!(s.x>=0&&s.y>=0&&(s.v?(s.x<R.W&&s.y+L<=R.H):(s.y<R.H&&s.x+L<=R.W)))) return false;
  return cellsOf(s,R.W).every(i=>R.mask[i]); }
const NB8=(i,R)=>{ const x=i%R.W, y=(i/R.W)|0, o=[]; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; const nx=x+dx, ny=y+dy; if(nx>=0&&ny>=0&&nx<R.W&&ny<R.H) o.push(ny*R.W+nx); } return o; };
const NB4=(i,R)=>{ const W=R.W, x=i%W, y=(i/W)|0, o=[]; if(x>0) o.push(i-1); if(x<W-1) o.push(i+1); if(y>0) o.push(i-W); if(y<R.H-1) o.push(i+W); return o; };
// Water cells around a ship (8 directions): empty when ships can't touch
const ringOf=(cells,R)=>{ const own=new Set(cells), out=new Set(); for(const c of cells) for(const n of NB8(c,R)) if(!own.has(n)&&R.mask[n]) out.add(n); return [...out]; };
// Checks a whole layout: exactly the fleet's ships, on water, no overlap, and no touching if the rules say so.
function checkFleet(ships,R=CLASSIC_RULES){
  if(!Array.isArray(ships)||ships.length!==R.fleet.length) return {ok:false,why:'count'};
  const seen=new Set(), occ=new Int8Array(R.N).fill(-1);
  for(const [k,s] of ships.entries()){
    if(!s||!R.fleet.includes(s.id)||seen.has(s.id)) return {ok:false,why:'ship'}; seen.add(s.id);
    if(![s.x,s.y].every(Number.isInteger)||!fits(s,R)) return {ok:false,why:'off',id:s.id};
    for(const i of cellsOf(s,R.W)){ if(occ[i]>=0) return {ok:false,why:'overlap',id:s.id}; occ[i]=k; } }
  if(!R.touch) for(const [k,s] of ships.entries()) for(const n of ringOf(cellsOf(s,R.W),R)) if(occ[n]>=0&&occ[n]!==k) return {ok:false,why:'touch',id:s.id};
  return {ok:true};
}
// Where a ship can go now, ignoring one ship (the one being moved). Used by the placement screen.
function canPlace(ships,s,R=CLASSIC_RULES,ignoreId){ if(!R.fleet.includes(s.id)||!fits(s,R)) return false; const occ=new Set();
  for(const o of ships) if(o.id!==ignoreId&&o.id!==s.id) for(const i of cellsOf(o,R.W)){ occ.add(i); if(!R.touch) for(const n of NB8(i,R)) occ.add(n); }
  return cellsOf(s,R.W).every(i=>!occ.has(i)); }
// Random legal fleet. Tries quick random draws first (on the classic sea this is exactly the original method, so Daily Hunt
// fleets never change), then falls back to a shuffled search that always finds a layout if one exists.
function randomFleet(R=CLASSIC_RULES,rng=Math.random){
  if(typeof R==='function'){ rng=R; R=CLASSIC_RULES; }
  for(let round=0;round<300;round++){ const out=[]; let bad=false;
    for(const id of R.fleet){ const L=shipLen(id); let placed=false;
      for(let t=0;t<200&&!placed;t++){ const v=rng()<.5?1:0, x=rng()*(v?R.W:R.W-L+1)|0, y=rng()*(v?R.H-L+1:R.H)|0, s={id,x,y,v};
        if(canPlace(out,s,R)){ out.push(s); placed=true; } }
      if(!placed){ bad=true; break; } }
    if(!bad) return out; }
  const ids=R.fleet.slice().sort((a,b)=>shipLen(b)-shipLen(a)), out=[];
  const go=k=>{ if(k===ids.length) return true; const id=ids[k], opts=[];
    for(let v=0;v<2;v++) for(let y=0;y<R.H;y++) for(let x=0;x<R.W;x++){ const s={id,x,y,v}; if(canPlace(out,s,R)) opts.push(s); }
    for(let i=opts.length-1;i>0;i--){ const j=rng()*(i+1)|0; [opts[i],opts[j]]=[opts[j],opts[i]]; }
    for(const s of opts){ out.push(s); if(go(k+1)) return true; out.pop(); } return false; };
  if(!go(0)) throw new Error('no legal fleet for these rules'); return R.fleet.map(id=>out.find(s=>s.id===id));
}

// ---------- a sea with a hidden fleet ----------
// shots[i]: 0 untried, 1 miss, 2 hit. clear[i]=1: known empty because ships can't touch (shown, can't be fired at).
class Sea{
  constructor(ships,shots,R=CLASSIC_RULES){ this.R=R; this.ships=ships.map(s=>({id:s.id,x:s.x,y:s.y,v:s.v?1:0})); this.own=new Int8Array(R.N).fill(-1);
    this.ships.forEach((s,k)=>cellsOf(s,R.W).forEach(i=>this.own[i]=k)); this.shots=new Uint8Array(R.N); this.clear=new Uint8Array(R.N);
    this.hp=this.ships.map(s=>shipLen(s.id)); this.sunk=[];
    if(shots) shots.forEach((v,i)=>{ if(v) this.fire(i); }); }
  canFire(i){ return i>=0&&i<this.R.N&&!!this.R.mask[i]&&!this.shots[i]&&!this.clear[i]; }
  fire(i){ if(!this.canFire(i)) return {res:'dup',i};
    const k=this.own[i]; if(k<0){ this.shots[i]=1; return {res:'miss',i}; }
    this.shots[i]=2; if(--this.hp[k]>0) return {res:'hit',i};
    const s=this.ships[k], cells=cellsOf(s,this.R.W); this.sunk.push(s.id);
    const r={res:'sunk',i,id:s.id,cells,len:shipLen(s.id)};
    if(!this.R.touch){ r.ring=ringOf(cells,this.R).filter(n=>!this.shots[n]); r.ring.forEach(n=>this.clear[n]=1); }
    return r; }
  get afloat(){ return this.hp.filter(h=>h>0).length; }
  get dead(){ return this.hp.every(h=>h===0); }
  shipAt(i){ const k=this.own[i]; return k<0?null:this.ships[k]; }
  isSunk(id){ return this.sunk.includes(id); }
  toJSON(){ return {ships:this.ships,shots:Array.from(this.shots)}; }
}

// ---------- AI ----------
// The AI never sees the player's fleet. It keeps its own view of the player's sea, built only from its shot results:
// view[i] 0 unknown, 1 miss / land / known empty, 2 hit (ship not yet sunk), 3 part of a sunk ship (sinks are announced and outlined).
// next() depends only on that view (and the RNG), which the tests check.
const LEVELS=['easy','normal','hard'], EASY_NB=.1; // Easy chases a hit only 1 turn in 10 (tuned by sim: ~90 shots a game)
class AI{
  constructor(level='normal',rng=Math.random,state,R=CLASSIC_RULES){ this.level=LEVELS.includes(level)?level:'normal'; this.rng=rng; this.R=R;
    this.view=state?Uint8Array.from(state.view):Uint8Array.from(R.mask,v=>v?0:1); this.left=state?state.left.slice():R.fleet.map(shipLen);
    this.focus=state&&state.focus?state.focus.slice():[]; } // Normal: hits it is chasing; dropped after each sink
  observe(i,r){ if(r.res==='miss') this.view[i]=1; else if(r.res==='hit'){ this.view[i]=2; this.focus.push(i); }
    else if(r.res==='sunk'){ for(const c of r.cells) this.view[c]=3; if(r.ring) for(const c of r.ring) if(!this.view[c]) this.view[c]=1;
      const k=this.left.indexOf(r.len); if(k>=0) this.left.splice(k,1); this.focus=[]; } }
  untried(){ const o=[]; for(let i=0;i<this.R.N;i++) if(!this.view[i]) o.push(i); return o; }
  open(){ const o=[]; for(let i=0;i<this.R.N;i++) if(this.view[i]===2) o.push(i); return o; } // hits on ships still afloat
  pickR(a){ return a[this.rng()*a.length|0]; }
  next(){ const free=this.untried(); if(!free.length) return -1;
    if(this.level==='easy') return this.easy(free); if(this.level==='hard') return this.hard(free); return this.normal(free); }
  easy(free){ const h=this.open();
    if(h.length&&this.rng()<EASY_NB){ const nb=[...new Set(h.flatMap(i=>NB4(i,this.R)))].filter(i=>!this.view[i]); if(nb.length) return this.pickR(nb); }
    return this.pickR(free); }
  normal(free){ const V=this.view, W=this.R.W, H=this.R.H, N=this.R.N, h=this.focus.filter(i=>V[i]===2);
    if(h.length){ const hs=new Set(h), line=[];
      for(const i of h){ const x=i%W, y=(i/W)|0;
        if(x<W-1&&hs.has(i+1)){ let a=i; while(a%W>0&&V[a-1]===2) a--; let b=i+1; while(b%W<W-1&&V[b+1]===2) b++;
          if(a%W>0&&!V[a-1]) line.push(a-1); if(b%W<W-1&&!V[b+1]) line.push(b+1); }
        if(y<H-1&&hs.has(i+W)){ let a=i; while(a>=W&&V[a-W]===2) a-=W; let b=i+W; while(b<N-W&&V[b+W]===2) b+=W;
          if(a>=W&&!V[a-W]) line.push(a-W); if(b<N-W&&!V[b+W]) line.push(b+W); } }
      if(line.length) return this.pickR(line);
      const nb=[...new Set(h.flatMap(i=>NB4(i,this.R)))].filter(i=>!V[i]); if(nb.length) return this.pickR(nb); }
    const m=Math.min(...this.left), par=free.filter(i=>((i%W)+((i/W)|0))%m===0);
    return this.pickR(par.length?par:free); }
  // Count every legal placement of every remaining ship. Placements covering unresolved hits count far more.
  heat(){ const V=this.view, H=new Float64Array(this.R.N);
    for(const L of this.left) for(const c of this.R.place[L]||[]){ let k=0, ok=true;
      for(const i of c){ const v=V[i]; if(v===1||v===3){ ok=false; break; } if(v===2) k++; }
      if(!ok) continue; const w=k?Math.pow(40,k):1; for(const i of c) if(!V[i]) H[i]+=w; }
    return H; }
  hard(free){ const H=this.heat(); let best=-1, top=[];
    for(const i of free){ if(H[i]>best+1e-9){ best=H[i]; top=[i]; } else if(Math.abs(H[i]-best)<=1e-9) top.push(i); }
    return this.pickR(top); }
  toJSON(){ return {level:this.level,view:Array.from(this.view),left:this.left.slice(),focus:this.focus.slice()}; }
}

// ---------- a match vs the AI ----------
// The player fires first, one shot per turn, then the AI fires. Win by sinking the whole enemy fleet first.
// Both fleets use the same rules. log: the player's shots in order, as [cell, 'm'|'h'|'s'] (accuracy and Clean Sink).
class Match{
  constructor(o){ this.level=o.level||'normal'; const R=this.R=o.R||makeRules(o.mods,o.rng||Math.random,o.mask);
    const sea=x=>x instanceof Sea?x:new Sea(x.ships||x,x.shots,R); this.me=sea(o.me); this.foe=sea(o.foe);
    this.ai=new AI(this.level,o.rng||Math.random,o.ai,R); this.turn=o.turn||'me'; this.state=o.state||'play'; this.camp=o.camp||null;
    this.log=o.log?o.log.map(e=>e.slice()):[]; this.aiLog=o.aiLog?o.aiLog.slice():[]; this.cleanSinks=o.cleanSinks||0; this.t0=o.t0||Date.now(); }
  get shots(){ return this.log.length; }
  get hits(){ return this.log.filter(e=>e[1]!=='m').length; }
  get acc(){ return this.shots?this.hits/this.shots:0; }
  fire(i){ if(this.state!=='play'||this.turn!=='me') return {res:'turn'};
    const r=this.foe.fire(i); if(r.res==='dup') return r;
    this.log.push([i,r.res==='miss'?'m':r.res==='hit'?'h':'s']);
    if(r.res==='sunk'){ // Clean Sink: no misses from the first hit on this ship to the last
      const own=new Set(r.cells); let a=this.log.findIndex(e=>own.has(e[0])); r.clean=this.log.slice(a).every(e=>e[1]!=='m'); if(r.clean) this.cleanSinks++; }
    if(this.foe.dead){ this.state='won'; this.turn='-'; } else this.turn='ai'; return r; }
  aiFire(){ if(this.state!=='play'||this.turn!=='ai') return null;
    const i=this.ai.next(), r=this.me.fire(i); this.ai.observe(i,r); this.aiLog.push(i);
    if(this.me.dead){ this.state='lost'; this.turn='-'; } else this.turn='me'; return r; }
  toJSON(){ return {level:this.level,mods:this.R.mods,mask:SHAPES[this.R.mods.sea].mask?Array.from(this.R.mask):undefined,camp:this.camp,
    me:this.me.toJSON(),foe:this.foe.toJSON(),ai:this.ai.toJSON(),turn:this.turn,state:this.state,log:this.log,aiLog:this.aiLog,cleanSinks:this.cleanSinks,t0:this.t0}; }
  static from(o,rng){ return new Match(Object.assign({},o,{rng,R:makeRules(o.mods,rng,o.mask)})); } // saves from before modifiers load as classic
}
// Stars for a won match: ★ win · ★ hit-rate target · ★ none of your ships sunk.
// The hit-rate target scales with how crowded the sea is (fleet cells ÷ water cells; classic is 17 ÷ 100).
const ACC_TARGET={easy:.35,normal:.45,hard:.5};
function accTarget(level,R=CLASSIC_RULES){ const f=Math.min(1.3,Math.max(.7,Math.sqrt((R.cells/R.water)/.17))); return Math.round(ACC_TARGET[level]*f*20)/20; }
function matchStars(m){ if(m.state!=='won') return [false,false,false]; return [true,m.acc>=accTarget(m.level,m.R)-1e-9,m.me.sunk.length===0]; }

// ---------- seeded RNG (from Sweep's League: cyrb128 -> sfc32), same numbers on every device ----------
function seedRng(str){
  let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0;i<str.length;i++){ const k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044813); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044813);
  let a=(h1^h2^h3^h4)>>>0, b=(h2^h1)>>>0, c=(h3^h1)>>>0, d=(h4^h1)>>>0;
  const r=()=>{ a>>>=0; b>>>=0; c>>>=0; d>>>=0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0; return (t>>>0)/4294967296; };
  for(let i=0;i<15;i++) r(); return r;
}
// ---------- Daily Hunt: one hidden fleet per date on the classic sea, the same for every player ----------
const DH_VER=1, EPOCH=Date.UTC(2024,0,1);
const dayNo=date=>{ const [y,m,d]=date.split('-').map(Number); return Math.round((Date.UTC(y,m-1,d)-EPOCH)/864e5); };
const dayDate=n=>{ const t=new Date(EPOCH+n*864e5); return t.getUTCFullYear()+'-'+String(t.getUTCMonth()+1).padStart(2,'0')+'-'+String(t.getUTCDate()).padStart(2,'0'); };
const huntFleet=date=>randomFleet(CLASSIC_RULES,seedRng(`SFDH${DH_VER}|${date}`));
function fleetPrint(ships){ let h=2166136261; for(const s of ships) for(const v of [s.x,s.y,s.v,s.id.length,s.id.charCodeAt(0)]){ h^=v&255; h=Math.imul(h,16777619); } return (h>>>0).toString(16).padStart(8,'0'); }
// Par set by simulation (tests/run.js prints the numbers): ★ ≤70 shots · ★★ ≤55 · ★★★ ≤45
const DH_PAR=[70,55,45];
const huntStars=n=>DH_PAR.filter(p=>n<=p).length;

// Plays a whole game for an AI against a given fleet (used by tests and the Daily Hunt par check).
function simShots(level,ships,rng=Math.random,R=CLASSIC_RULES){ const sea=new Sea(ships,null,R), ai=new AI(level,rng,null,R); let n=0;
  while(!sea.dead&&n<R.N){ const i=ai.next(), r=sea.fire(i); if(r.res==='dup') throw new Error('AI fired at a used or dry cell: '+i); ai.observe(i,r); n++; } return n; }

if(typeof module!=='undefined') module.exports={SEA,NCELL,COLS,SHIPS,FLEETS,SHAPES,SHAPE_IDS,FLEET_IDS,CLASSIC,CLASSIC_RULES,makeRules,isClassic,shipDef,shipLen,cellName,cellsOf,fits,ringOf,NB8,checkFleet,randomFleet,canPlace,
  Sea,AI,LEVELS,Match,ACC_TARGET,accTarget,matchStars,seedRng,dayNo,dayDate,huntFleet,fleetPrint,DH_PAR,huntStars,simShots,DH_VER};
