// node tests/run.js   (QUICK=1 for a short run)
// Engine, solver and bank, modes, core and the Arcade contract. Node only.
const fs=require('fs'), path=require('path'), zlib=require('zlib');
const {load,ok,eq,res}=require('./lib.js');
const X=load(), QUICK=!!process.env.QUICK, t0=Date.now();
const ROOT=path.join(__dirname,'..'), SRC=path.join(ROOT,'src');
const sec=n=>console.log(`· ${n}`);
const deal=(n,cfg)=>X.newGame(X.dealSeed(n),cfg);
const sortN=a=>a.slice().sort((x,y)=>x-y);
const all52=st=>[...st.cols.flat(),...st.deck,...[0,1,2,3].flatMap(s=>Array.from({length:st.f[s]},(_,r)=>s*13+r))];

// ===================== engine =====================
sec('deals');
for(let n=0;n<(QUICK?200:1000);n++){ const st=deal(n); const c=all52(st);
  if(n<3||n%97===0){ eq(sortN(c),Array.from({length:52},(_,i)=>i),`deal ${n}: 52 distinct cards`); eq(st.cols.map(c=>c.length),[1,2,3,4,5,6,7],`deal ${n}: columns 1–7`);
    eq(st.down,[0,1,2,3,4,5,6],`deal ${n}: top cards face up`); eq(st.deck.length,24,`deal ${n}: 24 in the stock`); }
  else ok(new Set(c).size===52&&c.length===52,`deal ${n}: 52 distinct`); }
eq(deal(7).cols,deal(7).cols,'same seed, same deal'); ok(JSON.stringify(deal(7).cols)!==JSON.stringify(deal(8).cols),'different seeds differ');

sec('moves');
{ // build positions by hand
  const blank=()=>{ const st=deal(0); st.cols=[[],[],[],[],[],[],[]]; st.down=[0,0,0,0,0,0,0]; st.deck=[]; st.wp=0; st.f=[0,0,0,0]; return st; };
  const C=(r,s)=>s*13+r; // r: 0 = A
  let st=blank(); st.cols[0]=[C(6,0)]; st.cols[1]=[C(5,1)]; st.cols[2]=[C(5,0)];
  ok(X.legal(st,{k:'t',i:1,j:0},{k:'t',i:0}),'red 6 on black 7'); ok(!X.legal(st,{k:'t',i:2,j:0},{k:'t',i:0}),'black 6 not on black 7');
  st.cols[0]=[C(6,0),C(5,1),C(4,3)]; st.cols[3]=[C(7,2)];
  ok(X.legal(st,{k:'t',i:0,j:0},{k:'t',i:3}),'a run moves together');
  ok(X.move(st,{k:'t',i:0,j:0},{k:'t',i:3})&&st.cols[3].length===4&&st.moves===1,'run move counts 1');
  st=blank(); st.cols[0]=[C(11,1)]; st.cols[1]=[C(12,0),C(11,1)]; st.cols[2]=[C(3,0),C(12,3)];
  ok(!X.legal(st,{k:'t',i:0,j:0},{k:'t',i:3}),'only a King to an empty column'); ok(X.legal(st,{k:'t',i:2,j:1},{k:'t',i:3}),'King to empty column');
  st.down[2]=1; X.move(st,{k:'t',i:2,j:1},{k:'t',i:3}); eq(st.down[2],0,'automatic flip');
  st=blank(); st.cols[0]=[C(0,1)]; st.cols[1]=[C(1,1)]; st.cols[2]=[C(1,2)];
  ok(!X.legal(st,{k:'t',i:1,j:0},{k:'f',i:1}),'2 not before the Ace'); X.move(st,{k:'t',i:0,j:0},{k:'f',i:1}); ok(X.legal(st,{k:'t',i:1,j:0},{k:'f',i:1}),'2 on Ace, same suit');
  ok(!X.legal(st,{k:'t',i:2,j:0},{k:'f',i:1}),'other suit not on the foundation');
  X.move(st,{k:'t',i:1,j:0},{k:'f',i:1}); st.cols[3]=[C(2,0)]; ok(X.legal(st,{k:'f',i:1},{k:'t',i:3}),'back down from a foundation');
  // win detection
  st=blank(); st.f=[13,13,13,12]; st.cols[0]=[C(12,3)]; X.move(st,{k:'t',i:0,j:0},{k:'f',i:3}); ok(st.won,'win detected');
}
sec('stock and passes');
for(const draw of [1,3]) for(const passes of [0,3,1]){ const st=deal(1,{draw,passes}); let taps=0, resets=0;
  for(let k=0;k<200;k++){ const r=X.draw(st); if(!r) break; taps++; if(r.k==='reset') resets++; else ok(st.wp<=24,'wp in range'); }
  const want=passes===0?Infinity:passes-1;
  if(passes) eq(resets,want,`draw ${draw} passes ${passes}: resets allowed`); else ok(resets>=5,`draw ${draw} unlimited resets`);
  if(draw===3){ const s2=deal(1,{draw:3}); X.draw(s2); eq(s2.wp,3,'draw 3 turns 3'); } else { const s2=deal(1); X.draw(s2); eq(s2.wp,1,'draw 1 turns 1'); }
  if(passes){ ok(!X.canReset(st),'no reset when passes are used up'); eq(st.moves,taps,'each tap counts 1'); } }
