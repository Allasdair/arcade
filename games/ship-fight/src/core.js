// ===================== SHIP FIGHT CORE =====================
// Save data, progression and the Arcade contract. No DOM, so the tests can load it. build.py inlines it after engine.js.
const KEY='shipfight.v1', VERSION='0.2.0', SUMMARY_KEY='arcade.summary.shipfight', ARCADE_SAVE='arcade.v1';
// Settings that Arcade owns while Ship Fight runs inside it (read from arcade.v1.set, never written back)
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];
// XP to reach each level (index = level-1). Sweep's first 10 steps: 50,100,150,225,300,400,500,650,800
const LV=[0,50,150,300,525,825,1225,1725,2375,3175], MAXL=10;
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LV[l]) l++; return l; };
const WIN_XP={easy:10,normal:20,hard:30}, HUNT_XP=20;
// Battles with a smaller or bigger fleet take less or more time, so they pay less or more
const FLEET_XP={light:.5,standard:1,armada:1.3};
const battleXP=(lv,R)=>Math.max(5,Math.round(WIN_XP[lv]*(FLEET_XP[R.mods.fleet]||1)/5)*5);
const LVNAME={easy:'Easy',normal:'Normal',hard:'Hard'};

// ---------- achievements and cosmetics ----------
// ---------- campaigns: 10 levels each; modifiers arrive as twists, and the last levels bring in the next AI ----------
const CAMPS=[
 {id:'easy',name:'Coastal Waters',desc:'Learn the twists against the Easy AI.',xp:5,bonus:50,ach:'ensign',levels:[
  {name:'Harbour',ai:'easy',mods:{sea:'strait',fleet:'light'},tip:'A small sea and three ships. Find your feet.'},
  {name:'Sandbar',ai:'easy',mods:{fleet:'light'},tip:'Three ships on the full sea. More water to search.'},
  {name:'Full Fleet',ai:'easy',mods:{},tip:'The classic game: five ships each on a 10×10 sea.'},
  {name:'The Narrows',ai:'easy',mods:{sea:'narrows'},tip:'A long, low sea. Ships often lie end to end.'},
  {name:'Elbow Room',ai:'easy',mods:{touch:false},tip:'Ships can\'t touch. When one sinks, the water around it is marked clear.'},
  {name:'Lagoon',ai:'easy',mods:{sea:'atoll'},tip:'An island fills the middle. Ships hug the ring of water.'},
  {name:'Island Hopping',ai:'easy',mods:{sea:'isles'},tip:'Islands break up the sea. Long ships have fewer places to hide.'},
  {name:'Open Water',ai:'easy',mods:{sea:'ocean'},tip:'A 12×12 sea. Spread your shots out.'},
  {name:'Live Fire',ai:'normal',mods:{sea:'strait',fleet:'light'},tip:'First taste of the Normal AI, on a small sea.'},
  {name:'Passing Out',ai:'normal',mods:{},tip:'A full classic battle against the Normal AI.'}]},
 {id:'normal',name:'Open Seas',desc:'Bigger fleets and stranger seas against the Normal AI.',xp:8,bonus:100,ach:'captain',levels:[
  {name:'Patrol',ai:'normal',mods:{},tip:'Classic rules. The Normal AI chases every hit.'},
  {name:'Keep Your Distance',ai:'normal',mods:{sea:'narrows',touch:false},tip:'A narrow sea where ships can\'t touch.'},
  {name:'Archipelago',ai:'normal',mods:{sea:'isles'},tip:'Islands everywhere. Count the gaps a ship could fit.'},
  {name:'Armada',ai:'normal',mods:{sea:'ocean',fleet:'armada'},tip:'Seven ships each on a 12×12 sea.'},
  {name:'Crossroads',ai:'normal',mods:{sea:'cross'},tip:'A cross-shaped sea. The arms are only six cells wide.'},
  {name:'Reef Ring',ai:'normal',mods:{sea:'atoll',touch:false},tip:'A ring of water, and ships can\'t touch.'},
  {name:'Tight Spot',ai:'normal',mods:{sea:'strait'},tip:'Five ships crammed into an 8×8 sea.'},
  {name:'Grand Fleet',ai:'normal',mods:{sea:'ocean',fleet:'armada',touch:false},tip:'Seven ships each, spread out on a wide sea.'},
  {name:'Wolf Pack',ai:'hard',mods:{sea:'strait',fleet:'light'},tip:'The Hard AI appears. A small sea, so be quick.'},
  {name:'Proving Ground',ai:'hard',mods:{},tip:'A classic battle against the Hard AI.'}]},
 {id:'hard',name:'Deep Waters',desc:'Every twist against the Hard AI.',xp:12,bonus:150,ach:'commodore',levels:[
  {name:'First Watch',ai:'hard',mods:{},tip:'The Hard AI works out where your ships are likely to be.'},
  {name:'Shoals',ai:'hard',mods:{sea:'isles',touch:false},tip:'Islands, and ships can\'t touch.'},
  {name:'Four Winds',ai:'hard',mods:{sea:'cross',fleet:'armada'},tip:'Seven ships each on the cross-shaped sea.'},
  {name:'Pressure',ai:'hard',mods:{sea:'strait',touch:false},tip:'An 8×8 sea, five ships, no touching. Little room to hide.'},
  {name:'Convoy',ai:'hard',mods:{sea:'narrows',fleet:'armada'},tip:'Seven ships each in the Narrows.'},
  {name:'Atoll Siege',ai:'hard',mods:{sea:'atoll',fleet:'armada'},tip:'Seven ships each around the island.'},
  {name:'Needle',ai:'hard',mods:{sea:'ocean',fleet:'light'},tip:'Three ships on a 12×12 sea. Every hit counts.'},
  {name:'Scattered Isles',ai:'hard',mods:{sea:'isles',fleet:'armada',touch:false},tip:'Seven ships, islands, and no touching.'},
  {name:'Compass Rose',ai:'hard',mods:{sea:'cross',touch:false},tip:'The cross-shaped sea, and ships can\'t touch.'},
  {name:'Grand Admiral',ai:'hard',mods:{sea:'ocean',fleet:'armada',touch:false},tip:'The final battle: seven ships each, a wide sea, no touching.'}]}];
