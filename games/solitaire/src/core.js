// ===================== Solitaire core =====================
// Save, XP and levels, hints, records, stars, the deal bank, Classic picks, campaign, the Daily, achievements,
// cosmetics, backup and the Arcade contract. No DOM: storage is passed in, so Node tests can run it.
const VERSION='0.1.0', GAME_ID='solitaire', KEY='solitaire.v1', SUMKEY='arcade.summary.solitaire', ARCADE_KEY='arcade.v1';
const MAXL=10, LVXP=[0,50,150,300,525,825,1225,1725,2375,3175]; // Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LVXP[l]) l++; return l; };
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];
const HINT_CAP=5, HINT_MAX=99;
const DRAWS=[1,3], PASS_OPTS=[0,3,1];
const passName=p=>p===0?'Unlimited':p===1?'1 pass':p+' passes';

function defSave(reduced){ return {v:1,xp:0,ach:{},camp:{},campTab:0,hints:HINT_CAP,hintDate:'',
  setup:{draw:1,passes:0,open:false,grade:'any'},used:{},
  rec:{d1:defRec(),d3:defRec(),best:{},total:0,underPar:0},
  daily:{date:'',scored:false,cleared:false,stars:0,moves:0,time:0,assisted:false,run:null,practice:null},
  dhist:{},dstreak:{cur:0,best:0,last:''},dweek:[0,0,0,0,0,0,0],dclears:0,
  look:{back:'lattice',table:'felt',court:'classic',frame:'rounded',badge:'outline',deal:'cascade',flip:'flip',trail:'none',glow:'none',win:'none',track:'parlour',amb:'none',sound:'soft'},
  prefs:{tap:'best',safe:false,warn:true,large:false,four:false,contrast:false,speed:'normal'},
  sfx:true,music:true,haptics:true,motion:!reduced,appearance:'system',fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  run:null,seenVer:'',bk:{last:0},howto:false}; }
function defRec(){ return {games:0,wins:0,cur:0,best:0}; }
const NESTED=['setup','rec','daily','dstreak','look','prefs','bk'];
// Old saves missing new fields are filled in from defSave() (one level deep for nested groups)
function loadSave(raw,reduced){ const d=defSave(reduced); let s=null; try{ s=raw?JSON.parse(raw):null; }catch(e){ s=null; }
  if(!s||typeof s!=='object') return d;
  for(const k in d){ if(s[k]===undefined) continue;
    if(NESTED.includes(k)&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) d[k]=Object.assign(d[k],s[k]); else d[k]=s[k]; }
  d.rec.d1=Object.assign(defRec(),d.rec.d1); d.rec.d3=Object.assign(defRec(),d.rec.d3);
  return d; }

// ---------- the deal bank ----------
const GIDX=['easy','medium','hard','expert'];
const BANK={}, BANK_OPEN={};
function bankList(draw){ if(!BANK[draw]){ const s=BANK_RAW[draw], o=[]; for(let i=0;i+7<=s.length;i+=7)
      o.push({draw,n:parseInt(s.slice(i,i+3),36),grade:GIDX[+s[i+3]],par:parseInt(s.slice(i+4,i+6),36),passes:+s[i+6],k:i/7});
    BANK[draw]=o; } return BANK[draw]; }
function openList(draw){ if(!BANK_OPEN[draw]){ const s=BANK_OPEN_RAW[draw], o=[], main=bankList(draw);
    for(let i=0;i+4<=s.length;i+=4){ const n=parseInt(s.slice(i,i+3),36), m=main.find(x=>x.n===n); o.push(Object.assign({},m,{grade:GIDX[+s[i+3]],open:true})); }
    BANK_OPEN[draw]=o; } return BANK_OPEN[draw]; }
const ceil5=x=>Math.ceil(x/5)*5;
// par time from the bot's pace: par moves × seconds per move for this draw mode and grade, rounded up to 5 s
const parTimeOf=(draw,grade,par)=>ceil5(par*PAR_SPM[draw][grade]);
const passesOk=(d,passes)=>passes===0||(d.passes!==0&&d.passes<=passes);

