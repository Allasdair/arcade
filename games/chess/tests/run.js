// node tests/run.js   (QUICK=1 for short runs)
// Rules (perft, Chess960, draws, notation), engine (mates, legality, slices, strength order, book), puzzles, analysis,
// Daily, campaign, 2-Player codes and avatars, core (saves, XP, stars, records, hints, achievements, backup) and the
// Arcade contract.
const fs=require('fs'), path=require('path');
const {load,ok,eq,res}=require('./lib.js');
const X=load(), QUICK=!!process.env.QUICK, t0=Date.now();
const sec=n=>console.log(`- ${n}`), SLICE_MS=6.5;
const SRC=fs.readFileSync(path.join(__dirname,'..','src','app.html'),'utf8'), ALLSRC=SRC+fs.readdirSync(path.join(__dirname,'..','src')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8')).join('\n');
const play=(fen,ucis)=>{ const p=X.fromFEN(fen); for(const u of ucis){ const m=X.fromUci(p,u); if(!m) throw new Error('bad move '+u); X.makeMove(p,m); } return p; };

// ---------------- rules ----------------
sec('perft');
const PERFT=[['start',X.START_FEN,[20,400,8902,197281,4865609]],['kiwipete','r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039,97862,4085603]],
 ['en passant / pins','8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812,43238,674624]],['castling / promotion','r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467,422333]],
 ['promotion','rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486,62379,2103487]],['middlegame','r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',[46,2079,89890,3894594]],
 ['960 a','bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9',[21,528,12189,326672]],['960 b','2nnrbkr/p1qppppp/8/1ppb4/6PP/3PP3/PPP2P2/BQNNRBKR w HEhe - 1 9',[21,807,18002,667366]],
 ['960 c','b1q1rrkb/pppppppp/3nn3/8/P7/1PPP4/4PPPP/BQNNRKRB w GE - 1 9',[20,479,10471,273318]]];
for(const [n,f,c] of PERFT){ const p=X.fromFEN(f), d=QUICK?Math.min(c.length,3):c.length; for(let k=1;k<=d;k++) eq(X.perft(p,k),c[k-1],`perft ${n} depth ${k}`); eq(X.toFEN(p).split(' ').slice(0,4),f.split(' ').slice(0,4),`perft ${n}: position restored`); }
sec('Chess960');
{ const seen=new Set(); for(let n=0;n<960;n++){ const w=X.back960(n); seen.add(w); const k=w.indexOf('K'), r1=w.indexOf('R'), r2=w.lastIndexOf('R'), b1=w.indexOf('B'), b2=w.lastIndexOf('B');
    ok(r1<k&&k<r2&&(b1+b2)%2===1&&w.split('').sort().join('')==='BBKNNQRR',`960 #${n} ${w} is a legal back rank`); }
  eq(seen.size,960,'960 distinct start positions'); eq(X.back960(518),'RNBQKBNR','960 #518 is the standard position');
  // castling across every arrangement: empty the back rank between king and rooks, then both castles must work
  // (only the king and rooks on the back rank; the expected castles worked out independently: every square the king
  // and rook cross or land on is empty apart from those two)
  let bad=0, both=0; for(let n=0;n<960;n++){ const w=X.back960(n), row=[...w].map(ch=>ch==='K'||ch==='R'?ch:'1').join('').replace(/1+/g,m=>m.length);
    const fen=`8/8/8/8/3k4/8/8/${row} w ${X.fen960(n).split(' ')[2].replace(/[a-h]/g,'')} - 0 1`, p=X.fromFEN(fen); p.c960=true;
    const k=w.indexOf('K'), rs=[w.lastIndexOf('R'),w.indexOf('R')]; let want=0;
    for(const sd of [0,1]){ const r=rs[sd], kt=sd?2:6, rt=sd?3:5, lo=Math.min(k,r,kt,rt), hi=Math.max(k,r,kt,rt); let free=true; for(let x=lo;x<=hi;x++) if(x!==k&&x!==r&&w[x]==='R') free=false; if(free) want++; }
    const cs=X.legalMoves(p).filter(m=>X.mFlags(m)&X.F_CASTLE); if(cs.length!==want){ bad++; continue; } if(want===2) both++;
    for(const m of cs){ X.makeMove(p,m); const sd=X.castleSide(m), k=sd?2:6, r=sd?3:5; if(p.b[k]!==X.KING||p.b[r]!==X.ROOK) bad++; X.unmakeMove(p); } }
  eq(bad,0,`castling right in all 960 arrangements: king to g/c, rook to f/d (${both} allow both sides)`);
  const p=X.fromFEN('4k3/8/8/8/8/8/8/1R3K1R w HB - 0 1'); p.c960=true; const ms=X.legalMoves(p).filter(m=>X.mFlags(m)&X.F_CASTLE).map(m=>X.toUci(p,m)).sort(); eq(ms,['f1b1','f1h1'],'960 castling written king → rook');
  const q=X.fromFEN('4k3/8/8/8/8/8/8/1R3K1R w HB - 0 1'); q.c960=true; X.makeMove(q,X.fromUci(q,'f1h1')); eq([q.b[6],q.b[5]],[X.KING,X.ROOK],'960 O-O from f1: king g1, rook f1');
  const blocked=X.fromFEN('4k3/8/8/8/8/8/8/1RN2K1R w HB - 0 1'); blocked.c960=true; ok(!X.legalMoves(blocked).some(m=>X.mFlags(m)&X.F_CASTLE&&X.castleSide(m)===1),'960: a piece on the rook\'s path blocks O-O-O');
  const att=X.fromFEN('4k1r1/8/8/8/8/8/8/1R3K1R w HB - 0 1'); att.c960=true; ok(!X.legalMoves(att).some(m=>X.mFlags(m)&X.F_CASTLE&&X.castleSide(m)===0),'960: no O-O onto an attacked g1');
  eq(X.toFEN(X.fromFEN(X.fen960(100))),X.fen960(100),'960 FEN round trip'); }
sec('castling and en passant');
{ const p=X.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); eq(X.legalMoves(p).filter(m=>X.mFlags(m)&X.F_CASTLE).length,2,'both castles');
  const q=X.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); X.makeMove(q,X.fromUci(q,'a1a2')); X.makeMove(q,X.fromUci(q,'a8a7')); eq(X.legalMoves(q).filter(m=>X.mFlags(m)&X.F_CASTLE).length,1,'moving a rook loses that castle');
  const c=X.fromFEN('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1'); ok(X.inCheck(c)===false&&X.legalMoves(c).filter(m=>X.mFlags(m)&X.F_CASTLE).length===1,'no castling through an attacked square');
  const ck=X.fromFEN('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1'); eq(X.legalMoves(ck).filter(m=>X.mFlags(m)&X.F_CASTLE).length,0,'no castling out of check');
  const e=play(X.START_FEN,['e2e4','a7a6','e4e5','d7d5']); const ep=X.fromUci(e,'e5d6'); ok(ep&&X.mFlags(ep)&X.F_EP,'en passant available'); X.makeMove(e,ep); eq(e.b[X.parseSq('d5')],0,'en passant removes the pawn');
  const e2=play(X.START_FEN,['e2e4','a7a6','e4e5','d7d5','g1f3','a6a5']); ok(!X.fromUci(e2,'e5d6'),'en passant only right away');
  const pr=X.fromFEN('8/4P3/8/8/8/8/k7/4K3 w - - 0 1'); eq(X.legalMoves(pr).filter(m=>X.mPromo(m)).length,4,'four promotions'); }
