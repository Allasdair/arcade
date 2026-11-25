const {load}=require('../tests/lib.js'); const X=load(['layouts.js','engine.js','solver.js']);
// realistic play: the blind bot's choices; solve after every move with the last line as the guide
let cnt=0,to=0,maxn=0,tot=0,deadFound=0,full=0,fullFail=0; const t0=Date.now();
for(const L of X.LAYOUTS) for(let s=0;s<6;s++){ const g=X.generate(L,L.diff,'b'+s,s/5); let ref=g.order; const gone=new Array(L.n).fill(0); const rng=X.seedRng('bb'+s);
  const r0=X.solve(L,g.faces,gone,{limit:60000,ref}); full++; if(!r0.win) fullFail++;
  for(let k=0;k<L.n/2-1;k++){ const pr=X.freePairs(L,gone,g.faces); if(!pr.length) break; const p=pr[Math.floor(rng()*pr.length)];
    gone[p[0]]=gone[p[1]]=1; const r=X.solve(L,g.faces,gone,{limit:60000,ref}); cnt++; tot+=r.nodes; if(r.timeout) to++; maxn=Math.max(maxn,r.nodes);
    if(r.win) ref=r.line; else if(!r.timeout){ deadFound++; break; } else break; } }
console.log({full,fullFail,cnt,timeouts:to,deadFound,avgNodes:(tot/cnt).toFixed(0),maxn,ms:Date.now()-t0});
