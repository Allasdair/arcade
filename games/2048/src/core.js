// 2048 core: save, XP/levels, stars, bests, undo economy, achievements, cosmetics and the Arcade contract.
// No DOM, so the tests can run it in Node. Every function takes the save object S explicitly.
const VERSION='0.1.0', GAME_ID='t2048', KEY='t2048.v1', SUMKEY='arcade.summary.t2048', ARCKEY='arcade.v1';
const SHARED=['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'];

// ---------- levels: Sweep's first 10 steps (50, 100, 150, 225, 300, 400, 500, 650, 800) ----------
const LV=[0,50,150,300,525,825,1225,1725,2375,3175], MAXL=10;
const levelOf=xp=>{ let l=1; while(l<MAXL&&xp>=LV[l]) l++; return l; };
const xpAt=l=>LV[l-1], xpNext=l=>l>=MAXL?null:LV[l];

// ---------- stars by highest tile, per board (set from the bot sims: see HANDOFF.md) ----------
// ★ ≈ what the corner bot (a casual player) reaches in a small share of games; ★★★ ≈ what the depth-2 expectimax bot
// (a strong player) reaches most of the time, capped so a ★★★ game stays around 2,000–4,000 moves. Sim tables: HANDOFF.md.
const STARS={'3':[64,128,256],'4':[512,1024,2048],'5':[1024,2048,4096],'6':[2048,4096,8192],
  cross:[512,1024,2048],ring:[512,2048,4096],diamond:[1024,2048,4096],swiss:[1024,2048,4096]};
const starsFor=(board,max)=>(STARS[board]||STARS['4']).reduce((n,t)=>n+(max>=t?1:0),0);
const XP_STARS=[0,5,12,25], DAILY_XP=20;

// ---------- cosmetics ----------
// Tile ramps: one colour per power of two (2 … 8192, then the last colour). Our own ramps — none reuse the original 2048's palette.
// Each ramp steps steadily in brightness, so tiles stay distinguishable without colour.
const PALETTES=[
 {id:'warm',name:'Warm',src:'L1',ramp:['#fde7ec','#fbcbd6','#f6a3b8','#ee7a99','#e1527c','#c93a68','#a82f6d','#872b77','#68297e','#4b2a7a','#30286a','#1d1b4c','#120f33']},
 {id:'forest',name:'Forest',src:'L5',ramp:['#e8f3e4','#cfe7c6','#acd6a0','#86c27a','#5fab58','#3f9146','#2c7a44','#1f6342','#164d3d','#103b35','#0b2c2b','#081f21','#051516']},
 {id:'dusk',name:'Dusk',src:'L9',ramp:['#eae8f7','#d3cff0','#b5aee6','#958bd9','#7a6bc9','#6450b6','#523d9c','#432f80','#362566','#2a1d50','#20173d','#17112d','#0f0b1e']},
 {id:'ember',name:'Ember',src:'a2048',ramp:['#fbe9e7','#f6cdc8','#efa79f','#e57d73','#d9564d','#c43a33','#a52a27','#86211f','#681b1a','#4e1616','#391212','#280e0e','#1a0909']},
 {id:'ocean',name:'Ocean',src:'beyond',ramp:['#e3f3f8','#c4e6f1','#9dd4e8','#73bfdc','#4aa7cd','#2f8cba','#2272a1','#1a5b86','#14466c','#103554','#0c2840','#081c2e','#05121f']},
 {id:'neon',name:'Neon',src:'bigleague',dark:true,ramp:['#2a2f45','#323a5c','#22d3ee','#38bdf8','#818cf8','#a78bfa','#e879f9','#f472b6','#fb7185','#facc15','#a3e635','#34d399','#ffffff']},
 {id:'mono',name:'Mono',src:'notakes',ramp:['#f2f2f2','#dedede','#c4c4c4','#a8a8a8','#8c8c8c','#727272','#5a5a5a','#454545','#333333','#242424','#171717','#0d0d0d','#000000']},
 {id:'pastel',name:'Pastel',src:'shapes',ramp:['#fdf0f3','#fbe3d4','#f6efc4','#dff0c8','#c8ecd9','#c5e6f0','#cfd8f6','#dccff4','#efcdf0','#f2b8cf','#e7a3b0','#d690a6','#b97a9b']}];
