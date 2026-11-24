// ===================== Drift engine =====================
// Pure: no DOM, no timers. step(st, inputs) advances one 60 Hz logic tick. All randomness comes from the run's seeded
// RNG (cyrb128 -> sfc32) and angles use a 256-step lookup table, so the same seed and input stream give the same run,
// and all state is plain JSON (saves resume exactly). The engine only knows world coordinates: the camera, radar and
// wrapped drawing live in app.html. Angles: 0 = up, 64 = right, 128 = down, 192 = left (screen y grows downward).
const DR_HZ=60;
// ---------- seeded RNG: cyrb128 -> sfc32 (as in Sweep and Linefall), state kept as plain numbers ----------
function rngFrom(str){
  let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
  for(let i=0;i<str.length;i++){ const k=str.charCodeAt(i); h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233); h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044813); }
  h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233); h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044813);
  const R={a:(h1^h2^h3^h4)>>>0,b:(h2^h1)>>>0,c:(h3^h1)>>>0,d:(h4^h1)>>>0}; for(let i=0;i<15;i++) rnd(R); return R; }
function rnd(R){ let a=R.a>>>0,b=R.b>>>0,c=R.c>>>0,d=R.d>>>0; let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0;
  R.a=a>>>0; R.b=b>>>0; R.c=c>>>0; R.d=d>>>0; return (t>>>0)/4294967296; }
const rint=(R,n)=>Math.floor(rnd(R)*n);
const randSeed=()=>'DR'+Date.now().toString(36)+Math.floor(Math.random()*1e9).toString(36);
function fnv(arr){ let h=2166136261; for(const v of arr){ const n=v|0; for(let s=0;s<32;s+=8){ h^=(n>>>s)&255; h=Math.imul(h,16777619); } } return (h>>>0).toString(16).padStart(8,'0'); }

// ---------- angles: a 256-step table (rounded so every engine builds the same table) ----------
const ASIN=[], ACOS=[]; for(let i=0;i<256;i++){ ASIN.push(Math.round(Math.sin(i*Math.PI/128)*1e6)/1e6); ACOS.push(Math.round(Math.cos(i*Math.PI/128)*1e6)/1e6); }
const aIdx=a=>Math.round(a)&255;
const dirX=a=>ASIN[aIdx(a)], dirY=a=>-ACOS[aIdx(a)];
const angDiff=(from,to)=>{ let d=((to-from)%256+256)%256; if(d>=128) d-=256; return d; }; // the short way, -128..127
// direction (dx,dy) -> nearest of the 256 steps, by a search over the table (no atan2 in the logic)
function angOf(dx,dy){ if(!dx&&!dy) return 0; let best=0, bv=-1e9; // coarse 16, then fine
  for(let i=0;i<256;i+=16){ const v=dx*ASIN[i]-dy*ACOS[i]; if(v>bv){ bv=v; best=i; } }
  let b2=best; for(let j=-8;j<=8;j++){ const i=(best+j+256)&255, v=dx*ASIN[i]-dy*ACOS[i]; if(v>bv){ bv=v; b2=i; } } return b2; }

// ---------- tuning (first estimates; tuned with the bots, tests/sim.js) ----------
const DIFFS={
  easy:{id:'easy',name:'Easy',W:800,H:1000,spd:1,mult:1,count:20,mix:[50,30,20],group:2,calm:3,groupT:540},
  normal:{id:'normal',name:'Normal',W:1200,H:1500,spd:1.5,mult:1.5,count:40,mix:[60,30,10],group:3,calm:5,groupT:420},
  hard:{id:'hard',name:'Hard',W:1600,H:2000,spd:2,mult:2,count:60,mix:[70,25,5],group:4,calm:7,groupT:360}};
const DIFF_IDS=['easy','normal','hard'];
const VIEW_W=700; // first estimate was 800; 700 keeps objects readable on a 360-412 px phone
// sizes: 1 Small, 2 Medium, 3 Large, 4 boss
const ROCK_R=[0,20,38,62,138], ROCK_HP=[0,1,2,3,0], ROCK_PTS=[0,20,40,60,0], ROCK_V=[0,1.55,1.1,0.75,0.35], ROCK_W=[0,1,3.5,8,0];
const SIZE_NAMES=['','Small','Medium','Large','Boss'];
const ROCK_TYPES=['stone','armour','volatile','ice','magnet','gold'];
const SHIP_R=18, THRUST=0.2, MAXV=7, DRAG=0.972, DRAG_MIN=0.02, BRAKE=0.9, TURN=256/54;
const BUL_V=12, BUL_LIFE=41, FIRE_CD=10, BUL_MAX=6, BUL_R=3;
const DASH_V=13, DASH_INV=18, DASH_CD=180, DIE_T=90, PROT_T=120, LIFE_EVERY=10000, LIVES_MAX=5;
const COMBO_T=90, PUP_LIFE=480, PUP_BLINK=120, PUP_T=600, PUP_R=16;
const PUP_KINDS=['spread','rapid','pierce','shield','shock'];
const DRONE_R=22, DRONE_HP=2, DRONE_PTS=200, DRONE_LIFE=1500, DSHOT_V=4, DSHOT_LIFE=160;
const BOOM_R=120, SHOCK_R=300, MAG_R=250, WELL_K=10;
const CLEARING_T=45;

// ---------- modifiers (section 5) ----------
const MODS={
  wrap:{name:'Wrap',opts:[['none','None',1],['lr','Left/Right',1],['all','All sides',1]],def:'none'},
  density:{name:'Density',opts:[['few','Fewer',0.8],['normal','Normal',1],['more','More',1.2]],def:'normal'},
  speed:{name:'Rock speed',opts:[['slow','Slow',0.8],['normal','Normal',1],['fast','Fast',1.25]],def:'normal'},
  types:{name:'Rock types',opts:[['stone','Stone only',1],['mixed','Mixed',1.1]],def:'stone'},
  pups:{name:'Power-ups',opts:[['on','On',1],['off','Off',1.15]],def:'on'},
  drones:{name:'Hunter drones',opts:[['off','Off',1],['on','On',1.15]],def:'off'},
  drag:{name:'Drag',opts:[['normal','Normal',1],['space','True space',1.25]],def:'normal'},
  well:{name:'Gravity well',opts:[['off','Off',1],['on','On',1.2]],def:'off'},
  ricochet:{name:'Ricochet',opts:[['off','Off',1],['on','On',0.9]],def:'off'},
  lives:{name:'Lives',opts:[['3','3',1],['1','1 (Hardcore)',1.5]],def:'3'},
  fog:{name:'Fog',opts:[['off','Off',1],['on','On',1.25]],def:'off'}};
const MOD_IDS=Object.keys(MODS);
const DENSITY={few:0.75,normal:1,more:1.5}, SPEEDMOD={slow:0.8,normal:1,fast:1.25};
// Normal mode defaults per difficulty: mixed rock types and drones from Normal up
function defMods(diff){ const m={}; for(const k of MOD_IDS) m[k]=MODS[k].def; if(diff!=='easy'){ m.types='mixed'; m.drones='on'; } return m; }
function modMult(m){ let x=1; for(const k of MOD_IDS){ const o=MODS[k].opts.find(o=>o[0]===m[k]); if(o) x*=o[2]; } return Math.round(x*1000)/1000; }
const MIXED_TYPES=[['stone',60],['armour',10],['volatile',9],['ice',9],['magnet',8],['gold',4]];

