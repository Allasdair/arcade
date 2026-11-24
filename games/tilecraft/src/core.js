// ===================== Tilecraft core =====================
// Save, XP and levels, hints, records, campaign stars and unlocks, the Daily, achievements, cosmetics, the 2-Player
// games list, backup and the Arcade contract. No DOM: storage is passed in, so Node tests can run it.
const VERSION='0.1.0', GAME_ID='tilecraft', KEY='tilecraft.v1', SUMKEY='arcade.summary.tilecraft', ARCADE_KEY='arcade.v1';
const MAXL=10, LVXP=[0,50,150,300,525,825,1225,1725,2375,3175]; // Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LVXP[l]) l++; return l; };
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];
const HINT_CAP=3, HINT_MAX=99;

function defSave(reduced){ return {v:1,xp:0,ach:{},camp:{},campTab:0,hints:HINT_CAP,hintDate:'',
  rec:{bestGame:null,bestMove:null,longest:null,mostFull:0,wins:{},games:0,won:0,lost:0,drawn:0},
  setup:{size:'medium',ai:'normal',shape:'square',norepeat:false,timer:0,minLen:2,maxLen:0,blanks:null,swaps:true,rare:false},
  daily:{date:'',scored:false,score:0,par:0,stars:0,run:null,practice:null},dhist:{},dbest:0,dstreak:{cur:0,best:0,last:''},parCache:{},
  tp:{games:[],deleted:[],wins:0,counted:[]},
  look:{tile:'ivory',board:'workshop',font:'inter',fx:'sparks',track:'hearth',sound:'soft'},
  prefs:{place:'both',zoom:true,think:true,confirm:false,history:false},
  shapesWon:{},stats:{games:0,words:0,fullRacks:0,tiles:0},
  sfx:true,music:true,haptics:true,motion:!reduced,appearance:'system',fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  run:null,seenVer:'',bk:{last:0},howto:false}; }
const NESTED=['rec','setup','daily','dstreak','tp','look','prefs','stats','bk'];
// Old saves missing new fields are filled in from defSave() (one level deep for nested groups)
function loadSave(raw,reduced){ const d=defSave(reduced); let s=null; try{ s=raw?JSON.parse(raw):null; }catch(e){ s=null; }
  if(!s||typeof s!=='object') return d;
  for(const k in d){ if(s[k]===undefined) continue;
    if(NESTED.includes(k)&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) d[k]=Object.assign(d[k],s[k]); else d[k]=s[k]; }
  return d; }

// ---------- cosmetics ----------
// Unlocks: lvl (XP level), req (an achievement) or stars (campaign star total)
const COS={
 tile:[{id:'ivory',name:'Ivory'},{id:'slate',name:'Slate',lvl:2},{id:'glass',name:'Glass',lvl:8},{id:'ember',name:'Ember',req:'ws_expert'},{id:'wood',name:'Wood Grain',stars:30},{id:'neon',name:'Neon',lvl:10},{id:'parchment',name:'Parchment',req:'puzzle'}],
 board:[{id:'workshop',name:'Workshop'},{id:'paper',name:'Paper',lvl:3},{id:'midnight',name:'Midnight',lvl:6},{id:'ocean',name:'Ocean',lvl:9},{id:'garden',name:'Garden',stars:75},{id:'retro',name:'Retro',stars:135}],
 font:[{id:'inter',name:'Inter'},{id:'mono',name:'JetBrains Mono',lvl:10},{id:'caveat',name:'Caveat',req:'dstreak'}],
 fx:[{id:'sparks',name:'Sparks'},{id:'embers',name:'Embers',lvl:5},{id:'confetti',name:'Confetti',req:'fullrack'},{id:'lightning',name:'Lightning',req:'hammer'}],
 track:[{id:'hearth',name:'Hearth'},{id:'inkwell',name:'Inkwell',lvl:7},{id:'daylight',name:'Daylight',req:'dspark'}],
 sound:[{id:'soft',name:'Soft'},{id:'chip',name:'Chiptune',lvl:4}]};
