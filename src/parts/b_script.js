// ===================== Arcade shell =====================
// The Arcade owns: the player's identity (username, avatar), settings shared by every game, the combined backup,
// play-time stats, Arcade milestones and themes, and the overview. Each game owns its own save, XP, levels and unlocks.
// The Arcade only ever reads a game's summary record, `arcade.summary.<id>`, which the game writes.
// Storage keys are prefixed with the game's id so nothing collides.
const VERSION='0.13', AKEY='arcade.v1';
const GAME_BUILDS=/*GAME_BUILDS*/{}; // filled in by build.py: a hash of each game's page, for "Updated" badges
const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Games registry. A game is a folder with its own index.html; `prefix` is every storage key it may use.
const GAMES=[
  {id:'sweep',name:'Sweep',desc:'No-guess minesweeper',path:'sweep/index.html',prefix:'sweep.',art:'sweep'},
  {id:'shipfight',name:'Ship Fight',desc:'Naval battle vs AI',path:'shipfight/index.html',prefix:'shipfight.',art:'ship'},
  {id:'snake',name:'Snake',desc:'Classic snake, 7 arenas',path:'snake/index.html',prefix:'snake.',art:'snake'},
  {id:'t2048',name:'2048',desc:'Slide, merge, reach 2048',path:'t2048/index.html',prefix:'t2048.',art:'tiles'},
  {id:'linefall',name:'Linefall',desc:'Stack, clear, keep it falling',path:'linefall/index.html',prefix:'linefall.',art:'linefall'},
  {id:'drift',name:'Drift',desc:'Thrust, shoot, clear the field',path:'drift/index.html',prefix:'drift.',art:'drift'},
  {id:'tilecraft',name:'Tilecraft',desc:'Craft words, outscore the rest',path:'tilecraft/index.html',prefix:'tilecraft.',art:'tilecraft'},
  {id:'solitaire',name:'Solitaire',desc:'Every deal winnable',path:'solitaire/index.html',prefix:'solitaire.',art:'solitaire'},
  {id:'mahjong',name:'Mahjong',desc:'Match pairs, clear the stack',path:'mahjong/index.html',prefix:'mahjong.',art:'mahjong'},
  {id:'sudoku',name:'Sudoku',desc:'Pure logic, never a guess',path:'sudoku/index.html',prefix:'sudoku.',art:'sudoku'},
  {id:'chess',name:'Chess',desc:'Play, solve, improve',path:'chess/index.html',prefix:'chess.',art:'chess'},
  {id:'nonogram',name:'Nonograms',desc:'Picture logic puzzles',soon:true,art:'nono'},
];
const LIVE=GAMES.filter(g=>!g.soon), gameById=id=>GAMES.find(g=>g.id===id);

// What's new in the Arcade itself, newest first. Returning players see the entries since their last visit once.
const CHANGES=[
  ['0.13',['New game: Chess']],
  ['0.12',['Your avatar travels with you: Sweep\'s League and challenges and Tilecraft\'s 2-Player games show every player\'s avatar next to their name']],
  ['0.11',['A profile card with a pixel-art avatar and your achievements across every game','Profile: play time, most played game, games played and Arcade milestones','Arcade milestones unlock themes for the Arcade home','Favourite games, sorting, and New / Updated badges','The Arcade\'s own menus in Español, Français, Deutsch and Português','Install Arcade from Settings, and this What\'s new']],
  ['0.10',['New game: Sudoku']],
  ['0.9',['New games: Solitaire and Mahjong']],
  ['0.8',['New game: Tilecraft']],
  ['0.7',['New game: Drift']],
  ['0.6',['New game: Linefall']],
  ['0.5',['New game: 2048']],
  ['0.4',['New game: Snake']],
  ['0.3',['New game: Ship Fight']],
  ['0.2',['Works offline, with safe background updates']],
  ['0.1',['The Arcade: one home for every game, with shared settings and one backup']],
];

const REDUCED=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const defSet=()=>({appearance:'system',motion:!REDUCED,sfx:true,music:true,haptics:true,fullscreen:false,cb:false,lefty:false,lang:'auto'});
const defA=()=>({v:1,name:'',askedName:false,set:defSet(),created:Date.now(),bk:{last:0,later:0},
  avatar:'pad',theme:'classic',fav:[],sort:'recent',known:null,seenBuild:{},seenVer:null,stats:{},days:0,lastDay:'',ms:[],open:null});
const read=k=>{ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } };

// ---------- load, or migrate from an existing Sweep save ----------
let A=read(AKEY), migrated=false, fresh=!A;
if(!A){ A=defA(); const old=read('sweep.v1');
  if(old){ migrated=true; for(const k in A.set) if(k in old) A.set[k]=old[k]; if(old.name) A.name=old.name; } }
A=Object.assign(defA(),A); A.set=Object.assign(defSet(),A.set);
// Games that exist when a player first sees this version aren't "New" to them.
if(!A.known) A.known=LIVE.map(g=>g.id);
if(fresh) A.seenVer=VERSION;
const persist=()=>{ try{ localStorage.setItem(AKEY,JSON.stringify(A)); }catch(e){} };
persist();
const summary=id=>read('arcade.summary.'+id);
const hasSave=g=>{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(g.prefix)) return true; } return false; };

