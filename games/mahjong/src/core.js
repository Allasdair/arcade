// ===================== Mahjong core =====================
// Save, XP and levels, stars, records, hints, the campaign, the Daily, achievements, cosmetics, backup and the
// Arcade contract. No DOM: storage is passed in, so Node tests can run it.
const VERSION='0.1.0', GAME_ID='mahjong', KEY='mahjong.v1', SUMKEY='arcade.summary.mahjong', ARCADE_KEY='arcade.v1';
const MAXL=10, LVXP=[0,50,150,300,525,825,1225,1725,2375,3175]; // Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LVXP[l]) l++; return l; };
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];
const HINT_CAP=5, HINT_MAX=99;

function defSave(reduced){ return {v:1,xp:0,ach:{},camp:{},campTab:0,hints:HINT_CAP,hintDate:'',
  rec:{wins:{easy:0,normal:0,hard:0,expert:0},played:0,cleared:0,lost:0,best:{},streak:{cur:0,best:0},bestCombo:0,quads:0,taBest:0,scoreBest:0},
  setup:{diff:'normal',layout:'random',shuffles:'inf',ta:false,fog:false},
  daily:{date:'',scored:false,stars:0,time:0,assisted:false,run:null},dhist:{},dstreak:{cur:0,best:0,last:''},dcount:0,d3:0,week:[0,0,0,0,0,0,0],
  look:{face:'classic',body:'ivory',board:'silk',match:'fade',win:'none',track:'still',amb:'none',sound:'soft'},
  prefs:{highlight:true,show:false,warn:true,hc:false,large:false,autozoom:true,speed:'normal'},
  sfx:true,music:true,haptics:true,motion:!reduced,appearance:'system',fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  run:null,seenVer:'',bk:{last:0},howto:false}; }
const NESTED=['rec','setup','daily','dstreak','look','prefs','bk'];
// Old saves missing new fields are filled in from defSave() (one level deep for nested groups)
function loadSave(raw,reduced){ const d=defSave(reduced); let s=null; try{ s=raw?JSON.parse(raw):null; }catch(e){ s=null; }
  if(!s||typeof s!=='object') return d;
  for(const k in d){ if(s[k]===undefined) continue;
    if(NESTED.includes(k)&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) d[k]=Object.assign(d[k],s[k]); else d[k]=s[k]; }
  if(!d.rec.wins||typeof d.rec.wins!=='object') d.rec.wins={easy:0,normal:0,hard:0,expert:0};
  return d; }

// ---------- cosmetics ----------
// Unlocks: lvl (XP level), req (an achievement) or stars (campaign star total). Every level 2–10 has a reward.
const COS={
 face:[{id:'classic',name:'Classic'},{id:'minimal',name:'Minimal',lvl:2},{id:'ink',name:'Ink Brush',lvl:5},{id:'pixel',name:'Pixel',req:'combo'},{id:'neon',name:'Neon',stars:75}],
 body:[{id:'ivory',name:'Ivory'},{id:'jade',name:'Jade',lvl:3},{id:'bamboo',name:'Bamboo',lvl:6},{id:'glass',name:'Glass',req:'clock'},{id:'obsidian',name:'Obsidian',lvl:9}],
 board:[{id:'silk',name:'Silk'},{id:'garden',name:'Garden',lvl:4},{id:'paper',name:'Paper',lvl:7},{id:'night',name:'Night Temple',req:'fog'},{id:'space',name:'Space',stars:135}],
 layout:[{id:'dragon',name:'Dragon',stars:30},{id:'pagoda',name:'Pagoda',lvl:8},{id:'constellation',name:'Constellation',req:'d7'},{id:'lotus',name:'Lotus',req:'camp1'}],
 match:[{id:'fade',name:'Fade'},{id:'petals',name:'Petals',lvl:2},{id:'sparks',name:'Sparks',req:'quads'},{id:'inksplash',name:'Ink Splash',lvl:10}],
 win:[{id:'none',name:'None'},{id:'lanterns',name:'Lanterns',lvl:3},{id:'petalstorm',name:'Petal Storm',req:'perf1'},{id:'fireworks',name:'Fireworks',lvl:10},{id:'cascade',name:'Tile Cascade',req:'c100'}],
 track:[{id:'still',name:'Still Water'},{id:'lantern',name:'Lantern Walk',lvl:6},{id:'daylight',name:'Daylight',req:'dstreak'}],
 amb:[{id:'none',name:'None'},{id:'rain',name:'Rain',lvl:4},{id:'stream',name:'Stream',lvl:7},{id:'chimes',name:'Wind Chimes',req:'fullweek'}],
 sound:[{id:'soft',name:'Soft Clack'},{id:'stone',name:'Stone',lvl:8},{id:'chip',name:'Chiptune',lvl:9}]};
