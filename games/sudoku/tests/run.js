// node tests/run.js   (QUICK=1 for a short run)
// Rules, solver, bank, generator, hints, modes, core and the Arcade contract. Node only.
const fs=require('fs'), path=require('path');
const {load,ok,eq,res}=require('./lib.js');
const X=load(), QUICK=!!process.env.QUICK, t0=Date.now();
const ROOT=path.join(__dirname,'..'), SRC=path.join(ROOT,'src');
const sec=n=>console.log(`· ${n}`);
// the Daily for two dates, pinned by fingerprint (variant|grade|bank index); they change only if the bank is rebuilt
const PIN=['diag|normal|167','jigsaw|hard|219'];
const G9=X.geom('classic'), bit=d=>1<<(d-1);
const pinfo=p=>X.puzzleInfo(p);
const fresh=(p,cfg)=>X.newGame(Object.assign({},p,{sol:pinfo(p).sol}),cfg);

// ===================== rules =====================
sec('variants and houses');
{ const g=X.geom('mini'); eq(g.houses.length,18,'Mini: 6 rows, 6 columns, 6 boxes');
  for(const h of g.houses.filter(h=>h.type==='box')){ const rs=new Set(h.cells.map(c=>(c/6)|0)), cs=new Set(h.cells.map(c=>c%6)); ok(rs.size===2&&cs.size===3&&h.cells.length===6,`Mini box ${h.i} is 2 rows × 3 columns`); }
  eq(G9.houses.length,27,'Classic: 27 houses'); for(const h of G9.houses) eq(h.cells.length,9,`Classic ${h.type} ${h.i} has 9 cells`);
  const d=X.geom('diag'); eq(d.houses.length,29,'Diagonal: 29 houses'); const dg=d.houses.filter(h=>h.type==='diag');
  eq(dg[0].cells,[0,10,20,30,40,50,60,70,80],'main diagonal'); eq(dg[1].cells,[8,16,24,32,40,48,56,64,72],'anti-diagonal'); eq(d.peers[40].length,32,'the centre sees 32 cells on Diagonal');
  eq(G9.peers[40].length,20,'a Classic cell sees 20 cells');
  for(const [k,r] of X.BANK_REGIONS.entries()){ const g=X.geom('jigsaw',r); const boxes=g.houses.filter(h=>h.type==='box');
    ok(boxes.length===9&&boxes.every(h=>h.cells.length===9),`layout ${k}: 9 regions of 9 cells`);
    for(let b=0;b<9;b++) ok(X.regionConnected(9,[...r].map(Number),b),`layout ${k}: region ${b} connected`);
    ok(r!==X.stdRegions(9,3,3),`layout ${k} is irregular`); }
  eq(new Set(X.BANK_REGIONS).size,X.BANK_REGIONS.length,'Jigsaw layouts are all different'); }
