// → src/levels.js: the 45 campaign levels (3 campaigns × 15, Sweep's pattern).
//   node tools/build_levels.js          (needs src/puzzles.js; ~5 min: it plays every drill and position game to set par)
//   node tools/build_levels.js --nopar  (reuses the par values already in src/levels.js)
// Puzzle sets take puzzles from the bank by theme and rating (seeded, no repeats between levels). Drill and
// position-game par comes from the engine's own winning line, plus slack: par = ceil(moves × 1.5) + 4 (+5 for position
// games), capped at 48 for pawnless drills (the fifty-move rule).
const fs=require('fs'), path=require('path');
const {load}=require('../tests/lib.js'); const X=load(['engine.js','search.js','book.js','puzzles.js']);
const OUT=path.join(__dirname,'..','src','levels.js'), NOPAR=process.argv.includes('--nopar');
let OLD={}; if(NOPAR&&fs.existsSync(OUT)){ const t=fs.readFileSync(OUT,'utf8'); for(const m of t.matchAll(/id:'(\w+)'[^\n]*?par:(\d+)/g)) OLD[m[1]]=+m[2]; }
const decode=e=>{ const f=e.split('~'), sc=f[2], side=sc[0], ep=/[a-h][36]$/.test(sc)?sc.slice(-2):'-', cast=sc.slice(1,ep==='-'?undefined:-2)||'-';
  const th=parseInt(f[6]||'0',36); const sol=[]; let i=0, s=f[4]; while(i<s.length){ let u=s.slice(i,i+4); i+=4; if(i<s.length&&'QRBN'.includes(s[i])){ u+=s[i].toLowerCase(); i++; } sol.push(u); }
  return {id:f[0],fen:`${f[1]} ${side} ${cast} ${ep} 0 1`,sol,rating:parseInt(f[5],36),themes:X.PUZ_THEMES.filter((t,k)=>th&(2**k))}; };
const BANK=X.PUZ_C.split(',').filter(Boolean).map(decode);
const used=new Set(), relaxed=[];
const order=(a,seed)=>{ const r=X.rngFor(seed); return a.map(p=>[r(),p]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]); };
const firstPiece=p=>{ const q=X.fromFEN(p.fen), m=X.fromUci(q,p.sol[0]); return m?q.b[X.mFrom(m)]&7:0; };
// pick n puzzles: themes (any of), rating window, optional moving piece; relax step by step if the bank is short
function pick(id,n,o){ const tries=[o,Object.assign({},o,{lo:o.lo-200,hi:o.hi+200}),Object.assign({},o,{piece:null,lo:o.lo-200,hi:o.hi+200}),Object.assign({},o,{themes:null,piece:null,lo:o.lo-400,hi:o.hi+400}),{lo:0,hi:9999}];
  const out=[];
  for(let k=0;k<tries.length&&out.length<n;k++){ const t=tries[k];
    const pool=order(BANK.filter(p=>!used.has(p.id)&&p.rating>=t.lo&&p.rating<=t.hi&&(!t.themes||t.themes.some(x=>p.themes.includes(x)))&&(!t.piece||firstPiece(p)===t.piece)&&(!t.maxLen||p.sol.length<=t.maxLen)),id+k);
    for(const p of pool){ if(out.length>=n) break; out.push(p); used.add(p.id); if(k) relaxed.push(id); } }
  return out.sort((a,b)=>a.rating-b.rating).map(p=>p.id); }
const learn=(id,a,b)=>[...pick(id+'a',2,{lo:400,hi:1000,piece:a,maxLen:3}),...pick(id+'b',2,{lo:400,hi:1000,piece:b,maxLen:3})];
// drills: endgame positions to win (or, for Philidor, to hold) against the computer
const D={
 kqk:{fen:'8/8/8/4k3/8/8/8/3QK3 w - - 0 1',pawnless:1}, krk:{fen:'8/8/3k4/8/8/8/8/R3K3 w - - 0 1',pawnless:1}, k2rk:{fen:'8/8/8/3k4/8/8/8/R3K2R w - - 0 1',pawnless:1},
 kpk:{fen:'4k3/8/4K3/4P3/8/8/8/8 w - - 0 1'}, krpkr:{fen:'2k5/8/4K3/4P3/8/8/8/R6r w - - 0 1'}, kqkp:{fen:'8/8/8/8/8/1K6/4pk2/7Q w - - 0 1'},
 kbnk:{fen:'8/8/8/4k3/8/8/8/2B1KN2 w - - 0 1',pawnless:1}, lucena:{fen:'1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1'}, philidor:{fen:'4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1'}};
