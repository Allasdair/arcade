// Loads the game's pure sources into one shared scope, the way build.py concatenates them for the browser.
const fs=require('fs'), path=require('path'), vm=require('vm');
const SRC=path.join(__dirname,'..','src');
const FILES=['engine.js','solver.js','bank.js','levels.js','core.js'];
function load(files){ const ctx={console,Math,JSON,Date,Object,Array,String,Number,Set,Map,Error,btoa,atob,TextEncoder,TextDecoder,Uint8Array,Int8Array,Int32Array,Uint32Array,Float64Array,performance}; vm.createContext(ctx);
  const names=files||FILES;
  let code=names.filter(f=>fs.existsSync(path.join(SRC,f))).map(f=>fs.readFileSync(path.join(SRC,f),'utf8')).join('\n');
  const ids=[...code.matchAll(/^function\*?\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
  for(const line of code.split('\n')){ const m=/^(?:const|let)\s+/.exec(line); if(!m) continue; let d=0, i=m[0].length, want=true, q=null;
    while(i<line.length){ const c=line[i];
      if(q){ if(c==='\\') i++; else if(c===q) q=null; i++; continue; }
      if(c==="'"||c==='"'||c==='`'){ q=c; i++; continue; }
      if('([{'.includes(c)) d++; else if(')]}'.includes(c)) d--; else if(c===','&&d===0) want=true; else if(c===';'&&d===0) break;
      else if(want&&d===0&&/[A-Za-z_$]/.test(c)){ const id=/^[A-Za-z_$][\w$]*/.exec(line.slice(i))[0]; if(line.slice(i+id.length).trimStart()[0]==='=') ids.push(id); want=false; i+=id.length; continue; }
      i++; } }
  code+='\n;globalThis.__X={'+[...new Set(ids)].join(',')+'};';
  vm.runInContext(code,ctx,{filename:'solitaire'}); return ctx.__X; }
let pass=0, fail=0; const fails=[];
function ok(c,msg){ if(c) pass++; else { fail++; fails.push(msg); if(fails.length<=40) console.log('  FAIL: '+msg); } }
function eq(a,b,msg){ ok(JSON.stringify(a)===JSON.stringify(b),msg+` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }
module.exports={load,ok,eq,res:()=>({pass,fail,fails})};
