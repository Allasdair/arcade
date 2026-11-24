// Tiny test helper: no dependencies, so `node tests/run.js` works anywhere Node 18+ is installed.
const E=require('../src/engine.js'); Object.assign(globalThis,E); // core.js and the app use engine functions as globals, like in the browser
const C=require('../src/core.js');
let fails=0, passes=0;
function ok(cond,msg){ if(cond) passes++; else { fails++; console.log('  ✗ '+msg); } }
function section(name,fn){ const t=Date.now(); const f0=fails; fn(); console.log(`${fails===f0?'✓':'✗'} ${name} (${Date.now()-t} ms)`); }
const QUICK=!!process.env.QUICK;
// A game with a hand-set board (row-major values; 0 = empty).
function withBoard(board,vals,seed='fix'){ const G=E.newGame({board,seed}); G.b=G.b.map((_,i)=>G.mask[i]?(vals[i]|0):0); let id=1; G.ids=G.b.map(v=>v?id++:0); G.nid=id; G.max=Math.max(...G.b); G.over=!E.canMove(G); return G; }
module.exports={E,C,ok,section,withBoard,QUICK,done:()=>({fails,passes})};
