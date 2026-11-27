// ===================== Quintessence core =====================
// Save, XP and levels, hints, records, stars, Classic, campaign, the Daily, achievements, cosmetics, backup and the
// Arcade contract. No DOM: storage is passed in, so Node tests can run it.
const VERSION='0.1.0', GAME_ID='quintessence', KEY='quintessence.v1', SUMKEY='arcade.summary.quintessence', ARCADE_KEY='arcade.v1';
const MAXL=10, LVXP=[0,50,150,300,525,825,1225,1725,2375,3175]; // Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LVXP[l]) l++; return l; };
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];
const HINT_CAP=5, HINT_MAX=99;
const NE_NAMES={4:'Easy',5:'Normal',6:'Hard'};
const BOARDS=[['7','7×7'],['8','8×8'],['9','9×9'],['heart','Heart'],['diamond','Diamond'],['ring','Ring'],['cross','Cross'],['hourglass','Hourglass'],['islands','Twin Islands']];
const boardName=b=>(BOARDS.find(x=>x[0]===b)||BOARDS[1])[1];
const MODES={moves:'Moves',timed:'Timed',zen:'Zen'};
const TIMED_MS=120000, CLASSIC_MOVES=30;

function defSave(reduced){ return {v:1,xp:0,ach:{},camp:{},campTab:0,hints:HINT_CAP,hintDate:'',
  setup:{mode:'moves',board:'8',ne:5,obst:'off'},
  rec:{cl:{},games:0,clears:0,best:0,mostSp:0,zen:{matches:0,best:0,mostSp:0,longest:0},cur:0,bestStreak:0},
  tot:{m:[0,0,0,0,0,0],made:[0,0,0,0,0,0],combos:{},react:{}},
  daily:{date:'',scored:false,cleared:false,stars:0,left:0,score:0,assisted:false,run:null,practice:null},
  dhist:{},dstreak:{cur:0,best:0,last:''},dweek:[0,0,0,0,0,0,0],dclears:0,d3:0,zenXP:{date:'',n:0,carry:0},
  look:{skin:'orbs',board:'temple',mfx:'elemental',spx:'classic',win:'none',track:'kindling',sound:'soft'},
  prefs:{input:'both',sens:'normal',idle:false,autoSkip:false,announcer:true,large:false,speed:'normal',contrast:false},
  sfx:true,music:true,haptics:true,motion:!reduced,appearance:'system',fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  run:null,seenVer:'',bk:{last:0},howto:false}; }
const NESTED=['setup','rec','tot','daily','dstreak','look','prefs','bk','zenXP'];
// Old saves missing new fields are filled in from defSave() (one level deep for nested groups)
function loadSave(raw,reduced){ const d=defSave(reduced); let s=null; try{ s=raw?JSON.parse(raw):null; }catch(e){ s=null; }
  if(!s||typeof s!=='object') return d;
  for(const k in d){ if(s[k]===undefined) continue;
    if(NESTED.includes(k)&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) d[k]=Object.assign(d[k],s[k]); else d[k]=s[k]; }
  if(!d.rec.zen) d.rec.zen={matches:0,best:0,mostSp:0,longest:0};
  return d; }

// ---------- Classic ----------
// Board: 7×7, 8×8, 9×9 or a shaped board (9×9 masks). Obstacles Light: a few Frost and Stone.
function classicCfg(setup,seed){ const b=setup.board, sq=/^\d$/.test(b), n=sq?+b:9;
  const cfg={W:n,H:n,ne:setup.ne,seed,shape:sq?null:b,goals:[],limit:setup.mode==='moves'?CLASSIC_MOVES:0};
  if(setup.obst==='light'){ const mask=shapeMask(cfg.shape,n,n), r=rngFor(seed+'|ob'); cfg.map=buildMap(n,n,mask,[['f','scatter',3],['s','scatter',2]],r); }
  return cfg; }
