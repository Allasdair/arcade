// ===================== Linefall core =====================
// Save, XP and levels, campaign stars and gating, records, Daily Blitz, achievements, cosmetics, backup and the
// Arcade contract. No DOM: storage is passed in as {get(key), set(key,value)} so Node tests can run it.
const VERSION='0.1.0', GAME_ID='linefall', KEY='linefall.v1', SUMKEY='arcade.summary.linefall', ARCADE_KEY='arcade.v1';
const MAXL=10, LV=[0,50,150,300,525,825,1225,1725,2375,3175]; // Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LV[l]) l++; return l; };
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];

function defSave(reduced){ return {v:1,xp:0,ach:{},camp:{},rec:{},
  daily:{date:'',scored:false,score:0,lines:0,stars:0,run:null,practice:0},dhist:{},dbest:0,dstreak:{cur:0,best:0,last:''},
  setup:{board:'medium',speed:'1',set:'classic',hold:true,next:5,ghost:true,garbage:false,fading:false},
  ctl:{layout:'dpad',das:160,arr:33,sdf:20,size:'normal'},
  look:{palette:'dusk',style:'flat',theme:'clean',bezel:'slate',track:'signal',fx:'none',sound:'soft',color:'height'},
  danger:true,fastFx:false,sfx:true,music:true,haptics:true,motion:!reduced,appearance:'system',fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  stats:{games:0,lines:0,quads:0,twists:0,sweeps:0,pieces:0,ticks:0},run:null,seenVer:'',bk:{last:0},howto:false}; }
// Old saves missing new fields are filled in from defSave() (one level deep for nested groups)
function loadSave(raw,reduced){ const d=defSave(reduced); let s=null; try{ s=raw?JSON.parse(raw):null; }catch(e){ s=null; }
  if(!s||typeof s!=='object') return d;
  for(const k in d){ if(s[k]===undefined) continue;
    if(d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k])&&s[k]&&typeof s[k]==='object'&&['setup','ctl','look','daily','dstreak','stats','bk'].includes(k)) d[k]=Object.assign(d[k],s[k]);
    else d[k]=s[k]; }
  return d; }

// ---------- cosmetics ----------
const COS={
 palette:[{id:'dusk',name:'Dusk'},{id:'ember',name:'Ember',lvl:2},{id:'ocean',name:'Ocean',lvl:5},{id:'neon',name:'Neon',lvl:10},
   {id:'mono',name:'Mono',req:'nosafety'},{id:'pastel',name:'Pastel',req:'gentle'},{id:'retro',name:'Retro Green',req:'ch2'}],
 style:[{id:'flat',name:'Flat'},{id:'glass',name:'Glass',lvl:2},{id:'pixel',name:'Pixel',lvl:8},{id:'outline',name:'Outline',req:'firstquad'}],
 theme:[{id:'clean',name:'Clean'},{id:'paper',name:'Paper',lvl:3},{id:'midnight',name:'Midnight',lvl:6},{id:'circuit',name:'Circuit',lvl:9},{id:'lcd',name:'Retro LCD',req:'ch1'}],
 bezel:[{id:'slate',name:'Slate'},{id:'sand',name:'Sand',lvl:4},{id:'cherry',name:'Cherry',lvl:8},{id:'teal',name:'Teal',lvl:10},{id:'clear',name:'Transparent',req:'ch3'}],
 track:[{id:'signal',name:'Signal'},{id:'daylight',name:'Daylight',lvl:3},{id:'afterglow',name:'Afterglow',lvl:7}],
 fx:[{id:'none',name:'None'},{id:'confetti',name:'Confetti',lvl:5},{id:'fireworks',name:'Fireworks',req:'sweep'},{id:'aurora',name:'Aurora',req:'fivestar'}],
 sound:[{id:'soft',name:'Soft'},{id:'chip',name:'Chiptune',lvl:4}]};