const COS_KINDS=[['face','Tile faces'],['body','Tile bodies'],['board','Board'],['layout','Special layout'],['match','Match effect'],['win','Win effect'],['track','Music'],['amb','Ambience'],['sound','Sound pack']];
const owned=(S,it)=>(!it.lvl||levelOf(S.xp)>=it.lvl)&&(!it.req||!!S.ach[it.req])&&(!it.stars||totalStars(S)>=it.stars);
const findCos=(kind,id)=>COS[kind].find(c=>c.id===id)||COS[kind][0];
function rewardsAt(level){ const o=[]; for(const [k,n] of COS_KINDS) for(const it of COS[k]) if(it.lvl===level) o.push(`${it.name} (${n.toLowerCase()})`); return o; }
const STARTER='Classic faces, Ivory tiles, Silk board, Fade, Still Water, Soft Clack';
const starUnlocks=()=>COS_KINDS.flatMap(([k,n])=>COS[k].filter(it=>it.stars).map(it=>({stars:it.stars,text:`${it.name} (${n.toLowerCase()})`}))).sort((a,b)=>a.stars-b.stars);
// a layout is open unless it's a special one still locked
const layoutOpen=(S,L)=>!L.special||owned(S,findCos('layout',L.id));

// ---------- hints: refilled daily to 5, +1 per level-up, earned extras stack to 99 ----------
function refreshHints(S,today){ if(S.hintDate!==today){ S.hints=Math.max(S.hints||0,HINT_CAP); S.hintDate=today; } return S.hints; }
function useHint(S){ if(S.hints<=0) return false; S.hints--; return true; }

// ---------- stars ----------
// every win: ★ clear, ★ under par time, ★ no assists. Time Attack: ★ clear, ★ 30 s or more left, ★ no assists.
function winStars(st,par){ if(!st.won) return [0,0,0];
  const second=st.ta?st.ta.left>=30000:(par?st.t<=par*1000:false); return [1,second?1:0,assisted(st)?0:1]; }
const starCount=a=>a.reduce((x,y)=>x+y,0);

