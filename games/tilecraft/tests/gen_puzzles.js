// Rebuilds the three best-move puzzles in src/levels.js and checks them.
//   node tests/gen_puzzles.js          search seeded positions, write PUZZLES into src/levels.js
// A puzzle is a seeded Hard-vs-Hard game stopped part-way, plus the rack of the player to move (no blanks).
// It must have one best move (8+ points clear of the next score) worth the level's range.
const fs=require('fs'), path=require('path'); const {load}=require('./lib.js'); const L=load(['dict.js','engine.js']);
const SPECS=[{size:'medium',after:[4,8],lo:30,hi:50,maxTiles:7,gap:8,name:'Apprentice'},
             {size:'medium',after:[8,14],lo:45,hi:75,maxTiles:7,gap:8,name:'Journeyman'},
             {size:'medium',after:[12,20],lo:55,hi:95,maxTiles:4,gap:10,notLongest:true,name:'Master'}];
const out=[];
for(const [k,sp] of SPECS.entries()){ let found=null;
  for(let seed=1;seed<4000&&!found;seed++){ const bs=L.h32('TCP1|'+k+'|b|'+seed), gs=L.h32('TCP1|'+k+'|g|'+seed);
    const st=L.newGame({size:sp.size,boardSeed:bs,bagSeed:gs,players:[{name:'A',ai:'hard'},{name:'B',ai:'hard'}]});
    const stop=sp.after[0]+(seed%(sp.after[1]-sp.after[0]+1)); while(!st.over&&st.moves.length<stop) L.aiTurn(st,'hard'); if(st.over) continue;
    const rack=st.racks[st.turn]; if(rack.includes('?')||rack.length<7) continue;
    const ms=L.sortMoves(L.allMoves(st,rack)); if(ms.length<20) continue; const best=ms[0], second=ms.find(m=>m.sc<best.sc);
    if(ms.filter(m=>m.sc===best.sc).length>1||!second||best.sc-second.sc<sp.gap||best.sc<sp.lo||best.sc>sp.hi||best.n>sp.maxTiles) continue;
    if(sp.notLongest&&ms.some(m=>m.len>best.len&&m.sc>=best.sc*.5)===false) continue;
    const cells=[]; st.cells.forEach((c,i)=>{ if(c) cells.push([i,c]); });
    found={size:sp.size,shape:'square',boardSeed:bs,cells,rack:rack.join(''),best:best.sc,answer:best.w,moves:ms.length,seed}; }
  if(!found) throw new Error('no puzzle for '+sp.name); out.push(found);
  console.log(`${sp.name}: seed ${found.seed}, ${found.cells.length} tiles on the board, rack ${found.rack}, best ${found.answer} for ${found.best} (${found.moves} legal moves)`); }
// write into levels.js
const f=path.join(__dirname,'..','src','levels.js'); let s=fs.readFileSync(f,'utf8');
const body=out.map(z=>`{size:'${z.size}',shape:'${z.shape}',boardSeed:${z.boardSeed},rack:'${z.rack}',best:${z.best},answer:'${z.answer}',\n  cells:${JSON.stringify(z.cells)}}`).join(',\n ');
s=s.replace(/const PUZZLES=\[[\s\S]*?\];\nconst levelById/,`const PUZZLES=[\n ${body}];\nconst levelById`); fs.writeFileSync(f,s); console.log('wrote src/levels.js');