sec('draws');
{ const p=X.fromFEN(X.START_FEN); for(const u of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']) X.makeMove(p,X.fromUci(p,u));
  eq(X.gameStatus(p).reason,'repetition','threefold repetition');
  const f=X.fromFEN('4k3/8/8/8/8/8/R7/4K3 w - - 99 80'); X.makeMove(f,X.fromUci(f,'a2a3')); eq(X.gameStatus(f).reason,'fifty','fifty-move rule');
  const f2=X.fromFEN('4k3/8/8/8/8/8/P7/4K3 w - - 99 80'); X.makeMove(f2,X.fromUci(f2,'a2a3')); ok(!X.gameStatus(f2).over,'a pawn move resets the count');
  for(const [fen,ins] of [['4k3/8/8/8/8/8/8/4K3 w - - 0 1',1],['4k3/8/8/8/8/8/8/2B1K3 w - - 0 1',1],['4k3/8/8/8/8/8/8/1N2K3 w - - 0 1',1],['2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1',0],['3bk3/8/8/8/8/8/8/2B1K3 w - - 0 1',1],['4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1',0],['4k3/8/8/8/8/8/P7/4K3 w - - 0 1',0]])
    eq(X.insufficient(X.fromFEN(fen)),!!ins,`insufficient material ${fen.split(' ')[0]}`);
  eq(X.gameStatus(X.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).reason,'stalemate','stalemate');
  const m=X.gameStatus(X.fromFEN('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1')); ok(m.reason==='checkmate'&&m.result==='1-0','checkmate'); }
sec('notation');
{ const p=X.fromFEN('4k3/8/8/8/8/2N3N1/8/R3K2R w KQ - 0 1');
  const san=u=>X.toSan(p,X.fromUci(p,u));
  eq(san('c3e2'),'Nce2','disambiguate by file'); eq(san('e1g1'),'O-O','O-O'); eq(san('e1c1'),'O-O-O','O-O-O'); eq(san('a1a8'),'Ra8+','check suffix');
  const r=X.fromFEN('4k3/8/8/R7/8/8/8/R3K3 w Q - 0 1'); eq(X.toSan(r,X.fromUci(r,'a1a3')),'R1a3','disambiguate by rank');
  const q=X.fromFEN('4k3/8/8/8/2Q1Q3/8/2Q5/4K3 w - - 0 1'); eq(X.toSan(q,X.fromUci(q,'c4d3')).replace('+',''),'Qc4d3','disambiguate by square');
  eq(X.toSan(X.fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'),X.fromUci(X.fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'),'a1a8')),'Ra8#','mate suffix');
  const pp=X.fromFEN('8/4P3/8/8/8/8/k7/4K3 w - - 0 1'); eq(X.toSan(pp,X.fromUci(pp,'e7e8n')),'e8=N','promotion');
  const s=X.fromFEN(X.START_FEN); for(const [t,u] of [['e4','e2e4'],['Nf3','g1f3'],['nf3','g1f3'],['e2e4','e2e4'],['Nf3!','g1f3']]) eq(X.toUci(s,X.fromSan(s,t)),u,`typed "${t}"`);
  const c=play(X.START_FEN,['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6']); for(const t of ['O-O','0-0','o-o','OO']) eq(X.toUci(c,X.fromSan(c,t)),'e1g1',`typed castling "${t}"`);
  eq(X.fromSan(s,'Nf4'),0,'illegal typed move refused'); eq(X.toUci(pp,X.fromSan(pp,'e8Q')),'e7e8q','typed promotion without =');
  for(const [,f] of PERFT) eq(X.toFEN(X.fromFEN(f)),f,`FEN round trip ${f.slice(0,24)}…`);
  const g=X.gameNew(); for(const u of ['e2e4','e7e5','g1f3']) g.moves.push(u); eq(X.gameSans(g),['e4','e5','Nf3'],'game SAN list'); eq(X.toFEN(X.posAt(g,1)).split(' ')[0],'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR','posAt replays'); }

