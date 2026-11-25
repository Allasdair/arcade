const {load}=require('../tests/lib.js'); const X=load(['layouts.js','engine.js','solver.js']);
let worst=0, tot=0, cnt=0, timeouts=0, wins=0, losses=0, maxN=0;
for(const L of X.LAYOUTS){ for(let s=0;s<6;s++){ const g=X.generate(L,L.diff,'q'+s,s/5);
  // full board
  let t=Date.now(); let r=X.solve(L,g.faces,new Array(L.n).fill(0),{limit:60000}); let dt=Date.now()-t; worst=Math.max(worst,dt); tot+=dt; cnt++; if(r.timeout) timeouts++; if(r.win) wins++; maxN=Math.max(maxN,r.nodes);
  // random play positions
  const rng=X.seedRng('rp'+s); const gone=new Array(L.n).fill(0);
  for(let k=0;k<40;k++){ const pr=X.freePairs(L,gone,g.faces); if(!pr.length) break; const p=pr[Math.floor(rng()*pr.length)]; gone[p[0]]=gone[p[1]]=1;
    if(k%5===4){ t=Date.now(); r=X.solve(L,g.faces,gone,{limit:60000}); dt=Date.now()-t; worst=Math.max(worst,dt); tot+=dt; cnt++; if(r.timeout) timeouts++; else if(r.win) wins++; else losses++; maxN=Math.max(maxN,r.nodes); } } } }
console.log({cnt,avgms:(tot/cnt).toFixed(1),worst,timeouts,wins,losses,maxN});
