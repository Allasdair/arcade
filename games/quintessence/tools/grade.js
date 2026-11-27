// node tools/grade.js   (QUICK=1 for a short run)  → src/levels.js and tools/grade_report.json
// Builds the 45 campaign levels from tools/recipes.js and grades each one with the bots, through the real engine:
//  · move limit: the casual bot (300 plays, different noise seeds) meets the goal about TARGET of the time
//    (Origins 80%, Stormfront 65%, Frostfall 55%; tight twist 15 points lower). Refills are seeded, so the variety
//    comes from the bot's choices, as it would from different players.
//  · par (moves to spare for ★2): the strong bot's median moves left × 0.7, rounded down, at least 1
//  · score goals: the casual bot's median goal score after the recipe's scoreMoves
//  · timed levels: limit × SEC_PER_MOVE seconds; par in seconds left
//  · the Daily: each weekday graded over sample dates the same way
//  · Classic: bronze = the casual bot's median score, silver = its 80th percentile, per mode × board × elements
// All thresholds are the constants just below.
const path=require('path'), fs=require('fs'), {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const QUICK=!!process.env.QUICK;
const K={PLAYS:QUICK?40:300,STRONG:QUICK?6:24,TARGET:[.80,.65,.55],TIGHT:.15,PAR:.7,SEC_PER_MOVE:3.5,CAP:150,SCORE_PLAYS:QUICK?20:80,
  DAILY_DATES:QUICK?3:14,DAILY_PLAYS:QUICK?16:60,DAILY_STRONG:QUICK?2:6,DAILY_TARGET:.65,CL_PLAYS:QUICK?6:30,TIMED_MOVES:40};
const quant=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.max(0,Math.ceil(p*s.length)-1))]; };
const median=a=>quant(a,.5);
const r500=n=>Math.max(500,Math.round(n/500)*500);