const clKey=s=>`${s.mode}|${s.board}|${s.ne}|${s.obst}`;
const clRec=(S,k)=>S.rec.cl[k]||(S.rec.cl[k]={games:0,best:0,stars:[0,0,0],wins:0});
// bronze and silver come from the casual bot (tools/grade.js): bronze its median, silver its 80th percentile
function classicThresholds(setup){ const t=(typeof CLASSIC_SCORES!=='undefined'&&CLASSIC_SCORES[`${setup.mode}|${setup.board}|${setup.ne}`])||[8000,12000];
  const f=setup.obst==='light'?(typeof CLASSIC_OB_FACTOR!=='undefined'?CLASSIC_OB_FACTOR:1):1; return [Math.round(t[0]*f/100)*100,Math.round(t[1]*f/100)*100]; }
function classicStars(setup,score,assisted){ const [b,s]=classicThresholds(setup); return [score>=b?1:0,score>=s?1:0,score>=b&&!assisted?1:0]; }
// Moves and Timed pay 5/10/15 XP for the bronze/silver/no-assist stars the first time per mode × board × elements,
// then 3 XP for each game with any star. Zen pays 1 XP per 100 matches, at most 20 a day.
function classicResult(S,setup,score,assisted,stats){ const k=clKey(setup), r=clRec(S,k), st=classicStars(setup,score,assisted), fresh=[]; let xp=0;
  r.games++; S.rec.games++; const rec=score>r.best; if(rec) r.best=score;
  st.forEach((s,i)=>{ if(s&&!r.stars[i]){ r.stars[i]=1; fresh.push(i); xp+=[5,10,15][i]; } });
  if(!fresh.length&&st[0]) xp+=3;
  const won=!!st[0]; if(won){ r.wins++; S.rec.clears++; S.rec.cur++; S.rec.bestStreak=Math.max(S.rec.bestStreak,S.rec.cur); } else S.rec.cur=0;
  return {stars:st,fresh,xp,record:rec&&r.games>1,won}; }
function zenXP(S,today,matches){ const z=S.zenXP; if(z.date!==today){ z.date=today; z.n=0; } z.carry=(z.carry||0)+matches; let xp=0;
  while(z.carry>=100&&z.n<20){ z.carry-=100; z.n++; xp++; } if(z.n>=20) z.carry=0; return xp; }

// ---------- cosmetics ----------
// Each element always keeps its own shape in every skin. Accessibility (high contrast, large tiles) is never locked.
const COS={
 skin:[{id:'orbs',name:'Orbs'},{id:'runes',name:'Runes',lvl:3},{id:'crystals',name:'Crystals',lvl:6},{id:'pixel',name:'Pixel',lvl:9},{id:'water',name:'Watercolour',stars:75},{id:'glyphs',name:'Glyphs',req:'puzzle'}],
 board:[{id:'temple',name:'Temple Stone'},{id:'sky',name:'Open Sky',lvl:2},{id:'sea',name:'Deep Sea',lvl:5},{id:'volcano',name:'Volcano',lvl:8},{id:'garden',name:'Night Garden',stars:30},{id:'paper',name:'Paper',req:'dweek'}],
 mfx:[{id:'elemental',name:'Elemental'},{id:'sparkle',name:'Sparkle',lvl:4},{id:'ink',name:'Ink',lvl:7},{id:'pixel',name:'Pixel Pop',req:'casc10'}],
 spx:[{id:'classic',name:'Classic'},{id:'neon',name:'Neon',lvl:5},{id:'arcane',name:'Arcane',stars:135}],
 win:[{id:'none',name:'None'},{id:'fireworks',name:'Overflow Fireworks',lvl:2},{id:'aurora',name:'Aurora',lvl:7},{id:'storm',name:'Elemental Storm',req:'cb_pp'}],
 track:[{id:'kindling',name:'Kindling'},{id:'still',name:'Stillwater',lvl:4},{id:'highwind',name:'Highwind',lvl:10},{id:'daylight',name:'Daylight',req:'dstar1'}],
 sound:[{id:'soft',name:'Soft'},{id:'crystal',name:'Crystal',lvl:6},{id:'chip',name:'Chiptune',lvl:9}]};