// ---------------- engine ----------------
sec('engine: mates');
{ const M=[['r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',1],['6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',1],
   ['8/6p1/r2k4/3p1pPp/5RnP/6P1/4K3/1q6 b - - 1 50',2],['3k4/Nr6/5p2/2b2B1P/6P1/P7/1q3Pb1/4K3 b - - 1 40',2],['b3kb1r/5ppp/1pp1pn2/6K1/PpBr4/3P1P1Q/2P3PP/4q1NR b k - 4 26',2],
   ['8/2p1kpp1/8/p1P1P1p1/Pp6/3P1Q2/8/2R1KR2 w - - 0 34',3],['1r3bn1/1pp1kpp1/p1n5/3qp2p/P6P/1PPpPP2/3R4/1N1KB2r b - - 0 26',3],['1k6/8/5N2/2p1P3/p4RP1/P4B1P/8/2KR4 w - - 7 51',3]];
  for(const [f,n] of M){ X.ttClear(); const p=X.fromFEN(f), r=X.think(p,{depth:2*n+2}); eq(r.score,X.MATE-(2*n-1),`finds mate in ${n}: ${f.slice(0,28)}…`);
    let q=X.fromFEN(f), k=0; for(;k<2*n;k++){ X.ttClear(); const m=X.think(q,{depth:2*n+2-k}).move; X.makeMove(q,m); if(X.gameStatus(q).over) break; } ok(X.gameStatus(q).reason==='checkmate',`plays the mate in ${n} through`); } }
sec('engine: legal moves, slices, book, strength order');
{ let bad=0, games=QUICK?4:16; for(let g=0;g<games;g++){ const p=X.fromFEN(g%3===2?X.fen960(g*37%960):X.START_FEN); if(g%3===2) p.c960=true; const r=X.rngFor('legal'+g);
    for(let ply=0;ply<160;ply++){ if(X.gameStatus(p).over) break; X.ttClear(); const lv=1+(g+ply)%4, m=X.computerMove(p,lv,r).move; if(!X.legalMoves(p).includes(m)){ bad++; break; } X.makeMove(p,m); } }
  eq(bad,0,'the computer never plays an illegal move (standard and Chess960)');
  // slices: drive the search the way the page does, measuring each step
  const times=[]; for(const f of [X.START_FEN,'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1','r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10']){
    X.ttClear(); const gen=X.thinkGen(X.fromFEN(f),{time:QUICK?600:1500}); let r; do{ const a=performance.now(); X.SR.slice=a+SLICE_MS; r=gen.next(); times.push(performance.now()-a); }while(!r.done); }
  times.sort((a,b)=>a-b); const p99=times[Math.floor(times.length*.99)], mx=times[times.length-1];
  ok(p99<8.5,`search slices (budget ${SLICE_MS} ms, the page's): 99% under 8.5 ms (got ${p99.toFixed(1)} ms over ${times.length} slices)`); ok(mx<20,`search slices: worst ${mx.toFixed(1)} ms`);
  eq(X.bookBuild().bad,[],'opening book: every line legal'); ok(X.bookBuild().size>=300,`opening book: ${X.bookBuild().size} positions (≥ 300)`);
  const s=X.fromFEN(X.START_FEN), picks=new Set(); for(let i=0;i<40;i++) picks.add(X.toUci(s,X.bookPick(s,X.rngFor('b'+i)))); ok(picks.size>=3,`opening book varies: ${[...picks].join(' ')}`);
  ok(X.legalMoves(s).includes(X.bookPick(s,Math.random)),'book move is legal');
  // strength order: each pair of strengths, the stronger should score better (the full table: tools/calibrate.js)
  const pairs=QUICK?[[1,3]]:[[1,3],[2,4],[3,5]], N=QUICK?4:8;
  for(const [lo,hi] of pairs){ let sc=0; for(let g=0;g<N;g++){ const p=X.fromFEN(X.START_FEN), r=X.rngFor('ord'+lo+hi+g), hw=g%2===0; let out=.5;
      for(let ply=0;ply<200;ply++){ const st=X.gameStatus(p); if(st.over){ out=st.result==='1-0'?1:st.result==='0-1'?0:.5; break; } X.ttClear(); X.makeMove(p,X.computerMove(p,(p.side===0)===hw?hi:lo,r).move); }
      sc+=hw?out:1-out; }
    ok(sc/N>=.6,`strength ${hi} beats strength ${lo} (${sc}/${N})`); } }