const campOf=id=>CAMPS.find(c=>c.id===id);
const campStars=(S,c)=>(S.camp[c]||[]).reduce((a,v)=>a+(v||0),0);
const campDone=(S,c)=>(S.camp[c]||[])[9]>0;
const campOpen=(S,c)=>{ const k=CAMPS.findIndex(x=>x.id===c); return k===0||campDone(S,CAMPS[k-1].id); };
const levelOpen=(S,c,i)=>campOpen(S,c)&&(i===0||(S.camp[c]||[])[i-1]>0);
const ACH=[
 {id:'first',name:'First Salvo',desc:'Win any match'},
 {id:'admiral',name:'Admiral',desc:'Beat the Hard AI'},
 {id:'sharp',name:'Sharpshooter',desc:'Win with 60% accuracy or better'},
 {id:'untouched',name:'Untouched',desc:'Win without losing a ship'},
 {id:'laststand',name:'Last Stand',desc:'Win with only one ship left'},
 {id:'clean',name:'Clean Sink',desc:'Sink a ship with no misses between its first and last hit'},
 {id:'dcaptain',name:'Daily Captain',desc:'Earn 3 stars on a Daily Hunt'},
 {id:'veteran',name:'Fleet Veteran',desc:'Win 25 matches'},
 {id:'ensign',name:'Ensign',desc:'Finish the Coastal Waters campaign'},
 {id:'captain',name:'Captain',desc:'Finish the Open Seas campaign'},
 {id:'commodore',name:'Commodore',desc:'Finish the Deep Waters campaign'},
 {id:'voyage',name:'Perfect Voyage',desc:'Earn 3 stars on every level of a campaign'}];