const COS_KINDS=[['skin','Element skin'],['board','Board'],['mfx','Match effect'],['spx','Special style'],['win','Win effect'],['track','Music'],['sound','Sound pack']];
const owned=(S,it)=>(!it.lvl||levelOf(S.xp)>=it.lvl)&&(!it.req||!!S.ach[it.req])&&(!it.stars||totalStars(S)>=it.stars);
const findCos=(kind,id)=>COS[kind].find(c=>c.id===id)||COS[kind][0];
function rewardsAt(level){ const o=[]; for(const [k,n] of COS_KINDS) for(const it of COS[k]) if(it.lvl===level) o.push(`${it.name} (${n.toLowerCase()})`); return o; }
const STARTER='Orbs skin, Temple Stone board, Elemental effects, Classic specials, Kindling music, Soft sounds';
const starUnlocks=()=>COS_KINDS.flatMap(([k,n])=>COS[k].filter(it=>it.stars).map(it=>({stars:it.stars,text:`${it.name} (${n.toLowerCase()})`}))).sort((a,b)=>a.stars-b.stars);

// ---------- hints: refilled daily to 5, +1 per level-up, earned extras stack to 99 ----------
function refreshHints(S,today){ if(S.hintDate!==today){ S.hints=Math.max(S.hints||0,HINT_CAP); S.hintDate=today; } return S.hints; }
function useHint(S){ if(S.hints<=0) return false; S.hints--; return true; }

// ---------- XP ----------
function addXP(S,n){ const before=levelOf(S.xp); S.xp+=Math.max(0,Math.round(n)); const after=levelOf(S.xp), rewards=[];
  for(let l=before+1;l<=after;l++) rewards.push(...rewardsAt(l));
  const ups=after-before; if(ups>0) S.hints=Math.min(HINT_MAX,(S.hints||0)+ups);
  return {xp:Math.round(n),before,after,rewards,hints:ups}; }
const xpNext=S=>{ const l=levelOf(S.xp); return l>=MAXL?null:LVXP[l]; };

// ---------- campaign ----------
// Stars: ★ goal met · ★ with moves to spare (at least par moves left; timed levels: par seconds left) · ★ no assists.
// They build up across attempts; meeting the goal is required for any star.
const CAMPS_DEF=[{id:'origins',name:'Origins',ne:4,xp:6,bonus:75},{id:'stormfront',name:'Stormfront',ne:5,xp:10,bonus:150},{id:'frostfall',name:'Frostfall',ne:6,xp:15,bonus:225}];
const campOf=(S,id)=>S.camp[id]||{c:0,s:[0,0,0],best:0,tries:0};
const campStars=(S,id)=>campOf(S,id).s.reduce((a,b)=>a+b,0);
const totalStars=S=>typeof LEVELS==='undefined'?0:LEVELS.reduce((a,L)=>a+campStars(S,L.id),0);
const campCleared=(S,id)=>!!campOf(S,id).c;
const campDone=(S,c)=>campCleared(S,LEVELS.find(L=>L.camp===c&&L.n===15).id);
const campOpen=(S,c)=>c===0||campDone(S,c-1);
const unlocked=(S,Lv)=>campOpen(S,Lv.camp)&&(Lv.n===1||campCleared(S,LEVELS.find(L=>L.camp===Lv.camp&&L.n===Lv.n-1).id));
const levelById=id=>LEVELS.find(L=>L.id===id);
function levelCfg(L){ return {W:L.W,H:L.H,ne:L.ne,seed:L.seed,shape:L.shape||null,map:L.map,pieces:L.pieces||null,goals:L.goals,limit:L.twist==='timed'?0:L.limit,
  relics:L.relics||null,twist:L.twist||'',refill:L.type!=='puzzle'}; }