// ---------- language ----------
const LANGS=[['auto','Automatic'],['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['pt','Português (Brasil)']];
const lang=()=>{ let l=A.set.lang; if(!l||l==='auto') l=(navigator.language||'en').slice(0,2).toLowerCase(); return TR[l]?l:'en'; };
// t(english, ...args): the English text is the key; {0}, {1} are filled in. Missing rows fall back to English.
function t(s,...a){ const d=TR[lang()]; let r=(d&&d[s])||s; a.forEach((v,i)=>{ r=r.split('{'+i+'}').join(v); }); return r; }
const plural=(n,one,many)=>t(n===1?one:many,n.toLocaleString(lang()));
function translateStatic(){ $$('[data-t]').forEach(el=>{ if(!el.dataset.en) el.dataset.en=el.textContent; el.textContent=t(el.dataset.en); });
  document.documentElement.lang=lang(); }

// ---------- icons ----------
const P={back:'<path d="M15 18l-6-6 6-6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',chev:'<path d="M9 18l6-6-6-6"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',pen:'<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>'};
const icon=n=>`<svg class="i" viewBox="0 0 24 24">${P[n]}</svg>`;

// ---------- pixel-art avatars ----------
// The avatar set lives in web/avatars.js (served as avatars.js), shared with every game.
const AV=window.ArcadeAvatars, AVATARS=AV.list;
const avatarById=id=>AV.byId(id)||AVATARS[0];
const gameAvatar=id=>AVATARS.find(a=>a.game===id)||AVATARS[0];
const avatarOpen=AV.open;
const avatarSvg=(a,size)=>AV.svg(a,size);

/*ART*/
// ---------- stats: play time, days played ----------
// Launching a game records {id, t}. Back on the Arcade, the session ends at the game's last summary write
// (games write it when leaving and when hidden), or now; capped at 3 hours so an abandoned app can't inflate it.
const todayStr=()=>{ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); };
function settleSession(){ const o=A.open; if(!o) return; A.open=null;
  const s=summary(o.id), now=Date.now(); let end=s&&s.last>o.t?Math.min(s.last,now):now;
  const ms=Math.max(0,Math.min(end-o.t,3*36e5)); const st=A.stats[o.id]||(A.stats[o.id]={time:0,sessions:0,last:0});
  st.time+=ms; st.sessions++; st.last=Math.max(st.last,end); persist(); }
function countDay(){ const d=todayStr(); if(A.lastDay!==d){ A.lastDay=d; A.days=(A.days||0)+1; } }
const fmtTime=ms=>{ const m=Math.round(ms/6e4); if(!ms) return t('{0} min',0); if(m<1) return t('{0} min','<1'); if(m<60) return t('{0} min',m); const h=Math.floor(m/60), r=m%60; return r?t('{0} h {1} min',h,r):t('{0} h',h); };
const lastPlayed=id=>Math.max((A.stats[id]||{}).last||0,(summary(id)||{}).last||0);

// ---------- totals ----------
function totals(){ let got=0,all=0,played=0,time=0;
  LIVE.forEach(g=>{ const s=summary(g.id); time+=(A.stats[g.id]||{}).time||0; if(!s) return; played++;
    got+=s.ach.filter(a=>a[2]).length; all+=s.ach.length; });
  return {got,all,played,time}; }
const ago=ts=>{ const m=(Date.now()-ts)/6e4; if(m<2) return t('just now'); if(m<60) return t('{0} min ago',Math.round(m)); const h=m/60; if(h<24) return t('{0} h ago',Math.round(h)); const d=Math.round(h/24); return d===1?t('yesterday'):t('{0} days ago',d); };

// ---------- themes and milestones ----------
const THEMES=[
  {id:'classic',name:'Classic',light:['#1c1c1e','#fff'],dark:['#f2f2f4','#111214']},
  {id:'mint',name:'Mint',light:['#1f8a6d','#fff'],dark:['#4cc9a0','#0c1f19'],ms:'explorer'},
  {id:'ocean',name:'Ocean',light:['#2563eb','#fff'],dark:['#60a5fa','#0b1324'],ms:'collector'},
  {id:'sunset',name:'Sunset',light:['#e8590c','#fff'],dark:['#ff8c42','#1f0f05'],ms:'regular'},
  {id:'grape',name:'Grape',light:['#7c3aed','#fff'],dark:['#a78bfa','#140b26'],ms:'allrounder'},
  {id:'gold',name:'Gold',light:['#a87a06','#fff'],dark:['#f0c24b','#1d1505'],ms:'globetrotter'},
  {id:'rose',name:'Rose',light:['#db2777','#fff'],dark:['#f472b6','#25091a'],ms:'completionist'},
];
const MILESTONES=[
  {id:'explorer',name:'Explorer',desc:'Play 3 different games',goal:3,val:T=>T.played},
  {id:'collector',name:'Collector',desc:'Earn 25 achievements',goal:25,val:T=>T.got},
  {id:'regular',name:'Regular',desc:'Play on 7 different days',goal:7,val:()=>A.days||0},
  {id:'allrounder',name:'All-rounder',desc:'Reach level 5 in 3 games',goal:3,val:()=>LIVE.filter(g=>{ const s=summary(g.id); return s&&s.level>=5; }).length},
  {id:'globetrotter',name:'Globetrotter',desc:'Play every game',goal:LIVE.length,val:T=>T.played},
  {id:'completionist',name:'Completionist',desc:'Earn 100 achievements',goal:100,val:T=>T.got},
];
const themeOpen=th=>!th.ms||A.ms.includes(th.ms);
// Newly reached milestones are recorded (they stay unlocked) and announced once.
function checkMilestones(){ const T=totals(), fresh=MILESTONES.filter(m=>!A.ms.includes(m.id)&&m.val(T)>=m.goal);
  if(!fresh.length) return; fresh.forEach(m=>A.ms.push(m.id)); persist();
  const m=fresh[0], th=THEMES.find(x=>x.ms===m.id);
  setTimeout(()=>toast(t('Milestone: {0}',t(m.name))+(th?' · '+t('{0} theme unlocked',t(th.name)):'')),700); }

// ---------- appearance ----------
const darkMQ=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
const isDark=()=>A.set.appearance==='dark'||(A.set.appearance==='system'&&darkMQ&&darkMQ.matches);
function applyTheme(){ const d=isDark(), th=THEMES.find(x=>x.id===A.theme&&themeOpen(x))||THEMES[0], [ac,ink]=d?th.dark:th.light, R=document.documentElement;
  R.classList.toggle('dark',d); R.style.colorScheme=d?'dark':'light';
  R.style.setProperty('--accent',ac); R.style.setProperty('--accentInk',ink);
  document.body.classList.toggle('nomotion',!A.set.motion);
  $('meta[name=theme-color]').content=d?'#111214':'#f4f4f1'; }
if(darkMQ){ const f=()=>{ if(A.set.appearance==='system') applyTheme(); }; darkMQ.addEventListener?darkMQ.addEventListener('change',f):darkMQ.addListener(f); }
const buzz=ms=>{ if(A.set.haptics&&navigator.vibrate) try{ navigator.vibrate(ms); }catch(e){} };
let toastT=0; function toast(m,act,fn){ const el=$('#toast'); el.textContent=m;
  if(act){ const b=document.createElement('button'); b.textContent=act; b.style.cssText='margin-left:12px;font-weight:800;text-decoration:underline;color:inherit'; b.onclick=fn; el.appendChild(b); }
  el.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('on'),act?9000:2600); }
