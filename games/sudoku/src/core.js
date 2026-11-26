// ===================== Sudoku core =====================
// Save, XP and levels, hints, records, stars, the bank, Classic picks, campaign, the Daily, achievements,
// cosmetics, backup and the Arcade contract. No DOM: storage is passed in, so Node tests can run it.
const VERSION='0.1.0', GAME_ID='sudoku', KEY='sudoku.v1', SUMKEY='arcade.summary.sudoku', ARCADE_KEY='arcade.v1';
const MAXL=10, LVXP=[0,50,150,300,525,825,1225,1725,2375,3175]; // Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LVXP[l]) l++; return l; };
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];
const HINT_CAP=5, HINT_MAX=99;

function defSave(reduced){ return {v:1,xp:0,ach:{},camp:{},campTab:0,hints:HINT_CAP,hintDate:'',
  setup:{variant:'classic',grade:'normal'},used:{},
  rec:{by:{},clears:0,underPar:0,classicWins:0,top:{}},
  daily:{date:'',scored:false,cleared:false,stars:0,time:0,mistakes:0,assisted:false,run:null,practice:null},
  dhist:{},dstreak:{cur:0,best:0,last:''},dweek:[0,0,0,0,0,0,0],dclears:0,d3:0,
  look:{theme:'paper',font:'inter',notes:'grid',hl:'accent',comp:'ripple',win:'none',track:'inkwell',amb:'none',sound:'soft'},
  prefs:{check:true,autoNotes:true,hlSame:true,hlHouse:true,digitFirst:false,large:false,speed:'normal',contrast:false,cbhl:false},
  sfx:true,music:true,haptics:true,motion:!reduced,appearance:'system',fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  run:null,seenVer:'',bk:{last:0},howto:false}; }
const defRec=()=>({games:0,wins:0,cur:0,best:0,bt:0,fm:-1});
const NESTED=['setup','rec','daily','dstreak','look','prefs','bk'];
// Old saves missing new fields are filled in from defSave() (one level deep for nested groups)
function loadSave(raw,reduced){ const d=defSave(reduced); let s=null; try{ s=raw?JSON.parse(raw):null; }catch(e){ s=null; }
  if(!s||typeof s!=='object') return d;
  for(const k in d){ if(s[k]===undefined) continue;
    if(NESTED.includes(k)&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) d[k]=Object.assign(d[k],s[k]); else d[k]=s[k]; }
  for(const k in d.rec.by) d.rec.by[k]=Object.assign(defRec(),d.rec.by[k]);
  return d; }

// ---------- the bank ----------
const BANK={};
function bankList(variant,grade){ const k=variant+'|'+grade; if(!BANK[k]){ const raw=BANK_RAW[k]||'', NN=VARIANTS[variant].N**2, jig=!!VARIANTS[variant].jig;
    BANK[k]=raw?raw.split(',').map((e,i)=>{ const d=decPuzzle(e,NN,jig); return {variant,grade,k:i,givens:d.givens,regions:jig?BANK_REGIONS[d.layout]:null,layout:d.layout}; }):[]; }
  return BANK[k]; }
// solution, grade and par time of a puzzle (computed once, from the logic solver)
const INFO={};
function puzzleInfo(p){ const key=p.variant+'|'+p.givens+'|'+(p.regions||''); if(INFO[key]) return INFO[key];
  const g=geom(p.variant,p.regions), r=logicSolve(g,toVals(p.givens),3);
  return INFO[key]={sol:r.solved?toStr(r.vals):toStr(solveExact(g,toVals(p.givens),1).sol),grade:GRADES[r.grade],hardest:r.hardest,counts:r.counts,par:parSeconds(p.variant,r.counts)}; }