function levelStars(L,won,spare,assisted){ return [won?1:0,won&&spare>=L.par?1:0,won&&!assisted?1:0]; }
function campaignResult(S,Lv,won,spare,assisted,score){ const c=campOf(S,Lv.id), C=CAMPS[Lv.camp], wasDone=campDone(S,Lv.camp), fresh=[]; let xp=0;
  const earned=levelStars(Lv,won,spare,assisted); c.tries=(c.tries||0)+1;
  if(won){ c.c=1; if(score>(c.best||0)) c.best=score; }
  earned.forEach((e,i)=>{ if(e&&!c.s[i]){ c.s[i]=1; fresh.push(i); xp+=C.xp; } });
  S.camp[Lv.id]=c; const finished=!wasDone&&campDone(S,Lv.camp); if(finished) xp+=C.bonus;
  return {earned,fresh,stars:campStars(S,Lv.id),xp,finished}; }

// ---------- Daily ----------
// QND1|YYYY-MM-DD builds the day's level from its weekday recipe: everyone gets the same board and the same refills.
const DAILY_RECIPES=[ // index = getDay(): 0 Sunday … 6 Saturday
 {ne:6,shape:'*',goals:[{t:'relic',n:1},{t:'collect',e:'*',n:18}],relics:{total:1,max:1},ob:[['r','top',1]],label:'Two goals on a shaped board'},
 {ne:4,goals:[{t:'score'}],label:'Score target'},
 {ne:4,goals:[{t:'collect',e:'*',n:80}],label:'Collect an element'},
 {ne:5,ob:[['f','*frost']],goals:[{t:'frost'}],label:'Clear the Frost'},
 {ne:5,relics:{total:3,max:2},ob:[['r','top',1]],goals:[{t:'relic',n:3}],label:'Bring down the relics'},
 {ne:5,ob:[['l','*lava']],goals:[{t:'lava'},{t:'score'}],label:'Lava and a score'},
 {ne:6,ob:[['g','*fog'],['c','rows',6,6]],goals:[{t:'fog'}],label:'Fog and Chains'}];
const weekdayOf=date=>{ const [y,m,d]=date.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay(); };
// the day's level (limit and score target come from the graded weekday table in levels.js)
function dailyCfg(date,grade){ const wd=weekdayOf(date), R=DAILY_RECIPES[wd], r=rngFor('QND1|'+date+'|recipe'), seed='QND1|'+date;
  const shape=R.shape==='*'?['heart','diamond','ring','cross','hourglass','islands'][Math.floor(r()*6)]:null, W=shape?9:8, H=shape?9:8;
  const G=grade||(typeof DAILY_GRADE!=='undefined'?DAILY_GRADE[wd]:{limit:25,par:5,score:10000});
  const goals=R.goals.map(g=>{ const o=Object.assign({},g); if(o.e==='*') o.e=Math.floor(r()*R.ne); if(o.t==='score') o.n=G.score; return o; });
  const map=R.ob?buildMap(W,H,shapeMask(shape,W,H),R.ob,r):null;
  return {W,H,ne:R.ne,seed,shape,map,goals,limit:G.limit,par:G.par,relics:R.relics||null,label:R.label,wd}; }