// Normal-mode config from a difficulty and modifiers
function normalCfg(diff,mods,extra){ const D=DIFFS[diff], m=Object.assign(defMods(diff),mods||{});
  return Object.assign({mode:'normal',diff,W:D.W,H:D.H,count:Math.round(D.count*DENSITY[m.density]),mix:D.mix.slice(),
    types:m.types==='mixed'?MIXED_TYPES:[['stone',1]],spd:D.spd*SPEEDMOD[m.speed],wrap:m.wrap,drones:m.drones==='on',
    droneEvery:[2400,3600],droneFast:false,pups:m.pups==='on',pupKinds:PUP_KINDS.slice(),space:m.drag==='space',nobrake:m.drag==='space',
    well:m.well==='on',ricochet:m.ricochet==='on',lives:+m.lives,fog:m.fog==='on',group:D.group,calm:D.calm,groupT:D.groupT,
    boss:null,mult:D.mult*modMult(m),mods:m,seed:randSeed()},extra||{}); }

// ---------- new game ----------
function newGame(cfg){ const c=Object.assign({mode:'normal',diff:'easy',W:800,H:1000,count:20,mix:[50,30,20],types:[['stone',1]],spd:1,wrap:'none',
    drones:false,droneEvery:[2400,3600],droneFast:false,pups:true,pupKinds:PUP_KINDS.slice(),space:false,nobrake:false,well:false,ricochet:false,
    lives:3,fog:false,group:2,calm:3,groupT:540,boss:null,mult:1,seed:'drift',steer:'direct',fire:'hold'},cfg);
  const R=rngFrom(c.seed+'|run');
  const st={v:1,cfg:c,W:c.W,H:c.H,wx:c.wrap!=='none',wy:c.wrap==='all',tick:0,phase:'play',pt:0,rng:R,nid:1,
    ship:{x:c.W/2,y:c.H/2,vx:0,vy:0,a:0,dead:0,prot:PROT_T,inv:0,dash:0,dashCd:0,fireCd:0,shield:false,thrust:0,wall:0,held:0},
    in:{left:0,right:0,up:0,down:0,fire:0,sx:0,sy:0,firePress:0,dirT:0},
    bullets:[],rocks:[],drones:[],dshots:[],pups:[],pulses:[],pending:[],queue:[],spawnT:60,droneT:0,
    score:0,lives:c.lives,nextLife:LIFE_EVERY,combo:{n:0,t:0},power:{held:null,active:null,t:0},
    wave:0,waveT:0,total:0,
    stats:{shots:0,hits:0,kills:0,livesLost:0,comboMax:0,gold:0,closeCall:0,dashes:0,chainMax:0,droneKills:0,pupsUsed:0,escaped:0,shock:0},
    result:null,ev:[],chains:{}};
  if(c.mode==='endless'){ st.wave=0; nextWave(st); }
  else { fillQueue(st,c.count,c.mix,c.types); if(c.boss) spawnBoss(st,c.boss); }
  st.total=remaining(st); return st; }

function pickType(st,types){ let tot=0; for(const [,w] of types) tot+=w; let r=rnd(st.rng)*tot; for(const [t,w] of types){ r-=w; if(r<0) return t; } return types[0][0]; }
function fillQueue(st,n,mix,types){ for(let i=0;i<n;i++){ const r=rnd(st.rng)*100, size=r<mix[0]?3:r<mix[0]+mix[1]?2:1; st.queue.push({size,type:pickType(st,types)}); } }
// rock left, in units of Smalls: a Large counts as its full set of pieces
function rockWeight(r){ if(r.size===4) return 24+30*r.hp/r.maxHp; if(r.orb) return 2; return ROCK_W[r.size]; }
function remaining(st){ let w=0; for(const q of st.queue) w+=ROCK_W[q.size]; for(const p of st.pending) w+=ROCK_W[p.size]; for(const r of st.rocks) w+=rockWeight(r); return w; }
const progress=st=>st.total?Math.max(0,Math.min(1,1-remaining(st)/st.total)):1;

// ---------- geometry with wrap ----------
const wd=(d,L)=>d-L*Math.round(d/L);
const dxOf=(st,a,b)=>st.wx?wd(b-a,st.W):b-a, dyOf=(st,a,b)=>st.wy?wd(b-a,st.H):b-a;
function dist2(st,a,b){ const dx=dxOf(st,a.x,b.x), dy=dyOf(st,a.y,b.y); return dx*dx+dy*dy; }
const wrapPos=(st,o)=>{ if(st.wx) o.x=((o.x%st.W)+st.W)%st.W; if(st.wy) o.y=((o.y%st.H)+st.H)%st.H; };
// spatial hash grid over rocks (cell 128): bullets and the ship only test nearby rocks
const CELL=128;
function buildGrid(st){ const g=new Map(), cols=Math.ceil(st.W/CELL), rows=Math.ceil(st.H/CELL);
  st.rocks.forEach(r=>{ const x0=Math.floor((r.x-r.r)/CELL), x1=Math.floor((r.x+r.r)/CELL), y0=Math.floor((r.y-r.r)/CELL), y1=Math.floor((r.y+r.r)/CELL);
    for(let cx=x0;cx<=x1;cx++) for(let cy=y0;cy<=y1;cy++){ const kx=st.wx?((cx%cols)+cols)%cols:cx, ky=st.wy?((cy%rows)+rows)%rows:cy, k=(kx+64)*8192+(ky+64);
      let a=g.get(k); if(!a){ a=[]; g.set(k,a); } a.push(r); } });
  return {g,cols,rows}; }
function nearRocks(st,G,x,y,rad){ const out=new Set(), x0=Math.floor((x-rad)/CELL), x1=Math.floor((x+rad)/CELL), y0=Math.floor((y-rad)/CELL), y1=Math.floor((y+rad)/CELL);
  for(let cx=x0;cx<=x1;cx++) for(let cy=y0;cy<=y1;cy++){ const kx=st.wx?((cx%G.cols)+G.cols)%G.cols:cx, ky=st.wy?((cy%G.rows)+G.rows)%G.rows:cy, a=G.g.get((kx+64)*8192+(ky+64)); if(a) for(const r of a) out.add(r); }
  return [...out].filter(r=>st.rocks.indexOf(r)>=0).sort((a,b)=>a.id-b.id); }

// ---------- input ----------
// events: ['p',key] / ['r',key] for left right up down fire; ['p','dash']; ['p','use']; ['stick',ax,ay] with ax,ay in -64..64 (0,0 = released)
function applyInputs(st,ins){ const I=st.in;
  for(const e of ins||[]){ const [ty,k]=e;
    if(ty==='stick'){ I.sx=Math.max(-64,Math.min(64,e[1]|0)); I.sy=Math.max(-64,Math.min(64,e[2]|0)); continue; }
    if(ty==='p'){ if(k==='dash') I.dashP=1; else if(k==='use') I.useP=1; else if(k in I){ if(k==='fire'&&!I.fire) I.firePress++; I[k]=1; } }
    else if(ty==='r'&&k in I) I[k]=0; } }