// ---------- Classic: pick a deal, no repeats until that part of the bank is used up ----------
function classicPool(setup){ const list=setup.open?openList(setup.draw):bankList(setup.draw);
  return list.filter(d=>(setup.grade==='any'||d.grade===setup.grade)&&passesOk(d,setup.passes)); }
const poolKey=setup=>[setup.draw,setup.open?'o':'c',setup.grade,setup.passes].join('|');
function pickClassic(S,setup,rnd){ const pool=classicPool(setup); if(!pool.length) return null; const key=poolKey(setup);
  let used=S.used[key]||[]; let left=pool.filter(d=>!used.includes(d.n)); if(!left.length){ used=[]; left=pool; }
  const d=left[Math.floor(rnd()*left.length)]; used.push(d.n); S.used[key]=used; return Object.assign({},d); }
const dealCfg=(d,extra)=>Object.assign({draw:d.draw,passes:0,open:!!d.open},extra||{});

// ---------- cosmetics ----------
// Unlocks: lvl (XP level), req (an achievement) or stars (campaign star total). Card faces always keep standard suits,
// clear red and black (or 4 colours) and large corner letters: cosmetics change everything around that.
const COS={
 back:[{id:'lattice',name:'Classic Lattice'},{id:'crimson',name:'Crimson',lvl:2},{id:'navy',name:'Navy Plain',req:'c10'},{id:'botanical',name:'Botanical',lvl:5},{id:'geometric',name:'Geometric',lvl:7},
   {id:'starfield',name:'Starfield',lvl:9},{id:'deco',name:'Art Deco',lvl:10},{id:'shimmer',name:'Shimmer',stars:30,anim:1},{id:'nightsky',name:'Night Sky',stars:75,anim:1},{id:'clockwork',name:'Clockwork',stars:135,anim:1}],
 table:[{id:'felt',name:'Green Felt'},{id:'walnut',name:'Walnut',lvl:3},{id:'slate',name:'Slate',lvl:6},{id:'paper',name:'Paper',lvl:8},{id:'midnight',name:'Midnight',lvl:10},{id:'space',name:'Space',req:'perf3'}],
 court:[{id:'classic',name:'Classic'},{id:'minimal',name:'Minimal',lvl:5},{id:'botanical',name:'Botanical',lvl:9},{id:'pixel',name:'Pixel',req:'c100'},{id:'constellation',name:'Constellation',req:'puzzle'}],
 frame:[{id:'rounded',name:'Rounded'},{id:'gilt',name:'Gilt Edge',lvl:6},{id:'ink',name:'Ink Outline',lvl:8},{id:'shadow',name:'Soft Shadow',lvl:10}],
 badge:[{id:'outline',name:'Simple outline'},{id:'suits',name:'Suit symbols',lvl:3},{id:'crests',name:'Crests',req:'camp2'},{id:'stars',name:'Constellations',req:'dstreak'}],
 deal:[{id:'cascade',name:'Cascade'},{id:'riffle',name:'Riffle',lvl:5},{id:'fan',name:'Fan-out',lvl:9}],
 flip:[{id:'flip',name:'Flip'},{id:'fade',name:'Fade',lvl:4},{id:'spin',name:'Spin',lvl:8}],
 trail:[{id:'none',name:'No trail'},{id:'soft',name:'Soft trail',lvl:6}],
 glow:[{id:'none',name:'No glow'},{id:'glow',name:'Landing glow',lvl:2}],
 win:[{id:'none',name:'None'},{id:'bounce',name:'Bouncing Cascade',lvl:2},{id:'fountain',name:'Card Fountain',lvl:7},{id:'fireworks',name:'Fireworks',lvl:10},{id:'burst',name:'Foundation Burst',req:'clean'}],
 track:[{id:'parlour',name:'Parlour'},{id:'lamplight',name:'Lamplight',lvl:10},{id:'daylight',name:'Daylight',req:'dstar'}],
 amb:[{id:'none',name:'No ambience'},{id:'rain',name:'Rain',lvl:4},{id:'cafe',name:'Café',lvl:7},{id:'fire',name:'Fireplace',lvl:9}],
 sound:[{id:'soft',name:'Soft'},{id:'wood',name:'Wooden',lvl:4},{id:'chip',name:'Chiptune',lvl:8}]};
