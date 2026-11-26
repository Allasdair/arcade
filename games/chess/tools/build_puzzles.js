// Lichess puzzle CSV → src/puzzles.js
//   node tools/build_puzzles.js [path to lichess_db_puzzle.csv or .csv.zst] [classic count] [daily count]
// The Lichess puzzle database (database.lichess.org, CC0): PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,
// NbPlays,Themes,GameUrl,OpeningTags. FEN is the position before the opponent's move; Moves starts with that move.
// Quality filters: popularity ≥ 85, played ≥ 500 times, rating deviation ≤ 90. Then a seeded sample spread across
// ratings 600–2600 and the themes the game offers, plus a separate reserved part for the Daily (never used by Classic
// Puzzles), by weekday band. Every kept puzzle is replayed by our engine: all moves legal, mates confirmed as mate,
// other lines confirmed to end clearly better for the solver.
const fs=require('fs'), path=require('path'), zlib=require('zlib'), readline=require('readline');
const {load}=require('../tests/lib.js'); const X=load(['engine.js','search.js']);
const SRC=process.argv[2]||path.join(__dirname,'..','data','lichess_db_puzzle.csv.zst');
const NC=+(process.argv[3]||4000), ND=+(process.argv[4]||2016);
const THEMES=['mateIn1','mateIn2','mateIn3','mateIn4','mateIn5','fork','pin','skewer','discoveredAttack','backRankMate','promotion','endgame','deflection','attraction','smotheredMate','hangingPiece','sacrifice','mate','middlegame','opening','short','long','crushing','advantage','interference','clearance','xRayAttack','zugzwang','doubleCheck','quietMove'];
const WANT=['mateIn1','mateIn2','mateIn3','fork','pin','skewer','discoveredAttack','backRankMate','promotion','endgame','deflection'];
const DAILY_BANDS=[[2100,2400],[800,1100],[1100,1300],[1300,1500],[1500,1700],[1700,1900],[1900,2100]];
const r=X.rngFor('chess-puzzle-bank-v1');
const shuffle=a=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

function verify(fen,moves,themes){ let p; try{ p=X.fromFEN(fen); }catch(e){ return null; }
  const seq=moves.split(' '), out=[];
  for(let i=0;i<seq.length;i++){ const m=X.fromUci(p,seq[i]); if(!m) return null; if(i===1) out.fen=X.toFEN(p); if(i>=1) out.push(seq[i]); if(i===0) out.setup=seq[0]; X.makeMove(p,m); if(i===0) out.after=X.toFEN(p); }
  const solver=X.fromFEN(out.after).side, st=X.gameStatus(p);
  const isMate=themes.some(t=>/^mate/.test(t)||t==='backRankMate'||t==='smotheredMate');
  if(isMate&&!(st.over&&st.reason==='checkmate')) return null;
  if(!isMate){ if(st.over) return null; X.ttClear(); const res=X.think(p,{depth:4,hard:3000}); const sc=p.side===solver?res.score:-res.score; if(sc<150) return null; }
  return {after:out.after,setup:out.setup,sol:out}; }
// compact entry: id~placement~side castling ep~setup~solution (UCI, promotions in capitals)~rating (base 36)~themes (bits, base 36)
function entry(id,v,rating,themes){ const f=v.after.split(' '), sc=f[1]+(f[2]==='-'?'':f[2])+(f[3]==='-'?'':f[3]);
  let bits=0; themes.forEach(t=>{ const i=THEMES.indexOf(t); if(i>=0) bits+=2**i; });
  const mv=u=>u.slice(0,4)+(u[4]?u[4].toUpperCase():'');
  return `${id}~${f[0]}~${sc}~${mv(v.setup)}~${v.sol.map(mv).join('')}~${rating.toString(36)}~${bits.toString(36)}`; }