// ---------------- puzzles ----------------
sec('puzzles');
{ const all=X.puzList(); ok(all.length>0,`Classic bank: ${all.length} puzzles`); const daily=[0,1,2,3,4,5,6].flatMap(w=>X.puzDaily(w)); ok(daily.length>0,`Daily bank: ${daily.length} puzzles`);
  let bad=0, mates=0, badMate=0;
  for(const pz of [...all,...daily]){ try{ const p=X.fromFEN(pz.fen); for(const u of pz.sol){ const m=X.fromUci(p,u); if(!m) throw 0; X.makeMove(p,m); }
      if(pz.themes.some(t=>/^mate/.test(t)||t==='backRankMate')){ mates++; if(!(X.inCheck(p)&&!X.legalMoves(p).length)) badMate++; } }catch(e){ bad++; } }
  eq(bad,0,'every bank puzzle replays legally'); eq(badMate,0,`every mate puzzle ends in mate (${mates} checked)`);
  ok(all.every(p=>p.id&&p.rating>=600&&p.rating<=2600),'ids and ratings 600–2600');
  const ids=new Set(all.map(p=>p.id)); ok(daily.every(p=>!ids.has(p.id)),'the Daily part never appears in Classic Puzzles');
  // any move that also mates is accepted
  const p=X.fromFEN('6k1/5ppp/8/8/8/8/8/RR4K1 w - - 0 1'); ok(X.puzzleMoveOk(p,X.fromUci(p,'b1b8'),'a1a8'),'an alternative mate counts'); ok(!X.puzzleMoveOk(p,X.fromUci(p,'b1b7'),'a1a8'),'a non-mating alternative doesn\'t');
  const S=X.defSave(); const seen=new Set(); let rep=false; for(let i=0;i<30;i++){ const z=X.pickPuzzle(S,{by:'band',band:'easy'},X.rngFor('pk'+i)); if(!z) break; if(seen.has(z.id)) rep=true; seen.add(z.id); }
  ok(!rep||seen.size>=X.puzList().filter(p=>X.bandOf(p.rating)==='easy').length,'no repeats until that part of the bank is used up');
  ok(X.PUZ_BANDS.every(b=>all.some(p=>X.bandOf(p.rating)===b[0])),'every difficulty has puzzles');
  eq(JSON.stringify(X.puzzleStars(true,0,0)),'[1,1,1]','puzzle stars: solved, first try, no hints'); eq(JSON.stringify(X.puzzleStars(true,1,1)),'[1,0,0]','puzzle stars with a wrong move and a hint');
  const S2=X.defSave(); let xp=0; for(let i=0;i<20;i++) xp+=X.recordPuzzle(S2,all[0],true,0,0,'2026-11-25').xp; eq(xp,30,'puzzle XP: 2 per first-try solve, capped at 30 a day');
  eq(S2.rec.puzStreak,20,'puzzle streak counts first-try solves'); X.recordPuzzle(S2,all[0],true,1,0,'2026-11-25'); eq(S2.rec.puzStreak,0,'a wrong move ends the streak'); eq(S2.rec.puzBest,20,'best streak kept');
  const st=[0,5,10].map(n=>X.pickStreak(n,X.rngFor('st'+n))); ok(st.every(Boolean)&&st[2].rating>=st[0].rating,'Puzzle Streak gets harder'); }