const dailyFingerprint=date=>fingerprint(newGame(dailyCfg(date)));
function dailyFor(S,date){ if(S.daily.date!==date) S.daily={date,scored:false,cleared:false,stars:0,left:0,score:0,assisted:false,run:null,practice:null}; return S.daily; }
const dayNum=date=>{ const [y,m,d]=date.split('-').map(Number); return Math.round(Date.UTC(y,m-1,d)/864e5); };
const dailyStars=(won,left,par,assisted)=>[won?1:0,won&&left>=par?1:0,won&&!assisted?1:0];
// The one scored attempt. Ending it without meeting the goal counts as the attempt too.
function dailyResult(S,date,won,left,score,assisted,today){ const d=dailyFor(S,date); if(d.scored) return null; const cfg=dailyCfg(date);
  const st=dailyStars(won,left,cfg.par,assisted), stars=st.reduce((a,b)=>a+b,0);
  Object.assign(d,{scored:true,cleared:won,stars,left,score,assisted,run:null});
  S.dhist[date]={won,stars,left,score,assisted}; const keys=Object.keys(S.dhist).sort(); while(keys.length>7) delete S.dhist[keys.shift()];
  let xp=0;
  if(won){ S.dclears=(S.dclears||0)+1; xp=20*(date===today?2:1); if(stars===3) S.d3=(S.d3||0)+1;
    const n=dayNum(date), last=S.dstreak.last?dayNum(S.dstreak.last):-99;
    if(n!==last){ S.dstreak.cur=n===last+1?S.dstreak.cur+1:1; S.dstreak.last=date; S.dstreak.best=Math.max(S.dstreak.best,S.dstreak.cur); }
    if(stars===3) S.dweek[weekdayOf(date)]=1; }
  return {stars:st,xp,won}; }
function streakNow(S,today){ const last=S.dstreak.last?dayNum(S.dstreak.last):-99; if(dayNum(today)-last>1) S.dstreak.cur=0; return S.dstreak.cur; }
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtNum=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
function shareLine(date,stars,left,score,won,assisted){ const [,m,dd]=date.split('-').map(Number), n=Array.isArray(stars)?stars.reduce((a,b)=>a+b,0):stars;
  return `Quintessence Daily · ${WD[weekdayOf(date)]} ${dd} ${MON[m-1]} · ${'★'.repeat(n)}${'☆'.repeat(3-n)} · ${won?`${left} move${left===1?'':'s'} left`:'not cleared'} · ${fmtNum(score)}${assisted?' · assisted':''}`; }

// ---------- achievements ----------
const EL_NAMES=['Fire','Water','Earth','Air','Lightning','Ice'];
const COMBOS=[['surge+surge','Crosswind','Swap two Surges together'],['surge+burst','Firestorm','Swap a Surge with a Burst'],['burst+burst','Supernova','Swap two Bursts together'],
 ['wisp+special','Hitchhiker','Swap a Wisp with a Surge or Burst'],['wisp+wisp','Flock','Swap two Wisps together'],['prism+special','Transmutation','Swap a Prism with a Surge, Burst or Wisp'],['prism+prism','Grand Unification','Swap two Prisms together']];