const DIR8={'0,-1':0,'1,-1':32,'1,0':64,'1,1':96,'0,1':128,'-1,1':160,'-1,0':192,'-1,-1':224};

// ---------- the tick ----------
function step(st,ins){ st.ev=[]; st.chains={}; applyInputs(st,ins);
  if(st.phase==='over'||st.phase==='done') return st;
  st.tick++;
  if(st.phase==='clearing'){ shipStep(st); moveWorld(st); if(++st.pt>=CLEARING_T) finish(st,true); return st; }
  if(st.phase==='break'){ moveWorld(st); shipStep(st); if(++st.pt>=180){ st.phase='play'; st.pt=0; nextWave(st); } return st; }
  if(st.phase==='dying'){ moveWorld(st); if(++st.pt>=DIE_T) finish(st,false); return st; }
  shipStep(st); spawnStep(st); droneSpawn(st); moveWorld(st); collide(st); bossStep(st);
  if(st.combo.t>0&&--st.combo.t===0) st.combo.n=0;
  if(st.power.active&&--st.power.t<=0){ st.ev.push({e:'pupEnd',k:st.power.active}); st.power.active=null; }
  // cleared?
  if(st.phase==='play'&&!st.queue.length&&!st.pending.length&&!st.rocks.length){
    if(st.cfg.mode==='endless'){ const b=100*st.wave; st.score+=b; checkLife(st); st.ev.push({e:'wave',n:st.wave,bonus:b}); st.phase='break'; st.pt=0; st.drones.forEach(d=>d.life=Math.min(d.life,0)); }
    else { st.phase='clearing'; st.pt=0; st.ev.push({e:'clear'}); st.drones.forEach(d=>d.life=0); } }
  st.in.dashP=0; st.in.useP=0; return st; }

function finish(st,ok){ st.phase=ok?'done':'over'; const s=st.stats;
  st.result={ok,score:st.score,ticks:st.tick,livesLost:s.livesLost,shots:s.shots,hits:s.hits,acc:s.shots?s.hits/s.shots:0,comboMax:s.comboMax,
    kills:s.kills,wave:st.wave,stats:Object.assign({},s),lives:st.lives};
  st.ev.push({e:ok?'done':'over'}); }

// ---------- ship ----------
function shipStep(st){ const sh=st.ship, I=st.in, c=st.cfg;
  if(sh.dead){ if(--sh.dead===0) respawn(st); return; }
  if(sh.inv>0) sh.inv--; if(sh.dashCd>0) sh.dashCd--; if(sh.fireCd>0) sh.fireCd--;
  let thrust=0, target=null, brake=false;
  const stickM=Math.sqrt(I.sx*I.sx+I.sy*I.sy)/64;
  if(stickM>=0.15){ target=angOf(I.sx,I.sy); thrust=Math.max(0,Math.min(1,(stickM-0.3)/0.5)); }
  else if(c.steer==='classic'){ if(I.left) sh.a-=TURN; if(I.right) sh.a+=TURN; if(I.up) thrust=1; if(I.down) brake=true; }
  else { const dx=(I.right?1:0)-(I.left?1:0), dy=(I.down?1:0)-(I.up?1:0);
    if(dx||dy){ target=DIR8[dx+','+dy]; I.dirT++; thrust=I.dirT>6?1:0; } else I.dirT=0; }
  if(target!==null){ const d=angDiff(sh.a,target); sh.a+=Math.max(-TURN,Math.min(TURN,d)); if(Math.abs(angDiff(sh.a,target))>48) thrust=0; }
  sh.a=((sh.a%256)+256)%256;
  sh.thrust=thrust;
  if(thrust>0){ sh.vx+=dirX(sh.a)*THRUST*thrust; sh.vy+=dirY(sh.a)*THRUST*thrust; if(sh.prot) sh.prot=0; }
  else if(!c.space){ const dr=c.glide?0.986:DRAG; sh.vx*=dr; sh.vy*=dr; const v=Math.sqrt(sh.vx*sh.vx+sh.vy*sh.vy); if(v<DRAG_MIN*6){ const k=Math.max(0,v-DRAG_MIN)/(v||1); sh.vx*=k; sh.vy*=k; } }
  if(brake&&!c.nobrake){ sh.vx*=BRAKE; sh.vy*=BRAKE; }
  // magnetic rocks and the gravity well pull the ship
  for(const r of st.rocks){ const rng=r.boss==='leviathan'?500:r.type==='magnet'?MAG_R:0; if(!rng) continue;
    const dx=dxOf(st,sh.x,r.x), dy=dyOf(st,sh.y,r.y), d=Math.sqrt(dx*dx+dy*dy); if(d<rng&&d>1){ const k=(r.boss?0.09:0.05)*(1-d/rng)/d; sh.vx+=dx*k; sh.vy+=dy*k; } }
  if(c.well) pullWell(st,sh,1);
  let v=Math.sqrt(sh.vx*sh.vx+sh.vy*sh.vy), cap=sh.dash>0?DASH_V:MAXV; if(v>cap){ sh.vx*=cap/v; sh.vy*=cap/v; }
  if(sh.dash>0) sh.dash--;
  sh.x+=sh.vx; sh.y+=sh.vy; sh.wall=0; softWall(st,sh,SHIP_R); wrapPos(st,sh);
  if(sh.prot>0) sh.prot--;
  // dash
  if(I.dashP&&sh.dashCd===0){ sh.vx=dirX(sh.a)*DASH_V; sh.vy=dirY(sh.a)*DASH_V; sh.dash=DASH_INV; sh.inv=Math.max(sh.inv,DASH_INV); sh.dashCd=DASH_CD; st.stats.dashes++; sh.prot=0; st.ev.push({e:'dash',x:sh.x,y:sh.y,a:sh.a}); }
  // power-up
  if(I.useP&&st.power.held) usePower(st);
  // fire
  const mode=c.fire; let want=false;
  if(mode==='on') want=sh.prot===0;
  else if(mode==='hold') want=!!I.fire||I.firePress>0;
  else if(mode==='tap') want=I.firePress>0;
  else if(mode==='range'){ for(const r of st.rocks){ if(dist2(st,sh,r)<(560+r.r)*(560+r.r)){ want=sh.prot===0; break; } } }
  if(want&&sh.fireCd===0&&fire(st)) I.firePress=0; // a press during the cooldown is buffered
  if(mode==='on'||mode==='range') I.firePress=0; }
function softWall(st,o,r){ let hit=0;
  if(!st.wx){ if(o.x<r){ o.x=r; if(o.vx<0) o.vx=0; hit=1; } else if(o.x>st.W-r){ o.x=st.W-r; if(o.vx>0) o.vx=0; hit=1; } }
  if(!st.wy){ if(o.y<r){ o.y=r; if(o.vy<0) o.vy=0; hit=1; } else if(o.y>st.H-r){ o.y=st.H-r; if(o.vy>0) o.vy=0; hit=1; } }
  if(hit&&o===st.ship){ o.wall=1; } return hit; }