// Sea themes read a palette: water/grid for the sea, hull for your ships, flag = hit-marker colour, miss = miss-marker colour.
// Dark mode never changes a sea's colours: light seas sit in a rounded window on dark menus.
const SEAS=[
 {id:'navy',name:'Classic Navy',desc:'Deep blue water and grey steel.',
  bg:'#eef2f6',panel:'#ffffff',ink:'#14202e',sub:'#7a8796',accent:'#1d4f86',accentInk:'#ffffff',
  water:'#cfe0ef',water2:'#c3d7ea',grid:'rgba(29,79,134,.22)',fog:'#e3ecf5',hull:'#5b6876',hullHi:'#7d8a98',deck:'#3f4a56',flag:'#e0483c',miss:'#1d4f86',sunk:'#14202e',land:'#e6d8ae',landEdge:'#c4b07e'},
 {id:'paper',name:'Paper',lvl:3,desc:'Pencil grid on squared notebook paper.',font:'Georgia,"Times New Roman",serif',
  bg:'#f6efdf',panel:'#fffaef',ink:'#3b3326',sub:'#9a8d72',accent:'#3b3326',accentInk:'#fffaef',
  water:'#fbf6ea',water2:'#f6efdf',grid:'rgba(80,110,170,.35)',fog:'#fbf6ea',hull:'#8a7f6a',hullHi:'#a39880',deck:'#5f5545',flag:'#c0392b',miss:'#2d4a7a',sunk:'#3b3326',line:1,land:'#e3d5b5',landEdge:'#a8966c'},
 {id:'midnight',name:'Midnight Sea',req:'admiral',desc:'Moonlit water for a true admiral.',dark:true,glow:true,
  bg:'#070b18',panel:'#10172b',ink:'#e6ecff',sub:'#7a86ad',accent:'#7fb2ff',accentInk:'#070b18',
  water:'#0f1b38',water2:'#0c1630',grid:'rgba(127,178,255,.18)',fog:'#0d1834',hull:'#5d6b8f',hullHi:'#8695bd',deck:'#3b4766',flag:'#ff6b6b',miss:'#9fc4ff',sunk:'#e6ecff',land:'#1e2538',landEdge:'#34405f'},
 {id:'ironclad',name:'Ironclad',req:'untouched',desc:'Riveted steel and brass.',dark:true,
  bg:'#16181b',panel:'#202327',ink:'#ece6da',sub:'#8f8a80',accent:'#d0a24c',accentInk:'#16181b',
  water:'#2b3136',water2:'#262b30',grid:'rgba(208,162,76,.22)',fog:'#272c31',hull:'#8a8f96',hullHi:'#b0b5bb',deck:'#5d6168',flag:'#ff7a3d',miss:'#d0a24c',sunk:'#ece6da',land:'#3e4247',landEdge:'#5a5f66'},
 {id:'radar',name:'Radar',req:'dcaptain',desc:'Green phosphor and a sweeping beam.',dark:true,glow:true,mono:true,
  bg:'#030a05',panel:'#08160c',ink:'#8dffa8',sub:'#3fa85a',accent:'#8dffa8',accentInk:'#030a05',uiLine:'rgba(141,255,168,.18)',
  water:'#05140a',water2:'#041108',grid:'rgba(141,255,168,.28)',fog:'#05140a',hull:'#2f8a4a',hullHi:'#55c272',deck:'#1d5a30',flag:'#ffd84d',miss:'#8dffa8',sunk:'#8dffa8',sweep:1,land:'#0b2413',landEdge:'#2a6b3c'},
 {id:'storm',name:'Storm',req:'captain',desc:'Grey water under heavy cloud.',dark:true,
  bg:'#13191c',panel:'#1d262a',ink:'#e3ecea',sub:'#82928f',accent:'#9cc7c2',accentInk:'#13191c',
  water:'#2c3b40',water2:'#263439',grid:'rgba(156,199,194,.2)',fog:'#2a383d',hull:'#7d8d92',hullHi:'#a2b1b5',deck:'#4e5c60',flag:'#ff8a4c',miss:'#cfe3e0',sunk:'#e3ecea',land:'#3a4636',landEdge:'#56664f'}];