const COS_KINDS=[['palette','Block palette'],['style','Block style'],['theme','Board theme'],['bezel','Console bezel'],['track','Soundtrack'],['fx','New-best effect'],['sound','Sound pack']];
const owned=(S,it)=>(!it.lvl||levelOf(S.xp)>=it.lvl)&&(!it.req||!!S.ach[it.req]);
const findCos=(kind,id)=>COS[kind].find(c=>c.id===id)||COS[kind][0];
function rewardsAt(level){ const o=[]; for(const [k,n] of COS_KINDS) for(const it of COS[k]) if(it.lvl===level) o.push(`${it.name} ${n.toLowerCase()}`); return o; }
const STARTER='Dusk, Flat, Clean, Slate, Signal';

// ---------- achievements ----------
// mode: classic | campaign | daily. Score thresholds are placeholders until the bot sims set them.
const ACH=[
 {id:'steady',g:'Survival',name:'Steady Hands',desc:'Survive 5 minutes in Classic at 1×'},
 {id:'holding',g:'Survival',name:'Holding On',desc:'Survive 3 minutes in Classic at 2×'},
 {id:'longgame',g:'Survival',name:'Long Game',desc:'Survive 10 minutes in Classic'},
 {id:'smallw',g:'Score',name:'Small Wonder',desc:'Score 30,000 on Small'},
 {id:'middle',g:'Score',name:'Middle Ground',desc:'Score 30,000 on Medium'},
 {id:'wide',g:'Score',name:'Wide Load',desc:'Score 30,000 on Large'},
 {id:'quicken',g:'Speed',name:'Quickening',desc:'Score 25,000 at 1.5×'},
 {id:'redline',g:'Speed',name:'Redline',desc:'Score 25,000 at 2×'},
 {id:'shape',g:'Piece sets',name:'Shapeshifter',desc:'Score 20,000 with Pentomix'},
 {id:'pande',g:'Piece sets',name:'Pandemonium',desc:'Score 20,000 with Chaos'},
 {id:'gentle',g:'Piece sets',name:'Gentle Giant',desc:'Score 50,000 with Kind on Large',reward:'Pastel palette'},
 {id:'throttle',g:'Combined',name:'Full Throttle',desc:'Score 30,000 on Large at 2× with Chaos'},
 {id:'nosafety',g:'Combined',name:'No Safety Net',desc:'Score 20,000 with hold and ghost off',reward:'Mono palette'},
 {id:'firstquad',g:'Skill',name:'First Quad',desc:'Clear 4 lines at once',reward:'Outline blocks'},
 {id:'firsttwist',g:'Skill',name:'First Twist',desc:'Clear a line with a Twist'},
 {id:'sweep',g:'Skill',name:'Clean Sweep',desc:'Leave the board completely empty',reward:'Fireworks effect'},
 {id:'unbroken',g:'Skill',name:'Unbroken',desc:'Four Quads or Twists back-to-back'},
 {id:'chain',g:'Skill',name:'Chain Reaction',desc:'Clear lines with 9 pieces in a row (an 8-combo)'},
 {id:'ch1',g:'Campaign',name:'Chapter 1 complete',desc:'Finish Chapter 1',reward:'Retro LCD theme'},
 {id:'ch2',g:'Campaign',name:'Chapter 2 complete',desc:'Finish Chapter 2',reward:'Retro Green palette'},
 {id:'ch3',g:'Campaign',name:'Chapter 3 complete',desc:'Finish Chapter 3',reward:'Transparent bezel'},
 {id:'campaign',g:'Campaign',name:'Campaign Complete',desc:'3 stars on every level'},
 {id:'fivestar',g:'Campaign',name:'Five-Star General',desc:'5 stars on every level',reward:'Aurora effect'},
 {id:'blitzstar',g:'Daily',name:'Blitz Star',desc:'3 stars on a Daily Blitz'},
 {id:'weekly',g:'Daily',name:'Weekly Blitz',desc:'Play the Daily Blitz 7 days in a row'}];