sec('givens, conflicts, notes, undo, mistakes');
{ const p=X.bankList('classic','normal')[0], st=fresh(p), g=X.geoOf(st), gv=[...p.givens].findIndex(ch=>ch!=='0'), em=[...p.givens].findIndex(ch=>ch==='0');
  eq(X.place(st,gv,1),null,'a given cannot be changed'); eq(X.erase(st,gv),null,'a given cannot be erased');
  const sol=+st.sol[em], wrongD=sol%9+1;
  let r=X.place(st,em,sol); ok(r&&!r.wrong&&st.mistakes===0,'a right digit is not a mistake');
  X.undo(st); eq(st.vals[em],0,'undo removes the digit');
  r=X.place(st,em,wrongD); ok(r.wrong&&r.counted&&st.mistakes===1,'a wrong digit with mistake check on counts a mistake');
  ok(X.isWrong(st,em),'the wrong digit is flagged'); X.undo(st); eq(st.mistakes,1,'undo is free: the mistake stays counted');
  const off=fresh(p,{check:false}); r=X.place(off,em,wrongD); ok(r.wrong&&!r.counted&&off.mistakes===0,'mistake check off: no mistake counted');
  // conflicts: two equal digits in one house (the rules, not the solution)
  const st2=fresh(p); const row=(em/9|0), other=row*9+[...Array(9).keys()].find(k=>p.givens[row*9+k]!=='0');
  X.place(st2,em,+p.givens[other]); ok(X.conflicts(st2).has(em)&&X.conflicts(st2).has(other),'a clash in a row is detected');
  ok(X.conflicts(fresh(p)).size===0,'a fresh puzzle has no clashes');
  // notes
  const st3=fresh(p); X.toggleNote(st3,em,3); X.toggleNote(st3,em,5); eq(st3.notes[em],bit(3)|bit(5),'notes add'); X.toggleNote(st3,em,3); eq(st3.notes[em],bit(5),'notes remove');
  ok(X.toggleNote(fresh(p,{notes:false}),em,3)===null,'Notes off: no notes');
  X.fillNotes(st3); let exact=true; for(let c=0;c<81;c++){ if(st3.vals[c]) continue; if(st3.notes[c]!==X.legalMask(g,st3.vals,c)) exact=false; } ok(exact,'Fill notes gives exactly the legal candidates');
  ok(st3.fillUsed,'Fill notes is recorded'); eq(st3.mistakes+st3.hints,0,'Fill notes is not an assist');
  const d=+st3.sol[em], peersWith=g.peers[em].filter(c=>st3.notes[c]&bit(d));
  X.place(st3,em,d,{autoNotes:true}); ok(peersWith.length>0&&peersWith.every(c=>!(st3.notes[c]&bit(d))),'auto-remove clears the digit from notes in its houses');
  const st4=fresh(p); X.fillNotes(st4); X.place(st4,em,d,{autoNotes:false}); ok(peersWith.every(c=>st4.notes[c]&bit(d)),'without auto-remove, notes stay');
  // undo restores exactly, over random sequences of every action
  const rng=X.rngFor('undo'); let same=true;
  for(let k=0;k<(QUICK?20:80);k++){ const s=fresh(X.bankList(X.VKEYS[k%4],'easy')[k]), G=X.geoOf(s), snaps=[JSON.stringify([s.vals,s.notes])];
    for(let m=0;m<40;m++){ const c=Math.floor(rng()*G.NN), dd=1+Math.floor(rng()*G.N), a=Math.floor(rng()*5);
      const r=a===0?X.place(s,c,dd,{autoNotes:rng()<.5}):a===1?X.toggleNote(s,c,dd):a===2?X.erase(s,c):a===3?X.fillNotes(s):X.setNotes(s,[[c,dd]]);
      if(r&&!s.won&&!s.lost) snaps.push(JSON.stringify([s.vals,s.notes])); if(s.won||s.lost) break; }
    if(s.won||s.lost) continue;
    for(let i=snaps.length-2;i>=0;i--){ X.undo(s); if(JSON.stringify([s.vals,s.notes])!==snaps[i]) same=false; } }
  ok(same,'undo restores every earlier state exactly');
  // mistake limit: the 4th mistake fails the level
  const lim=fresh(p,{limit:3}); for(let k=0;k<4;k++){ X.place(lim,em,wrongD); if(k<3){ ok(!lim.lost,`mistake ${k+1} of 3 allowed`); X.erase(lim,em); } } ok(lim.lost,'the 4th mistake fails');
  eq(X.assistedOf(0,0),false,'no hints, no mistakes: not assisted'); ok(X.assistedOf(1,0)&&X.assistedOf(0,1),'a hint or a mistake makes it assisted');
  // win
  const w=fresh(p); for(let c=0;c<81;c++) if(!w.vals[c]) X.place(w,c,+w.sol[c]); ok(w.won,'a full correct grid wins'); }