// position games: a normal middlegame from the opening book, with the opponent a piece down
const POS={
 p11:'r1bqk2r/ppp2ppp/2np4/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R w KQkq - 0 6',
 k11:'r1bqkb1r/1p2pppp/p1np4/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7',
 q11:'r1bq1rk1/pp2bppp/2n1p3/2pp4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 8'};
const C=[{name:'Pawn',xp:6,bonus:75},{name:'Knight',xp:10,bonus:150},{name:'Queen',xp:15,bonus:225}];
const L=[];
const add=(camp,n,o)=>L.push(Object.assign({id:'pnq'[camp]+n,camp,n},o));
// ---- Pawn: how pieces move, mate in 1, simple endgames, strengths 1–3
add(0,1,{name:'Rook and Bishop',type:'set',puzzles:learn('p1',X.ROOK,X.BISHOP),tip:'Rooks move in straight lines; bishops move along diagonals. Find the strong move with each.'});
add(0,2,{name:'Queen and Knight',type:'set',puzzles:learn('p2',X.QUEEN,X.KNIGHT),tip:'The queen moves like a rook and a bishop together. The knight jumps in an L shape, over anything in the way.'});
add(0,3,{name:'Pawn and King',type:'set',puzzles:learn('p3',X.PAWN,X.KING),tip:'Pawns move straight ahead and capture diagonally. The king steps one square in any direction.'});
add(0,4,{name:'Queen Mate',type:'drill',d:'kqk',strength:6,tip:'King and queen against a lone king. Use the queen to shrink the king\'s box (a knight\'s move away), bring your king up, then mate on the edge. Careful: no stalemate!'});
add(0,5,{name:'First Mates',type:'set',puzzles:pick('p5',5,{lo:400,hi:1000,themes:['mateIn1']}),tip:'Each puzzle is a mate in one. Look at every check.'});
add(0,6,{name:'First Game',type:'game',strength:1,tip:'A full game against Pebble, the gentlest opponent. Develop your pieces, castle, and look for free captures.'});
add(0,7,{name:'Black to Play',type:'game',strength:2,twists:['black'],tip:'This time you play Black against Twig. White moves first: answer in the centre.'});
add(0,8,{name:'Rook Mate',type:'drill',d:'krk',strength:6,tip:'King and rook against a lone king. Cut the king off along a rank or file, walk your king up, and push it to the edge.'});
add(0,9,{name:'Free Pieces',type:'set',puzzles:pick('p9',5,{lo:800,hi:1200,themes:['hangingPiece','mateIn1']}),tip:'Something is undefended or a mate is waiting. Find it.'});
add(0,10,{name:'Back Rank',type:'tech',tech:'backrank',puzzles:pick('p10',5,{lo:600,hi:1400,themes:['backRankMate']}),tip:'Technique: the back-rank mate. A king shut in by its own pawns can be mated by a rook or queen on the last rank.'});
add(0,11,{name:'Up a Piece',type:'pos',fen:POS.p11,strength:2,tip:'You start a knight up in an Italian Game. Trade pieces, keep your king safe, and turn the extra piece into a win.'});
add(0,12,{name:'Two Rooks',type:'drill',d:'k2rk',strength:6,tip:'Two rooks mate on their own: one checks along a rank while the other guards the next one. Walk the king to the edge like a ladder.'});
add(0,13,{name:'Sharp Eyes',type:'set',puzzles:pick('p13',5,{lo:1000,hi:1300,themes:['mateIn1','mateIn2','fork','hangingPiece']}),tip:'A mix of everything so far.'});
add(0,14,{name:'No Help',type:'game',strength:3,twists:['noassist'],tip:'A game against Lantern with no takebacks and no hints. Check every move for loose pieces before you play it.'});
add(0,15,{name:'Pawn Finale',type:'game',strength:3,final:1,tip:'The Pawn campaign\'s finale: a full game against Lantern.'});
// ---- Knight: forks, pins and skewers, mate in 2, strengths 3–5
add(1,1,{name:'Opening Bell',type:'game',strength:3,tip:'A full game against Lantern. Control the centre and develop knights before bishops.'});
add(1,2,{name:'Forks',type:'set',puzzles:pick('k2',4,{lo:1000,hi:1400,themes:['fork']}),tip:'A fork attacks two things at once. Knights are the best at it.'});
add(1,3,{name:'Pins',type:'set',puzzles:pick('k3',4,{lo:1100,hi:1500,themes:['pin']}),tip:'A pinned piece can\'t move without exposing something more valuable behind it. Attack it again!'});
add(1,4,{name:'Opposition',type:'drill',d:'kpk',strength:6,tip:'King and pawn against king. Your king in front of the pawn wins: take the opposition, escort the pawn home, promote, then mate.'});
add(1,5,{name:'Mate in Two',type:'set',puzzles:pick('k5',5,{lo:1200,hi:1600,themes:['mateIn2']}),tip:'Mate in two: a forcing first move, then mate whatever the reply.'});
add(1,6,{name:'Midgame',type:'game',strength:4,tip:'A full game against Brook, who rarely blunders. Make a plan and improve your worst piece.'});
add(1,7,{name:'Against the Clock',type:'game',strength:4,twists:['clock'],tip:'A 5 + 3 game against Brook: five minutes each, three seconds added per move. Don\'t lose on time!'});
add(1,8,{name:'Rook Endgame',type:'drill',d:'krpkr',strength:6,tip:'Rook and pawn against rook. Use your king to shield the pawn from checks and push it home.'});
add(1,9,{name:'Skewers and Discoveries',type:'set',puzzles:pick('k9',5,{lo:1300,hi:1700,themes:['skewer','discoveredAttack']}),tip:'A skewer attacks through a piece to the one behind; a discovered attack moves one piece to unleash another.'});
add(1,10,{name:'The Fork',type:'tech',tech:'fork',puzzles:pick('k10',5,{lo:1300,hi:1700,themes:['fork']}),tip:'Technique: the fork. Find the square where one piece hits two targets.'});
add(1,11,{name:'Press the Advantage',type:'pos',fen:POS.k11,strength:4,tip:'A Sicilian where your opponent is a knight down. Open lines and use the extra piece.'});
add(1,12,{name:'Queen vs Pawn',type:'drill',d:'kqkp',strength:6,tip:'Queen against a pawn about to promote. Check from close by to force the king in front of its pawn, then bring your king one step closer each time.'});
add(1,13,{name:'Tactics Mix',type:'set',puzzles:pick('k13',5,{lo:1500,hi:1800,themes:['fork','pin','skewer','discoveredAttack','mateIn2']}),tip:'Forks, pins, skewers, discoveries and mates, all mixed.'});
add(1,14,{name:'Shuffled',type:'game',strength:5,twists:['c960'],tip:'Chess960 against Falcon: the back rank is shuffled, so no opening book. Think from move one.'});
add(1,15,{name:'Knight Finale',type:'game',strength:5,final:1,tip:'The Knight campaign\'s finale: a full game against Falcon.'});
// ---- Queen: mate in 3+, harder endgames, strengths 5–7, finale against strength 8
add(2,1,{name:'Strong Start',type:'game',strength:5,tip:'A full game against Falcon, who knows its openings.'});
add(2,2,{name:'Mate in Three',type:'set',puzzles:pick('q2',4,{lo:1600,hi:2000,themes:['mateIn3']}),tip:'Mate in three. Checks, captures and threats: calculate every forcing line.'});
add(2,3,{name:'Hidden Attacks',type:'set',puzzles:pick('q3',4,{lo:1700,hi:2000,themes:['discoveredAttack','deflection','attraction']}),tip:'Discoveries, deflections and decoys.'});
add(2,4,{name:'Bishop and Knight',type:'drill',d:'kbnk',strength:6,tip:'The hardest basic mate: bishop and knight. Drive the king to a corner of your bishop\'s colour and keep it there. You have fifty moves.'});
add(2,5,{name:'Hard Tactics',type:'set',puzzles:pick('q5',5,{lo:1800,hi:2100,themes:null}),tip:'Hard puzzles, any theme.'});
add(2,6,{name:'Steel',type:'game',strength:6,tip:'A full game against Tower, who calculates deep and never blunders.'});
add(2,7,{name:'Dark Side',type:'game',strength:6,twists:['black'],tip:'You play Black against Tower.'});
add(2,8,{name:'Lucena',type:'drill',d:'lucena',strength:6,tip:'The Lucena position: build a bridge. Bring your rook to the fourth rank so it can block the checks, then walk the king out.'});
add(2,9,{name:'Expert Tactics',type:'set',puzzles:pick('q9',5,{lo:2000,hi:2300,themes:null}),tip:'Expert puzzles.'});
add(2,10,{name:'Deflection',type:'tech',tech:'deflection',puzzles:pick('q10',5,{lo:1700,hi:2200,themes:['deflection']}),tip:'Technique: deflection. Force a defender away from the square or line it guards.'});
add(2,11,{name:'Convert',type:'pos',fen:POS.q11,strength:6,tip:'A Queen\'s Gambit where Tower is a knight down. Converting against a strong defender takes patience.'});
add(2,12,{name:'Philidor',type:'hold',d:'philidor',strength:7,hold:25,colour:X.BLACK,tip:'Defend! Rook against rook and pawn. Keep your rook on your third rank (the sixth) until the pawn steps onto it, then check from behind. Hold for 25 moves.'});
add(2,13,{name:'Master Tactics',type:'set',puzzles:pick('q13',5,{lo:2200,hi:2600,themes:null}),tip:'The hardest puzzles in the bank.'});
add(2,14,{name:'Unaided 960',type:'game',strength:7,twists:['c960','noassist'],tip:'Chess960 against Sage, with no takebacks and no hints.'});
add(2,15,{name:'Titan',type:'game',strength:8,final:1,tip:'The grand finale: a full game against Titan, as strong as our engine gets.'});
// ---- par: play each drill / position game with the engine and add slack
function playOut(fen,att,def,maxPly,seed){ const p=X.fromFEN(fen), me=p.side; let ply=0;
  for(;ply<maxPly;ply++){ const st=X.gameStatus(p); if(st.over) return {mated:st.reason==='checkmate'&&st.winner===me,ply,st}; X.ttClear();
    const lv=p.side===me?att:def, r=X.rngFor(fen+ply+'|'+(seed||0)), res=lv>=7?X.think(p,{time:500,hard:1000}):X.computerMove(p,lv,r); X.makeMove(p,res.move); }
  return {mated:false,ply}; }