const HITS=[{id:'flame',name:'Flame',desc:'A burst of fire.'},{id:'cross',name:'Crosshair',req:'sharp',desc:'Dead centre, every time.'},{id:'pin',name:'Pin',lvl:5,desc:'Mark it on the chart.'},{id:'anchor',name:'Anchor',req:'ensign',desc:'Drop anchor on every hit.'}];
const MISSES=[{id:'splash',name:'Splash',desc:'Rings on the water.'},{id:'dot',name:'Dot',lvl:2,desc:'A small, quiet mark.'}];
const FXS=[{id:'none',name:'None',desc:'Just the victory banner.'},{id:'flare',name:'Flare',req:'laststand',desc:'Signal flares light the sky.'},{id:'fireworks',name:'Fireworks at sea',req:'veteran',desc:'Bursts over the water.'},{id:'salute',name:'Salute',req:'commodore',desc:'A gun salute and golden stars.'}];
const KINDS=[[SEAS,'theme'],[HITS,'hit marker'],[MISSES,'miss marker'],[FXS,'win effect']];
const REWARDS={}; for(const [list,kind] of KINDS) for(const it of list) if(it.lvl) (REWARDS[it.lvl]=REWARDS[it.lvl]||[]).push(`${it.name} ${kind}`);
const achRw=id=>{ const out=[]; for(const [list,kind] of KINDS) for(const it of list) if(it.req===id) out.push(`${it.name} ${kind}`); return out.join(' + '); };

// ---------- save ----------
// Every new field goes here; old saves are filled in by Object.assign(defSave(), saved).
const defSave=()=>({xp:0,ach:{},wins:0,streak:0,bestStreak:0,
  stats:{easy:{played:0,won:0,best:0,stars:0},normal:{played:0,won:0,best:0,stars:0},hard:{played:0,won:0,best:0,stars:0}},
  shots:0,hits:0,sinks:0,lastLevel:'normal',match:null,lastFleet:null,mods:{sea:'classic',fleet:'standard',touch:true},camp:{easy:[],normal:[],hard:[]},campTab:'easy',hunt:null,huntLog:{},huntBest:0,huntPlayed:0,
  sea:'navy',hit:'flame',miss:'splash',fx:'none',
  appearance:'system',motion:true,sfx:true,music:true,haptics:true,fullscreen:false,cb:false,lefty:false,lang:'auto',
  aiSpeed:'normal',showLast:true,confirmFire:false,name:'',bk:{last:0,nudged:0},seenVer:''});
function parseJSON(s){ try{ return JSON.parse(s); }catch(e){ return null; } }
// Load from a Storage-like object. In Arcade mode the shared settings and the name come from arcade.v1.
function loadSave(store,arcade){
  const raw=parseJSON(store.getItem(KEY)), S=Object.assign(defSave(),raw&&typeof raw==='object'?raw:{});
  const d=defSave(); S.stats=Object.assign(d.stats,S.stats||{}); S.camp=Object.assign(d.camp,S.camp||{}); S.mods=Object.assign(d.mods,S.mods||{}); for(const k of ['easy','normal','hard']) S.stats[k]=Object.assign({played:0,won:0,best:0,stars:0},S.stats[k]);
  if(arcade) applyArcade(S,store); return S; }
function applyArcade(S,store){ const A=parseJSON(store.getItem(ARCADE_SAVE)); if(!A) return false;
  const set=A.set||{}; for(const k of SHARED) if(set[k]!==undefined) S[k]=set[k]; if(typeof A.name==='string') S.name=A.name; return true; }
// The only record Arcade reads. Written ~300 ms after each save.
function summary(S){ const l=levelOf(S.xp), st=S.stats;
  return {v:1,game:'shipfight',ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:LV[l-1],xpNext:l>=MAXL?null:LV[l],
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Wins',String(S.wins)],['Best Daily Hunt',S.huntBest?S.huntBest+' shots':'—'],['Hard wins',String(st.hard.won)]],
    last:Date.now()}; }

