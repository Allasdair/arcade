// ===================== Chess core =====================
// Save, XP and levels, hints, records, stars, puzzles, the Daily, the campaign, 2-Player games, achievements,
// cosmetics, backup and the Arcade contract. No DOM: storage is passed in, so Node tests can run it.
const VERSION='0.1.0', GAME_ID='chess', KEY='chess.v1', SUMKEY='arcade.summary.chess', ARCADE_KEY='arcade.v1';
const MAXL=10, LVXP=[0,50,150,300,525,825,1225,1725,2375,3175]; // Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LVXP[l]) l++; return l; };
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];
const HINT_CAP=5, HINT_MAX=99;
const ACC_STAR=75; // the third star in Classic and campaign games: accuracy ≥ 75% from the post-game analysis

function defSave(reduced){ return {v:1,xp:0,ach:{},camp:{},campTab:0,hints:HINT_CAP,hintDate:'',
  setup:{level:3,colour:'random',clock:'none',start:'standard'},puz:{by:'band',band:'easy',theme:'mateIn1'},pused:{},
  rec:{by:{},bestAcc:0,streak:0,bestStreak:0,c960:{w:0,d:0,l:0},games:0,puzSolved:0,puzFirst:0,puzStreak:0,puzBest:0,puzDay:{date:'',xp:0},pp:{w:0,b:0,d:0},wins:0,mates:0},
  daily:{date:'',scored:false,cleared:false,stars:0,time:0,first:false,hints:0,run:null,practice:null},
  dhist:{},dstreak:{cur:0,best:0,last:''},dweek:[0,0,0,0,0,0,0],dclears:0,d3:0,
  tp:{games:[],deleted:[],wins:0,counted:[]},anq:[],
  look:{pieces:'classic',board:'walnut',hl:'accent',check:'pulse',win:'none',track:'study',amb:'none',sound:'wood'},
  prefs:{legal:true,coords:true,autoQ:false,confirm:false,autoFlip:true,delay:true,analyse:true,notation:'letters',speed:'normal',letters:false,contrast:false,bigCoords:false},
  sfx:true,music:true,haptics:true,motion:!reduced,appearance:'system',fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  run:null,seenVer:'',bk:{last:0},howto:false}; }
const NESTED=['setup','puz','rec','daily','dstreak','tp','look','prefs','bk'];
// Old saves missing new fields are filled in from defSave() (one level deep for nested groups)
function loadSave(raw,reduced){ const d=defSave(reduced); let s=null; try{ s=raw?JSON.parse(raw):null; }catch(e){ s=null; }
  if(!s||typeof s!=='object') return d;
  for(const k in d){ if(s[k]===undefined) continue;
    if(NESTED.includes(k)&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) d[k]=Object.assign(d[k],s[k]); else d[k]=s[k]; }
  return d; }
