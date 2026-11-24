// Long AI-vs-AI sims for tuning (Node only).
//   node tests/sim.js leave [games]      fit the Expert's leave table from Hard-vs-Hard self-play
//   node tests/sim.js strength [games]   every pairing of the four strengths on Medium (default 200 games a pairing)
//   node tests/sim.js levels [runs]      campaign targets: what a casual and a strong bot score on each level
//   node tests/sim.js daily [days]       Daily par, and what each strength scores against it
//   node tests/sim.js pick               choose each campaign level's seed so a strong bot meets the goal (and the twist)
const {load}=require('./lib.js'); const L=load();
const mode=process.argv[2]||'strength', N=+process.argv[3]||0;
const t0=Date.now(), log=(...a)=>console.log(...a);

function play(cfg){ const st=L.newGame(cfg); while(!st.over){ const p=st.turn; L.aiTurn(st,st.cfg.players[p].ai); } return st; }

if(mode==='leave'){ const G=N||300, rows=[]; const F=L.ALPHA.split('').concat(['?']);
  for(let g=0;g<G;g++){ const st=L.newGame({size:'medium',boardSeed:9000+g,bagSeed:7000+g,players:[{name:'A',ai:'hard'},{name:'B',ai:'hard'}]}); const pend=[null,null];
    while(!st.over){ const p=st.turn, ms=L.allMoves(st,st.racks[p]); let best=0; for(const m of ms) if(m.sc>best) best=m.sc;
      if(pend[p]&&st.bag.length>=7) rows.push({leave:pend[p],y:best});
      const mv=L.aiChoose(st,p,'hard',ms); const before=st.racks[p].slice(); L.applyMove(st,mv.t==='p'?{t:'p',tiles:mv.tiles}:mv);
      pend[p]=mv.t==='p'?L.leaveAfter(before,mv.mv):null; }
    if(g%50===49) log(`  ${g+1} games, ${rows.length} samples`); }
  // features: count of each tile kept, duplicates, vowel-balance bins (only for leaves of 3+), intercept
  const feat=lv=>{ const x=new Array(F.length+1+7+1).fill(0); const seen={}; let vow=0;
    for(const t of lv){ x[F.indexOf(t)]++; if(seen[t]) x[F.length]++; seen[t]=1; if('AEIOU'.includes(t)) vow++; }
    if(lv.length>=3) x[F.length+1+Math.round(vow*6/lv.length)]=1; x[x.length-1]=1; return x; };
  const X=rows.map(r=>feat(r.leave)), y=rows.map(r=>r.y), k=X[0].length, A=Array.from({length:k},()=>new Array(k).fill(0)), bv=new Array(k).fill(0);
  for(let i=0;i<X.length;i++) for(let a=0;a<k;a++){ bv[a]+=X[i][a]*y[i]; for(let c=0;c<k;c++) A[a][c]+=X[i][a]*X[i][c]; }
  for(let a=0;a<k-1;a++) A[a][a]+=20; // ridge
  // solve A w = bv (Gaussian elimination)
  const M=A.map((r,i)=>r.concat([bv[i]]));
  for(let c=0;c<k;c++){ let piv=c; for(let r=c+1;r<k;r++) if(Math.abs(M[r][c])>Math.abs(M[piv][c])) piv=r; [M[c],M[piv]]=[M[piv],M[c]];
    for(let r=0;r<k;r++){ if(r===c) continue; const f=M[r][c]/M[c][c]; for(let q=c;q<=k;q++) M[r][q]-=f*M[c][q]; } }
  const w=M.map((r,i)=>r[k]/r[i]); const vb=w.slice(F.length+1,F.length+8), mid=vb[3];
  log(`${rows.length} samples from ${G} games (${((Date.now()-t0)/1000).toFixed(0)} s)`);
  log('const LEAVE={'+F.map((t,i)=>`${t==='?'?"'?'":t}:${w[i].toFixed(1)}`).join(',')+'};');
  log(`const LEAVE_DUP=${w[F.length].toFixed(1)}, LEAVE_VOWEL=[${vb.map(v=>(v-mid).toFixed(1)).join(',')}];`);
  process.exit(0); }

if(mode==='pick'){ const fs=require('fs'), path=require('path'), seeds={};
  for(const Lv of L.LEVELS){ if(Lv.type==='puzzle') continue; let pick=null, fallback=null;
    for(let v=0;v<40&&pick===null;v++){ const c=L.levelCfg(Lv,v); c.players[0].ai='expert'; const o=L.levelOutcome(Lv,play(c));
      if(o.goal&&o.twist) pick=v; else if(o.goal&&fallback==null) fallback=v; }
    const v=pick!=null?pick:fallback; if(v==null) log(`  ${Lv.id}: no seed found!`); else { if(v) seeds[Lv.id]=v; log(`${Lv.id} ${Lv.name}: seed ${v}${pick==null?' (goal only)':''}`); } }
  const f=path.join(__dirname,'..','src','levels.js'); let s=fs.readFileSync(f,'utf8');
  s=s.replace(/const LEVEL_SEEDS=\{[^}]*\};/,'const LEVEL_SEEDS={'+Object.entries(seeds).map(([k,v])=>k+':'+v).join(',')+'};'); fs.writeFileSync(f,s);
  log(`wrote LEVEL_SEEDS (${((Date.now()-t0)/1000).toFixed(0)} s)`); process.exit(0); }