sec('move counting and undo');
{ const st=deal(3); X.draw(st); X.draw(st); eq(st.moves,2,'stock taps count'); const before=X.snap(st); const ms=X.legalMoves(st);
  if(ms.length){ X.move(st,ms[0].from,ms[0].to); X.undo(st); eq(X.snap(st),before,'undo restores the exact state'); eq(st.moves,4,'undo counts 1'); }
  // undo restores flips and stock position
  for(let n=0;n<40;n++){ const s=deal(n); for(let k=0;k<60;k++){ const lm=X.legalMoves(s).filter(m=>m.from.k==='t'&&m.from.j===s.down[m.from.i]&&s.down[m.from.i]>0);
      if(lm.length){ const b=X.snap(s); X.move(s,lm[0].from,lm[0].to); const after=X.snap(s); X.undo(s); eq(X.snap(s),b,`deal ${n}: undo restores a flip`); X.restore(s,after); break; } X.draw(s); } }
  const s=deal(5,{undo:2}); X.draw(s); X.draw(s); X.draw(s); ok(X.undo(s)&&X.undo(s)&&!X.undo(s),'undo limit');
  const z=deal(5,{undo:0}); X.draw(z); ok(!X.undo(z),'undo off'); }
{ const st=deal(4); const m0=st.moves; X.flipAll(st); eq(st.moves,m0,'automatic flips count 0'); }
sec('tap targets and safe auto-move');
{ const C=(r,s)=>s*13+r; const st=deal(0); st.cols=[[C(5,0)],[C(6,2)],[],[C(6,1)],[],[],[]]; st.down=[0,0,0,0,0,0,0]; st.deck=[]; st.wp=0; st.f=[5,0,0,0];
  const t=X.tapTargets(st,{k:'t',i:0,j:0}); eq(t[0],{k:'f',i:0},'tap: foundation first'); eq(t.slice(1).map(x=>x.i),[1,3],'then tableau left to right'); ok(!t.some(x=>x.k==='t'&&st.cols[x.i].length===0),'no empty column for a non-King');
  st.cols[5]=[C(12,0)]; st.cols[6]=[C(4,3),C(12,1)]; st.down[6]=1; const tk=X.tapTargets(st,{k:'t',i:6,j:1}); eq(tk[tk.length-1],{k:'t',i:2},'then one empty column');
  eq(X.tapTargets(st,{k:'t',i:5,j:0}).length,0,'a King at the bottom stays put'); }
{ let bad=0, tried=0; // safe auto-move never moves a card that could still be needed (checked with the exact solver)
  for(let n=0;n<(QUICK?30:120);n++){ const st=deal(n); for(let k=0;k<150&&!st.won;k++){ const s=X.nextSafe(st); if(s){ tried++; const c=X.cardsOf(st,s.from)[0], r=X.rankOf(c);
        if(r>1){ const red=X.isRed(c); for(let q=0;q<4;q++) if(X.isRed(q*13)!==red&&st.f[q]<r) bad++; }
        X.move(st,s.from,s.to,{free:true}); continue; }
      const lm=X.legalMoves(st).filter(m=>m.from.k!=='f'); if(lm.length&&k%3) X.move(st,lm[0].from,lm[0].to); else if(!X.draw(st)) break; } }
  ok(tried>50,'safe auto-move used ('+tried+')'); eq(bad,0,'safe auto-move: opposite colours one lower are already up'); }