const COS_KINDS=[['back','Card back'],['table','Table'],['court','Court art'],['frame','Card frame'],['badge','Empty-pile badges'],['deal','Deal animation'],['flip','Flip style'],
  ['trail','Move trail'],['glow','Foundation glow'],['win','Win effect'],['track','Music'],['amb','Ambience'],['sound','Sound pack']];
const owned=(S,it)=>(!it.lvl||levelOf(S.xp)>=it.lvl)&&(!it.req||!!S.ach[it.req])&&(!it.stars||totalStars(S)>=it.stars);
const findCos=(kind,id)=>COS[kind].find(c=>c.id===id)||COS[kind][0];
function rewardsAt(level){ const o=[]; for(const [k,n] of COS_KINDS) for(const it of COS[k]) if(it.lvl===level) o.push(`${it.name} (${n.toLowerCase()})`); return o; }
const STARTER='Classic Lattice back, Green Felt table, Classic court art, Parlour music, Soft sounds';
const starUnlocks=()=>COS_KINDS.flatMap(([k,n])=>COS[k].filter(it=>it.stars).map(it=>({stars:it.stars,text:`${it.name} (${n.toLowerCase()})`}))).sort((a,b)=>a.stars-b.stars);

// ---------- hints: refilled daily to 5, +1 per level-up, earned extras stack to 99 ----------
function refreshHints(S,today){ if(S.hintDate!==today){ S.hints=Math.max(S.hints||0,HINT_CAP); S.hintDate=today; } return S.hints; }
function useHint(S){ if(S.hints<=0) return false; S.hints--; return true; }

// ---------- XP ----------
function addXP(S,n){ const before=levelOf(S.xp); S.xp+=Math.max(0,Math.round(n)); const after=levelOf(S.xp), rewards=[];
  for(let l=before+1;l<=after;l++) rewards.push(...rewardsAt(l));
  const ups=after-before; if(ups>0) S.hints=Math.min(HINT_MAX,(S.hints||0)+ups); // +1 hint per level-up
  return {xp:Math.round(n),before,after,rewards,hints:ups}; }
const xpNext=S=>{ const l=levelOf(S.xp); return l>=MAXL?null:LVXP[l]; };
const CLASSIC_XP={easy:10,medium:15,hard:22,expert:30};
// Classic win: by grade, +5 for Draw 3, +5 for 1 pass; an assisted win (a hint was used) earns half. Losses earn nothing.
function classicXP(d,cfg,assisted){ let x=CLASSIC_XP[d.grade]+(cfg.draw===3?5:0)+(cfg.passes===1?5:0); return assisted?Math.ceil(x/2):x; }