function pullWell(st,o,k){ const dx=dxOf(st,o.x,st.W/2), dy=dyOf(st,o.y,st.H/2), d=Math.sqrt(dx*dx+dy*dy); if(d<4) return; const a=WELL_K/Math.max(d,70)*k/d; o.vx+=dx*a; o.vy+=dy*a; }
function fire(st){ const sh=st.ship, c=st.cfg, P=st.power.active, spread=P==='spread', rapid=P==='rapid';
  const mine=st.bullets.filter(b=>!b.d).length, cap=BUL_MAX*(spread?3:1)*(rapid?2:1); if(mine+(spread?3:1)>cap) return false;
  const angs=spread?[-12,0,12]:[0];
  for(const da of angs){ const a=sh.a+da, dx=dirX(a), dy=dirY(a);
    st.bullets.push({x:sh.x+dx*(SHIP_R+2),y:sh.y+dy*(SHIP_R+2),vx:dx*BUL_V+sh.vx,vy:dy*BUL_V+sh.vy,life:BUL_LIFE,pierce:P==='pierce',hit:[],bounced:false}); st.stats.shots++; }
  sh.fireCd=rapid?5:FIRE_CD; if(sh.prot) sh.prot=0; st.ev.push({e:'fire',x:sh.x,y:sh.y,a:sh.a}); return true; }
function usePower(st){ const k=st.power.held; st.power.held=null; st.stats.pupsUsed++; st.ev.push({e:'use',k});
  if(k==='shield'){ st.ship.shield=true; return; }
  if(k==='shock'){ const sh=st.ship; st.stats.shock++; st.ev.push({e:'shock',x:sh.x,y:sh.y,r:SHOCK_R});
    for(const r of st.rocks.slice()){ if(st.rocks.indexOf(r)<0) continue; const d=Math.sqrt(dist2(st,sh,r))-r.r; if(d>SHOCK_R) continue;
      if(r.size===1) damage(st,r,99,'shock',null); else damage(st,r,1,'shock',null,true); }
    for(const d of st.drones) if(dist2(st,sh,d)<SHOCK_R*SHOCK_R) hitDrone(st,d,1,true);
    return; }
  st.power.active=k; st.power.t=PUP_T; }
function respawn(st){ const sh=st.ship, W=st.W, H=st.H; let best=null, bv=-1e9;
  for(let i=1;i<=7;i++) for(let j=1;j<=9;j++){ const p={x:W*i/8,y:H*j/10}; let m=1e9;
    for(const r of st.rocks){ const d=Math.sqrt(dist2(st,p,r))-r.r; if(d<m) m=d; }
    for(const d of st.drones){ const dd=Math.sqrt(dist2(st,p,d)); if(dd<m) m=dd; }
    for(const q of st.pending){ const dd=Math.sqrt(dist2(st,p,q)); if(dd<m) m=dd; }
    const cdx=p.x-W/2, cdy=p.y-H/2, v=Math.min(m,600)-0.15*Math.sqrt(cdx*cdx+cdy*cdy); if(v>bv){ bv=v; best=p; } }
  Object.assign(sh,{x:best.x,y:best.y,vx:0,vy:0,a:0,dead:0,prot:PROT_T,inv:0,dash:0,fireCd:0,thrust:0}); st.ev.push({e:'respawn',x:sh.x,y:sh.y}); }
function shipHit(st,by){ const sh=st.ship; if(sh.dead||sh.inv>0||sh.prot>0||st.phase!=='play') return false;
  if(sh.shield){ sh.shield=false; sh.inv=30; st.ev.push({e:'shieldBreak',x:sh.x,y:sh.y}); return true; }
  st.lives--; st.stats.livesLost++; sh.dead=DIE_T; sh.shield=false; st.ev.push({e:'boom',x:sh.x,y:sh.y,vx:sh.vx,vy:sh.vy});
  st.power.active=null; st.combo.n=0; st.combo.t=0;
  if(st.lives<=0){ st.phase='dying'; st.pt=0; } return true; }
function checkLife(st){ while(st.score>=st.nextLife){ st.nextLife+=LIFE_EVERY; if(st.lives<LIVES_MAX){ st.lives++; st.ev.push({e:'life'}); } } }

// ---------- spawning: incoming rocks in groups, each announced ~1 s before it enters ----------
function spawnStep(st){ const c=st.cfg;
  for(const p of st.pending.slice()){ if(--p.t>0) continue; st.pending.splice(st.pending.indexOf(p),1);
    const r=makeRock(st,p.size,p.type,p.x,p.y,p.vx,p.vy); r.in=false; st.rocks.push(r); st.ev.push({e:'enter',x:p.x,y:p.y,size:p.size}); }
  if(!st.queue.length||st.pending.length) return;
  if(st.spawnT>0) st.spawnT--;
  const inPlay=st.rocks.filter(r=>!r.orb).length;
  if(st.spawnT>0&&inPlay>c.calm) return;
  if(inPlay>c.calm*2+2) return; // when the timer runs out, still wait if the field is crowded (wrapped rocks never leave)
  if(st.spawnT>0&&st.tick<60) return;
  const n=Math.min(c.group,st.queue.length);
  for(let i=0;i<n;i++){ const q=st.queue.shift(), e=entry(st,q.size); st.pending.push(Object.assign({size:q.size,type:q.type,t:60+i*20},e)); st.ev.push({e:'warn',x:e.x,y:e.y,edge:e.edge,size:q.size}); }
  st.spawnT=c.groupT; }
function entry(st,size){ const R=st.rng, W=st.W, H=st.H, r=ROCK_R[size], edge=rint(R,4), f=0.1+rnd(R)*0.8;
  let x,y; if(edge===0){ x=W*f; y=-r-2; } else if(edge===1){ x=W+r+2; y=H*f; } else if(edge===2){ x=W*f; y=H+r+2; } else { x=-r-2; y=H*f; }
  let tx=W*(0.5+(rnd(R)-0.5)*0.7), ty=H*(0.5+(rnd(R)-0.5)*0.7);
  const sh=st.ship, sp=rockSpeed(st,size)*(0.85+rnd(R)*0.3);
  let dx=tx-x, dy=ty-y; const d=Math.sqrt(dx*dx+dy*dy); dx/=d; dy/=d;
  // never aim straight at a spawn-protected (or respawning) ship
  if(sh.prot>0||sh.dead){ const sx=sh.x-x, sy=sh.y-y, sd=Math.sqrt(sx*sx+sy*sy)||1; if((dx*sx+dy*sy)/sd>0.97){ const away=(dx*sy-dy*sx)>0?-24:24, a=angOf(dx,dy)+away; dx=dirX(a); dy=dirY(a); } }
  return {x,y,vx:dx*sp,vy:dy*sp,edge}; }
const rockSpeed=(st,size)=>ROCK_V[size]*st.cfg.spd;
function makeRock(st,size,type,x,y,vx,vy){ const R=st.rng;
  const r={id:st.nid++,size,type:type||'stone',x,y,vx,vy,r:ROCK_R[size],hp:ROCK_HP[size],maxHp:ROCK_HP[size],arm:type==='armour',
    seed:rint(R,1e9),spin:(rnd(R)-0.5)*1.2,a:rint(R,256),flash:0,in:true,age:0};
  return r; }