const TSHAPES=[{id:'round',name:'Rounded',src:'L1'},{id:'square',name:'Square',src:'L2'},{id:'circle',name:'Circle',src:'small'}];
const FONTS=[{id:'inter',name:'Inter',src:'L1',css:'Inter,system-ui,sans-serif'},{id:'mono',name:'JetBrains Mono',src:'L3',css:'"JetBrains Mono",ui-monospace,monospace'},
  {id:'caveat',name:'Caveat',src:'corner',css:'Caveat,cursive'}];
// Board themes are the board's own colours; dark mode never changes them (Sweep's rule).
const BTHEMES=[
 {id:'clean',name:'Clean',src:'L1',board:'#e6e7ec',cell:'#d4d6de',wall:'transparent',glow:'#e1527c'},
 {id:'midnight',name:'Midnight',src:'L4',dark:true,board:'#171a2b',cell:'#232842',wall:'transparent',glow:'#818cf8'},
 {id:'slate',name:'Slate',src:'L8',board:'#3a4250',cell:'#4a5363',wall:'transparent',glow:'#9ec5ff'},
 {id:'paper',name:'Paper',src:'devotee',board:'#f6f3ec',cell:'#e9e4d8',wall:'transparent',glow:'#a82f6d',lines:true},
 {id:'gold',name:'Gold',src:'L10',board:'#2a2418',cell:'#3b3322',wall:'transparent',glow:'#f5c542',rim:'#c9a23a'}];
const FXS=[{id:'none',name:'None',src:'L1'},{id:'confetti',name:'Confetti',src:'L6'},{id:'fireworks',name:'Fireworks',src:'regular'},{id:'starfall',name:'Starfall',src:'L10'}];
const SOUNDS=[{id:'soft',name:'Soft',src:'L1'},{id:'chip',name:'Chiptune',src:'L7'}];
const TRACKS=[{id:'day',name:'Daylight',src:'L1'}];
const KINDS=[['pal',PALETTES,'palette'],['shape',TSHAPES,'tiles'],['font',FONTS,'numbers'],['bt',BTHEMES,'board'],['fx',FXS,'effect'],['sound',SOUNDS,'sounds'],['track',TRACKS,'soundtrack']];
const ALLC=()=>KINDS.flatMap(([k,list,kind])=>list.map(c=>Object.assign({kind,key:k},c)));
const REWARDS={}; for(const c of ALLC()) if(/^L\d+$/.test(c.src)&&c.src!=='L1'){ const l=+c.src.slice(1); (REWARDS[l]=REWARDS[l]||[]).push(`${c.name} ${c.kind}`); }
REWARDS[1]=['Starting kit: Warm palette, Rounded tiles, Inter numbers, Clean board'];

// ---------- achievements ----------
const ACH=[
 {id:'first',name:'First Merge',desc:'Finish a game'},
 {id:'a2048',name:'2048!',desc:'Make a 2048 tile on 4×4'},
 {id:'beyond',name:'Beyond',desc:'Make a 4096 tile'},
 {id:'bigleague',name:'Big League',desc:'Make an 8192 tile'},
 {id:'small',name:'Small Wonder',desc:'Make a 512 tile on 3×3'},
 {id:'notakes',name:'No Take-Backs',desc:'Make 2048 on 4×4 with no undo'},
 {id:'corner',name:'Corner Keeper',desc:'Keep your highest tile in one corner for 200 moves in a row'},
 {id:'shapes',name:'Shape Shifter',desc:'1 star on every shaped board'},
 {id:'devotee',name:'Daily Devotee',desc:'3 stars on a Daily Board'},
 {id:'regular',name:'Regular',desc:'Finish 50 games'}];
