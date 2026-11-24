// Snake core — save, XP/levels, stars, bests, achievements, cosmetics and the Arcade contract. No DOM.
'use strict';
const VERSION='0.1.0';
const SAVE_KEY='snake.v1', SUMMARY_KEY='arcade.summary.snake', ARCADE_KEY='arcade.v1';
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];

// ---------- levels: Sweep's first 10 steps (50,100,150,225,300,400,500,650,800), max 10 ----------
const MAXL=10, LV=[0,50,150,300,525,825,1225,1725,2375,3175];
function levelOf(xp){ let l=1; while(l<MAXL&&xp>=LV[l]) l++; return {level:l,xpLevel:LV[l-1],xpNext:l<MAXL?LV[l]:null}; }

// ---------- cosmetics ----------
// unlock: 0 = default, number = level, string = achievement id
const COS={
  skin:[{id:'classic',name:'Classic Green',u:0,c:['#3fae4a','#2b8a3a'],head:'#21702d'},
        {id:'candy',name:'Candy Stripe',u:3,c:['#ff5f8f','#ffffff'],stripe:1,head:'#e23d72'},
        {id:'sunset',name:'Sunset',u:6,c:['#ffb347','#e8445a'],head:'#c7334a'},
        {id:'royal',name:'Royal',u:10,c:['#7b5cff','#3a1f9e'],head:'#2f1785'},
        {id:'ember',name:'Ember',u:'long_haul',c:['#ffcf4a','#e8501f'],head:'#b8320c'},
        {id:'ocean',name:'Ocean',u:'leviathan',c:['#5fe0e6','#1f5fbf'],head:'#17469a'},
        {id:'neon',name:'Neon',u:'speed_demon',c:['#b6ff3b','#18e0ff'],head:'#0fb3cc',glow:1},
        {id:'golden',name:'Golden',u:'full_house',c:['#fff1a8','#d79a12'],head:'#9a6a05',glow:1}],
  theme:[{id:'grass',name:'Grass',u:0,a:'#a9d86e',b:'#a2d166',wall:'#5d8a3a',wallEdge:'#4b7430',grid:'rgba(0,0,0,.06)',dark:0},
         {id:'paper',name:'Paper',u:2,a:'#fbf7ee',b:'#f6f1e5',wall:'#d8cfbd',wallEdge:'#c4b9a4',grid:'rgba(80,60,20,.09)',dark:0},
         {id:'sand',name:'Sand',u:7,a:'#f1d9a6',b:'#ecd29c',wall:'#c49a5b',wallEdge:'#a97f45',grid:'rgba(90,60,10,.08)',dark:0},
         {id:'midnight',name:'Midnight',u:'shape_shifter',a:'#18203a',b:'#1b2442',wall:'#0b0f1e',wallEdge:'#2b3560',grid:'rgba(255,255,255,.05)',dark:1},
         {id:'lcd',name:'Retro LCD',u:'daily_devotee',a:'#b7c59a',b:'#b2c094',wall:'#56603f',wallEdge:'#454e32',grid:'rgba(40,50,20,.12)',dark:0,mono:'#2f3822'}],
  food:[{id:'apple',name:'Apple',u:0},{id:'orb',name:'Orb',u:4},{id:'berry',name:'Berry',u:9},{id:'gem',name:'Gem',u:'golden_touch'}],
  trail:[{id:'none',name:'None',u:0},{id:'sparkle',name:'Sparkle',u:5},{id:'portal',name:'Portal',u:'wrap_artist'}],
  effect:[{id:'none',name:'None',u:0},{id:'fireworks',name:'Fireworks',u:8},{id:'confetti',name:'Confetti',u:'regular'}]};
const KIND_NAMES={skin:'Snake skins',theme:'Arena themes',food:'Food',trail:'Trails',effect:'New-best effects'};
const REWARDS={}; for(const k in COS) for(const c of COS[k]) if(typeof c.u==='number'&&c.u>1) (REWARDS[c.u]=REWARDS[c.u]||[]).push(c.name+' '+({skin:'skin',theme:'arena',food:'food',trail:'trail',effect:'effect'})[k]);

