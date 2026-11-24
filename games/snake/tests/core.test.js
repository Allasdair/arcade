const E=require('../src/engine.js'), C=require('../src/core.js');
const fresh=()=>C.defSave();
test('levels: Sweep steps, max 10',()=>{ eq(C.levelOf(0),{level:1,xpLevel:0,xpNext:50}); eq(C.levelOf(50).level,2); eq(C.levelOf(149).level,2); eq(C.levelOf(3175),{level:10,xpLevel:3175,xpNext:null}); eq(C.levelOf(99999).level,10); });
test('every level from 2 to 10 has a reward',()=>{ for(let l=2;l<=10;l++) ok(C.REWARDS[l]&&C.REWARDS[l].length,'level '+l); });
test('every achievement except First Bite unlocks a cosmetic',()=>{ for(const a of C.ACH) if(a.id!=='first_bite') ok(C.achReward(a.id)!=='Badge',a.id); });
test('old save missing new fields loads through defSave',()=>{ const S=C.loadSave(JSON.stringify({v:1,xp:120,runs:4,best:{'open-m|normal|solid':22}}));
  eq(S.xp,120); eq(S.best['open-m|normal|solid'],22); eq(S.setup.arena,'open'); eq(S.set.controls,'swipe'); eq(S.cos.skin,'classic'); eq(S.shapeStars,{}); });
test('garbage save loads as default',()=>{ eq(C.loadSave('{nope').xp,0); eq(C.loadSave(null).runs,0); });
test('locked cosmetic in a save falls back to default',()=>{ const S=C.loadSave({v:1,xp:0,cos:{skin:'golden',theme:'paper'}}); eq(S.cos.skin,'classic'); eq(S.cos.theme,'grass'); });
test('mid-run snapshot survives a save round trip',()=>{ const g=E.newGame({seed:'q',arena:'cross'}); E.enqueue(g,0); for(let k=0;k<6;k++) E.step(g); g.queue=[1];
  const S=fresh(); S.run=E.snapshot(g); const S2=C.loadSave(JSON.stringify(S)); eq(E.snapshot(E.restore(S2.run)),E.snapshot(g)); });

function runWith(cfg,len,extra){ const g=E.newGame(cfg); const n=len-3; for(let k=0;k<n;k++) g.body.push(g.body[g.body.length-1]); g.foods=n; Object.assign(g,extra||{}); g.over=true; return g; }
test('XP is star-based with speed multipliers',()=>{ const S=fresh(); const g=runWith({seed:'x',speed:'fast'},90); // open m: 400 cells -> 40/80/140
  const r=C.finishRun(S,g,E,'2026-11-23'); eq(r.stars,2); eq(r.xp,Math.round(12*1.5)); eq(S.xp,18);
  const r2=C.finishRun(S,runWith({seed:'x',speed:'slow'},140),E,'2026-11-23'); eq(r2.stars,3); eq(r2.xp,Math.round(25*.75)); });
test('no stars, no XP',()=>{ const S=fresh(); const r=C.finishRun(S,runWith({seed:'x'},10),E,'d'); eq(r.xp,0); eq(S.runs,1); });
test('bests per arena+speed+walls, speed-up kept apart',()=>{ const S=fresh(); C.finishRun(S,runWith({seed:'x'},30),E,'d'); const r=C.finishRun(S,runWith({seed:'x'},35),E,'d'); ok(r.newBest); eq(r.prevBest,30);
  C.finishRun(S,runWith({seed:'x',speedup:true},20),E,'d'); eq(S.best['open-m|normal|solid'],35); eq(S.best['open-m|normal|solid|up'],20); eq(S.bestLen,35); });
test('daily: 20 XP, doubled on release day; practice gives 0',()=>{ const S=fresh(), c=E.dailyConfig('2026-11-23');
  const r=C.finishRun(S,runWith(c,12),E,'2026-11-23'); eq(r.xp,40); ok(S.daily.done); eq(S.dailyBest,9);
  const S2=fresh(); eq(C.finishRun(S2,runWith(c,12),E,'2026-11-24').xp,20);
  const p=C.finishRun(S,runWith(Object.assign({},c,{practice:true}),200),E,'2026-11-23'); eq(p.xp,0); eq(S.dailyBest,9); });
test('achievements fire and unlock cosmetics',()=>{ const S=fresh(); const r=C.finishRun(S,runWith({seed:'x',arena:'open',size:'l',speed:'fast'},60,{wraps:50,bonusEaten:5}),E,'d');
  for(const id of ['first_bite','long_haul','speed_demon','wrap_artist','golden_touch']) ok(r.ach.includes(id),id);
  ok(C.isUnlocked(S,'skin','ember')); ok(C.isUnlocked(S,'skin','neon')); ok(C.isUnlocked(S,'trail','portal')); ok(C.isUnlocked(S,'food','gem')); ok(!C.isUnlocked(S,'skin','ocean'));
  ok(r.unlocks.some(u=>u.id==='ember')); });
test('Shape Shifter needs a star on every shaped arena',()=>{ const S=fresh(); for(const a of E.SHAPED.slice(0,-1)){ const g=E.newGame({seed:'s',arena:a}); C.finishRun(S,runWith({seed:'s',arena:a},Math.ceil(g.cells*.1)),E,'d'); }
  ok(!S.ach.shape_shifter); const a=E.SHAPED[E.SHAPED.length-1], g=E.newGame({seed:'s',arena:a}); const r=C.finishRun(S,runWith({seed:'s',arena:a},Math.ceil(g.cells*.1)),E,'d'); ok(r.ach.includes('shape_shifter')); });
test('Full House on a perfect game',()=>{ const S=fresh(); const r=C.finishRun(S,runWith({seed:'x',size:'s'},225,{perfect:true}),E,'d'); ok(r.ach.includes('full_house')); eq(r.stars,3); });

test('Arcade: shared settings come from arcade.v1, standalone values kept',()=>{ const S=fresh(); S.set.sfx=true; S.set.controls='dpad';
  const r=C.applyArcade(S,{v:1,name:'Al',set:{sfx:false,music:true,appearance:'dark',controls:'relative'}}); eq(r.set.sfx,false); eq(r.set.music,true); eq(r.set.appearance,'dark');
  eq(r.set.controls,'dpad','game-only setting is not shared'); eq(r.name,'Al'); eq(S.set.sfx,true,'standalone value kept'); });
test('Arcade: summary record has every field',()=>{ const S=fresh(); S.xp=160; S.bestLen=87; S.runs=63; const s=C.summary(S);
  for(const k of ['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last']) ok(k in s,k);
  eq(s.game,'snake'); eq(s.level,3); eq(s.xpLevel,150); eq(s.xpNext,300); eq(s.maxLevel,10); eq(s.ach.length,10); eq(s.hi,[['Best length','87'],['Daily Run best','—'],['Runs','63']]); });
test('storage keys start with snake.',()=>{ ok(C.SAVE_KEY.startsWith('snake.')); eq(C.SUMMARY_KEY,'arcade.summary.snake'); });
test('share line',()=>{ const g=E.newGame({seed:'x',arena:'ring',speed:'fast',walls:'wrap'}); g.foods=42; eq(C.shareLine(g,2,E),'Snake · Ring · Fast · Wrap · 42 · ★★☆'); });