const COS_KINDS=[['tile','Tile style'],['board','Board theme'],['font','Letter font'],['fx','Word effect'],['track','Soundtrack'],['sound','Sound pack']];
const owned=(S,it)=>(!it.lvl||levelOf(S.xp)>=it.lvl)&&(!it.req||!!S.ach[it.req])&&(!it.stars||totalStars(S)>=it.stars);
const findCos=(kind,id)=>COS[kind].find(c=>c.id===id)||COS[kind][0];
function rewardsAt(level){ const o=[]; for(const [k,n] of COS_KINDS) for(const it of COS[k]) if(it.lvl===level) o.push(`${it.name} ${n.toLowerCase()}`); return o; }
const STARTER='Ivory tiles, Workshop board, Inter, Sparks, Hearth, Soft sounds';
const starUnlocks=()=>COS_KINDS.flatMap(([k,n])=>COS[k].filter(it=>it.stars).map(it=>({stars:it.stars,text:`${it.name} ${n.toLowerCase()}`}))).sort((a,b)=>a.stars-b.stars);

// ---------- hints: refilled daily to 3, +1 per level-up, earned extras stack to 99 ----------
function refreshHints(S,today){ if(S.hintDate!==today){ S.hints=Math.max(S.hints||0,HINT_CAP); S.hintDate=today; } return S.hints; }
function useHint(S){ if(S.hints<=0) return false; S.hints--; return true; }

// ---------- achievements ----------
// Score thresholds come from the bots (tests/sim.js): see HANDOFF.md.
const ACH=[
 {id:'first',g:'Classic and skill',name:'First Word',desc:'Finish any game'},
 {id:'ws_easy',g:'Classic and skill',name:'Wordsmith: Easy',desc:'Beat the Easy computer'},
 {id:'ws_normal',g:'Classic and skill',name:'Wordsmith: Normal',desc:'Beat the Normal computer'},
 {id:'ws_hard',g:'Classic and skill',name:'Wordsmith: Hard',desc:'Beat the Hard computer'},
 {id:'ws_expert',g:'Classic and skill',name:'Wordsmith: Expert',desc:'Beat the Expert computer',reward:'Ember tiles'},
 {id:'fullrack',g:'Classic and skill',name:'Full Rack',desc:'Play all 7 tiles in one move',reward:'Confetti effect'},
 {id:'dfull',g:'Classic and skill',name:'Double Full Rack',desc:'Two Full Racks in one game'},
 {id:'heavy',g:'Classic and skill',name:'Heavy Hitter',desc:'Score 80+ in one move'},
 {id:'hammer',g:'Classic and skill',name:'Hammer Blow',desc:'Score 120+ in one move',reward:'Lightning effect'},
 {id:'crossfire',g:'Classic and skill',name:'Crossfire',desc:'Score with two Word squares in one move'},
 {id:'longword',g:'Classic and skill',name:'Long Word',desc:'Play a word of 9+ letters'},
 {id:'rare',g:'Classic and skill',name:'Rare Earth',desc:'Play Q, Z, X and J in one game'},
 {id:'shapes',g:'Classic and skill',name:'Shapeshifter',desc:'Win on every board shape'},
 {id:'purist',g:'Classic and skill',name:'Purist',desc:'Beat Expert with no hints and no swaps'},
 {id:'speed',g:'Classic and skill',name:'Speed Speller',desc:'Win a game with a 30 s timer'},
 {id:'camp1',g:'Campaign',name:'Apprentice',desc:'Finish the Apprentice campaign'},
 {id:'camp2',g:'Campaign',name:'Journeyman',desc:'Finish the Journeyman campaign'},
 {id:'camp3',g:'Campaign',name:'Master',desc:'Finish the Master campaign'},
 {id:'perf1',g:'Campaign',name:'Perfect Apprentice',desc:'3 stars on every Apprentice level'},
 {id:'perf2',g:'Campaign',name:'Perfect Journeyman',desc:'3 stars on every Journeyman level'},
 {id:'perf3',g:'Campaign',name:'Perfect Master',desc:'3 stars on every Master level'},
 {id:'puzzle',g:'Campaign',name:'Puzzle Master',desc:'Find the best move in all three puzzle levels',reward:'Parchment tiles'},
 {id:'dspark',g:'Daily',name:'Daily Spark',desc:'★★★ on a Daily',reward:'Daylight soundtrack'},
 {id:'dstreak',g:'Daily',name:'Daily Streak',desc:'Play the Daily 7 days in a row',reward:'Caveat font'},
 {id:'beyond',g:'Daily',name:'Beyond Par',desc:'Beat par by 20%'},
 {id:'riv1',g:'2-Player',name:'Rivals I',desc:'Win 5 share-code matches',n:5},
 {id:'riv2',g:'2-Player',name:'Rivals II',desc:'Win 10 share-code matches',n:10},
 {id:'riv3',g:'2-Player',name:'Rivals III',desc:'Win 20 share-code matches',n:20},
 {id:'riv4',g:'2-Player',name:'Rivals IV',desc:'Win 50 share-code matches',n:50},
 {id:'riv5',g:'2-Player',name:'Rivals V',desc:'Win 100 share-code matches',n:100}];