// A new version finished downloading in the background. It's already saved for offline use; reloading shows it.
if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('message',e=>{ if(e.data&&e.data.type==='arcade-updated') toast(t('Arcade updated'),t('Reload'),()=>location.reload()); });
// Install: the browser offers it once the app qualifies; Settings shows the row only then.
let installEvt=null;
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installEvt=e; if(cur==='set') renderSettings(); });
addEventListener('appinstalled',()=>{ installEvt=null; toast(t('Arcade installed')); if(cur==='set') renderSettings(); });

// ---------- navigation ----------
let cur='home';
function show(id){ cur=id; $$('.screen').forEach(s=>s.classList.toggle('on',s.id===id));
  if(id==='home') renderHome(); if(id==='prof') renderProfile(); if(id==='ach') renderAch(); if(id==='set') renderSettings(); }
document.addEventListener('click',e=>{ const g=e.target.closest('[data-go]'); if(g) show(g.dataset.go); });
function launch(g,hash){ buzz(12);
  if(!A.known.includes(g.id)) A.known.push(g.id);
  if(GAME_BUILDS[g.id]) A.seenBuild[g.id]=GAME_BUILDS[g.id];
  countDay(); A.open={id:g.id,t:Date.now()}; persist();
  if(A.set.fullscreen&&document.fullscreenEnabled&&!document.fullscreenElement) document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
  try{ sessionStorage.setItem('arcade.nav',g.id); }catch(e){}
  location.href=g.path+(hash||''); }
// Coming back from a game with the Back button restores this page from memory, so refresh what it shows.
addEventListener('pageshow',e=>{ if(e.persisted){ settleSession(); checkMilestones(); show(cur); } });

// ---------- home ----------
function badge(g){ if(!A.known.includes(g.id)) return 'New';
  const b=GAME_BUILDS[g.id], seen=A.seenBuild[g.id];
  if(b&&seen&&seen!==b) return 'Updated';
  if(b&&!seen&&summary(g.id)) A.seenBuild[g.id]=b; // played before badges existed: start tracking from here
  return ''; }
function sortedGames(){ const fav=g=>A.fav.includes(g.id)?0:1;
  return [...LIVE].sort((a,b)=>fav(a)-fav(b)||(A.sort==='az'?a.name.localeCompare(b.name,lang()):(lastPlayed(b.id)-lastPlayed(a.id))||LIVE.indexOf(a)-LIVE.indexOf(b))); }
function renderIdCard(){ const T=totals(), av=avatarById(A.avatar), pct=T.all?Math.round(T.got/T.all*100):0;
  $('#idCard').innerHTML=`${avatarSvg(av,58)}<div class="grow"><div class="t">${A.name?esc(A.name):t('Pick a username')}</div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="s">${T.all?t('{0} of {1} achievements',T.got,T.all):t('Your achievements from every game add up here.')}</div></div><span class="chev">${icon('chev')}</span>`; }