function checkAch(S,ctx){ const got=[], give=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); got.push(id); } };
  const {mode,cfg,res}=ctx; if(ctx.practice) return got;
  if(res){ const s=res.stats, sc=res.score, secs=res.ticks/60;
    if(s.quads+s.quints>0) give('firstquad'); if(s.twistLines>0) give('firsttwist');
    if(s.sweeps>0) give('sweep'); if(s.b2bMax>=3) give('unbroken'); if(s.comboMax>=8) give('chain');
    if(mode==='classic'){
      if(cfg.speed==='1'&&secs>=300) give('steady'); if(cfg.speed==='2'&&secs>=180) give('holding'); if(secs>=600) give('longgame');
      if(sc>=30000) give({small:'smallw',medium:'middle',large:'wide'}[cfg.board]);
      if(cfg.speed==='1.5'&&sc>=25000) give('quicken'); if(cfg.speed==='2'&&sc>=25000) give('redline');
      if(cfg.set==='pentomix'&&sc>=20000) give('shape'); if(cfg.set==='chaos'&&sc>=20000) give('pande');
      if(cfg.set==='kind'&&cfg.board==='large'&&sc>=50000) give('gentle');
      if(cfg.board==='large'&&cfg.speed==='2'&&cfg.set==='chaos'&&sc>=30000) give('throttle');
      if(!cfg.hold&&!cfg.ghost&&sc>=20000) give('nosafety'); } }
  if(mode==='campaign'){ for(const ch of [1,2,3]) if(campStars(S,ch*10)>=3) give('ch'+ch);
    if(LEVELS.every(L=>campStars(S,L.id)>=3)) give('campaign'); if(LEVELS.every(L=>campStars(S,L.id)>=5)) give('fivestar'); }
  if(mode==='daily'){ if(S.daily.stars>=3) give('blitzstar'); if(S.dstreak.cur>=7) give('weekly'); }
  return got; }

// ---------- XP ----------
function addXP(S,n){ const before=levelOf(S.xp); S.xp+=Math.max(0,Math.round(n)); const after=levelOf(S.xp); const rewards=[];
  for(let l=before+1;l<=after;l++) rewards.push(...rewardsAt(l)); return {xp:Math.round(n),before,after,rewards}; }
const xpNext=S=>{ const l=levelOf(S.xp); return l>=MAXL?null:LV[l]; };
const classicXP=(cfg,lines)=>Math.min(50,Math.round(Math.floor(lines/5)*SPEEDS[cfg.speed].g));

// ---------- records (best score per board × speed × piece set) ----------
const recKey=c=>`${c.board}|${c.speed}|${c.set}`;
function addRecord(S,cfg,res,date){ const k=recKey(cfg), r=S.rec[k]; if(r&&r.score>=res.score) return false;
  S.rec[k]={score:res.score,lines:res.lines,secs:Math.round(res.ticks/60),date:date||''}; return true; }
const bestOf=(S,c)=>(S.rec[recKey(c)]||{score:0}).score;

// ---------- campaign ----------
const campOf=(S,id)=>S.camp[id]||{s:[0,0,0,0,0],best:0};
const campStars=(S,id)=>campOf(S,id).s.reduce((a,b)=>a+b,0);
const totalStars=S=>LEVELS.reduce((a,L)=>a+campStars(S,L.id),0);
const unlocked=(S,id)=>id===1||campStars(S,id-1)>=3; // 3 stars on a level opens the next (level 10 opens the next chapter)
const CH_XP=[5,8,12], CH_BONUS=[50,100,150];
function campaignResult(S,L,res){ const earned=starsEarned(L,res), c=campOf(S,L.id), fresh=[]; let xp=0;
  const chDoneBefore=campStars(S,L.ch*10)>=3;
  earned.forEach((e,i)=>{ if(e&&!c.s[i]){ c.s[i]=1; fresh.push(i); xp+=CH_XP[L.ch-1]; } });
  if(res.ok) c.best=Math.max(c.best||0,res.score); S.camp[L.id]=c;
  const chDone=!chDoneBefore&&campStars(S,L.ch*10)>=3; if(chDone) xp+=CH_BONUS[L.ch-1];
  return {earned,fresh,stars:campStars(S,L.id),xp,chDone}; }