// ===================== solver =====================
sec('techniques on hand-made positions');
{ const blank=(fillMask)=>({vals:new Array(81).fill(0),cand:new Uint16Array(81).fill(fillMask==null?0x1ff:fillMask)});
  const without=(m,...ds)=>ds.reduce((a,d)=>a&~bit(d),m);
  // hidden single: in row 0, 5 fits only cell 3
  let {vals,cand}=blank(); for(let c=0;c<9;c++) if(c!==3) cand[c]=without(cand[c],5); for(let c=9;c<81;c++) cand[c]=without(0x1ff,5)|((c%9===0)?bit(5):0);
  let s=X.tHidden(G9,vals,cand); eq(s&&s.place,[3,5],'hidden single');
  ({vals,cand}=blank()); cand[10]=bit(7); s=X.tNaked(G9,vals,cand); eq(s&&s.place,[10,7],'naked single');
  // pointing: in box 0, 4 sits only in row 0 (cells 0, 1), so 4 leaves cell 5 of row 0
  ({vals,cand}=blank(without(0x1ff,4))); cand[0]|=bit(4); cand[1]|=bit(4); cand[5]|=bit(4); cand[30]|=bit(4); cand[50]|=bit(4); cand[70]|=bit(4);
  s=X.tLocked(G9,vals,cand,'pt'); ok(s&&s.t==='pt'&&s.elim.length===1&&s.elim[0][0]===5&&s.elim[0][1]===bit(4),'pointing');
  // claiming: in row 0, 4 sits only in box 0 (cells 0, 1), so 4 leaves cell 10 of box 0
  ({vals,cand}=blank(without(0x1ff,4))); cand[0]|=bit(4); cand[1]|=bit(4); cand[10]|=bit(4); cand[40]|=bit(4); cand[80]|=bit(4);
  s=X.tLocked(G9,vals,cand,'cl'); ok(s&&s.t==='cl'&&s.elim.some(e=>e[0]===10)&&s.elim.every(e=>e[1]===bit(4)),'claiming');
  // naked pair / triple / quad in row 0
  for(const [k,id] of [[2,'np'],[3,'nt'],[4,'nq']]){ ({vals,cand}=blank()); const m=(1<<k)-1; for(let c=0;c<k;c++) cand[c]=m; // cells 0..k-1 hold digits 1..k only
    s=X.tNakedSub(G9,vals,cand,k); const H=s&&G9.houses[s.houses[0]];
    ok(s&&s.t===id&&s.mask===m&&s.cells.join()===[...Array(k).keys()].join()&&s.elim.length>0&&s.elim.every(([c,mm])=>H.cells.includes(c)&&!s.cells.includes(c)&&mm===m),`naked ${id} (in ${H&&H.type} ${H&&H.i})`); }
  // hidden pair / triple / quad: digits 1..k only in cells 0..k-1 of row 0 (column and box spots removed too)
  for(const [k,id] of [[2,'hp'],[3,'ht'],[4,'hq']]){ ({vals,cand}=blank()); const m=(1<<k)-1;
    for(let c=0;c<81;c++) if(!((c<k))) cand[c]&=~m; // only cells 0..k-1 may hold 1..k anywhere: simplest isolated check on row 0
    s=X.tHiddenSub(G9,vals,cand,k); ok(s&&s.t===id&&s.mask===m&&s.cells.join()===[...Array(k).keys()].join()&&s.elim.every(e=>e[1]===(0x1ff&~m)),`hidden ${id}`); }
  // X-Wing on 6: rows 1 and 5 hold 6 only in columns 2 and 7, so 6 leaves column 2 at row 3
  ({vals,cand}=blank(without(0x1ff,6))); for(const c of [9+2,9+7,45+2,45+7,27+2,63+7]) cand[c]|=bit(6); for(let r=0;r<9;r++) if(![1,5,3,7].includes(r)) cand[r*9+((r*4)%9===2||(r*4)%9===7?0:(r*4)%9)]|=bit(6);
  s=X.tFish(G9,vals,cand,2); ok(s&&s.t==='xw'&&s.d===6&&s.elim.some(e=>e[0]===29)&&s.elim.some(e=>e[0]===70),'X-Wing');
  // Swordfish on 2: rows 0, 4, 8 hold 2 only in columns {1,4}, {4,7}, {1,7}; 2 leaves those columns elsewhere
  ({vals,cand}=blank(without(0x1ff,2))); for(const c of [1,4,36+4,36+7,72+1,72+7,18+1,54+4]) cand[c]|=bit(2);
  s=X.tFish(G9,vals,cand,3); ok(s&&s.t==='sf'&&s.d===2&&s.elim.some(e=>e[0]===19)&&s.elim.some(e=>e[0]===58),'Swordfish');
  ok(!X.tFish(G9,vals,cand,2),'no X-Wing in a Swordfish');
  // XY-Wing: pivot 0 {1,2}, pincers 5 {1,3} (row 0) and 27 {2,3} (column 0); 3 leaves 32, which sees both pincers
  ({vals,cand}=blank(bit(8)|bit(9))); cand[0]=bit(1)|bit(2); cand[5]=bit(1)|bit(3); cand[27]=bit(2)|bit(3); cand[32]=bit(3)|bit(4)|bit(5);
  s=X.tXY(G9,vals,cand); ok(s&&s.t==='xy'&&s.d===3&&s.elim.length===1&&s.elim[0][0]===32,'XY-Wing');
  // XYZ-Wing: pivot 0 {1,2,3}, pincers 1 {1,3} and 9 {2,3}; 3 leaves 2, which sees all three
  ({vals,cand}=blank(bit(8)|bit(9))); cand[0]=bit(1)|bit(2)|bit(3); cand[1]=bit(1)|bit(3); cand[9]=bit(2)|bit(3); cand[2]=bit(3)|bit(4); cand[5]=bit(3)|bit(5);
  s=X.tXYZ(G9,vals,cand); ok(s&&s.t==='xyz'&&s.d===3&&s.elim.length===1&&s.elim[0][0]===2,'XYZ-Wing (only cells seeing all three)');
  // simple colouring (wrap): a chain 0–5 (row 0), 5–41 (column 5), 41–37 (row 4), 37–10 (column 1); 0 and 10 share box 0 and a colour
  ({vals,cand}=blank(bit(1))); for(const c of [0,5,41,37,10,20]) cand[c]|=bit(9);
  s=X.tColour(G9,vals,cand); ok(s&&s.t==='sc'&&s.rule==='wrap'&&s.elim.map(e=>e[0]).sort((a,b)=>a-b).join()==='0,10,41','simple colouring: colour wrap');
  // simple colouring (trap): a chain 0–4 (row 0), 4–40 (column 4), 40–50 (box 4) colours 0 and 40 one way, 4 and 50 the other;
  // 45 sees 0 (column 0) and 50 (row 5), so it can't hold the digit. 53 and 63 only break up row 5 and column 0.
  ({vals,cand}=blank(bit(1))); for(const c of [0,4,40,50,45,53,63]) cand[c]|=bit(9);
  s=X.tColour(G9,vals,cand); ok(s&&s.t==='sc'&&s.rule==='trap'&&s.elim.length===1&&s.elim[0][0]===45,'simple colouring: colour trap'); }