if(mode==='strength'){ const G=N||200, lv=['easy','normal','hard','expert'], res={};
  for(let a=0;a<4;a++) for(let b=a+1;b<4;b++){ let wa=0, wb=0, d=0, sa=0, sb=0;
    for(let g=0;g<G;g++){ const sw=g%2, P=[{name:lv[a],ai:lv[a]},{name:lv[b],ai:lv[b]}]; if(sw) P.reverse();
      const st=play({size:'medium',boardSeed:100+g,bagSeed:5000+g+a*1000+b*100,players:P}); const f=st.result.final, ia=sw?1:0, ib=1-ia;
      sa+=f[ia]; sb+=f[ib]; if(st.result.winner===ia) wa++; else if(st.result.winner===ib) wb++; else d++; }
    res[lv[a]+'-'+lv[b]]={wa,wb,d}; log(`${lv[b].padEnd(6)} vs ${lv[a].padEnd(6)}: ${lv[b]} wins ${wb}/${G} (${(wb/G*100).toFixed(0)}%), draws ${d}, avg ${Math.round(sb/G)}–${Math.round(sa/G)}`); }
  log(`(${((Date.now()-t0)/1000).toFixed(0)} s)`); process.exit(0); }

if(mode==='daily'){ const D=N||20; const days=[]; const d0=Date.UTC(2026,10,24);
  for(let i=0;i<D;i++){ const t=new Date(d0+i*864e5), date=t.toISOString().slice(0,10), cfg=L.dailyCfg(date), par=L.dailyPar(date), row={date,par};
    for(const lv of ['easy','normal','hard']){ const st=L.newGame(cfg); while(!st.over) L.aiTurn(st,lv); row[lv]=st.scores[0]; }
    days.push(row); log(`${date}: par ${par}, easy ${row.easy} (${Math.round(row.easy/par*100)}%), normal ${row.normal} (${Math.round(row.normal/par*100)}%), hard ${row.hard} (${Math.round(row.hard/par*100)}%)`); }
  const avg=k=>Math.round(days.reduce((a,r)=>a+r[k]/r.par,0)/days.length*100);
  log(`average % of par: easy ${avg('easy')}, normal ${avg('normal')}, hard ${avg('hard')}; par ${Math.min(...days.map(r=>r.par))}–${Math.max(...days.map(r=>r.par))}`); process.exit(0); }

if(mode==='levels'){ const R=N||6, med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];
  for(const Lv of L.LEVELS){ if(Lv.type==='puzzle'){ const Z=L.PUZZLES[Lv.puzzle]; log(`${'AJM'[Lv.camp]}${Lv.n} ${Lv.name.padEnd(18)} puzzle  best ${Z.best} (${Z.answer})`); continue; }
    const row={};
    for(const [who,lvl] of [['casual','normal'],['good','hard'],['strong','expert']]){ const os=[];
      for(let r=0;r<R;r++){ const c=L.levelCfg(Lv,r); c.players[0].ai=lvl; const st=play(c); os.push(L.levelOutcome(Lv,st)); }
      row[who]=os; }
    const f=k=>['casual','good','strong'].map(w=>med(row[w].map(o=>+o[k]))).join('/');
    const g=k=>['casual','good','strong'].map(w=>row[w].filter(o=>o[k]).length).join('/');
    log(`${'AJM'[Lv.camp]}${Lv.n} ${Lv.name.padEnd(18)} ${Lv.type.padEnd(7)} ${Lv.type==='duel'?'wins '+g('win')+' of '+R+' · margin '+f('margin'):'goal '+Lv.goal.v+' met '+g('goal')}`+
      ` · score ${f('score')} · move ${f('move')} · long ${f('long')} · full ${g('full')} · twist[${Lv.twist.k} ${Lv.twist.v||''}] ${g('twist')} · real seed: ${(()=>{ const out=[]; for(const lvl of ['normal','hard']){ const c=L.levelCfg(Lv,0); c.players[0].ai=lvl; const o=L.levelOutcome(Lv,play(c)); out.push(lvl[0]+':'+(Lv.type==='duel'?(o.win?'W':'L')+o.margin:o.score)+(o.twist?'*':'')); } return out.join(' '); })()}`); }
  log(`(${((Date.now()-t0)/1000).toFixed(0)} s)`); process.exit(0); }