const comboKey=n=>/^wisp\+(surge|burst)$/.test(n)?'wisp+special':/^prism\+(surge|burst|wisp)$/.test(n)?'prism+special':n;
const ACH=[
 ...EL_NAMES.flatMap((e,i)=>[{id:`m${i}a`,g:'Elements',name:`${e} Adept`,desc:`Make 100 ${e} matches`,el:i,n:100},{id:`m${i}b`,g:'Elements',name:`${e} Master`,desc:`Make 1,000 ${e} matches`,el:i,n:1000}]),
 {id:'sp1',g:'Specials and combos',name:'Surge',desc:'Make a Surge (4 in a line)'},{id:'sp3',g:'Specials and combos',name:'Burst',desc:'Make a Burst (an L or T)'},
 {id:'sp4',g:'Specials and combos',name:'Wisp',desc:'Make a Wisp (a 2×2 square)'},{id:'sp5',g:'Specials and combos',name:'Prism',desc:'Make a Prism (5 in a line)'},
 ...COMBOS.map(([k,n,d],i)=>({id:k==='prism+prism'?'cb_pp':'cb'+i,g:'Specials and combos',name:n,desc:d,combo:k,reward:k==='prism+prism'?'Elemental Storm win effect':''})),
 {id:'casc5',g:'Cascades and skill',name:'Flow State',desc:'A cascade of 5'},{id:'casc10',g:'Cascades and skill',name:'Waterfall',desc:'A cascade of 10',reward:'Pixel Pop match effect'},
 {id:'five',g:'Cascades and skill',name:'Overload',desc:'Five specials in one move'},{id:'s100k',g:'Cascades and skill',name:'Six Figures',desc:'100,000 in a 30-move Classic game'},
 {id:'t60k',g:'Cascades and skill',name:'Quick Hands',desc:'60,000 in a 2:00 Timed game'},
 ...['thaw','quench','freeze','erode','clear','shatter'].map(r=>({id:'r_'+r,g:'Reactions',name:{thaw:'Thawmaster',quench:'Firefighter',freeze:'Cold Snap',erode:'Sandblaster',clear:'Fogbreaker',shatter:'Chainbreaker'}[r],desc:`Trigger ${r[0].toUpperCase()+r.slice(1)} 25 times`,react:r,n:25})),
 {id:'camp1',g:'Campaign',name:'Origins',desc:'Finish Origins'},{id:'camp2',g:'Campaign',name:'Stormfront',desc:'Finish Stormfront'},{id:'camp3',g:'Campaign',name:'Frostfall',desc:'Finish Frostfall'},
 {id:'perf1',g:'Campaign',name:'Perfect Origins',desc:'3 stars on every Origins level'},{id:'perf2',g:'Campaign',name:'Perfect Stormfront',desc:'3 stars on every Stormfront level'},{id:'perf3',g:'Campaign',name:'Perfect Frostfall',desc:'3 stars on every Frostfall level'},
 {id:'puzzle',g:'Campaign',name:'Puzzle Master',desc:'All three puzzle levels at 3 stars',reward:'Glyphs element skin'},
 ...[10,50,100,250,500].map(n=>({id:'g'+n,g:'Classic and Zen',name:{10:'Getting Started',50:'Regular',100:'Centurion',250:'Devotee',500:'Elementalist'}[n],desc:`Clear ${n} Classic games (Moves or Timed, a bronze star or better)`,n})),
 {id:'zen30',g:'Classic and Zen',name:'Inner Peace',desc:'Play 30 minutes in one Zen run'},
 {id:'d7',g:'Daily',name:'Week of Dailies',desc:'Clear 7 Dailies',n:7},{id:'d30',g:'Daily',name:'Daily Regular',desc:'Clear 30 Dailies',n:30},{id:'d100',g:'Daily',name:'Daily Devotee',desc:'Clear 100 Dailies',n:100},
 {id:'dstar1',g:'Daily',name:'Daily Star',desc:'3 stars on a Daily',n:1,reward:'Daylight music'},{id:'dstar10',g:'Daily',name:'Star Collector',desc:'3 stars on 10 Dailies',n:10},{id:'dstar30',g:'Daily',name:'Constellation',desc:'3 stars on 30 Dailies',n:30},
 {id:'dstreak',g:'Daily',name:'Daily Streak',desc:'Clear the Daily 7 days in a row'},{id:'dweek',g:'Daily',name:'Full Week',desc:'3 stars on every weekday\'s Daily (Monday–Sunday, any weeks)',reward:'Paper board'}];
// fold a finished move's stats into the totals (matches per element, specials, combos, reactions)
function addStats(S,before,after){ const T=S.tot;
  for(let e=0;e<6;e++) T.m[e]+=after.matches[e]-before.matches[e];
  for(let s=1;s<=5;s++) T.made[s]=(T.made[s]||0)+after.made[s]-before.made[s];
  for(const k in after.combos){ const d=after.combos[k]-(before.combos[k]||0); if(d>0){ const ck=comboKey(k); T.combos[ck]=(T.combos[ck]||0)+d; } }
  for(const k in after.react){ const d=after.react[k]-(before.react[k]||0); if(d>0) T.react[k]=(T.react[k]||0)+d; } }
