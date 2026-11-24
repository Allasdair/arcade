// ===================== Drift core =====================
// Save, XP and levels, campaign stars and unlocks, records, Endless milestones and expeditions, achievements,
// cosmetics, backup and the Arcade contract. No DOM: storage is passed in as {get(key), set(key,value)} so Node
// tests can run it.
const VERSION='0.1.0', GAME_ID='drift', KEY='drift.v1', SUMKEY='arcade.summary.drift', ARCADE_KEY='arcade.v1';
const MAXL=10, LV=[0,50,150,300,525,825,1225,1725,2375,3175]; // Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LV[l]) l++; return l; };
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];

function defSave(reduced){ return {v:1,xp:0,ach:{},camp:{},rec:{},wstars:{},
  endless:{bestWave:0,bestScore:0,exp:{},runs:0},
  setup:{diff:'easy',mods:defMods('easy')},esetup:{wrap:'none',well:'off'},
  ctl:{layout:'dpad',steer:'direct',autofire:'hold',size:'normal',lead:true,radar:'normal'},
  look:{ship:'arrow',rock:'stone',theme:'deep',trail:'plain',bullet:'bolt',fx:'none',track:'orbit',sound:'soft'},
  danger:true,sfx:true,music:true,haptics:true,motion:!reduced,appearance:'system',fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  stats:{games:0,wins:0,kills:0,gold:0,ticks:0,shots:0,hits:0},run:null,seenVer:'',bk:{last:0},howto:false}; }
// Old saves missing new fields are filled in from defSave() (one level deep for nested groups)
const NESTED=['endless','setup','esetup','ctl','look','stats','bk'];
function loadSave(raw,reduced){ const d=defSave(reduced); let s=null; try{ s=raw?JSON.parse(raw):null; }catch(e){ s=null; }
  if(!s||typeof s!=='object') return d;
  for(const k in d){ if(s[k]===undefined) continue;
    if(NESTED.includes(k)&&d[k]&&typeof d[k]==='object'&&s[k]&&typeof s[k]==='object') d[k]=Object.assign(d[k],s[k]);
    else d[k]=s[k]; }
  d.setup.mods=Object.assign(defMods(d.setup.diff||'easy'),d.setup.mods||{});
  return d; }

// ---------- cosmetics ----------
const COS={
 ship:[{id:'arrow',name:'Arrow'},{id:'dart',name:'Dart',lvl:2},{id:'wing',name:'Wing',lvl:4},{id:'orbiter',name:'Orbiter',lvl:7},{id:'raptor',name:'Raptor',lvl:9},
   {id:'prism',name:'Prism',req:'titan'},{id:'ghost',name:'Ghost',req:'fleet'}],
 rock:[{id:'stone',name:'Stone'},{id:'crystal',name:'Crystal',lvl:3},{id:'ember',name:'Ember',lvl:6},{id:'wire',name:'Wireframe',lvl:8},{id:'ice',name:'Ice',lvl:10},{id:'molten',name:'Molten',req:'bastion'}],
 theme:[{id:'deep',name:'Deep Blue'},{id:'midnight',name:'Midnight',lvl:2},{id:'sunset',name:'Sunset',lvl:5},{id:'retro',name:'Retro Green',lvl:8},{id:'paper',name:'Paper',lvl:10},{id:'nebula',name:'Nebula',req:'x25'}],
 trail:[{id:'plain',name:'Plain'},{id:'ion',name:'Ion',lvl:4},{id:'sparkle',name:'Sparkle',lvl:9},{id:'comet',name:'Comet',req:'x20'}],
 bullet:[{id:'bolt',name:'Bolt'},{id:'orb',name:'Orb',lvl:3},{id:'laser',name:'Laser',lvl:7}],
 fx:[{id:'none',name:'None'},{id:'fireworks',name:'Fireworks',lvl:6},{id:'supernova',name:'Supernova',req:'leviathan'}],
 track:[{id:'orbit',name:'Orbit'},{id:'daylight',name:'Daylight'},{id:'signal',name:'Signal'},{id:'afterburn',name:'Afterburn',lvl:7}],
 sound:[{id:'soft',name:'Soft'},{id:'chip',name:'Chiptune',lvl:5}]};
