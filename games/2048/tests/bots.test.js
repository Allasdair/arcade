// Bot sims behind the star thresholds (core.js STARS). Two bots play the real rules (sim() is checked against move()):
//  - corner: always left, then down, then right, up only when forced — a casual player.
//  - expectimax: depth 2 (our move, a sampled spawn, our next move) with a corner/monotonic heuristic — a strong player.
// The thresholds aim for: ★ = what the corner bot reaches in a small share of games; ★★★ = what the strong bot reaches most of the time.
// QUICK=1 runs short sims. For long runs per board use: node tests/sim.js <boards> <corner|expectimax> <games>
const {E,C,ok,section,QUICK}=require('./lib');
function run(board,kind,n){ const st=[0,0,0,0]; for(let i=0;i<n;i++){ const r=E.sim(board,`${kind}-${board}-${i}`,kind); st[C.starsFor(board,r.max)]++; }
  return st.map(x=>x/n); }
const pct=a=>a.map(x=>(x*100).toFixed(0)+'%').join(' / ');
section(`corner bot (${QUICK?100:1000} games per board): ★ is not free, ★★★ needs real play`,()=>{
  for(const b of E.BOARDS){ const p=run(b,'corner',QUICK?100:1000), atLeast1=1-p[0], three=p[3];
    console.log(`    ${b.padEnd(8)} stars 0/1/2/3: ${pct(p)}`);
    ok(atLeast1<=.6,`${b}: corner bot earns ★ in ${(atLeast1*100).toFixed(0)}% (want ≤ 60%)`);
    ok(three<=.05,`${b}: corner bot earns ★★★ in ${(three*100).toFixed(0)}% (want ≤ 5%)`); }
});
section('expectimax bot: ★ almost always, ★★★ reachable with strong play',()=>{
  const N={'3':QUICK?60:1000,'4':QUICK?12:300,cross:QUICK?4:100,swiss:QUICK?3:100,diamond:QUICK?3:100,ring:QUICK?2:60};
  for(const b in N){ const p=run(b,'expectimax',N[b]), atLeast1=1-p[0], three=p[3];
    console.log(`    ${b.padEnd(8)} n=${N[b]} stars 0/1/2/3: ${pct(p)}`);
    ok(atLeast1>=.9||N[b]<10,`${b}: strong bot earns ★ in ${(atLeast1*100).toFixed(0)}% (want ≥ 90%)`);
    ok(three>=.3||N[b]<10,`${b}: strong bot earns ★★★ in ${(three*100).toFixed(0)}% (want ≥ 30%)`); }
});