// ctx: {mode, won, cascade (best this game), specials (most in one move), score, setup (Classic), zenMs}
function checkAch(S,ctx){ const got=[], give=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); got.push(id); } };
  if(ctx.practice) return got; const T=S.tot;
  for(const a of ACH){ if(a.el!=null&&T.m[a.el]>=a.n) give(a.id); if(a.react&&(T.react[a.react]||0)>=a.n) give(a.id); if(a.combo&&T.combos[a.combo]) give(a.id); }
  for(const s of [1,3,4,5]) if(T.made[s]||(s===1&&T.made[2])) give('sp'+s);
  if(S.rec.best>=5) give('casc5'); if(S.rec.best>=10) give('casc10'); if(S.rec.mostSp>=5) give('five');
  if(ctx.mode==='classic'&&ctx.setup){ if(ctx.setup.mode==='moves'&&ctx.score>=100000) give('s100k'); if(ctx.setup.mode==='timed'&&ctx.score>=60000) give('t60k'); }
  for(const n of [10,50,100,250,500]) if(S.rec.clears>=n) give('g'+n);
  if((ctx.zenMs||0)>=30*60000) give('zen30');
  if(typeof LEVELS!=='undefined'){ CAMPS.forEach((cp,i)=>{ if(campDone(S,i)) give('camp'+(i+1)); if(LEVELS.filter(L=>L.camp===i).every(L=>campStars(S,L.id)>=3)) give('perf'+(i+1)); });
    if(LEVELS.filter(L=>L.type==='puzzle').every(L=>campStars(S,L.id)>=3)) give('puzzle'); }
  const n=S.dclears||0, s3=S.d3||0; if(n>=7) give('d7'); if(n>=30) give('d30'); if(n>=100) give('d100');
  if(s3>=1) give('dstar1'); if(s3>=10) give('dstar10'); if(s3>=30) give('dstar30'); if(S.dstreak.cur>=7) give('dstreak'); if(S.dweek.every(Boolean)) give('dweek');
  return got; }
function achProgress(S,a){ const T=S.tot; if(a.el!=null) return [Math.min(T.m[a.el],a.n),a.n]; if(a.react) return [Math.min(T.react[a.react]||0,a.n),a.n];
  if(/^g\d/.test(a.id)) return [Math.min(S.rec.clears,a.n),a.n]; if(/^d\d/.test(a.id)) return [Math.min(S.dclears||0,a.n),a.n]; if(/^dstar/.test(a.id)) return [Math.min(S.d3||0,a.n),a.n];
  if(a.id==='dweek') return [S.dweek.filter(Boolean).length,7]; return null; }

// ---------- backup (Quintessence only) ----------
const b64e=str=>{ const u=new TextEncoder().encode(str); let b=''; for(let i=0;i<u.length;i++) b+=String.fromCharCode(u[i]); return btoa(b); };
const b64d=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
function backupPlain(S){ return 'QUINTESSENCE1.'+b64e(JSON.stringify(S)); }
function parseBackup(text){ const m=/QUINTESSENCE1\.([A-Za-z0-9+/=]+)/.exec(String(text||'')); if(!m) return null;
  try{ const o=JSON.parse(b64d(m[1])); if(!o||typeof o!=='object'||typeof o.xp!=='number') return null; return o; }catch(e){ return null; } }

// ---------- Arcade contract ----------
function readArcade(store){ try{ const a=JSON.parse(store.get(ARCADE_KEY)||'null'); if(!a||typeof a!=='object') return null; return a; }catch(e){ return null; } }
function applyShared(S,a){ if(!a) return S; const o=Object.assign({},S), set=a.set||{}; for(const k of SHARED) if(set[k]!==undefined) o[k]=set[k]; if(typeof a.name==='string'&&a.name) o.name=a.name; return o; }
function summary(S){ const l=levelOf(S.xp), nL=typeof LEVELS==='undefined'?45:LEVELS.length;
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:l,xpNext:xpNext(S),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Campaign stars',`${totalStars(S)}/${nL*3}`],['Best cascade',String(S.rec.best||0)],['Daily streak',String(S.dstreak.cur)]],
    last:Date.now()}; }