sec('soundness over solver traces (every step agrees with the solution)');
{ let steps=0, bad=0; const seen={};
  for(const v of X.VKEYS) for(const gr of X.gradesFor(v)){ const L=X.bankList(v,gr); for(let i=0;i<L.length;i+=QUICK?30:6){ const p=L[i], g=X.geom(v,p.regions), sol=X.toVals(pinfo(p).sol);
      const r=X.logicSolve(g,X.toVals(p.givens),3,{trace:true});
      for(const T of r.trace){ steps++; seen[T.s.t]=(seen[T.s.t]||0)+1; if(T.s.place){ if(sol[T.s.place[0]]!==T.s.place[1]) bad++; } else for(const [c,m] of T.s.elim) if(m&bit(sol[c])) bad++; } } }
  eq(bad,0,`no step contradicts the solution (${steps} steps)`);
  for(const t of X.TECH) if(!['nq','hq'].includes(t.id)) ok(seen[t.id]>0,`${t.name} occurs in the bank traces (${seen[t.id]||0})`); }

// ===================== bank =====================
sec('bank: every puzzle unique, logic-solvable, graded exactly, symmetric');
{ let n=0, badU=0, badG=0, badS=0, badC=0; const sizes={};
  for(const v of X.VKEYS) for(const gr of X.gradesFor(v)){ const L=X.bankList(v,gr); sizes[v+'|'+gr]=L.length; const [lo,hi]=X.GIVENS[v][gr];
    for(let i=0;i<L.length;i+=(QUICK?25:1)){ const p=L[i], g=X.geom(v,p.regions), vals=X.toVals(p.givens); n++;
      if(X.countSolutions(g,vals)!==1) badU++;
      const r=X.logicSolve(g,vals,X.GRADES.indexOf(gr)); if(!r.solved||X.GRADES[r.grade]!==gr) badG++;
      for(let c=0;c<g.NN;c++) if((p.givens[c]==='0')!==(p.givens[g.NN-1-c]==='0')){ badS++; break; }
      const k=X.givenCount(p.givens); if(k<lo||k>hi) badC++; } }
  eq(badU,0,`${n} bank puzzles have exactly one solution`); eq(badG,0,'each is solved by logic within its grade, hardest technique = its grade');
  eq(badS,0,'each is 180° symmetric'); eq(badC,0,'given counts are in range');
  for(const k in sizes) ok(sizes[k]>=300,`${k}: ${sizes[k]} puzzles`);
  const kb=fs.statSync(path.join(SRC,'bank.js')).size/1024; ok(kb<150,`bank.js is ${kb.toFixed(1)} KB (< 150 KB)`);
  // round trip of the compact format
  for(const v of X.VKEYS){ const p=X.bankList(v,'easy')[3]; const e=X.encPuzzle(p.givens,p.layout); eq(X.decPuzzle(e,p.givens.length,v==='jigsaw').givens,p.givens,`${v}: compact format round trip`); } }

// ===================== generator =====================
sec('generator: slices, symmetry, grades');
{ let maxMs=0, slices=0; const times=[];
  for(const v of ['classic','diag','jigsaw','mini']) for(const gr of X.gradesFor(v).filter(g=>X.canGenerate(v,g))) for(let k=0;k<(QUICK?2:6);k++){
    const regions=v==='jigsaw'?X.BANK_REGIONS[k]:null; let it=X.genPuzzle(v,gr,'T'+k,regions), r, got=null, tries=0;
    while(!got&&tries<40){ for(;;){ const a=performance.now(); r=it.next(); const ms=performance.now()-a; times.push(ms); slices++; if(ms>maxMs) maxMs=ms; if(r.done) break; } if(r.value) got=r.value; else it=X.genPuzzle(v,gr,'T'+k+'#'+(++tries),regions); }
    ok(!!got,`${v} ${gr} #${k} generated`); if(!got) continue; const g=X.geom(v,got.regions);
    ok(X.countSolutions(g,X.toVals(got.givens))===1,`${v} ${gr} #${k}: one solution`);
    let sym=true; for(let c=0;c<g.NN;c++) if((got.givens[c]==='0')!==(got.givens[g.NN-1-c]==='0')) sym=false; ok(sym,`${v} ${gr} #${k}: 180° symmetric`);
    eq(X.gradeOf(g,got.givens).grade,gr,`${v} ${gr} #${k}: graded ${gr}`); }
  times.sort((a,b)=>a-b); const p99=times[Math.floor(times.length*.99)];
  ok(p99<8,`generator slices: 99% under 8 ms (p99 ${p99.toFixed(2)} ms, max ${maxMs.toFixed(1)} ms over ${slices} slices)`); }