// ---------- achievements ----------
const ACH=[
  {id:'first_bite',name:'First Bite',desc:'Finish a run with 10 or more food'},
  {id:'long_haul',name:'Long Haul',desc:'Reach length 50'},
  {id:'leviathan',name:'Leviathan',desc:'Reach length 100'},
  {id:'speed_demon',name:'Speed Demon',desc:'Eat 25 food in one run on Fast'},
  {id:'wrap_artist',name:'Wrap Artist',desc:'Wrap 50 times in one run'},
  {id:'golden_touch',name:'Golden Touch',desc:'Eat 5 bonus foods in one run'},
  {id:'shape_shifter',name:'Shape Shifter',desc:'1 star on every shaped arena'},
  {id:'daily_devotee',name:'Daily Devotee',desc:'3 stars on a Daily Run'},
  {id:'regular',name:'Regular',desc:'Finish 50 runs'},
  {id:'full_house',name:'Full House',desc:'Fill a whole arena'}];
const achReward=id=>{ for(const k in COS) for(const c of COS[k]) if(c.u===id) return c.name+' '+({skin:'skin',theme:'arena',food:'food',trail:'trail',effect:'effect'})[k]; return 'Badge'; };

// ---------- save ----------
function defSave(){
  return {v:1,ver:VERSION,xp:0,runs:0,food:0,best:{},bestLen:0,dailyBest:null,daily:null,run:null,
    setup:{arena:'open',size:'m',speed:'normal',walls:'solid',speedup:false},
    set:{appearance:'auto',motion:true,sfx:true,music:false,haptics:true,fullscreen:false,cb:false,lefty:false,lang:'auto',
         controls:'swipe',grid:false,countdown:3},
    cos:{skin:'classic',theme:'grass',food:'apple',trail:'none',effect:'none'},
    ach:{},shapeStars:{},name:'',seenVer:'',lastBackup:0};
}
function merge(d,s){ if(!s||typeof s!=='object'||Array.isArray(s)) return d;
  for(const k in s){ const dv=d[k], sv=s[k];
    if(dv&&typeof dv==='object'&&!Array.isArray(dv)&&sv&&typeof sv==='object'&&!Array.isArray(sv)&&Object.keys(dv).length) d[k]=merge(dv,sv);
    else if(sv!==undefined) d[k]=sv; }
  return d; }
function loadSave(raw){ let o=null; try{ o=typeof raw==='string'?JSON.parse(raw):raw; }catch(e){} const S=merge(defSave(),o||{});
  for(const k in S.cos) if(!isUnlocked(S,k,S.cos[k])) S.cos[k]=COS[k][0].id; return S; }

// ---------- unlocks ----------
function cosItem(kind,id){ return (COS[kind]||[]).find(c=>c.id===id); }
function isUnlocked(S,kind,id){ const c=cosItem(kind,id); if(!c) return false; if(c.u===0) return true;
  if(typeof c.u==='number') return levelOf(S.xp).level>=c.u; return !!S.ach[c.u]; }
function unlockText(c){ return c.u===0?'Default':typeof c.u==='number'?'Level '+c.u:(ACH.find(a=>a.id===c.u)||{}).name; }

