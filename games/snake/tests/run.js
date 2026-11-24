// node tests/run.js   (Node only, no dependencies; QUICK=1 for short sims)
const fs=require('fs'), path=require('path');
let pass=0, fail=0; const t0=Date.now();
global.QUICK=!!process.env.QUICK;
global.test=(name,fn)=>{ try{ fn(); pass++; } catch(e){ fail++; console.log('✗ '+name+'\n   '+(e&&e.stack||e).split('\n').slice(0,3).join('\n   ')); } };
global.ok=(c,m)=>{ if(!c) throw new Error(m||'expected true'); };
global.eq=(a,b,m)=>{ const A=JSON.stringify(a), B=JSON.stringify(b); if(A!==B) throw new Error((m?m+': ':'')+'got '+A+', want '+B); };
const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')).sort();
for(const f of files){ const n0=pass+fail; require(path.join(__dirname,f)); console.log(`${f.padEnd(18)} ${pass+fail-n0} checks`); }
console.log(`\n${pass} passed, ${fail} failed in ${((Date.now()-t0)/1000).toFixed(1)} s`);
process.exit(fail?1:0);
