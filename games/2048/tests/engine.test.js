const {E,ok,section,withBoard}=require('./lib');
// Puts a line of 4 values into row 0 (or column 0), oriented so that "toward" is the side the tiles move to.
function lineCase(dir,vals){ const b=new Array(16).fill(0), at=k=>dir===3?k:dir===1?3-k:dir===0?k*4:(3-k)*4; vals.forEach((v,k)=>b[at(k)]=v);
  const G=withBoard('4',b), r=E.move(G,dir); return {r,out:[0,1,2,3].map(k=>r.G.b[at(k)]),spawnAt:r.spawn&&r.spawn.at,at}; }

section('merging: the four kickoff examples in all four directions',()=>{
  const cases=[[[2,2,2,2],[4,4,0,0],8],[[2,2,2,0],[4,2,0,0],4],[[4,4,8,0],[8,8,0,0],8],[[2,0,2,4],[4,4,0,0],4]];
  for(const dir of [0,1,2,3]) for(const [inp,exp,gain] of cases){ const {r,out,spawnAt,at}=lineCase(dir,inp);
    // the spawn may land in the line's freed cells; ignore it there
    const got=out.map((v,k)=>at(k)===spawnAt?(exp[k]===0?0:v):v);
    ok(JSON.stringify(got)===JSON.stringify(exp),`dir ${dir} ${inp} → ${got}, want ${exp}`);
    ok(r.gained===gain,`dir ${dir} ${inp} score +${r.gained}, want +${gain}`); }
});
section('each tile merges once per move; merge records point at real tiles',()=>{
  const G=withBoard('4',[4,4,8,0, 2,2,4,8, 0,0,0,0, 0,0,0,0]); const r=E.move(G,3);
  ok(r.G.b[0]===8&&r.G.b[1]===8,'4,4,8 → 8,8 not 16'); ok(r.G.b[4]===4&&r.G.b[5]===4&&r.G.b[6]===8,'2,2,4,8 → 4,4,8');
  for(const m of r.merges){ ok(G.ids.includes(m.a)&&G.ids.includes(m.b)&&m.a!==m.b,'merge sources are two distinct old tiles'); ok(r.G.ids[m.at]===m.id,'merged tile id is on the board'); }
  const seen=new Set(); for(const s of r.slides){ ok(!seen.has(s.id),'a tile slides at most once'); seen.add(s.id); }
});
section('a move that changes nothing: no spawn, no move count, same state',()=>{
  const G=withBoard('4',[2,4,0,0, 8,0,0,0, 0,0,0,0, 0,0,0,0]); const r=E.move(G,3);
  ok(!r.moved&&r.G===G,'left does nothing'); ok(G.moves===0,'no move counted');
  const r2=E.move(G,0); ok(!r2.moved,'up does nothing either');
  const r3=E.move(G,1); ok(r3.moved&&r3.G.moves===1&&!!r3.spawn,'right moves, counts and spawns');
});
section('score: each merge adds the new tile value',()=>{
  let G=E.newGame({board:'4',seed:'score'}), sum=0;
  for(let i=0;i<300&&!G.over;i++){ const r=E.move(G,[3,2,1,2][i%4]); if(!r.moved) continue; sum+=r.merges.reduce((a,m)=>a+m.v,0); G=r.G; }
  ok(G.score===sum,`score ${G.score} = sum of merges ${sum}`);
});
section('spawns: only on empty playable cells; 2s and 4s at about 90/10 over 100,000 spawns',()=>{
  let twos=0, fours=0, bad=0;
  for(let g=0;twos+fours<100000;g++){ const board=E.BOARDS[g%E.BOARDS.length]; let G=E.newGame({board,seed:'sp'+g});
    for(const s of G.start){ if(!G.mask[s.at]) bad++; s.v===2?twos++:fours++; }
    for(let i=0;i<400&&!G.over;i++){ const before=G.b.slice(); const r=E.move(G,(i*7+g)%4); if(!r.moved) continue;
      const s=r.spawn; if(s){ if(!G.mask[s.at]) bad++; const cleared=r.slides.some(x=>x.from===s.at)||!before[s.at]; if(!cleared) bad++; s.v===2?twos++:fours++; } G=r.G; } }
  const p=fours/(twos+fours); ok(bad===0,`${bad} bad spawns`); ok(p>.095&&p<.105,`4s ${(p*100).toFixed(2)}%`);
});
section('start: two spawned tiles on every board',()=>{
  for(const b of E.BOARDS){ const G=E.newGame({board:b,seed:'st'}); ok(G.b.filter(x=>x).length===2,`${b} has two start tiles`); }
});
section('win: making 2048 is flagged once; the game carries on',()=>{
  const G=withBoard('4',[1024,1024,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]); const r=E.move(G,3);
  ok(r.newWin&&r.G.won&&r.G.max===2048,'2048 made → newWin'); const G2=withBoard('4',[2048,2,2,0]); G2.won=true;
  const r2=E.move(G2,3); ok(r2.moved&&!r2.newWin,'no second win flag');
});
section('game over: no empty cells and no equal neighbours',()=>{
  const full=[2,4,2,4, 4,2,4,2, 2,4,2,4, 4,2,4,2]; const G=withBoard('4',full); ok(!E.canMove(G)&&G.over,'checkerboard is over');
  const G2=withBoard('4',[2,4,2,4, 4,2,4,2, 2,4,2,4, 4,2,4,4]); ok(E.canMove(G2),'one equal pair can still move');
});
section('undo: restores board, score and RNG; repeating the move gives the same spawn',()=>{
  let G=E.newGame({board:'4',seed:'undo'}); for(let i=0;i<20;i++){ const r=E.move(G,[3,2][i%2]); if(r.moved) G=r.G; }
  const before=E.clone(G), r1=E.move(G,1); ok(r1.moved,'move made'); const U=E.undo(r1.G);
  ok(JSON.stringify(U.b)===JSON.stringify(before.b)&&U.score===before.score&&U.moves===before.moves,'board/score/moves restored');
  ok(JSON.stringify(U.rs)===JSON.stringify(before.rs),'RNG restored'); ok(U.undos===1&&!U.prev,'undo counted, no chain');
  ok(E.undo(U)===null,'only one step back'); const r2=E.move(U,1);
  ok(r2.spawn.at===r1.spawn.at&&r2.spawn.v===r1.spawn.v,'same spawn after undo');
  ok(E.undo(Object.assign(E.clone(r1.G),{daily:'2026-11-23'}))===null,'no undo on a Daily Board');
});
section('state is plain JSON: a game restores exactly after a reload',()=>{
  let G=E.newGame({board:'ring',seed:'json'}); for(let i=0;i<50;i++){ const r=E.move(G,i%4); if(r.moved) G=r.G; }
  const R=JSON.parse(JSON.stringify(G)); const a=E.move(G,2), b=E.move(R,2);
  ok(JSON.stringify(a.G)===JSON.stringify(b.G),'same next state from a reloaded copy');
});
section('sim() matches move() exactly (bots play the real rules)',()=>{
  for(const board of E.BOARDS){ let G=E.newGame({board,seed:'eq'+board}); const L=E.linesFor(G.W,G.H,G.mask);
    for(let i=0;i<200&&!G.over;i++){ const d=[3,2,1,0][i%4]; const f=E.slideFast(G.b,L[d]), r=E.move(G,d);
      ok(f.moved===r.moved,`${board} moved agrees`); if(!r.moved) continue;
      const nb=r.G.b.slice(); if(r.spawn) nb[r.spawn.at]=0; ok(JSON.stringify(nb)===JSON.stringify(f.nb)&&f.gain===r.gained,`${board} slide agrees`); G=r.G; } }
});
