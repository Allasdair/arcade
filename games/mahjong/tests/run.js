// node tests/run.js   (QUICK=1 for a short run)
const fs=require('fs'), path=require('path');
const {load,ok,eq,res}=require('./lib.js');
const QUICK=!!process.env.QUICK, t0=Date.now();
const X=load(['layouts.js','engine.js','solver.js','tiles.js','levels.js','core.js','i18n_0_ui.js']);
const section=n=>console.log('— '+n);
const zeros=n=>new Array(n).fill(0);
const replay=(L,faces,gone0,line)=>{ const g=gone0.slice(); for(const [a,b] of line){ if(!X.isFree(L,g,a)||!X.isFree(L,g,b)||X.matchKey(faces[a])!==X.matchKey(faces[b])||a===b) return false; g[a]=g[b]=1; } return g.every(v=>v); };

section('tiles');
for(const d of X.DIFF_IDS){ const L=X.layoutsFor(d)[0], g=X.generate(L,d,'tiles|'+d,.3), cnt={};
  ok(g.faces.length===X.DIFFS[d].tiles,`${d}: ${X.DIFFS[d].tiles} tiles`);
  g.faces.forEach(f=>cnt[f]=(cnt[f]||0)+1); const kinds=Object.keys(cnt).filter(f=>f<34);
  ok(kinds.length===X.DIFFS[d].kinds&&kinds.every(f=>cnt[f]===4),`${d}: ${X.DIFFS[d].kinds} kinds × 4`);
  ok([34,35,36,37,38,39,40,41].every(f=>cnt[f]===1),`${d}: the 8 bonus tiles once each`);
  if(d==='easy') ok(kinds.every(f=>+f<27),'easy uses the numbered suits'); }
ok(X.matchKey(34)===X.matchKey(37)&&X.matchKey(38)===X.matchKey(41)&&X.matchKey(34)!==X.matchKey(38),'any flower matches any flower; any season any season; not each other');
ok(X.matchKey(5)!==X.matchKey(6)&&X.matchKey(31)===31,'kinds match only themselves');
eq([X.faceLabel(13),X.faceLabel(20),X.faceLabel(6),X.faceLabel(27),X.faceLabel(31)],['B5','C3','D7','EW','RD'],'High-contrast labels');
for(const set of Object.keys(X.FACESETS)) for(let f=0;f<42;f++){ const s=X.faceSvg(f,set,{}); if(!/<(path|circle|rect|ellipse)/.test(s)) ok(false,`${set} face ${f} draws`); }
ok(!/[\u{1F000}-\u{1F0FF}]/u.test(fs.readFileSync(path.join(__dirname,'../src/tiles.js'),'utf8')),'no Unicode mahjong characters in the tile art');

section('free-tile rule');
{ // a hand-made layout: a row of 3, a tile on top of the middle, a half-offset tile, a row-offset neighbour
  const pos=[[0,0,0],[2,0,0],[4,0,0],[2,0,1],[8,0,0],[10,1,0],[12,2,0],[20,0,0],[22,0,1],[21,0,1]];
  const L=Object.assign({n:pos.length,pos},X.geom(pos)), g=zeros(pos.length), F=i=>X.isFree(L,g,i);
  ok(F(0)&&!F(1)&&F(2),'a row of three: the ends are free, the middle is not');
  ok(F(3),'the tile on top is free'); g[3]=1; ok(!F(1),'the middle tile is still blocked left and right'); g[0]=1; ok(F(1),'…free once its left side opens'); g[0]=0; g[3]=0;
  ok(!F(5),'a tile half a row down is blocked by neighbours on both sides (overlapping rows)'); ok(F(4)&&F(6),'…and its neighbours are free');
  g[4]=1; ok(F(5),'…free once one side opens');
  ok(!F(7),'a tile under a half-offset tile is covered'); }
{ const pos=[[0,0,0],[1,1,1]]; const L=Object.assign({n:2,pos},X.geom(pos)); ok(!X.isFree(L,zeros(2),0),'a half-offset tile above covers the tile below'); }

