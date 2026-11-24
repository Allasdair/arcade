const {E,C,ok,section}=require('./lib');
const COMBOS=[]; for(const sea of E.SHAPE_IDS) for(const fleet of E.FLEET_IDS) for(const touch of [true,false]) COMBOS.push({sea,fleet,touch});
section(`Modifiers: random fleets are legal on all ${COMBOS.length} combinations`,()=>{
  for(const md of COMBOS){ const rng=E.seedRng(JSON.stringify(md)); for(let k=0;k<60;k++){ const R=E.makeRules(md,rng), f=E.randomFleet(R,rng), c=E.checkFleet(f,R);
    ok(c.ok,`${JSON.stringify(md)} #${k}: ${c.why}`); if(!c.ok) break; } } });
section('Modifiers: land, touching and fleet size are enforced',()=>{
  const A=E.makeRules({sea:'atoll'}); ok(!A.mask[5*11+5]&&!A.mask[0]&&A.mask[5],'atoll mask: island in the middle, corners dry');
  ok(!E.fits({id:'destroyer',x:4,y:5,v:0},A),'ship on land accepted');
  const X=E.makeRules({sea:'cross'}); ok(!E.fits({id:'destroyer',x:0,y:0,v:0},X)&&E.fits({id:'carrier',x:0,y:4,v:0},X),'cross mask');
  const T=E.makeRules({touch:false}), f=[{id:'carrier',x:0,y:0,v:0},{id:'dread',x:0,y:2,v:0},{id:'cruiser',x:0,y:4,v:0},{id:'sub',x:0,y:6,v:0},{id:'destroyer',x:0,y:8,v:0}];
  ok(E.checkFleet(f,T).ok,'gap of one row should be legal without touching');
  ok(E.checkFleet(f.map((s,k)=>k===4?Object.assign({},s,{y:7}):s),T).why==='touch','touching ships accepted with no-touch rule');
  ok(E.checkFleet(f.map((s,k)=>k===4?{id:'destroyer',x:3,y:7,v:0}:s),T).why==='touch','diagonal touch accepted with no-touch rule');
  ok(E.checkFleet(f.map((s,k)=>k===4?Object.assign({},s,{y:7}):s)).ok,'touching should be fine under classic rules');
  const L=E.makeRules({fleet:'light'}); ok(E.checkFleet(f,L).why==='count'&&L.fleet.length===3&&E.makeRules({fleet:'armada'}).fleet.length===7,'fleet sizes');
  const S=new E.Sea(f,null,A); ok(S.fire(5*11+5).res==='dup','firing at land not refused'); });
section('No touching: a sink clears the water around it for both sides',()=>{
  const T=E.makeRules({touch:false}), f=[{id:'carrier',x:0,y:0,v:0},{id:'dread',x:0,y:2,v:0},{id:'cruiser',x:0,y:4,v:0},{id:'sub',x:0,y:6,v:0},{id:'destroyer',x:5,y:8,v:0}];
  const s=new E.Sea(f,null,T), ai=new E.AI('hard',Math.random,null,T); let r; for(const i of [85,86]){ r=s.fire(i); ai.observe(i,r); }
  ok(r.res==='sunk'&&r.ring.length===10,'ring of 10 cells around a mid-sea destroyer, got '+(r.ring&&r.ring.length));
  ok(r.ring.every(i=>s.clear[i]&&!s.canFire(i)),'cleared cells can still be fired at'); ok(r.ring.every(i=>ai.view[i]===1),'AI did not learn the cleared ring');
  ok(s.shots.filter(Boolean).length===2,'clearing must not count as shots'); });
section('Modifiers: the AI never fires at land, cleared or used cells (every combination)',()=>{
  for(const md of COMBOS) for(const lv of E.LEVELS){ const rng=E.seedRng('ai'+lv+JSON.stringify(md)); for(let g=0;g<6;g++){ const R=E.makeRules(md,rng); let err=null;
    try{ E.simShots(lv,E.randomFleet(R,rng),rng,R); }catch(e){ err=e; } ok(!err,`${lv} ${JSON.stringify(md)}: ${err&&err.message}`); if(err) break; } } });
section('Modifiers: matches save and resume with their rules (islands included)',()=>{
  const R=E.makeRules({sea:'isles',fleet:'armada',touch:false},E.seedRng('isl')), m=new E.Match({level:'normal',R,me:E.randomFleet(R,E.seedRng('a')),foe:E.randomFleet(R,E.seedRng('b'))});
  for(let k=0;k<30&&m.state==='play';k++){ const f=[...Array(R.N).keys()].filter(i=>m.foe.canFire(i)); m.fire(f[(k*13)%f.length]); m.aiFire(); }
  const j=JSON.parse(JSON.stringify(m.toJSON())), m2=E.Match.from(j);
  ok(m2.R.W===10&&m2.R.fleet.length===7&&!m2.R.touch,'rules restored'); ok(Array.from(m2.R.mask).join()===Array.from(R.mask).join(),'island mask restored');
  ok(Array.from(m2.foe.clear).join()===Array.from(m.foe.clear).join(),'cleared water restored'); ok(m2.shots===m.shots,'shots restored');
  const old={level:'easy',me:{ships:E.randomFleet(),shots:[]},foe:{ships:E.randomFleet(),shots:[]},turn:'me',state:'play',log:[]}; // a save from before modifiers
  const m3=E.Match.from(old); ok(E.isClassic(m3.R)&&m3.R.W===10,'old match loads as classic'); });