const fmtTime=ms=>{ const s=Math.max(0,Math.floor(ms/1000)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const fmtClock=ms=>{ if(ms<10000&&ms>0) return (Math.floor(ms/100)/10).toFixed(1); return fmtTime(Math.ceil(ms/1000)*1000); };
const strengthName=n=>STRENGTHS[n].name;
const strengthLabel=n=>`${n} · ${STRENGTHS[n].name} · ~${STRENGTHS[n].elo}`;

// ---------- clocks: minutes + seconds added per move ----------
const CLOCKS={none:null,'10':{base:600000,inc:0,name:'10 min'},'5+3':{base:300000,inc:3000,name:'5 + 3'},'3+2':{base:180000,inc:2000,name:'3 + 2'}};

// ---------- cosmetics ----------
// Unlocks: lvl (XP level), req (an achievement) or stars (campaign star total). Pieces always stay instantly
// recognisable; the Letter pieces, high-contrast boards and large coordinates are free settings, never locked.
const COS={
 pieces:[{id:'classic',name:'Classic'},{id:'minimal',name:'Minimal',lvl:3},{id:'flat',name:'Flat',lvl:6},{id:'pixel',name:'Pixel',lvl:9},{id:'glass',name:'Glass',stars:30},{id:'medieval',name:'Medieval',stars:135}],
 board:[{id:'walnut',name:'Walnut'},{id:'green',name:'Green Tournament',lvl:2},{id:'slate',name:'Slate',lvl:5},{id:'marble',name:'Marble',lvl:8},{id:'paper',name:'Paper',lvl:10},{id:'midnight',name:'Midnight',stars:75}],
 hl:[{id:'accent',name:'Accent'},{id:'amber',name:'Amber',lvl:3},{id:'sky',name:'Sky',lvl:6},{id:'mint',name:'Mint',lvl:8}],
 check:[{id:'pulse',name:'Pulse'},{id:'ripple',name:'Ripple',lvl:5},{id:'crack',name:'Crack',req:'smother'}],
 win:[{id:'none',name:'None'},{id:'confetti',name:'Confetti',lvl:2},{id:'topple',name:'King Topple',lvl:7},{id:'fireworks',name:'Fireworks',req:'perfect'}],
 track:[{id:'study',name:'Study'},{id:'gambit',name:'Gambit',lvl:10},{id:'daylight',name:'Daylight',req:'dstar1'}],
 amb:[{id:'none',name:'No ambience'},{id:'library',name:'Library',lvl:4},{id:'rain',name:'Rain',lvl:7},{id:'park',name:'Park',req:'pstreak10'}],
 sound:[{id:'wood',name:'Wood'},{id:'felt',name:'Felt',lvl:4},{id:'chip',name:'Chiptune',lvl:9}]};
const COS_KINDS=[['pieces','Piece set'],['board','Board'],['hl','Highlights'],['check','Check and mate effect'],['win','Win effect'],['track','Music'],['amb','Ambience'],['sound','Sound pack']];
const owned=(S,it)=>(!it.lvl||levelOf(S.xp)>=it.lvl)&&(!it.req||!!S.ach[it.req])&&(!it.stars||totalStars(S)>=it.stars);
const findCos=(kind,id)=>COS[kind].find(c=>c.id===id)||COS[kind][0];
function rewardsAt(level){ const o=[]; for(const [k,n] of COS_KINDS) for(const it of COS[k]) if(it.lvl===level) o.push(`${it.name} (${n.toLowerCase()})`); return o; }
const STARTER='Classic pieces, Walnut board, Accent highlights, Pulse effect, Study music, Wood sounds';
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
// Classic game: a win pays 5 + 5 × strength (10–45); a draw half; an assisted result half again; losses nothing.
function classicXP(level,result,assisted){ const base=5+5*level; let x=result==='win'?base:result==='draw'?base/2:0; if(assisted) x/=2; return Math.round(x); }
// Puzzles: 2 XP per Classic puzzle solved first try, capped at 30 a day
function puzzleXP(S,today){ const d=S.rec.puzDay; if(d.date!==today){ d.date=today; d.xp=0; } const x=Math.min(2,30-d.xp); d.xp+=Math.max(0,x); return Math.max(0,x); }

// ---------- records ----------
// wins, draws and losses per strength × colour; best accuracy; longest win streak; the Chess960 record.
// An abandoned Classic game counts as a loss for the streak.
const recKey=(level,colour)=>level+'|'+(colour===WHITE?'w':'b');
function recordGame(S,o){ // o: {level, colour, result 'win'|'draw'|'loss', c960}
  const k=recKey(o.level,o.colour), r=S.rec.by[k]||(S.rec.by[k]={w:0,d:0,l:0}), R=S.rec; const fresh=[];
  r[o.result[0]]++; R.games++;
  if(o.c960) R.c960[o.result[0]]++;
  if(o.result==='win'){ R.wins++; R.streak++; if(R.streak>R.bestStreak){ R.bestStreak=R.streak; if(R.streak>1) fresh.push('Longest win streak'); } } else R.streak=0;
  return fresh; }
const winsAt=(S,level)=>{ const a=S.rec.by[recKey(level,WHITE)], b=S.rec.by[recKey(level,BLACK)]; return (a?a.w:0)+(b?b.w:0); };
// Classic game stars: ★ win, ★ no assists (no hints, no takebacks), ★ accuracy ≥ 75% (arrives with the analysis)
function gameStars(won,assisted,acc){ return [won?1:0,won&&!assisted?1:0,won&&acc!=null&&acc>=ACC_STAR?1:0]; }

// ---------- the puzzle bank (generated by tools/build_puzzles.js from the Lichess puzzle database, CC0) ----------
// Entry: id~placement~side castling ep~setup move~solution (UCI, promotions in capitals)~rating (base 36)~themes (bits, base 36)
const PUZ_BANDS=[['beginner','Beginner',0,999],['easy','Easy',1000,1399],['normal','Normal',1400,1799],['hard','Hard',1800,2199],['expert','Expert',2200,9999]];
const PUZ_THEME_UI=[['mateIn1','Mate in 1'],['mateIn2','Mate in 2'],['mateIn3','Mate in 3'],['fork','Fork'],['pin','Pin'],['skewer','Skewer'],['discoveredAttack','Discovered attack'],['backRankMate','Back-rank mate'],['promotion','Promotion'],['endgame','Endgame']];
function splitUci(s){ const out=[]; let i=0; while(i<s.length){ let u=s.slice(i,i+4); i+=4; if(i<s.length&&'QRBN'.includes(s[i])){ u+=s[i].toLowerCase(); i++; } out.push(u); } return out; }
function decodePuzzle(e){ const f=e.split('~'), sc=f[2];
  const side=sc[0], ep=/[a-h][36]$/.test(sc)?sc.slice(-2):'-', cast=sc.slice(1,ep==='-'?undefined:-2)||'-';
  const th=parseInt(f[6]||'0',36), themes=PUZ_THEMES.filter((t,i)=>th&(2**i));
  return {id:f[0],fen:`${f[1]} ${side} ${cast} ${ep} 0 1`,setup:f[3],sol:splitUci(f[4]),rating:parseInt(f[5],36),themes}; }
let PUZ_LIST=null, PUZ_DAILY=null;
function puzList(){ if(!PUZ_LIST) PUZ_LIST=PUZ_C?PUZ_C.split(',').map(decodePuzzle):[]; return PUZ_LIST; }
function puzDaily(band){ if(!PUZ_DAILY) PUZ_DAILY=PUZ_D.map(s=>s?s.split(',').map(decodePuzzle):[]); return PUZ_DAILY[band]; }
const puzById=id=>puzList().find(p=>p.id===id)||PUZ_D.join(',').split(',').filter(Boolean).map(decodePuzzle).find(p=>p.id===id)||null;
const bandOf=r=>PUZ_BANDS.find(b=>r>=b[2]&&r<=b[3])[0];
// Classic Puzzles: by difficulty band or theme; no repeats until that part of the bank is used up
function pickPuzzle(S,o,rnd){ const all=puzList(), key=o.by==='theme'?'t:'+o.theme:'b:'+o.band;
  const pool=all.filter(p=>o.by==='theme'?p.themes.includes(o.theme):bandOf(p.rating)===o.band); if(!pool.length) return null;
  let used=S.pused[key]||[]; let left=pool.filter(p=>!used.includes(p.id)); if(!left.length){ used=[]; left=pool; }
  const p=left[Math.floor(rnd()*left.length)]; used.push(p.id); if(used.length>pool.length) used=used.slice(-pool.length); S.pused[key]=used; return p; }
// Puzzle Streak: first-try solves in a row, each puzzle harder (start near 800, +60 rating each)
const streakTarget=n=>800+n*60;
function pickStreak(n,rnd,avoid){ const t=streakTarget(n), all=puzList(); let best=null, bd=1e9;
  for(let k=0;k<40;k++){ const p=all[Math.floor(rnd()*all.length)]; if(avoid&&avoid.includes(p.id)) continue; const d=Math.abs(p.rating-t)+(p.rating<t-80?200:0); if(d<bd){ bd=d; best=p; } }
  return best; }
// A puzzle move is right if it's the stored move, or (as Lichess does) any move that also mates.
function puzzleMoveOk(p,m,expectUci){ if(toUci(p,m)===expectUci) return true; makeMove(p,m); const mate=inCheck(p)&&!legalMoves(p).length; unmakeMove(p); return mate; }
// puzzle stars: ★ solved, ★ first try (no wrong moves), ★ no hints
const puzzleStars=(solved,wrong,hints)=>[solved?1:0,solved&&!wrong?1:0,solved&&!hints?1:0];
function recordPuzzle(S,pz,solved,wrong,hints,today){ const R=S.rec, fresh=[]; let xp=0;
  if(solved){ R.puzSolved++; if(!wrong){ R.puzFirst++; R.puzStreak++; if(R.puzStreak>R.puzBest){ R.puzBest=R.puzStreak; fresh.push('Puzzle streak'); } if(!hints) xp=puzzleXP(S,today); } else R.puzStreak=0; }
  else R.puzStreak=0;
  return {xp,fresh}; }

// ---------- campaign ----------
const campOf=(S,id)=>S.camp[id]||{s:[0,0,0],tries:0,best:0};
const campStars=(S,id)=>campOf(S,id).s.reduce((a,b)=>a+b,0);
const totalStars=S=>LEVELS.reduce((a,L)=>a+campStars(S,L.id),0);
const campCleared=(S,id)=>!!campOf(S,id).s[0];
const campDone=(S,c)=>campCleared(S,LEVELS.find(L=>L.camp===c&&L.n===15).id);
const campOpen=(S,c)=>c===0||campDone(S,c-1);
// clearing a level unlocks the next; clearing level 15 unlocks the next campaign
const unlocked=(S,Lv)=>campOpen(S,Lv.camp)&&(Lv.n===1||campCleared(S,LEVELS.find(L=>L.camp===Lv.camp&&L.n===Lv.n-1).id));
const levelById=id=>LEVELS.find(L=>L.id===id);
// The three stars by level type (clearing is required for any star):
//  set (and tech): solve all · all first try · no hints
//  drill: checkmate · within par moves · no assists
//  game: win · no assists · accuracy ≥ 75%
//  pos: win · no assists · within par moves
function levelStarText(L){
  if(L.type==='set'||L.type==='tech') return ['Solve every puzzle','Every puzzle on the first try','No hints'];
  if(L.type==='drill') return ['Checkmate',TFX('Mate within {0} moves',L.par),'No assists (hints or takebacks)'];
  if(L.type==='hold') return [TFX('Hold for {0} moves (or draw)',L.hold),'Keep your rook','No assists (hints or takebacks)'];
  if(L.type==='pos') return ['Win the game','No assists (hints or takebacks)',TFX('Win within {0} moves',L.par)];
  return ['Win the game','No assists (hints or takebacks)',`Accuracy ${ACC_STAR}% or more`]; }
const TFX=(t,...a)=>(typeof TF==='function'?TF(t,...a):t.replace(/\{(\d)\}/g,(_,n)=>a[n]));
// o: {cleared, s2, s3} → stars build up across attempts, each earned once
function campaignResult(S,Lv,o){ const c=campOf(S,Lv.id), C=CAMPS[Lv.camp], wasDone=campDone(S,Lv.camp), fresh=[]; let xp=0;
  const earned=[o.cleared?1:0,o.cleared&&o.s2?1:0,o.cleared&&o.s3?1:0];
  c.tries=(c.tries||0)+1;
  earned.forEach((e,i)=>{ if(e&&!c.s[i]){ c.s[i]=1; fresh.push(i); xp+=C.xp; } });
  S.camp[Lv.id]=c; const finished=!wasDone&&campDone(S,Lv.camp); if(finished) xp+=C.bonus;
  return {earned,fresh,stars:campStars(S,Lv.id),xp,finished}; }
// the accuracy star arrives later, when the analysis finishes
function campaignAccStar(S,Lv,acc){ if(Lv.type!=='game'||acc==null||acc<ACC_STAR) return null; const c=campOf(S,Lv.id); if(!c.s[0]||c.s[2]) return null;
  const wasDone=campDone(S,Lv.camp); c.s[2]=1; S.camp[Lv.id]=c; return {xp:CAMPS[Lv.camp].xp+(!wasDone&&campDone(S,Lv.camp)?CAMPS[Lv.camp].bonus:0)}; }

// ---------- Daily ----------
// CHD1|YYYY-MM-DD picks the day's puzzle from the reserved Daily part of the bank (never used by Classic Puzzles),
// with difficulty by weekday. Everyone gets the same puzzle.
const DAILY_BANDS=[[2100,2400],[800,1100],[1100,1300],[1300,1500],[1500,1700],[1700,1900],[1900,2100]]; // index = getDay(): Sunday … Saturday
const weekdayOf=date=>{ const [y,m,d]=date.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).getUTCDay(); };
function dailyPuzzle(date){ const w=weekdayOf(date), pool=puzDaily(w), r=rngFor('CHD1|'+date); if(!pool||!pool.length) return null;
  return Object.assign({},pool[Math.floor(r()*pool.length)],{daily:date}); }
const dailyFingerprint=date=>{ const p=dailyPuzzle(date); return p?p.id:''; };
function dailyFor(S,date){ if(S.daily.date!==date) S.daily={date,scored:false,cleared:false,stars:0,time:0,first:false,hints:0,run:null,practice:null}; return S.daily; }
const dayNum=date=>{ const [y,m,d]=date.split('-').map(Number); return Math.round(Date.UTC(y,m-1,d)/864e5); };
// The one scored attempt. Ending it without solving counts as the attempt too.
function dailyResult(S,date,solved,wrong,hints,time,today){ const d=dailyFor(S,date); if(d.scored) return null;
  const st=puzzleStars(solved,wrong,hints), stars=st.reduce((a,b)=>a+b,0);
  Object.assign(d,{scored:true,cleared:solved,stars,time,first:solved&&!wrong,hints,run:null});
  S.dhist[date]={won:solved,stars,time,first:solved&&!wrong}; const keys=Object.keys(S.dhist).sort(); while(keys.length>7) delete S.dhist[keys.shift()]; // the last 7 Dailies
  let xp=0;
  if(solved){ S.dclears=(S.dclears||0)+1; xp=20*(date===today?2:1); if(stars===3) S.d3=(S.d3||0)+1;
    const n=dayNum(date), last=S.dstreak.last?dayNum(S.dstreak.last):-99;
    if(n!==last){ S.dstreak.cur=n===last+1?S.dstreak.cur+1:1; S.dstreak.last=date; S.dstreak.best=Math.max(S.dstreak.best,S.dstreak.cur); }
    if(stars===3) S.dweek[weekdayOf(date)]=1; }
  return {stars:st,xp,won:solved}; }
function streakNow(S,today){ const last=S.dstreak.last?dayNum(S.dstreak.last):-99; if(dayNum(today)-last>1) S.dstreak.cur=0; return S.dstreak.cur; }
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// no spoilers: the share line never shows a move
function shareLine(date,solved,stars,first,time){ const [,m,dd]=date.split('-').map(Number);
  return `Chess Daily · ${WD[weekdayOf(date)]} ${dd} ${MON[m-1]} · ${'★'.repeat(stars)}${'☆'.repeat(3-stars)} · ${solved?(first?'first try':'solved'):'not solved'}${solved?' · '+fmtTime(time):''}`; }

// ---------- 2-Player games list ----------
function tpFind(S,id){ return S.tp.games.find(g=>g.id===id); }
function tpSave(S,g){ const k=S.tp.games.findIndex(x=>x.id===g.id); if(k>=0) S.tp.games[k]=g; else S.tp.games.unshift(g); }
function tpDelete(S,id){ S.tp.games=S.tp.games.filter(g=>g.id!==id); if(!S.tp.deleted.includes(id)) S.tp.deleted.push(id); if(S.tp.deleted.length>200) S.tp.deleted.shift(); }
// a finished share-code game won by this device's player counts once toward Rivals; pass-and-play counts nothing
function tpCount(S,g,st){ if(g.mode!=='code'||!st.over||S.tp.counted.includes(g.id)) return false; S.tp.counted.push(g.id);
  if(st.winner!=null&&seatOf(g,st.winner)===g.me){ S.tp.wins++; return true; } return false; }

// ---------- achievements ----------
const ACH=[
 ...[1,2,3,4,5,6,7,8].map(n=>({id:'beat'+n,g:'Games',name:`Beat ${STRENGTHS[n].name}`,desc:`Win against strength ${n}`})),
 {id:'black5',g:'Games',name:'Dark Horse',desc:'Win as Black against strength 5 or higher'},
 {id:'comeback',g:'Games',name:'Comeback',desc:'Win after being down a rook or more'},
 {id:'perfect',g:'Games',name:'Perfect Game',desc:'Win with accuracy 90% or more',reward:'Fireworks win effect'},
 {id:'fischer',g:'Games',name:"Fischer's Way",desc:'Win a Chess960 game'},
 {id:'clock',g:'Games',name:'Beat the Clock',desc:'Win a 3 + 2 game'},
 {id:'smother',g:'Checkmates',name:'Smothered',desc:'Deliver a smothered mate',reward:'Crack effect'},
 {id:'mcastle',g:'Checkmates',name:'Castle Gate',desc:'Mate by castling'},
 {id:'mep',g:'Checkmates',name:'En Passant',desc:'Mate by en passant'},
 {id:'mpromo',g:'Checkmates',name:'Coronation',desc:'Mate by promoting a pawn'},
 {id:'mminor',g:'Checkmates',name:'Light Touch',desc:'Mate with a knight or bishop'},
 {id:'mquick',g:'Checkmates',name:'Swift Mate',desc:'Mate in under 20 moves against strength 4 or higher'},
 {id:'p10',g:'Puzzles',name:'Puzzler',desc:'Solve 10 puzzles',n:10},
 {id:'p50',g:'Puzzles',name:'Tactician',desc:'Solve 50 puzzles',n:50},
 {id:'p100',g:'Puzzles',name:'Problem Solver',desc:'Solve 100 puzzles',n:100},
 {id:'p250',g:'Puzzles',name:'Combination Hunter',desc:'Solve 250 puzzles',n:250},
 {id:'p500',g:'Puzzles',name:'Puzzle Master',desc:'Solve 500 puzzles',n:500},
 {id:'pstreak10',g:'Puzzles',name:'Hot Streak',desc:'A Puzzle Streak of 10',reward:'Park ambience'},
 {id:'pstreak25',g:'Puzzles',name:'Unstoppable',desc:'A Puzzle Streak of 25'},
 {id:'p2000',g:'Puzzles',name:'Sharp Eye',desc:'Solve a puzzle rated 2000+ on the first try'},
 {id:'camp1',g:'Campaign',name:'Pawn Graduate',desc:'Finish the Pawn campaign'},
 {id:'camp2',g:'Campaign',name:'Knight Graduate',desc:'Finish the Knight campaign'},
 {id:'camp3',g:'Campaign',name:'Queen Graduate',desc:'Finish the Queen campaign'},
 {id:'perf1',g:'Campaign',name:'Perfect Pawn',desc:'3 stars on every Pawn level'},
 {id:'perf2',g:'Campaign',name:'Perfect Knight',desc:'3 stars on every Knight level'},
 {id:'perf3',g:'Campaign',name:'Perfect Queen',desc:'3 stars on every Queen level'},
 {id:'egmaster',g:'Campaign',name:'Endgame Master',desc:'3 stars on every endgame drill'},
 {id:'d7',g:'Daily',name:'Week of Dailies',desc:'Solve 7 Dailies',n:7},
 {id:'d30',g:'Daily',name:'Daily Regular',desc:'Solve 30 Dailies',n:30},
 {id:'d100',g:'Daily',name:'Daily Devotee',desc:'Solve 100 Dailies',n:100},
 {id:'dstar1',g:'Daily',name:'Daily Star',desc:'3 stars on a Daily',n:1,reward:'Daylight music'},
 {id:'dstar10',g:'Daily',name:'Star Collector',desc:'3 stars on 10 Dailies',n:10},
 {id:'dstar30',g:'Daily',name:'Constellation',desc:'3 stars on 30 Dailies',n:30},
 {id:'dstreak',g:'Daily',name:'Daily Streak',desc:'Solve the Daily 7 days in a row'},
 {id:'dweek',g:'Daily',name:'Full Week',desc:"3 stars on every weekday's Daily (Monday–Sunday, any weeks)"},
 {id:'riv1',g:'2-Player',name:'Rivals I',desc:'Win 5 share-code games',n:5},
 {id:'riv2',g:'2-Player',name:'Rivals II',desc:'Win 10 share-code games',n:10},
 {id:'riv3',g:'2-Player',name:'Rivals III',desc:'Win 20 share-code games',n:20},
 {id:'riv4',g:'2-Player',name:'Rivals IV',desc:'Win 50 share-code games',n:50},
 {id:'riv5',g:'2-Player',name:'Rivals V',desc:'Win 100 share-code games',n:100}];
// How a game ended in mate, from the final position and move: {mate, smother, castle, ep, promo, minor}
function mateKind(g){ if(!g.moves.length) return null; const p=posAt(g,g.moves.length-1), m=fromUci(p,g.moves[g.moves.length-1]); if(!m) return null;
  const mover=p.side, pc=p.b[mFrom(m)]&7; makeMove(p,m); const mate=inCheck(p)&&!legalMoves(p).length; if(!mate) return null;
  // smothered: a knight mates and every square around the loser's king is blocked by its own pieces
  const k=p.k[p.side]; let smother=pc===KNIGHT;
  if(smother) for(const d of KD){ const x=k+d; if(x&0x88) continue; const q=p.b[x]; if(!q||(q>>3)!==p.side){ smother=false; break; } }
  return {mate:true,mover,smother,castle:!!(mFlags(m)&F_CASTLE),ep:!!(mFlags(m)&F_EP),promo:!!mPromo(m),minor:pc===KNIGHT||pc===BISHOP}; }
// the lowest material balance (you minus them, in pawns) you were at during the game
function worstBalance(g,colour){ const p=fromFEN(g.start); if(g.c960>=0) p.c960=true; let w=material(p,colour)-material(p,colour^1);
  for(const u of g.moves){ makeMove(p,fromUci(p,u)); w=Math.min(w,material(p,colour)-material(p,colour^1)); } return w; }
// ctx: {mode, won, level, colour, g (the game), clock, acc, assisted, practice, local, puzzle {rating, first}}
function checkAch(S,ctx){ const got=[], give=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); got.push(id); } };
  if(ctx.practice) return got;
  if(ctx.mode==='tp'){ if(!ctx.local) for(const a of ACH) if(a.g==='2-Player'&&S.tp.wins>=a.n) give(a.id); return got; }
  if((ctx.mode==='classic'||ctx.mode==='campaign')&&ctx.won&&ctx.g){ const lv=ctx.level;
    if(lv) give('beat'+lv); if(lv>=5&&ctx.colour===BLACK) give('black5');
    if(worstBalance(ctx.g,ctx.colour)<=-5) give('comeback');
    if(ctx.acc!=null&&ctx.acc>=90) give('perfect');
    if(ctx.g.c960>=0) give('fischer'); if(ctx.clock==='3+2') give('clock');
    const mk=mateKind(ctx.g); if(mk&&mk.mover===ctx.colour){ if(mk.smother) give('smother'); if(mk.castle) give('mcastle'); if(mk.ep) give('mep'); if(mk.promo) give('mpromo'); if(mk.minor) give('mminor');
      if(lv>=4&&Math.ceil(ctx.g.moves.length/2)<20) give('mquick'); } }
  if(ctx.acc!=null&&ctx.acc>=90&&ctx.won) give('perfect');
  const R=S.rec; for(const a of ACH) if(a.g==='Puzzles'&&a.n&&R.puzSolved>=a.n) give(a.id);
  if(R.puzBest>=10) give('pstreak10'); if(R.puzBest>=25) give('pstreak25');
  if(ctx.puzzle&&ctx.puzzle.first&&ctx.puzzle.rating>=2000) give('p2000');
  if(ctx.mode==='campaign'){ CAMPS.forEach((cp,i)=>{ if(campDone(S,i)) give('camp'+(i+1)); if(LEVELS.filter(L=>L.camp===i).every(L=>campStars(S,L.id)>=3)) give('perf'+(i+1)); });
    if(LEVELS.filter(L=>L.type==='drill').every(L=>campStars(S,L.id)>=3)) give('egmaster'); }
  if(ctx.mode==='daily'){ const n=S.dclears||0, s3=S.d3||0; if(n>=7) give('d7'); if(n>=30) give('d30'); if(n>=100) give('d100');
    if(s3>=1) give('dstar1'); if(s3>=10) give('dstar10'); if(s3>=30) give('dstar30'); if(S.dstreak.cur>=7) give('dstreak'); if(S.dweek.every(Boolean)) give('dweek'); }
  return got; }