// ===================== hints =====================
sec('hints: the next logical step');
{ let games=0, badStep=0, unfinished=0;
  for(const v of X.VKEYS) for(const gr of X.gradesFor(v)){ const L=X.bankList(v,gr); for(let i=0;i<(QUICK?2:6);i++){ const p=L[i*37%L.length], st=fresh(p), sol=X.toVals(st.sol); games++;
      for(let k=0;k<400&&!st.won;k++){ const s=X.hintStep(st); if(!s){ unfinished++; break; }
        if(s.place){ if(sol[s.place[0]]!==s.place[1]) badStep++; X.place(st,s.place[0],s.place[1]); }
        else if(s.elim){ for(const [c,m] of s.elim) if(m&bit(sol[c])) badStep++; X.setNotes(st,s.elim.map(([c,m])=>[c,(st.notes[c]||s.cand[c])&~m])); }
        if(!s.text) badStep++; }
      if(!st.won) unfinished++; } }
  eq(badStep,0,`every hint step is legal and keeps the solution (${games} games played by hints alone)`); eq(unfinished,0,'hints alone always finish the puzzle');
  // a wrong digit is pointed out first
  const p=X.bankList('classic','hard')[5], st=fresh(p), em=[...p.givens].findIndex(c=>c==='0'), wd=+st.sol[em]%9+1; X.place(st,em,wd);
  const h=X.hintStep(st); ok(h.t==='wrong'&&h.cells[0]===em&&/wrong/.test(h.text),'a wrong digit is pointed out first');
  // wrong notes (missing the right digit) are ignored, never trusted
  const st2=fresh(p); const c2=[...p.givens].findIndex(c=>c==='0'); st2.notes[c2]=X.legalMask(X.geoOf(st2),st2.vals,c2)&~bit(+st2.sol[c2]); const h2=X.hintStep(st2);
  ok(h2&&!(h2.elim||[]).some(([c,m])=>m&bit(+st2.sol[c]))&&!(h2.place&&+st2.sol[h2.place[0]]!==h2.place[1]),'wrong notes are ignored by hints'); }

// ===================== modes =====================
sec('Daily');
{ const X2=load(); let same=0, wk=0; const day=d=>{ const t=new Date(Date.UTC(2026,10,25)+d*864e5); return t.toISOString().slice(0,10); };
  for(let d=0;d<120;d++){ const date=day(d); if(X.dailyFingerprint(date)===X2.dailyFingerprint(date)) same++; const p=X.dailyPuzzle(date), w=X.DAILY_TABLE[X.weekdayOf(date)]; if(p.variant===w.variant&&p.grade===w.grade) wk++; }
  eq(same,120,'the same date gives the same puzzle (120 days, two separate loads)'); eq(wk,120,'the weekday table is followed');
  eq(X.DAILY_TABLE.map(w=>w.variant+' '+w.grade),['classic expert','classic easy','classic normal','diag normal','classic hard','jigsaw hard','diag hard'],'Sunday … Saturday: Expert, Easy, Normal, Diagonal Normal, Hard, Jigsaw Hard, Diagonal Hard');
  eq(X.dailyFingerprint('2026-11-25'),PIN[0],'pinned: 2026-11-25'); eq(X.dailyFingerprint('2027-01-01'),PIN[1],'pinned: 2027-01-01');
  const S=X.defSave(); const today='2026-11-25', p=X.dailyPuzzle(today);
  const r=X.dailyResult(S,today,true,p.par*1000-1,0,false,today); eq(r.xp,40,'release-day XP doubled'); eq(r.stars,[1,1,1],'3 stars');
  eq(X.dailyResult(S,today,true,1000,0,false,today),null,'one scored attempt');
  const S2=X.defSave(); eq(X.dailyResult(S2,'2026-11-24',true,999999,0,true,today).xp,20,'a past Daily pays 20'); eq(S2.dhist['2026-11-24'].stars,1,'slow and assisted: 1 star');
  eq(X.shareLine(today,462000,[1,1,1],false,true),'Sudoku Daily · Wed 25 Nov · Diagonal · 7:42 · ★★★','share line');
  ok(/· assisted$/.test(X.shareLine(today,462000,[1,1,0],true,true)),'share line marks assisted');
  // streak, last 7, Full Week
  const S3=X.defSave(); for(let d=0;d<9;d++){ const date=day(d); X.dailyResult(S3,date,true,1000,0,false,date); }
  eq(S3.dstreak.cur,9,'daily streak'); eq(Object.keys(S3.dhist).length,7,'the last 7 Dailies kept'); ok(S3.dweek.every(Boolean),'Full Week tracker');
  X.streakNow(S3,day(11)); eq(S3.dstreak.cur,0,'a missed day breaks the streak');
  const S4=X.defSave(); X.dailyResult(S4,day(0),true,1000,0,false,day(0)); const a=X.checkAch(S4,{mode:'daily',won:true,p:X.dailyPuzzle(day(0)),time:1000,par:999,assisted:false,counts:{}}); ok(a.includes('dstar1'),'Daily Star'); }