// ---------- Daily Blitz ----------
function dailyFor(S,date){ if(S.daily.date!==date) S.daily={date,scored:false,score:0,lines:0,stars:0,run:null,practice:0}; return S.daily; }
function dailyResult(S,date,res,today){ const d=dailyFor(S,date); if(d.scored) return null;
  d.scored=true; d.score=res.score; d.lines=res.lines; d.stars=dailyStars(date,res.score); d.run=null;
  S.dhist[date]={score:res.score,lines:res.lines,stars:d.stars}; S.dbest=Math.max(S.dbest,res.score);
  const n=dayNum(date), last=S.dstreak.last?dayNum(S.dstreak.last):-99;
  if(n!==last){ S.dstreak.cur=n===last+1?S.dstreak.cur+1:1; S.dstreak.last=date; S.dstreak.best=Math.max(S.dstreak.best,S.dstreak.cur); }
  const xp=20*(date===today?2:1); return {stars:d.stars,xp}; }
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function shareLine(date,score,lines,stars){ const c=dailyCombo(date), [y,m,dd]=date.split('-').map(Number);
  return `Linefall Daily · ${dd} ${MON[m-1]} · ${comboLabel(c)} · ${fmtNum(score)} · ${lines} lines · ${'★'.repeat(stars)}${'☆'.repeat(3-stars)}`; }

// ---------- lifetime stats ----------
function addStats(S,res){ const t=S.stats, s=res.stats; t.games++; t.lines+=res.lines; t.quads+=s.quads+s.quints; t.twists+=s.twists; t.sweeps+=s.sweeps; t.pieces+=s.pieces; t.ticks+=res.ticks; }

// ---------- backup (Linefall only) ----------
// LINEFALL1Z.<base64 gzip> where the app can compress, LINEFALL1.<base64> otherwise. Both decode here (the app inflates Z).
const b64e=str=>{ const u=new TextEncoder().encode(str); let b=''; for(let i=0;i<u.length;i++) b+=String.fromCharCode(u[i]); return btoa(b); };
const b64d=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
function backupPlain(S){ const o=Object.assign({},S); o.run=null; return 'LINEFALL1.'+b64e(JSON.stringify(o)); }
function parseBackup(text){ const m=/LINEFALL1\.([A-Za-z0-9+/=]+)/.exec(String(text||'')); if(!m) return null;
  try{ const o=JSON.parse(b64d(m[1])); if(!o||typeof o!=='object'||typeof o.xp!=='number') return null; return o; }catch(e){ return null; } }

// ---------- Arcade contract ----------
// Shared settings live in arcade.v1 (read only, never written). They're applied in memory only.
function readArcade(store){ try{ const a=JSON.parse(store.get(ARCADE_KEY)||'null'); if(!a||typeof a!=='object') return null; return a; }catch(e){ return null; } }
function applyShared(S,a){ if(!a) return S; const o=Object.assign({},S), set=a.set||{}; for(const k of SHARED) if(set[k]!==undefined) o[k]=set[k]; if(typeof a.name==='string') o.name=a.name; return o; }
function summary(S){ const l=levelOf(S.xp), m=S.rec['medium|1|classic'];
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:l,xpNext:xpNext(S),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Best score (Medium 1×)',m?fmtNum(m.score):'—'],['Campaign stars',`${totalStars(S)}/150`],['Daily best',S.dbest?fmtNum(S.dbest):'—']],
    last:Date.now()}; }