function renderHome(){ const T=totals(); translateStatic(); renderIdCard();
  const due=T.got>0||T.played>=2, last=A.bk.last||0, later=A.bk.later||0;
  $('#nudge').innerHTML=due&&Date.now()-last>30*864e5&&Date.now()-later>7*864e5?`<div class="card" style="flex-direction:column;align-items:stretch;gap:10px"><div><div class="t">${t('Back up your progress')}</div><div class="s">${last?t('Your last backup was {0}.',ago(last)):t('You haven\'t made a backup yet.')} ${t('Everything lives only on this device. One file covers every game.')}</div></div>
    <div style="display:flex;gap:8px"><button class="primary" style="width:auto;padding:10px 16px" id="nbGo">${t('Back up')}</button><button class="ghost" style="width:auto" id="nbLater">${t('Later')}</button></div></div>`:'';
  if($('#nbGo')){ $('#nbGo').onclick=openBackup; $('#nbLater').onclick=()=>{ A.bk.later=Date.now(); persist(); renderHome(); }; }
  $('#sortSeg').innerHTML=[['recent','Recent'],['az','A–Z']].map(([k,n])=>`<button data-sort="${k}" class="${A.sort===k?'on':''}">${t(n)}</button>`).join('');
  $$('[data-sort]').forEach(b=>b.onclick=()=>{ A.sort=b.dataset.sort; persist(); renderHome(); });
  $('#games').innerHTML=sortedGames().map(g=>{ const s=summary(g.id), tag=badge(g), fv=A.fav.includes(g.id);
    let ft;
    if(s){ const span=s.xpNext?s.xpNext-s.xpLevel:1, p=s.xpNext?Math.round((s.xp-s.xpLevel)/span*100):100;
      ft=`<span class="lv">${t('Lv {0}',s.level)}</span><div class="bar"><i style="width:${p}%"></i></div>`; }
    else ft=hasSave(g)?t('Open once to sync'):t('Not played yet');
    const lp=lastPlayed(g.id), sub=lp?t('Played {0}',ago(lp)):t(g.desc);
    return `<div class="game" role="button" tabindex="0" data-g="${g.id}">${tag?`<span class="tag">${t(tag)}</span>`:''}<button class="fav ${fv?'on':''}" data-fav="${g.id}" aria-label="${t('Favourite')}">${icon('star')}</button>
      <div class="art">${art(g.art)}</div><div class="nm">${g.name}</div><div class="ds">${sub}</div><div class="ft">${ft}</div></div>`; }).join('');
  persist();
  $$('.game[data-g]').forEach(b=>b.onclick=e=>{ if(e.target.closest('[data-fav]')) return; launch(gameById(b.dataset.g)); });
  $$('[data-fav]').forEach(b=>b.onclick=()=>{ const id=b.dataset.fav, i=A.fav.indexOf(id); i<0?A.fav.push(id):A.fav.splice(i,1); buzz(8); persist(); renderHome(); });
  const soon=GAMES.filter(g=>g.soon);
  $('#soon').innerHTML=soon.length?`<span>${t('Coming soon')}</span>`+soon.map(g=>`<span class="chip">${g.name}</span>`).join(''):'';
}

// ---------- profile ----------
function renderProfile(){ const T=totals(), av=avatarById(A.avatar);
  const rows=LIVE.map(g=>({g,s:summary(g.id),st:A.stats[g.id]||{time:0,sessions:0}})).filter(r=>r.s||r.st.sessions)
    .sort((a,b)=>b.st.time-a.st.time||lastPlayed(b.g.id)-lastPlayed(a.g.id));
  const top=rows.find(r=>r.st.time>0);
  const since=new Date(A.created).toLocaleDateString(lang(),{month:'long',year:'numeric'});
  $('#profBody').innerHTML=`<div class="phead"><button id="avBtn" aria-label="${t('Change avatar')}">${avatarSvg(av,96)}</button>
      <div class="nmr">${A.name?esc(A.name):t('No username yet')} <button class="linkbtn" id="nmEdit">${A.name?t('Edit'):t('Pick')}</button></div>
      <div class="s">${t('Playing since {0}',since)}</div></div>
    <div class="tiles"><div class="tile"><b>${fmtTime(T.time)}</b><span>${t('Play time')}</span></div>
      <div class="tile"><b>${T.played}<small style="color:var(--sub);font-size:14px">/${LIVE.length}</small></b><span>${t('Games played')}</span></div>
      <div class="tile"><b>${T.got}<small style="color:var(--sub);font-size:14px">/${T.all||'–'}</small></b><span>${t('Achievements')}</span></div>
      <div class="tile"><b>${A.days||0}</b><span>${t('Days played')}</span></div></div>
    ${top?`<button class="card" style="margin-top:10px" data-open="${top.g.id}"><div class="prow" style="padding:0">${avatarSvg(gameAvatar(top.g.id),40)}<div class="grow"><div class="d">${t('Most played')}</div><div class="n">${top.g.name} · ${fmtTime(top.st.time)}</div></div></div></button>`:''}
    <div class="label">${t('Your games')}</div>
    <div class="card" style="flex-direction:column;align-items:stretch;gap:0;padding:4px 16px">${rows.length?rows.map(({g,s,st})=>{ const got=s?s.ach.filter(a=>a[2]).length:0, n=s?s.ach.length:0;
      return `<button class="prow" data-open="${g.id}">${avatarSvg(gameAvatar(g.id),40)}<div class="grow"><div class="n">${g.name}</div>
        <div class="d">${[s?t('Level {0}/{1}',s.level,s.maxLevel):'',st.sessions?plural(st.sessions,'{0} session','{0} sessions'):'',st.time?fmtTime(st.time):''].filter(Boolean).join(' · ')}</div>
        ${n?`<div class="bar"><i style="width:${Math.round(got/n*100)}%"></i></div><div class="d">${t('{0} of {1} achievements',got,n)}</div>`:''}</div></button>`; }).join(''):`<div class="note" style="padding:12px 0">${t('Play a game and it shows up here.')}</div>`}</div>
    <p class="note">${t('Play time counts time spent in a game opened from the Arcade, from version 0.11 on.')}</p>
    <div class="label">${t('Arcade milestones')}<span>${A.ms.length}/${MILESTONES.length}</span></div>
    <div class="card" style="flex-direction:column;align-items:stretch;gap:0;padding:4px 16px">${MILESTONES.map(m=>{ const done=A.ms.includes(m.id), v=Math.min(m.val(T),m.goal), th=THEMES.find(x=>x.ms===m.id);
      return `<div class="ms ${done?'':'off'}"><div class="sw2" style="background:${th?th.light[0]:'var(--accent)'}">${icon(done?'check':'lock')}</div><div class="grow"><div class="n" style="font-weight:700">${t(m.name)}</div>
        <div class="d" style="color:var(--sub);font-size:12.5px">${t(m.desc)}${th?' · '+t('{0} theme',t(th.name)):''}</div></div><b style="font-variant-numeric:tabular-nums;color:var(--sub)">${done?'✓':v+'/'+m.goal}</b></div>`; }).join('')}</div>
    <button class="primary" style="margin-top:14px" data-go="ach">${t('All achievements')}</button>`;
  $('#avBtn').onclick=openAvatars; $('#nmEdit').onclick=()=>askName(true);
  $$('#profBody [data-open]').forEach(b=>b.onclick=()=>launch(gameById(b.dataset.open)));
}
function openAvatars(){ const draw=()=>{ sheet(`<h2>${t('Avatar')}</h2><div class="sub">${t('Each game\'s avatar unlocks once you\'ve played that game.')}</div>
    <div class="avgrid">${AVATARS.map(a=>{ const open=avatarOpen(a), g=a.game&&gameById(a.game);
      return `<button data-av="${a.id}" class="${A.avatar===a.id?'on':''} ${open?'':'lock'}">${avatarSvg(a,64)}${open?'':`<span class="lk">${icon('lock')}</span>`}<span>${g?g.name:t(a.name)}</span></button>`; }).join('')}</div>
    <div class="btns"><button class="ghost" data-close>${t('Close')}</button></div>`);
    $$('[data-av]').forEach(b=>b.onclick=()=>{ const a=avatarById(b.dataset.av);
      if(!avatarOpen(a)){ toast(t('Play {0} to unlock it.',gameById(a.game).name)); return; }
      A.avatar=a.id; persist(); buzz(8); draw(); show(cur); }); };
  draw(); }

