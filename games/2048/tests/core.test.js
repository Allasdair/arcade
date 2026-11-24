const {E,C,ok,section,withBoard}=require('./lib');
section('levels: max 10, Sweep\'s first 10 steps',()=>{
  const steps=C.LV.slice(1).map((v,i)=>v-C.LV[i]); ok(JSON.stringify(steps)===JSON.stringify([50,100,150,225,300,400,500,650,800]),`steps ${steps}`);
  ok(C.levelOf(0)===1&&C.levelOf(49)===1&&C.levelOf(50)===2&&C.levelOf(3175)===10&&C.levelOf(1e9)===10,'levelOf');
  ok(C.xpNext(10)===null&&C.xpAt(10)===3175,'xpNext null at max');
  for(let l=2;l<=10;l++) ok((C.REWARDS[l]||[]).length>0,`level ${l} has a reward`);
});
section('save: an old save missing new fields loads through defSave()',()=>{
  const S=C.loadSave(JSON.stringify({xp:120,ach:{first:1},best:{'4':900}}));
  ok(S.xp===120&&S.ach.first&&S.best['4']===900,'kept fields'); ok(S.undos===3&&S.pal==='warm'&&S.bestTileA&&typeof S.shapeStars==='object','new fields filled');
  ok(C.loadSave('not json').xp===0,'garbage → fresh save'); ok(C.loadSave(JSON.stringify({board:'#2048'})).board==='4','bad board id reset');
});
section('a game in progress restores exactly after a reload',()=>{
  let G=E.newGame({board:'5',seed:'reload'}); for(let i=0;i<80;i++){ const r=E.move(G,[3,2,1,2][i%4]); if(r.moved) G=r.G; }
  const S=C.defSave(); S.game=G; const S2=C.loadSave(JSON.stringify(S));
  ok(JSON.stringify(S2.game)===JSON.stringify(G),'identical game'); const a=E.move(G,0), b=E.move(S2.game,0);
  ok(JSON.stringify(a.G)===JSON.stringify(b.G),'identical next move and spawn');
});
section('stars by highest tile, per board',()=>{
  ok(C.starsFor('4',256)===0&&C.starsFor('4',512)===1&&C.starsFor('4',1024)===2&&C.starsFor('4',2048)===3&&C.starsFor('4',8192)===3,'4×4');
  for(const b of E.BOARDS){ const t=C.STARS[b]; ok(t&&t.length===3&&t[0]<t[1]&&t[1]<t[2]&&t.every(v=>(v&(v-1))===0),`${b} thresholds are rising powers of two`); }
});
section('XP: star-based; assisted games earn XP but keep separate bests',()=>{
  const S=C.defSave(); const G=withBoard('4',[1024,1024,512,0]); G.max=2048; G.score=20000; G.moves=900;
  const r=C.finishGame(S,G,'2026-11-23'); ok(r.stars===3&&r.xp===25,'★★★ = 25 XP'); ok(S.best['4']===20000&&S.bestTile['4']===2048,'best recorded');
  const A=withBoard('4',[2,0,0,0]); A.max=512; A.score=30000; A.undos=1; A.moves=500; const r2=C.finishGame(S,A,'2026-11-23');
  ok(r2.assisted&&r2.xp===5,'assisted ★ = 5 XP'); ok(S.best['4']===20000&&S.bestA['4']===30000,'assisted best kept separately');
  ok(C.XP_STARS.join()==='0,5,12,25','5/12/25 XP');
});
section('Daily Board XP: 20, doubled on its release day; 3 stars earns an undo and Daily Devotee',()=>{
  const S=C.defSave(); const G=E.newDaily('2026-11-23'); G.max=2048; G.score=21000; G.moves=1000;
  const r=C.finishGame(S,G,'2026-11-23'); ok(r.xp===40&&r.stars===3,'40 XP on release day'); ok(S.undos===4&&S.ach.devotee,'undo +1 and Daily Devotee');
  const S2=C.defSave(); const G2=E.newDaily('2026-11-22'); G2.max=64; G2.moves=50; ok(C.finishGame(S2,G2,'2026-11-23').xp===20,'20 XP when finished a day late');
  ok(S.dailyBest===21000&&S.dailyCount===1,'daily best and count');
});
section('undo economy: count/cap 3, daily refill, earned extras up to 99',()=>{
  const S=C.defSave(); S.undos=0; ok(C.refreshUndos(S,'2026-11-23')&&S.undos===3,'refilled to 3'); ok(!C.refreshUndos(S,'2026-11-23'),'once a day');
  C.spendUndo(S); ok(S.undos===2,'spent'); C.earnUndo(S,5); ok(S.undos===7,'earned stacks'); C.refreshUndos(S,'2026-11-24'); ok(S.undos===7,'refill never lowers');
  C.earnUndo(S,500); ok(S.undos===99,'capped at 99'); S.undos=0; ok(!C.spendUndo(S)&&S.undos===0,'cannot spend at 0');
  const S2=C.defSave(); S2.undos=3; const ups=C.grantXP(S2,160); ok(ups.join()==='2,3'&&S2.undos===5,'+1 undo per level-up');
});
section('achievements and their unlocks',()=>{
  const S=C.defSave(), G=withBoard('4',[2048,2,0,0]); G.max=2048; let got=C.checkAch(S,G,false);
  ok(got.includes('a2048')&&got.includes('notakes'),'2048! and No Take-Backs'); ok(C.pick(S,'pal').id==='warm','default palette');
  S.pal='ember'; ok(C.pick(S,'pal').id==='ember','Ember unlocked by 2048!'); S.pal='ocean'; ok(C.pick(S,'pal').id==='warm','locked Ocean falls back');
  const A=withBoard('4',[2048,0,0,0]); A.max=2048; A.undos=1; const S2=C.defSave(); got=C.checkAch(S2,A,false); ok(got.includes('a2048')&&!got.includes('notakes'),'undo blocks No Take-Backs');
  const T=withBoard('3',[512,0,0]); T.max=512; ok(C.checkAch(C.defSave(),T,false).includes('small'),'Small Wonder');
  const K=withBoard('4',[2,0,0,0]); K.cornerBest=200; ok(C.checkAch(C.defSave(),K,false).includes('corner'),'Corner Keeper');
  const S3=C.defSave(); for(const b of ['cross','ring','diamond']) S3.shapeStars[b]=1; const W=withBoard('swiss',[]); W.max=C.STARS.swiss[0]; W.moves=10;
  ok(C.finishGame(S3,W,'2026-11-23').ach.includes('shapes'),'Shape Shifter after the last shaped board');
  const S4=C.defSave(); S4.games=49; const F=withBoard('4',[2,0,0,0]); F.moves=3; const rr=C.finishGame(S4,F,'x'); ok(rr.ach.includes('regular')&&rr.ach.includes('first'),'Regular at 50 games, First Merge');
  for(const a of C.ACH) ok(a.id==='first'||C.achReward(a.id),`${a.name} has an unlock`);
});
section('Corner Keeper tracking: the highest tile staying in one corner',()=>{
  let G=withBoard('4',[2,0,4,0, 0,8,0,0, 0,0,2,0, 64,2,0,0]); let run=0;
  for(let i=0;i<40&&!G.over;i++){ const r=E.move(G,E.botCorner(G)); if(!r.moved) break; G=r.G; if(G.cornerRun>run) run=G.cornerRun;
    if(G.b[12]===G.max) ok(G.cornerAt===12,'tracks bottom-left'); }
  ok(run>=10,`run grows while 64 stays bottom-left (${run})`); ok(G.cornerBest>=run,'best run kept');
  const r=E.move(withBoard('4',[0,0,0,0, 0,0,0,0, 0,64,0,0, 0,0,0,2]),0); ok(r.G.cornerRun===0||r.G.b[r.G.cornerAt]===r.G.max,'off-corner max resets the run');
});
section('Arcade: shared settings come from arcade.v1; summary record has every field',()=>{
  const a=C.applyArcade(JSON.stringify({set:{appearance:'dark',sfx:false,lang:'de',other:1},name:'Ali'}));
  ok(a.appearance==='dark'&&a.sfx===false&&a.lang==='de'&&a.name==='Ali'&&!('other' in a),'copied shared settings only');
  ok(Object.keys(C.applyArcade('nope')).length===0,'bad arcade.v1 is ignored');
  const S=C.defSave(); S.xp=200; S.best['4']=52316; S.bestTile['6']=4096; const s=C.summary(S);
  for(const k of ['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last']) ok(k in s,`summary.${k}`);
  ok(s.game==='t2048'&&s.v===1&&s.maxLevel===10&&s.level===3&&s.xpLevel===150&&s.xpNext===300,'level fields');
  ok(s.ach.length===C.ACH.length&&s.ach.every(x=>x.length===3),'ach rows'); ok(s.hi[0][1]==='4,096'&&s.hi[1][1]==='52,316'&&s.hi[2][1]==='—','hi rows');
  ok(C.KEY==='t2048.v1'&&C.SUMKEY==='arcade.summary.t2048','storage keys');
});
section('share line',()=>{ const G=withBoard('4',[2048,0,0,0]); G.max=2048; G.score=20412; ok(C.shareLine(G)==='2048 · 4×4 · 2,048 tile · 20,412 · ★★★',C.shareLine(G)); });