const fmtTime=ms=>{ const s=Math.floor(ms/1000); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const variantName=v=>VARIANTS[v].name;
const puzzleLabel=p=>`${variantName(p.variant)} · ${GRADE_NAMES[p.grade]}`;

// ---------- Classic: pick from the bank, no repeats until that part of the bank is used up ----------
function pickBank(S,variant,grade,rnd){ const pool=bankList(variant,grade); if(!pool.length) return null; const key=variant+'|'+grade;
  let used=S.used[key]||[]; let left=pool.filter(p=>!used.includes(p.k)); if(!left.length){ used=[]; left=pool; }
  const p=left[Math.floor(rnd()*left.length)]; used.push(p.k); S.used[key]=used; return Object.assign({src:'bank'},p); }
const canGenerate=(variant,grade)=>(GEN_ON_PHONE[variant]||[]).includes(grade);

// ---------- cosmetics ----------
// Unlocks: lvl (XP level), req (an achievement) or stars (campaign star total). Digits always stay instantly readable:
// givens and player digits always differ in weight and colour, and every font is tested at 38 px cells.
const COS={
 theme:[{id:'paper',name:'Paper'},{id:'slate',name:'Slate',lvl:2},{id:'graph',name:'Graph Paper',lvl:6},{id:'midnight',name:'Midnight',lvl:9},{id:'sakura',name:'Sakura',stars:75},{id:'terminal',name:'Terminal',req:'wing'}],
 font:[{id:'inter',name:'Inter'},{id:'mono',name:'JetBrains Mono',lvl:5},{id:'serif',name:'Serif',lvl:8},{id:'rounded',name:'Rounded',lvl:10},{id:'hand',name:'Handwritten',req:'pencil'}],
 notes:[{id:'grid',name:'Grid'},{id:'corner',name:'Corner',lvl:3},{id:'centre',name:'Centre',lvl:7}],
 hl:[{id:'accent',name:'Accent'},{id:'sky',name:'Sky',lvl:3},{id:'mint',name:'Mint',lvl:6},{id:'amber',name:'Amber',lvl:8},{id:'violet',name:'Violet',lvl:10}],
 comp:[{id:'ripple',name:'Ripple'},{id:'shimmer',name:'Shimmer',lvl:5},{id:'pulse',name:'Pulse',lvl:8},{id:'sweep',name:'Sweep',req:'poly'}],
 win:[{id:'none',name:'None'},{id:'confetti',name:'Confetti',lvl:2},{id:'fireworks',name:'Fireworks',lvl:7},{id:'rain',name:'Digit Rain',stars:30},{id:'glow',name:'Grid Glow',stars:135}],
 track:[{id:'inkwell',name:'Inkwell'},{id:'lanterns',name:'Lanterns',lvl:10},{id:'daylight',name:'Daylight',req:'dstar1'}],
 amb:[{id:'none',name:'No ambience'},{id:'rain',name:'Rain',lvl:4},{id:'cafe',name:'Café',lvl:7},{id:'library',name:'Library',req:'scholar'}],
 sound:[{id:'soft',name:'Soft'},{id:'pencil',name:'Pencil',lvl:4},{id:'chip',name:'Chiptune',lvl:9}]};
const COS_KINDS=[['theme','Board theme'],['font','Digit font'],['notes','Note style'],['hl','Highlight colour'],['comp','Completion effect'],['win','Win effect'],['track','Music'],['amb','Ambience'],['sound','Sound pack']];
const owned=(S,it)=>(!it.lvl||levelOf(S.xp)>=it.lvl)&&(!it.req||!!S.ach[it.req])&&(!it.stars||totalStars(S)>=it.stars);
const findCos=(kind,id)=>COS[kind].find(c=>c.id===id)||COS[kind][0];
function rewardsAt(level){ const o=[]; for(const [k,n] of COS_KINDS) for(const it of COS[k]) if(it.lvl===level) o.push(`${it.name} (${n.toLowerCase()})`); return o; }
const STARTER='Paper board, Inter digits, Grid notes, Ripple completion, Inkwell music, Soft sounds';
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
const CLASSIC_XP={easy:10,normal:15,hard:22,expert:30};
// Classic win by grade; an assisted win (a hint or a red mistake) earns half. Losses earn nothing.
const classicXP=(grade,assisted)=>assisted?Math.ceil(CLASSIC_XP[grade]/2):CLASSIC_XP[grade];

// ---------- stars: ★ clear, ★ under par time, ★ no assists (no hints and no mistakes) ----------
const assistedOf=(hints,mistakes)=>hints>0||mistakes>0;
function winStars(won,time,par,assisted){ return [won?1:0,won&&time<=par*1000?1:0,won&&!assisted?1:0]; }

// ---------- records ----------
// Wins, best time (unassisted), fewest mistakes and the win streak, per variant × difficulty. A started Classic game
// that is abandoned counts as a loss for the streak.
const recOf=(S,v,g)=>S.rec.by[v+'|'+g]||(S.rec.by[v+'|'+g]=defRec());
function recordClassic(S,p,won,time,mistakes,assisted){ const r=recOf(S,p.variant,p.grade), fresh=[];
  r.games++; if(won){ r.wins++; r.cur++; r.best=Math.max(r.best,r.cur); S.rec.classicWins++;
    if(!assisted&&(!r.bt||time<r.bt)){ r.bt=time; fresh.push('Best time'); }
    if(r.fm<0||mistakes<r.fm){ if(r.fm>=0) fresh.push('Fewest mistakes'); r.fm=mistakes; } } else r.cur=0;
  return fresh; }
// every cleared puzzle (Classic, campaign or the Daily's scored attempt) counts toward the cumulative clears
function countClear(S,p,time,par){ S.rec.clears++; if(time<=par*1000) S.rec.underPar++; }

// ---------- campaign ----------
const campOf=(S,id)=>S.camp[id]||{c:0,s:[0,0,0],bt:0,tries:0};
const campStars=(S,id)=>campOf(S,id).s.reduce((a,b)=>a+b,0);
const totalStars=S=>LEVELS.reduce((a,L)=>a+campStars(S,L.id),0);
const campCleared=(S,id)=>!!campOf(S,id).c;
const campDone=(S,c)=>campCleared(S,LEVELS.find(L=>L.camp===c&&L.n===15).id);
const campOpen=(S,c)=>c===0||campDone(S,c-1);
// clearing a level unlocks the next; clearing level 15 unlocks the next campaign
const unlocked=(S,Lv)=>campOpen(S,Lv.camp)&&(Lv.n===1||campCleared(S,LEVELS.find(L=>L.camp===Lv.camp&&L.n===Lv.n-1).id));
const levelById=id=>LEVELS.find(L=>L.id===id);
// the rules a level plays under (its twist)
const levelCfg=L=>({notes:L.twist!=='nonotes',check:L.twist==='nocheck'?false:undefined,limit:L.twist==='limit'?3:0});
const levelPuzzle=L=>({variant:L.variant,grade:L.grade,givens:L.givens,regions:L.regions||null,notes:L.notes||null,seed:L.id,par:L.par,src:'level'});
// Stars build up across attempts (each is earned once). Clearing is required for any star.
function campaignResult(S,Lv,won,time,assisted){ const c=campOf(S,Lv.id), C=CAMPS[Lv.camp], wasDone=campDone(S,Lv.camp), fresh=[]; let xp=0;
  const earned=winStars(won,time,Lv.par,assisted);
  c.tries=(c.tries||0)+1;
  if(won){ c.c=1; if(!c.bt||time<c.bt) c.bt=time; }
  earned.forEach((e,i)=>{ if(e&&!c.s[i]){ c.s[i]=1; fresh.push(i); xp+=C.xp; } });
  S.camp[Lv.id]=c; const finished=!wasDone&&campDone(S,Lv.camp); if(finished) xp+=C.bonus;
  return {earned,fresh,stars:campStars(S,Lv.id),xp,finished}; }

// ---------- Daily ----------
// SUDD1|YYYY-MM-DD picks the day's puzzle from the bank; difficulty by weekday, matching Solitaire and Mahjong.
const DAILY_TABLE=[ // index = getDay(): 0 Sunday … 6 Saturday
  {variant:'classic',grade:'expert'},{variant:'classic',grade:'easy'},{variant:'classic',grade:'normal'},{variant:'diag',grade:'normal'},
  {variant:'classic',grade:'hard'},{variant:'jigsaw',grade:'hard'},{variant:'diag',grade:'hard'}];
const weekdayOf=date=>{ const [y,m,d]=date.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay(); };
function dailyPuzzle(date){ const w=DAILY_TABLE[weekdayOf(date)], pool=bankList(w.variant,w.grade), r=rngFor('SUDD1|'+date);
  const p=pool[Math.floor(r()*pool.length)]; return Object.assign({},p,{daily:date,seed:'SUDD1|'+date,src:'daily',par:puzzleInfo(p).par}); }
const dailyFingerprint=date=>{ const p=dailyPuzzle(date); return `${p.variant}|${p.grade}|${p.k}`; };
function dailyFor(S,date){ if(S.daily.date!==date) S.daily={date,scored:false,cleared:false,stars:0,time:0,mistakes:0,assisted:false,run:null,practice:null}; return S.daily; }
const dayNum=date=>{ const [y,m,d]=date.split('-').map(Number); return Math.round(Date.UTC(y,m-1,d)/864e5); };
// The one scored attempt. Ending it without clearing counts as the attempt too.
function dailyResult(S,date,won,time,mistakes,assisted,today){ const d=dailyFor(S,date); if(d.scored) return null; const p=dailyPuzzle(date);
  const st=winStars(won,time,p.par,assisted), stars=st.reduce((a,b)=>a+b,0);
  Object.assign(d,{scored:true,cleared:won,stars,time,mistakes,assisted,run:null});
  S.dhist[date]={won,stars,time,assisted,variant:p.variant}; const keys=Object.keys(S.dhist).sort(); while(keys.length>7) delete S.dhist[keys.shift()]; // the last 7 Dailies
  let xp=0;
  if(won){ S.dclears=(S.dclears||0)+1; xp=20*(date===today?2:1); if(stars===3) S.d3=(S.d3||0)+1;
    const n=dayNum(date), last=S.dstreak.last?dayNum(S.dstreak.last):-99;
    if(n!==last){ S.dstreak.cur=n===last+1?S.dstreak.cur+1:1; S.dstreak.last=date; S.dstreak.best=Math.max(S.dstreak.best,S.dstreak.cur); }
    if(stars===3) S.dweek[weekdayOf(date)]=1; }
  return {stars:st,xp,won}; }
// a streak is broken once a whole day has passed without a cleared Daily
function streakNow(S,today){ const last=S.dstreak.last?dayNum(S.dstreak.last):-99; if(dayNum(today)-last>1) S.dstreak.cur=0; return S.dstreak.cur; }
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function shareLine(date,time,stars,assisted,won){ const [,m,dd]=date.split('-').map(Number), n=stars.reduce?stars.reduce((a,b)=>a+b,0):stars, p=dailyPuzzle(date);
  return `Sudoku Daily · ${WD[weekdayOf(date)]} ${dd} ${MON[m-1]} · ${variantName(p.variant)} · ${won?fmtTime(time):'not cleared'} · ${'★'.repeat(n)}${'☆'.repeat(3-n)}${assisted?' · assisted':''}`; }

// ---------- achievements ----------
const ACH=[
 {id:'g_easy',g:'Difficulty',name:'Warm Start',desc:'Clear an Easy puzzle'},
 {id:'g_normal',g:'Difficulty',name:'Steady Hand',desc:'Clear a Normal puzzle'},
 {id:'g_hard',g:'Difficulty',name:'Deep Thinker',desc:'Clear a Hard puzzle'},
 {id:'g_expert',g:'Difficulty',name:'Expert Solver',desc:'Clear an Expert puzzle'},
 {id:'p_easy',g:'Difficulty',name:'Brisk',desc:'Clear an Easy puzzle under par time'},
 {id:'p_normal',g:'Difficulty',name:'Good Pace',desc:'Clear a Normal puzzle under par time'},
 {id:'p_hard',g:'Difficulty',name:'Quick Study',desc:'Clear a Hard puzzle under par time'},
 {id:'p_expert',g:'Difficulty',name:'Lightning Logic',desc:'Clear an Expert puzzle under par time'},
 {id:'a_easy',g:'Difficulty',name:'Clean Slate',desc:'Clear an Easy puzzle with no assists'},
 {id:'a_normal',g:'Difficulty',name:'Clean Sheet',desc:'Clear a Normal puzzle with no assists'},
 {id:'a_hard',g:'Difficulty',name:'Clear Head',desc:'Clear a Hard puzzle with no assists'},
 {id:'a_expert',g:'Difficulty',name:'Flawless',desc:'Clear an Expert puzzle with no assists'},
 {id:'v_mini',g:'Variants',name:'Small Wonder',desc:'Clear a Mini'},
 {id:'v_diag',g:'Variants',name:'Cross Purposes',desc:'Clear a Diagonal'},
 {id:'v_jigsaw',g:'Variants',name:'Puzzle Pieces',desc:'Clear a Jigsaw'},
 {id:'poly',g:'Variants',name:'Polymath',desc:'Clear Classic, Diagonal and Jigsaw at Hard or above, and a Mini at Normal',reward:'Sweep completion effect'},
 {id:'c10',g:'Puzzles solved',name:'Ten Down',desc:'Clear 10 puzzles',n:10},
 {id:'c50',g:'Puzzles solved',name:'Half Century',desc:'Clear 50 puzzles',n:50},
 {id:'c100',g:'Puzzles solved',name:'Centurion',desc:'Clear 100 puzzles',n:100},
 {id:'c250',g:'Puzzles solved',name:'Devotee',desc:'Clear 250 puzzles',n:250},
 {id:'c500',g:'Puzzles solved',name:'Grandmaster',desc:'Clear 500 puzzles',n:500},
 {id:'wing',g:'Technique',name:'Wing It',desc:'Clear a puzzle that needs an XY-Wing or XYZ-Wing',reward:'Terminal board'},
 {id:'pencil',g:'Technique',name:'Pencil Pusher',desc:'Clear a Hard or Expert puzzle without using Fill notes',reward:'Handwritten digits'},
 {id:'ink',g:'Technique',name:'Ink Only',desc:'Clear a Normal or harder puzzle with no notes at all'},
 {id:'camp1',g:'Campaign',name:'Novice Graduate',desc:'Finish Novice'},
 {id:'camp2',g:'Campaign',name:'Adept Graduate',desc:'Finish Adept'},
 {id:'camp3',g:'Campaign',name:'Master Graduate',desc:'Finish Master'},
 {id:'perf1',g:'Campaign',name:'Perfect Novice',desc:'3 stars on every Novice level'},
 {id:'perf2',g:'Campaign',name:'Perfect Adept',desc:'3 stars on every Adept level'},
 {id:'perf3',g:'Campaign',name:'Perfect Master',desc:'3 stars on every Master level'},
 {id:'scholar',g:'Campaign',name:'Scholar',desc:'3 stars on all three technique puzzles',reward:'Library ambience'},
 {id:'d7',g:'Daily',name:'Week of Dailies',desc:'Clear 7 Dailies',n:7},
 {id:'d30',g:'Daily',name:'Daily Regular',desc:'Clear 30 Dailies',n:30},
 {id:'d100',g:'Daily',name:'Daily Devotee',desc:'Clear 100 Dailies',n:100},
 {id:'dstar1',g:'Daily',name:'Daily Star',desc:'3 stars on a Daily',n:1,reward:'Daylight music'},
 {id:'dstar10',g:'Daily',name:'Star Collector',desc:'3 stars on 10 Dailies',n:10},
 {id:'dstar30',g:'Daily',name:'Constellation',desc:'3 stars on 30 Dailies',n:30},
 {id:'dstreak',g:'Daily',name:'Daily Streak',desc:'Clear the Daily 7 days in a row'},
 {id:'dweek',g:'Daily',name:'Full Week',desc:'3 stars on every weekday\'s Daily (Monday–Sunday, any weeks)'}];
// ctx: {mode, won, p (variant, grade), time, par, assisted, fillUsed, notesUsed, counts (techniques the puzzle needs), practice}
function checkAch(S,ctx){ const got=[], give=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); got.push(id); } };
  if(ctx.practice) return got;
  if(ctx.won&&ctx.p){ const p=ctx.p, g=p.grade, gi=GRADES.indexOf(g);
    give('g_'+g); if(ctx.time<=ctx.par*1000) give('p_'+g); if(!ctx.assisted) give('a_'+g);
    if(p.variant!=='classic') give('v_'+p.variant);
    const top=S.rec.top; if(gi>=2||(p.variant==='mini'&&g==='normal')) top[p.variant]=1;
    if(['classic','diag','jigsaw','mini'].every(v=>top[v])) give('poly');
    for(const a of ACH) if(a.g==='Puzzles solved'&&S.rec.clears>=a.n) give(a.id);
    if(ctx.counts&&(ctx.counts.xy||ctx.counts.xyz)) give('wing');
    if(gi>=2&&!ctx.fillUsed) give('pencil'); if(gi>=1&&!ctx.notesUsed) give('ink'); }
  if(ctx.mode==='campaign'){ CAMPS.forEach((cp,i)=>{ if(campDone(S,i)) give('camp'+(i+1)); if(LEVELS.filter(L=>L.camp===i).every(L=>campStars(S,L.id)>=3)) give('perf'+(i+1)); });
    if(LEVELS.filter(L=>L.type==='tech').every(L=>campStars(S,L.id)>=3)) give('scholar'); }
  if(ctx.mode==='daily'){ const n=S.dclears||0, s3=S.d3||0; if(n>=7) give('d7'); if(n>=30) give('d30'); if(n>=100) give('d100');
    if(s3>=1) give('dstar1'); if(s3>=10) give('dstar10'); if(s3>=30) give('dstar30'); if(S.dstreak.cur>=7) give('dstreak'); if(S.dweek.every(Boolean)) give('dweek'); }
  return got; }