// ---------- achievements by game ----------
const openAch=new Set();
function renderAch(){ const T=totals(); $('#achCount').textContent=T.all?`${T.got}/${T.all}`:'';
  $('#achBody').innerHTML=sortedGames().map(g=>{ const s=summary(g.id);
    if(!s) return `<div class="card ach" style="opacity:.55"><div class="hd"><div class="grow"><div class="t">${g.name}</div><div class="s">${t('Play it once to see its achievements here.')}</div></div></div></div>`;
    const got=s.ach.filter(a=>a[2]).length, pct=Math.round(got/s.ach.length*100);
    const rows=[...s.ach].sort((a,b)=>b[2]-a[2]).map(([n,d,ok])=>`<div class="arow ${ok?'got':''}"><div class="dot">${icon(ok?'check':'lock')}</div><div><div class="n">${esc(n)}</div><div class="d">${esc(d)}</div></div></div>`).join('');
    return `<div class="card ach ${openAch.has(g.id)?'open':''}" data-a="${g.id}"><button class="hd"><div class="grow"><div class="t">${g.name}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="s">${t('{0} of {1}',got,s.ach.length)} · ${t('Level {0}/{1}',s.level,s.maxLevel)}</div></div><span class="chev">${icon('chev')}</span></button><div class="list">${rows}
      ${s.hi?`<div class="slabel" style="margin-top:12px">${t('Highlights')}</div>`+s.hi.map(([k,v])=>`<div class="kv">${esc(k)}<span>${esc(v)}</span></div>`).join(''):''}
      <button class="primary" style="margin:12px 0 6px" data-play="${g.id}">${t('Open {0}',g.name)}</button></div></div>`; }).join('');
  $$('.ach .hd').forEach(h=>h.onclick=()=>{ const c=h.parentElement, id=c.dataset.a; c.classList.toggle('open'); c.classList.contains('open')?openAch.add(id):openAch.delete(id); });
  $$('[data-play]').forEach(b=>b.onclick=()=>launch(gameById(b.dataset.play)));
}