// ---------- moving everything ----------
function moveWorld(st){ const c=st.cfg;
  // bullets
  for(const b of st.bullets){ b.x+=b.vx; b.y+=b.vy; b.life--;
    let out=false; if(!st.wx&&(b.x<0||b.x>st.W)){ if(c.ricochet&&!b.bounced){ b.vx=-b.vx; b.bounced=true; b.x=Math.max(0,Math.min(st.W,b.x)); st.ev.push({e:'ric',x:b.x,y:b.y}); } else out=true; }
    if(!st.wy&&(b.y<0||b.y>st.H)){ if(c.ricochet&&!b.bounced){ b.vy=-b.vy; b.bounced=true; b.y=Math.max(0,Math.min(st.H,b.y)); st.ev.push({e:'ric',x:b.x,y:b.y}); } else out=true; }
    if(out) b.life=0; wrapPos(st,b); }
  st.bullets=st.bullets.filter(b=>b.life>0);
  for(const s of st.dshots){ s.x+=s.vx; s.y+=s.vy; s.life--; if((!st.wx&&(s.x<0||s.x>st.W))||(!st.wy&&(s.y<0||s.y>st.H))) s.life=0; wrapPos(st,s); }
  st.dshots=st.dshots.filter(s=>s.life>0);
  // rocks
  const keep=[];
  for(const r of st.rocks){ r.age++; if(r.flash>0) r.flash--; r.a+=r.spin;
    if(r.orb) { keep.push(r); continue; } // ring rocks are placed by their boss
    if(c.well&&!r.boss) pullWell(st,r,0.5);
    if(c.well||r.size===4){ const v=Math.sqrt(r.vx*r.vx+r.vy*r.vy), cap=Math.max(3.5,ROCK_V[Math.min(3,r.size)]*c.spd*3); if(v>cap){ r.vx*=cap/v; r.vy*=cap/v; } }
    r.x+=r.vx; r.y+=r.vy;
    if(r.size===4){ // bosses stay in the field: they bounce off soft walls
      if(!st.wx){ if(r.x<r.r&&r.vx<0&&r.age>200) r.vx=-r.vx; if(r.x>st.W-r.r&&r.vx>0&&r.age>200) r.vx=-r.vx; }
      if(!st.wy){ if(r.y<r.r&&r.vy<0&&r.age>200) r.vy=-r.vy; if(r.y>st.H-r.r&&r.vy>0) r.vy=-r.vy; }
      wrapPos(st,r); keep.push(r); continue; }
    const insideX=st.wx||(r.x>=r.r&&r.x<=st.W-r.r), insideY=st.wy||(r.y>=r.r&&r.y<=st.H-r.r);
    if(!r.in){ if(insideX&&insideY) r.in=true; else if(r.age>900){ escape(st,r); continue; } }
    else { const outX=!st.wx&&(r.x<-r.r||r.x>st.W+r.r), outY=!st.wy&&(r.y<-r.r||r.y>st.H+r.r); if(outX||outY){ escape(st,r); continue; } }
    if(r.in) wrapPos(st,r); else { if(st.wx&&(r.x<-r.r*2||r.x>st.W+r.r*2)) wrapPos(st,r); if(st.wy&&(r.y<-r.r*2||r.y>st.H+r.r*2)) wrapPos(st,r); }
    keep.push(r); }
  st.rocks=keep;
  // power-ups on the field
  for(const p of st.pups) p.life--; st.pups=st.pups.filter(p=>p.life>0);
  // drones
  droneMove(st);
  // shockwave pulses (Leviathan)
  for(const p of st.pulses){ p.r+=7; } st.pulses=st.pulses.filter(p=>p.r<p.max); }
function escape(st,r){ st.queue.push({size:r.size,type:r.type}); st.stats.escaped++; st.ev.push({e:'escape',x:r.x,y:r.y,size:r.size}); }

// ---------- collisions ----------
function collide(st){ const G=buildGrid(st), sh=st.ship, dead=new Set();
  // player bullets vs rocks and drones
  for(const b of st.bullets){ if(b.life<=0) continue;
    for(const r of nearRocks(st,G,b.x,b.y,BUL_R+4)){ if(dead.has(r.id)||b.hit.includes(r.id)) continue;
      const rr=r.r+BUL_R; if(dist2(st,b,r)>rr*rr) continue;
      st.stats.hits++; b.hit.push(r.id); const nx=b.vx, ny=b.vy, n=Math.sqrt(nx*nx+ny*ny)||1;
      const res=hitRock(st,r,b,nx/n,ny/n); if(res==='dead') dead.add(r.id);
      if(!b.pierce||res==='clank'){ b.life=0; break; } }
    if(b.life<=0) continue;
    for(const d of st.drones){ const rr=DRONE_R+BUL_R; if(d.hp>0&&dist2(st,b,d)<rr*rr){ st.stats.hits++; hitDrone(st,d,1,true); if(!b.pierce){ b.life=0; break; } } } }
  st.bullets=st.bullets.filter(b=>b.life>0);
  // drone shots vs rocks and the ship
  for(const s of st.dshots){ if(s.life<=0) continue;
    for(const r of nearRocks(st,G,s.x,s.y,8)){ if(dead.has(r.id)) continue; const rr=r.r+4; if(dist2(st,s,r)<rr*rr){ if(damage(st,r,1,'drone',null)) dead.add(r.id); s.life=0; break; } }
    if(s.life>0&&!sh.dead){ const rr=SHIP_R*0.8+4; if(dist2(st,s,sh)<rr*rr&&shipHit(st,'shot')) s.life=0; } }
  st.dshots=st.dshots.filter(s=>s.life>0);
  // the ship vs rocks, drones, power-ups and pulses
  if(!sh.dead){
    for(const r of nearRocks(st,G,sh.x,sh.y,SHIP_R+4)){ if(dead.has(r.id)) continue; const rr=SHIP_R*0.8+r.r*0.85;
      if(dist2(st,sh,r)<rr*rr){ if(sh.dash>0){ if(!r.cc){ r.cc=1; st.stats.closeCall++; st.ev.push({e:'close'}); } continue; }
        if(sh.inv>0||sh.prot>0) continue; const shielded=sh.shield; if(shipHit(st,'rock')&&shielded){ const dx=dxOf(st,sh.x,r.x), dy=dyOf(st,sh.y,r.y), d=Math.sqrt(dx*dx+dy*dy)||1; if(damage(st,r,1,'ship',[dx/d,dy/d])) dead.add(r.id); } break; } }
    for(const d of st.drones){ const rr=SHIP_R*0.8+DRONE_R; if(!sh.dead&&d.hp>0&&dist2(st,sh,d)<rr*rr&&shipHit(st,'drone')) hitDrone(st,d,1,false); }
    for(const p of st.pups){ const rr=SHIP_R+PUP_R; if(!sh.dead&&dist2(st,sh,p)<rr*rr){ p.life=0; const swap=st.power.held; st.power.held=p.k; st.ev.push({e:'pickup',k:p.k,swap,x:p.x,y:p.y}); } }
    st.pups=st.pups.filter(p=>p.life>0);
    for(const p of st.pulses){ const d=Math.sqrt(dist2(st,sh,p)); if(Math.abs(d-p.r)<SHIP_R+6&&!p.hitShip){ p.hitShip=1; shipHit(st,'pulse'); } } }
  st.drones=st.drones.filter(d=>d.hp>0); }