sec('campaign');
{ eq(X.LEVELS.length,45,'45 levels'); eq(X.CAMPS.length,3,'3 campaigns');
  for(const L of X.LEVELS){ const p=X.levelPuzzle(L), g=X.geom(L.variant,L.regions), info=pinfo(p);
    ok(X.countSolutions(g,X.toVals(L.givens))===1,`${L.id}: one solution`); const st=X.newGame(Object.assign({},p,{sol:info.sol}),X.levelCfg(L));
    ok(st.vals.length===g.NN&&L.par>=60,`${L.id} loads (${L.name})`);
    if(L.twist==='nonotes') ok(!st.cfg.notes&&X.toggleNote(st,L.givens.indexOf('0'),1)===null,`${L.id}: notes off`);
    if(L.twist==='limit') eq(st.cfg.limit,3,`${L.id}: mistake limit 3`);
    if(L.twist==='nocheck') eq(st.cfg.check,false,`${L.id}: mistake check off`);
    if(L.type==='tech'){ const h=X.hintStep(st); eq(h&&h.t,L.tech,`${L.id}: the first step is exactly ${L.tech}`); const f=X.givenCount(L.givens)/81; ok(f>=.3&&f<=.75,`${L.id}: part-solved (${Math.round(f*100)}%)`);
      if(L.tech==='hs') ok(!X.tNaked(g,st.vals,X.hintCands(st)),`${L.id}: no naked single to take instead`); } }
  const byN=(c,n)=>X.LEVELS.find(L=>L.camp===c&&L.n===n);
  eq([4,8,12].map(n=>byN(0,n).variant),['mini','diag','mini'],'Novice variant levels'); eq([4,8,12].map(n=>byN(1,n).variant),['diag','jigsaw','jigsaw'],'Adept variant levels'); eq([4,8,12].map(n=>byN(2,n).variant),['jigsaw','diag','jigsaw'],'Master variant levels');
  eq(byN(0,1).variant,'mini','Novice opens on Mini'); eq([0,1,2].map(c=>byN(c,10).tech),['hs','pt','xw'],'technique puzzles: hidden single, pointing, X-Wing');
  for(const c of [0,1,2]) ok(byN(c,7).twist&&byN(c,14).twist,`campaign ${c}: twists at 7 and 14`);
  eq(new Set(X.LEVELS.map(L=>L.twist).filter(Boolean)).size,4,'all four twists are used');
  const hardest=['classic','diag','jigsaw'].flatMap(v=>X.bankList(v,'expert')).map(p=>{ const i=pinfo(p); let s=0; for(const id in i.counts){ const t=X.TECH_BY[id]; if(t.lv) s+=i.counts[id]*t.w; } return s*10000+i.par; }).sort((a,b)=>b-a)[0];
  const m15=pinfo(X.levelPuzzle(byN(2,15))); let s15=0; for(const id in m15.counts){ const t=X.TECH_BY[id]; if(t.lv) s15+=m15.counts[id]*t.w; } eq(s15*10000+m15.par,hardest,'Master 15 is the hardest Expert in the bank');
  ok(X.LEVELS.filter(L=>L.camp===0).every(L=>['easy','normal'].includes(L.grade)),'Novice: Easy and Normal'); ok(X.LEVELS.filter(L=>L.camp===2).every(L=>['hard','expert'].includes(L.grade)),'Master: Hard and Expert');
  // stars build up; unlocks
  const S=X.defSave(), L1=byN(0,1); ok(X.unlocked(S,L1)&&!X.unlocked(S,byN(0,2)),'only level 1 is open at first');
  let r=X.campaignResult(S,L1,true,L1.par*1000+5000,true); eq(r.earned,[1,0,0],'clear only'); eq(r.xp,6,'6 XP per new Novice star');
  r=X.campaignResult(S,L1,true,1000,true); eq(r.fresh,[1],'the time star is added later'); r=X.campaignResult(S,L1,true,L1.par*1000+5000,false); eq(r.fresh,[2],'then the no-assists star'); eq(X.campStars(S,L1.id),3,'stars build up to 3');
  r=X.campaignResult(S,L1,false,1000,false); eq(r.xp,0,'a loss earns nothing'); ok(X.unlocked(S,byN(0,2)),'clearing a level opens the next');
  ok(!X.campOpen(S,1),'Adept is locked'); for(let n=2;n<=15;n++){ const rr=X.campaignResult(S,byN(0,n),true,1,false); if(n===15){ ok(rr.finished&&rr.xp===18+75,'finishing Novice pays 75'); } } ok(X.campOpen(S,1),'clearing level 15 opens Adept');
  const a=X.checkAch(S,{mode:'campaign'}); ok(a.includes('camp1')&&a.includes('perf1'),'Novice Graduate and Perfect Novice'); }