const COS_KINDS=[['ship','Ship'],['rock','Rocks'],['theme','Colour theme'],['trail','Thruster trail'],['bullet','Bullets'],['fx','Win effect'],['track','Soundtrack'],['sound','Sound pack']];
const owned=(S,it)=>(!it.lvl||levelOf(S.xp)>=it.lvl)&&(!it.req||!!S.ach[it.req]||!!(S.endless.exp&&S.endless.exp[it.req]));
const findCos=(kind,id)=>COS[kind].find(c=>c.id===id)||COS[kind][0];
function rewardsAt(level){ const o=[]; for(const [k,n] of COS_KINDS) for(const it of COS[k]) if(it.lvl===level) o.push(`${it.name} ${n.toLowerCase()}`); return o; }
const STARTER='Arrow, Stone, Deep Blue, Orbit, Daylight, Signal';

// ---------- Endless expeditions (goals with rewards) ----------
const EXPEDITIONS=[{id:'x10',name:'Reach wave 10',xp:50},{id:'x20',name:'Reach wave 20 with no dash used',xp:75,reward:'Comet trail'},
 {id:'x15w',name:'Reach wave 15 on All-sides wrap',xp:75},{id:'x25',name:'Reach wave 25',xp:150,reward:'Nebula theme'}];
function checkExp(S,st){ const out=[], E=S.endless.exp, w=st.wave, c=st.cfg;
  const give=x=>{ if(!E[x.id]){ E[x.id]=Date.now(); out.push(x); } };
  if(w>=10) give(EXPEDITIONS[0]); if(w>=20&&st.stats.dashes===0) give(EXPEDITIONS[1]); if(w>=15&&c.wrap==='all') give(EXPEDITIONS[2]); if(w>=25) give(EXPEDITIONS[3]);
  return out; }
// milestones every 5 waves: 25 XP, rising by 5, capped at 50 each and 200 a run
const milestoneXP=k=>Math.min(50,25+5*(k-1));
function endlessXP(waves){ let x=0; for(let k=1;k*MILESTONE_EVERY<=waves;k++) x+=milestoneXP(k); return Math.min(200,x); }
// the XP a run has earned so far at a given wave (each milestone pays as it's reached)
function milestoneAt(wave){ return wave>0&&wave%MILESTONE_EVERY===0?milestoneXP(wave/MILESTONE_EVERY):0; }

// ---------- achievements ----------
const ACH=[
 {id:'first',g:'Firsts and skill',name:'First Light',desc:'Clear any game'},
 {id:'sharp',g:'Firsts and skill',name:'Sharpshooter',desc:'Clear a game with 70% accuracy or better'},
 {id:'untouch',g:'Firsts and skill',name:'Untouchable',desc:'Clear Hard with no lives lost'},
 {id:'chain',g:'Firsts and skill',name:'Chain Reaction',desc:'Destroy 5 rocks with one volatile explosion'},
 {id:'combo',g:'Firsts and skill',name:'Combo Pilot',desc:'Reach a ×2 combo'},
 {id:'close',g:'Firsts and skill',name:'Close Call',desc:'Dash through a rock'},
 {id:'goldrush',g:'Firsts and skill',name:'Gold Rush',desc:'Destroy 10 gold rocks'},
 {id:'weightless',g:'Modifiers',name:'Weightless',desc:'Clear Normal with True space'},
 {id:'horizon',g:'Modifiers',name:'Event Horizon',desc:'Clear Normal with the gravity well'},
 {id:'blind',g:'Modifiers',name:'Blind Faith',desc:'Clear Normal with fog'},
 {id:'lone',g:'Modifiers',name:'Lone Wolf',desc:'Clear Hard with one life'},
 {id:'purist',g:'Modifiers',name:'Purist',desc:'Clear Hard with power-ups off'},
 {id:'titan',g:'Campaign',name:'Titan Breaker',desc:'Finish the Easy campaign',reward:'Prism ship'},
 {id:'bastion',g:'Campaign',name:'Bastion Breaker',desc:'Finish the Normal campaign',reward:'Molten rocks'},
 {id:'leviathan',g:'Campaign',name:'Leviathan Breaker',desc:'Finish the Hard campaign',reward:'Supernova effect'},
 {id:'ace',g:'Campaign',name:'Ace',desc:'3 stars on every level of one campaign'},
 {id:'fleet',g:'Campaign',name:'Fleet Admiral',desc:'3 stars on all 45 levels',reward:'Ghost ship'},
 {id:'steady',g:'Endless',name:'Holding Steady',desc:'Reach wave 10'},
 {id:'deep',g:'Endless',name:'Deep Space',desc:'Reach wave 25'},
 {id:'survivor',g:'Endless',name:'Survivor',desc:'Play 30 minutes in one Endless run'},
 {id:'breaker',g:'Totals',name:'Rock Breaker',desc:'Destroy 1,000 rocks'},
 {id:'veteran',g:'Totals',name:'Veteran',desc:'Clear 25 games'}];