section('play');
{ const L=X.layoutById('terrace'); const st=X.newGame({lid:'terrace',diff:'easy',seed:'play',trap:.3,shuffles:'inf',undo:true});
  const blocked=[...Array(L.n).keys()].find(i=>!X.stFree(st,i)); eq(X.tap(st,blocked,0).k,'blocked','a blocked tap shakes'); ok(st.sel===-1,'…and selects nothing');
  const [a,b]=X.matchable(st)[0]; eq(X.tap(st,a,0).k,'select','tap selects'); eq(X.tap(st,a,0).k,'deselect','tapping again deselects');
  const other=X.freeList(L,st.gone).find(i=>X.matchKey(st.faces[i])!==X.matchKey(st.faces[a]));
  X.tap(st,a,0); eq(X.tap(st,other,0).k,'switch','tapping a free non-match moves the selection'); X.tap(st,other,0);
  const before=JSON.stringify({g:st.gone,s:st.score,c:st.combo});
  X.tap(st,a,1000); const r=X.tap(st,b,1000); eq(r.k,'match','a free matching pair is removed'); ok(st.gone[a]&&st.gone[b],'…both tiles gone');
  X.undoMove(st); ok(JSON.stringify({g:st.gone,s:st.score,c:st.combo})===before,'undo restores the exact state'); ok(st.assists.undo===1&&X.assisted(st),'undo is an assist');
  const st2=X.newGame({lid:'terrace',diff:'easy',seed:'play',trap:.3,shuffles:'inf',undo:true}); ok(!X.assisted(st2),'a new game is unassisted');
  X.shuffleBoard(st2,'s'); ok(st2.assists.shuffle===1&&X.assisted(st2),'shuffle is an assist');
  // combo: within 3 s builds ×1.5, ×2, ×2.5, ×3 (cap)
  const st3=X.newGame({lid:'terrace',diff:'easy',seed:'combo',trap:0,shuffles:'inf',undo:true}); const pts=[];
  for(let k=0;k<6;k++){ const line=X.solveState(st3,{ref:st3.order}).line; const [p,q]=line[0]; st3.t=k*1000; pts.push(X.removePair(st3,p,q).combo); }
  eq(pts,[0,1,2,3,4,4],'combo steps and cap'); st3.t=20000; const [p,q]=X.solveState(st3,{ref:st3.order}).line[0]; eq(X.removePair(st3,p,q).combo,0,'a slow pair resets the combo');
  ok(X.COMBO_MUL[4]===3,'the cap is ×3');
  // Time Attack
  const ta=X.newGame({lid:'terrace',diff:'easy',seed:'ta',trap:0,shuffles:'inf',undo:true,ta:true}); eq(ta.ta.left,110000,'Time Attack starts at 1:50 on Easy');
  const [c,d]=X.solveState(ta,{ref:ta.order}).line[0]; X.tickClock(ta,10000); const left=ta.ta.left; X.removePair(ta,c,d); eq(ta.ta.left,left+3000,'a pair adds 3 s');
  X.undoMove(ta); eq(ta.ta.left,left,'undo takes the bonus back'); ok(X.tickClock(ta,200000)&&ta.lost&&ta.over,'the clock reaching 0 loses');
  // stuck
  const L2=Object.assign({n:4,pos:[[0,0,0],[0,0,1],[4,0,0],[4,0,1]]},X.geom([[0,0,0],[0,0,1],[4,0,0],[4,0,1]]));
  ok(X.freePairs(L2,zeros(4),[5,6,6,5]).length===0,'stuck: no free matching pair'); }