// a bullet hits a rock: returns 'clank' (bounced off), 'hit' or 'dead'
function hitRock(st,r,b,nx,ny){
  if(r.orb===undefined&&r.boss==='bastion'){ const a=angOf(dxOf(st,r.x,b.x),dyOf(st,r.y,b.y)); if(!r.cracks.some(c=>Math.abs(angDiff(c+r.a,a))<=20)){ r.flash=3; st.ev.push({e:'clank',x:b.x,y:b.y}); return 'clank'; } }
  if(r.boss==='leviathan'&&st.rocks.some(o=>o.orb&&o.orb.boss===r.id)){ st.ev.push({e:'clank',x:b.x,y:b.y}); return 'clank'; }
  if(r.arm){ r.arm=false; r.flash=6; st.ev.push({e:'crack',x:r.x,y:r.y,size:r.size}); return 'clank'; }
  return damage(st,r,1,'bullet',[nx,ny])?'dead':'hit'; }

// damage a rock; returns true if destroyed. src: bullet | shock | boom | drone | ship
function damage(st,r,n,src,dir,crack,chain){ if(st.rocks.indexOf(r)<0) return false;
  if(r.boss==='leviathan'&&st.rocks.some(o=>o.orb&&o.orb.boss===r.id)) return false;
  if(r.arm){ r.arm=false; n--; if(n<=0){ r.flash=6; st.ev.push({e:'crack',x:r.x,y:r.y,size:r.size}); return false; } }
  r.hp-=n; r.flash=6;
  if(dir&&r.size<4){ const k=[0,0.6,0.35,0.2][r.size]; r.vx+=dir[0]*k; r.vy+=dir[1]*k; }
  if(r.size===4) bossDamaged(st,r);
  if(r.hp>0){ st.ev.push({e:'hit',x:r.x,y:r.y,size:r.size,id:r.id}); return false; }
  destroy(st,r,src,chain); return true; }
function destroy(st,r,src,chain){ const i=st.rocks.indexOf(r); if(i<0) return; st.rocks.splice(i,1);
  const scored=src!=='drone', c=st.cfg;
  let pts=0;
  if(scored){ st.stats.kills++; if(st.combo.t>0) st.combo.n++; else st.combo.n=0; st.combo.t=COMBO_T; st.stats.comboMax=Math.max(st.stats.comboMax,st.combo.n);
    const cm=Math.min(2,1+0.1*st.combo.n); pts=Math.round((r.size===4?1000:ROCK_PTS[r.size])*(r.type==='gold'?5:1)*c.mult*cm);
    st.score+=pts; checkLife(st); if(r.type==='gold') st.stats.gold++; if(st.combo.n>0) st.ev.push({e:'combo',n:st.combo.n,m:cm}); }
  const brk={e:'break',x:r.x,y:r.y,size:r.size,type:r.type,pts,id:r.id,seed:r.seed}; st.ev.push(brk);
  if(chain!==undefined){ st.chains[chain]=(st.chains[chain]||0)+1; st.stats.chainMax=Math.max(st.stats.chainMax,st.chains[chain]); }
  // volatile: explode and damage what's around (chains)
  if(r.type==='volatile'||r.boss==='leviathan'){ const ch=chain!==undefined?chain:st.nid++; if(chain===undefined) st.chains[ch]=1;
    st.ev.push({e:'explode',x:r.x,y:r.y,r:BOOM_R});
    for(const o of st.rocks.slice()){ if(o.orb||st.rocks.indexOf(o)<0) continue; const d=Math.sqrt(dist2(st,r,o))-o.r; if(d<BOOM_R) damage(st,o,1,src==='drone'?'drone':'boom',null,true,ch); }
    for(const d of st.drones) if(Math.sqrt(dist2(st,r,d))<BOOM_R) hitDrone(st,d,1,src!=='drone'); }
  // pieces
  if(r.size===4) bossBreak(st,r);
  else if(r.size>1){ const n=r.size===3?2:(rnd(st.rng)<0.5?2:3), ns=r.size-1, ice=r.type==='ice';
    const v=Math.sqrt(r.vx*r.vx+r.vy*r.vy), base=angOf(r.vx||0.01,r.vy), sp=Math.max(rockSpeed(st,ns),v*1.15)*(ice?1.7:1);
    const offs=n===2?[-1,1]:[-1,0,1];
    for(const o of offs){ const a=base+o*(16+rint(st.rng,16)), dx=dirX(a), dy=dirY(a);
      const t=r.type==='gold'||r.type==='armour'?'stone':r.type, p=makeRock(st,ns,t,r.x+dx*r.r*0.4,r.y+dy*r.r*0.4,dx*sp,dy*sp); p.in=r.in; st.rocks.push(p); } }
  // a power-up drop
  if(c.pups&&src!=='drone'&&r.size<4){ const ch=r.type==='gold'?1:[0,0.03,0.04,0.07][r.size]; if(rnd(st.rng)<ch){ const ks=c.pupKinds; st.pups.push({x:r.x,y:r.y,k:ks[rint(st.rng,ks.length)],life:PUP_LIFE}); st.ev.push({e:'drop',x:r.x,y:r.y}); } }
  brk.last=!st.queue.length&&!st.pending.length&&!st.rocks.length; }

// ---------- hunter drones ----------
function droneSpawn(st){ const c=st.cfg; if(!c.drones) return;
  if(st.droneT<=0) st.droneT=c.droneEvery[0]+rint(st.rng,c.droneEvery[1]-c.droneEvery[0]+1);
  if(--st.droneT>0) return; if(st.queue.length+st.pending.length+st.rocks.length===0) return;
  spawnDrone(st); st.droneT=c.droneEvery[0]+rint(st.rng,c.droneEvery[1]-c.droneEvery[0]+1); }
function spawnDrone(st){ const R=st.rng, edge=rint(R,4), f=0.15+rnd(R)*0.7, W=st.W, H=st.H, m=30;
  const x=edge===1?W+m:edge===3?-m:W*f, y=edge===0?-m:edge===2?H+m:H*f;
  st.drones.push({id:st.nid++,x,y,vx:0,vy:0,hp:DRONE_HP,t:0,life:DRONE_LIFE,fireT:90,orb:rint(R,256),dir:rnd(R)<0.5?-1:1,flash:0}); st.ev.push({e:'droneIn',x,y}); }