// ===================== core =====================
sec('saves, XP, records, hints, achievements, cosmetics, backup');
{ const old=JSON.stringify({v:1,xp:120,ach:{g_easy:1},look:{theme:'slate'},rec:{by:{'classic|easy':{wins:3}}}}); const S=X.loadSave(old);
  eq(S.xp,120,'old save keeps XP'); eq(S.look.font,'inter','missing look fields filled in'); eq(S.look.theme,'slate','existing look kept'); eq(S.rec.by['classic|easy'].bt,0,'missing record fields filled in'); ok(S.daily&&S.dstreak&&S.prefs.autoNotes===true,'new groups filled in');
  ok(X.loadSave('not json').xp===0,'a broken save starts fresh');
  // a game mid-move restores exactly
  const p=X.bankList('jigsaw','hard')[9]; const st=fresh(p); X.fillNotes(st); const em=st.vals.indexOf(0); X.place(st,em,+st.sol[em],{autoNotes:true}); X.toggleNote(st,st.vals.indexOf(0),2);
  const S1=X.defSave(); S1.run={mode:'classic',p,st}; const back=X.loadSave(JSON.stringify(S1)); eq(back.run.st,JSON.parse(JSON.stringify(st)),'a game mid-move restores exactly');
  X.undo(back.run.st); X.undo(st); eq(JSON.stringify(back.run.st.vals),JSON.stringify(st.vals),'undo works after a restore');
  // XP and levels
  eq(X.LVXP,[0,50,150,300,525,825,1225,1725,2375,3175],"Sweep's first 10 steps"); const S2=X.defSave(); S2.hints=2; const x=X.addXP(S2,160); eq([x.before,x.after,x.hints,S2.hints],[1,3,2,4],'level-ups give +1 hint each');
  eq(X.levelOf(1e6),10,'max level 10');
  for(let l=2;l<=10;l++) ok(X.rewardsAt(l).length>0,`level ${l} has a reward (${X.rewardsAt(l).join(', ')})`);
  eq([X.classicXP('easy',false),X.classicXP('normal',false),X.classicXP('hard',false),X.classicXP('expert',false),X.classicXP('expert',true)],[10,15,22,30,15],'Classic XP 10/15/22/30, assisted half');
  eq(X.winStars(true,1000,60,false),[1,1,1],'stars: clear, par, no assists'); eq(X.winStars(true,61000,60,true),[1,0,0],'over par and assisted'); eq(X.winStars(false,1,60,false),[0,0,0],'no stars without clearing');
  // hints: refilled daily to 5, earned extras stack to 99
  const S3=X.defSave(); S3.hints=1; X.refreshHints(S3,'2026-11-25'); eq(S3.hints,5,'hints refill to 5'); S3.hints=12; X.refreshHints(S3,'2026-11-26'); eq(S3.hints,12,'extras above the cap are kept');
  S3.hints=99; X.addXP(S3,5000); eq(S3.hints,99,'hints stack to 99 at most'); const S3b=X.defSave(); S3b.hints=0; ok(!X.useHint(S3b),'no hint when none are left');
  // records
  const S4=X.defSave(), pc={variant:'diag',grade:'hard'}; X.recordClassic(S4,pc,true,300000,2,true); X.recordClassic(S4,pc,true,200000,0,false); X.recordClassic(S4,pc,false,1,0,false);
  const rc=S4.rec.by['diag|hard']; eq([rc.games,rc.wins,rc.cur,rc.best,rc.bt,rc.fm],[3,2,0,2,200000,0],'records per variant × difficulty: wins, streak, best time (unassisted), fewest mistakes');
  // achievements and cosmetics
  const S5=X.defSave(); S5.rec.clears=10; const got=X.checkAch(S5,{mode:'classic',won:true,p:{variant:'jigsaw',grade:'expert'},time:1000,par:2000,assisted:false,fillUsed:false,notesUsed:false,counts:{xyz:1}});
  for(const id of ['g_expert','p_expert','a_expert','v_jigsaw','c10','wing','pencil','ink']) ok(got.includes(id),`achievement ${id}`);
  ok(X.owned(S5,X.findCos('theme','terminal'))&&X.owned(S5,X.findCos('font','hand')),'achievement rewards unlock (Terminal board, Handwritten digits)');
  for(const v of ['classic','diag','mini']) X.checkAch(S5,{mode:'classic',won:true,p:{variant:v,grade:v==='mini'?'normal':'hard'},time:1,par:1,assisted:true,counts:{}}); ok(S5.ach.poly,'Polymath');
  ok(!X.checkAch(X.defSave(),{practice:true,won:true,p:{variant:'classic',grade:'easy'}}).length,'practice earns no achievements');
  eq(X.ACH.length,39,'39 achievements'); const all=X.COS_KINDS.flatMap(([k])=>X.COS[k]); eq(all.length,38,'38 cosmetics in 9 categories');
  ok(X.COS_KINDS.every(([k])=>X.owned(X.defSave(),X.COS[k][0])),'every category has a free default');
  eq(X.starUnlocks().map(u=>u.stars),[30,75,135],'star unlocks at 30, 75 and 135');
  ok(all.every(it=>it.lvl||it.req||it.stars||X.COS_KINDS.some(([k])=>X.COS[k][0]===it)),'every item says how it unlocks');
  ok(all.filter(it=>it.req).every(it=>X.ACH.some(a=>a.id===it.req)),'achievement rewards point at real achievements');
  // backup
  const S6=X.defSave(); S6.xp=777; S6.ach.c10=5; const code=X.backupPlain(S6); ok(code.startsWith('SUDOKU1.'),'backup prefix'); eq(X.parseBackup('my code: '+code+' end').xp,777,'backup round trip');
  eq(X.parseBackup('SOLITAIRE1.abc'),null,'another game\'s backup is refused'); }