// ---------- settings ----------
function renderSettings(){ const S=A.set; translateStatic();
  const sw=(k,l)=>`<button class="srow" data-set="${k}"><span>${t(l)}</span><i class="sw ${S[k]?'on':''}"></i></button>`;
  const more=(id,l,v)=>`<button class="srow" id="${id}"><span>${l}</span><span class="v">${v} ›</span></button>`;
  const ap=[['system','Auto'],['light','Light'],['dark','Dark']].map(([k,n])=>`<button data-ap="${k}" class="${S.appearance===k?'on':''}">${t(n)}</button>`).join('');
  const th=THEMES.find(x=>x.id===A.theme)||THEMES[0], standalone=matchMedia&&matchMedia('(display-mode: standalone)').matches;
  $('#settings').innerHTML=`<div class="slabel">${t('Profile')}</div>`+more('nameBtn',t('Username'),A.name?esc(A.name):t('Not set'))+more('avSet',t('Avatar'),t(avatarById(A.avatar).name))
    +`<div class="slabel">${t('Look & sound')}</div><div class="srow"><span>${t('Appearance')}</span><div class="seg">${ap}</div></div>`
    +more('themeBtn',t('Arcade theme'),t(th.name))
    +sw('motion','Animations')+sw('sfx','Sound effects')+sw('music','Music')+sw('haptics','Vibration')
    +(document.fullscreenEnabled?sw('fullscreen','Full screen (hide phone bars)'):'')
    +`<div class="slabel">${t('Accessibility')}</div>`+sw('cb','Colourblind-safe colours')+sw('lefty','Left-handed controls')
    +more('langBtn',t('Language'),(LANGS.find(l=>l[0]===S.lang)||LANGS[0])[0]==='auto'?t('Automatic'):(LANGS.find(l=>l[0]===S.lang))[1])
    +`<div class="slabel">${t('Game settings')}</div>`+[...LIVE].sort((a,b)=>a.name.localeCompare(b.name,lang())).map(g=>more('gs_'+g.id,g.name,t('Gameplay, tutorial'))).join('')
    +`<div class="slabel">${t('Your data')}</div>`+more('bkBtn',t('Backup & restore'),t('All games'))+more('privBtn',t('Privacy'),'')
    +`<div class="slabel">${t('Arcade')}</div>`+(installEvt&&!standalone?more('instBtn',t('Install Arcade'),t('Play like an app')):'')
    +more('newsBtn',t('What\'s new'),'v'+VERSION)+more('aboutBtn',t('About Arcade'),'');
  $('#nameBtn').onclick=()=>askName(true); $('#avSet').onclick=openAvatars; $('#themeBtn').onclick=openThemes; $('#langBtn').onclick=openLang;
  $('#bkBtn').onclick=openBackup; $('#privBtn').onclick=openPrivacy; $('#aboutBtn').onclick=openAbout; $('#newsBtn').onclick=()=>openNews(false);
  if($('#instBtn')) $('#instBtn').onclick=async()=>{ const e=installEvt; if(!e) return; e.prompt(); try{ await e.userChoice; }catch(x){} installEvt=null; renderSettings(); };
  LIVE.forEach(g=>$('#gs_'+g.id).onclick=()=>launch(g,'#game-settings'));
  $$('[data-ap]').forEach(b=>b.onclick=()=>{ S.appearance=b.dataset.ap; persist(); applyTheme(); renderSettings(); });
  $$('[data-set]').forEach(b=>b.onclick=()=>{ const k=b.dataset.set; S[k]=!S[k]; persist(); if(k==='motion') applyTheme(); if(k==='haptics') buzz(20);
    if(k==='fullscreen'){ if(S.fullscreen) document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{}); else if(document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }
    renderSettings(); });
}
function openThemes(){ const draw=()=>{ sheet(`<h2>${t('Arcade theme')}</h2><div class="sub">${t('Colours for the Arcade\'s own screens. Arcade milestones unlock more.')}</div>
    <div class="thgrid">${THEMES.map(th=>{ const open=themeOpen(th), m=th.ms&&MILESTONES.find(x=>x.id===th.ms);
      return `<button data-th="${th.id}" class="${A.theme===th.id?'on':''} ${open?'':'lock'}"><span class="dot" style="background:${(isDark()?th.dark:th.light)[0]}"></span><span>${t(th.name)}${open?'':`<small>${t(m.desc)}</small>`}</span></button>`; }).join('')}</div>
    <div class="btns"><button class="ghost" data-close>${t('Close')}</button></div>`);
    $$('[data-th]').forEach(b=>b.onclick=()=>{ const th=THEMES.find(x=>x.id===b.dataset.th);
      if(!themeOpen(th)){ toast(t('Unlock it with the {0} milestone.',t(MILESTONES.find(x=>x.id===th.ms).name))); return; }
      A.theme=th.id; persist(); applyTheme(); draw(); renderSettings(); }); };
  draw(); }

// ---------- sheets ----------
function sheet(html){ $('#sheet').innerHTML=html; $('#ov').classList.add('on'); $$('#sheet [data-close]').forEach(b=>b.onclick=hide); }
function hide(){ $('#ov').classList.remove('on'); }
$('#ov').addEventListener('click',e=>{ if(e.target.id==='ov') hide(); });
const cleanName=s=>String(s||'').replace(/[^\p{L}\p{N} _.\-]/gu,'').replace(/\s+/g,' ').trim().slice(0,16);

