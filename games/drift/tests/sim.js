// Long bot sims for tuning. node tests/sim.js levels [N] | normal [N] | endless [N]
// Casual bot = an average player; strong = mastery. Par times = casual median clear time × ~1.15, rounded to 5 s.
// Flags any level the casual bot can't clear with lives to spare.
const L=require('./lib.js').load(['engine.js','levels.js']);
const mode=process.argv[2]||'levels', N=+process.argv[3]||8;
const pct=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:NaN; };
const r5=v=>Math.round(v/5)*5;
function runs(cfg,kind,n){ const out=[]; for(let i=0;i<n;i++) out.push(L.botPlay(cfg,kind,60*60*15,null,i)); return out; }
if(mode==='levels'){ const par={};
  for(const lv of L.LEVELS){ const C=runs(L.levelCfg(lv),'casual',N), okC=C.filter(s=>s.result.ok), S=runs(L.levelCfg(lv),'strong',Math.max(2,N/4|0)), okS=S.filter(s=>s.result.ok);
    const t=okC.map(s=>s.tick/60), lives=okC.map(s=>s.lives), p=r5(pct(t,.5)*1.15);
    par[lv.id]=p||lv.par; const flag=okC.length<N*0.75||pct(lives,.5)<2?'  <-- check':'';
    console.log(`${lv.id.padEnd(4)}${lv.name.padEnd(16)} casual ${okC.length}/${N} t50 ${pct(t,.5)|0}s lives50 ${pct(lives,.5)}  strong ${okS.length}/${S.length} t50 ${pct(okS.map(s=>s.tick/60),.5)|0}s  par ${p}${flag}`); }
  console.log('const PAR='+JSON.stringify(par).replace(/"/g,'')+';'); }
if(mode==='normal'){ for(const d of L.DIFF_IDS){ const cfg=L.normalCfg(d,{},{seed:'sim-'+d}); const C=[]; for(let i=0;i<N;i++) C.push(L.botPlay(Object.assign({},cfg,{seed:'sim-'+d+i}),'casual',60*60*20,null,i));
    const ok=C.filter(s=>s.result.ok), t=ok.map(s=>s.tick/60); console.log(`${d}: casual ${ok.length}/${N} t50 ${pct(t,.5)|0}s → par ${r5(pct(t,.5)*1.15)} (lives50 ${pct(ok.map(s=>s.lives),.5)})`); } }
if(mode==='endless'){ for(const k of ['casual','strong']){ const w=[]; for(let i=0;i<N;i++) w.push(L.botPlay(Object.assign(L.endlessCfg({}),{seed:'e'+i}),k,60*60*40,null,i).wave); console.log(k,'waves',w.join(' '),'median',pct(w,.5)); } }