// ---------------- analysis ----------------
sec('analysis');
{ const g=X.gameNew(); for(const u of ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','f3g5','d7d5','e4d5','f6d5','g5f7','e8f7','d1f3','f7e6']) g.moves.push(u);
  const a={evals:[]}, A=X.runGen(X.analyseGen(g,a,{depth:5})), b={evals:[]}; X.ttClear(); X.computerMove(X.fromFEN(X.START_FEN),5,X.rngFor('x')); const B=X.runGen(X.analyseGen(g,b,{depth:5}));
  eq(JSON.stringify(A),JSON.stringify(B),'the same game gives the same classifications and accuracy'); eq(A.moves.length,g.moves.length,'every move classified');
  ok(A.acc[0]!=null&&A.acc[0]>=0&&A.acc[0]<=100,`accuracy White ${A.acc[0]}%, Black ${A.acc[1]}%`); eq(A.graph.length,g.moves.length+1,'evaluation graph has every position');
  // resumes after leaving: run half, stop, then continue from the saved evals
  const c={evals:[]}, it=X.analyseGen(g,c,{depth:5}); X.SR.slice=Infinity; for(let k=0;k<6;k++) it.next(); const saved=JSON.parse(JSON.stringify(c)); ok(saved.evals.length>0&&saved.evals.length<g.moves.length+1,'partial analysis saved');
  const C=X.runGen(X.analyseGen(g,saved,{depth:5})); eq(JSON.stringify(C),JSON.stringify(A),'analysis resumes where it left off');
  const last=A.moves[A.moves.length-1]; ok(['inaccuracy','mistake','blunder'].includes(last.cls),`a bad move (…Ke6) is marked: ${last.cls}`); }

// ---------------- Daily ----------------
sec('Daily');
{ const fp=[]; for(let i=0;i<(QUICK?30:120);i++){ const d=new Date(Date.UTC(2026,10,25+i)).toISOString().slice(0,10); fp.push(X.dailyFingerprint(d)); const p=X.dailyPuzzle(d), w=X.weekdayOf(d);
    ok(p&&p.rating>=X.DAILY_BANDS[w][0]&&p.rating<X.DAILY_BANDS[w][1],`${d}: rating ${p&&p.rating} in the weekday band`); }
  const X2=load(); eq(fp.slice(0,30).map(d=>d),Array.from({length:30},(_,i)=>X2.dailyFingerprint(new Date(Date.UTC(2026,10,25+i)).toISOString().slice(0,10))),'the same date gives the same puzzle (separate load)');
  const pin=JSON.parse(fs.readFileSync(path.join(__dirname,'daily_pins.json'),'utf8'));
  for(const [d,id] of Object.entries(pin)) eq(X.dailyFingerprint(d),id,`Daily pinned ${d} → ${id}`);
  eq(X.weekdayOf('2026-11-23'),1,'Monday'); eq(X.DAILY_BANDS[1],[800,1100],'Monday 800–1100'); eq(X.DAILY_BANDS[0],[2100,2400],'Sunday 2100–2400');
  const S=X.defSave(); const r=X.dailyResult(S,'2026-11-25',true,0,0,48000,'2026-11-25'); eq(r.xp,40,'Daily XP doubled on its release day'); eq(X.dailyResult(S,'2026-11-25',true,0,0,1,'2026-11-25'),null,'one scored attempt');
  eq(X.dailyResult(X.defSave(),'2026-11-24',true,0,0,1,'2026-11-25').xp,20,'Daily XP 20 on a later day');
  const line=X.shareLine('2026-11-25',true,3,true,48000); eq(line,'Chess Daily · Wed 25 Nov · ★★★ · first try · 0:48','share line'); ok(!/[a-h][1-8]|O-O|[KQRBN]x?[a-h]/.test(line),'share line has no moves');
  const T=X.defSave(); for(let i=0;i<7;i++) X.dailyResult(T,new Date(Date.UTC(2026,10,23+i)).toISOString().slice(0,10),true,0,0,1000,'x'); eq(T.dstreak.cur,7,'Daily streak'); ok(T.dweek.every(Boolean),'Full Week'); eq(Object.keys(T.dhist).length,7,'last 7 kept');
  ok(X.checkAch(T,{mode:'daily'}).includes('dweek'),'Full Week achievement'); }

// ---------------- campaign ----------------
sec('campaign');
{ eq(X.LEVELS.length,45,'45 levels'); eq(X.CAMPS.map(c=>c.name),['Pawn','Knight','Queen'],'three campaigns');
  for(const L of X.LEVELS){
    if(L.type==='set'||L.type==='tech'){ ok(L.puzzles.length>=3&&L.puzzles.length<=5&&L.puzzles.every(id=>X.puzById(id)),`${L.id} ${L.name}: ${L.puzzles.length} puzzles in the bank`); }
    else { ok(L.strength>=1&&L.strength<=8,`${L.id} ${L.name}: strength ${L.strength}`); if(L.fen){ const p=X.fromFEN(L.fen); ok(X.legalMoves(p).length>0,`${L.id}: start position legal`); } }
    if(L.type==='drill'||L.type==='pos') ok(L.par>0,`${L.id}: par ${L.par}`); }
  const ids=X.LEVELS.flatMap(L=>L.puzzles||[]); eq(new Set(ids).size,ids.length,'no puzzle used twice in the campaign');
  for(const c of [0,1,2]){ const ls=X.LEVELS.filter(L=>L.camp===c); eq([4,8,12].map(n=>ls[n-1].type).every(t=>t==='drill'||t==='hold'),true,`campaign ${c}: drills at 4, 8, 12`); eq(ls[9].type,'tech',`campaign ${c}: technique set at 10`); eq(ls[14].type,'game',`campaign ${c}: game finale at 15`); ok(ls[6].twists&&ls[13].twists,`campaign ${c}: twists at 7 and 14`); }
  eq([0,1,2].map(c=>X.LEVELS.find(L=>L.camp===c&&L.n===15).strength),[3,5,8],'finales against strengths 3, 5 and 8');
  const twists=new Set(X.LEVELS.flatMap(L=>L.twists||[])); for(const t of ['clock','c960','black','noassist']) ok(twists.has(t),`twist used: ${t}`);
  const S=X.defSave(), L1=X.LEVELS[0]; ok(X.unlocked(S,L1)&&!X.unlocked(S,X.LEVELS[1]),'level 1 open, level 2 locked'); ok(!X.campOpen(S,1),'Knight locked');
  let r=X.campaignResult(S,L1,{cleared:true,s2:false,s3:true}); eq(r.earned,[1,0,1],'stars earned'); eq(r.xp,12,'6 XP per new star (Pawn)');
  r=X.campaignResult(S,L1,{cleared:true,s2:true,s3:false}); eq(r.fresh,[1],'stars build up across attempts'); eq(X.campStars(S,L1.id),3,'3 stars');
  r=X.campaignResult(S,L1,{cleared:false,s2:true,s3:true}); eq(r.xp,0,'no XP for stars already earned'); ok(X.unlocked(S,X.LEVELS[1]),'clearing unlocks the next level');
  for(const L of X.LEVELS.filter(L=>L.camp===0)) X.campaignResult(S,L,{cleared:true,s2:true,s3:true}); ok(X.campOpen(S,1),'clearing level 15 opens Knight');
  const g=X.LEVELS.find(L=>L.type==='game'&&L.camp===1), S3=X.defSave(); X.campaignResult(S3,g,{cleared:true,s2:true,s3:false}); const acc=X.campaignAccStar(S3,g,80); ok(acc&&X.campStars(S3,g.id)===3,'the accuracy star arrives with the analysis');
  eq(X.levelStarText(X.LEVELS.find(L=>L.type==='drill')).length,3,'drill star goals');
  ok(X.starUnlocks().map(u=>u.stars).join()==='30,75,135','star-total unlocks at 30, 75, 135');
  if(!QUICK){ // every drill is won by the engine within par
    for(const L of X.LEVELS.filter(L=>L.type==='drill')){ const p=X.fromFEN(L.fen), me=p.side; let n=0;
      for(let ply=0;ply<2*L.par+2;ply++){ const st=X.gameStatus(p); if(st.over) break; X.ttClear(); const m=p.side===me?X.think(p,{time:300,hard:600}).move:X.computerMove(p,L.strength,X.rngFor(L.id+ply)).move; if(p.side===me) n++; X.makeMove(p,m); }
      const st=X.gameStatus(p); ok(st.reason==='checkmate'&&n<=L.par,`${L.id} ${L.name}: engine mates in ${n} (par ${L.par})`); } } }

// ---------------- 2-Player codes ----------------
sec('2-Player codes');
{ const g={id:[1,2,3,4,5,6],c960:-1,p0black:false,names:['Ana','Ben'],avs:[3,7],moves:['e2e4','e7e5','g1f3'],end:0,offer:false};
  const code=X.encodeGame(g), d=X.decodeGame(`Here: ${code} — your move!`); eq(d.moves,g.moves,'round trip: moves'); eq(d.names,g.names,'round trip: names'); eq(d.avs,[3,7],'round trip: both avatars'); eq(d.id,'010203040506','round trip: id');
  const n=X.encodeGame(Object.assign({},g,{avs:[0,0]})); eq(X.decodeGame(n).avs,[0,0],'a code without avatars reads as 0 and still plays'); ok(n.length<code.length,'no avatar bytes when there are none');
  const raw=X.fromB64U(code.slice(5)), body=raw.slice(0,-2), mpos=body.length-3; eq([body[mpos],body[mpos+1],body[mpos+2]],[0xA1,3,7],'avatars sit after the moves, before the checksum');
  const c9=X.decodeGame(X.encodeGame(Object.assign({},g,{c960:417,moves:[]}))); eq(c9.c960,417,'Chess960 seed round trip');
  const long=X.gameNew(); const p=X.fromFEN(X.START_FEN), r=X.rngFor('cl'); for(let i=0;i<120&&!X.gameStatus(p).over;i++){ const ms=X.legalMoves(p), m=ms[Math.floor(r()*ms.length)]; long.moves.push(X.toUci(p,m)); X.makeMove(p,m); }
  const lc=X.encodeGame(Object.assign({},g,{moves:long.moves})); eq(X.decodeGame(lc).moves,long.moves,`a ${long.moves.length}-ply game round-trips (${lc.length} chars)`);
  const bad=code.slice(0,-3)+(code.slice(-3,-2)==='A'?'B':'A')+code.slice(-2); eq(X.importCheck(bad,{games:[],deleted:[]}).why,'bad','a damaged code is refused');
  eq(X.importCheck('hello',{games:[],deleted:[]}).why,'nocode','no code in the text');
  // illegal move: hand-made code with a move index past the legal moves
  const b=[1,1,2,3,4,5,6,0,0,0,1,65,1,66,0,1,250], ck=X.fnv16(b); b.push(ck>>8,ck&255); eq(X.importCheck('CHF1.'+X.toB64U(Uint8Array.from(b)),{games:[],deleted:[]}).why,'invalid','an illegal move is refused');
  // joining: seat 1 plays Black, it's their turn after White's first move
  const j=X.importCheck(code.replace(code,X.encodeGame(Object.assign({},g,{moves:['e2e4']}))),{games:[],deleted:[]}); ok(j.ok&&j.isNew&&j.me===1,'join: the code is yours to answer');
  const wrong=X.importCheck(X.encodeGame(Object.assign({},g,{moves:['e2e4','e7e5']})),{games:[],deleted:[]}); eq(wrong.why,'notyours','wrong turn refused (White to move, you are Black)');
  const have={id:'010203040506',me:1,moves:['e2e4','e7e5','g1f3'],end:0,offer:false};
  eq(X.importCheck(X.encodeGame(Object.assign({},g,{moves:['e2e4']})),{games:[have],deleted:[]}).why,'older','an older code is refused');
  eq(X.importCheck(X.encodeGame(Object.assign({},g,{moves:['e2e4','e7e5','g1f3']})),{games:[have],deleted:[]}).why,'same','the same code twice');
  eq(X.importCheck(code,{games:[],deleted:['010203040506']}).why,'deleted','a deleted game is refused');
  const end=X.decodeGame(X.encodeGame(Object.assign({},g,{end:2}))); eq(X.codeStatus(end).result,'1-0','a resignation travels in the code');
  const off=X.decodeGame(X.encodeGame(Object.assign({},g,{offer:true}))); ok(off.offer,'a draw offer travels in the code');
  const S=X.defSave(); const tg={id:'aa',mode:'code',me:0,p0black:false,moves:[]}; ok(X.tpCount(S,tg,{over:true,winner:0}),'a share-code win counts'); ok(!X.tpCount(S,tg,{over:true,winner:0}),'…once'); eq(S.tp.wins,1,'Rivals count');
  ok(!X.tpCount(S,{id:'bb',mode:'local',me:null},{over:true,winner:0}),'pass-and-play counts nothing');
  for(let i=0;i<4;i++) X.tpCount(S,{id:'c'+i,mode:'code',me:0,p0black:false},{over:true,winner:0}); ok(X.checkAch(S,{mode:'tp'}).includes('riv1'),'Rivals I at 5 wins'); ok(!X.checkAch(S,{mode:'tp',local:true}).length,'no achievements from pass-and-play'); }

// ---------------- core ----------------
sec('core');
{ const old=JSON.stringify({v:1,xp:120,ach:{beat1:1},rec:{wins:3}}), S=X.loadSave(old); eq(S.xp,120,'old save keeps XP'); ok(S.prefs&&S.look&&S.tp&&Array.isArray(S.anq),'old save gets new fields (defSave)'); eq(S.rec.wins,3,'nested fields kept'); eq(S.rec.puzSolved,0,'missing nested fields filled');
  const run={mode:'classic',g:{start:X.START_FEN,moves:['e2e4','c7c5','g1f3','d7d6'],c960:-1},me:0,level:4,left:[100000,90000],hints:1}; const R=JSON.parse(JSON.stringify(run));
  eq(X.toFEN(X.posAt(R.g)),X.toFEN(X.posAt(run.g)),'a game mid-move restores exactly'); eq(R.left,[100000,90000],'clocks restore');
  const T=X.defSave(); let rew=0; for(let l=2;l<=10;l++){ ok(X.rewardsAt(l).length>0,`level ${l} has a reward: ${X.rewardsAt(l).join(', ')}`); rew++; }
  const x=X.addXP(T,3175); eq(x.after,10,'level 10 at 3,175 XP'); eq(x.hints,9,'+1 hint per level-up'); eq(T.hints,X.HINT_CAP+9,'hints added');
  eq(X.classicXP(4,'win',false),25,'win pays 5 + 5 × strength'); eq(X.classicXP(8,'win',false),45,'strength 8 win = 45'); eq(X.classicXP(4,'draw',false),13,'a draw pays half'); eq(X.classicXP(4,'win',true),13,'assisted wins earn half'); eq(X.classicXP(4,'loss',false),0,'losses pay nothing');
  const H=X.defSave(); H.hints=0; X.refreshHints(H,'2026-11-25'); eq(H.hints,5,'hints refill to 5 daily'); H.hints=40; X.refreshHints(H,'2026-11-26'); eq(H.hints,40,'earned hints stack'); H.hints=98; X.addXP(H,3175); eq(H.hints,99,'hints cap at 99');
  eq(JSON.stringify(X.gameStars(true,false,80)),'[1,1,1]','game stars'); eq(JSON.stringify(X.gameStars(true,true,null)),'[1,0,0]','assisted game, accuracy pending');
  const G=X.defSave(); X.recordGame(G,{level:3,colour:0,result:'win'}); X.recordGame(G,{level:3,colour:0,result:'win'}); X.recordGame(G,{level:3,colour:1,result:'loss',c960:true});
  eq(G.rec.by['3|w'],{w:2,d:0,l:0},'records per strength × colour'); eq(G.rec.bestStreak,2,'longest win streak'); eq(G.rec.streak,0,'a loss ends the streak'); eq(G.rec.c960.l,1,'Chess960 record');
  // achievements from the game itself
  const mateG=(fen,ucis)=>({start:fen,moves:ucis,c960:-1});
  const A=X.defSave(); ok(X.checkAch(A,{mode:'classic',won:true,level:1,colour:0,g:mateG('6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',['g5f7'])}).includes('smother'),'smothered mate detected');
  ok(X.checkAch(X.defSave(),{mode:'classic',won:true,level:1,colour:0,g:mateG('8/8/8/8/8/8/R7/R3K2k w Q - 0 1',['e1c1'])}).includes('mcastle'),'mate by castling detected');
  ok(X.checkAch(X.defSave(),{mode:'classic',won:true,level:1,colour:0,g:mateG('8/8/8/2k5/2Pp4/2K5/1P1P4/8 b - c3 0 1',['d4c3'])}).length>=0,'en passant game handled');
  ok(X.checkAch(X.defSave(),{mode:'classic',won:true,level:1,colour:0,g:mateG('7k/4P3/7K/8/8/8/8/8 w - - 0 1',['e7e8q'])}).includes('mpromo'),'mate by promotion detected');
  ok(X.checkAch(X.defSave(),{mode:'classic',won:true,level:5,colour:1,g:mateG(X.START_FEN,['f2f3','e7e5','g2g4','d8h4'])}).includes('black5'),'win as Black vs 5+');
  ok(X.checkAch(X.defSave(),{mode:'classic',won:true,level:4,colour:1,g:mateG(X.START_FEN,['f2f3','e7e5','g2g4','d8h4'])}).includes('mquick'),'mate in under 20 moves vs 4+');
  const B=X.defSave(); B.xp=999; B.rec.wins=7; const code=X.backupPlain(B), back=X.parseBackup('my backup: '+code); eq(back.xp,999,'backup round trip'); eq(X.parseBackup('nope'),null,'not a backup');
  const C=X.defSave(); C.xp=3175; ok(X.COS.pieces.filter(it=>X.owned(C,it)).length>=4,'levels unlock piece sets'); const U=X.defSave(); eq(X.COS_KINDS.map(([k])=>X.owned(U,X.COS[k][0])).every(Boolean),true,'every default is owned');
  eq(X.COS_KINDS.map(([k])=>X.COS[k].length),[6,6,4,3,4,3,4,3],'cosmetics per category');
  ok(X.ACH.every(a=>!a.reward||X.COS_KINDS.some(([k])=>X.COS[k].some(it=>it.req===a.id))),'every achievement reward is a real cosmetic');
  // pieces: every set draws all twelve pieces; white and black differ by more than colour
  for(const set of X.PSETS) for(const t of 'KQRBNP'){ const w=X.pieceBody(set,t,false), b=X.pieceBody(set,t,true); ok(w.length>40&&b.length>40&&w!==b.replace(/#[0-9a-f]{3,6}/gi,''),`${set} ${t} drawn`); } }

// ---------------- Arcade contract ----------------
sec('Arcade contract');
{ const store=new Map([['arcade.v1',JSON.stringify({set:{appearance:'dark',sfx:false,music:false,motion:false,lang:'de',cb:true,lefty:true,haptics:false,fullscreen:false},name:'Zoe'})]]);
  const a=X.readArcade({get:k=>store.get(k)}), P=X.applyShared(X.defSave(),a); eq([P.appearance,P.sfx,P.lang,P.name,P.cb],['dark',false,'de','Zoe',true],'shared settings and the name come from arcade.v1');
  const S=X.defSave(); ok(P!==S&&S.appearance==='system','shared settings are applied in memory only');
  const sm=X.summary(S); for(const k of ['v','game','ver','level','maxLevel','xp','xpLevel','xpNext','ach','hi','last']) ok(k in sm,`summary has ${k}`);
  eq(sm.game,'chess','summary game id'); eq(sm.maxLevel,10,'maxLevel 10'); eq(sm.hi.map(h=>h[0]),['Wins','Puzzles solved','Campaign stars'],'summary highlights'); eq(sm.ach.length,X.ACH.length,'summary achievements');
  const keys=[...ALLSRC.matchAll(/store\.(?:get|set)\(\s*'([^']+)'/g)].map(m=>m[1]).concat([X.KEY,X.SUMKEY]); ok(keys.every(k=>k.startsWith('chess.')||k==='arcade.summary.chess'||k==='arcade.v1'),`only chess.* keys written (${[...new Set(keys)].join(', ')})`);
  ok(!/store\.set\(\s*ARCADE_KEY/.test(ALLSRC),'arcade.v1 is never written');
  ok(/ARCADE_HOME='\.\.\/index\.html'/.test(SRC)&&/ARCADE_PREFS='\.\.\/index\.html#prefs'/.test(SRC),'ARCADE_HOME and ARCADE_PREFS');
  ok(/function leaveTo\(url\)\{[^}]*location\.replace\(url\)/.test(SRC),'leaveTo uses location.replace'); ok(!/location\.href\s*=|location\.assign\(/.test(SRC),'never location.href= or assign');
  ok(/location\.hash==='#game-settings'/.test(SRC)&&/history\.replaceState/.test(SRC),'#game-settings opens settings and clears the hash');
  ok(/id="arcadeBtn"/.test(SRC)&&/id="settingsBtn"/.test(SRC),'#arcadeBtn and #settingsBtn exist');
  ok(!/serviceWorker/.test(ALLSRC),'no service worker'); ok(!/https?:\/\/(?!www\.w3\.org)/.test(ALLSRC),'no outside URLs');
  ok(/ARCADE&&!!window\.ArcadeAvatars/.test(SRC),'avatars only when ArcadeAvatars exists');
  // a // comment followed by more code on the same line silently swallows that code (the Arcade 0.12 League bug)
  const swallowed=ALLSRC.split('\n').map((l,i)=>[l.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g,"''"),i]).filter(([l])=>{ const k=l.search(/(^|[^:])\/\/ /); return k>=0&&/[;{}]\s*(let|const|try|if|for|return|function)\b/.test(l.slice(k)); });
  eq(swallowed.map(x=>x[1]),[],'no code hidden after a // comment on the same line'); }

const {pass,fail,fails}=res(); console.log(`\n${pass} passed, ${fail} failed (${((Date.now()-t0)/1000).toFixed(1)} s)`); if(fail) process.exit(1);