async function main(){ if(!fs.existsSync(SRC)){ console.error('missing '+SRC); process.exit(1); }
  let stream=fs.createReadStream(SRC); if(/\.zst$/.test(SRC)) stream=stream.pipe(zlib.createZstdDecompress());
  const rl=readline.createInterface({input:stream,crlfDelay:Infinity}); const cand=[]; let n=0, kept=0;
  for await(const line of rl){ if(!n++){ if(line.startsWith('PuzzleId')) continue; }
    const c=line.split(','); if(c.length<8) continue; const rating=+c[3], rd=+c[4], pop=+c[5], plays=+c[6];
    if(pop<85||plays<500||rd>90||rating<600||rating>2600) continue; const themes=c[7].split(' ');
    if(themes.includes('mateIn5')||themes.includes('veryLong')) continue;
    cand.push({id:c[0],fen:c[1],moves:c[2],rating,themes:themes.filter(t=>THEMES.includes(t)),opening:themes.includes('opening')}); kept++; }
  console.log(`read ${n} rows, ${kept} pass the quality filters`);
  shuffle(cand);
  const used=new Set(), daily=[[],[],[],[],[],[],[]], classic=[], per=Math.ceil(ND/7);
  const take=(p,arr)=>{ const v=verify(p.fen,p.moves,p.themes); if(!v) return false; used.add(p.id); arr.push(entry(p.id,v,p.rating,p.themes)); arr.meta=arr.meta||[]; arr.meta.push(p); return true; };
  // the Daily part first: per weekday band
  for(let w=0;w<7;w++){ const [lo,hi]=DAILY_BANDS[w]; for(const p of cand){ if(daily[w].length>=per) break; if(used.has(p.id)||p.rating<lo||p.rating>=hi) continue; take(p,daily[w]); } }
  // Classic: every wanted theme gets a healthy pool, then fill across 100-point rating bins
  for(const t of WANT){ let k=0; for(const p of cand){ if(k>=Math.round(NC*0.045)) break; if(used.has(p.id)||!p.themes.includes(t)) continue; if(take(p,classic)) k++; } }
  const bins={}; for(const p of classic.meta) bins[Math.floor(p.rating/100)]=(bins[Math.floor(p.rating/100)]||0)+1;
  const target=Math.ceil(NC/20);
  for(const p of cand){ if(classic.length>=NC) break; if(used.has(p.id)) continue; const b=Math.floor(p.rating/100); if((bins[b]||0)>=target) continue; if(take(p,classic)) bins[b]=(bins[b]||0)+1; }
  for(const p of cand){ if(classic.length>=NC) break; if(used.has(p.id)) continue; take(p,classic); }
  const js=`// Generated by tools/build_puzzles.js from the Lichess puzzle database (database.lichess.org, CC0). Do not edit.\n`+
    `// ${classic.length} Classic puzzles and ${daily.reduce((a,d)=>a+d.length,0)} reserved Daily puzzles (index = weekday, Sunday first).\n`+
    `const PUZ_THEMES=${JSON.stringify(THEMES)};\nconst PUZ_C='${classic.join(',')}';\nconst PUZ_D=[${daily.map(d=>`'${d.join(',')}'`).join(',\n')}];\n`;
  fs.writeFileSync(path.join(__dirname,'..','src','puzzles.js'),js);
  const bandC=[[0,999],[1000,1399],[1400,1799],[1800,2199],[2200,9999]].map(([a,b])=>classic.meta.filter(p=>p.rating>=a&&p.rating<=b).length);
  const themeC=Object.fromEntries(WANT.map(t=>[t,classic.meta.filter(p=>p.themes.includes(t)).length]));
  console.log(JSON.stringify({classic:classic.length,daily:daily.map(d=>d.length),bytes:js.length,bands:bandC,themes:themeC}));
  fs.writeFileSync(path.join(__dirname,'..','tools','puzzles_report.json'),JSON.stringify({classic:classic.length,daily:daily.map(d=>d.length),kb:Math.round(js.length/1024),bands:bandC,themes:themeC,read:n,passed:kept},null,1)); }
main();