const achProgress=(S,a)=>a.g==='Puzzles'&&a.n?Math.min(S.rec.puzSolved,a.n):a.id.startsWith('pstreak')?Math.min(S.rec.puzBest,a.id==='pstreak10'?10:25):/^d\d/.test(a.id)?Math.min(S.dclears||0,a.n):/^dstar/.test(a.id)?Math.min(S.d3||0,a.n):a.id==='dweek'?S.dweek.filter(Boolean).length:a.g==='2-Player'?Math.min(S.tp.wins,a.n):null;
const achTotal=a=>a.n||(a.id==='dweek'?7:a.id==='pstreak10'?10:a.id==='pstreak25'?25:null);

// ---------- post-game analysis queue ----------
// Games waiting for analysis (the accuracy star needs it). It runs in the background in slices and resumes after
// leaving; partial results are saved. Entry: {id, mode, lid, level, colour, g, won, assisted, clock, evals, acc}
function queueAnalysis(S,e){ S.anq=S.anq.filter(x=>x.id!==e.id); S.anq.push(e); while(S.anq.length>6) S.anq.shift(); }
// When an analysis finishes: the player's accuracy, the best-accuracy record, the accuracy star and Perfect Game
function analysisDone(S,e,sum){ const acc=sum.acc[e.colour]; e.acc=acc; const out={acc,star:false,xp:0,ach:[]};
  if(acc!=null&&e.mode!=='tp'&&e.mode!=='pp'){ if(acc>S.rec.bestAcc) S.rec.bestAcc=acc; }
  if(e.mode==='campaign'&&e.won){ const L=levelById(e.lid), r=L?campaignAccStar(S,L,acc):null; if(r){ out.star=true; out.xp=r.xp; } }
  if(e.mode==='classic'&&e.won&&acc>=ACC_STAR) out.star=true;
  if(e.won&&acc>=90&&(e.mode==='classic'||e.mode==='campaign')){ if(!S.ach.perfect){ S.ach.perfect=Date.now(); out.ach.push('perfect'); } }
  if(e.mode==='campaign') for(const id of checkAch(S,{mode:'campaign'})) out.ach.push(id);
  return out; }