// Fog
{ const st=X.newGame({lid:'fortress',diff:'hard',seed:'fog',trap:.5,shuffles:'inf',undo:true,fog:true}), L=X.layoutOf(st);
  ok([...Array(L.n).keys()].every(i=>X.faceUp(st,i)===X.stFree(st,i)),'Fog: only free tiles are face up');
  const [a,b]=X.solveState(st,{ref:st.order}).line[0]; const r=X.removePair(st,a,b);
  ok(r.revealed.every(i=>X.stFree(st,i)),'Fog: freed tiles turn face up'); ok([...Array(L.n).keys()].every(i=>st.gone[i]||X.faceUp(st,i)===X.stFree(st,i)||st.seen[i]),'Fog: nothing blocked is shown'); }

section('generator');
{ let n=0, bad=0, fails=0; const N=QUICK?1500:10000; let k=0;
  while(n<N){ for(const L of X.LAYOUTS){ if(n>=N) break; const d=L.diff, g=X.generate(L,d,'gen|'+k,(k%7)/6); if(!g){ fails++; continue; } n++; if(!replay(L,g.faces,zeros(L.n),g.order)) bad++; } k++; }
  ok(bad===0&&fails===0,`every generated board is winnable: replaying its build order clears it (${n} boards, ${bad} bad, ${fails} failed)`);
  const a=X.generate(X.layoutById('turtle'),'expert','same',.7), b=X.generate(X.layoutById('turtle'),'expert','same',.7); ok(JSON.stringify(a)===JSON.stringify(b),'same seed, same board');
  const c=X.generate(X.layoutById('turtle'),'expert','same2',.7); ok(JSON.stringify(a.faces)!==JSON.stringify(c.faces),'different seed, different board'); }
{ let bad=0, tot=0; for(const L of X.LAYOUTS.slice(0,QUICK?8:30)) for(let s=0;s<(QUICK?4:10);s++){ const st=X.newGame({lid:L.id,diff:L.diff,seed:'sh'+s,trap:.5,shuffles:'inf',undo:true}); const rng=X.seedRng('sh'+s);
    for(let k=0;k<s*3;k++){ const pr=X.matchable(st); if(!pr.length) break; const [a,b]=pr[Math.floor(rng()*pr.length)]; X.removePair(st,a,b); }
    if(!X.shuffleBoard(st,'x'+s)) continue; tot++; if(!replay(L,st.faces,st.gone,st.order)) bad++;
    const cnt={}; st.faces.forEach((f,i)=>{ if(!st.gone[i]){ const k=X.matchKey(f); cnt[k]=(cnt[k]||0)+1; } }); if(Object.values(cnt).some(v=>v%2)) bad++; }
  ok(bad===0&&tot>(QUICK?20:150),`every shuffle is winnable and keeps the faces (${tot} shuffles)`); }