// ---------- stars ----------
// Classic and Daily: ★ clear, ★ at or under par moves, ★ at or under par time.
function winStars(won,moves,time,par,parTime){ return [won?1:0,won&&moves<=par?1:0,won&&time<=parTime*1000?1:0]; }
const fmtTime=ms=>{ const s=Math.floor(ms/1000); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

// ---------- records ----------
// Wins, win rate and best and current win streak, per draw mode. Best time and fewest moves per draw mode and grade
// (unassisted wins only). A loss is recorded when a game is abandoned (New deal, or leaving a game that was started).
function recordClassic(S,d,cfg,won,moves,time,assisted){ const R=S.rec, r=R['d'+cfg.draw], fresh=[];
  r.games++; if(won){ r.wins++; r.cur++; r.best=Math.max(r.best,r.cur); R.total++; } else r.cur=0;
  if(won&&!assisted){ const k=cfg.draw+'|'+d.grade, b=R.best[k]||{t:0,m:0};
    if(!b.t||time<b.t){ b.t=time; fresh.push('Best time'); } if(!b.m||moves<b.m){ b.m=moves; fresh.push('Fewest moves'); } R.best[k]=b; }
  if(won&&moves<=d.par) R.underPar++;
  return fresh; }

// ---------- campaign ----------
const campOf=(S,id)=>S.camp[id]||{c:0,s:[0,0,0],bm:0,bt:0,tries:0};
const campStars=(S,id)=>campOf(S,id).s.reduce((a,b)=>a+b,0);
const totalStars=S=>LEVELS.reduce((a,L)=>a+campStars(S,L.id),0);
const campCleared=(S,id)=>!!campOf(S,id).c;
const campDone=(S,c)=>campCleared(S,LEVELS.find(L=>L.camp===c&&L.n===15).id);
const campOpen=(S,c)=>c===0||campDone(S,c-1);
// clearing a level unlocks the next; clearing level 15 unlocks the next campaign
const unlocked=(S,Lv)=>campOpen(S,Lv.camp)&&(Lv.n===1||campCleared(S,LEVELS.find(L=>L.camp===Lv.camp&&L.n===Lv.n-1).id));
const levelById=id=>LEVELS.find(L=>L.id===id);
// Stars build up across attempts (each is earned once). Clearing is required for any star: ★ par moves, ★ par time, ★ no hints.
function campaignResult(S,Lv,won,moves,time,hints){ const c=campOf(S,Lv.id), C=CAMPS[Lv.camp], wasDone=campDone(S,Lv.camp), fresh=[]; let xp=0;
  const earned=[won&&moves<=Lv.par?1:0,won&&time<=Lv.parTime*1000?1:0,won&&!hints?1:0];
  c.tries=(c.tries||0)+1;
  if(won){ c.c=1; if(!c.bm||moves<c.bm) c.bm=moves; if(!c.bt||time<c.bt) c.bt=time; }
  earned.forEach((e,i)=>{ if(e&&!c.s[i]){ c.s[i]=1; fresh.push(i); xp+=C.xp; } });
  S.camp[Lv.id]=c; const finished=!wasDone&&campDone(S,Lv.camp); if(finished) xp+=C.bonus;
  return {earned,fresh,stars:campStars(S,Lv.id),xp,finished}; }

// ---------- Daily ----------
// SOLD1|YYYY-MM-DD picks a deal from the bank by the day's required difficulty. Passes are unlimited every day.
const DAILY_TABLE=[ // index = getDay(): 0 Sunday … 6 Saturday
  {draw:3,grades:['hard']},{draw:1,grades:['easy']},{draw:1,grades:['easy','medium']},{draw:1,grades:['medium']},
  {draw:1,grades:['medium','hard']},{draw:1,grades:['hard']},{draw:3,grades:['medium']}];
const weekdayOf=date=>{ const [y,m,d]=date.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay(); };
function dailyDeal(date){ const w=DAILY_TABLE[weekdayOf(date)], pool=bankList(w.draw).filter(d=>w.grades.includes(d.grade));
  const r=rngFor('SOLD1|'+date); const d=pool[Math.floor(r()*pool.length)];
  return Object.assign({},d,{daily:date,parTime:parTimeOf(d.draw,d.grade,d.par)}); }
function dailyFor(S,date){ if(S.daily.date!==date) S.daily={date,scored:false,cleared:false,stars:0,moves:0,time:0,assisted:false,run:null,practice:null}; return S.daily; }
const dayNum=date=>{ const [y,m,d]=date.split('-').map(Number); return Math.round(Date.UTC(y,m-1,d)/864e5); };
// The one scored attempt. A loss (giving up) counts as the attempt too.
function dailyResult(S,date,won,moves,time,assisted,today){ const d=dailyFor(S,date); if(d.scored) return null; const dd=dailyDeal(date);
  const st=winStars(won,moves,time,dd.par,dd.parTime), stars=st.reduce((a,b)=>a+b,0);
  Object.assign(d,{scored:true,cleared:won,stars,moves,time,assisted,run:null});
  S.dhist[date]={won,stars,moves,time,assisted}; const keys=Object.keys(S.dhist).sort(); while(keys.length>7) delete S.dhist[keys.shift()]; // the last 7 Dailies
  let xp=0;
  if(won){ S.dclears=(S.dclears||0)+1; xp=20*(date===today?2:1);
    const n=dayNum(date), last=S.dstreak.last?dayNum(S.dstreak.last):-99;
    if(n!==last){ S.dstreak.cur=n===last+1?S.dstreak.cur+1:1; S.dstreak.last=date; S.dstreak.best=Math.max(S.dstreak.best,S.dstreak.cur); }
    if(stars===3) S.dweek[weekdayOf(date)]=1; }
  return {stars:st,xp,won}; }
// a streak is broken once a whole day has passed without a cleared Daily
function streakNow(S,today){ const last=S.dstreak.last?dayNum(S.dstreak.last):-99; if(dayNum(today)-last>1) S.dstreak.cur=0; return S.dstreak.cur; }
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function shareLine(date,moves,time,stars,assisted,won){ const [,m,dd]=date.split('-').map(Number), n=stars.reduce?stars.reduce((a,b)=>a+b,0):stars;
  return `Solitaire Daily · ${WD[weekdayOf(date)]} ${dd} ${MON[m-1]} · ${won?moves+' moves · '+fmtTime(time):'not cleared'} · ${'★'.repeat(n)}${'☆'.repeat(3-n)}${assisted?' · hinted':''}`; }

// ---------- achievements ----------
const ACH=[
 {id:'c1',g:'Classic clears',name:'First Clear',desc:'Win a Classic game',n:1},
 {id:'c10',g:'Classic clears',name:'Regular',desc:'Win 10 Classic games',n:10,reward:'Navy Plain back'},
 {id:'c25',g:'Classic clears',name:'Dedicated',desc:'Win 25 Classic games',n:25},
 {id:'c50',g:'Classic clears',name:'Card Shark',desc:'Win 50 Classic games',n:50},
 {id:'c100',g:'Classic clears',name:'Centurion',desc:'Win 100 Classic games',n:100,reward:'Pixel court art'},
 {id:'c250',g:'Classic clears',name:'Devotee',desc:'Win 250 Classic games',n:250},
 {id:'c500',g:'Classic clears',name:'Grand Master',desc:'Win 500 Classic games',n:500},
 {id:'c1000',g:'Classic clears',name:'Legend',desc:'Win 1,000 Classic games',n:1000},
 {id:'s3',g:'Classic skill',name:'Hot Streak',desc:'Win 3 in a row'},
 {id:'s5',g:'Classic skill',name:'On Fire',desc:'Win 5 in a row'},
 {id:'s10',g:'Classic skill',name:'Unstoppable',desc:'Win 10 in a row'},
 {id:'draw3',g:'Classic skill',name:'Triple Draw',desc:'Win a Draw 3 game'},
 {id:'onepass',g:'Classic skill',name:'One Shot',desc:'Win with 1 pass'},
 {id:'noundo',g:'Classic skill',name:'No Take-Backs',desc:'Win without undo'},
 {id:'open',g:'Classic skill',name:'Open Book',desc:'Win an Open deck game'},
 {id:'quick',g:'Classic skill',name:'Quick Hands',desc:'Win in under 3 minutes'},
 {id:'light',g:'Classic skill',name:'Lightning',desc:'Win in under 2 minutes'},
 {id:'par',g:'Classic skill',name:'Under Par',desc:'Win at or under par moves'},
 {id:'expert',g:'Classic skill',name:'Expert Dealer',desc:'Win an Expert deal'},
 {id:'clean',g:'Classic skill',name:'Clean Sweep',desc:'Win a Hard or Expert deal with no hints and no undo',reward:'Foundation Burst win effect'},
 {id:'camp1',g:'Campaign',name:'Draw 1 Graduate',desc:'Finish Draw 1 Basics'},
 {id:'camp2',g:'Campaign',name:'Mixed Master',desc:'Finish Mixed',reward:'Crests badges'},
 {id:'camp3',g:'Campaign',name:'Draw 3 Master',desc:'Finish Draw 3 Masters'},
 {id:'perf1',g:'Campaign',name:'Perfect Basics',desc:'3 stars on every Draw 1 Basics level'},
 {id:'perf2',g:'Campaign',name:'Perfect Mix',desc:'3 stars on every Mixed level'},
 {id:'perf3',g:'Campaign',name:'Perfect Masters',desc:'3 stars on every Draw 3 Masters level',reward:'Space table'},
 {id:'puzzle',g:'Campaign',name:'Puzzle Solver',desc:'3 stars on all three puzzle levels',reward:'Constellation court art'},
 {id:'dstar',g:'Daily',name:'Daily Star',desc:'3 stars on a Daily',reward:'Daylight music'},
 {id:'dstreak',g:'Daily',name:'Daily Streak',desc:'Clear the Daily 7 days in a row',reward:'Constellations badges'},
 {id:'dweek',g:'Daily',name:'Full Week',desc:'3 stars on every weekday\'s Daily (Monday–Sunday, any weeks)'},
 {id:'dreg',g:'Daily',name:'Daily Regular',desc:'Clear 30 Dailies',n:30}];
// ctx: {mode:'classic'|'campaign'|'daily', won, cfg, deal, moves, time, hints, undos, practice}
function checkAch(S,ctx){ const got=[], give=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); got.push(id); } };
  if(ctx.practice) return got;
  if(ctx.mode==='classic'&&ctx.won){ const R=S.rec, n=R.total, cur=Math.max(R.d1.cur,R.d3.cur), c=ctx.cfg, d=ctx.deal;
    for(const a of ACH) if(a.g==='Classic clears'&&n>=a.n) give(a.id);
    if(cur>=3) give('s3'); if(cur>=5) give('s5'); if(cur>=10) give('s10');
    if(c.draw===3) give('draw3'); if(c.passes===1) give('onepass'); if(!ctx.undos) give('noundo'); if(c.open) give('open');
    if(ctx.time<180000) give('quick'); if(ctx.time<120000) give('light'); if(ctx.moves<=d.par) give('par');
    if(d.grade==='expert') give('expert'); if((d.grade==='hard'||d.grade==='expert')&&!ctx.hints&&!ctx.undos) give('clean'); }
  if(ctx.mode==='campaign'){ CAMPS.forEach((cp,i)=>{ if(campDone(S,i)) give('camp'+(i+1)); if(LEVELS.filter(L=>L.camp===i).every(L=>campStars(S,L.id)>=3)) give('perf'+(i+1)); });
    if(LEVELS.filter(L=>L.type==='puzzle').every(L=>campStars(S,L.id)>=3)) give('puzzle'); }
  if(ctx.mode==='daily'){ if(S.daily.stars>=3) give('dstar'); if(S.dstreak.cur>=7) give('dstreak'); if(S.dweek.every(Boolean)) give('dweek'); if((S.dclears||0)>=30) give('dreg'); }
  return got; }
