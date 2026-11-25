const {load}=require('../tests/lib.js'); const X=load(['layouts.js','engine.js','solver.js']);
for(const L of X.LAYOUTS) for(let s=0;s<10;s++){ const g=X.generate(L,L.diff,'f'+s,s/9); const r=X.solve(L,g.faces,new Array(L.n).fill(0),{limit:100000});
  if(!r.win){ const r2=X.solve(L,g.faces,new Array(L.n).fill(0),{limit:1000000}); console.log(L.id,s,'trap',(s/9).toFixed(2),'1M:',r2.win,r2.nodes); } }
// realistic positions: blind-bot play, check winnable positions along the way
let cnt=0,to=0,maxn=0; for(const L of X.LAYOUTS) for(let s=0;s<4;s++){ const g=X.generate(L,L.diff,'b'+s,.5); const rng=X.seedRng('bb'+s); const gone=new Array(L.n).fill(0);
  for(let k=0;k<L.n/2-2;k++){ const pr=X.freePairs(L,gone,g.faces); if(!pr.length) break; const p=pr[Math.floor(rng()*pr.length)];
    gone[p[0]]=gone[p[1]]=1; if(k%4===0){ const r=X.solve(L,g.faces,gone,{limit:60000}); cnt++; if(r.timeout) to++; maxn=Math.max(maxn,r.nodes); if(!r.win&&!r.timeout) break; } } }
console.log({cnt,to,maxn});
