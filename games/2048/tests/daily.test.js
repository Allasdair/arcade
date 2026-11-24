const {E,ok,section}=require('./lib');
const addDays=(d,n)=>{ const [y,m,dd]=d.split('-').map(Number); return E.dateStr(new Date(y,m-1,dd+n).getTime()); };
section('Daily Board: same date → same start and same spawns for the same moves (120 days, two runs)',()=>{
  const seen=new Set(); let d='2026-11-01';
  for(let i=0;i<120;i++,d=addDays(d,1)){ const a=E.dailyPrint(d), b=E.dailyPrint(d); ok(a===b,`${d} stable`); seen.add(a);
    const G=E.newDaily(d); ok(G.board===E.DAILY_BOARD&&G.daily===d,'4×4 classic, tagged with its date'); }
  ok(seen.size===120,`120 different boards (${seen.size})`);
});
section('Daily Board fingerprints are pinned',()=>{
  // If these change, every player's Daily Board changed: only do that on purpose (bump the seed version T2048D1).
  ok(E.dailyPrint('2026-11-23')==='ae5e2bb0',`2026-11-23 → ${E.dailyPrint('2026-11-23')}`);
  ok(E.dailyPrint('2027-01-01')==='ed095267',`2027-01-01 → ${E.dailyPrint('2027-01-01')}`);
});
section('Daily Board: undo is off; the spawn sequence does not depend on the device seed',()=>{
  let G=E.newDaily('2026-11-23'); const r=E.move(G,3).moved?E.move(G,3):E.move(G,1); ok(r.moved,'a move');
  const r2=E.move(G,r.dir,{noUndo:true}); ok(!r2.G.prev,'no undo snapshot kept'); ok(E.undo(r.G)===null,'undo refused on the Daily Board');
  const A=E.newDaily('2026-11-23'), B=E.newDaily('2026-11-23'); ok(JSON.stringify(A.b)===JSON.stringify(B.b)&&JSON.stringify(A.rs)===JSON.stringify(B.rs),'identical start state');
});