const HEAVY=80, HAMMER=120;
// ctx: {mode:'classic'|'campaign'|'daily'|'tp', st, p (the player's seat), hints, ai, practice, local}
function checkAch(S,ctx){ const got=[], give=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); got.push(id); } };
  if(ctx.practice) return got;
  if(ctx.mode==='tp'){ if(!ctx.local) for(const a of ACH) if(a.n&&S.tp.wins>=a.n) give(a.id); return got; } // pass-and-play counts nothing
  const st=ctx.st, p=ctx.p||0;
  if(st){ const g=gameStats(st,p), done=st.over, won=done&&st.result&&st.result.winner===p&&st.racks.length>1, ai=ctx.ai;
    if(done) give('first');
    if(g.fullRacks) give('fullrack'); if(g.fullRacks>=2) give('dfull');
    if(g.best&&g.best.sc>=HEAVY) give('heavy'); if(g.best&&g.best.sc>=HAMMER) give('hammer');
    if(g.wordSq2) give('crossfire'); if(g.longest.length>=9) give('longword'); if(g.rare==='JQXZ') give('rare');
    if(won&&ai){ give('ws_'+ai); S.shapesWon[st.cfg.shape]=1; if(SHAPE_IDS.every(s=>S.shapesWon[s])) give('shapes');
      if(ai==='expert'&&!ctx.hints&&!g.swaps) give('purist'); if(st.cfg.mods.timer===30) give('speed'); } }
  if(ctx.mode==='campaign'){ CAMPS.forEach((c,i)=>{ if(campDone(S,i)) give('camp'+(i+1)); if(LEVELS.filter(L=>L.camp===i).every(L=>campStars(S,L.id)>=3)) give('perf'+(i+1)); });
    if(LEVELS.filter(L=>L.type==='puzzle').every(L=>campOf(S,L.id).s[2])) give('puzzle'); }
  if(ctx.mode==='daily'){ if(S.daily.stars>=3) give('dspark'); if(S.dstreak.cur>=7) give('dstreak'); if(S.daily.par&&S.daily.score>=S.daily.par*1.2) give('beyond'); }
  return got; }

// ---------- XP ----------
function addXP(S,n){ const before=levelOf(S.xp); S.xp+=Math.max(0,Math.round(n)); const after=levelOf(S.xp), rewards=[];
  for(let l=before+1;l<=after;l++) rewards.push(...rewardsAt(l));
  const ups=after-before; if(ups>0) S.hints=Math.min(HINT_MAX,(S.hints||0)+ups); // +1 hint per level-up
  return {xp:Math.round(n),before,after,rewards,hints:ups}; }
const xpNext=S=>{ const l=levelOf(S.xp); return l>=MAXL?null:LVXP[l]; };
const WIN_XP={easy:10,normal:20,hard:30,expert:45};
// Classic modifiers that make a game harder each add 10% (capped at 40%). No score multiplier: scores stay comparable.
function hardMods(cfg){ const m=cfg.mods, o=[]; if(m.minLen>=4) o.push('minLen'); if(m.maxLen) o.push('maxLen'); if(m.norepeat) o.push('norepeat'); if(m.swaps===false) o.push('swaps');
  if(m.timer&&m.timer<=60) o.push('timer'); if(cfg.shape!=='square') o.push('shape'); return o; }