// ---------- results ----------
const SPEED_MULT={slow:.75,normal:1,fast:1.5}, STAR_XP=[0,5,12,25], DAILY_XP=20;
const bestKey=st=>`${st.arena}-${st.size}|${st.speed}|${st.walls}${st.speedup?'|up':''}`;
// finishRun mutates S and returns what the results screen shows. today = local 'YYYY-MM-DD'.
function finishRun(S,st,E,today){
  const len=st.body.length+st.grow, score=E.scoreOf(st), stars=E.starsFor(len,st.cells,st.perfect), eaten=st.foods+st.bonusEaten;
  const before=levelOf(S.xp).level, r={len,score,stars,eaten,xp:0,newBest:false,prevBest:null,daily:null,ach:[],unlocks:[],levelUp:0};
  const scored=st.daily&&!st.practice;
  if(scored){ r.daily=st.daily; r.xp=DAILY_XP*(today===st.daily?2:1);
    S.daily={date:st.daily,done:true,score,stars,len,run:null}; if(S.dailyBest==null||score>S.dailyBest) S.dailyBest=score; }
  else if(!st.practice) r.xp=Math.round(STAR_XP[stars]*SPEED_MULT[st.speed]);
  const k=bestKey(st), pb=S.best[k]; r.prevBest=pb!=null?pb:null;
  if(pb==null||len>pb){ S.best[k]=len; r.newBest=pb!=null; }
  if(len>S.bestLen) S.bestLen=len;
  S.runs++; S.food+=eaten; S.xp+=r.xp;
  if(st.arena!=='open'&&stars>=1) S.shapeStars[st.arena]=Math.max(S.shapeStars[st.arena]||0,stars);
  const got=id=>{ if(!S.ach[id]){ S.ach[id]=Date.now(); r.ach.push(id); } };
  if(eaten>=10) got('first_bite'); if(len>=50) got('long_haul'); if(len>=100) got('leviathan');
  if(st.speed==='fast'&&eaten>=25) got('speed_demon'); if(st.wraps>=50) got('wrap_artist'); if(st.bonusEaten>=5) got('golden_touch');
  if(E.SHAPED.every(a=>S.shapeStars[a]>=1)) got('shape_shifter'); if(scored&&stars===3) got('daily_devotee');
  if(S.runs>=50) got('regular'); if(st.perfect) got('full_house');
  const after=levelOf(S.xp).level; r.levelUp=after>before?after:0;
  for(const kind in COS) for(const c of COS[kind]){
    const byLvl=typeof c.u==='number'&&c.u>before&&c.u<=after, byAch=typeof c.u==='string'&&r.ach.includes(c.u);
    if(byLvl||byAch) r.unlocks.push({kind,id:c.id,name:c.name}); }
  if(st.daily&&!st.practice) S.daily.run=null; else S.run=null;
  return r;
}

// ---------- Arcade contract ----------
// Shared settings come from arcade.v1.set (in memory only); snake.v1 keeps the standalone values.
function applyArcade(S,arcade){ const eff=Object.assign({},S.set); let name=S.name;
  if(arcade&&typeof arcade==='object'){ const a=arcade.set||{}; for(const k of SHARED) if(a[k]!==undefined) eff[k]=a[k]; if(typeof arcade.name==='string') name=arcade.name; }
  return {set:eff,name}; }
function summary(S){ const L=levelOf(S.xp);
  return {v:1,game:'snake',ver:VERSION,level:L.level,maxLevel:MAXL,xp:S.xp,xpLevel:L.xpLevel,xpNext:L.xpNext,
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Best length',String(S.bestLen||0)],['Daily Run best',S.dailyBest!=null?String(S.dailyBest):'—'],['Runs',String(S.runs)]],
    last:Date.now()}; }
function shareLine(st,stars,E){ const name=st.daily?'Daily '+st.daily:E.ARENA_NAMES[st.arena]+(st.arena==='open'?' '+E.SIZE_NAMES[st.size]:'');
  return `Snake · ${name} · ${E.SPEED_NAMES[st.speed]} · ${st.walls==='wrap'?'Wrap':'Solid'} · ${E.scoreOf(st)} · ${'★'.repeat(stars)}${'☆'.repeat(3-stars)}`; }

if(typeof module!=='undefined') module.exports={VERSION,SAVE_KEY,SUMMARY_KEY,ARCADE_KEY,SHARED,MAXL,LV,levelOf,COS,KIND_NAMES,REWARDS,ACH,achReward,
  defSave,loadSave,cosItem,isUnlocked,unlockText,SPEED_MULT,STAR_XP,DAILY_XP,bestKey,finishRun,applyArcade,summary,shareLine};