// ---------- achievements ----------
const ACH=[
 {id:'clr_easy',g:'By difficulty',name:'Easy Clear',desc:'Clear an Easy board'},
 {id:'clr_normal',g:'By difficulty',name:'Normal Clear',desc:'Clear a Normal board'},
 {id:'clr_hard',g:'By difficulty',name:'Hard Clear',desc:'Clear a Hard board'},
 {id:'clr_expert',g:'By difficulty',name:'Expert Clear',desc:'Clear an Expert board'},
 {id:'par_easy',g:'By difficulty',name:'Quick: Easy',desc:'Clear Easy under par time'},
 {id:'par_normal',g:'By difficulty',name:'Quick: Normal',desc:'Clear Normal under par time'},
 {id:'par_hard',g:'By difficulty',name:'Quick: Hard',desc:'Clear Hard under par time'},
 {id:'par_expert',g:'By difficulty',name:'Quick: Expert',desc:'Clear Expert under par time'},
 {id:'pure_easy',g:'By difficulty',name:'Unaided: Easy',desc:'Clear Easy with no assists'},
 {id:'pure_normal',g:'By difficulty',name:'Unaided: Normal',desc:'Clear Normal with no assists'},
 {id:'pure_hard',g:'By difficulty',name:'Unaided: Hard',desc:'Clear Hard with no assists'},
 {id:'pure_expert',g:'By difficulty',name:'Unaided: Expert',desc:'Clear Expert with no assists'},
 {id:'c10',g:'Boards cleared',name:'Tidy',desc:'Clear 10 boards',n:10},
 {id:'c50',g:'Boards cleared',name:'Collector',desc:'Clear 50 boards',n:50},
 {id:'c100',g:'Boards cleared',name:'Centurion',desc:'Clear 100 boards',n:100,reward:'Tile Cascade win effect'},
 {id:'c250',g:'Boards cleared',name:'Devotee',desc:'Clear 250 boards',n:250},
 {id:'c500',g:'Boards cleared',name:'Grand Master',desc:'Clear 500 boards',n:500},
 {id:'d7',g:'Daily',name:'A Week of Dailies',desc:'Clear 7 Dailies',n:7,reward:'Constellation layout'},
 {id:'d30',g:'Daily',name:'A Month of Dailies',desc:'Clear 30 Dailies',n:30},
 {id:'d100',g:'Daily',name:'Daily Hundred',desc:'Clear 100 Dailies',n:100},
 {id:'s1',g:'Daily',name:'Three Stars',desc:'3 stars on a Daily',n:1},
 {id:'s10',g:'Daily',name:'Star Collector',desc:'3 stars on 10 Dailies',n:10},
 {id:'s30',g:'Daily',name:'Star Keeper',desc:'3 stars on 30 Dailies',n:30},
 {id:'dstreak',g:'Daily',name:'Daily Streak',desc:'Dailies on 7 days in a row',reward:'Daylight music'},
 {id:'fullweek',g:'Daily',name:'Full Week',desc:'3 stars on every weekday\'s Daily (Monday–Sunday, any weeks)',reward:'Wind Chimes ambience'},
 {id:'camp1',g:'Campaign',name:'Garden',desc:'Finish the Garden campaign',reward:'Lotus layout'},
 {id:'camp2',g:'Campaign',name:'Temple',desc:'Finish the Temple campaign'},
 {id:'camp3',g:'Campaign',name:'Summit',desc:'Finish the Summit campaign'},
 {id:'perf1',g:'Campaign',name:'Perfect Garden',desc:'3 stars on every Garden level',reward:'Petal Storm win effect'},
 {id:'perf2',g:'Campaign',name:'Perfect Temple',desc:'3 stars on every Temple level'},
 {id:'perf3',g:'Campaign',name:'Perfect Summit',desc:'3 stars on every Summit level'},
 {id:'puzzle',g:'Campaign',name:'Puzzle Master',desc:'3 stars on all three puzzle levels'},
 {id:'purist',g:'Skill',name:'Purist',desc:'Clear Hard with shuffles set to None'},
 {id:'fog',g:'Skill',name:'In the Fog',desc:'Clear a Fog board',reward:'Night Temple board'},
 {id:'clock',g:'Skill',name:'Beat the Clock',desc:'Finish a Time Attack',reward:'Glass tiles'},
 {id:'combo',g:'Skill',name:'Combo Master',desc:'Reach a ×3 combo',reward:'Pixel faces'},
 {id:'quads',g:'Skill',name:'Four of a Kind',desc:'Remove all 4 of a kind in two back-to-back moves, 20 times',n:20,reward:'Sparks match effect'}];
const achProg=(S,a)=>{ if(a.id[0]==='c'&&a.n) return S.rec.cleared; if(a.id[0]==='d'&&a.n) return S.dcount; if(a.id[0]==='s'&&a.n) return S.d3; if(a.id==='quads') return S.rec.quads; return null; };
// ctx: {mode, st, diff, stars:[a,b,c], practice}
function checkAch(S,ctx){ const got=[], give=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); got.push(id); } };
  if(ctx.practice) return got;
  const st=ctx.st;
  if(st){ if(st.bestCombo>=4) give('combo');
    if(st.won){ const d=ctx.diff, s=ctx.stars||[1,0,0];
      give('clr_'+d); if(!st.ta&&s[1]) give('par_'+d); if(s[2]) give('pure_'+d);
      if(st.cfg.fog) give('fog'); if(st.ta) give('clock'); if(d==='hard'&&st.cfg.shuffles===0&&ctx.mode==='classic') give('purist'); } }
  for(const a of ACH) if(a.n){ const p=achProg(S,a); if(p!=null&&p>=a.n) give(a.id); }
  if(S.dstreak.cur>=7) give('dstreak'); if(S.week.every(x=>x)) give('fullweek');
  if(typeof CAMPS!=='undefined'){ CAMPS.forEach((c,i)=>{ if(campDone(S,i)) give('camp'+(i+1)); if(LEVELS.filter(L=>L.camp===i).every(L=>campStars(S,L.id)>=3)) give('perf'+(i+1)); });
    if(LEVELS.filter(L=>L.type==='puzzle').every(L=>campStars(S,L.id)>=3)) give('puzzle'); }
  return got; }

