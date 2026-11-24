// Long bot sims for tuning. node tests/sim.js levels [N]  |  node tests/sim.js daily [N]  |  node tests/sim.js classic [N]
// Prints the measured spread and suggested targets. Casual bot = an average player (★1-3), strong = mastery (★4-5).
const L=require('./lib.js').load(['engine.js','levels.js']);
const mode=process.argv[2]||'levels', N=+process.argv[3]||12, NS=Math.max(3,N/4|0);
const pct=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:NaN; };
const r5=v=>Math.round(v/5)*5, r500=v=>Math.round(v/500)*500;
function runs(cfg,kind,n,max){ const out=[]; for(let i=0;i<n;i++){ const st=L.botPlay(cfg,kind,max,null,i); out.push(st); } return out; }
if(mode==='levels'){ const out={};
  for(const lv of L.LEVELS){ if(lv.type==='puzzle'){ console.log(lv.id,lv.name,'puzzle: par',lv.goal.par,'(stored solution)'); continue; }
    const cfg=L.levelCfg(lv), max=60*60*10; const C=runs(cfg,'casual',N,max), S=runs(cfg,lv.type==='survive'||lv.type==='dig'?'flat':'strong',NS,max);
    const okC=C.filter(s=>s.result&&s.result.ok), okS=S.filter(s=>s.result&&s.result.ok);
    const f=(a,k)=>a.map(s=>k(s)); const secs=s=>s.tick/60, sc=s=>s.score, pcs=s=>s.stats.pieces, hh=s=>s.result.h, q=s=>s.stats.quads+s.stats.quints;
    const line=`${lv.id} ${lv.name.padEnd(20)} casual ok ${okC.length}/${N}  strong ok ${okS.length}/${NS}`;
    let sug=null;
    if(lv.type==='sprint'){ const par=r5(pct(f(okC,secs),0.5)); sug=[['goal'],['time',par],['time',r5(par*0.8)],lv.cfg.hold===false?['time',r5(Math.max(pct(f(okS,secs),0.5)*1.1,par*0.6))]:['nohold'],['quads',Math.max(1,Math.min(4,Math.round(pct(f(okS,q),0.5)*0.7)))]];
      console.log(line,` time c50 ${pct(f(okC,secs),.5)|0} c20 ${pct(f(okC,secs),.2)|0} s50 ${pct(f(okS,secs),.5)|0} quads s50 ${pct(f(okS,q),.5)}`); }
    if(lv.type==='survive'){ sug=[['goal'],['stack',Math.max(4,Math.round(pct(f(okC,hh),0.5)))],['score',r500(pct(f(okC,sc),0.5))],['nohold'],['half']];
      console.log(line,` h c50 ${pct(f(okC,hh),.5)} score c50 ${pct(f(okC,sc),.5)} s50 ${pct(f(okS,sc),.5)} half s ${okS.filter(s=>!s.stats.aboveHalf).length}/${NS}`); }
    if(lv.type==='score'){ sug=[['goal'],['score',r500(pct(f(okC,sc),0.4))],['score',r500(pct(f(okC,sc),0.75))],['score',r500(pct(f(okS,sc),0.5))],['sweep']];
      console.log(line,` score c40 ${pct(f(okC,sc),.4)} c75 ${pct(f(okC,sc),.75)} s50 ${pct(f(okS,sc),.5)}`); }
    if(lv.type==='dig'){ sug=[['goal'],['pieces',Math.round(pct(f(okC,pcs),0.6))],['time',r5(pct(f(okC,secs),0.6))],['nohold'],['dig',Math.max(1,pct(okS.map(s=>s.stats.maxAboveStart),0.5))]];
      console.log(line,` pieces c60 ${pct(f(okC,pcs),.6)} time c60 ${pct(f(okC,secs),.6)|0} s50 pcs ${pct(f(okS,pcs),.5)} above s50 ${pct(okS.map(s=>s.stats.maxAboveStart),.5)}`); }
    out[lv.id]=sug; }
  console.log('SUGGEST '+JSON.stringify(out)); }
if(mode==='daily'){ const out=[];
  L.DAILY.forEach((d,i)=>{ const cfg=Object.assign({board:d[0],speed:d[1],set:d[2]},d[3],{goal:{type:'blitz',ticks:L.DAILY_S*60},seed:'LFDSIM|'+i});
    const C=runs(cfg,'casual',N,1e9), S=runs(cfg,'strong',NS,1e9); const sc=C.map(s=>s.score), ss=S.map(s=>s.score), early=C.filter(s=>s.phase==='over'&&s.tick<3600).length;
    const th=[r500(pct(sc,0.3)),r500(pct(sc,0.8)),r500(pct(ss,0.5)*0.75)];
    console.log(i,L.comboLabel({board:d[0],speed:d[1],set:d[2],extras:d[3]}).padEnd(36),'casual p30',pct(sc,.3),'p80',pct(sc,.8),'strong p50',pct(ss,.5),'early top-outs',early+'/'+N,'->',th.join('/'));
    out.push(th); });
  console.log('SUGGEST '+JSON.stringify(out)); }
if(mode==='classic'){ for(const b of L.BOARD_IDS) for(const sp of L.SPEED_IDS) for(const set of L.SET_IDS){ const cfg={board:b,speed:sp,set,seed:'LFSIM|'+b+sp+set};
  const C=runs(cfg,'casual',N,60*60*20), S=runs(cfg,'strong',NS,60*60*20);
  console.log(b,sp,set,'casual score p50',pct(C.map(s=>s.score),.5),'lines',pct(C.map(s=>s.lines),.5),'secs',pct(C.map(s=>s.tick/60|0),.5),'| strong p50',pct(S.map(s=>s.score),.5),'lines',pct(S.map(s=>s.lines),.5)); } }