function worker(){ const L=require('../tests/lib.js'); const X=L.load(['engine.js','bot.js','core.js']); const {findPuzzle}=require('./puzzles.js');
  const scoreTarget=(cfg,moves,share,plays)=>{ const sc=[]; const base=Object.assign({},cfg,{goals:cfg.goals.filter(g=>g.t!=='score'),limit:moves});
    for(let i=0;i<plays;i++){ const r=X.botPlay(base,'casual','s'+i,moves); sc.push(r.st.gscore); } return r500(median(sc)*(share||1)); };
  const playMany=(cfg,kind,n,tag)=>{ const out=[]; for(let i=0;i<n;i++){ const r=X.botPlay(cfg,kind,tag+i,K.CAP); out.push(r.won?r.moves:Infinity); } return out; };
  function gradeLevel(R){ const id=['o','s','f'][R.camp]+R.n, seed='QNL|'+id; let W=R.W||8, H=R.H||8;
    const cfg={W,H,ne:R.ne,seed,shape:R.shape||null,goals:(R.goals||[]).map(g=>Object.assign({},g)),relics:R.relics||null,twist:R.twist||''};
    const out={id,camp:R.camp,n:R.n,name:R.name,ne:R.ne,tip:R.tip}; if(R.type) out.type=R.type; if(R.twist) out.twist=R.twist; if(R.shape) out.shape=R.shape;
    if(R.type==='puzzle'){ const p=findPuzzle(R.ne,'camp'+R.ne); Object.assign(out,{W:p.W,H:p.H,seed,map:p.map,pieces:p.pieces,goals:[{t:'frost'}],limit:p.min+1,par:1,min:p.min,firsts:p.firsts}); return {L:out,rep:{id,name:R.name,puzzle:true,min:p.min,firsts:p.firsts}}; }
    cfg.map=X.buildMap(W,H,X.shapeMask(cfg.shape,W,H),R.ob||[],X.rngFor(seed+'|map'));
    const sg=cfg.goals.find(g=>g.t==='score'); if(sg) sg.n=scoreTarget(cfg,R.scoreMoves||14,R.scoreShare,K.SCORE_PLAYS);
    const cas=playMany(cfg,'casual',K.PLAYS,'c'), p=K.TARGET[R.camp]-(R.twist==='tight'?K.TIGHT:0);
    let limit=quant(cas,p); if(!isFinite(limit)) limit=K.CAP; const rate=cas.filter(m=>m<=limit).length/cas.length;
    const str=playMany(cfg,'strong',K.STRONG,'s'), smed=median(str.map(m=>isFinite(m)?m:K.CAP));
    let par=Math.max(1,Math.floor((limit-smed)*K.PAR));
    Object.assign(out,{W,H,seed,map:cfg.map,goals:cfg.goals,limit}); if(R.relics) out.relics=R.relics;
    if(R.twist==='timed'){ out.time=Math.ceil(limit*K.SEC_PER_MOVE/5)*5; par=Math.max(5,Math.floor((out.time-smed*K.SEC_PER_MOVE)*K.PAR/5)*5); }
    out.par=par;
    return {L:out,rep:{id,name:R.name,limit,rate:+rate.toFixed(3),target:p,par,strongMedian:smed,casualMedian:median(cas),time:out.time||0,goals:cfg.goals}}; }
  function gradeDaily(wd){ const days=[]; for(let d=new Date(Date.UTC(2026,10,23));days.length<K.DAILY_DATES;d=new Date(d.getTime()+864e5)) if(d.getUTCDay()===wd) days.push(d.toISOString().slice(0,10));
    // score weekdays: the casual median after 14 moves, then the move limit as usual
    const cfg0=X.dailyCfg(days[0],{limit:0,par:1,score:1}); let score=0;
    if(cfg0.goals.some(g=>g.t==='score')){ const sc=[]; for(const date of days){ const c=X.dailyCfg(date,{limit:0,par:1,score:1}); const base=Object.assign({},c,{goals:c.goals.filter(g=>g.t!=='score'),limit:14});
        for(let i=0;i<Math.ceil(K.SCORE_PLAYS/2);i++) sc.push(X.botPlay(base,'casual','ds'+i,14).st.gscore); } score=r500(median(sc)); }
    const cas=[], str=[];
    for(const date of days){ const c=X.dailyCfg(date,{limit:0,par:1,score}); c.limit=0; cas.push(...playMany(c,'casual',K.DAILY_PLAYS,'d'+date)); str.push(...playMany(c,'strong',K.DAILY_STRONG,'ds'+date)); }
    let limit=quant(cas,K.DAILY_TARGET); if(!isFinite(limit)) limit=K.CAP; const smed=median(str.map(m=>isFinite(m)?m:K.CAP));
    return {wd,limit,par:Math.max(1,Math.floor((limit-smed)*K.PAR)),score,rate:+(cas.filter(m=>m<=limit).length/cas.length).toFixed(3),days}; }
  function gradeClassic(key){ const [mode,board,ne]=key.split('|'), sc=[];
    for(let i=0;i<K.CL_PLAYS;i++){ const cfg=X.classicCfg({mode:'moves',board,ne:+ne,obst:'off'},'cl|'+key+'|'+i); const mv=mode==='moves'?30:K.TIMED_MOVES; cfg.limit=mv; sc.push(X.botPlay(cfg,'casual','k'+i,mv).score); }
    return {key,bronze:Math.round(median(sc)/100)*100,silver:Math.round(quant(sc,.8)/100)*100}; }
  function gradeObFactor(){ const a=[], b=[]; for(let i=0;i<K.CL_PLAYS*2;i++) for(const ob of ['off','light']){ const cfg=X.classicCfg({mode:'moves',board:'8',ne:5,obst:ob},'of|'+i); (ob==='off'?a:b).push(X.botPlay(cfg,'casual','f'+i,30).score); } return +(median(b)/median(a)).toFixed(3); }
  parentPort.on('message',job=>{ let res; if(job.t==='level') res=gradeLevel(job.R); else if(job.t==='daily') res=gradeDaily(job.wd); else if(job.t==='classic') res=gradeClassic(job.key); else if(job.t==='obf') res=gradeObFactor();
    parentPort.postMessage({id:job.id,res}); }); }