const modBonus=cfg=>Math.min(.4,.1*hardMods(cfg).length);
function classicXP(st,p,ai){ const won=st.result&&st.result.winner===p; return Math.round((5+(won?WIN_XP[ai]:0))*(1+modBonus(st.cfg))); }

// ---------- records ----------
// Classic: best game score, best single move, longest word, most Full Racks in a game, wins by strength × board size.
// An assisted game (a hint was used) still gets XP and stars, but sets no best-score records.
function addRecords(S,st,p,ai,assisted,date){ const R=S.rec, g=gameStats(st,p), fin=st.result.final, fresh=[];
  R.games++; const w=st.result.winner; if(w===p) R.won++; else if(w===-1) R.drawn++; else R.lost++;
  if(w===p){ const k=ai+'|'+st.cfg.size; R.wins[k]=(R.wins[k]||0)+1; }
  if(assisted) return fresh;
  if(!R.bestGame||fin[p]>R.bestGame.sc){ R.bestGame={sc:fin[p],date,ai,size:st.cfg.size}; fresh.push('Best game'); }
  if(g.best&&(!R.bestMove||g.best.sc>R.bestMove.sc)){ R.bestMove={sc:g.best.sc,w:g.best.w,date}; fresh.push('Best move'); }
  if(g.longest&&(!R.longest||g.longest.length>R.longest.w.length)){ R.longest={w:g.longest,date}; fresh.push('Longest word'); }
  if(g.fullRacks>R.mostFull){ R.mostFull=g.fullRacks; fresh.push('Most Full Racks'); }
  return fresh; }
function addStats(S,st,p){ const g=gameStats(st,p), t=S.stats; t.games++; t.words+=g.words; t.fullRacks+=g.fullRacks;
  for(const m of st.moves) if(m.p===p&&m.t==='p') t.tiles+=m.tiles.length; }

// ---------- campaign ----------
const campOf=(S,id)=>S.camp[id]||{s:[0,0,0],best:0,tries:0};
const campStars=(S,id)=>campOf(S,id).s.reduce((a,b)=>a+b,0);
const totalStars=S=>LEVELS.reduce((a,L)=>a+campStars(S,L.id),0);
const campCleared=(S,id)=>!!campOf(S,id).s[0];
const campDone=(S,c)=>campCleared(S,LEVELS.find(L=>L.camp===c&&L.n===15).id);
const campOpen=(S,c)=>c===0||campDone(S,c-1);
// clearing a level (its goal star) unlocks the next; clearing level 15 unlocks the next campaign
const unlocked=(S,Lv)=>campOpen(S,Lv.camp)&&(Lv.n===1||campCleared(S,LEVELS.find(L=>L.camp===Lv.camp&&L.n===Lv.n-1).id));
function campaignResult(S,Lv,o,hints){ const c=campOf(S,Lv.id), earned=[o.goal,o.goal&&!hints,o.twist], fresh=[], C=CAMPS[Lv.camp]; let xp=0;
  const wasDone=campDone(S,Lv.camp);
  earned.forEach((e,i)=>{ if(e&&!c.s[i]){ c.s[i]=1; fresh.push(i); xp+=C.xp; } });
  c.tries=(c.tries||0)+1; if(o.goal) c.best=Math.max(c.best||0,o.score); S.camp[Lv.id]=c;
  const finished=!wasDone&&campDone(S,Lv.camp); if(finished) xp+=C.bonus;
  return {earned,fresh,stars:campStars(S,Lv.id),xp,finished}; }