const report={relaxed:[],par:{}};
for(const Lv of L){ if(Lv.d){ Lv.fen=D[Lv.d].fen; }
  if(Lv.type==='drill'||Lv.type==='pos'){ let par=OLD[Lv.id];
    if(!par&&Lv.type==='drill'){ const r=playOut(Lv.fen,8,Lv.strength,200), mv=Math.ceil(r.ply/2);
      if(!r.mated) console.log('WARNING: engine did not win',Lv.id,r.st&&r.st.reason);
      par=Math.ceil(mv*1.5)+4; if(D[Lv.d].pawnless) par=Math.min(48,par); report.par[Lv.id]={engineMoves:mv,par}; console.log(Lv.id,Lv.name,'engine',mv,'moves → par',par); }
    if(Lv.type==='pos'&&(!par||process.argv.includes('--pos'))){ // the defender's choices vary: three games, the median win, generous slack (at least 30)
      const wins=[]; for(let k=0;k<3;k++){ const r=playOut(Lv.fen,8,Lv.strength,300,k); if(r.mated) wins.push(Math.ceil(r.ply/2)); }
      wins.sort((a,b)=>a-b); const mv=wins.length?wins[wins.length>>1]:60; if(!wins.length) console.log('WARNING: engine did not win',Lv.id);
      par=Math.max(30,Math.ceil(mv*1.5)+6); report.par[Lv.id]={engineWins:wins,par}; console.log(Lv.id,Lv.name,'engine wins',wins,'→ par',par); }
    Lv.par=par; } }
report.relaxed=[...new Set(relaxed)];
const js=`// Generated by tools/build_levels.js. Do not edit by hand.\n// The 45 campaign levels. Puzzle ids are Lichess puzzle ids from src/puzzles.js; FENs are the start positions.\n`+
 `const CAMPS=${JSON.stringify(C)};\nconst LEVELS=[\n${L.map(o=>{ const c=Object.assign({},o); delete c.d; return ' '+JSON.stringify(c); }).join(',\n')}];\n`;
fs.writeFileSync(OUT,js);
fs.writeFileSync(path.join(__dirname,'levels_report.json'),JSON.stringify(report,null,1));
console.log('levels',L.length,'relaxed picks',report.relaxed.length?report.relaxed.join(','):'none');