function askName(fromSettings){ A.askedName=true; persist();
  sheet(`<h2>${A.name?t('Change username'):t('Pick a username')}</h2><div class="sub">${t('One name for every game: on challenges you send and when you join a League. It stays on this device unless you share a code.')}</div>
    <input class="field" id="nm" maxlength="16" placeholder="${t('Your name')}" autocomplete="off" value="${esc(A.name)}">
    <div class="note" style="margin:8px 2px 0">${t('Up to 16 letters, numbers, spaces, dots, dashes or underscores. A League name already locked for this season doesn\'t change until the season ends.')}</div>
    <div class="btns"><button class="primary" id="nmGo">${A.name?t('Save'):t('Continue')}</button><button class="ghost" data-close>${fromSettings?t('Cancel'):t('Later')}</button></div>`);
  const f=$('#nm'); setTimeout(()=>f.focus(),220); f.onkeydown=e=>{ if(e.key==='Enter') $('#nmGo').click(); };
  $('#nmGo').onclick=()=>{ const n=cleanName(f.value); if(!n){ toast(t('Pick a name first.')); f.focus(); return; }
    A.name=n; persist(); hide(); show(cur); toast(t('Welcome, {0}!',n)); };
}
function openLang(){ sheet(`<h2>${t('Language')}</h2><div class="sub">${t('Used by the Arcade and every game.')}</div>
  <div class="pick">${LANGS.map(([k,n])=>`<button data-l="${k}" class="${A.set.lang===k?'on':''}"><span>${k==='auto'?t('Automatic'):n}</span>${A.set.lang===k?icon('check'):''}</button>`).join('')}</div>
  <div class="btns"><button class="ghost" data-close>${t('Close')}</button></div>`);
  $$('[data-l]').forEach(b=>b.onclick=()=>{ A.set.lang=b.dataset.l; persist(); hide(); show(cur); }); }
function openPrivacy(){ sheet(`<h2>${t('Privacy')}</h2><div class="sub">${t('The Arcade and its games collect nothing. There are no ads, analytics, trackers or accounts, and the only network requests are loading the app itself.')}</div>
  <div class="sub">${t('Your progress, settings, username and play-time stats are stored only on this device. Codes you choose to share (challenges, League results, backups) contain only what they say.')}</div>
  <div class="btns"><button class="ghost" data-close>${t('Close')}</button></div>`); }
function openAbout(){ sheet(`<h2>${t('About Arcade')}</h2><div class="sub">${t('A home for ad-free games. Each game keeps its own levels and unlocks; the Arcade holds your profile and the settings they share, and backs everything up in one file.')}</div>
  <div class="kv">${t('Version')}<span>${VERSION}</span></div>${LIVE.map(g=>{ const s=summary(g.id); return `<div class="kv">${g.name}<span>${s?'v'+esc(s.ver):'–'}</span></div>`; }).join('')}
  <div class="slabel" style="margin-top:14px">${t('Credits')}</div>
  <div class="note" style="margin:4px 2px 0">${t('Fonts: Inter, JetBrains Mono and Caveat, under the SIL Open Font License.')}<br>
  ${t('Tilecraft\'s words: the ENABLE word list (public domain). Its filter of offensive words started from the "List of Dirty, Naughty, Obscene and Otherwise Bad Words" by its contributors, under CC BY 4.0.')}<br>
  ${t('Chess puzzles: the Lichess puzzle database (database.lichess.org), public domain (CC0). Thank you, Lichess.')}<br>
  ${t('Arcade and its games are open source under the MIT licence.')}</div>
  <div class="btns"><button class="ghost" data-close>${t('Close')}</button></div>`); }
// What's new: everything after `since` (returning players, once), or the full history from Settings.
function openNews(since){ const list=since?CHANGES.slice(0,Math.max(1,CHANGES.findIndex(c=>c[0]===since))):CHANGES;
  sheet(`<h2>${t('What\'s new')}</h2>${list.map(([v,items])=>`<h3>${t('Version {0}',v)}</h3><ul>${items.map(i=>`<li>${esc(t(i))}</li>`).join('')}</ul>`).join('')}
    <div class="btns"><button class="primary" data-close>${t('Got it')}</button></div>`); }

// ---------- combined backup ----------
// One code holds the Arcade's save plus every key each game owns. Format: ARCADE1Z.<base64url of gzipped JSON>,
// or ARCADE1.<base64url JSON> where the browser can't compress. Restore can bring back everything or one game.
const b64u=b=>{ let s=''; const a=new Uint8Array(b); for(let i=0;i<a.length;i+=0x8000) s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000)); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64u=s=>{ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); };
const pipe=async(bytes,T)=>new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(T)).arrayBuffer());
function ownedKeys(){ const out={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
  if(k&&(k.startsWith('arcade.')||LIVE.some(g=>k.startsWith(g.prefix)))) out[k]=localStorage.getItem(k); } return out; }
async function makeCode(){ const body=JSON.stringify({v:1,app:'arcade',t:Date.now(),keys:ownedKeys()}), raw=new TextEncoder().encode(body);
  if(window.CompressionStream) try{ return 'ARCADE1Z.'+b64u(await pipe(raw,new CompressionStream('gzip'))); }catch(e){}
  return 'ARCADE1.'+b64u(raw); }
async function readCode(txt){ const m=String(txt).match(/ARCADE1Z?\.[A-Za-z0-9_-]+/); if(!m) return null;
  let bytes=unb64u(m[0].slice(m[0].indexOf('.')+1)); if(m[0].startsWith('ARCADE1Z.')) bytes=await pipe(bytes,new DecompressionStream('gzip'));
  const o=JSON.parse(new TextDecoder().decode(bytes)); return o&&o.app==='arcade'&&o.keys?o:null; }
const fmtSize=n=>n<1024?t('{0} bytes',n):t('{0} KB',(n/1024).toFixed(1));
const stamp=()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