// ---------- XP ----------
function addXP(S,n){ const before=levelOf(S.xp); S.xp+=Math.max(0,Math.round(n)); const after=levelOf(S.xp), rewards=[];
  for(let l=before+1;l<=after;l++) rewards.push(...rewardsAt(l));
  const ups=after-before; if(ups>0) S.hints=Math.min(HINT_MAX,(S.hints||0)+ups); // +1 hint per level-up
  return {xp:Math.round(n),before,after,rewards,hints:ups}; }
const xpNext=S=>{ const l=levelOf(S.xp); return l>=MAXL?null:LVXP[l]; };
const WIN_XP={easy:10,normal:15,hard:22,expert:30};
function classicXP(st){ if(!st.won) return 0; let x=WIN_XP[st.cfg.diff]; if(st.cfg.shuffles===0) x+=5; if(st.cfg.fog) x+=5; if(st.cfg.ta) x+=5;
  return assisted(st)?Math.round(x/2):x; }

// ---------- records (Classic) ----------
// wins per difficulty, best time and best score per layout, the win streak; Time Attack keeps most time left
function addRecords(S,st){ const R=S.rec, fresh=[]; R.played++;
  if(!st.won){ R.lost++; R.streak.cur=0; return fresh; }
  R.wins[st.cfg.diff]=(R.wins[st.cfg.diff]||0)+1; R.streak.cur++; R.streak.best=Math.max(R.streak.best,R.streak.cur);
  const k=st.cfg.lid+'|'+st.cfg.diff, b=R.best[k]||{t:0,s:0};
  if(!st.ta&&!assisted(st)&&(!b.t||st.t<b.t)){ b.t=st.t; fresh.push('Best time'); }
  if(st.score>b.s){ b.s=st.score; fresh.push('Best score'); } R.best[k]=b;
  if(st.score>R.scoreBest){ R.scoreBest=st.score; }
  if(st.ta&&st.ta.left>R.taBest){ R.taBest=st.ta.left; fresh.push('Most time left'); }
  return fresh; }
// every clear (Classic, campaign, the scored Daily) counts toward the cumulative achievements
function addClear(S,st){ if(st.won) S.rec.cleared++; S.rec.bestCombo=Math.max(S.rec.bestCombo,st.bestCombo); S.rec.quads+=st.quads||0; }

// ---------- campaign ----------
const levelById=id=>LEVELS.find(L=>L.id===id);
const campOf=(S,id)=>S.camp[id]||{s:[0,0,0],best:0,tries:0};
const campStars=(S,id)=>campOf(S,id).s.reduce((a,b)=>a+b,0);
const totalStars=S=>typeof LEVELS==='undefined'?0:LEVELS.reduce((a,L)=>a+campStars(S,L.id),0);
const campCleared=(S,id)=>!!campOf(S,id).s[0];
const campDone=(S,c)=>campCleared(S,LEVELS.find(L=>L.camp===c&&L.n===15).id);
const campOpen=(S,c)=>c===0||campDone(S,c-1);
// clearing a level unlocks the next; clearing level 15 unlocks the next campaign
const unlocked=(S,Lv)=>campOpen(S,Lv.camp)&&(Lv.n===1||campCleared(S,LEVELS.find(L=>L.camp===Lv.camp&&L.n===Lv.n-1).id));
function levelCfg(Lv){ const gone=Lv.gone?unbits(Lv.gone,layoutById(Lv.lid).n):null;
  return {lid:Lv.lid,diff:Lv.diff,seed:Lv.seed,trap:Lv.trap,shuffles:Lv.shuffles,undo:Lv.undo,ta:!!Lv.ta,fog:!!Lv.fog,gone,par:Lv.par}; }
function unbits(s,n){ const o=new Array(n).fill(0); for(let i=0;i<n;i++){ const v=B64.indexOf(s[(i/6)|0]); if(v>>(i%6)&1) o[i]=1; } return o; }
function campaignResult(S,Lv,stars){ const c=campOf(S,Lv.id), fresh=[], C=CAMPS[Lv.camp]; let xp=0; const wasDone=campDone(S,Lv.camp);
  if(stars[0]) stars.forEach((e,i)=>{ if(e&&!c.s[i]){ c.s[i]=1; fresh.push(i); xp+=C.xp; } });
  c.tries=(c.tries||0)+1; S.camp[Lv.id]=c;
  const finished=!wasDone&&campDone(S,Lv.camp); if(finished) xp+=C.bonus;
  return {fresh,stars:campStars(S,Lv.id),xp,finished}; }