section('solver');
{ const L=X.layoutById('courtyard'), g=X.generate(L,'normal','grade',.3); const a=X.gradeBoard(L,g.faces,'grade'), b=X.gradeBoard(L,g.faces,'grade'); ok(a.rate===b.rate,'grading repeats for the same seed');
  eq([X.gradeOf(.8),X.gradeOf(.6),X.gradeOf(.3),X.gradeOf(.1)],['easy','normal','hard','expert'],'grade thresholds'); }
{ let hints=0, badHint=0, warnWrong=0, checked=0, quiet=0, maxGap=0;
  for(const L of X.LAYOUTS.slice(0,QUICK?10:30)) for(let s=0;s<(QUICK?2:4);s++){ const st=X.newGame({lid:L.id,diff:L.diff,seed:'h'+s,trap:.5,shuffles:'inf',undo:true}); let ref=st.order; const rng=X.seedRng('hl'+s);
    for(let k=0;k<L.n/2-1;k++){ const r=X.solveState(st,{ref,limit:120000}); checked++;
      if(r.win){ ref=r.line; hints++; const [a,b]=r.line[0]; const g=st.gone.slice(); g[a]=g[b]=1; if(!replay(L,st.faces,g,r.line.slice(1))) badHint++; }
      // walk along winning lines mostly, with some random pairs (which may lead to dead positions)
      const pr=X.matchable(st); if(!pr.length) break; const pick=r.win&&rng()<.8?r.line[0]:pr[Math.floor(rng()*pr.length)];
      const onLine=r.win&&pick===r.line[0]; X.removePair(st,pick[0],pick[1]);
      if(onLine){ const w=X.solveState(st,{ref:r.line.slice(1),limit:120000}); if(!w.win&&!w.timeout) warnWrong++; } } }
  ok(badHint===0,`hints keep the board winnable (${hints} hints)`); ok(warnWrong===0,`"still winnable?" never warns on a winnable position (${checked} positions)`);
  const L=X.layoutById('turtle'), g=X.generate(L,'expert','to',1); const r=X.solve(L,g.faces,zeros(L.n),{limit:5}); ok(!r.win&&r.timeout,'a timeout says so (the warning stays quiet)');
  // slices: time between yields
  const st=X.newGame({lid:'bigheart',diff:'expert',seed:'slice',trap:1,shuffles:'inf',undo:true}); const gen=X.solveGen(X.layoutOf(st),st.faces,st.gone,{limit:60000}); let t=Date.now(), x;
  do { x=gen.next(); const now=Date.now(); maxGap=Math.max(maxGap,now-t); t=now; } while(!x.done);
  ok(maxGap<8,`solver work between yields stays under 8 ms (max ${maxGap} ms in Node)`);
  // dead positions are found
  const pos=[[0,0,0],[0,0,1],[4,0,0],[4,0,1]], L2=Object.assign({id:'t',n:4,pos},X.geom(pos)); const d=X.solve(L2,[5,6,6,5],zeros(4)); ok(!d.win&&!d.timeout,'a dead position is proved dead'); }

section('layouts');
const SIZE={easy:72,normal:108,hard:144,expert:144};
ok(X.LAYOUTS.length===30,'30 layouts (26 bundled + 4 special)'); eq(['easy','normal','hard','expert'].map(d=>X.layoutsFor(d).length),[7,8,7,4],'7 Easy, 8 Normal, 7 Hard, 4 Expert');
ok(X.LAYOUTS.filter(L=>L.special).map(L=>L.id).sort().join()==='constellation,dragon,lotus,pagoda','the 4 special layouts');
for(const L of X.LAYOUTS){ ok(L.n===SIZE[L.diff]&&L.n%2===0,`${L.id}: ${SIZE[L.diff]} positions`);
  const key=new Set(); let overlap=false, floating=false; const cells=new Set();
  for(const [x,y,z] of L.pos){ for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]){ const k=`${x+dx},${y+dy},${z}`; if(cells.has(k)) overlap=true; cells.add(k); } }
  for(const [x,y,z] of L.pos) if(z>0) for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]) if(!cells.has(`${x+dx},${y+dy},${z-1}`)) floating=true;
  ok(!overlap,`${L.id}: no two tiles share space`); ok(!floating,`${L.id}: every upper tile is fully supported`);
  const layers=Math.max(...L.pos.map(p=>p[2]))+1, want={easy:[2,4],normal:[3,4],hard:[4,5],expert:[5,9]}[L.diff];
  if(!L.special) ok(layers>=want[0]&&layers<=want[1]||L.diff==='easy'&&layers<=4,`${L.id}: ${layers} layers (want ${want.join('–')})`); }
ok(X.LAYOUTS.filter(L=>L.shaped).length>=9,'shaped layouts from Sweep\'s masks');