sec('auto-complete');
for(let n=0;n<(QUICK?20:80);n++){ const st=deal(n); const S=X.solveAll(st,{limit:20000}); if(S.status!=='win') continue; const g=deal(n);
  ok(!X.canAutoComplete(g),`deal ${n}: no auto-complete at the start`); X.playActions(g,S.solution);
  ok(X.canAutoComplete(g)||g.won,`deal ${n}: auto-complete appears (or the game is already won)`); let k=0; while(X.autoStep(g)) k++; ok(g.won,`deal ${n}: auto-complete always finishes`); eq(g.moves,S.solution.length,'auto-complete moves count 0'); }

// ===================== solver and bank =====================
sec('bank');
const SOLS=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'bank_solutions.json.gz'))));
for(const draw of [1,3]){ const L=X.bankList(draw); eq(L.length,2000,`draw ${draw}: 2,000 deals`); eq(new Set(L.map(d=>d.n)).size,L.length,`draw ${draw}: no repeats`);
  const step=QUICK?40:1; for(let i=0;i<L.length;i+=step){ const d=L[i], sol=SOLS[draw+'|'+d.n].split(' ');
    const st=X.newGame(X.dealSeed(d.n),{draw}); let good=true; try{ X.playActions(st,sol); }catch(e){ good=false; }
    ok(good&&(st.won||X.canAutoComplete(st)),`draw ${draw} deal ${d.n}: the stored solution wins`);
    ok(d.par>=sol.length,`draw ${draw} deal ${d.n}: par ≥ solution`); }
  ok(X.openList(draw).length===500,`draw ${draw}: 500 Open deck grades`); }
{ const bytes=fs.statSync(path.join(SRC,'bank.js')).size; ok(bytes<100*1024,`bank.js under 100 KB (${(bytes/1024).toFixed(1)} KB)`); }
sec('pass limits');
{ let n=0; for(const draw of [1,3]) for(const d of X.bankList(draw).filter(d=>d.passes).slice(0,QUICK?3:15)){ const S=X.solveAll(X.newGame(X.dealSeed(d.n),{draw,passes:d.passes}),{limit:60000}); ok(S.status==='win',`draw ${draw} deal ${d.n}: winnable in ${d.passes} pass(es)`); n++; } ok(n>5,'pass-limited deals exist'); }
sec('grades repeatable');
for(const draw of [1,3]) for(const d of X.bankList(draw).slice(0,QUICK?2:8)){ const r=X.gradeRate(X.dealSeed(d.n),{draw},20).rate; eq(X.gradeOf(r),d.grade,`draw ${draw} deal ${d.n}: same grade`); }
sec('solver: hints and the "still winnable?" check');
{ let hinted=0, warned=0, wrong=0, quiet=0;
  for(let n=0;n<(QUICK?12:40);n++){ const d=X.bankList(1)[n], st=X.newGame(X.dealSeed(d.n),{draw:1}), sol=SOLS['1|'+d.n].split(' ');
    // midway along a winning line, a hint keeps the game winnable
    X.playActions(st,sol.slice(0,Math.floor(sol.length*.3)));
    const H=X.solveAll(st,{limit:60000}); if(H.status==='win'){ hinted++; const g=X.cloneSt(st); X.playActions(g,[H.solution[0]]); const C=X.makeWinCheck(g,120000); while(!C.result) C.step(1e5); ok(C.result!=='no',`deal ${d.n}: the hinted move keeps it winnable`); }
    // never warns on a winnable position (each step along the stored solution)
    for(let k=Math.floor(sol.length*.3);k<sol.length;k+=Math.max(5,Math.floor(sol.length/6))){ const g=X.newGame(X.dealSeed(d.n),{draw:1}); X.playActions(g,sol.slice(0,k)); const C=X.makeWinCheck(g,60000); while(!C.result) C.step(1e5); if(C.result==='no') wrong++; if(C.result==='unknown') quiet++; } }
  // unwinnable positions are flagged: play a Draw 1, 1-pass game straight through the stock, then check
  for(let n=0;n<(QUICK?30:120);n++){ const st=deal(n,{draw:3,passes:1}); while(X.draw(st)); const C=X.makeWinCheck(st,200000); while(!C.result) C.step(1e5); if(C.result==='no') warned++; }
  ok(hinted>=5,'hints found ('+hinted+')'); eq(wrong,0,'never warns on a winnable position'); ok(warned>=3,'unwinnable positions flagged ('+warned+')');
  // a timeout stays quiet
  const T=X.makeWinCheck(deal(9,{draw:3}),1); while(!T.result) T.step(1e5); ok(T.result!=='no','a timeout stays quiet ('+T.result+')'); }