// ===================== Arcade contract =====================
sec('Arcade contract');
{ const store={m:{},get(k){ return this.m[k]??null; },set(k,v){ this.m[k]=v; }};
  store.set('arcade.v1',JSON.stringify({v:1,name:'Alasdair',set:{appearance:'dark',motion:false,sfx:false,music:false,haptics:false,fullscreen:true,cb:true,lefty:true,lang:'de'}}));
  const S=X.defSave(), P=X.applyShared(S,X.readArcade(store));
  eq(['appearance','motion','sfx','music','haptics','fullscreen','cb','lefty','lang'].map(k=>P[k]),['dark',false,false,false,false,true,true,true,'de'],'shared settings come from arcade.v1'); eq(P.name,'Alasdair','the name comes from arcade.v1');
  eq(S.appearance,'system','the save itself is not changed'); eq(X.applyShared(S,null),S,'no arcade.v1: the game\'s own settings');
  const sm=X.summary(S); eq(Object.keys(sm),['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last'],'summary has every field');
  eq([sm.v,sm.game,sm.maxLevel],[1,'sudoku',10],'summary ids'); eq(sm.hi.map(h=>h[0]),['Puzzles solved','Campaign stars','Daily streak'],'summary highlights'); eq(sm.ach.length,X.ACH.length,'summary lists every achievement');
  const app=fs.readFileSync(path.join(SRC,'app.html'),'utf8'), all=app+X.KEY;
  const keys=[...app.matchAll(/store\.set\(([^,]+),/g)].map(m=>m[1].trim()); ok(keys.length&&keys.every(k=>k==='KEY'||k==='SUMKEY'),'the page writes only KEY and SUMKEY ('+keys.join(', ')+')');
  ok(X.KEY==='sudoku.v1'&&X.SUMKEY==='arcade.summary.sudoku','storage keys: sudoku.v1 and arcade.summary.sudoku'); ok(!/store\.set\(ARCADE_KEY/.test(app)&&!/localStorage\.setItem\(['"]arcade\.v1/.test(app),'arcade.v1 is never written');
  ok(/ARCADE_HOME='\.\.\/index\.html', ARCADE_PREFS='\.\.\/index\.html#prefs'/.test(app),'ARCADE_HOME and ARCADE_PREFS'); ok(/function leaveTo\(url\)\{[^}]*location\.replace\(url\)/.test(app),'leaveTo uses location.replace');
  ok(!/location\.href\s*=|location\.assign\(/.test(app),'never location.href= or location.assign'); ok(/location\.hash==='#game-settings'/.test(app)&&/history\.replaceState/.test(app),'#game-settings opens settings and clears the hash');
  ok(/id="arcadeBtn"/.test(app)&&/id="settingsBtn"/.test(app),'#arcadeBtn and #settingsBtn exist'); ok(!/serviceWorker/.test(app),'no service worker');
  ok(!/https?:\/\/(?!www\.w3\.org)/.test(app),'no outside URLs in the page');
  const dist=path.join(ROOT,'dist'); if(fs.existsSync(path.join(dist,'sudoku','index.html'))){ const a=fs.readFileSync(path.join(dist,'sudoku','index.html'),'utf8'), s=fs.readFileSync(path.join(dist,'standalone.html'),'utf8');
    ok(/window\.__ARCADE__=1/.test(a)&&/href="\.\.\/fonts\.css"/.test(a)&&!/base64,/.test(a.slice(0,5000)),'Arcade build: __ARCADE__, ../fonts.css, fonts not inlined');
    ok(/Content-Security-Policy[^>]*default-src 'self'/.test(a)&&/Content-Security-Policy/.test(s),'strict CSP in both builds'); ok(!/__ARCADE__=1/.test(s),'standalone is not in Arcade mode'); } }

const r=res(); console.log(`\n${r.pass} passed, ${r.fail} failed (${((Date.now()-t0)/1000).toFixed(1)} s)`); process.exit(r.fail?1:0);
