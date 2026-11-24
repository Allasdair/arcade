const {E,ok,section,withBoard}=require('./lib');
section('board sizes match the kickoff',()=>{
  const want={'3':9,'4':16,'5':25,'6':36,cross:20,ring:32,diamond:25};
  for(const b in want){ const m=E.makeMask(b,'x'); ok(m.mask.reduce((a,c)=>a+c,0)===want[b],`${b} has ${want[b]} cells`); }
  const ring=E.makeMask('ring','x'); ok([14,15,20,21].every(i=>!ring.mask[i]),'ring: centre 2×2 removed');
  const cr=E.makeMask('cross','x'); ok([0,1,6,7,4,5,10,11,24,25,30,31,28,29,34,35].every(i=>!cr.mask[i]),'cross: four corner 2×2 blocks removed');
});
section('Swiss Cheese: 2–3 seeded holes, never a single-cell segment, same holes for the same seed',()=>{
  let n2=0,n3=0;
  for(let s=0;s<2000;s++){ const m=E.makeMask('swiss','s'+s), holes=25-m.mask.reduce((a,c)=>a+c,0);
    ok(holes===2||holes===3,`seed ${s}: ${holes} holes`); holes===2?n2++:n3++;
    ok(E.segmentsOk(5,5,m.mask),`seed ${s}: no single-cell segment`); }
  ok(n2>300&&n3>300,`both hole counts happen (${n2}/${n3})`);
  ok(JSON.stringify(E.makeMask('swiss','abc').mask)===JSON.stringify(E.makeMask('swiss','abc').mask),'deterministic');
  const G=E.newGame({board:'swiss',seed:'keep'}), R=JSON.parse(JSON.stringify(G)); ok(JSON.stringify(R.mask)===JSON.stringify(G.mask),'mask saved with the game');
});
section('walls split segments; each segment slides and merges on its own',()=>{
  // Ring row 2: cells 12,13 | wall 14,15 | 16,17
  const v=new Array(36).fill(0); v[13]=2; v[16]=2; v[17]=2; const G=withBoard('ring',v); const r=E.move(G,3);
  ok(r.G.b[12]===2,'left piece: 2 slides to the wall-side edge'); ok(r.G.b[16]===4&&!r.G.b[17]||(r.spawn&&r.spawn.at===17),'right piece: 2,2 merge to 4 against the wall');
  ok(!r.G.b[14]&&!r.G.b[15],'nothing enters a wall');
  const v2=new Array(36).fill(0); v2[13]=4; v2[16]=4; const G2=withBoard('ring',v2), r2=E.move(G2,3);
  ok(r2.G.b[12]===4&&r2.G.b[16]===4,'equal tiles across a wall do not merge');
});
section('spawns never land on walls (all shaped boards, 300 games each)',()=>{
  for(const b of E.SHAPED){ let bad=0; for(let g=0;g<300;g++){ let G=E.newGame({board:b,seed:b+g});
      for(const s of G.start) if(!G.mask[s.at]) bad++;
      for(let i=0;i<300&&!G.over;i++){ const r=E.move(G,(i*3+g)%4); if(!r.moved) continue; if(r.spawn&&!G.mask[r.spawn.at]) bad++; for(let k=0;k<r.G.b.length;k++) if(!r.G.mask[k]&&r.G.b[k]) bad++; G=r.G; } }
    ok(bad===0,`${b}: ${bad} tiles on walls`); }
});
section('game over respects segments: equal tiles across a wall are not a move',()=>{
  // Diamond: fill every playable cell in a pattern with no equal neighbours inside a segment
  const m=E.makeMask('diamond','x'), v=m.mask.map((on,i)=>on?(((i%7)+Math.floor(i/7))%2?2:4):0);
  const G=withBoard('diamond',v); ok(!E.canMove(G),'diamond checkerboard is over');
  const r=E.makeMask('ring','x'), v2=r.mask.map((on,i)=>on?(((i%6)+Math.floor(i/6))%2?2:4):0);
  v2[13]=8; v2[16]=8; const G2=withBoard('ring',v2); ok(!E.canMove(G2),'ring: 8 | wall | 8 cannot merge, game over');
});