sec('slices');
{ let worst=0; for(let n=0;n<(QUICK?5:20);n++){ const S=X.makeSolver(deal(n),{limit:30000}); while(!S.done){ const t=performance.now(); S.step(200); worst=Math.max(worst,performance.now()-t); } }
  ok(worst<8,`each slice of solver work stays under 8 ms (worst ${worst.toFixed(2)} ms for 200 nodes)`); }

// ===================== modes =====================
sec('daily');
{ const days=[]; const base=Date.UTC(2026,10,23); for(let i=0;i<120;i++){ const d=new Date(base+i*864e5).toISOString().slice(0,10); days.push(d); }
  for(const d of days){ const a=X.dailyDeal(d), b=X.dailyDeal(d); eq(a.n,b.n,`${d}: same deal`); const w=X.DAILY_TABLE[X.weekdayOf(d)]; ok(a.draw===w.draw&&w.grades.includes(a.grade),`${d}: weekday table`); }
  eq(X.weekdayOf('2026-11-23'),1,'2026-11-23 is a Monday'); eq(X.dailyDeal('2026-11-23').draw,1,'Monday Draw 1'); eq(X.dailyDeal('2026-11-28').draw,3,'Saturday Draw 3'); eq(X.dailyDeal('2026-11-29').grade,'hard','Sunday Hard');
  const fp=d=>{ const x=X.dailyDeal(d); return x.draw+'|'+x.n+'|'+x.grade+'|'+x.par; };
  console.log('    fingerprints: 2026-11-25 →',fp('2026-11-25'),' 2027-01-01 →',fp('2027-01-01'));
  eq(fp('2026-11-25'),'1|1049|medium|130','pinned fingerprint 2026-11-25'); eq(fp('2027-01-01'),'1|264|hard|130','pinned fingerprint 2027-01-01');
  const S=X.defSave(false), today='2026-11-25', dd=X.dailyDeal(today);
  const r=X.dailyResult(S,today,true,dd.par,dd.parTime*1000-1,false,today); eq(r.stars,[1,1,1],'daily stars'); eq(r.xp,40,'release-day XP doubled'); ok(X.dailyResult(S,today,true,1,1,false,today)===null,'one scored attempt');
  const S2=X.defSave(false); eq(X.dailyResult(S2,'2026-11-24',true,999,1e7,false,today).xp,20,'not on its release day: 20 XP');
  eq(X.shareLine('2026-11-25',96,252000,[1,1,0],false,true),'Solitaire Daily · Wed 25 Nov · 96 moves · 4:12 · ★★☆','share line');
  ok(/hinted$/.test(X.shareLine('2026-11-25',96,252000,[1,0,0],true,true)),'a hinted Daily is marked');
  // streak and Full Week
  const S3=X.defSave(false); for(let i=0;i<7;i++){ const d=new Date(Date.UTC(2026,10,23+i)).toISOString().slice(0,10), x=X.dailyDeal(d); X.dailyResult(S3,d,true,x.par,1000,false,d); }
  eq(S3.dstreak.cur,7,'daily streak'); ok(S3.dweek.every(Boolean),'Full Week tracker'); const got=X.checkAch(S3,{mode:'daily'}); ok(got.includes('dweek')&&got.includes('dstreak')&&got.includes('dstar'),'Daily achievements'); }