// ---------- Daily ----------
function dailyFor(S,date){ if(S.daily.date!==date) S.daily={date,scored:false,score:0,par:S.parCache[date]||0,stars:0,run:null,practice:null}; return S.daily; }
const dayNum=date=>{ const [y,m,d]=date.split('-').map(Number); return Math.round(Date.UTC(y,m-1,d)/864e5); };
function setPar(S,date,par){ S.parCache[date]=par; const keys=Object.keys(S.parCache).sort(); while(keys.length>3) delete S.parCache[keys.shift()]; if(S.daily.date===date) S.daily.par=par; }
function dailyResult(S,date,score,today){ const d=dailyFor(S,date); if(d.scored) return null;
  d.scored=true; d.score=score; d.run=null; d.stars=d.par?parStars(score,d.par):0;
  const pct=d.par?Math.round(score/d.par*100):0;
  S.dhist[date]={score,par:d.par,pct,stars:d.stars}; S.dbest=Math.max(S.dbest||0,pct);
  const keys=Object.keys(S.dhist).sort(); while(keys.length>7) delete S.dhist[keys.shift()]; // the last 7 Dailies
  const n=dayNum(date), last=S.dstreak.last?dayNum(S.dstreak.last):-99;
  if(n!==last){ S.dstreak.cur=n===last+1?S.dstreak.cur+1:1; S.dstreak.last=date; S.dstreak.best=Math.max(S.dstreak.best,S.dstreak.cur); }
  return {stars:d.stars,xp:20*(date===today?2:1),pct}; }
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// no spoilers: the share line never shows a word
function shareLine(date,score,par,stars){ const [,m,dd]=date.split('-').map(Number);
  return `Tilecraft Daily · ${dd} ${MON[m-1]} · ${score}${par?` (${Math.round(score/par*100)}% of par)`:''} · ${'★'.repeat(stars)}${'☆'.repeat(3-stars)}`; }

// ---------- 2-Player games list ----------
// Each game: {id, mode:'code'|'local', me (seat: 0 or 1), names, cfg, moves, n, last, over, code (the code to send)}
function tpFind(S,id){ return S.tp.games.find(g=>g.id===id); }
function tpSave(S,g){ const k=S.tp.games.findIndex(x=>x.id===g.id); if(k>=0) S.tp.games[k]=g; else S.tp.games.unshift(g); }
function tpDelete(S,id){ S.tp.games=S.tp.games.filter(g=>g.id!==id); if(!S.tp.deleted.includes(id)) S.tp.deleted.push(id); if(S.tp.deleted.length>200) S.tp.deleted.shift(); }
// a finished share-code game won by this device's player counts once toward Rivals
function tpCount(S,g,st){ if(g.mode!=='code'||!st.over||S.tp.counted.includes(g.id)) return false; S.tp.counted.push(g.id);
  if(st.result.winner===g.me){ S.tp.wins++; return true; } return false; }
const newGameId=()=>{ const b=new Uint8Array(6); try{ crypto.getRandomValues(b); }catch(e){ for(let i=0;i<6;i++) b[i]=Math.floor(Math.random()*256); } return [...b]; };
const idHex=b=>b.map(v=>v.toString(16).padStart(2,'0')).join('');

// ---------- backup (Tilecraft only, including the 2-Player games list) ----------
// TILECRAFT1Z.<base64 gzip> where the app can compress, TILECRAFT1.<base64> otherwise. Both decode here (the app inflates Z).
const b64e=str=>{ const u=new TextEncoder().encode(str); let b=''; for(let i=0;i<u.length;i++) b+=String.fromCharCode(u[i]); return btoa(b); };
const b64d=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
function backupPlain(S){ return 'TILECRAFT1.'+b64e(JSON.stringify(S)); }
function parseBackup(text){ const m=/TILECRAFT1\.([A-Za-z0-9+/=]+)/.exec(String(text||'')); if(!m) return null;
  try{ const o=JSON.parse(b64d(m[1])); if(!o||typeof o!=='object'||typeof o.xp!=='number') return null; return o; }catch(e){ return null; } }

// ---------- Arcade contract ----------
// Shared settings live in arcade.v1 (read only, never written). They're applied in memory only.
function readArcade(store){ try{ const a=JSON.parse(store.get(ARCADE_KEY)||'null'); if(!a||typeof a!=='object') return null; return a; }catch(e){ return null; } }
function applyShared(S,a){ if(!a) return S; const o=Object.assign({},S), set=a.set||{}; for(const k of SHARED) if(set[k]!==undefined) o[k]=set[k]; if(typeof a.name==='string'&&a.name) o.name=a.name; return o; }
function summary(S){ const l=levelOf(S.xp), bm=S.rec.bestMove;
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:l,xpNext:xpNext(S),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Best move',bm?String(bm.sc):'—'],['Campaign stars',`${totalStars(S)}/${LEVELS.length*3}`],['Daily best',S.dbest?`${S.dbest}% of par`:'—']],
    last:Date.now()}; }