function droneMove(st){ const sh=st.ship, fast=st.cfg.droneFast, sp=fast?3.2:2.2;
  for(const d of st.drones){ d.t++; d.life--; if(d.flash>0) d.flash--;
    let tx, ty;
    if(d.life<=0){ // leaving: head for the nearest edge
      const ex=d.x<st.W/2?-200:st.W+200; tx=ex; ty=d.y; }
    else { d.orb+=0.7*d.dir; const R=260+60*ASIN[aIdx(d.t*1.3)]; tx=sh.x+dirX(d.orb)*R; ty=sh.y+dirY(d.orb)*R;
      tx=Math.max(40,Math.min(st.W-40,tx)); ty=Math.max(40,Math.min(st.H-40,ty)); }
    let dx=st.wx&&d.life>0?wd(tx-d.x,st.W):tx-d.x, dy=st.wy&&d.life>0?wd(ty-d.y,st.H):ty-d.y; const dd=Math.sqrt(dx*dx+dy*dy)||1;
    d.vx=d.vx*0.95+dx/dd*sp*0.05; d.vy=d.vy*0.95+dy/dd*sp*0.05; d.x+=d.vx; d.y+=d.vy;
    if(d.life>0) wrapPos(st,d);
    if(d.life<=0&&(d.x<-120||d.x>st.W+120||d.y<-120||d.y>st.H+120)){ d.hp=0; d.gone=1; continue; }
    // fire slow aimed shots
    if(d.life>0&&!sh.dead&&--d.fireT<=0){ d.fireT=fast?70:100; const sx=dxOf(st,d.x,sh.x), sy=dyOf(st,d.y,sh.y), s=Math.sqrt(sx*sx+sy*sy);
      if(s<620&&st.phase==='play'){ st.dshots.push({x:d.x,y:d.y,vx:sx/s*DSHOT_V,vy:sy/s*DSHOT_V,life:DSHOT_LIFE}); st.ev.push({e:'dshot',x:d.x,y:d.y}); } } }
  st.drones=st.drones.filter(d=>d.hp>0); }
function hitDrone(st,d,n,scored){ if(d.hp<=0) return; d.hp-=n; d.flash=6;
  if(d.hp<=0){ if(scored){ const pts=Math.round(DRONE_PTS*st.cfg.mult); st.score+=pts; checkLife(st); st.stats.droneKills++; st.ev.push({e:'droneKill',x:d.x,y:d.y,pts}); } else st.ev.push({e:'droneKill',x:d.x,y:d.y,pts:0}); }
  else st.ev.push({e:'droneHit',x:d.x,y:d.y}); }

// ---------- bosses (campaign level 15) ----------
const BOSSES={titan:{name:'Titan',hp:30},bastion:{name:'Bastion',hp:36},leviathan:{name:'Leviathan',hp:24}};
function spawnBoss(st,kind){ const B=BOSSES[kind], W=st.W;
  const r=makeRock(st,4,kind==='leviathan'?'volatile':kind==='bastion'?'armour':'stone',W/2,-120,0,1.2); r.arm=false;
  Object.assign(r,{boss:kind,hp:B.hp,maxHp:B.hp,r:kind==='leviathan'?78:138,stage:0,in:true,spin:kind==='bastion'?0.3:0.15,pulseT:240,escortT:0});
  if(kind==='bastion') r.cracks=[0,85,170];
  st.rocks.push(r);
  if(kind==='leviathan'){ for(let i=0;i<8;i++){ const o=makeRock(st,2,'stone',r.x,r.y,0,0); Object.assign(o,{r:42,hp:3,maxHp:3,orb:{boss:r.id,ang:i*32,rad:210}}); st.rocks.push(o); }
    spawnDrone(st); spawnDrone(st); }
  st.ev.push({e:'bossIn',k:kind}); }
function bossStep(st){
  for(const b of st.rocks){ if(b.size!==4) continue;
    if(b.age===160){ const R=st.rng, a=rint(R,256); b.vx=dirX(a)*ROCK_V[4]*st.cfg.spd; b.vy=Math.abs(dirY(a))*ROCK_V[4]*st.cfg.spd*0.5+0.1; }
    if(b.boss==='leviathan'){
      for(const o of st.rocks) if(o.orb&&o.orb.boss===b.id){ o.orb.ang+=0.6; const nx=b.x+dirX(o.orb.ang)*o.orb.rad, ny=b.y+dirY(o.orb.ang)*o.orb.rad; o.vx=nx-o.x; o.vy=ny-o.y; if(Math.abs(o.vx)>50) o.vx=0; if(Math.abs(o.vy)>50) o.vy=0; o.x=nx; o.y=ny; wrapPos(st,o); }
      if(--b.pulseT<=0&&b.age>160){ b.pulseT=240; st.pulses.push({x:b.x,y:b.y,r:b.r,max:340}); st.ev.push({e:'pulse',x:b.x,y:b.y}); }
      if(st.drones.length<2&&++b.escortT>=900){ b.escortT=0; spawnDrone(st); } } } }
function bossDamaged(st,b){ const lost=b.maxHp-b.hp;
  if(b.boss==='titan'){ const s=b.hp<=10?2:b.hp<=20?1:0; while(b.stage<s){ b.stage++; shed(st,b,3,2); st.ev.push({e:'bossStage',k:b.boss,n:b.stage}); } }
  if(b.boss==='bastion'){ const s=Math.floor(lost/6); while(b.stage<s&&b.hp>0){ b.stage++; shed(st,b,2,2); st.ev.push({e:'bossStage',k:b.boss,n:b.stage});
      if(b.hp<=b.maxHp/2&&!b.called){ b.called=1; spawnDrone(st); } } }
  if(b.boss==='leviathan'){ const s=b.hp<=12?1:0; if(b.stage<s){ b.stage=s; st.ev.push({e:'bossStage',k:b.boss,n:1}); } } }
function shed(st,b,size,n){ for(let i=0;i<n;i++){ const a=rint(st.rng,256), dx=dirX(a), dy=dirY(a), sp=rockSpeed(st,size);
    const p=makeRock(st,size,'stone',b.x+dx*(b.r*0.7),b.y+dy*(b.r*0.7),dx*sp,dy*sp); p.in=true; st.rocks.push(p); } }
function bossBreak(st,b){ st.ev.push({e:'bossDown',k:b.boss,x:b.x,y:b.y});
  for(let i=0;i<3;i++){ const a=i*85+rint(st.rng,20), dx=dirX(a), dy=dirY(a), sz=b.boss==='leviathan'?2:3, sp=rockSpeed(st,sz);
    const p=makeRock(st,sz,b.boss==='leviathan'?'volatile':'stone',b.x+dx*b.r*0.5,b.y+dy*b.r*0.5,dx*sp,dy*sp); p.in=true; st.rocks.push(p); } }

// ---------- Endless waves ----------
function nextWave(st){ st.wave++; const w=waveSpec(st.wave), c=st.cfg;
  Object.assign(c,{spd:w.spd,drones:w.drones,droneEvery:w.droneEvery,droneFast:w.droneFast,group:w.group,calm:w.calm,groupT:w.groupT});
  fillQueue(st,w.count,w.mix,w.types); st.total=remaining(st); st.spawnT=90; st.ev.push({e:'waveStart',n:st.wave}); }

// ---------- snapshots and fingerprints ----------
function snapshot(st){ const o=JSON.parse(JSON.stringify(st)); o.ev=[]; return o; }
function fingerprint(st){ const a=[st.tick,st.score,st.lives,st.rocks.length,st.bullets.length,st.queue.length,st.wave,Math.round(st.ship.x*100),Math.round(st.ship.y*100),Math.round(st.ship.a*100)];
  for(const r of st.rocks) a.push(r.id,r.size,r.hp,Math.round(r.x*100),Math.round(r.y*100));
  for(const d of st.drones) a.push(d.id,Math.round(d.x*100),Math.round(d.y*100)); return fnv(a); }