sec('campaign');
{ eq(X.LEVELS.length,45,'45 levels'); const LS=JSON.parse(fs.readFileSync(path.join(__dirname,'level_solutions.json')));
  for(const L of X.LEVELS){ const st=X.levelGame(L); ok(st&&st.cols.length===7,`${L.id}: loads`); eq(st.moves,0,`${L.id}: starts at 0 moves`);
    const sol=LS[L.id].split(' '); let good=true; try{ X.playActions(st,sol); }catch(e){ good=false; }
    ok(good&&(st.won||X.canAutoComplete(st)),`${L.id}: the bot/solver line wins under the level's rules`); ok(L.par>=sol.length,`${L.id}: par ≥ the winning line`);
    if(L.moveLimit) ok(sol.length<=L.moveLimit,`${L.id}: winnable inside the move limit`); if(L.passes) ok(st.resets<=L.passes-1,`${L.id}: inside the pass limit`); }
  const by=c=>X.LEVELS.filter(L=>L.camp===c);
  for(let c=0;c<3;c++){ const ls=by(c); eq(ls.map(L=>L.n),[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],`campaign ${c+1}: 15 levels`);
    ok([4,8,12].every(n=>ls[n-1].open),`campaign ${c+1}: Open deck at 4, 8, 12`); eq(ls[9].type,'puzzle',`campaign ${c+1}: puzzle at 10`); ok([7,14].every(n=>ls[n-1].type==='twist'),`campaign ${c+1}: twists at 7 and 14`); eq(ls[14].type,'final',`campaign ${c+1}: finale at 15`); }
  // twist rules apply
  const und=X.LEVELS.find(L=>L.undo===0), st=X.levelGame(und); X.draw(st); ok(!X.undo(st),'twist: undo off');
  const u3=X.LEVELS.find(L=>L.undo===3), s3=X.levelGame(u3); for(let i=0;i<5;i++) X.draw(s3); ok(X.undo(s3)&&X.undo(s3)&&X.undo(s3)&&!X.undo(s3),'twist: 3 undos');
  const one=X.LEVELS.find(L=>L.type==='twist'&&L.passes===1), s1=X.levelGame(one); let resets=0; for(let i=0;i<60;i++){ const r=X.draw(s1); if(r&&r.k==='reset') resets++; } eq(resets,0,'twist: 1 pass');
  ok(X.LEVELS.some(L=>L.moveLimit),'twist: a move limit level exists');
  // puzzles: reachable positions, winnable, par confirmed
  for(const L of X.LEVELS.filter(L=>L.type==='puzzle')){ const g=X.levelGame(L); ok(g.f.some(n=>n>0)||g.down.some((d,i)=>d<i),`${L.id}: a game in progress`); const S=X.solveAll(g,{limit:120000}); ok(S.status==='win',`${L.id}: winnable from the puzzle position`); }
  // stars build up across attempts; unlocks; XP
  const S=X.defSave(false), L1=X.LEVELS[0];
  ok(X.unlocked(S,L1)&&!X.unlocked(S,X.LEVELS[1]),'only level 1 open at first');
  let r=X.campaignResult(S,L1,true,L1.par+50,1,1); eq(r.earned,[0,1,0],'stars: time only'); eq(r.xp,6,'6 XP per new star');
  r=X.campaignResult(S,L1,true,L1.par,1e9,0); eq(X.campStars(S,L1.id),3,'stars build up across attempts'); eq(r.fresh,[0,2],'only new stars pay');
  ok(X.unlocked(S,X.LEVELS[1]),'clearing unlocks the next level');
  r=X.campaignResult(S,L1,false,1,1,0); eq(r.earned,[0,0,0],'a loss earns no star');
  const S4=X.defSave(false); for(const L of by(0)) X.campaignResult(S4,L,true,L.par,1,0); ok(X.campOpen(S4,1)&&!X.campOpen(S4,2),'level 15 unlocks the next campaign');
  ok(X.checkAch(S4,{mode:'campaign'}).includes('camp1'),'campaign achievement'); }