// ---------- Daily ----------
// MJD1|YYYY-MM-DD picks a board from the graded list for the weekday's difficulty: the same board for everyone.
const dayNum=date=>{ const [y,m,d]=date.split('-').map(Number); return Math.round(Date.UTC(y,m-1,d)/864e5); };
const weekdayOf=date=>(new Date(dayNum(date)*864e5).getUTCDay()+6)%7; // Monday 0 … Sunday 6
function dailyBoard(date){ const [diff,grade]=DAILY_DAYS[weekdayOf(date)], list=DAILY_LISTS[diff+'|'+grade];
  const r=seedRng('MJD1|'+date), e=list[Math.floor(r()*list.length)], L=LAYOUTS[e[0]];
  return {lid:L.id,diff,grade,seed:`MJD|${diff}|${grade}|${e[1]}`,trap:e[2]/100,par:parTime(L,grade),shuffles:'inf',undo:true,ta:false,fog:false}; }
function dailyFor(S,date){ if(S.daily.date!==date) S.daily={date,scored:false,stars:0,time:0,assisted:false,run:null}; return S.daily; }
function dailyResult(S,date,st,today){ const d=dailyFor(S,date); if(d.scored) return null; const cfg=dailyBoard(date), stars=winStars(st,cfg.par), n=starCount(stars);
  d.scored=true; d.run=null; d.stars=n; d.time=st.t; d.assisted=assisted(st); d.won=st.won;
  S.dhist[date]={won:st.won,stars:n,time:st.t,assisted:d.assisted}; const keys=Object.keys(S.dhist).sort(); while(keys.length>7) delete S.dhist[keys.shift()]; // the last 7 Dailies
  let xp=0;
  if(st.won){ S.dcount++; if(n===3){ S.d3++; S.week[weekdayOf(date)]=1; } xp=20*(date===today?2:1);
    const nn=dayNum(date), last=S.dstreak.last?dayNum(S.dstreak.last):-99;
    if(nn!==last){ S.dstreak.cur=nn===last+1?S.dstreak.cur+1:1; S.dstreak.last=date; S.dstreak.best=Math.max(S.dstreak.best,S.dstreak.cur); } }
  return {stars,xp}; }
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const fmtTime=ms=>{ const s=Math.max(0,Math.round(ms/1000)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
function shareLine(date,won,time,stars,assist){ const [,m,dd]=date.split('-').map(Number);
  return `Mahjong Daily · ${DOW[weekdayOf(date)]} ${dd} ${MON[m-1]} · ${won?fmtTime(time):'not cleared'} · ${'★'.repeat(stars)}${'☆'.repeat(3-stars)}${assist?' (assisted)':''}`; }

// ---------- backup (Mahjong only) ----------
// MAHJONG1Z.<base64 gzip> where the app can compress, MAHJONG1.<base64> otherwise. Both decode here (the app inflates Z).
const b64e=str=>{ const u=new TextEncoder().encode(str); let b=''; for(let i=0;i<u.length;i++) b+=String.fromCharCode(u[i]); return btoa(b); };
const b64d=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
function backupPlain(S){ return 'MAHJONG1.'+b64e(JSON.stringify(S)); }
function parseBackup(text){ const m=/MAHJONG1\.([A-Za-z0-9+/=]+)/.exec(String(text||'')); if(!m) return null;
  try{ const o=JSON.parse(b64d(m[1])); if(!o||typeof o!=='object'||typeof o.xp!=='number') return null; return o; }catch(e){ return null; } }

// ---------- Arcade contract ----------
// Shared settings live in arcade.v1 (read only, never written). They're applied in memory only.
function readArcade(store){ try{ const a=JSON.parse(store.get(ARCADE_KEY)||'null'); if(!a||typeof a!=='object') return null; return a; }catch(e){ return null; } }
function applyShared(S,a){ if(!a) return S; const o=Object.assign({},S), set=a.set||{}; for(const k of SHARED) if(set[k]!==undefined) o[k]=set[k]; if(typeof a.name==='string'&&a.name) o.name=a.name; return o; }
function summary(S){ const l=levelOf(S.xp);
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:l,xpNext:xpNext(S),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Boards cleared',String(S.rec.cleared)],['Campaign stars',`${totalStars(S)}/${LEVELS.length*3}`],['Daily streak',String(S.dstreak.cur)]],
    last:Date.now()}; }