// ---------- bots: they play through step() with real inputs ----------
// casual: slower reactions, noisy aim, rarely dashes, uses power-ups at once (an average player)
// strong: quick reactions, good lead, dashes when a hit is about to land, saves the shield
const BOT_KINDS={casual:{react:14,noise:10,lead:0.5,dash:0.3,safe:130,fireErr:10},strong:{react:3,noise:1.5,lead:1,dash:1,safe:190,fireErr:5}};
function botThink(st,o,mem){ const sh=st.ship, R=o.R, out=[]; if(sh.dead||st.phase!=='play'&&st.phase!=='break') return [['stick',0,0],['r','fire']];
  // threats: time to closest approach for every rock and drone shot
  let danger=null, dt=1e9;
  const consider=(x,y,vx,vy,rad)=>{ const px=dxOf(st,sh.x,x), py=dyOf(st,sh.y,y), rvx=vx-sh.vx, rvy=vy-sh.vy, vv=rvx*rvx+rvy*rvy;
    const t=vv>1e-6?Math.max(0,-(px*rvx+py*rvy)/vv):0, cx=px+rvx*t, cy=py+rvy*t, miss=Math.sqrt(cx*cx+cy*cy), d=Math.sqrt(px*px+py*py);
    if(miss<rad+SHIP_R+12&&t<70&&t<dt){ dt=t; danger={px,py,rvx,rvy,t,d,rad}; }
    if(d-rad<o.safe*0.55&&d-rad<(danger?danger.d-danger.rad:1e9)&&!danger){ danger={px,py,rvx,rvy,t:d/3,d,rad}; dt=d/3; } };
  for(const r of st.rocks) consider(r.x,r.y,r.vx,r.vy,r.r);
  for(const s of st.dshots) consider(s.x,s.y,s.vx,s.vy,4);
  for(const d of st.drones) consider(d.x,d.y,d.vx,d.vy,DRONE_R);
  for(const p of st.pulses){ const d=Math.sqrt(dist2(st,sh,p)); if(d>p.r&&d-p.r<60&&sh.dashCd===0&&rnd(R)<o.dash) out.push(['p','dash']); }
  // dash out of an imminent hit
  if(danger&&dt<14&&sh.dashCd===0&&!sh.prot&&rnd(R)<o.dash*0.5+0.1){ const a=angOf(-danger.rvy,danger.rvx); out.push(['stick',Math.round(dirX(a)*64),Math.round(dirY(a)*64)],['p','dash']); return out; }
  // power-ups: casual uses at once; strong saves the shield for later and fires shockwaves when crowded
  if(st.power.held){ const k=st.power.held, crowd=st.rocks.filter(r=>dist2(st,sh,r)<SHOCK_R*SHOCK_R).length;
    if(o.dash<1||(k!=='shield'&&k!=='shock')||(k==='shield'&&!sh.shield)||(k==='shock'&&crowd>=3)) out.push(['p','use']); }
  if(--mem.wait>0&&!(danger&&dt<25)) return out; mem.wait=o.react;
  // evade: thrust away from the closest threat
  if(danger&&(dt<40||danger.d-danger.rad<o.safe*0.6)){ let ax=-danger.px, ay=-danger.py; const pl=-danger.rvy, pr=danger.rvx; // sideways to its path works better than straight back
    const s=(ax*pl+ay*pr)>=0?1:-1; ax=ax*0.5+pl*s; ay=ay*0.5+pr*s;
    // keep off the walls
    const mx=st.W*0.5-sh.x, my=st.H*0.5-sh.y; if(!st.wx&&(sh.x<120||sh.x>st.W-120)) ax+=mx*0.02; if(!st.wy&&(sh.y<120||sh.y>st.H-120)) ay+=my*0.02;
    const n=Math.sqrt(ax*ax+ay*ay)||1; mem.mode='evade'; out.push(['stick',Math.round(ax/n*64),Math.round(ay/n*64)],['r','fire']); return out; }
  // pick a target: the most threatening rock in range, else the nearest power-up, else drift to the middle
  let best=null, bv=1e9;
  for(const r of st.rocks){ if(r.orb===undefined&&r.boss==='leviathan'&&st.rocks.some(q=>q.orb)) continue; const d=Math.sqrt(dist2(st,sh,r))-r.r; let v=d;
    const px=dxOf(st,r.x,sh.x), py=dyOf(st,r.y,sh.y); if(px*r.vx+py*r.vy>0) v-=120; if(r.boss==='bastion') v+=60; if(v<bv){ bv=v; best=r; } }
  for(const d of st.drones){ const v=Math.sqrt(dist2(st,sh,d))-150; if(v<bv){ bv=v; best=d; } }
  let tx=null, ty=null;
  if(best&&bv<700){ const px=dxOf(st,sh.x,best.x), py=dyOf(st,sh.y,best.y), d=Math.sqrt(px*px+py*py), t=d/BUL_V*o.lead;
    tx=px+(best.vx-sh.vx)*t; ty=py+(best.vy-sh.vy)*t;
    if(best.boss==='bastion'){ const c=best.cracks.map(c=>c+best.a).sort((a,b)=>Math.abs(angDiff(angOf(-px,-py),a))-Math.abs(angDiff(angOf(-px,-py),b)))[0]; tx+=dirX(c)*best.r*0.8; ty+=dirY(c)*best.r*0.8; } }
  const pu=st.pups.find(p=>dist2(st,sh,p)<350*350&&!st.power.held);
  if(pu&&(!best||bv>180)){ const px=dxOf(st,sh.x,pu.x), py=dyOf(st,sh.y,pu.y), n=Math.sqrt(px*px+py*py)||1; out.push(['stick',Math.round(px/n*64),Math.round(py/n*64)],['r','fire']); return out; }
  if(tx===null){ const mx=st.W/2-sh.x, my=st.H/2-sh.y, n=Math.sqrt(mx*mx+my*my); if(n>120) out.push(['stick',Math.round(mx/n*50),Math.round(my/n*50)]); else out.push(['stick',0,0]); out.push(['r','fire']); return out; }
  const ta=angOf(tx,ty)+(rnd(R)-0.5)*o.noise*2, n=16; out.push(['stick',Math.round(dirX(ta)*n),Math.round(dirY(ta)*n)]);
  if(Math.abs(angDiff(sh.a,ta))<o.fireErr+4&&Math.sqrt(tx*tx+ty*ty)<BUL_V*BUL_LIFE*1.05) out.push(['p','fire']); else out.push(['r','fire']);
  // drift toward the middle when idle-ish and far from it
  return out; }
function botPlay(cfg,kind,maxTicks,onTick,botSeed){ const st=newGame(Object.assign({},cfg,{fire:'hold'})), o=Object.assign({R:rngFrom((cfg.seed||'')+'|bot'+kind+'|'+(botSeed||0))},BOT_KINDS[kind]), mem={wait:0};
  while(st.phase!=='over'&&st.phase!=='done'&&st.tick<maxTicks){ const ins=botThink(st,o,mem); step(st,ins); if(onTick) onTick(st); }
  if(!st.result) finish(st,false); return st; }
