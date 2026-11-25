const {load}=require('../tests/lib.js'); const X=load(['layouts.js','engine.js','solver.js']);
const t0=Date.now(); const out={};
for(const L of X.LAYOUTS){ const diff=L.diff; const res=[];
  for(const trap of [0,.5,1]){ let fails=0, rates=[], at=0;
    for(let s=0;s<8;s++){ const g=X.generate(L,diff,'p'+s,trap); if(!g){ fails++; continue; } at+=g.attempt; rates.push(X.gradeBoard(L,g.faces,'p'+s).rate); }
    res.push(`t${trap}: ${(rates.reduce((a,b)=>a+b,0)/rates.length).toFixed(2)} [${Math.min(...rates).toFixed(2)}-${Math.max(...rates).toFixed(2)}] att${(at/8).toFixed(1)}${fails?' FAIL'+fails:''}`); }
  console.log(L.id.padEnd(14),diff.padEnd(7),res.join(' | ')); }
console.log('ms',Date.now()-t0);