// ONLY=o6,s3 node tools/grade.js re-grades just those levels and keeps everything else from the last full run
async function main(){ const {RECIPES}=require('./recipes.js'); const t0=Date.now(), ONLY=(process.env.ONLY||'').split(',').filter(Boolean);
  if(ONLY.length) return only(RECIPES,ONLY,t0);
  const jobs=[]; RECIPES.forEach((R,i)=>jobs.push({t:'level',R,id:'L'+i}));
  for(let wd=0;wd<7;wd++) jobs.push({t:'daily',wd,id:'D'+wd});
  for(const mode of ['moves','timed']) for(const b of ['7','8','9','heart','diamond','ring','cross','hourglass','islands']) for(const ne of [4,5,6]) jobs.push({t:'classic',key:`${mode}|${b}|${ne}`,id:`C${mode}${b}${ne}`});
  jobs.push({t:'obf',id:'OBF'});
  // longest first
  jobs.sort((a,b)=>(a.t==='daily'?0:a.t==='level'?1:2)-(b.t==='daily'?0:b.t==='level'?1:2));
  const results={}; const nW=Math.max(1,require('os').cpus().length); let next=0, done=0;
  await new Promise(resolve=>{ for(let w=0;w<nW;w++){ const wk=new Worker(__filename,{workerData:{}});
      const feed=()=>{ if(next>=jobs.length){ wk.terminate(); return; } const j=jobs[next++]; wk.postMessage(j); };
      wk.on('message',m=>{ results[m.id]=m.res; done++; if(m.id[0]==='L') console.log(`${m.res.rep.id} ${m.res.rep.name}: limit ${m.res.rep.limit||'-'} rate ${m.res.rep.rate||'-'} par ${m.res.L.par}${m.res.rep.time?' time '+m.res.rep.time+'s':''} (${((Date.now()-t0)/1000)|0}s)`);
        else if(m.id[0]==='D') console.log(`Daily ${m.res.wd}: limit ${m.res.limit} par ${m.res.par} rate ${m.res.rate} score ${m.res.score}`);
        if(done===jobs.length) resolve(); feed(); });
      feed(); } });
  const levels=RECIPES.map((R,i)=>results['L'+i].L), report=RECIPES.map((R,i)=>results['L'+i].rep);
  const daily=[0,1,2,3,4,5,6].map(wd=>{ const d=results['D'+wd]; return {limit:d.limit,par:d.par,score:d.score,rate:d.rate}; });
  const classic={}; for(const k in results) if(k[0]==='C'){ const c=results[k]; classic[c.key]=[c.bronze,c.silver]; }
  const camps=[{id:'origins',name:'Origins',ne:4,xp:6,bonus:75},{id:'stormfront',name:'Stormfront',ne:5,xp:10,bonus:150},{id:'frostfall',name:'Frostfall',ne:6,xp:15,bonus:225}];
  const js=`// Generated by tools/grade.js${QUICK?' (QUICK run)':''} on ${new Date().toISOString().slice(0,10)}. Don't edit by hand: change tools/recipes.js and re-run.
// Each level: board, element count, obstacle map, goals, move limit (casual-bot target rate), par (strong bot), seed.
const CAMPS=${JSON.stringify(camps)};
const LEVELS=[
${levels.map(l=>' '+JSON.stringify(l)).join(',\n')}];
// the Daily by weekday (0 Sunday … 6 Saturday): move limit, par, score target
const DAILY_GRADE=${JSON.stringify(daily)};
// Classic bronze and silver by mode|board|elements (obstacles off); Light obstacles scale them by CLASSIC_OB_FACTOR
const CLASSIC_SCORES=${JSON.stringify(classic)};
const CLASSIC_OB_FACTOR=${results.OBF};
`;
  fs.writeFileSync(path.join(__dirname,'..','src','levels.js'),js);
  fs.writeFileSync(path.join(__dirname,'grade_report.json'),JSON.stringify({quick:QUICK,constants:K,levels:report,daily:[0,1,2,3,4,5,6].map(wd=>results['D'+wd]),classic,obFactor:results.OBF,seconds:((Date.now()-t0)/1000)|0},null,1));
  console.log(`wrote src/levels.js in ${((Date.now()-t0)/1000)|0}s`); }
async function only(RECIPES,ids,t0){ const lvPath=path.join(__dirname,'..','src','levels.js'), repPath=path.join(__dirname,'grade_report.json');
  const rep=JSON.parse(fs.readFileSync(repPath,'utf8')); let js=fs.readFileSync(lvPath,'utf8'); const wk=new Worker(__filename,{workerData:{}});
  for(const id of ids){ const R=RECIPES.find(r=>['o','s','f'][r.camp]+r.n===id); const res=await new Promise(ok=>{ wk.once('message',m=>ok(m.res)); wk.postMessage({t:'level',R,id}); });
    js=js.replace(new RegExp('^ \\{"id":"'+id+'".*?(,?)$','m'),(m,comma)=>' '+JSON.stringify(res.L)+comma); const k=rep.levels.findIndex(r=>r.id===id); rep.levels[k]=res.rep;
    console.log(`${id}: limit ${res.rep.limit} rate ${res.rep.rate} par ${res.L.par}`); }
  wk.terminate(); fs.writeFileSync(lvPath,js); fs.writeFileSync(repPath,JSON.stringify(rep,null,1)); console.log(`re-graded ${ids.join(', ')} in ${((Date.now()-t0)/1000)|0}s`); }
if(isMainThread) main(); else worker();