section('Daily');
{ const prints=[]; for(let d=0;d<120;d++){ const date=new Date(Date.UTC(2026,10,25)+d*864e5).toISOString().slice(0,10), b=X.dailyBoard(date), b2=X.dailyBoard(date);
    const g=X.generate(X.layoutById(b.lid),b.diff,b.seed,b.trap); prints.push(X.boardPrint(b.lid,g.faces)); if(JSON.stringify(b)!==JSON.stringify(b2)) ok(false,'daily repeat '+date);
    const [dd,gr]=X.DAILY_DAYS[X.weekdayOf(date)]; if(b.diff!==dd||b.grade!==gr) ok(false,`weekday table ${date}`);
    if(d<(QUICK?10:120)){ const gg=X.gradeBoard(X.layoutById(b.lid),g.faces,b.seed); if(gg.grade!==b.grade) ok(false,`daily ${date} grade ${gg.grade} want ${b.grade}`); } }
  ok(new Set(prints).size>100,'Daily boards differ day to day (120 days)');
  eq(X.weekdayOf('2026-11-23'),0,'2026-11-23 is a Monday');
  eq(X.DAILY_DAYS.map(d=>d.join(' ')),['easy easy','normal easy','normal normal','hard normal','hard hard','hard hard','expert expert'],'weekday table: Mon Easy … Sun Expert');
  const pin=date=>{ const b=X.dailyBoard(date), g=X.generate(X.layoutById(b.lid),b.diff,b.seed,b.trap); return b.lid+'|'+X.boardPrint(b.lid,g.faces); };
  eq(pin('2026-11-25'),'courtyard|0c4ea348','pinned Daily 2026-11-25'); eq(pin('2027-01-01'),'spire|ddaef8f6','pinned Daily 2027-01-01');
  const S=X.defSave(); const date='2026-11-25', b=X.dailyBoard(date), st=X.newGame(b); const line=X.solveState(st,{ref:st.order}).line; for(const [p,q] of line){ st.t+=1000; X.removePair(st,p,q); }
  const r=X.dailyResult(S,date,st,date); eq(r.xp,40,'release-day XP doubles 20'); ok(X.dailyResult(S,date,st,date)===null,'one scored attempt');
  ok(S.dcount===1&&S.dstreak.cur===1,'Daily count and streak');
  const S2=X.defSave(); eq(X.dailyResult(S2,date,st,'2026-11-26').xp,20,'a late clear pays 20');
  eq(X.shareLine(date,true,408000,3,false),'Mahjong Daily · Wed 25 Nov · 6:48 · ★★★','share line'); ok(/\(assisted\)$/.test(X.shareLine(date,true,408000,2,true)),'assisted mark'); }

section('campaign');
{ eq(X.LEVELS.length,45,'45 levels'); const S=X.defSave();
  for(const Lv of X.LEVELS){ const cfg=X.levelCfg(Lv), st=X.newGame(cfg);
    if(Lv.ta&&!st.ta) ok(false,Lv.id+' Time Attack'); if(Lv.fog&&!st.seen) ok(false,Lv.id+' Fog'); if(Lv.shuffles===0&&X.canShuffle(st)) ok(false,Lv.id+' no shuffles'); if(Lv.undo===false&&st.cfg.undo!==false) ok(false,Lv.id+' no undo');
    if(Lv.type==='puzzle'){ ok(X.tilesLeft(st)<X.layoutOf(st).n,`${Lv.id}: the puzzle starts part-cleared`); const r=X.solveState(st,{limit:400000}); ok(r.win,`${Lv.id}: the puzzle can be won without shuffles`); } }
  eq(X.LEVELS.filter(L=>L.type==='shaped').map(L=>L.n).join(),'4,8,12,4,8,12,4,8,12','shaped layouts at 4, 8, 12');
  eq(X.LEVELS.filter(L=>L.type==='twist').map(L=>L.id).join(),'G7,G14,T7,T14,S7,S14','twists at 7 and 14');
  eq(X.LEVELS.filter(L=>L.type==='puzzle').map(L=>L.id).join(),'G10,T10,S10','puzzles at 10'); eq(X.levelById('S15').lid,'turtle','Summit finale is the Turtle');
  // the blind bot (with shuffles where allowed, retrying where not) clears every level
  let cleared=0; for(const Lv of X.LEVELS){ let won=false;
    for(let a=0;a<(QUICK?20:60)&&!won;a++){ const st=X.newGame(X.levelCfg(Lv)), L=X.layoutOf(st), rng=X.seedRng(Lv.id+'|bot'+a); let sh=0;
      while(!st.over){ const r=X.botPlay(L,st.faces,st.gone,rng); if(r.win){ won=true; break; }
        // replay the bot's progress is not kept by botPlay; take one heuristic pair at a time instead
        const pr=X.matchable(st); if(pr.length){ const [p,q]=pr[Math.floor(rng()*pr.length)]; X.removePair(st,p,q); continue; }
        if(X.canShuffle(st)&&sh<20){ sh++; X.shuffleBoard(st,Lv.id+a+'|'+sh); continue; } break; } }
    if(won) cleared++; else ok(false,`${Lv.id}: the bot can't clear it`); }
  ok(cleared===45,`the bot clears every level (${cleared}/45)`);
  const Lv=X.levelById('G1'); X.campaignResult(S,Lv,[1,0,1]); let c=X.campOf(S,'G1').s.join(''); eq(c,'101','stars from the first attempt'); const r=X.campaignResult(S,Lv,[1,1,0]); eq(X.campOf(S,'G1').s.join(''),'111','stars build up across attempts'); eq(r.xp,6,'XP only for the new star');
  ok(X.unlocked(S,X.levelById('G2'))&&!X.unlocked(S,X.levelById('G3')),'clearing a level unlocks the next');
  const S3=X.defSave(); X.LEVELS.filter(L=>L.camp===0).forEach(L=>X.campaignResult(S3,L,[1,0,0])); ok(X.campOpen(S3,1)&&!X.campOpen(S3,2),'finishing Garden opens Temple'); }