const achReward=id=>ALLC().filter(c=>c.src===id).map(c=>`${c.name} ${c.kind}`).join(', ');
const owned=(S,c)=>{ if(c.src==='L1') return true; if(/^L\d+$/.test(c.src)) return levelOf(S.xp)>=+c.src.slice(1); return !!S.ach[c.src]; };
const pick=(S,key)=>{ const list=KINDS.find(k=>k[0]===key)[1], it=list.find(x=>x.id===S[key]); return it&&owned(S,it)?it:list[0]; };

// ---------- save ----------
function defSave(){ return {v:1,xp:0,ach:{},
  // settings: the shared ones (SHARED) are this game's standalone values; in Arcade, Arcade's are used in memory only
  appearance:'system',motion:true,sfx:true,music:false,haptics:true,fullscreen:false,cb:false,lefty:false,lang:'auto',name:'',
  speed:'normal',confirmNew:true,showMoves:true,
  pal:'warm',shape:'round',font:'inter',bt:'clean',fx:'none',sound:'soft',track:'day',
  board:'4',undos:3,undoDate:'',games:0,best:{},bestTile:{},bestA:{},bestTileA:{},shapeStars:{},stars:{},
  game:null,daily:null,dailyBest:null,dailyBestTile:0,dailyCount:0,seenVer:'',bk:{last:0,nudged:0},secs:0}; }
function loadSave(raw){ let o=null; try{ o=typeof raw==='string'?JSON.parse(raw):raw; }catch(e){ o=null; }
  const S=Object.assign(defSave(),o&&typeof o==='object'?o:{});
  for(const k of ['ach','best','bestTile','bestA','bestTileA','shapeStars','stars']) if(!S[k]||typeof S[k]!=='object') S[k]={};
  S.bk=Object.assign({last:0,nudged:0},S.bk||{}); if(typeof S.xp!=='number'||!(S.xp>=0)) S.xp=0;
  if(!/^([3-6]|cross|ring|diamond|swiss)$/.test(String(S.board))) S.board='4';
  return S; }

// ---------- undo economy: daily cap 3, refilled each day; earned extras stack above it up to 99 ----------
const UNDO_CAP=3;
function refreshUndos(S,today){ if(S.undoDate!==today){ S.undos=Math.max(S.undos|0,UNDO_CAP); S.undoDate=today; return true; } return false; }
const earnUndo=(S,n)=>{ S.undos=Math.min(99,(S.undos|0)+n); };
function spendUndo(S){ if((S.undos|0)<1) return false; S.undos--; return true; }

// ---------- XP and achievements ----------
function grantXP(S,n){ const before=levelOf(S.xp); S.xp+=n; const ups=[]; for(let l=before+1;l<=levelOf(S.xp);l++) ups.push(l);
  if(ups.length) earnUndo(S,ups.length); return ups; }
function award(S,id,got){ if(S.ach[id]) return; S.ach[id]=Date.now(); got.push(id); }
// Checked after every move (tile achievements) and again when a game ends.
function checkAch(S,G,ended){ const got=[], sq=G.board==='4';
  if(sq&&G.max>=2048){ award(S,'a2048',got); if(!G.undos) award(S,'notakes',got); }
  if(G.max>=4096) award(S,'beyond',got); if(G.max>=8192) award(S,'bigleague',got);
  if(G.board==='3'&&G.max>=512) award(S,'small',got);
  if(G.cornerBest>=200) award(S,'corner',got);
  if(ended){ award(S,'first',got); if(S.games>=50) award(S,'regular',got);
    if(['cross','ring','diamond','swiss'].every(b=>(S.shapeStars[b]|0)>=1)) award(S,'shapes',got); }
  return got; }