// ---------- progression ----------
// award/xp only change S; the app shows the toasts. Each returns what changed.
function award(S,id){ if(S.ach[id]) return false; S.ach[id]=Date.now(); return true; }
function grantXP(S,n){ const before=levelOf(S.xp); S.xp+=n; const ups=[]; for(let l=before+1;l<=levelOf(S.xp);l++) ups.push(l); return ups; }
// A finished match (won or lost). Returns {xp, ups, stars, ach:[new ids]}.
function recordMatch(S,m){ const lv=m.level, st=S.stats[lv], won=m.state==='won', out={xp:0,ups:[],stars:[false,false,false],ach:[]};
  st.played++; S.shots+=m.shots; S.hits+=m.hits; S.lastLevel=lv;
  if(m.cleanSinks&&award(S,'clean')) out.ach.push('clean');
  if(!won){ S.streak=0; return out; }
  out.stars=matchStars(m); const n=out.stars.filter(Boolean).length;
  st.won++; if(!m.camp&&isClassic(m.R)) st.best=st.best?Math.min(st.best,m.shots):m.shots; if(!m.camp) st.stars=Math.max(st.stars,n);
  S.wins++; S.streak++; S.bestStreak=Math.max(S.bestStreak,S.streak);
  const tryA=id=>{ if(award(S,id)) out.ach.push(id); };
  tryA('first'); if(lv==='hard') tryA('admiral'); if(m.acc>=.6) tryA('sharp'); if(!m.me.sunk.length) tryA('untouched');
  if(m.me.afloat===1) tryA('laststand'); if(S.wins>=25) tryA('veteran');
  if(m.camp){ const c=recordCampaign(S,m.camp.c,m.camp.i,n); out.xp=c.xp; out.ach.push(...c.ach); out.newStars=c.newStars; out.campDone=c.done; }
  else out.xp=battleXP(lv,m.R);
  out.ups=grantXP(S,out.xp); return out; }
// A won campaign level: XP for each new star (first time only, so replays can't be farmed), plus a bonus for finishing.
function recordCampaign(S,cid,i,stars){ const C=campOf(cid), arr=S.camp[cid]||(S.camp[cid]=[]), prev=arr[i]||0, out={xp:0,ach:[],newStars:0,done:false};
  if(stars>prev){ out.newStars=stars-prev; out.xp=out.newStars*C.xp; arr[i]=stars; }
  if(i===9&&!prev&&stars){ out.done=true; out.xp+=C.bonus; if(award(S,C.ach)) out.ach.push(C.ach); }
  if(arr.length===10&&arr.every(v=>v===3)&&award(S,'voyage')) out.ach.push('voyage');
  return out; }
// A finished Daily Hunt. XP doubles when it's finished on its own date.
function recordHunt(S,date,shots,todayStr){ const stars=huntStars(shots), out={xp:0,ups:[],stars,ach:[]};
  S.huntPlayed++; S.huntLog[date]=shots; S.huntBest=S.huntBest?Math.min(S.huntBest,shots):shots;
  const ks=Object.keys(S.huntLog).sort(); while(ks.length>120) delete S.huntLog[ks.shift()]; // keep the last 120 days
  if(stars===3&&award(S,'dcaptain')) out.ach.push('dcaptain');
  out.xp=HUNT_XP*(date===todayStr?2:1); out.ups=grantXP(S,out.xp); return out; }
const modsLine=m0=>{ const md=Object.assign({},CLASSIC,m0), a=[]; if(md&&md.sea!=='classic') a.push(SHAPES[md.sea].name); if(md&&md.fleet!=='standard') a.push(FLEETS[md.fleet].name+' fleet'); if(md&&md.touch===false) a.push('No touching'); return a; };
const shareLine=o=>o.camp?`Ship Fight · ${campOf(o.camp.c).name} ${o.camp.i+1} · ${o.won?'Won':'Lost'} · ${o.shots} shots · ${'★'.repeat(o.stars)}${'☆'.repeat(3-o.stars)}`:o.hunt?`Ship Fight · Daily Hunt ${o.date} · ${o.shots} shots · ${'★'.repeat(o.stars)}${'☆'.repeat(3-o.stars)}`
  :`Ship Fight · ${[LVNAME[o.level],...modsLine(o.mods)].join(' · ')} · ${o.won?'Won':'Lost'} · ${o.shots} shots · ${'★'.repeat(o.stars)}${'☆'.repeat(3-o.stars)}`;

if(typeof module!=='undefined') module.exports={CAMPS,campOf,campStars,campDone,campOpen,levelOpen,recordCampaign,battleXP,FLEET_XP,modsLine,KEY,VERSION,SUMMARY_KEY,ARCADE_SAVE,SHARED,LV,MAXL,levelOf,WIN_XP,HUNT_XP,ACH,SEAS,HITS,MISSES,FXS,KINDS,REWARDS,achRw,defSave,loadSave,applyArcade,summary,award,grantXP,recordMatch,recordHunt,shareLine};