section('core');
{ const S=X.loadSave(JSON.stringify({xp:120,rec:{cleared:3}})); ok(S.xp===120&&S.rec.cleared===3&&S.rec.wins.easy===0&&S.look.face==='classic','old saves fill new fields from defSave()');
  ok(X.loadSave('nonsense').xp===0,'a broken save starts fresh');
  // mid-game restore, with Fog and the Time Attack clock
  const st=X.newGame({lid:'fortress',diff:'hard',seed:'res',trap:.5,shuffles:3,undo:true,fog:true,ta:true}); const line=X.solveState(st,{ref:st.order}).line; for(const [p,q] of line.slice(0,9)){ X.tickClock(st,700); X.removePair(st,p,q); } X.tap(st,line[9][0],st.t);
  const back=JSON.parse(JSON.stringify(st)); ok(JSON.stringify(back)===JSON.stringify(st)&&back.ta.left===st.ta.left&&back.seen.join()===st.seen.join()&&back.sel===st.sel,'a game mid-move restores exactly');
  X.removePair(back,line[9][0],line[9][1]); ok(back.gone[line[9][0]],'…and plays on');
  for(let l=2;l<=10;l++) ok(X.rewardsAt(l).length>0,`level ${l} has a reward`);
  const S2=X.defSave(); S2.hints=2; const up=X.addXP(S2,160); eq([up.after,S2.hints],[3,4],'XP levels and +1 hint per level-up'); X.refreshHints(S2,'2026-11-25'); eq(S2.hints,5,'hints refill to 5'); S2.hints=7; X.refreshHints(S2,'2026-11-26'); eq(S2.hints,7,'earned hints stack above the cap');
  // XP rules
  const w=X.newGame({lid:'terrace',diff:'easy',seed:'xp',trap:0,shuffles:0,undo:true,fog:false,ta:true}); w.won=true; eq(X.classicXP(w),20,'Classic XP: Easy 10 + no shuffles 5 + Time Attack 5'); w.assists.hint=1; eq(X.classicXP(w),10,'assisted wins earn half');
  // achievements
  const A=X.defSave(); A.rec.cleared=99; const g=X.newGame({lid:'terrace',diff:'easy',seed:'a',trap:0,shuffles:'inf',undo:true}); g.won=true; X.addClear(A,g); const got=X.checkAch(A,{mode:'classic',st:g,diff:'easy',stars:[1,1,1]});
  ok(['c10','c50','c100','clr_easy','par_easy','pure_easy'].every(id=>got.includes(id)),'cumulative clears and difficulty achievements');
  ok(X.owned(A,X.findCos('win','cascade')),'Centurion unlocks Tile Cascade');
  A.week=[1,1,1,1,1,1,1]; A.dcount=30; A.d3=10; const g2=X.checkAch(A,{mode:'daily'}); ok(['fullweek','d7','d30','s1','s10'].every(id=>g2.includes(id)),'Daily counts, 3-star counts and Full Week');
  ok(X.ACH.length===37,'37 achievements'); const all=X.COS_KINDS.reduce((a,[k])=>a+X.COS[k].length,0); ok(all===38,'38 cosmetics');
  ok(X.COS.face.every(it=>X.FACESETS[it.id])&&X.COS.body.every(it=>X.BODIES[it.id]),'every face set and body is drawn');
  ok(!X.layoutOpen(X.defSave(),X.layoutById('dragon'))&&X.layoutOpen(X.defSave(),X.layoutById('turtle')),'special layouts start locked');
  // backup
  const B=X.defSave(); B.xp=777; const code=X.backupPlain(B); ok(/^MAHJONG1\./.test(code)&&X.parseBackup('text '+code+' more').xp===777,'backup round trip'); ok(X.parseBackup('TILECRAFT1.abc')===null,'other games\' backups are refused');
  // Arcade contract
  const arc={set:{appearance:'dark',music:false,sfx:false,motion:false,haptics:false,fullscreen:true,cb:true,lefty:true,lang:'de'},name:'Ali'}; const P=X.applyShared(X.defSave(),arc);
  ok(P.appearance==='dark'&&P.music===false&&P.lefty===true&&P.lang==='de'&&P.name==='Ali','shared settings and the name come from arcade.v1');
  const sm=X.summary(X.defSave()); ok(['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last'].every(k=>k in sm)&&sm.game==='mahjong'&&sm.maxLevel===10&&sm.ach.length===37&&sm.hi.length===3,'the summary has every field');
  eq(sm.hi.map(h=>h[0]),['Boards cleared','Campaign stars','Daily streak'],'summary highlights'); }