// A game has ended (game over, or the player started another / left a Daily for the next day).
function finishGame(S,G,today){
  const assisted=G.undos>0, st=starsFor(G.board,G.max), r={stars:st,assisted,xp:0,ups:[],ach:[],newBest:false,newTile:false,daily:!!G.daily,undoEarned:0};
  S.games++;
  if(G.daily){ r.xp=DAILY_XP*(G.daily===today?2:1); S.dailyCount++;
    if(S.dailyBest==null||G.score>S.dailyBest){ r.newBest=S.dailyBest!=null; S.dailyBest=G.score; }
    if(G.max>S.dailyBestTile) S.dailyBestTile=G.max;
    if(st===3){ earnUndo(S,1); r.undoEarned=1; award(S,'devotee',r.ach); } }
  else { r.xp=XP_STARS[st]; const b=G.board, bk=assisted?'bestA':'best', tk=assisted?'bestTileA':'bestTile';
    if(S[bk][b]==null||G.score>S[bk][b]){ r.newBest=S[bk][b]!=null&&G.score>0; S[bk][b]=G.score; }
    if(!S[tk][b]||G.max>S[tk][b]){ r.newTile=!!S[tk][b]; S[tk][b]=G.max; }
    if(st>(S.stars[b]|0)) S.stars[b]=st;
    if(['cross','ring','diamond','swiss'].includes(b)&&st>(S.shapeStars[b]|0)) S.shapeStars[b]=st; }
  r.ups=grantXP(S,r.xp); r.undoEarned+=r.ups.length;
  r.ach.push(...checkAch(S,G,true));
  return r; }

// ---------- Arcade contract ----------
// Reads arcade.v1 (never writes it). Returns the shared settings and name to use in memory.
function applyArcade(arcRaw){ let a=null; try{ a=typeof arcRaw==='string'?JSON.parse(arcRaw):arcRaw; }catch(e){ a=null; }
  const out={}; if(a&&a.set&&typeof a.set==='object') for(const k of SHARED) if(a.set[k]!==undefined) out[k]=a.set[k];
  if(a&&typeof a.name==='string') out.name=a.name; return out; }
const fmtN=n=>Number(n||0).toLocaleString('en-US');
function bestTileAll(S){ let m=0; for(const o of [S.bestTile,S.bestTileA]) for(const k in o) if(o[k]>m) m=o[k]; return Math.max(m,S.dailyBestTile|0); }
function summary(S){ const l=levelOf(S.xp);
  return {v:1,game:GAME_ID,ver:VERSION,level:l,maxLevel:MAXL,xp:S.xp,xpLevel:xpAt(l),xpNext:xpNext(l),
    ach:ACH.map(a=>[a.name,a.desc,!!S.ach[a.id]]),
    hi:[['Best tile',bestTileAll(S)?fmtN(bestTileAll(S)):'—'],['Best score (4×4)',S.best['4']!=null?fmtN(S.best['4']):'—'],['Daily best',S.dailyBest!=null?fmtN(S.dailyBest):'—']],
    last:Date.now()}; }

// ---------- share line ----------
const BNAME={'3':'3×3','4':'4×4','5':'5×5','6':'6×6',cross:'Cross',ring:'Ring',diamond:'Diamond',swiss:'Swiss Cheese'};
const starStr=n=>'★'.repeat(n)+'☆'.repeat(3-n);
const shareLine=G=>`2048 · ${G.daily?'Daily '+G.daily:BNAME[G.board]} · ${fmtN(G.max)} tile · ${fmtN(G.score)} · ${starStr(starsFor(G.board,G.max))}${G.undos?' · assisted':''}`;

if(typeof module!=='undefined') module.exports={VERSION,GAME_ID,KEY,SUMKEY,ARCKEY,SHARED,LV,MAXL,levelOf,xpAt,xpNext,STARS,starsFor,XP_STARS,DAILY_XP,
  PALETTES,TSHAPES,FONTS,BTHEMES,FXS,SOUNDS,TRACKS,KINDS,ALLC,REWARDS,ACH,achReward,owned,pick,defSave,loadSave,UNDO_CAP,refreshUndos,earnUndo,spendUndo,
  grantXP,checkAch,finishGame,applyArcade,summary,shareLine,starStr,BNAME,fmtN};