async function openBackup(){ const code=await makeCode(), T=totals();
  sheet(`<h2>${t('Backup & restore')}</h2><div class="sub">${t('One file with your profile, settings and every game\'s progress. Keep it somewhere safe, or use it to move to another device.')}</div>
    <div class="kv">${t('Achievements')}<span>${T.got}/${T.all||'–'}</span></div>${LIVE.map(g=>{ const s=summary(g.id); return `<div class="kv">${g.name}<span>${s?t('Level {0}',s.level):t('No progress yet')}</span></div>`; }).join('')}
    <div class="btns"><button class="primary" id="bkFile">${t('Save to file · {0}',fmtSize(code.length))}</button><button class="ghost" id="bkCopy" style="color:var(--ink)">${t('Copy backup code')}</button></div>
    <div class="slabel" style="margin-top:18px">${t('Restore')}</div>
    <textarea class="field" id="rsCode" placeholder="${t('Paste a backup code, or load a file')}" spellcheck="false"></textarea>
    <div class="btns"><button class="ghost" id="rsFile" style="color:var(--ink)">${t('Load from file…')}</button><button class="primary" id="rsGo">${t('Check backup')}</button><button class="ghost" data-close>${t('Close')}</button></div>
    <input type="file" id="rsPick" accept=".txt,text/plain" hidden>`);
  $('#bkFile').onclick=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([code],{type:'text/plain'})); a.download=`arcade-backup-${stamp()}.txt`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); A.bk.last=Date.now(); persist(); toast(t('Backup saved')); };
  $('#bkCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(code); A.bk.last=Date.now(); persist(); toast(t('Backup code copied')); }catch(e){ $('#rsCode').value=code; $('#rsCode').select(); toast(t('Select and copy the code below')); } };
  $('#rsFile').onclick=()=>$('#rsPick').click();
  $('#rsPick').onchange=async e=>{ const f=e.target.files[0]; if(f){ $('#rsCode').value=(await f.text()).trim(); $('#rsGo').click(); } };
  $('#rsGo').onclick=async()=>{ const v=$('#rsCode').value.trim();
    if(/SWEEP1Z?\./.test(v)){ toast(t('That\'s a Sweep-only backup. Restore it in Sweep → Settings.')); return; }
    let o=null; try{ o=await readCode(v); }catch(e){} if(!o){ toast(t('That doesn\'t look like an Arcade backup.')); return; }
    confirmRestore(o); };
}
function confirmRestore(o){ const K=o.keys, sum=id=>{ try{ return JSON.parse(K['arcade.summary.'+id]); }catch(e){ return null; } };
  const inBk=LIVE.filter(g=>Object.keys(K).some(k=>k.startsWith(g.prefix)));
  let pick='all', armed=false;
  const draw=()=>{ sheet(`<h2>${t('Restore backup')}</h2><div class="sub">${t('From {0}. This replaces what\'s on this device for what you pick.',new Date(o.t).toLocaleString(lang(),{dateStyle:'medium',timeStyle:'short'}))}</div>
    <div class="pick"><button data-p="all" class="${pick==='all'?'on':''}"><span>${t('Everything')}<br><small style="color:var(--sub)">${t('Profile, settings and all games')}</small></span>${pick==='all'?icon('check'):''}</button>
    ${inBk.map(g=>{ const s=sum(g.id); return `<button data-p="${g.id}" class="${pick===g.id?'on':''}"><span>${t('Only {0}',g.name)}<br><small style="color:var(--sub)">${s?t('Level {0}',s.level)+' · '+t('{0} achievements',s.ach.filter(a=>a[2]).length):t('Progress inside')}</small></span>${pick===g.id?icon('check'):''}</button>`; }).join('')}</div>
    <div class="btns"><button class="primary" id="rsYes">${armed?t('Tap again to replace'):t('Restore')}</button><button class="ghost" data-close>${t('Cancel')}</button></div>`);
    $$('[data-p]').forEach(b=>b.onclick=()=>{ pick=b.dataset.p; armed=false; draw(); });
    $('#rsYes').onclick=()=>{ if(!armed){ armed=true; draw(); return; } doRestore(K,pick); }; };
  draw(); }
function doRestore(K,pick){ const own=k=>pick==='all'?(k.startsWith('arcade.')||LIVE.some(g=>k.startsWith(g.prefix))):(k.startsWith(gameById(pick).prefix)||k==='arcade.summary.'+pick);
  Object.keys(ownedKeys()).filter(own).forEach(k=>localStorage.removeItem(k));
  Object.entries(K).filter(([k])=>own(k)).forEach(([k,v])=>{ try{ localStorage.setItem(k,v); }catch(e){} });
  if(pick==='all'){ A=Object.assign(defA(),read(AKEY)||{}); A.set=Object.assign(defSet(),A.set); if(!A.known) A.known=LIVE.map(g=>g.id); }
  persist(); hide(); applyTheme(); show('home'); toast(pick==='all'?t('Everything restored'):t('{0} restored',gameById(pick).name)); }

// ---------- start ----------
$('#icoA').innerHTML=icon('trophy'); $('#icoS').innerHTML=icon('gear'); $$('.topbar .iconbtn').forEach(b=>b.innerHTML=icon('back'));
$('#idCard').onclick=()=>show('prof');
settleSession(); applyTheme();
if(location.hash==='#prefs'){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} show('set'); } else show('home');
checkMilestones();
if(!A.name&&!A.askedName) setTimeout(()=>askName(false),migrated?600:350);
else if(migrated) toast(t('Your Sweep progress is here'));
else if(A.seenVer!==VERSION){ const since=A.seenVer; A.seenVer=VERSION; persist(); setTimeout(()=>openNews(since||'0.10'),500); }