section('Hit-rate star target scales with how crowded the sea is',()=>{
  ok(E.accTarget('hard')===.5&&E.accTarget('easy')===.35,'classic targets unchanged');
  ok(E.accTarget('normal',E.makeRules({sea:'ocean',fleet:'light'}))<.45&&E.accTarget('normal',E.makeRules({sea:'strait',fleet:'armada'}))>.45,'targets move with density'); });
section('Battle XP scales with fleet size',()=>{
  ok(C.battleXP('easy',E.makeRules({fleet:'light'}))===5&&C.battleXP('hard',E.CLASSIC_RULES)===30&&C.battleXP('hard',E.makeRules({fleet:'armada'}))===40,'battle XP'); });
section('Campaigns: 3 × 10 playable levels that get harder',()=>{
  ok(C.CAMPS.length===3&&C.CAMPS.every(c=>c.levels.length===10),'3 campaigns of 10');
  const rank={easy:0,normal:1,hard:2};
  C.CAMPS.forEach((c,k)=>{ ok(c.levels.slice(0,8).every(l=>rank[l.ai]===k),c.id+': first 8 levels use its own AI'); ok(rank[c.levels[9].ai]===Math.min(2,k+1),c.id+': last level prepares for the next AI');
    c.levels.forEach((l,i)=>{ const rng=E.seedRng(c.id+i); for(let t=0;t<10;t++){ const R=E.makeRules(l.mods,rng); ok(E.checkFleet(E.randomFleet(R,rng),R).ok,`${c.id} ${i+1} can't be set up`); } }); });
  ok(C.CAMPS.flatMap(c=>c.levels).filter(l=>Object.keys(l.mods).length).length>=24,'most levels should have a twist'); });
section('Campaigns: unlocking, star XP and completion',()=>{
  const S=C.defSave(); ok(C.levelOpen(S,'easy',0)&&!C.levelOpen(S,'easy',1)&&!C.campOpen(S,'normal'),'start: only Coastal Waters level 1 open');
  let r=C.recordCampaign(S,'easy',0,2); ok(r.xp===10&&r.newStars===2&&C.levelOpen(S,'easy',1),'2 stars: 10 XP and the next level opens');
  r=C.recordCampaign(S,'easy',0,1); ok(r.xp===0&&S.camp.easy[0]===2,'fewer stars on a replay: no XP, best kept');
  r=C.recordCampaign(S,'easy',0,3); ok(r.xp===5,'only the new star pays');
  for(let i=1;i<9;i++) C.recordCampaign(S,'easy',i,3); r=C.recordCampaign(S,'easy',9,3);
  ok(r.done&&r.xp===15+50&&S.ach.ensign&&S.ach.voyage&&C.campOpen(S,'normal'),'finishing: bonus, Ensign, Perfect Voyage, next campaign');
  ok(C.recordCampaign(S,'easy',9,3).xp===0,'finishing bonus is paid once');
  const R=E.makeRules(C.CAMPS[1].levels[3].mods), m=new E.Match({level:'normal',R,me:E.randomFleet(R),foe:E.randomFleet(R),camp:{c:'normal',i:3}}); m.state='won'; m.log=[[0,'h']];
  const S2=C.defSave(), o=C.recordMatch(S2,m); ok(o.xp===24&&S2.camp.normal[3]===3&&S2.stats.normal.best===0,'campaign match: star XP, not battle XP, and no "best" on twisted rules');
  ok(C.shareLine({camp:{c:'normal',i:3},won:true,shots:41,stars:2})==='Ship Fight · Open Seas 4 · Won · 41 shots · ★★☆','campaign share line');
  ok(C.shareLine({level:'hard',mods:{sea:'atoll',fleet:'armada',touch:false},won:true,shots:41,stars:2})==='Ship Fight · Hard · Atoll · Armada fleet · No touching · Won · 41 shots · ★★☆','battle share line with modifiers');
  for(const [list] of C.KINDS) for(const it of list) ok(!it.req||C.ACH.some(a=>a.id===it.req),'cosmetic unlocked by unknown achievement: '+it.id);
  for(const t of C.SEAS) ok(t.land&&t.landEdge,'sea theme has no land colour: '+t.id); });
