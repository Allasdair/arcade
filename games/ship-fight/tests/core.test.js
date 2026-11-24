const {E,C,ok,section,mem}=require('./lib');
section('Save: an old save missing new fields loads through defSave()',()=>{
  const old={xp:120,ach:{first:1},wins:3,stats:{easy:{played:4,won:3}},sea:'navy'}; // e.g. a save from before Daily Hunt existed
  const S=C.loadSave(mem({[C.KEY]:JSON.stringify(old)}));
  ok(S.xp===120&&S.wins===3&&S.ach.first,'kept existing fields');
  for(const k of Object.keys(C.defSave())) ok(k in S,'missing field after load: '+k);
  ok(S.stats.easy.best===0&&S.stats.hard.played===0,'nested stats filled in'); ok(S.huntLog&&typeof S.huntLog==='object','huntLog filled in');
  ok(C.loadSave(mem({[C.KEY]:'{not json'})).xp===0,'corrupt save falls back to defaults'); });
section('Save: a match resumes mid-game',()=>{
  const m=new E.Match({level:'hard',me:E.randomFleet(E.seedRng('me')),foe:E.randomFleet(E.seedRng('foe')),rng:E.seedRng('r')});
  for(let k=0;k<23;k++){ const free=[]; for(let i=0;i<100;i++) if(!m.foe.shots[i]) free.push(i); m.fire(free[(k*37)%free.length]); m.aiFire(); }
  const S=C.defSave(); S.match=m.toJSON(); const st=mem(); st.setItem(C.KEY,JSON.stringify(S));
  const S2=C.loadSave(st), m2=E.Match.from(S2.match,E.seedRng('r2'));
  ok(m2.shots===m.shots&&m2.hits===m.hits,'shot log restored'); ok(m2.turn==='me'&&m2.state==='play','turn and state restored');
  ok(m2.foe.sunk.join()===m.foe.sunk.join()&&m2.me.sunk.join()===m.me.sunk.join(),'sinks restored');
  ok(Array.from(m2.ai.view).join()===Array.from(m.ai.view).join()&&m2.ai.left.join()===m.ai.left.join(),'AI view restored');
  // the resumed match plays to the end without the AI repeating a shot
  let guard=0; while(m2.state==='play'&&guard++<400){ if(m2.turn==='me'){ const i=[...Array(100).keys()].find(i=>!m2.foe.shots[i]); m2.fire(i); } else { const r=m2.aiFire(); ok(r.res!=='dup','AI repeated a shot after resume'); } }
  ok(m2.state!=='play','resumed match finished'); });
section('Arcade: shared settings and name come from arcade.v1',()=>{
  const own=Object.assign(C.defSave(),{sfx:true,music:true,lang:'auto',appearance:'light',name:'Local',aiSpeed:'slow'});
  const A={set:{appearance:'dark',motion:false,sfx:false,music:false,haptics:false,fullscreen:true,cb:true,lefty:true,lang:'de'},name:'Alasdair'};
  const st=mem({[C.KEY]:JSON.stringify(own),'arcade.v1':JSON.stringify(A)});
  const S=C.loadSave(st,true); for(const k of C.SHARED) ok(S[k]===A.set[k],'shared setting not copied: '+k); ok(S.name==='Alasdair','name not copied');
  ok(S.aiSpeed==='slow','game-only setting must stay the game\'s own');
  ok(st.getItem('arcade.v1')===JSON.stringify(A),'arcade.v1 must never be written');
  const S2=C.loadSave(st,false); ok(S2.appearance==='light'&&S2.name==='Local','standalone keeps its own copies');
  ok(C.loadSave(mem({[C.KEY]:JSON.stringify(own)}),true).sfx===true,'no arcade.v1: keeps own settings'); });
section('Arcade: the summary record has every field',()=>{
  const S=C.defSave(); S.xp=160; S.wins=12; S.stats.hard.won=3; S.huntBest=47; S.ach.first=1;
  const r=C.summary(S);
  for(const k of ['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last']) ok(k in r,'summary missing '+k);
  ok(r.v===1&&r.game==='shipfight'&&r.ver===C.VERSION,'summary header'); ok(r.level===3&&r.xpLevel===150&&r.xpNext===300&&r.maxLevel===10,'summary level fields');
  ok(r.ach.length===C.ACH.length&&r.ach[0][0]==='First Salvo'&&r.ach[0][2]===true&&r.ach[1][2]===false,'summary achievements');
  ok(JSON.stringify(r.hi)===JSON.stringify([['Wins','12'],['Best Daily Hunt','47 shots'],['Hard wins','3']]),'summary highlights: '+JSON.stringify(r.hi));
  S.xp=99999; ok(C.summary(S).xpNext===null&&C.summary(S).level===10,'xpNext is null at max level');
  ok(JSON.stringify(C.summary(C.defSave()).hi[1])==='["Best Daily Hunt","—"]','no hunt yet shows a dash'); });
section('Progression: XP, levels, stars and achievements',()=>{
  ok(C.levelOf(0)===1&&C.levelOf(49)===1&&C.levelOf(50)===2&&C.levelOf(3175)===10&&C.levelOf(1e6)===10,'level curve');
  const f=[{id:'carrier',x:0,y:0,v:0},{id:'dread',x:0,y:2,v:0},{id:'cruiser',x:0,y:4,v:0},{id:'sub',x:0,y:6,v:0},{id:'destroyer',x:0,y:8,v:0}];
  const cells=f.flatMap(s=>E.cellsOf(s)); const S=C.defSave();
  const m=new E.Match({level:'hard',me:f,foe:f}); for(const i of cells){ m.fire(i); if(m.state==='play') m.turn='me'; } // the AI holds fire so the player's fleet stays whole
  ok(m.state==='won'&&m.shots===17&&m.acc===1,'perfect match'); const r=C.recordMatch(S,m);
  ok(r.xp===30&&S.xp===30,'hard win XP'); ok(r.stars.every(Boolean),'perfect match earns 3 stars');
  for(const id of ['first','admiral','sharp','untouched','clean']) ok(S.ach[id],'achievement not earned: '+id);
  ok(!S.ach.laststand,'last stand should need exactly one ship left');
  const m2=new E.Match({level:'easy',me:f,foe:f}); m2.state='lost'; const r2=C.recordMatch(S,m2); ok(r2.xp===0&&S.streak===0,'loss gives 0 XP and ends the streak');
  const S3=C.defSave(); const h=C.recordHunt(S3,'2026-11-23',44,'2026-11-23'); ok(h.xp===40&&h.stars===3&&S3.ach.dcaptain,'Daily Hunt on its day: double XP and Daily Captain');
  ok(C.recordHunt(S3,'2026-11-22',60,'2026-11-23').xp===20&&S3.huntBest===44,'Daily Hunt finished late: normal XP, best kept');
  ok(C.shareLine({level:'hard',won:true,shots:41,stars:2})==='Ship Fight · Hard · Won · 41 shots · ★★☆','share line format');
  for(const [list] of C.KINDS) for(const it of list) ok(!it.req||C.ACH.some(a=>a.id===it.req),'cosmetic unlocked by unknown achievement: '+it.id); });