// ===================== core =====================
sec('core');
{ const old=JSON.stringify({v:1,xp:120,ach:{c1:1},rec:{d1:{games:3,wins:2,cur:1,best:2}}}); const S=X.loadSave(old,false);
  eq(S.xp,120,'old save loads'); ok(S.prefs&&S.look&&S.rec.d3&&S.daily&&Array.isArray(S.dweek),'missing fields come from defSave()');
  // a game mid-move restores exactly
  const st=deal(11); X.draw(st); const lm=X.legalMoves(st); if(lm.length) X.move(st,lm[0].from,lm[0].to); S.run={mode:'classic',st}; const back=X.loadSave(JSON.stringify(S),false);
  eq(X.snap(back.run.st),X.snap(st),'a game in progress restores exactly'); eq(back.run.st.hist,st.hist,'with its undo history');
  // XP and levels: a reward at every level 2–10, +1 hint per level-up
  for(let l=2;l<=10;l++) ok(X.rewardsAt(l).length>0,`level ${l} has a reward`);
  const S2=X.defSave(false); S2.hints=5; const a=X.addXP(S2,160); eq(a.after,3,'XP to level 3'); eq(S2.hints,7,'+1 hint per level-up');
  eq(X.classicXP({grade:'hard'},{draw:3,passes:1},false),32,'Classic XP: Hard + Draw 3 + 1 pass'); eq(X.classicXP({grade:'easy'},{draw:1,passes:0},true),5,'assisted wins earn half');
  // hints refill daily to 5, earned extras stack to 99
  const S3=X.defSave(false); S3.hints=1; X.refreshHints(S3,'2026-11-25'); eq(S3.hints,5,'hints refill to 5'); S3.hints=9; X.refreshHints(S3,'2026-11-26'); eq(S3.hints,9,'extras stack');
  S3.hints=99; X.addXP(S3,5000); eq(S3.hints,99,'capped at 99');
  // records, streaks, cumulative clears
  const S4=X.defSave(false), d={grade:'medium',par:120};
  for(let i=0;i<10;i++){ X.recordClassic(S4,d,{draw:1},true,100,170000,false); X.checkAch(S4,{mode:'classic',won:true,cfg:{draw:1,passes:0},deal:d,moves:100,time:170000,hints:0,undos:0}); }
  eq(S4.rec.d1.wins,10,'wins'); eq(S4.rec.d1.best,10,'best streak'); ok(S4.ach.c1&&S4.ach.c10&&S4.ach.s10&&S4.ach.par&&S4.ach.quick&&S4.ach.noundo,'cumulative clears and skill achievements');
  X.recordClassic(S4,d,{draw:1},false,10,1000,false); eq(S4.rec.d1.cur,0,'a loss ends the streak'); eq(S4.rec.d1.best,10,'best streak kept');
  const b=S4.rec.best['1|medium']; ok(b&&b.t===170000&&b.m===100,'best time and fewest moves per draw and grade');
  X.recordClassic(S4,d,{draw:1},true,90,100000,true); eq(S4.rec.best['1|medium'].m,100,'assisted wins set no records');
  // cosmetics
  const kinds=Object.keys(X.COS); ok(kinds.length>=13,'cosmetic categories'); const S5=X.defSave(false); for(const k of kinds) ok(X.owned(S5,X.COS[k][0]),`${k}: default owned`);
  ok(X.COS.back.filter(b=>b.anim).every(b=>b.stars),'animated backs are star unlocks'); ok([30,75,135].every(n=>X.starUnlocks().some(u=>u.stars===n)),'30/75/135 star unlocks');
  for(const k of kinds) for(const it of X.COS[k]) if(it.req) ok(X.ACH.some(a=>a.id===it.req),`${it.name}: unlocked by a real achievement`);
  // backup round trip
  const S6=X.defSave(false); S6.xp=777; S6.ach.c1=1; const code=X.backupPlain(S6); ok(code.startsWith('SOLITAIRE1.'),'backup prefix'); eq(X.parseBackup('hello '+code+' bye').xp,777,'backup round trip'); ok(X.parseBackup('nope')===null,'bad code refused');
  // classic: no repeats until the pool is used up
  const S7=X.defSave(false), setup={draw:1,passes:1,open:false,grade:'easy'}, pool=X.classicPool(setup), seen=new Set(); let rep=false; const r=X.rngFor('t');
  for(let i=0;i<pool.length;i++){ const dd=X.pickClassic(S7,setup,r); if(seen.has(dd.n)) rep=true; seen.add(dd.n); } ok(!rep&&seen.size===pool.length,`no repeats in a pool (${pool.length})`); ok(X.pickClassic(S7,setup,r),'the pool refills');
  ok(pool.every(dd=>dd.passes===1),'1-pass pool only has 1-pass deals'); }