section('sources');
{ const app=fs.readFileSync(path.join(__dirname,'../src/app.html'),'utf8'), core=fs.readFileSync(path.join(__dirname,'../src/core.js'),'utf8');
  ok(/ARCADE_HOME='\.\.\/index\.html', ARCADE_PREFS='\.\.\/index\.html#prefs'/.test(app),'ARCADE_HOME and ARCADE_PREFS');
  ok(!/location\.href\s*=|location\.assign/.test(app)&&/location\.replace\(url\)/.test(app),'leaves only with location.replace');
  ok(/location\.hash==='#game-settings'/.test(app)&&/history\.replaceState/.test(app),'#game-settings opens settings and clears the hash');
  ok(/id="arcadeBtn"/.test(app)&&/id="settingsBtn"/.test(app),'#arcadeBtn and #settingsBtn exist');
  ok(!/serviceWorker/.test(app),'no service worker');
  const keys=[...(app+core).matchAll(/store\.set\(\s*(['"`])([^'"`]+)\1/g)].map(m=>m[2]); ok(keys.every(k=>k.startsWith('mahjong.')),'only mahjong.* keys are written: '+keys.join(','));
  ok(/KEY='mahjong\.v1'/.test(core)&&/SUMKEY='arcade\.summary\.mahjong'/.test(core),'save and summary keys');
  ok(!/arcade\.v1['"]\s*,/.test(app.replace(/readArcade/g,'')),'arcade.v1 is never written');
  ok(!/Shanghai/i.test(app+core+fs.readFileSync(path.join(__dirname,'../src/levels.js'),'utf8')),'the name Shanghai appears nowhere');
  ok(!/https?:\/\/(?!www\.w3\.org)/.test(app),'no outside requests in the page'); }

const r=res(); console.log(`\n${r.pass} passed, ${r.fail} failed in ${Math.round((Date.now()-t0)/1000)} s${QUICK?' (QUICK)':''}`); process.exit(r.fail?1:0);