const achProgress=(S,a)=>a.g==='Classic clears'?Math.min(S.rec.total,a.n):a.id==='dreg'?Math.min(S.dclears||0,30):a.id==='dweek'?S.dweek.filter(Boolean).length:null;

// ---------- backup (Solitaire only) ----------
// SOLITAIRE1Z.<base64 gzip> where the app can compress, SOLITAIRE1.<base64> otherwise. Both decode here (the app inflates Z).
const b64e=str=>{ const u=new TextEncoder().encode(str); let b=''; for(let i=0;i<u.length;i++) b+=String.fromCharCode(u[i]); return btoa(b); };
const b64d=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
function backupPlain(S){ return 'SOLITAIRE1.'+b64e(JSON.stringify(S)); }
function parseBackup(text){ const m=/SOLITAIRE1\.([A-Za-z0-9+/=]+)/.exec(String(text||'')); if(!m) return null;
  try{ const o=JSON.parse(b64d(m[1])); if(!o||typeof o!=='object'||typeof o.xp!=='number') return null; return o; }catch(e){ return null; } }

// ---------- Arcade contract ----------
// Shared settings live in arcade.v1 (read only, never written). They're applied in memory only.
function readArcade(store){ try{ const a=JSON.parse(store.get(ARCADE_KEY)||'null'); if(!a||typeof a!=='object') return null; return a; }catch(e){ return null; } }
function applyShared(S,a){ if(!a) return S; const o=Object.assign({},S), set=a.set||{}; for(const k of SHARED) if(set[k]!==undefined) o[k]=set[k]; if(typeof a.name==='string'&&a.name) o.name=a.name; return o; }
function summary(S){ const l=levelOf(S.xp);
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:l,xpNext:xpNext(S),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Wins',String(S.rec.total)],['Campaign stars',`${totalStars(S)}/${LEVELS.length*3}`],['Daily streak',String(S.dstreak.cur)]],
    last:Date.now()}; }