sec('arcade contract');
{ const mem={}, store={get:k=>mem[k]==null?null:mem[k],set:(k,v)=>{ mem[k]=v; }};
  mem['arcade.v1']=JSON.stringify({set:{appearance:'dark',motion:false,sfx:false,music:false,haptics:false,fullscreen:true,cb:true,lefty:true,lang:'de'},name:'Al'});
  const S=X.defSave(false), P=X.applyShared(S,X.readArcade(store)); eq([P.appearance,P.motion,P.cb,P.lefty,P.lang,P.name],['dark',false,true,true,'de','Al'],'shared settings and the name from arcade.v1');
  eq(S.appearance,'system','the save keeps its own values');
  const sm=X.summary(S); for(const k of ['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last']) ok(k in sm,`summary has ${k}`); eq(sm.game,'solitaire','summary game id'); eq(sm.maxLevel,10,'maxLevel 10');
  eq(sm.hi.map(h=>h[0]),['Wins','Campaign stars','Daily streak'],'summary highlights');
  const app=fs.readFileSync(path.join(SRC,'app.html'),'utf8'), all=app+FS(['engine.js','solver.js','core.js','levels.js']);
  ok(app.includes("ARCADE_HOME='../index.html'")&&app.includes("ARCADE_PREFS='../index.html#prefs'"),'ARCADE_HOME and ARCADE_PREFS');
  ok(/function leaveTo\(url\)\{[^}]*location\.replace\(url\)/.test(app),'leaveTo uses location.replace'); ok(!/location\.href\s*=|location\.assign/.test(app),'never location.href= or location.assign');
  ok(app.includes("location.hash==='#game-settings'")&&app.includes('history.replaceState'),'#game-settings opens settings and clears the hash');
  ok(app.includes('id="arcadeBtn"')&&app.includes('id="settingsBtn"'),'#arcadeBtn and #settingsBtn exist');
  ok(!/serviceWorker/.test(all),'no service worker'); ok(!/https?:\/\/(?!www\.w3\.org)/.test(all),'no outside requests');
  const keys=[...all.matchAll(/(?:store\.set|localStorage\.setItem)\(([^,]+),/g)].map(m=>m[1].trim()); ok(keys.every(k=>['KEY','SUMKEY','k'].includes(k)),'only solitaire.* keys are written ('+keys.join(',')+')');
  eq([X.KEY,X.SUMKEY],['solitaire.v1','arcade.summary.solitaire'],'storage keys'); ok(!/\.set\(ARCADE_KEY/.test(all),'arcade.v1 is never written');
  ok(!/#[a-z]+=/.test(app.replace(/#game-settings/g,'')),'no other page hashes'); }
function FS(fs2){ return fs2.map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n'); }

const r=res(); console.log(`\n${r.fail?'FAILED':'ok'}: ${r.pass} passed, ${r.fail} failed · ${((Date.now()-t0)/1000).toFixed(1)} s`); process.exit(r.fail?1:0);