// ctx: {mode: normal|campaign|endless, cfg, res, st}
function checkAch(S,ctx){ const got=[], give=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); got.push(id); } };
  const {mode,cfg,res}=ctx;
  if(res){ const s=res.stats;
    if(s.chainMax>=5) give('chain'); if(s.comboMax>=10) give('combo'); if(s.closeCall>0) give('close');
    if(res.ok&&mode!=='endless'){ give('first'); if(res.shots>=10&&res.acc>=0.7) give('sharp'); if(cfg.diff==='hard'&&res.livesLost===0) give('untouch');
      if(mode==='normal'){ const m=cfg.mods||{};
        if(cfg.diff==='normal'&&m.drag==='space') give('weightless'); if(cfg.diff==='normal'&&m.well==='on') give('horizon'); if(cfg.diff==='normal'&&m.fog==='on') give('blind');
        if(cfg.diff==='hard'&&m.lives==='1') give('lone'); if(cfg.diff==='hard'&&m.pups==='off') give('purist'); } }
    if(mode==='endless'){ if(res.wave>=10) give('steady'); if(res.wave>=25) give('deep'); if(res.ticks>=30*60*60) give('survivor'); } }
  if(S.stats.gold>=10) give('goldrush'); if(S.stats.kills>=1000) give('breaker'); if(S.stats.wins>=25) give('veteran');
  for(const [ci,id] of [[0,'titan'],[1,'bastion'],[2,'leviathan']]) if(campOf(S,CAMPAIGNS[ci].id[0]+'15').s[0]) give(id);
  const camp3=ci=>LEVELS.filter(L=>L.ci===ci).every(L=>campStars(S,L.id)>=3);
  if([0,1,2].some(camp3)) give('ace'); if([0,1,2].every(camp3)) give('fleet');
  return got; }

// ---------- XP ----------
function addXP(S,n){ const before=levelOf(S.xp); S.xp+=Math.max(0,Math.round(n)); const after=levelOf(S.xp); const rewards=[];
  for(let l=before+1;l<=after;l++) rewards.push(...rewardsAt(l)); return {xp:Math.round(n),before,after,rewards}; }
const xpNext=S=>{ const l=levelOf(S.xp); return l>=MAXL?null:LV[l]; };
const NORMAL_XP={easy:15,normal:30,hard:45};
// Normal mode win: base × (1 + half of the modifier bonus); each new win star on a difficulty × wrap pays +5 once
function normalXP(cfg){ const mm=modMult(cfg.mods||{}); return Math.round(NORMAL_XP[cfg.diff]*(1+Math.max(0,mm-1)/2)); }

// ---------- Normal mode: win stars and records ----------
// "plain" = the difficulty's default modifiers (wrap aside); anything else records separately
const isPlain=(diff,m)=>MOD_IDS.every(k=>k==='wrap'||m[k]===defMods(diff)[k]);
const recKey=c=>`${c.diff}|${c.mods.wrap}|${isPlain(c.diff,c.mods)?'std':'mod'}`;
function normalStars(cfg,res){ if(!res.ok) return [0,0,0]; return [1,res.livesLost===0?1:0,res.ticks/60<=normalPar(cfg.diff,cfg.mods.density)?1:0]; }
function normalResult(S,cfg,res,date){ const k=recKey(cfg), r=S.rec[k]||{score:0,time:0}, stars=normalStars(cfg,res);
  let newBest=false, newTime=false; if(res.score>r.score){ r.score=res.score; newBest=true; }
  if(res.ok&&(!r.time||res.ticks<r.time)){ r.time=res.ticks; newTime=!!res.ok; } r.date=date||''; S.rec[k]=r;
  let xp=res.ok?normalXP(cfg):0; const wk=`${cfg.diff}|${cfg.mods.wrap}`, ws=S.wstars[wk]||[0,0,0], fresh=[];
  stars.forEach((s,i)=>{ if(s&&!ws[i]){ ws[i]=1; fresh.push(i); xp+=5; } }); S.wstars[wk]=ws;
  return {stars,fresh,xp,newBest,newTime}; }
const bestOf=(S,diff,wrap,plain)=>(S.rec[`${diff}|${wrap}|${plain?'std':'mod'}`]||{score:0}).score;

