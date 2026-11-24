const {E,ok,section}=require('./lib');
const FP={'2026-11-23':'a90a39a6','2027-01-01':'fe8afb22'};
const SIMS=process.env.QUICK?1000:10000;
section('Placement: Random always gives a legal fleet',()=>{
  const rng=E.seedRng('place'); for(let k=0;k<5000;k++){ const f=E.randomFleet(rng); ok(E.checkFleet(f).ok,'random fleet #'+k+' illegal'); if(!E.checkFleet(f).ok) break; } });
section('Placement: illegal layouts are rejected',()=>{
  const good=[{id:'carrier',x:0,y:0,v:0},{id:'dread',x:0,y:1,v:0},{id:'cruiser',x:0,y:2,v:0},{id:'sub',x:0,y:3,v:0},{id:'destroyer',x:0,y:4,v:0}];
  ok(E.checkFleet(good).ok,'touching ships should be allowed (classic rule)');
  const mod=(i,o)=>good.map((s,k)=>k===i?Object.assign({},s,o):s);
  ok(E.checkFleet(mod(0,{x:6})).why==='off','carrier off the right edge not rejected');
  ok(E.checkFleet(mod(1,{y:7,v:1})).why==='off','vertical dreadnought off the bottom not rejected');
  ok(E.checkFleet(mod(2,{x:-1})).why==='off','negative x not rejected');
  ok(E.checkFleet(mod(4,{y:0,x:3})).why==='overlap','overlap not rejected');
  ok(E.checkFleet(mod(4,{x:9,y:0,v:1,id:'sub'})).why==='ship','duplicate ship not rejected');
  ok(E.checkFleet(good.slice(0,4)).why==='count','missing ship not rejected');
  ok(E.checkFleet(mod(3,{x:1.5})).why==='off','non-integer position not rejected');
  ok(E.canPlace(good,{id:'destroyer',x:8,y:9,v:0})&&!E.canPlace(good,{id:'destroyer',x:9,y:9,v:0}),'canPlace edge check'); });
section('Rules: hits, misses, sinks, win; repeat shots refused',()=>{
  const f=[{id:'carrier',x:0,y:0,v:0},{id:'dread',x:0,y:2,v:0},{id:'cruiser',x:0,y:4,v:0},{id:'sub',x:0,y:6,v:0},{id:'destroyer',x:0,y:8,v:0}];
  const s=new E.Sea(f); ok(s.fire(10).res==='miss','miss'); ok(s.fire(10).res==='dup','repeat shot not refused'); ok(s.fire(-1).res==='dup'&&s.fire(100).res==='dup','off-board shot not refused');
  ok(s.fire(80).res==='hit','hit'); const r=s.fire(81); ok(r.res==='sunk'&&r.id==='destroyer'&&r.cells.join()==='80,81'&&r.len===2,'sink announces ship and cells');
  ok(!s.dead&&s.afloat===4,'afloat count');
  for(const sh of f) for(const c of E.cellsOf(sh)) s.fire(c); ok(s.dead&&s.sunk.length===5,'all sunk = dead');
  const m=new E.Match({level:'easy',me:E.randomFleet(),foe:f}); ok(m.turn==='me','player fires first');
  ok(m.aiFire()===null,'AI cannot fire on the player\'s turn'); m.fire(99); ok(m.turn==='ai'&&m.fire(98).res==='turn','one shot per turn');
  m.aiFire(); ok(m.turn==='me','back to the player'); ok(m.fire(99).res==='dup'&&m.turn==='me','repeat shot refused and turn kept'); });
section('Clean Sink: no misses between first and last hit',()=>{
  const f=[{id:'carrier',x:0,y:0,v:0},{id:'dread',x:0,y:2,v:0},{id:'cruiser',x:0,y:4,v:0},{id:'sub',x:0,y:6,v:0},{id:'destroyer',x:0,y:8,v:0}];
  const play=seq=>{ const m=new E.Match({level:'easy',me:E.randomFleet(),foe:f}); let r; for(const i of seq){ r=m.fire(i); m.aiFire(); } return r; };
  ok(play([99,40,41,42]).clean===true,'clean sink not detected'); ok(play([40,99,41,42]).clean===false,'miss in between not caught');
  ok(play([40,0,41,42]).clean===true,'a hit on another ship in between still counts as clean'); });
