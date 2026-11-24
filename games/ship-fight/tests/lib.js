// Tiny test helper: no dependencies, so `node tests/run.js` works anywhere Node 18+ is installed.
const E=require('../src/engine.js'); Object.assign(globalThis,E); // core.js uses engine functions as globals, like in the browser
const C=require('../src/core.js');
let fails=0, passes=0;
function ok(cond,msg){ if(cond) passes++; else { fails++; console.log('  ✗ '+msg); } }
function section(name,fn){ const t=Date.now(); const f0=fails; fn(); console.log(`${fails===f0?'✓':'✗'} ${name} (${Date.now()-t} ms)`); }
// localStorage stand-in
const mem=init=>{ const m=new Map(Object.entries(init||{})); return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m}; };
module.exports={E,C,ok,section,mem,done:()=>({fails,passes})};