// ---------- campaign ----------
const campOf=(S,id)=>S.camp[id]||{s:[0,0,0],best:0,time:0};
const campStars=(S,id)=>campOf(S,id).s.reduce((a,b)=>a+b,0);
const totalStars=S=>LEVELS.reduce((a,L)=>a+campStars(S,L.id),0);
const campUnlocked=(S,ci)=>ci===0||!!campOf(S,CAMPAIGNS[ci-1].id[0]+'15').s[0];
function unlocked(S,id){ const L=LEVEL_BY[id]; if(!campUnlocked(S,L.ci)) return false; return L.n===1||!!campOf(S,L.camp[0]+(L.n-1)).s[0]; }
const STAR_XP=[6,10,15], CAMP_XP=[75,150,225];
function starsEarned(L,res){ return [res.ok?1:0,res.ok&&res.livesLost===0?1:0,res.ok&&res.ticks/60<=L.par?1:0]; }
function starText(L,i){ return [L.boss?`Defeat ${BOSSES[L.boss].name}`:'Clear the level','No lives lost',`Clear in ${fmtTime(L.par)}`][i]; }
function campaignResult(S,L,res){ const earned=starsEarned(L,res), c=campOf(S,L.id), fresh=[]; let xp=0;
  const doneBefore=!!campOf(S,L.camp[0]+'15').s[0];
  earned.forEach((e,i)=>{ if(e&&!c.s[i]){ c.s[i]=1; fresh.push(i); xp+=STAR_XP[L.ci]; } });
  if(res.ok){ c.best=Math.max(c.best||0,res.score); if(!c.time||res.ticks<c.time) c.time=res.ticks; } S.camp[L.id]=c;
  const campDone=!doneBefore&&!!campOf(S,L.camp[0]+'15').s[0]; if(campDone) xp+=CAMP_XP[L.ci];
  return {earned,fresh,stars:campStars(S,L.id),xp,campDone}; }
function nextLevel(S){ for(const L of LEVELS) if(unlocked(S,L.id)&&!campOf(S,L.id).s[0]) return L; for(const L of LEVELS) if(unlocked(S,L.id)&&campStars(S,L.id)<3) return L; return null; }

// ---------- Endless ----------
function endlessResult(S,st){ const E=S.endless, w=st.wave, sc=st.score; let newWave=false, newScore=false;
  if(w>E.bestWave){ E.bestWave=w; newWave=true; } if(sc>E.bestScore){ E.bestScore=sc; newScore=true; } E.runs++;
  const exps=checkExp(S,st); let xp=exps.reduce((a,x)=>a+x.xp,0);
  return {newWave,newScore,exps,xp}; }

// ---------- lifetime stats ----------
function addStats(S,res){ const t=S.stats, s=res.stats; t.games++; if(res.ok) t.wins++; t.kills+=s.kills; t.gold+=s.gold; t.ticks+=res.ticks; t.shots+=s.shots; t.hits+=s.hits; }

// ---------- backup (Drift only) ----------
// DRIFT1Z.<base64 gzip> where the app can compress, DRIFT1.<base64> otherwise. Both decode here (the app inflates Z).
const b64e=str=>{ const u=new TextEncoder().encode(str); let b=''; for(let i=0;i<u.length;i++) b+=String.fromCharCode(u[i]); return btoa(b); };
const b64d=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
function backupPlain(S){ const o=Object.assign({},S); o.run=null; return 'DRIFT1.'+b64e(JSON.stringify(o)); }
function parseBackup(text){ const m=/DRIFT1\.([A-Za-z0-9+/=]+)/.exec(String(text||'')); if(!m) return null;
  try{ const o=JSON.parse(b64d(m[1])); if(!o||typeof o!=='object'||typeof o.xp!=='number') return null; return o; }catch(e){ return null; } }

// ---------- Arcade contract ----------
// Shared settings live in arcade.v1 (read only, never written). They're applied in memory only.
function readArcade(store){ try{ const a=JSON.parse(store.get(ARCADE_KEY)||'null'); if(!a||typeof a!=='object') return null; return a; }catch(e){ return null; } }
function applyShared(S,a){ if(!a) return S; const o=Object.assign({},S), set=a.set||{}; for(const k of SHARED) if(set[k]!==undefined) o[k]=set[k]; if(typeof a.name==='string') o.name=a.name; return o; }
function summary(S){ const l=levelOf(S.xp), h=Math.max(bestOf(S,'hard','none',true),bestOf(S,'hard','lr',true),bestOf(S,'hard','all',true),bestOf(S,'hard','none',false),bestOf(S,'hard','lr',false),bestOf(S,'hard','all',false));
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:l,xpNext:xpNext(S),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Best Endless wave',S.endless.bestWave?String(S.endless.bestWave):'—'],['Campaign stars',`${totalStars(S)}/135`],['Best score (Hard)',h?fmtNum(h):'—']],
    last:Date.now()}; }