// ---------- backup (Chess only) ----------
// CHESS1Z.<base64 gzip> where the app can compress, CHESS1.<base64> otherwise. Both decode here (the app inflates Z).
const b64e=str=>{ const u=new TextEncoder().encode(str); let b=''; for(let i=0;i<u.length;i++) b+=String.fromCharCode(u[i]); return btoa(b); };
const b64d=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
function backupPlain(S){ return 'CHESS1.'+b64e(JSON.stringify(S)); }
function parseBackup(text){ const m=/CHESS1\.([A-Za-z0-9+/=]+)/.exec(String(text||'')); if(!m) return null;
  try{ const o=JSON.parse(b64d(m[1])); if(!o||typeof o!=='object'||typeof o.xp!=='number') return null; return o; }catch(e){ return null; } }

// ---------- Arcade contract ----------
// Shared settings live in arcade.v1 (read only, never written). They're applied in memory only.
function readArcade(store){ try{ const a=JSON.parse(store.get(ARCADE_KEY)||'null'); if(!a||typeof a!=='object') return null; return a; }catch(e){ return null; } }
function applyShared(S,a){ if(!a) return S; const o=Object.assign({},S), set=a.set||{}; for(const k of SHARED) if(set[k]!==undefined) o[k]=set[k]; if(typeof a.name==='string'&&a.name) o.name=a.name; return o; }
function summary(S){ const l=levelOf(S.xp);
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:l,xpNext:xpNext(S),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Wins',String(S.rec.wins)],['Puzzles solved',String(S.rec.puzSolved)],['Campaign stars',`${totalStars(S)}/${LEVELS.length*3}`]],
    last:Date.now()}; }
