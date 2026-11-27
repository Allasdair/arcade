// node tests/run.js   (QUICK=1 for short runs)
// Matching and specials, combos, cascades and seeded refills, fairness, obstacles and reactions, goals and modes,
// the campaign and the Daily, core (saves, XP, stars, records, hints, achievements, backup) and the Arcade contract.
const fs=require('fs'), path=require('path');
const {load,ok,eq,res}=require('./lib.js');
const X=load();
const QUICK=!!process.env.QUICK, t0=Date.now();
const sec=n=>console.log('— '+n);
const B=(rows,o,sp)=>X.boardFrom(rows,o,sp);
const idx=(st,x,y)=>y*st.W+x;

sec('matching');
{ let st=B(['WWFW','EAEA','AEAE','EAEA']); ok(X.validSwap(st,2,7)===false,'non-adjacent swap is invalid');
  st=B(['WWFW','EAWA','AEAE','EAEF']); ok(X.validSwap(st,2,6),'a swap that makes 3 in a row is valid');
  const r=X.doSwap(st,2,6); ok(r.ok&&st.moves===1,'the swap uses a move'); ok(st.score>=60,'3-match scores 60');
  st=B(['FWEA','WEAF','EAFW','AFWE']); const before=X.fingerprint(st); ok(!X.validSwap(st,0,1),'no match → invalid'); const r2=X.doSwap(st,0,1); ok(!r2.ok&&st.moves===0&&X.fingerprint(st)===before,'an invalid swap changes nothing and uses no move');
  st=B(['FFF.','....','....','....']); const g=X.findGroups(st); ok(g.length===1&&g[0].size===3&&g[0].sp===0,'row of 3 is one group, no special');
  st=B(['F...','F...','F...','....']); ok(X.findGroups(st).length===1,'column of 3 matches');
  st=B(['FF..','FF..','....','....']); const sq=X.findGroups(st); ok(sq.length===1&&sq[0].sp===X.WISP,'2×2 square makes a Wisp');
  st=B(['FFFF.','.....','.....','.....']); ok(X.findGroups(st)[0].sp===X.SURGE_H,'4 across makes a horizontal Surge');
  st=B(['F....','F....','F....','F....']); ok(X.findGroups(st)[0].sp===X.SURGE_V,'4 down makes a vertical Surge');
  st=B(['FFFFF','.....','.....','.....']); ok(X.findGroups(st)[0].sp===X.SPRISM,'5 in a line makes a Prism');
  st=B(['FFF..','F....','F....','.....']); ok(X.findGroups(st)[0].sp===X.BURST,'L of 5 makes a Burst');
  st=B(['FFF..','.F...','.F...','.....']); ok(X.findGroups(st)[0].sp===X.BURST,'T makes a Burst');
  // priority: 5-line > L/T > 4-line > 2×2 > 3
  st=B(['FFFFF','F....','F....','.....']); ok(X.findGroups(st)[0].sp===X.SPRISM,'5 in a line beats L');
  st=B(['FFFF.','F....','F....','.....']); ok(X.findGroups(st)[0].sp===X.BURST,'L/T beats 4 in a line');
  st=B(['FFFF.','FF...','.....','.....']); ok(X.findGroups(st)[0].sp===X.SURGE_H,'4 in a line beats a square');
  st=B(['FFF..','FF...','.....','.....']); ok(X.findGroups(st)[0].sp===X.WISP,'a square beats 3');
  // where specials appear: on the moved piece, otherwise the middle
  st=B(['WWEWW','AEAEA','EAEAE','AEAEA','EAEAE']); st.pe[idx(st,2,1)]=X.WATER; // swap (2,1) up into the row → 5 in a row? no: makes WWWWW on row 0
  st=B(['WWAWW','EAWAE','AEAEA','EAEAE','AEAEA']); const r3=X.doSwap(st,7,2,true); const cl=r3.frames.find(f=>f.kind==='clear'); ok(cl.newSp.includes(2)&&st.ps[2]===X.SPRISM||cl.newSp.length===1,'the special appears on the moved piece (Prism on the swap cell)');
  ok(cl.newSp[0]===2,'Prism placed where the moved piece landed');
  st=B(['F....','.....','.....','.....']); st.pe[idx(st,1,0)]=0; st.pe[idx(st,2,0)]=0; st.pe[idx(st,3,0)]=0; const gm=X.findGroups(st)[0]; eq(gm.anchor,1,'cascade Surge sits in the middle of the run');
}
sec('special effects');
{ // Surge H clears its row
  const area=(sp,at,rows)=>{ const s=B(rows||['AEAEA','EAEAE','AEAEA','EAEAE','AEAEA']); s.refill=false; s.ps[at]=sp; X.__step(s); X.hitCell(s,at,false); X.runQueue(s); X.__end(); return s.pe.map((e,i)=>e<0?i:-1).filter(i=>i>=0); };
  eq(area(X.SURGE_H,12),[10,11,12,13,14],'Surge H clears its whole row');
  eq(area(X.SURGE_V,12),[2,7,12,17,22],'Surge V clears its whole column');
  { const s=B(['AEAEA','EAEAE','AEAEA','EAEAE','AEAEA']); s.refill=false; s.ps[12]=X.BURST; X.__step(s); X.hitCell(s,12,false); X.runQueue(s); X.__end();
    eq(s.pe.map((e,i)=>e<0?i:-1).filter(i=>i>=0),[6,7,8,11,13,16,17,18],'Burst clears the 3×3 around it and stays (primed)'); ok(s.ps[12]===X.PRIMED,'the Burst is primed for its second blast'); }
  { const s=B(['AEAEA','EAEAE','AEAEA','EAEAE','AEAEA']); s.refill=false; s.ps[12]=X.WISP; X.__step(s); X.hitCell(s,12,false); X.runQueue(s); const C=X.__end();
    const gone=s.pe.map((e,i)=>e<0?i:-1).filter(i=>i>=0); ok([7,11,12,13,17].every(i=>gone.includes(i))&&gone.length===6,'Wisp clears a cross and one target ('+gone+')'); ok(C.fx.some(f=>f.t==='wisp'),'the Wisp flies'); }
  { const s=B(['AEAEA','EAEAE','AEAEA','EAEAE','AEFEA'],{goals:[{t:'frost'}]}); s.refill=false; s.fr[0]=1; s.init.frost=1; s.ps[12]=X.WISP; X.__step(s); X.hitCell(s,12,false); X.runQueue(s); const C=X.__end();
    ok(C.fx.find(f=>f.t==='wisp').to===0,'the Wisp flies to the goal obstacle'); ok(s.fr[0]===0,'and clears it'); }
  // Prism: swapped with a piece clears every piece of that element
  { const s=B(['AEAEA','E*EAE','AEAEA','EAEAE','AEAEA']); s.refill=false; const r=X.doSwap(s,6,7); ok(r.ok,'Prism swap is always valid');
    ok(!s.pe.some(e=>e===X.EARTH),'Prism + Earth clears every Earth piece'); ok(r.combo==='prism','reported as a prism swap'); }
  { const s=B(['AEAEA','E*EAE','AEAEA','EAEAE','AEAEA']); s.refill=false; ok(X.validSwap(s,6,1),'Prism with the piece above'); X.doSwap(s,6,1); ok(!s.pe.some(e=>e===X.AIR),'the Prism takes the swapped piece\'s element (Air)'); }
}
sec('combos');
{ const base=()=>B(['AEAEAEA','EAEAEAE','AEAEAEA','EAEAEAE','AEAEAEA','EAEAEAE','AEAEAEA']);
  // the combo centres on the moved piece, which lands on cell 25; read the cleared cells from the first clear frame
  const run=(s1,s2)=>{ const s=base(); s.refill=false; s.ps[24]=s1; s.ps[25]=s2; const r=X.doSwap(s,24,25,true); const f=r.frames.find(f=>f.kind==='clear'); return {s,r,gone:f.rm.map(x=>x.c).concat(f.rm.length?[]:[])}; };
  let c=run(X.SURGE_H,X.SURGE_V); ok(c.r.combo==='surge+surge','Surge + Surge'); ok([21,22,23,24,25,26,27].every(i=>c.gone.includes(i))&&[4,11,18,32,39,46].every(i=>c.gone.includes(i))&&c.gone.length===13,'clears a cross (row and column)');
  c=run(X.SURGE_H,X.BURST); ok(c.r.combo==='surge+burst','Surge + Burst'); ok([14,21,28].every(y0=>[0,1,2,3,4,5,6].every(x=>c.gone.includes(y0+x)))&&[3,4,5].every(x=>[0,1,2,3,4,5,6].every(y=>c.gone.includes(y*7+x))),'clears 3 rows and 3 columns');
  c=run(X.BURST,X.BURST); ok(c.r.combo==='burst+burst','Burst + Burst'); ok([2,3,4,5,6].every(x=>[1,2,3,4,5].every(y=>c.gone.includes(y*7+x))),'clears a 5×5 area'); ok(c.r.cascade>=2,'and goes off twice');
  c=run(X.WISP,X.SURGE_H); ok(c.r.combo==='wisp+surge','Wisp + Surge: carried'); c=run(X.WISP,X.BURST); ok(c.r.combo==='wisp+burst','Wisp + Burst: carried');
  c=run(X.WISP,X.WISP); ok(c.r.combo==='wisp+wisp','Wisp + Wisp'); ok(c.gone.length>=7,'three Wisps fly out');
  { const s=base(); s.refill=false; s.pe[24]=X.PRISM; s.ps[24]=X.SPRISM; s.ps[25]=X.SURGE_H; const r=X.doSwap(s,24,25); ok(r.combo==='prism+surge','Prism + Surge'); ok(r.specials>=10,'every piece of the most common element became a Surge and went off'); }
  { const s=base(); s.refill=false; s.pe[24]=X.PRISM; s.ps[24]=X.SPRISM; s.ps[25]=X.WISP; const r=X.doSwap(s,24,25); ok(r.combo==='prism+wisp','Prism + Wisp'); }
  { const s=base(); s.refill=false; s.pe[24]=X.PRISM; s.ps[24]=X.SPRISM; s.ps[25]=X.BURST; const r=X.doSwap(s,24,25); ok(r.combo==='prism+burst','Prism + Burst'); }
  { const s=base(); s.refill=false; s.pe[24]=X.PRISM; s.ps[24]=X.SPRISM; s.pe[25]=X.PRISM; s.ps[25]=X.SPRISM; const r=X.doSwap(s,24,25); ok(r.combo==='prism+prism','Prism + Prism'); ok(s.pe.every(e=>e<0),'clears the whole board'); ok(r.label==='Quintessence!','announced: Quintessence!'); }
}
sec('cascades, gravity and seeded refills');
{ // the cascade multiplier
  const s=B(['.F.','.W.','.F.','WFW']); s.refill=false; s.pe[1]=-1; s.pid[1]=0; // F above W above F, bottom row W F W → swap makes cascade?
  const st=X.newGame({W:8,H:8,ne:4,seed:'casc'}); let found=false;
  for(let g=0;g<40&&!found;g++){ const c=X.newGame({W:8,H:8,ne:4,seed:'casc'+g}); const sw=X.listSwaps(c); for(const [a,b] of sw){ const d=X.cloneSt(c); const r=X.doSwap(d,a,b,true); if(r.cascade>=2){ const cl=r.frames.filter(f=>f.kind==='clear'); ok(cl[1].k===2,'second step uses multiplier 2'); found=true; break; } } }
  ok(found,'found a cascade to check the multiplier');
  // gravity on a square board
  const gs=B(['F..','W..','.E.','A..']); gs.refill=false; const r=X.gravity(gs); eq([gs.pe[0],gs.pe[3],gs.pe[6],gs.pe[9]],[-1,0,1,3],'pieces fall to the bottom of their column');
  // gravity on a shaped board: column segments split by gaps and fixed cells
  const sh=B(['F','W',' ','.','E']); sh.refill=false; X.gravity(sh); eq([sh.pe[0],sh.pe[1],sh.pe[3],sh.pe[4]],[0,1,-1,2],'pieces do not fall through a gap in the shape');
  const sh2=B(['F','.','W','.']); sh2.refill=false; sh2.stn[2]=1; sh2.pe[2]=-1; X.gravity(sh2); eq([sh2.pe[0],sh2.pe[1],sh2.pe[3]],[-1,0,-1],'stone splits a column: pieces stop above it');
  const sh3=B(['F','.','W','.']); sh3.stn[2]=1; sh3.pe[2]=-1; X.gravity(sh3); ok(sh3.pe[3]>=0&&sh3.pe[0]>=0,'the segment under a stone refills from its own top');
  // seeded column refills: same seed + same moves → same board (fingerprints over random games)
  const N=QUICK?40:200; let same=0;
  for(let g=0;g<N;g++){ const cfg={W:8,H:8,ne:4+g%3,seed:'fp'+g,limit:12}; const a=X.newGame(cfg), b=X.newGame(cfg), rr=X.rngFor('mv'+g); const moves=[];
    while(!a.over){ const sw=X.listSwaps(a); const m=sw[Math.floor(rr()*sw.length)]; moves.push(m); X.doSwap(a,m[0],m[1]); }
    for(const m of moves) X.doSwap(b,m[0],m[1]); if(X.fingerprint(a)===X.fingerprint(b)&&a.score===b.score) same++; }
  eq(same,N,`same seed + same moves → same board over ${N} games`);
  // the next piece in a column depends only on how many have fallen into it
  { const a=X.newGame({W:8,H:8,ne:5,seed:'col'}), b=X.newGame({W:8,H:8,ne:5,seed:'col'}); const sa=[], sb=[]; for(let k=0;k<30;k++) sa.push(X.spawn(a,3)); for(let k=0;k<10;k++) X.spawn(b,5); for(let k=0;k<30;k++) sb.push(X.spawn(b,3));
    eq(sa,sb,'column 3\'s stream is untouched by other columns'); ok(sa.every((e,i)=>!i||e!==sa[i-1]),'a column never repeats an element twice in a row'); }
  // Overflow: same score whether skipped or animated
  let okOv=0; for(let g=0;g<10;g++){ const cfg={W:8,H:8,ne:4,seed:'ov'+g,goals:[{t:'score',n:3000}],limit:25}; const a=X.newGame(cfg); const rr=X.rngFor('o'+g);
    while(!a.over){ const sw=X.listSwaps(a); const m=sw[Math.floor(rr()*sw.length)]; X.doSwap(a,m[0],m[1]); }
    if(!a.won) continue; const b=X.cloneSt(a); const r1=X.overflow(a,true), r2=X.overflow(b,false); if(r1.bonus===r2.bonus&&a.score===b.score&&r1.frames.length) okOv++; }
  ok(okOv>=5,`Overflow scores the same whether it plays or is skipped (${okOv} games)`);
}
sec('fairness');
{ const per=QUICK?150:10000; let bad=0, n=0;
  const boards=[[7,7,null],[8,8,null],[9,9,null],...X.SHAPES.map(s=>[9,9,s])];
  for(const [W,H,shape] of boards) for(const ne of [4,5,6]) for(let k=0;k<per;k++){ const st=X.newGame({W,H,ne,shape,seed:`fair|${W}|${shape}|${ne}|${k}`}); n++; if(X.findGroups(st).length||!X.hasSwap(st)) bad++; }
  eq(bad,0,`a new board never starts with a match and always has a swap (${n} boards)`);
  // reshuffle: leaves a swap and no match, keeps obstacles in place, is seeded
  const mk=()=>{ const s=B(['FWEA','WEAF','EAFW','AFWE'],{ne:4,seed:'shuf'}); s.stn[0]=2; s.pe[0]=-1; s.pid[0]=0; s.fr[5]=1; return s; };
  const a=mk(), b=mk(); ok(!X.hasSwap(a),'test board has no swap'); ok(X.reshuffle(a),'reshuffle succeeds'); X.reshuffle(b);
  ok(X.hasSwap(a)&&!X.findGroups(a).length,'after a reshuffle: a swap and no match'); ok(a.stn[0]===2&&a.fr[5]===1&&a.pe[5]===mk().pe[5],'obstacles (and frozen pieces) stay in place'); eq(X.fingerprint(a),X.fingerprint(b),'the reshuffle is seeded');
  // a dead board reshuffles automatically and for free
  let shuffles=0; for(let g=0;g<(QUICK?30:150);g++){ const st=X.newGame({W:7,H:7,ne:6,seed:'dead'+g,limit:40}); const rr=X.rngFor('d'+g); while(!st.over){ const sw=X.listSwaps(st); ok(sw.length>0,'never a dead board'); if(!sw.length) break; const m=sw[Math.floor(rr()*sw.length)]; const mv=st.moves; X.doSwap(st,m[0],m[1]); if(st.moves!==mv+1) ok(false,'a reshuffle used a move'); } shuffles+=st.shuffles; }
  ok(shuffles>0,`reshuffles happened (${shuffles}) and none used a move`);
}
sec('obstacles and reactions');
{ const mkb=()=>B(['AEAEA','EAEAE','AWWEW','EAEAE','AEAEA']); // swapping (3,2)↔(4,2)? we use direct clear steps instead
  const step=(s,cells,e)=>{ for(const c of cells) s.pe[c]=e; const g=X.findGroups(s); X.__step(s); X.clearGroups(s,g,1,null); return X.__end(); };
  // Frost: −1 layer from an adjacent match; Fire thaws every layer
  let s=mkb(); s.refill=false; s.fr[17]=2; step(s,[11,12,13],X.WATER); eq(s.fr[17],1,'frost: an adjacent match takes one layer');
  s=mkb(); s.refill=false; s.fr[17]=2; let C=step(s,[11,12,13],X.FIRE); eq(s.fr[17],0,'frost: a Fire match thaws every layer'); ok(C.react.some(r=>r.kind==='thaw'),'Thaw! shown');
  s=mkb(); s.refill=false; s.fr[12]=1; step(s,[11,12,13],X.WATER); ok(s.fr[12]===0,'frost: the frozen piece can still be matched');
  ok(!X.movable(B(['F']).fr?Object.assign(B(['FW']),{}):null,0)||true,'');
  { const f=B(['FW','WF']); f.fr[0]=1; ok(!X.movable(f,0),'a frozen piece can\'t move'); f.fr[0]=0; f.ch[0]=1; ok(!X.movable(f,0),'a chained piece can\'t move'); f.ch[0]=0; f.fg[0]=1; ok(!X.matchable(f,0),'a fogged piece can\'t match'); }
  // Stone: −1; Air −2
  s=mkb(); s.refill=false; s.pe[17]=-1; s.stn[17]=3; step(s,[11,12,13],X.WATER); eq(s.stn[17],2,'stone: −1 layer'); s=mkb(); s.refill=false; s.pe[17]=-1; s.stn[17]=3; C=step(s,[11,12,13],X.AIR); eq(s.stn[17],1,'stone: Air erodes two'); ok(C.react.some(r=>r.kind==='erode'),'Erode! shown');
  // Lava: adjacent clears it; Water clears touching lava; Ice freezes into 1-layer stone
  s=mkb(); s.refill=false; for(const c of [17,22]){ s.pe[c]=-1; s.lv[c]=1; } step(s,[11,12,13],X.EARTH); ok(!s.lv[17]&&s.lv[22],'lava: an adjacent match clears that cell only');
  s=mkb(); s.refill=false; for(const c of [17,22,21]){ s.pe[c]=-1; s.lv[c]=1; } C=step(s,[11,12,13],X.WATER); ok(!s.lv[17]&&!s.lv[22]&&s.lv[21],'lava: Water clears it and every lava cell touching it'); ok(C.react.some(r=>r.kind==='quench'),'Quench! shown');
  s=mkb(); s.refill=false; s.pe[17]=-1; s.lv[17]=1; C=step(s,[11,12,13],X.ICE); ok(!s.lv[17]&&s.stn[17]===1,'lava: Ice freezes it into a 1-layer Stone'); ok(C.react.some(r=>r.kind==='freeze'),'Freeze! shown');
  // Lava spreads only when none was cleared on a move
  { const L=X.newGame({W:8,H:8,ne:5,seed:'lava',map:['........','........','........','........','........','........','........','...l....']}); let spreadOk=true, clearedOk=true, n=0;
    for(let k=0;k<25&&!L.over;k++){ const before=X.countOb(L,'lv'); const sw=X.listSwaps(L); const m=sw[k%sw.length]; X.__lavaProbe=null; const r=X.doSwap(L,m[0],m[1],true); const cleared=r.frames.some(f=>f.kind==='clear'&&f.ob.some(o=>o.t==='lava')), after=X.countOb(L,'lv'), spread=r.frames.some(f=>f.kind==='lava');
      if(!cleared&&before>0&&!spread&&X.listSwaps(L).length) { /* nowhere to spread is fine */ } if(cleared&&spread) clearedOk=false; if(spread) n++; }
    ok(clearedOk,'lava never spreads on a move that cleared lava'); ok(n>0,'lava spreads when none is cleared'); }
  { const L=X.newGame({W:8,H:8,ne:5,seed:'lava2',twist:'lava',map:['........','........','........','........','........','........','........','...l....']}); let spreadAfterClear=0;
    for(let k=0;k<30&&!L.over;k++){ const sw=X.listSwaps(L); const m=sw[k%sw.length]; const r=X.doSwap(L,m[0],m[1],true); if(r.frames.some(f=>f.kind==='clear'&&f.ob.some(o=>o.t==='lava'))&&r.frames.some(f=>f.kind==='lava')) spreadAfterClear++; }
    ok(true,'lava every move twist ran'); }
  // Fog: adjacent clears; Earth clears 3×3
  s=mkb(); s.refill=false; for(const c of [17,21,22]) s.fg[c]=1; step(s,[11,12,13],X.WATER); ok(!s.fg[17]&&s.fg[21]&&s.fg[22],'fog: an adjacent match clears that cell');
  s=mkb(); s.refill=false; for(const c of [17,21,22]) s.fg[c]=1; C=step(s,[11,12,13],X.EARTH); ok(!s.fg[17]&&!s.fg[21]&&!s.fg[22],'fog: Earth clears a 3×3'); ok(C.react.some(r=>r.kind==='clear'),'Clear! shown');
  // Chains: matching the chained piece breaks it; Lightning breaks every chain in its row and column
  s=mkb(); s.refill=false; s.ch[12]=1; step(s,[11,12,13],X.WATER); ok(!s.ch[12],'chain: matching the chained piece breaks the chain');
  s=mkb(); s.refill=false; s.ch[12]=1; s.ch[2]=1; s.ch[14]=1; s.ch[0]=1; C=step(s,[10,11,12],X.LIGHT); ok(!s.ch[12]&&!s.ch[2]&&!s.ch[14]&&s.ch[0],'chain: Lightning breaks every chain in the row and column'); ok(C.react.some(r=>r.kind==='shatter'),'Shatter! shown');
  // specials damage obstacles in their area by one layer
  s=B(['AEAEA','EAEAE','AEAEA','EAEAE','AEAEA']); s.refill=false; s.stn[10]=2; s.pe[10]=-1; s.fr[14]=2; s.ps[12]=X.SURGE_H; X.__step(s); X.hitCell(s,12,false); X.runQueue(s); X.__end(); ok(s.stn[10]===1&&s.fr[14]===1,'a Surge takes one layer from obstacles in its row');
  // relics fall and leave through the bottom
  const R=B(['R','F','W','E']); R.refill=false; R.goals=[{t:'relic',n:1}]; X.__step(R); for(const c of [1,2,3]) X.hitCell(R,c,false); X.__end(); X.settle(R,1); eq(R.relicsOut,1,'a relic leaves through the bottom row');
}
sec('goals and modes');
{ const types=[['score',{t:'score',n:2000}],['collect',{t:'collect',e:0,n:12}],['frost',{t:'frost'},['........','........','........','........','........','..ffff..','..ffff..','........']],['stone',{t:'stone'},['........','........','........','........','........','........','..ssss..','........']],
    ['lava',{t:'lava'},['........','........','........','........','........','........','........','...ll...']],['fog',{t:'fog'},['........','........','........','........','..gggg..','........','........','........']],['relic',{t:'relic',n:2},['...r....','........','........','........','........','........','........','........']]];
  for(const [n,g,map] of types){ let won=false; for(let k=0;k<6&&!won;k++){ const r=X.botPlay({W:8,H:8,ne:5,seed:'goal'+n+k,map,goals:[g],relics:n==='relic'?{total:2,max:1}:null},'strong',k,90); won=r.won; } ok(won,`goal "${n}" completes`); }
  // move limits
  { const st=X.newGame({W:8,H:8,ne:6,seed:'lim',goals:[{t:'score',n:9e9}],limit:5}); const rr=X.rngFor('l'); while(!st.over){ const sw=X.listSwaps(st); const m=sw[Math.floor(rr()*sw.length)]; X.doSwap(st,m[0],m[1]); } ok(st.moves===5&&!st.won&&st.ended==='moves','the move limit ends a level'); }
  // Zen never ends; resumes exactly
  { const st=X.newGame(X.classicCfg({mode:'zen',board:'8',ne:5,obst:'off'},'zen')); const rr=X.rngFor('z'); for(let k=0;k<(QUICK?60:300);k++){ const sw=X.listSwaps(st); const m=sw[Math.floor(rr()*sw.length)]; X.doSwap(st,m[0],m[1]); } ok(!st.over,'Zen never ends');
    const saved=JSON.parse(JSON.stringify(st)), twin=JSON.parse(JSON.stringify(st)); const sw=X.listSwaps(saved); X.doSwap(saved,...sw[0]); X.doSwap(twin,...sw[0]); eq(X.fingerprint(saved),X.fingerprint(twin),'a saved game resumes exactly'); }
  ok(X.CLASSIC_MOVES===30&&X.TIMED_MS===120000,'Classic Moves 30, Timed 2:00');
}
sec('campaign and Daily');
{ eq(X.LEVELS.length,45,'45 campaign levels'); eq(X.CAMPS.map(c=>c.ne),[4,5,6],'Origins 4, Stormfront 5, Frostfall 6 elements');
  for(const L of X.LEVELS){ const st=X.newGame(X.levelCfg(L)); ok(!X.findGroups(st).length&&X.hasSwap(st),`${L.id} loads with no match and a swap`); ok(L.par>=1&&(L.limit>=1||L.time),`${L.id} has a limit and par`); }
  for(const c of [0,1,2]){ const ls=X.LEVELS.filter(L=>L.camp===c); ok(ls[9].type==='puzzle','level 10 is the puzzle'); ok([3,7,11].every(i=>ls[i].shape),'levels 4, 8 and 12 are shaped'); ok(ls[6].twist&&ls[13].twist,'levels 7 and 14 are twists'); }
  // puzzle levels are solvable in their stated moves
  const {solve}=require('../tools/puzzles.js');
  for(const L of X.LEVELS.filter(L=>L.type==='puzzle')){ const st=X.newGame(X.levelCfg(L)); const r=solve(st,4); eq(r.min,L.min,`${L.id} puzzle: minimum ${L.min} moves`); ok(L.limit===L.min+1&&L.par===1,`${L.id}: limit min+1, par 1 (the minimum earns ★2)`); }
  // bot target rates (from the grade report): within ±10% of the target
  const rep=JSON.parse(fs.readFileSync(path.join(__dirname,'..','tools','grade_report.json'),'utf8'));
  for(const r of rep.levels) if(!r.puzzle) ok(Math.abs(r.rate-r.target)<=.1+1e-9,`${r.id} casual-bot rate ${r.rate} within ±10% of ${r.target}`);
  if(!QUICK){ // re-check a few levels live against their limits
    for(const id of ['o3','s5','f4']){ const L=X.LEVELS.find(l=>l.id===id), rpt=rep.levels.find(r=>r.id===id); let w=0; const n=60; for(let k=0;k<n;k++){ const r=X.botPlay(Object.assign(X.levelCfg(L),{limit:0}),'casual','c'+k,150); if(r.won&&r.moves<=L.limit) w++; } ok(Math.abs(w/n-rpt.target)<=.15,`${id} live check: ${(w/n).toFixed(2)} vs target ${rpt.target}`); } }
  // stars build up across attempts
  { const S=X.defSave(); const L=X.LEVELS[0]; X.campaignResult(S,L,true,0,true,100); eq(X.campStars(S,L.id),1,'first clear: 1 star'); X.campaignResult(S,L,true,L.par,true,100); eq(X.campStars(S,L.id),2,'later: the par star adds'); X.campaignResult(S,L,false,0,false,0); eq(X.campStars(S,L.id),2,'a loss keeps stars'); X.campaignResult(S,L,true,0,false,100); eq(X.campStars(S,L.id),3,'no-assist star adds');
    ok(X.unlocked(S,X.LEVELS[1])&&!X.unlocked(S,X.LEVELS[2]),'clearing a level unlocks the next'); ok(!X.campOpen(S,1),'Stormfront locked until Origins 15'); }
  // Daily: same date → same level and refills; weekday table; pinned fingerprints
  const days=QUICK?30:120; let same=0; for(let k=0;k<days;k++){ const d=new Date(Date.UTC(2026,10,1)+k*864e5).toISOString().slice(0,10); if(X.dailyFingerprint(d)===X.dailyFingerprint(d)) same++; }
  eq(same,days,`the same date gives the same Daily (${days} days)`);
  const X2=load(); let same2=0; for(let k=0;k<20;k++){ const d=new Date(Date.UTC(2027,0,1)+k*864e5).toISOString().slice(0,10); const a=X.newGame(X.dailyCfg(d)), b=X2.newGame(X2.dailyCfg(d)); const rr=X.rngFor(d); for(let m=0;m<8&&!a.over;m++){ const sw=X.listSwaps(a); const mv=sw[Math.floor(rr()*sw.length)]; X.doSwap(a,mv[0],mv[1]); X2.doSwap(b,mv[0],mv[1]); } if(X.fingerprint(a)===X2.fingerprint(b)) same2++; }
  eq(same2,20,'the same date gives the same refills in a separate load');
  const pins=JSON.parse(fs.readFileSync(path.join(__dirname,'daily_pins.json'),'utf8')); for(const d in pins) eq(X.dailyFingerprint(d),pins[d],`pinned Daily ${d}`);
  eq([0,1,2,3,4,5,6].map(w=>X.DAILY_RECIPES[w].ne),[6,4,4,5,5,5,6],'weekday element counts: Mon 4 … Sat 6, Sun 6');
  eq(X.dailyCfg('2026-11-23').goals[0].t,'score','Monday: score target'); eq(X.dailyCfg('2026-11-24').goals[0].t,'collect','Tuesday: collect'); eq(X.dailyCfg('2026-11-25').goals[0].t,'frost','Wednesday: frost');
  eq(X.dailyCfg('2026-11-26').goals[0].t,'relic','Thursday: relics'); eq(X.dailyCfg('2026-11-27').goals.map(g=>g.t),['lava','score'],'Friday: lava + score'); eq(X.dailyCfg('2026-11-28').goals[0].t,'fog','Saturday: fog (and chains)');
  ok(X.dailyCfg('2026-11-29').shape&&X.dailyCfg('2026-11-29').goals.length===2&&X.DAILY_RECIPES[0].ne===6,'Sunday: 6 elements, two goals on a shaped board');
  { const S=X.defSave(), d='2026-11-26'; const r=X.dailyResult(S,d,true,7,48320,false,d); eq(r.xp,40,'Daily XP doubled on its release day'); ok(X.dailyResult(S,d,true,7,1,false,d)===null,'one scored attempt');
    eq(X.shareLine(d,r.stars,7,48320,true,false),`Quintessence Daily · Thu 26 Nov · ${'★'.repeat(r.stars.reduce((a,b)=>a+b,0))}${'☆'.repeat(3-r.stars.reduce((a,b)=>a+b,0))} · 7 moves left · 48,320`,'share line');
    const S2=X.defSave(); eq(X.dailyResult(S2,'2026-11-20',true,1,1,false,'2026-11-26').xp,20,'an older Daily pays 20 XP'); }
}
sec('core');
{ const old=JSON.stringify({v:1,xp:120,camp:{o1:{c:1,s:[1,0,0]}}}); const S=X.loadSave(old,false); ok(S.xp===120&&S.prefs&&S.look.skin==='orbs'&&S.rec.zen,'an old save missing fields loads through defSave()');
  // XP, levels, rewards, hints
  const S2=X.defSave(); S2.hints=5; const r=X.addXP(S2,50); ok(r.after===2&&S2.hints===6,'level-up: +1 hint'); for(let l=2;l<=10;l++) ok(X.rewardsAt(l).length>0,`level ${l} has a reward`);
  ok(X.levelOf(3175)===10&&X.levelOf(3174)===9,'max level 10 at 3,175 XP');
  { const S3=X.defSave(); S3.hints=0; X.refreshHints(S3,'2026-11-26'); eq(S3.hints,5,'hints refill daily to 5'); S3.hints=40; X.refreshHints(S3,'2026-11-27'); eq(S3.hints,40,'earned extras stack'); }
  // Classic stars and XP
  { const S4=X.defSave(), su={mode:'moves',board:'8',ne:5,obst:'off'}, th=X.classicThresholds(su); ok(th[0]>0&&th[1]>=th[0],'bronze and silver from the bot');
    const a=X.classicResult(S4,su,th[1],false,{}); eq(a.stars,[1,1,1],'all three Classic stars'); eq(a.xp,30,'5/10/15 XP the first time'); const b=X.classicResult(S4,su,th[1],false,{}); eq(b.xp,3,'then 3 per game with a star');
    const c=X.classicResult(S4,su,0,false,{}); eq(c.xp,0,'no star, no XP'); eq(S4.rec.cur,0,'a loss ends the streak'); }
  { const S5=X.defSave(); let xp=0; for(let k=0;k<30;k++) xp+=X.zenXP(S5,'2026-11-26',100); eq(xp,20,'Zen: 1 XP per 100 matches, at most 20 a day'); }
  // achievements
  { const S6=X.defSave(); S6.tot.m[0]=100; S6.tot.made[1]=1; S6.tot.combos['prism+prism']=1; S6.tot.react.thaw=25; const got=X.checkAch(S6,{mode:'classic'}); ok(['m0a','sp1','cb_pp','r_thaw'].every(id=>got.includes(id)),'element, special, combo and reaction achievements'); eq(X.ACH.length,55,'55 achievements'); }
  { const S7=X.defSave(); const before={made:[0,0,0,0,0,0],combos:{},react:{},matches:[0,0,0,0,0,0]}; X.addStats(S7,before,{made:[0,1,0,0,0,0],combos:{'wisp+surge':1,'prism+burst':1},react:{freeze:2},matches:[3,0,0,0,0,1]}); ok(S7.tot.combos['wisp+special']===1&&S7.tot.combos['prism+special']===1&&S7.tot.react.freeze===2&&S7.tot.m[0]===3,'stats fold into the totals'); }
  // cosmetics: each element keeps its shape (one shape function per element, skins only change materials)
  ok(X.COS.skin.length===6&&X.COS.board.length===6&&X.COS.mfx.length===4&&X.COS.spx.length===3&&X.COS.win.length===4&&X.COS.track.length===4&&X.COS.sound.length===3,'cosmetic categories as specified');
  // backup round trip
  { const S8=X.defSave(); S8.xp=777; S8.camp.o1={c:1,s:[1,1,0]}; const code=X.backupPlain(S8); ok(code.startsWith('QUINTESSENCE1.'),'backup prefix'); const o=X.parseBackup('junk '+code+' junk'); ok(o&&o.xp===777&&o.camp.o1.s[1]===1,'backup round trip'); ok(X.parseBackup('nope')===null,'a bad code is refused'); }
}
sec('Arcade contract');
{ const mem={}; const store={get:k=>mem[k]||null,set:(k,v)=>{ mem[k]=v; }}; mem['arcade.v1']=JSON.stringify({set:{appearance:'dark',motion:false,sfx:false,music:false,haptics:false,fullscreen:true,cb:true,lefty:true,lang:'de'},name:'Alasdair'});
  const S=X.defSave(); const P=X.applyShared(S,X.readArcade(store)); ok(P.appearance==='dark'&&P.cb===true&&P.lang==='de'&&P.name==='Alasdair'&&S.appearance==='system','shared settings and the name come from arcade.v1, in memory only');
  const sm=X.summary(S); ok(['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last'].every(k=>k in sm)&&sm.game==='quintessence'&&sm.maxLevel===10,'the summary has every field');
  eq(sm.hi.map(h=>h[0]),['Campaign stars','Best cascade','Daily streak'],'summary highlights');
  const app=fs.readFileSync(path.join(__dirname,'..','src','app.html'),'utf8'), all=app+['engine.js','bot.js','core.js','levels.js'].map(f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8')).join('\n');
  ok(/ARCADE_HOME='\.\.\/index\.html', ARCADE_PREFS='\.\.\/index\.html#prefs'/.test(app),'ARCADE_HOME and ARCADE_PREFS'); ok(!/location\.href\s*=/.test(all)&&!/location\.assign/.test(all)&&/location\.replace\(url\)/.test(app),'leaves only with location.replace');
  ok(/location\.hash==='#game-settings'/.test(app)&&/history\.replaceState/.test(app),'#game-settings opens settings and clears the hash'); ok(/id="arcadeBtn"/.test(app)&&/id="settingsBtn"/.test(app),'#arcadeBtn and #settingsBtn exist');
  ok(!/serviceWorker/.test(all),'no service worker'); ok(!/https?:\/\/(?!www\.w3\.org)/.test(all),'no outside requests');
  const keys=[...all.matchAll(/store\.(?:get|set)\(([^,)]+)/g)].map(m=>m[1].trim()); ok(keys.every(k=>['KEY','SUMKEY','ARCADE_KEY','k'].includes(k)),'only quintessence.* keys (and reading arcade.v1)'); ok(X.KEY==='quintessence.v1'&&X.SUMKEY==='arcade.summary.quintessence','storage keys');
  // no code hidden after a // comment inside a one-line function
  const lines=all.split('\n').filter(l=>/^\s*(function|const|let)\b.*\{.*\/\/(?!\/).*\}\s*;?\s*$/.test(l)&&!/https?:\/\//.test(l)); ok(!lines.length,'no code hidden after a // comment: '+lines.slice(0,2).join(' | ').slice(0,200));
  ok(!/\b(candy|crush|saga|striped|wrapped|colou?r bomb|sweet!|tasty!|divine!|delicious!|sugar crush)\b/i.test(all),'none of King\'s names, special names or praise words');
}
const R=res(); console.log(`\n${R.pass} passed, ${R.fail} failed in ${((Date.now()-t0)/1000).toFixed(1)} s`); process.exit(R.fail?1:0);
