// Long bot sims per board: node tests/sim.js 4,ring expectimax 300   (prints how often each highest tile is reached)
const E=require('../src/engine.js');
const boards=process.argv[2].split(','), kind=process.argv[3], N=+process.argv[4];
for(const b of boards){ const t=Date.now(), h={}; let sc=0;
  for(let i=0;i<N;i++){ const r=E.sim(b,kind+b+i,kind); h[r.max]=(h[r.max]||0)+1; sc+=r.score; }
  const keys=Object.keys(h).map(Number).sort((a,b)=>a-b); let cum=N; const reach=keys.map(k=>{ const s=`${k}:${(cum/N*100).toFixed(1)}%`; cum-=h[k]; return s; });
  console.log(`${b} ${kind} n=${N} ${((Date.now()-t)/N).toFixed(1)}ms/game avgScore=${(sc/N)|0} reach ${reach.join(' ')}`); }
