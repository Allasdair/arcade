const {load}=require('../tests/lib.js'); const X=load(['layouts.js','engine.js','solver.js']);
let to=0, n=0, mx=0, t0=Date.now(), nodes=[];
for(const L of X.LAYOUTS) for(let s=0;s<10;s++){ const g=X.generate(L,L.diff,'f'+s,s/9); const r=X.solve(L,g.faces,new Array(L.n).fill(0),{limit:100000}); n++; if(!r.win) to++; nodes.push(r.nodes); }
nodes.sort((a,b)=>a-b); console.log({n,notWon:to,median:nodes[n>>1],p95:nodes[Math.floor(n*.95)],max:nodes[n-1],ms:Date.now()-t0});