const achProgress=(S,a)=>a.g==='Puzzles solved'?Math.min(S.rec.clears,a.n):/^d\d/.test(a.id)?Math.min(S.dclears||0,a.n):/^dstar/.test(a.id)?Math.min(S.d3||0,a.n):a.id==='dweek'?S.dweek.filter(Boolean).length:null;
const achTotal=a=>a.n||(a.id==='dweek'?7:null);

// ---------- backup (Sudoku only) ----------
// SUDOKU1Z.<base64 gzip> where the app can compress, SUDOKU1.<base64> otherwise. Both decode here (the app inflates Z).
const b64e=str=>{ const u=new TextEncoder().encode(str); let b=''; for(let i=0;i<u.length;i++) b+=String.fromCharCode(u[i]); return btoa(b); };
const b64d=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
function backupPlain(S){ return 'SUDOKU1.'+b64e(JSON.stringify(S)); }
function parseBackup(text){ const m=/SUDOKU1\.([A-Za-z0-9+/=]+)/.exec(String(text||'')); if(!m) return null;
  try{ const o=JSON.parse(b64d(m[1])); if(!o||typeof o!=='object'||typeof o.xp!=='number') return null; return o; }catch(e){ return null; } }

// ---------- Arcade contract ----------
// Shared settings live in arcade.v1 (read only, never written). They're applied in memory only.
function readArcade(store){ try{ const a=JSON.parse(store.get(ARCADE_KEY)||'null'); if(!a||typeof a!=='object') return null; return a; }catch(e){ return null; } }
function applyShared(S,a){ if(!a) return S; const o=Object.assign({},S), set=a.set||{}; for(const k of SHARED) if(set[k]!==undefined) o[k]=set[k]; if(typeof a.name==='string'&&a.name) o.name=a.name; return o; }
function summary(S){ const l=levelOf(S.xp);
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:l,xpNext:xpNext(S),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Puzzles solved',String(S.rec.clears)],['Campaign stars',`${totalStars(S)}/${LEVELS.length*3}`],['Daily streak',String(S.dstreak.cur)]],
    last:Date.now()}; }