section('AI never fires twice and never reads the player\'s fleet',()=>{
  for(const lv of E.LEVELS){ const rng=E.seedRng('dup'+lv); for(let g=0;g<300;g++){ let err=null; try{ E.simShots(lv,E.randomFleet(rng),rng); }catch(e){ err=e; } ok(!err,`${lv}: ${err&&err.message}`); if(err) break; } }
  // The AI only gets shot results: two different fleets that give identical results so far get identical choices.
  for(const lv of E.LEVELS){ let same=0; for(let t=0;t<200;t++){ const fa=E.randomFleet(E.seedRng('a'+t)), A=new E.Sea(fa), ai=new E.AI(lv,E.seedRng('x'+t));
      for(let k=0;k<12;k++){ const i=ai.next(); ai.observe(i,A.fire(i)); }
      const B=new E.AI(lv,E.seedRng('y'),JSON.parse(JSON.stringify(ai.toJSON()))); B.rng=E.seedRng('z'+t); const ai2=new E.AI(lv,E.seedRng('z'+t),ai.toJSON());
      if(ai2.next()===B.next()) same++; }
    ok(same===200,`${lv}: choice depends on something other than its view`); }
  const ai=new E.AI('hard'); ok(Object.keys(ai.toJSON()).sort().join()==='focus,left,level,view','AI state holds only its own view');
  const m=new E.Match({level:'hard',me:E.randomFleet(),foe:E.randomFleet()}); ok(!Object.values(m.ai).some(v=>v instanceof E.Sea),'AI holds no reference to a sea'); });
const band={easy:[85,100],normal:[52,66],hard:[40,50]}, avg={};
section(`AI strength: ${SIMS.toLocaleString()}-game sims per level`,()=>{
  for(const lv of E.LEVELS){ const rng=E.seedRng('band'+lv); let s=0; for(let g=0;g<SIMS;g++) s+=E.simShots(lv,E.randomFleet(rng),rng);
    avg[lv]=s/SIMS; ok(avg[lv]>=band[lv][0]&&avg[lv]<=band[lv][1],`${lv} averages ${avg[lv].toFixed(1)} shots, outside ${band[lv]}`); }
  console.log(`  average shots to win: Easy ${avg.easy.toFixed(1)} · Normal ${avg.normal.toFixed(1)} · Hard ${avg.hard.toFixed(1)}`); });
section('Daily Hunt: same date gives the same fleet (120 days)',()=>{
  const prints=new Set(); let d0=E.dayNo('2026-11-23');
  for(let d=d0;d<d0+120;d++){ const date=E.dayDate(d), a=E.huntFleet(date), b=E.huntFleet(date); ok(E.checkFleet(a).ok,date+' illegal');
    ok(JSON.stringify(a)===JSON.stringify(b),date+' differs between runs'); prints.add(E.fleetPrint(a)); }
  ok(prints.size>=118,'daily fleets repeat too often');
  // Fixed fingerprints: if these change, every device would get a different fleet than older builds
  ok(E.fleetPrint(E.huntFleet('2026-11-23'))===FP['2026-11-23'],'fingerprint for 2026-11-23 changed: '+E.fleetPrint(E.huntFleet('2026-11-23')));
  ok(E.fleetPrint(E.huntFleet('2027-01-01'))===FP['2027-01-01'],'fingerprint for 2027-01-01 changed: '+E.fleetPrint(E.huntFleet('2027-01-01')));
  ok(E.dayDate(E.dayNo('2026-02-28')+1)==='2026-03-01','day arithmetic'); });
section('Daily Hunt par (what the AI levels score on daily fleets)',()=>{
  const d0=E.dayNo('2026-11-23'), res={}; for(const lv of ['normal','hard']){ const a=[]; for(let d=d0;d<d0+120;d++) for(let k=0;k<20;k++) a.push(E.simShots(lv,E.huntFleet(E.dayDate(d)),E.seedRng(lv+d+'.'+k)));
    a.sort((x,y)=>x-y); res[lv]={avg:a.reduce((x,y)=>x+y)/a.length,stars:[1,2,3].map(n=>a.filter(v=>E.huntStars(v)>=n).length/a.length)}; }
  console.log(`  Normal play: ${res.normal.avg.toFixed(1)} shots, ★ ${pct(res.normal.stars[0])} ★★ ${pct(res.normal.stars[1])} ★★★ ${pct(res.normal.stars[2])}`);
  console.log(`  Hard play:   ${res.hard.avg.toFixed(1)} shots, ★ ${pct(res.hard.stars[0])} ★★ ${pct(res.hard.stars[1])} ★★★ ${pct(res.hard.stars[2])}`);
  ok(res.hard.stars[2]>.2&&res.hard.stars[2]<.8,'3 stars should be possible but not automatic for strong play');
  ok(E.huntStars(45)===3&&E.huntStars(46)===2&&E.huntStars(70)===1&&E.huntStars(71)===0,'star thresholds'); });
function pct(v){ return Math.round(v*100)+'%'; }

